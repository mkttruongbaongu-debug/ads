import NextAuth, { AuthOptions } from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";

// Hàm gọi Google Apps Script để lưu user
async function saveUserToSheet(user: {
    fb_user_id: string;
    name: string;
    email?: string;
    avatar?: string;
}) {
    try {
        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';

        if (!scriptUrl) {
            console.error('[saveUser] Missing APPS_SCRIPT_URL');
            return;
        }

        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret,
                action: 'saveUser',
                user
            }),
        });

        const result = await response.json();
        console.log('[saveUser] Result:', result);
    } catch (error) {
        console.error('[saveUser] Error:', error);
    }
}

// Hàm gọi Google Apps Script để lưu token
async function saveTokenToSheet(tokenData: {
    user_id: string;
    access_token: string;
    token_type: string;
    expires_at?: string;
}) {
    try {
        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';

        if (!scriptUrl) {
            console.error('[saveToken] Missing APPS_SCRIPT_URL');
            return;
        }

        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret,
                action: 'saveToken',
                ...tokenData
            }),
        });

        const result = await response.json();
        console.log('[saveToken] Result:', result);
    } catch (error) {
        console.error('[saveToken] Error:', error);
    }
}

export const authOptions: AuthOptions = {
    providers: [
        FacebookProvider({
            clientId: process.env.FB_APP_ID!,
            clientSecret: process.env.FB_APP_SECRET!,
            authorization: {
                params: {
                    // Full permissions for ads management
                    scope: "email,public_profile,ads_read,ads_management,business_management,read_insights",
                },
            },
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }) {
            // Lưu access token và user info vào JWT
            if (account) {
                token.accessToken = account.access_token;
                token.expiresAt = account.expires_at;
                token.userId = account.providerAccountId;
            }
            return token;
        },
        async session({ session, token }) {
            // Gửi access token đến client
            session.accessToken = token.accessToken as string;
            return session;
        },
        async signIn({ user, account, profile }) {
            // Lưu user và token vào Google Sheets khi đăng nhập thành công
            if (account?.provider === "facebook" && account.access_token) {
                // Lưu user info
                await saveUserToSheet({
                    fb_user_id: account.providerAccountId,
                    name: user.name || '',
                    email: user.email || '',
                    avatar: user.image || '',
                });

                // Lưu token với userId = "default" để các API route có thể dùng
                const expiresAt = account.expires_at
                    ? new Date(account.expires_at * 1000).toISOString()
                    : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // Default 60 days

                await saveTokenToSheet({
                    user_id: 'default', // Dùng 'default' để match với getValidAccessToken
                    access_token: account.access_token,
                    token_type: account.token_type || 'bearer',
                    expires_at: expiresAt,
                });

                console.log('[NextAuth] Saved user and token for:', user.name);
            }
            return true;
        },
    },
    pages: {
        signIn: "/", // Redirect về landing page khi chưa đăng nhập
        error: "/", // Redirect về landing page khi có lỗi
    },
    debug: process.env.NODE_ENV === 'development', // Enable debug in development
    logger: {
        error(code, metadata) {
            console.error('[NextAuth Error]', code, metadata);
        },
        warn(code) {
            console.warn('[NextAuth Warn]', code);
        },
        debug(code, metadata) {
            console.log('[NextAuth Debug]', code, metadata);
        },
    },
    secret: process.env.NEXTAUTH_SECRET || "quan-su-ads-secret-2026",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
