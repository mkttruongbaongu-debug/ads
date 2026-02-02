// API Route: Get historical data for trend charts via Apps Script

import { NextRequest, NextResponse } from 'next/server';

interface HistoryParams {
    params: Promise<{
        campaignId: string;
    }>;
}

export async function GET(request: NextRequest, context: HistoryParams) {
    try {
        const { campaignId } = await context.params;
        const searchParams = request.nextUrl.searchParams;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!campaignId) {
            return NextResponse.json(
                { success: false, error: 'Missing campaignId' },
                { status: 400 }
            );
        }

        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';

        if (!scriptUrl) {
            return NextResponse.json(
                { success: false, error: 'GOOGLE_APPS_SCRIPT_URL not configured' },
                { status: 500 }
            );
        }

        // Build query params for Apps Script
        const params = new URLSearchParams();
        params.set('secret', secret);
        params.set('action', 'history');
        params.set('campaignId', campaignId);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);

        const response = await fetch(`${scriptUrl}?${params.toString()}`);
        const result = await response.json();

        return NextResponse.json(result);
    } catch (error) {
        console.error('History fetch error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
