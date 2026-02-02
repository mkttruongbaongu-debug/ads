// API Route: Check auth status - Token còn hạn không?

import { NextResponse } from 'next/server';

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const APPS_SCRIPT_SECRET = process.env.GOOGLE_APPS_SCRIPT_SECRET;

export async function GET() {
    try {
        // Get token from Sheets
        const url = new URL(APPS_SCRIPT_URL!);
        url.searchParams.set('secret', APPS_SCRIPT_SECRET!);
        url.searchParams.set('action', 'getToken');
        url.searchParams.set('userId', 'default');

        const response = await fetch(url.toString());
        const result = await response.json();

        if (!result.success) {
            return NextResponse.json({
                success: true,
                authenticated: false,
                needsLogin: true,
                reason: result.error || 'Failed to get token',
            });
        }

        if (!result.hasToken) {
            return NextResponse.json({
                success: true,
                authenticated: false,
                needsLogin: true,
                reason: 'No token found',
            });
        }

        if (result.isExpired) {
            return NextResponse.json({
                success: true,
                authenticated: false,
                needsLogin: true,
                reason: 'Token expired',
                expiredAt: result.token?.expires_at,
            });
        }

        // Token is valid
        return NextResponse.json({
            success: true,
            authenticated: true,
            needsLogin: false,
            expiresAt: result.token?.expires_at,
            createdAt: result.token?.created_at,
        });

    } catch (error) {
        console.error('Auth status check error:', error);
        return NextResponse.json({
            success: false,
            authenticated: false,
            needsLogin: true,
            reason: String(error),
        });
    }
}
