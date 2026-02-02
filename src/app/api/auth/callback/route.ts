// API Route: Facebook OAuth Callback - Đổi code lấy access_token và lưu vào Sheets

import { NextRequest, NextResponse } from 'next/server';

const FB_APP_ID = process.env.FB_APP_ID;
const FB_APP_SECRET = process.env.FB_APP_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback`;
const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const APPS_SCRIPT_SECRET = process.env.GOOGLE_APPS_SCRIPT_SECRET;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorReason = searchParams.get('error_reason');

    // Handle errors from Facebook
    if (error) {
        console.error('Facebook OAuth error:', error, errorReason);
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=${encodeURIComponent(errorReason || error)}`
        );
    }

    if (!code) {
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=no_code`
        );
    }

    try {
        // Step 1: Exchange code for short-lived access token
        const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
        tokenUrl.searchParams.set('client_id', FB_APP_ID!);
        tokenUrl.searchParams.set('client_secret', FB_APP_SECRET!);
        tokenUrl.searchParams.set('redirect_uri', REDIRECT_URI);
        tokenUrl.searchParams.set('code', code);

        const tokenRes = await fetch(tokenUrl.toString());
        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            console.error('Token exchange error:', tokenData.error);
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=${encodeURIComponent(tokenData.error.message)}`
            );
        }

        const shortLivedToken = tokenData.access_token;

        // Step 2: Exchange short-lived token for long-lived token (60 days)
        const longLivedUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
        longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
        longLivedUrl.searchParams.set('client_id', FB_APP_ID!);
        longLivedUrl.searchParams.set('client_secret', FB_APP_SECRET!);
        longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken);

        const longLivedRes = await fetch(longLivedUrl.toString());
        const longLivedData = await longLivedRes.json();

        if (longLivedData.error) {
            console.error('Long-lived token exchange error:', longLivedData.error);
            // Fallback to short-lived token
            await saveTokenToSheets(shortLivedToken, tokenData.expires_in);
        } else {
            // Save long-lived token
            await saveTokenToSheets(longLivedData.access_token, longLivedData.expires_in);
        }

        // Redirect back to dashboard with success
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?auth=success`
        );

    } catch (error) {
        console.error('OAuth callback error:', error);
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=${encodeURIComponent(String(error))}`
        );
    }
}

// Helper: Save token to Google Sheets via Apps Script
async function saveTokenToSheets(accessToken: string, expiresIn: number) {
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const response = await fetch(APPS_SCRIPT_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            secret: APPS_SCRIPT_SECRET,
            action: 'saveToken',
            userId: 'default', // Single user mode
            accessToken,
            tokenType: 'bearer',
            expiresAt,
        }),
    });

    const result = await response.json();
    console.log('Token saved to Sheets:', result);
    return result;
}
