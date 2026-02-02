// API Route: Proxy to Google Apps Script (bypass CORS)

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';

        if (!scriptUrl) {
            return NextResponse.json(
                { success: false, error: 'GOOGLE_APPS_SCRIPT_URL not configured' },
                { status: 500 }
            );
        }

        // Forward request to Apps Script
        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret,
                ...body,
            }),
        });

        const result = await response.json();

        return NextResponse.json(result);
    } catch (error) {
        console.error('Apps Script proxy error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';

        if (!scriptUrl) {
            return NextResponse.json(
                { success: false, error: 'GOOGLE_APPS_SCRIPT_URL not configured' },
                { status: 500 }
            );
        }

        // Build query params
        const params = new URLSearchParams();
        params.set('secret', secret);
        searchParams.forEach((value, key) => {
            params.set(key, value);
        });

        const response = await fetch(`${scriptUrl}?${params.toString()}`);
        const result = await response.json();

        return NextResponse.json(result);
    } catch (error) {
        console.error('Apps Script proxy error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
