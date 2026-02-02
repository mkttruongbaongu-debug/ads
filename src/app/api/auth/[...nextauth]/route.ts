import NextAuth, { AuthOptions } from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";

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
        async jwt({ token, account }) {
            // Lưu access token vào JWT
            if (account) {
                token.accessToken = account.access_token;
                token.expiresAt = account.expires_at;
            }
            return token;
        },
        async session({ session, token }) {
            // Gửi access token đến client
            session.accessToken = token.accessToken as string;
            return session;
        },
    },
    pages: {
        signIn: "/", // Redirect về landing page khi chưa đăng nhập
    },
    secret: process.env.NEXTAUTH_SECRET || "quan-su-ads-secret-2026",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
