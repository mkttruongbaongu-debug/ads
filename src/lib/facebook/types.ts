// Facebook Marketing API Types

export interface FBAdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  business?: {
    id: string;
    name: string;
  };
}

export interface FBCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  objective: string;
  created_time: string;
  updated_time: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

export interface FBAdset {
  id: string;
  campaign_id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  targeting?: object;
  optimization_goal: string;
  billing_event: string;
  bid_amount?: number;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  end_time?: string;
}

export interface FBAd {
  id: string;
  adset_id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  creative?: {
    id: string;
    name?: string;
    thumbnail_url?: string;
  };
}

// Ad Creative - Content chi tiết của quảng cáo
export interface FBAdCreative {
  id: string;
  name?: string;

  // Caption / Text Content
  title?: string;                    // Tiêu đề
  body?: string;                     // Nội dung chính (caption)
  call_to_action_type?: string;      // CTA: SHOP_NOW, LEARN_MORE, etc.
  link_url?: string;                 // Link đích

  // Hình ảnh
  image_url?: string;                // URL hình ảnh full
  image_hash?: string;               // Hash của hình ảnh
  thumbnail_url?: string;            // URL thumbnail

  // Video
  video_id?: string;                 // ID video

  // Object Story (post gốc)
  object_story_id?: string;          // ID của post
  object_story_spec?: {
    page_id?: string;
    link_data?: {
      message?: string;              // Caption của post
      link?: string;
      name?: string;                 // Tiêu đề link
      description?: string;          // Mô tả
      image_hash?: string;
      call_to_action?: {
        type: string;
        value?: { link?: string };
      };
    };
    video_data?: {
      video_id?: string;
      message?: string;              // Caption video
      title?: string;
      image_url?: string;            // Thumbnail
      call_to_action?: {
        type: string;
        value?: { link?: string };
      };
    };
    photo_data?: {
      image_hash?: string;
      message?: string;              // Caption ảnh
    };
  };

  // Effective (sau khi render)
  effective_object_story_id?: string;

  // Asset Feed (cho dynamic creative)
  asset_feed_spec?: {
    images?: { hash?: string; url?: string }[];
    videos?: { video_id?: string; thumbnail_url?: string }[];
    bodies?: { text: string }[];
    titles?: { text: string }[];
    descriptions?: { text: string }[];
  };
}

// Video - Chi tiết video
export interface FBAdVideo {
  id: string;
  title?: string;
  description?: string;
  source?: string;                   // URL video có thể xem
  picture?: string;                  // Thumbnail URL
  permalink_url?: string;            // Link xem trên FB
  length?: number;                   // Độ dài (giây)
  created_time?: string;
  updated_time?: string;
}

export interface FBInsight {
  // Campaign info (khi level=campaign)
  campaign_id?: string;
  campaign_name?: string;

  // Chi phí
  spend: string;
  cpm: string;
  cpc: string;
  cpp: string;
  cost_per_action_type?: { action_type: string; value: string }[];

  // Hiệu suất
  impressions: string;
  reach: string;
  frequency: string;

  // Tương tác
  clicks: string;
  ctr: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[]; // Giá trị chuyển đổi

  // Chuyển đổi
  conversions?: { action_type: string; value: string }[];
  cost_per_conversion?: { action_type: string; value: string }[];
  purchase_roas?: { action_type: string; value: string }[]; // ROAS

  // Video
  video_thruplay_watched_actions?: { action_type: string; value: string }[];
  video_p25_watched_actions?: { action_type: string; value: string }[];
  video_p50_watched_actions?: { action_type: string; value: string }[];
  video_p75_watched_actions?: { action_type: string; value: string }[];
  video_p100_watched_actions?: { action_type: string; value: string }[];

  // Date
  date_start: string;
  date_stop: string;
}

export interface FBMetricsRow {
  date: string;
  accountId: string;
  accountName: string;
  campaignId: string;
  campaignName: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  status: string;

  // Metrics
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;

  // Conversions
  results?: number;
  costPerResult?: number;

  // Messaging
  messagesStarted?: number;
  costPerMessage?: number;
}

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

// Import comprehensive fields from metrics.ts
export { FB_COMPREHENSIVE_FIELDS } from './metrics';

// Legacy export for backward compatibility
export const FB_METRICS_FIELDS = [
  'campaign_id',
  'campaign_name',
  'adset_id',
  'adset_name',
  'ad_id',
  'ad_name',
  'objective',
  'optimization_goal',
  'date_start',
  'date_stop',
  'spend',
  'account_currency',
  'impressions',
  'reach',
  'frequency',
  'clicks',
  'unique_clicks',
  'inline_link_clicks',
  'unique_inline_link_clicks',
  'outbound_clicks',
  'ctr',
  'unique_ctr',
  'inline_link_click_ctr',
  'outbound_clicks_ctr',
  'cpc',
  'cpm',
  'cpp',
  'cost_per_unique_click',
  'cost_per_inline_link_click',
  'cost_per_outbound_click',
  'video_thruplay_watched_actions',
  'video_p25_watched_actions',
  'video_p50_watched_actions',
  'video_p75_watched_actions',
  'video_p100_watched_actions',
  'video_avg_time_watched_actions',
  'video_play_actions',
  'actions',
  'action_values',
  'cost_per_action_type',
  'conversions',
  'cost_per_conversion',
  'purchase_roas',
  'website_purchase_roas',
].join(',');

