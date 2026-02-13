import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/facebook/token';
import { calculateROAS } from '@/lib/facebook/metrics';

const FB_API_VERSION = 'v21.0';
const FB_API_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

/**
 * FAST TREND ENDPOINT — Returns dailyTrend for charts ASAP
 * No AI, no ads fetch — just Facebook campaign insights → transform → respond
 * Typical response time: 1-2s (vs 6-18s for full AI endpoint)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: campaignId } = await params;
        const searchParams = request.nextUrl.searchParams;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!startDate || !endDate) {
            return NextResponse.json(
                { success: false, error: 'startDate and endDate are required' },
                { status: 400 }
            );
        }

        const tokenResult = await getValidAccessToken();
        if (!tokenResult.accessToken) {
            return NextResponse.json(
                { success: false, error: tokenResult.error || 'No valid Facebook access token', needsLogin: true },
                { status: 401 }
            );
        }
        const accessToken = tokenResult.accessToken;

        // Fetch campaign with daily insights — ONLY what charts need
        const campaignRes = await fetch(
            `${FB_API_BASE}/${campaignId}?` +
            `fields=id,name,insights.time_range({'since':'${startDate}','until':'${endDate}'}).time_increment(1){` +
            `date_start,spend,impressions,clicks,actions,action_values,ctr` +
            `}&access_token=${accessToken}`
        );

        const campaignData = await campaignRes.json();

        if (campaignData.error) {
            return NextResponse.json(
                { success: false, error: campaignData.error.message },
                { status: 400 }
            );
        }

        // Transform to dailyTrend format (same as AI endpoint)
        const insightsData = campaignData.insights?.data || [];

        const dailyTrend = insightsData.map((day: {
            date_start: string;
            spend: string;
            impressions: string;
            clicks: string;
            ctr: string;
            actions?: Array<{ action_type: string; value: string }>;
            action_values?: Array<{ action_type: string; value: string }>;
        }) => {
            const spend = parseFloat(day.spend || '0');
            const purchases = day.actions?.find(a =>
                a.action_type === 'purchase' || a.action_type === 'omni_purchase'
            );
            const revenue = day.action_values?.find(a =>
                a.action_type === 'purchase' || a.action_type === 'omni_purchase'
            );
            const purchaseCount = purchases ? parseInt(purchases.value) : 0;
            const revenueAmount = revenue ? parseFloat(revenue.value) : 0;

            return {
                date: day.date_start,
                spend,
                purchases: purchaseCount,
                revenue: revenueAmount,
                cpp: purchaseCount > 0 ? spend / purchaseCount : 0,
                ctr: parseFloat(day.ctr || '0'),
                roas: calculateROAS({ revenue: revenueAmount, spend }),
            };
        });

        return NextResponse.json({
            success: true,
            data: { dailyTrend },
        });

    } catch (error) {
        console.error('Trend fetch error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
