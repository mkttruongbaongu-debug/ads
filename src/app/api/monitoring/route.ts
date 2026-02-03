// Scheduled Monitoring Job - API endpoint cho cron trigger
// Chạy định kỳ để phát hiện vấn đề và gửi alert

import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/facebook/token';
import { sendTelegramAlert, sendDailySummary, sendTelegramMessage } from '@/lib/telegram/bot';
import { analyzeAllCampaigns, CampaignMetrics } from '@/lib/monitoring/trend-detection';

// Secret để bảo vệ endpoint (chỉ cron job mới gọi được)
const CRON_SECRET = process.env.CRON_SECRET || 'quan-su-ads-cron-2026';

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mode = request.nextUrl.searchParams.get('mode') || 'check';

    try {
        // 1. Get access token
        const tokenResult = await getValidAccessToken();
        if (!tokenResult.accessToken) {
            await sendTelegramMessage('⚠️ *QUÂN SƯ ADS*: Facebook token hết hạn, cần đăng nhập lại!');
            return NextResponse.json({
                success: false,
                error: 'Token expired',
                message: 'Sent token expiry alert to Telegram'
            });
        }

        // 2. Fetch current campaign data
        const campaigns = await fetchCampaignData(tokenResult.accessToken);

        // 3. Fetch historical data (7 days)
        const historicalData = await fetchHistoricalData(tokenResult.accessToken, campaigns);

        // 4. Analyze trends
        const analyses = analyzeAllCampaigns(campaigns, historicalData);

        // 5. Send alerts
        let alertsSent = 0;
        for (const analysis of analyses) {
            for (const alert of analysis.alerts) {
                const sent = await sendTelegramAlert(alert);
                if (sent) alertsSent++;

                // Delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // 6. Send daily summary if mode is 'daily'
        if (mode === 'daily') {
            const summary = calculateDailySummary(campaigns, analyses);
            await sendDailySummary(summary);
        }

        return NextResponse.json({
            success: true,
            campaignsAnalyzed: campaigns.length,
            alertsGenerated: analyses.reduce((sum, a) => sum + a.alerts.length, 0),
            alertsSent,
            criticalCampaigns: analyses.filter(a => a.trend === 'critical').length,
            decliningCampaigns: analyses.filter(a => a.trend === 'declining').length
        });

    } catch (error) {
        console.error('Monitoring job error:', error);
        await sendTelegramMessage(`❌ *QUÂN SƯ ADS Error*: ${error instanceof Error ? error.message : 'Unknown error'}`);

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

/**
 * Fetch current campaign data from Facebook
 */
async function fetchCampaignData(accessToken: string): Promise<CampaignMetrics[]> {
    const today = new Date().toISOString().split('T')[0];

    // Get ad account ID from env or default
    const adAccountId = process.env.FB_AD_ACCOUNT_ID || '';

    const url = `https://graph.facebook.com/v21.0/${adAccountId}/insights?` +
        `fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values&` +
        `level=campaign&` +
        `time_range={"since":"${today}","until":"${today}"}&` +
        `access_token=${accessToken}`;

    const response = await fetch(url);
    const json = await response.json();

    if (json.error) {
        throw new Error(json.error.message);
    }

    return (json.data || []).map((row: {
        campaign_id?: string;
        campaign_name?: string;
        spend?: string;
        impressions?: string;
        clicks?: string;
        ctr?: string;
        cpc?: string;
        cpm?: string;
        actions?: Array<{ action_type: string; value: string }>;
        action_values?: Array<{ action_type: string; value: string }>;
    }) => {
        const actions = row.actions || [];
        const actionValues = row.action_values || [];

        const purchases = parseInt(actions.find(a => a.action_type === 'purchase')?.value || '0');
        const leads = parseInt(actions.find(a =>
            a.action_type === 'lead' ||
            a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
        )?.value || '0');
        const revenue = parseFloat(actionValues.find(a => a.action_type === 'purchase')?.value || '0');
        const spend = parseFloat(row.spend || '0');

        return {
            campaignId: row.campaign_id || '',
            campaignName: row.campaign_name || '',
            date: today,
            spend,
            revenue,
            leads,
            purchases,
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            ctr: parseFloat(row.ctr || '0'),
            cpc: parseFloat(row.cpc || '0'),
            cpm: parseFloat(row.cpm || '0'),
            cpp: purchases > 0 ? spend / purchases : 0,
            roas: spend > 0 ? revenue / spend : 0
        };
    });
}

/**
 * Fetch 7-day historical data
 */
async function fetchHistoricalData(
    accessToken: string,
    currentCampaigns: CampaignMetrics[]
): Promise<Map<string, CampaignMetrics[]>> {
    const result = new Map<string, CampaignMetrics[]>();

    // Get dates for last 7 days
    const dates: string[] = [];
    for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
    }

    const adAccountId = process.env.FB_AD_ACCOUNT_ID || '';
    const startDate = dates[dates.length - 1];
    const endDate = dates[0];

    const url = `https://graph.facebook.com/v21.0/${adAccountId}/insights?` +
        `fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values&` +
        `level=campaign&` +
        `time_increment=1&` +
        `time_range={"since":"${startDate}","until":"${endDate}"}&` +
        `access_token=${accessToken}`;

    const response = await fetch(url);
    const json = await response.json();

    if (json.error) {
        console.error('Historical data error:', json.error);
        return result;
    }

    // Group by campaign
    for (const row of (json.data || [])) {
        const campaignId = row.campaign_id;
        if (!result.has(campaignId)) {
            result.set(campaignId, []);
        }

        const actions = row.actions || [];
        const actionValues = row.action_values || [];

        const purchases = parseInt(actions.find((a: { action_type: string; value: string }) => a.action_type === 'purchase')?.value || '0');
        const leads = parseInt(actions.find((a: { action_type: string; value: string }) =>
            a.action_type === 'lead' ||
            a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
        )?.value || '0');
        const revenue = parseFloat(actionValues.find((a: { action_type: string; value: string }) => a.action_type === 'purchase')?.value || '0');
        const spend = parseFloat(row.spend || '0');

        result.get(campaignId)!.push({
            campaignId,
            campaignName: row.campaign_name || '',
            date: row.date_start,
            spend,
            revenue,
            leads,
            purchases,
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            ctr: parseFloat(row.ctr || '0'),
            cpc: parseFloat(row.cpc || '0'),
            cpm: parseFloat(row.cpm || '0'),
            cpp: purchases > 0 ? spend / purchases : 0,
            roas: spend > 0 ? revenue / spend : 0
        });
    }

    return result;
}

/**
 * Calculate daily summary
 */
function calculateDailySummary(
    campaigns: CampaignMetrics[],
    analyses: ReturnType<typeof analyzeAllCampaigns>
) {
    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);
    const totalLeads = campaigns.reduce((sum, c) => sum + c.leads, 0);

    // Find top and worst campaigns
    const sorted = [...campaigns].sort((a, b) => b.roas - a.roas);
    const topCampaign = sorted[0]?.campaignName || 'N/A';
    const worstCampaign = analyses[0]?.campaignName || sorted[sorted.length - 1]?.campaignName || 'N/A';

    const alerts = analyses.reduce((sum, a) => sum + a.alerts.length, 0);

    return {
        totalSpend,
        totalRevenue,
        totalLeads,
        topCampaign,
        worstCampaign,
        alerts
    };
}
