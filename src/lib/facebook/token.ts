// Token helper - Lấy token từ Sheets hoặc fallback về .env

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const APPS_SCRIPT_SECRET = process.env.GOOGLE_APPS_SCRIPT_SECRET;
const FB_ACCESS_TOKEN_ENV = process.env.FB_ACCESS_TOKEN;

export interface TokenResult {
    accessToken: string | null;
    source: 'sheets' | 'env' | 'none';
    isExpired: boolean;
    expiresAt: string | null;
    error?: string;
}

/**
 * Lấy access token hợp lệ: ưu tiên Sheets, fallback về .env
 */
export async function getValidAccessToken(): Promise<TokenResult> {
    try {
        // Try to get token from Sheets first
        const url = new URL(APPS_SCRIPT_URL!);
        url.searchParams.set('secret', APPS_SCRIPT_SECRET!);
        url.searchParams.set('action', 'getToken');
        url.searchParams.set('userId', 'default');

        const response = await fetch(url.toString());
        const result = await response.json();

        if (result.success && result.hasToken && !result.isExpired) {
            return {
                accessToken: result.token.access_token,
                source: 'sheets',
                isExpired: false,
                expiresAt: result.token.expires_at,
            };
        }

        // Sheets token expired or not found - fallback to .env
        if (FB_ACCESS_TOKEN_ENV) {
            // Validate .env token with a simple API call
            const validateRes = await fetch(
                `https://graph.facebook.com/v19.0/me?access_token=${FB_ACCESS_TOKEN_ENV}`
            );
            const validateData = await validateRes.json();

            if (!validateData.error) {
                return {
                    accessToken: FB_ACCESS_TOKEN_ENV,
                    source: 'env',
                    isExpired: false,
                    expiresAt: null,
                };
            }

            // .env token is also invalid
            return {
                accessToken: null,
                source: 'none',
                isExpired: true,
                expiresAt: null,
                error: validateData.error?.message || 'ENV token expired',
            };
        }

        // No token available
        return {
            accessToken: null,
            source: 'none',
            isExpired: result.isExpired || false,
            expiresAt: result.token?.expires_at || null,
            error: result.isExpired ? 'Token expired' : 'No token found',
        };

    } catch (error) {
        // On error, try .env token as last resort
        if (FB_ACCESS_TOKEN_ENV) {
            return {
                accessToken: FB_ACCESS_TOKEN_ENV,
                source: 'env',
                isExpired: false,
                expiresAt: null,
            };
        }

        return {
            accessToken: null,
            source: 'none',
            isExpired: false,
            expiresAt: null,
            error: String(error),
        };
    }
}

/**
 * Check if we need user to re-authenticate
 */
export async function needsReauth(): Promise<boolean> {
    const result = await getValidAccessToken();
    return result.accessToken === null;
}
