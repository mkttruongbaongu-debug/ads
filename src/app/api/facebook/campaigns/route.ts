// API Route: Get Campaigns and Insights

import { NextRequest, NextResponse } from 'next/server';
import { getDynamicFacebookClient } from '@/lib/facebook/client';
import { FBMetricsRow, DateRange, FBInsight } from '@/lib/facebook';

// Helper to extract action value by type
function getActionValue(actions: { action_type: string; value: string }[] | undefined, actionType: string): number {
    if (!actions) return 0;
    const action = actions.find(a => a.action_type === actionType);
    return action ? parseInt(action.value) : 0;
}

function getActionValueFloat(actionValues: { action_type: string; value: string }[] | undefined, actionType: string): number {
    if (!actionValues) return 0;
    const action = actionValues.find(a => a.action_type === actionType);
    return action ? parseFloat(action.value) : 0;
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const accountId = searchParams.get('accountId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const level = searchParams.get('level') as 'campaign' | 'adset' | 'ad' || 'campaign';

        if (!accountId || !startDate || !endDate) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters: accountId, startDate, endDate' },
                { status: 400 }
            );
        }

        const dateRange: DateRange = { startDate, endDate };
        const client = await getDynamicFacebookClient();

        // Fetch campaigns
        const campaigns = await client.getCampaigns(accountId);

        // Fetch insights
        const insights = await client.getInsightsSummary(accountId, dateRange, level);

        // Map insights to campaigns with extended metrics
        const emptyInsight: Partial<FBInsight> = {};
        const metricsRows: (FBMetricsRow & {
            messages?: number;
            comments?: number;
            purchases?: number;
            purchase_value?: number;
            daily_budget?: number;
        })[] = campaigns.map((campaign) => {
            const insight: Partial<FBInsight> = insights.find((i: { campaign_id?: string }) => i.campaign_id === campaign.id) || emptyInsight;

            // Parse actions for messages, comments
            const messages = getActionValue(insight.actions, 'onsite_conversion.messaging_conversation_started_7d')
                + getActionValue(insight.actions, 'onsite_conversion.messaging_first_reply');
            const comments = getActionValue(insight.actions, 'comment')
                + getActionValue(insight.actions, 'post_comment');

            // Parse purchases
            const purchases = getActionValue(insight.actions, 'purchase')
                + getActionValue(insight.actions, 'omni_purchase');

            // Parse purchase value (revenue)
            const purchaseValue = getActionValueFloat(insight.action_values, 'purchase')
                + getActionValueFloat(insight.action_values, 'omni_purchase');

            return {
                date: dateRange.startDate,
                accountId,
                accountName: '', // Will be filled by frontend
                campaignId: campaign.id,
                campaignName: campaign.name,
                status: campaign.status,
                spend: parseFloat(insight.spend || '0'),
                impressions: parseInt(insight.impressions || '0'),
                reach: parseInt(insight.reach || '0'),
                clicks: parseInt(insight.clicks || '0'),
                ctr: parseFloat(insight.ctr || '0'),
                cpc: parseFloat(insight.cpc || '0'),
                cpm: parseFloat(insight.cpm || '0'),
                frequency: parseFloat(insight.frequency || '0'),
                // Extended metrics
                messages,
                comments,
                purchases,
                purchase_value: purchaseValue,
                daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) : 0,
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                campaigns,
                metrics: metricsRows,
                dateRange,
            },
        });
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
