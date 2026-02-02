// API Route: Get User Profile from Google Sheets

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
    try {
        // Get session to verify user is logged in
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // Get fb_user_id from session (we stored it in JWT)
        // For now, use 'default' as fallback
        const fbUserId = request.nextUrl.searchParams.get('fbUserId') || 'default';

        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';

        if (!scriptUrl) {
            return NextResponse.json(
                { success: false, error: 'Missing GOOGLE_APPS_SCRIPT_URL' },
                { status: 500 }
            );
        }

        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret,
                action: 'getUser',
                fb_user_id: fbUserId
            }),
        });

        const result = await response.json();

        if (result.success && result.user) {
            return NextResponse.json({
                success: true,
                user: result.user
            });
        }

        // If user not found in Sheets, return session info
        return NextResponse.json({
            success: true,
            user: {
                name: session.user?.name || 'User',
                email: session.user?.email || '',
                avatar: session.user?.image || '',
                plan: 'free',
                fb_user_id: fbUserId
            },
            source: 'session'
        });

    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch user profile' },
            { status: 500 }
        );
    }
}
