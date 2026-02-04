import NextAuth, { AuthOptions } from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";

// Hàm gọi Google Apps Script để lưu TaiKhoan (user + token combined)
async function saveTaiKhoanToSheet(data: {
    fb_user_id: string;
    name: string;
    email?: string;
    avatar?: string;
    access_token: string;
    token_type?: string;
    token_expires_at?: string;
}) {
    try {
        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';

        if (!scriptUrl) {
            console.error('[saveTaiKhoan] Missing APPS_SCRIPT_URL');
            return;
        }

        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret,
                action: 'saveTaiKhoan',
                ...data
            }),
        });

        const result = await response.json();
        console.log('[saveTaiKhoan] Result:', result);
        return result;
    } catch (error) {
        console.error('[saveTaiKhoan] Error:', error);
    }
}


export const authOptions: AuthOptions = {
    providers: [
        FacebookProvider({
            clientId: process.env.FB_APP_ID!,
            clientSecret: process.env.FB_APP_SECRET!,
            authorization: {
                params: {
                    // Full permissions for ads + pages + commerce management
                    scope: [
                        // Core
                        "email",
                        "public_profile",
                        // Ads
                        "ads_read",
                        "ads_management",
                        "business_management",
                        "read_insights",
                        // Pages
                        "pages_manage_ads",
                        "pages_read_engagement",
                        "pages_manage_posts",
                        "pages_manage_engagement",
                        "pages_read_user_content",
                        // Commerce
                        "commerce_account_manage_orders",
                    ].join(","),
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
            // Lưu TaiKhoan (user + token combined) vào Google Sheets
            if (account?.provider === "facebook" && account.access_token) {
                const tokenExpiresAt = account.expires_at
                    ? new Date(account.expires_at * 1000).toISOString()
                    : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // Default 60 days

                // Gộp user info + token vào 1 call duy nhất
                await saveTaiKhoanToSheet({
                    fb_user_id: account.providerAccountId,
                    name: user.name || '',
                    email: user.email || '',
                    avatar: user.image || '',
                    access_token: account.access_token,
                    token_type: account.token_type || 'bearer',
                    token_expires_at: tokenExpiresAt,
                });

                console.log('[NextAuth] Saved TaiKhoan for:', user.name);
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
