import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/facebook/token';
import { analyzeCampaigns, CampaignData, DailyMetric } from '@/lib/analysis/pattern-engine';

const FB_API_VERSION = 'v21.0';
const FB_API_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

// Google Apps Script for saving to Sheet
const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const APPS_SCRIPT_SECRET = process.env.GOOGLE_APPS_SCRIPT_SECRET;

export async function GET(request: NextRequest) {
    console.log('[ANALYSIS/DAILY] 🔍 Starting...');
    try {
        const searchParams = request.nextUrl.searchParams;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const accountId = searchParams.get('accountId');
        console.log('[ANALYSIS/DAILY] 📅 Params:', { startDate, endDate, accountId });

        if (!startDate || !endDate) {
            console.warn('[ANALYSIS/DAILY] ⚠️ Missing dates');
            return NextResponse.json(
                { success: false, error: 'startDate and endDate are required' },
                { status: 400 }
            );
        }

        console.log('[ANALYSIS/DAILY] 🔑 Getting access token...');
        const tokenResult = await getValidAccessToken();
        if (!tokenResult.accessToken) {
            console.error('[ANALYSIS/DAILY] ❌ No valid token');
            return NextResponse.json(
                { success: false, error: tokenResult.error || 'No valid Facebook access token', needsLogin: true },
                { status: 401 }
            );
        }
        const accessToken = tokenResult.accessToken;
        console.log('[ANALYSIS/DAILY] ✅ Token OK');

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

        console.log('[ANALYSIS/DAILY] 📡 Fetching campaigns from Facebook...');
        const campaignsRes = await fetch(
            `${FB_API_BASE}/${adAccountId}/campaigns?` +
            `fields=id,name,status,created_time,daily_budget,` +
            `insights.time_range({'since':'${startDate}','until':'${endDate}'}).time_increment(1){` +
            `date_start,spend,impressions,clicks,actions,action_values,ctr,cpc,cpm,frequency` +
            `}&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]` +
            `&limit=500&access_token=${accessToken}`
        );

        const campaignsData = await campaignsRes.json();
        console.log('[ANALYSIS/DAILY] 📦 Got', campaignsData.data?.length || 0, 'campaigns from Facebook');

        if (campaignsData.error) {
            console.error('[ANALYSIS/DAILY] ❌ Facebook error:', campaignsData.error.message);
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
            created_time?: string;
            daily_budget?: string;
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
                const spend = parseFloat(day.spend || '0'); // Already in account currency (VND)
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
                const revenueAmount = revenue ? parseFloat(revenue.value) : 0;

                return {
                    date: day.date_start,
                    spend,
                    impressions,
                    clicks,
                    purchases: purchaseCount,
                    revenue: revenueAmount,
                    ctr: parseFloat(day.ctr || '0'),
                    cpc: parseFloat(day.cpc || '0'),
                    cpp: purchaseCount > 0 ? spend / purchaseCount : 0,
                    roas: spend > 0 ? revenueAmount / spend : 0,
                    frequency: day.frequency ? parseFloat(day.frequency) : undefined,
                    cpm: parseFloat(day.cpm || '0'),
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

            // Daily budget: thật từ Facebook hoặc ước lượng
            const fbDailyBudget = campaign.daily_budget ? parseInt(campaign.daily_budget) : 0;
            const numberOfDays = dailyMetrics.length || 1;
            const estimatedDailyBudget = Math.round(totals.spend / numberOfDays);

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
                created_time: campaign.created_time,
                daily_budget: fbDailyBudget > 0 ? fbDailyBudget : undefined,
                daily_budget_estimated: fbDailyBudget > 0 ? fbDailyBudget : estimatedDailyBudget,
            };
        });

        // Filter only ACTIVE campaigns with spend > 0 for analysis
        const activeCampaigns = campaigns.filter(c =>
            c.status === 'ACTIVE' && c.totals.spend > 0
        );
        console.log('[ANALYSIS/DAILY] 🎯 Active campaigns with spend:', activeCampaigns.length);

        // Analyze campaigns
        console.log('[ANALYSIS/DAILY] 🧠 Running pattern analysis...');
        const analysisResult = analyzeCampaigns(activeCampaigns);
        console.log('[ANALYSIS/DAILY] ✅ Analysis complete:', {
            critical: analysisResult.critical.length,
            warning: analysisResult.warning.length,
            good: analysisResult.good.length,
        });

        // ========== SAVE TO GOOGLE SHEET (TEMPORARILY DISABLED - CAUSING TIMEOUT) ==========
        // TODO: Move this to a background job or separate API call
        console.log('[ANALYSIS/DAILY] ⏭️ Skipping save to sheet (optimization pending)');

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
        console.error('[ANALYSIS/DAILY] ❌ Fatal error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
