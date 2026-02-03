import { NextResponse } from "next/server";

export async function GET() {
    const debug = {
        timestamp: new Date().toISOString(),
        env_check: {
            FB_APP_ID: process.env.FB_APP_ID ? `✅ Set (ends with ...${process.env.FB_APP_ID.slice(-4)})` : "❌ MISSING",
            FB_APP_SECRET: process.env.FB_APP_SECRET ? `✅ Set (length: ${process.env.FB_APP_SECRET.length})` : "❌ MISSING",
            NEXTAUTH_URL: process.env.NEXTAUTH_URL || "❌ MISSING",
            NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "✅ Set" : "❌ MISSING",
            NODE_ENV: process.env.NODE_ENV,
        },
        expected: {
            FB_APP_ID_should_end_with: "3534",
            FB_APP_SECRET_length_should_be: 32,
            NEXTAUTH_URL_should_be: "https://ads.supbaongu.vn",
        }
    };

    return NextResponse.json(debug);
}
