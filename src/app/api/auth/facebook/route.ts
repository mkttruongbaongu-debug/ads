// API Route: Start Facebook OAuth flow

import { NextResponse } from 'next/server';

const FB_APP_ID = process.env.FB_APP_ID;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback`;

// Facebook OAuth permissions needed for Ads API
const SCOPES = [
    'ads_read',
    'ads_management',
    'business_management',
    'pages_read_engagement',
    'read_insights',
].join(',');

export async function GET() {
    if (!FB_APP_ID) {
        return NextResponse.json(
            { success: false, error: 'FB_APP_ID not configured' },
            { status: 500 }
        );
    }

    // Build Facebook OAuth URL
    const oauthUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    oauthUrl.searchParams.set('client_id', FB_APP_ID);
    oauthUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    oauthUrl.searchParams.set('scope', SCOPES);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('state', 'thoadai_oauth_' + Date.now()); // CSRF protection

    // Redirect to Facebook
    return NextResponse.redirect(oauthUrl.toString());
}
