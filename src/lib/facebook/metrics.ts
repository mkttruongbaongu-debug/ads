// Facebook Ads Metrics Constants - COMPREHENSIVE COLLECTION
// Author: Thợ ADS AI - Performance Ads Expert Edition

// ============================================================================
// RAW METRICS FROM FACEBOOK API
// ============================================================================

// Chi phí & Ngân sách
export const SPEND_METRICS = [
    'spend',                    // Chi phí thực tế
    'account_currency',         // Đơn vị tiền tệ
];

// Tiếp cận & Hiển thị
export const REACH_METRICS = [
    'impressions',              // Tổng lượt hiển thị
    'reach',                    // Số người tiếp cận (unique)
    'frequency',                // Tần suất hiển thị/người
    'social_spend',             // Chi phí social
];

// Clicks & Traffic
export const CLICK_METRICS = [
    'clicks',                   // Tổng clicks (all types)
    'unique_clicks',            // Clicks unique users
    'inline_link_clicks',       // Clicks vào link trong ad
    'unique_inline_link_clicks', // Link clicks unique
    'outbound_clicks',          // Clicks ra ngoài
    'unique_outbound_clicks',   // Outbound clicks unique
];

// CTR & Tỷ lệ Click
export const CTR_METRICS = [
    'ctr',                      // CTR tổng
    'unique_ctr',               // CTR unique
    'inline_link_click_ctr',    // CTR link clicks
    'unique_link_clicks_ctr',   // CTR link unique
    'outbound_clicks_ctr',      // CTR outbound
];

// Chi phí trên mỗi action
export const COST_METRICS = [
    'cpc',                      // Cost per Click
    'cpm',                      // Cost per 1000 Impressions
    'cpp',                      // Cost per 1000 People Reached
    'cost_per_unique_click',    // Cost per Unique Click
    'cost_per_inline_link_click', // Cost per Link Click
    'cost_per_outbound_click',  // Cost per Outbound Click
];

// Video Metrics
export const VIDEO_METRICS = [
    'video_thruplay_watched_actions',  // Video watched to completion/15s
    'video_p25_watched_actions',       // Video watched 25%
    'video_p50_watched_actions',       // Video watched 50%
    'video_p75_watched_actions',       // Video watched 75%
    'video_p100_watched_actions',      // Video watched 100%
    'video_avg_time_watched_actions',  // Avg time watched
    'video_play_actions',              // Video plays
    'video_30_sec_watched_actions',    // Video watched 30s
];

// Engagement Metrics
export const ENGAGEMENT_METRICS = [
    'social_clicks',            // Social clicks
    'unique_social_clicks',     // Social clicks unique
];

// Actions (Conversions) - Parsed separately
export const ACTION_METRICS = [
    'actions',                  // All action types
    'action_values',            // Value of actions
    'cost_per_action_type',     // Cost per action
    'conversions',              // Conversions
    'cost_per_conversion',      // Cost per conversion
    'purchase_roas',            // ROAS
    'website_purchase_roas',    // Website ROAS
];

// Campaign/Adset/Ad Info
export const ENTITY_METRICS = [
    'campaign_id',
    'campaign_name',
    'adset_id',
    'adset_name',
    'ad_id',
    'ad_name',
    'objective',
    'optimization_goal',
];

// Date Info
export const DATE_METRICS = [
    'date_start',
    'date_stop',
];

// ============================================================================
// COMBINED FIELDS FOR API REQUEST
// ============================================================================
export const FB_COMPREHENSIVE_FIELDS = [
    ...ENTITY_METRICS,
    ...DATE_METRICS,
    ...SPEND_METRICS,
    ...REACH_METRICS,
    ...CLICK_METRICS,
    ...CTR_METRICS,
    ...COST_METRICS,
    ...VIDEO_METRICS,
    ...ACTION_METRICS,
].join(',');

// ============================================================================
// ACTION TYPES TO PARSE (from actions array)
// ============================================================================
export const IMPORTANT_ACTION_TYPES = {
    // E-commerce Actions
    purchase: ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'],
    add_to_cart: ['add_to_cart', 'omni_add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart'],
    initiate_checkout: ['initiate_checkout', 'omni_initiated_checkout', 'offsite_conversion.fb_pixel_initiate_checkout'],
    view_content: ['view_content', 'omni_view_content', 'offsite_conversion.fb_pixel_view_content'],

    // Lead Gen Actions
    lead: ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped'],
    complete_registration: ['complete_registration', 'offsite_conversion.fb_pixel_complete_registration'],

    // Traffic Actions
    landing_page_view: ['landing_page_view'],
    link_click: ['link_click'],

    // Engagement Actions
    page_engagement: ['page_engagement'],
    post_engagement: ['post_engagement'],
    post_reaction: ['post_reaction'],
    comment: ['comment'],
    post_save: ['onsite_conversion.post_save'],

    // Messaging Actions
    onsite_message: ['onsite_conversion.messaging_conversation_started_7d'],
    offsite_message: ['offsite_conversion.messaging_conversation_started_7d'],

    // Video Actions
    video_view: ['video_view'],

    // App Actions
    app_install: ['app_install', 'omni_app_install', 'mobile_app_install'],
};

// ============================================================================
// DERIVED METRICS - CALCULATED FROM RAW DATA
// ============================================================================
export interface DerivedMetrics {
    // E-commerce KPIs
    aov: number;                // Average Order Value = revenue / purchases
    cac: number;                // Customer Acquisition Cost = spend / purchases
    cvr: number;                // Conversion Rate = purchases / clicks
    roas: number;               // Return on Ad Spend = revenue / spend
    mer: number;                // Marketing Efficiency Ratio = revenue / spend (same as ROAS but different context)

    // Profit Analysis
    gross_profit: number;       // Revenue - Spend
    profit_margin: number;      // (Revenue - Spend) / Revenue * 100

    // Traffic Quality
    ctr_quality: number;        // Link CTR / Total CTR - measures ad relevance
    bounce_estimate: number;    // 1 - (landing_page_view / link_clicks) - estimated bounce rate

    // Engagement Quality
    engagement_rate: number;    // (post_engagement / impressions) * 100

    // Video Performance
    video_completion_rate: number; // video_p100 / video_play
    video_hook_rate: number;    // video_p25 / video_play

    // Funnel Metrics
    add_to_cart_rate: number;   // add_to_cart / view_content
    checkout_rate: number;      // initiate_checkout / add_to_cart
    purchase_rate: number;      // purchase / initiate_checkout
}

// ============================================================================
// HELPER FUNCTIONS FOR DERIVED METRICS
// ============================================================================
export function calculateDerivedMetrics(raw: {
    spend: number;
    impressions: number;
    clicks: number;
    link_clicks: number;
    landing_page_views: number;
    purchases: number;
    revenue: number;
    add_to_cart: number;
    initiate_checkout: number;
    view_content: number;
    post_engagement: number;
    video_plays: number;
    video_p25: number;
    video_p100: number;
    ctr: number;
    link_ctr: number;
}): DerivedMetrics {
    const safeDiv = (a: number, b: number) => b > 0 ? a / b : 0;

    return {
        // E-commerce KPIs
        aov: safeDiv(raw.revenue, raw.purchases),
        cac: safeDiv(raw.spend, raw.purchases),
        cvr: safeDiv(raw.purchases, raw.clicks) * 100,
        roas: safeDiv(raw.revenue, raw.spend),
        mer: safeDiv(raw.revenue, raw.spend),

        // Profit Analysis
        gross_profit: raw.revenue - raw.spend,
        profit_margin: safeDiv(raw.revenue - raw.spend, raw.revenue) * 100,

        // Traffic Quality
        ctr_quality: safeDiv(raw.link_ctr, raw.ctr),
        bounce_estimate: (1 - safeDiv(raw.landing_page_views, raw.link_clicks)) * 100,

        // Engagement Quality
        engagement_rate: safeDiv(raw.post_engagement, raw.impressions) * 100,

        // Video Performance
        video_completion_rate: safeDiv(raw.video_p100, raw.video_plays) * 100,
        video_hook_rate: safeDiv(raw.video_p25, raw.video_plays) * 100,

        // Funnel Metrics
        add_to_cart_rate: safeDiv(raw.add_to_cart, raw.view_content) * 100,
        checkout_rate: safeDiv(raw.initiate_checkout, raw.add_to_cart) * 100,
        purchase_rate: safeDiv(raw.purchases, raw.initiate_checkout) * 100,
    };
}

// ============================================================================
// SHEET HEADERS - Full data structure for Google Sheets
// ============================================================================
export const COMPREHENSIVE_SHEET_HEADERS = [
    // Identification
    'date',
    'account_id',
    'account_name',
    'campaign_id',
    'campaign_name',
    'status',
    'objective',

    // Spend & Reach
    'spend',
    'impressions',
    'reach',
    'frequency',

    // Clicks & CTR
    'clicks',
    'unique_clicks',
    'link_clicks',
    'unique_link_clicks',
    'ctr',
    'unique_ctr',
    'link_ctr',

    // Cost Metrics
    'cpc',
    'unique_cpc',
    'cost_per_link_click',
    'cpm',
    'cpp',

    // Landing Page
    'landing_page_views',
    'cost_per_landing_page_view',

    // E-commerce Funnel
    'view_content',
    'add_to_cart',
    'initiate_checkout',
    'purchases',
    'purchase_value',
    'cost_per_purchase',

    // Derived E-commerce
    'aov',                      // Average Order Value
    'cac',                      // Customer Acquisition Cost
    'cvr',                      // Conversion Rate (%)
    'roas',                     // Return on Ad Spend
    'gross_profit',             // Revenue - Spend
    'profit_margin',            // (%)

    // Funnel Rates
    'add_to_cart_rate',         // ATC / View Content (%)
    'checkout_rate',            // IC / ATC (%)
    'purchase_rate',            // Purchase / IC (%)

    // Engagement
    'post_engagement',
    'engagement_rate',
    'reactions',
    'comments',
    'shares',
    'saves',

    // Messaging
    'messages',
    'cost_per_message',

    // Video (if applicable)
    'video_plays',
    'video_thruplay',
    'video_p25',
    'video_p50',
    'video_p75',
    'video_p100',
    'video_avg_watch_time',
    'video_completion_rate',
    'video_hook_rate',

    // Lead Gen (if applicable)
    'leads',
    'cost_per_lead',
    'registrations',
    'cost_per_registration',
];
