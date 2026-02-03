// API Route: Log AI usage to Google Sheets and get user's usage summary
// CHI TIẾT ĐỦ ĐỂ TÍNH TIỀN USER

import { NextRequest, NextResponse } from 'next/server';

interface BillingData {
    // Request info
    requestId: string;
    timestamp: string;
    userId: string;
    actionType: string;
    model: string;

    // Token breakdown
    inputTokens: number;
    inputUncached: number;
    cachedTokens: number;
    outputTokens: number;
    totalTokens: number;

    // Cost USD breakdown
    costInputUsd: number;
    costCachedUsd: number;
    costOutputUsd: number;
    costTotalUsd: number;

    // Cost VND breakdown (để tính tiền)
    costInputVnd: number;
    costCachedVnd: number;
    costOutputVnd: number;
    costTotalVnd: number;
}

// POST: Log new usage with full billing details
export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as BillingData;

        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';

        if (!scriptUrl) {
            return NextResponse.json({ success: false, error: 'Script URL not configured' }, { status: 500 });
        }

        // Send full billing data to Apps Script
        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret,
                action: 'logAiUsage',
                data: {
                    // Request info
                    requestId: body.requestId,
                    timestamp: body.timestamp || new Date().toISOString(),
                    userId: body.userId || 'anonymous',
                    actionType: body.actionType || 'analyze_campaign',
                    model: body.model || 'gpt-5-mini',

                    // Token breakdown
                    inputTokens: body.inputTokens || 0,
                    inputUncached: body.inputUncached || 0,
                    cachedTokens: body.cachedTokens || 0,
                    outputTokens: body.outputTokens || 0,
                    totalTokens: body.totalTokens || 0,

                    // Cost USD breakdown
                    costInputUsd: body.costInputUsd || 0,
                    costCachedUsd: body.costCachedUsd || 0,
                    costOutputUsd: body.costOutputUsd || 0,
                    costTotalUsd: body.costTotalUsd || 0,

                    // Cost VND breakdown
                    costInputVnd: body.costInputVnd || 0,
                    costCachedVnd: body.costCachedVnd || 0,
                    costOutputVnd: body.costOutputVnd || 0,
                    costTotalVnd: body.costTotalVnd || 0,
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

// GET: Get user's usage summary for billing
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
