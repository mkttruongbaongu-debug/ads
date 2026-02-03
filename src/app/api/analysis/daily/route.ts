import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/facebook/token';
import { analyzeCampaigns, CampaignData, DailyMetric } from '@/lib/analysis/pattern-engine';

const FB_API_VERSION = 'v21.0';
const FB_API_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const accountId = searchParams.get('accountId');

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

        // Get ad accounts if not specified
        let adAccountId = accountId;
        if (!adAccountId) {
            const accountsRes = await fetch(
                `${FB_API_BASE}/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
            );
            const accountsData = await accountsRes.json();

            if (accountsData.error) {
                return NextResponse.json(
                    { success: false, error: accountsData.error.message },
                    { status: 400 }
                );
            }

            // Use first active account
            const activeAccount = accountsData.data?.find((a: { account_status: number }) => a.account_status === 1);
            if (!activeAccount) {
                return NextResponse.json(
                    { success: false, error: 'No active ad account found' },
                    { status: 404 }
                );
            }
            adAccountId = activeAccount.id;
        }

        // Fetch all campaigns with daily insights
        const campaignsRes = await fetch(
            `${FB_API_BASE}/${adAccountId}/campaigns?` +
            `fields=id,name,status,insights.time_range({'since':'${startDate}','until':'${endDate}'}).time_increment(1){` +
            `date_start,spend,impressions,clicks,actions,action_values,ctr,cpc,cpm,frequency` +
            `}&limit=500&access_token=${accessToken}`
        );

        const campaignsData = await campaignsRes.json();

        if (campaignsData.error) {
            return NextResponse.json(
                { success: false, error: campaignsData.error.message },
                { status: 400 }
            );
        }

        // Transform data
        const campaigns: CampaignData[] = (campaignsData.data || []).map((campaign: {
            id: string;
            name: string;
            status: string;
            insights?: {
                data?: Array<{
                    date_start: string;
                    spend: string;
                    impressions: string;
                    clicks: string;
                    ctr: string;
                    cpc: string;
                    cpm: string;
                    frequency?: string;
                    actions?: Array<{ action_type: string; value: string }>;
                    action_values?: Array<{ action_type: string; value: string }>;
                }>
            };
        }) => {
            const insightsData = campaign.insights?.data || [];

            const dailyMetrics: DailyMetric[] = insightsData.map(day => {
                const spend = parseFloat(day.spend || '0') * 27000; // USD to VND
                const impressions = parseInt(day.impressions || '0');
                const clicks = parseInt(day.clicks || '0');

                // Extract purchases and revenue from actions
                const purchases = day.actions?.find(a =>
                    a.action_type === 'purchase' || a.action_type === 'omni_purchase'
                );
                const revenue = day.action_values?.find(a =>
                    a.action_type === 'purchase' || a.action_type === 'omni_purchase'
                );

                const purchaseCount = purchases ? parseInt(purchases.value) : 0;
                const revenueAmount = revenue ? parseFloat(revenue.value) * 27000 : 0;

                return {
                    date: day.date_start,
                    spend,
                    impressions,
                    clicks,
                    purchases: purchaseCount,
                    revenue: revenueAmount,
                    ctr: parseFloat(day.ctr || '0'),
                    cpc: parseFloat(day.cpc || '0') * 27000,
                    cpp: purchaseCount > 0 ? spend / purchaseCount : 0,
                    roas: spend > 0 ? revenueAmount / spend : 0,
                    frequency: day.frequency ? parseFloat(day.frequency) : undefined,
                    cpm: parseFloat(day.cpm || '0') * 27000,
                };
            });

            // Calculate totals
            const totals = dailyMetrics.reduce((acc, day) => ({
                spend: acc.spend + day.spend,
                purchases: acc.purchases + day.purchases,
                revenue: acc.revenue + day.revenue,
                clicks: acc.clicks + day.clicks,
                impressions: acc.impressions + day.impressions,
            }), { spend: 0, purchases: 0, revenue: 0, clicks: 0, impressions: 0 });

            return {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                dailyMetrics,
                totals: {
                    spend: totals.spend,
                    purchases: totals.purchases,
                    revenue: totals.revenue,
                    cpp: totals.purchases > 0 ? totals.spend / totals.purchases : 0,
                    roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
                    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
                },
            };
        });

        // Filter only ACTIVE campaigns with spend > 0 for analysis
        const activeCampaigns = campaigns.filter(c =>
            c.status === 'ACTIVE' && c.totals.spend > 0
        );

        // Analyze campaigns
        const analysisResult = analyzeCampaigns(activeCampaigns);

        return NextResponse.json({
            success: true,
            data: analysisResult,
            metadata: {
                accountId: adAccountId,
                dateRange: { startDate, endDate },
                totalCampaigns: campaigns.length,
                analyzedCampaigns: activeCampaigns.length,
            },
        });

    } catch (error) {
        console.error('Daily analysis error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
