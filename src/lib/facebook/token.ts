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
 * Lấy access token hợp lệ: ưu tiên Sheets (TaiKhoan), fallback về .env
 * @param userId - Facebook user ID (optional, sẽ lấy từ sheet nếu không truyền)
 */
export async function getValidAccessToken(userId?: string): Promise<TokenResult> {
    try {
        // Try to get token from TaiKhoan sheet first
        const url = new URL(APPS_SCRIPT_URL!);
        url.searchParams.set('secret', APPS_SCRIPT_SECRET!);
        url.searchParams.set('action', 'getTaiKhoan');

        // Use provided userId or 'first' to get first available user
        url.searchParams.set('fb_user_id', userId || 'first');

        console.log('[TOKEN] Fetching from Apps Script:', url.toString().replace(/secret=[^&]+/, 'secret=***'));

        const response = await fetch(url.toString());
        const result = await response.json();

        console.log('[TOKEN] Apps Script response:', JSON.stringify({
            success: result.success,
            found: result.found,
            hasToken: !!result.data?.access_token,
            isExpired: result.data?.is_token_expired,
            error: result.error || result.message
        }));

        // TaiKhoan returns: { success, found, data: { access_token, is_token_expired, ... } }
        if (result.success && result.found && result.data?.access_token && !result.data.is_token_expired) {
            console.log('[TOKEN] Got valid token from Sheets');
            return {
                accessToken: result.data.access_token,
                source: 'sheets',
                isExpired: false,
                expiresAt: result.data.token_expires_at || null,
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
            isExpired: result.data?.is_token_expired || false,
            expiresAt: result.data?.token_expires_at || null,
            error: result.data?.is_token_expired ? 'Token expired' : 'No token found',
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
