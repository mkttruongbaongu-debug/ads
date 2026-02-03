// API Route: Get adsets for a specific campaign

import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/facebook/token';

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const { id: campaignId } = await context.params;
        const searchParams = request.nextUrl.searchParams;
        const startDate = searchParams.get('startDate') || '';
        const endDate = searchParams.get('endDate') || '';

        // Lấy token từ database (Google Sheets) hoặc fallback env
        const tokenResult = await getValidAccessToken();
        if (!tokenResult.accessToken) {
            return NextResponse.json({
                success: false,
                error: tokenResult.error || 'No valid access token',
                needsReauth: true
            }, { status: 401 });
        }
        const accessToken = tokenResult.accessToken;

        // First get the adsets for this campaign
        const adsetsUrl = `https://graph.facebook.com/v21.0/${campaignId}/adsets?fields=id,name,status&access_token=${accessToken}`;
        const adsetsRes = await fetch(adsetsUrl);
        const adsetsJson = await adsetsRes.json();

        if (adsetsJson.error) {
            console.error('Facebook API error:', adsetsJson.error);
            return NextResponse.json({ success: false, error: adsetsJson.error.message }, { status: 400 });
        }

        const adsets = adsetsJson.data || [];

        // Get insights for each adset
        const adsetsWithInsights = await Promise.all(
            adsets.map(async (adset: { id: string; name: string; status: string }) => {
                try {
                    const insightsUrl = `https://graph.facebook.com/v21.0/${adset.id}/insights?fields=spend,impressions,clicks,actions&time_range={"since":"${startDate}","until":"${endDate}"}&access_token=${accessToken}`;
                    const insightsRes = await fetch(insightsUrl);
                    const insightsJson = await insightsRes.json();

                    const insights = insightsJson.data?.[0] || {};
                    const actions = insights.actions || [];

                    const messages = parseInt(actions.find((a: { action_type: string; value: string }) =>
                        a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value || '0');
                    const comments = parseInt(actions.find((a: { action_type: string; value: string }) =>
                        a.action_type === 'comment')?.value || '0');
                    const leads = messages + comments;

                    const spend = parseFloat(insights.spend || '0');
                    const cpl = leads > 0 ? spend / leads : 0;
                    const clicks = parseInt(insights.clicks || '0');
                    const cvr = clicks > 0 ? (leads / clicks) * 100 : 0;

                    return {
                        id: adset.id,
                        name: adset.name,
                        status: adset.status,
                        spend: spend,
                        impressions: parseInt(insights.impressions || '0'),
                        clicks: clicks,
                        leads: leads,
                        cpl: Math.round(cpl),
                        cvr: parseFloat(cvr.toFixed(2))
                    };
                } catch (err) {
                    console.error(`Error fetching insights for adset ${adset.id}:`, err);
                    return {
                        id: adset.id,
                        name: adset.name,
                        status: adset.status,
                        spend: 0,
                        impressions: 0,
                        clicks: 0,
                        leads: 0,
                        cpl: 0,
                        cvr: 0
                    };
                }
            })
        );

        // Sort by spend descending
        adsetsWithInsights.sort((a, b) => b.spend - a.spend);

        return NextResponse.json({ success: true, data: adsetsWithInsights });
    } catch (error) {
        console.error('Campaign adsets error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
