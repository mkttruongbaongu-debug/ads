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
        const scriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
        const secret = process.env.NEXT_PUBLIC_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';

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

export const authOptions: AuthOptions = {
    providers: [
        FacebookProvider({
            clientId: process.env.FB_APP_ID!,
            clientSecret: process.env.FB_APP_SECRET!,
            authorization: {
                params: {
                    scope: "ads_read,ads_management,business_management,read_insights",
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
            // Lưu user vào Google Sheets khi đăng nhập thành công
            if (account?.provider === "facebook") {
                await saveUserToSheet({
                    fb_user_id: account.providerAccountId,
                    name: user.name || '',
                    email: user.email || '',
                    avatar: user.image || '',
                });
            }
            return true;
        },
    },
    pages: {
        signIn: "/", // Redirect về landing page khi chưa đăng nhập
    },
    secret: process.env.NEXTAUTH_SECRET || "quan-su-ads-secret-2026",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
