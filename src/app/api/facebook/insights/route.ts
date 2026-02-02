// API Route: Get COMPREHENSIVE daily insights for sync to Sheets
// Performance Ads Expert Edition - All metrics included

import { NextRequest, NextResponse } from 'next/server';
import { getFacebookClient } from '@/lib/facebook';
import { IMPORTANT_ACTION_TYPES, calculateDerivedMetrics } from '@/lib/facebook/metrics';

// Helper to find action value by types
function findAction(
    actions: { action_type: string; value: string }[] | undefined,
    types: string[]
): number {
    if (!actions) return 0;
    const found = actions.find(a => types.includes(a.action_type));
    return found ? parseFloat(found.value) || 0 : 0;
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const accountId = searchParams.get('accountId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!accountId || !startDate || !endDate) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters: accountId, startDate, endDate' },
                { status: 400 }
            );
        }

        const fbClient = getFacebookClient();

        // Get daily breakdown insights with time_increment=1
        const insights = await fbClient.getInsights(
            accountId,
            { startDate, endDate },
            'campaign'
        );

        // Get campaigns for name mapping
        const campaigns = await fbClient.getCampaigns(accountId);
        const campaignMap = new Map(campaigns.map(c => [c.id, c]));

        // Process each insight with FULL metrics extraction
        const dailyData = insights.map(insight => {
            const campaign = campaignMap.get(insight.campaign_id || '');

            // ========================================
            // RAW METRICS FROM API
            // ========================================
            const spend = parseFloat(insight.spend || '0');
            const impressions = parseInt(insight.impressions || '0');
            const reach = parseInt(insight.reach || '0');
            const frequency = parseFloat(insight.frequency || '0');
            const clicks = parseInt(insight.clicks || '0');
            const ctr = parseFloat(insight.ctr || '0');
            const cpc = parseFloat(insight.cpc || '0');
            const cpm = parseFloat(insight.cpm || '0');

            // Unique clicks (may not always be present)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const insightAny = insight as any;
            const uniqueClicks = parseInt(insightAny.unique_clicks || '0');
            const linkClicks = parseInt(insightAny.inline_link_clicks || '0');
            const uniqueLinkClicks = parseInt(insightAny.unique_inline_link_clicks || '0');
            const linkCtr = parseFloat(insightAny.inline_link_click_ctr || '0');

            // Cost metrics
            const costPerUniqueClick = parseFloat(insightAny.cost_per_unique_click || '0');
            const costPerLinkClick = parseFloat(insightAny.cost_per_inline_link_click || '0');

            // ========================================
            // ACTIONS - Parse all important action types
            // ========================================
            const actions = insight.actions;
            const actionValues = insight.action_values;
            const costPerAction = insight.cost_per_action_type;

            // E-commerce Funnel
            const purchases = findAction(actions, IMPORTANT_ACTION_TYPES.purchase);
            const purchaseValue = findAction(actionValues, IMPORTANT_ACTION_TYPES.purchase);
            const costPerPurchase = findAction(costPerAction, IMPORTANT_ACTION_TYPES.purchase);

            const addToCart = findAction(actions, IMPORTANT_ACTION_TYPES.add_to_cart);
            const addToCartValue = findAction(actionValues, IMPORTANT_ACTION_TYPES.add_to_cart);
            const costPerAddToCart = findAction(costPerAction, IMPORTANT_ACTION_TYPES.add_to_cart);

            const initiateCheckout = findAction(actions, IMPORTANT_ACTION_TYPES.initiate_checkout);
            const costPerCheckout = findAction(costPerAction, IMPORTANT_ACTION_TYPES.initiate_checkout);

            const viewContent = findAction(actions, IMPORTANT_ACTION_TYPES.view_content);
            const costPerViewContent = findAction(costPerAction, IMPORTANT_ACTION_TYPES.view_content);

            // Traffic
            const landingPageViews = findAction(actions, IMPORTANT_ACTION_TYPES.landing_page_view);
            const costPerLandingPageView = findAction(costPerAction, IMPORTANT_ACTION_TYPES.landing_page_view);

            // Engagement
            const postEngagement = findAction(actions, IMPORTANT_ACTION_TYPES.post_engagement);
            const costPerEngagement = findAction(costPerAction, IMPORTANT_ACTION_TYPES.post_engagement);
            const reactions = findAction(actions, IMPORTANT_ACTION_TYPES.post_reaction);
            const comments = findAction(actions, IMPORTANT_ACTION_TYPES.comment);
            const saves = findAction(actions, IMPORTANT_ACTION_TYPES.post_save);

            // Messaging
            const messages = findAction(actions, IMPORTANT_ACTION_TYPES.onsite_message) +
                findAction(actions, IMPORTANT_ACTION_TYPES.offsite_message);
            const costPerMessage = messages > 0 ? spend / messages : 0;

            // Lead Gen
            const leads = findAction(actions, IMPORTANT_ACTION_TYPES.lead);
            const costPerLead = findAction(costPerAction, IMPORTANT_ACTION_TYPES.lead);
            const registrations = findAction(actions, IMPORTANT_ACTION_TYPES.complete_registration);
            const costPerRegistration = findAction(costPerAction, IMPORTANT_ACTION_TYPES.complete_registration);

            // Video Metrics
            const videoPlays = findAction(actions, IMPORTANT_ACTION_TYPES.video_view);
            const videoThruplay = insight.video_thruplay_watched_actions?.[0]?.value
                ? parseInt(insight.video_thruplay_watched_actions[0].value) : 0;
            const videoP25 = insight.video_p25_watched_actions?.[0]?.value
                ? parseInt(insight.video_p25_watched_actions[0].value) : 0;
            const videoP50 = insight.video_p50_watched_actions?.[0]?.value
                ? parseInt(insight.video_p50_watched_actions[0].value) : 0;
            const videoP75 = insight.video_p75_watched_actions?.[0]?.value
                ? parseInt(insight.video_p75_watched_actions[0].value) : 0;
            const videoP100 = insight.video_p100_watched_actions?.[0]?.value
                ? parseInt(insight.video_p100_watched_actions[0].value) : 0;

            // ROAS
            const roas = insight.purchase_roas?.[0]?.value
                ? parseFloat(insight.purchase_roas[0].value) : 0;

            // ========================================
            // DERIVED METRICS - Calculated
            // ========================================
            const derived = calculateDerivedMetrics({
                spend,
                impressions,
                clicks,
                link_clicks: linkClicks,
                landing_page_views: landingPageViews,
                purchases,
                revenue: purchaseValue,
                add_to_cart: addToCart,
                initiate_checkout: initiateCheckout,
                view_content: viewContent,
                post_engagement: postEngagement,
                video_plays: videoPlays,
                video_p25: videoP25,
                video_p100: videoP100,
                ctr,
                link_ctr: linkCtr,
            });

            return {
                // Identification
                date: insight.date_start,
                campaign_id: insight.campaign_id,
                campaign_name: insight.campaign_name || campaign?.name || 'Unknown',
                status: campaign?.status || 'UNKNOWN',
                objective: campaign?.objective || '',

                // Spend & Reach
                spend,
                impressions,
                reach,
                frequency,

                // Clicks & CTR
                clicks,
                unique_clicks: uniqueClicks,
                link_clicks: linkClicks,
                unique_link_clicks: uniqueLinkClicks,
                ctr,
                link_ctr: linkCtr,

                // Cost Metrics
                cpc,
                cost_per_unique_click: costPerUniqueClick,
                cost_per_link_click: costPerLinkClick,
                cpm,

                // Landing Page
                landing_page_views: landingPageViews,
                cost_per_landing_page_view: costPerLandingPageView,

                // E-commerce Funnel
                view_content: viewContent,
                cost_per_view_content: costPerViewContent,
                add_to_cart: addToCart,
                add_to_cart_value: addToCartValue,
                cost_per_add_to_cart: costPerAddToCart,
                initiate_checkout: initiateCheckout,
                cost_per_checkout: costPerCheckout,
                purchases,
                purchase_value: purchaseValue,
                cost_per_purchase: costPerPurchase,

                // Derived E-commerce KPIs
                aov: derived.aov,
                cac: derived.cac,
                cvr: derived.cvr,
                roas: roas || derived.roas,
                gross_profit: derived.gross_profit,
                profit_margin: derived.profit_margin,

                // Funnel Rates
                add_to_cart_rate: derived.add_to_cart_rate,
                checkout_rate: derived.checkout_rate,
                purchase_rate: derived.purchase_rate,

                // Engagement
                post_engagement: postEngagement,
                engagement_rate: derived.engagement_rate,
                cost_per_engagement: costPerEngagement,
                reactions,
                comments,
                saves,

                // Messaging
                messages,
                cost_per_message: costPerMessage,

                // Video
                video_plays: videoPlays,
                video_thruplay: videoThruplay,
                video_p25: videoP25,
                video_p50: videoP50,
                video_p75: videoP75,
                video_p100: videoP100,
                video_completion_rate: derived.video_completion_rate,
                video_hook_rate: derived.video_hook_rate,

                // Lead Gen
                leads,
                cost_per_lead: costPerLead,
                registrations,
                cost_per_registration: costPerRegistration,
            };
        });

        // Sort by date then campaign
        dailyData.sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.campaign_name.localeCompare(b.campaign_name);
        });

        return NextResponse.json({
            success: true,
            data: dailyData,
            count: dailyData.length,
            dateRange: { startDate, endDate },
            metricsCount: Object.keys(dailyData[0] || {}).length,
        });
    } catch (error) {
        console.error('Daily insights error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
