// API Route: Log AI usage to Google Sheets and get user's usage summary

import { NextRequest, NextResponse } from 'next/server';

interface UsageData {
    userId: string;
    action: string;
    inputTokens: number;
    cachedTokens: number;
    outputTokens: number;
    costUsd: number;
    costVnd: number;
}

// POST: Log new usage
export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as UsageData;

        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';

        if (!scriptUrl) {
            return NextResponse.json({ success: false, error: 'Script URL not configured' }, { status: 500 });
        }

        // Send to Apps Script
        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret,
                action: 'logAiUsage',
                data: {
                    timestamp: new Date().toISOString(),
                    userId: body.userId,
                    actionType: body.action,
                    inputTokens: body.inputTokens,
                    cachedTokens: body.cachedTokens,
                    outputTokens: body.outputTokens,
                    costUsd: body.costUsd,
                    costVnd: body.costVnd
                }
            })
        });

        const result = await response.json();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Usage log error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// GET: Get user's usage summary
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
        }

        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';

        if (!scriptUrl) {
            return NextResponse.json({ success: false, error: 'Script URL not configured' }, { status: 500 });
        }

        // Get from Apps Script
        const params = new URLSearchParams();
        params.set('secret', secret);
        params.set('action', 'getAiUsage');
        params.set('userId', userId);

        const response = await fetch(`${scriptUrl}?${params.toString()}`);
        const result = await response.json();

        return NextResponse.json(result);
    } catch (error) {
        console.error('Usage fetch error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
