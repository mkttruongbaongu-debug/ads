// Facebook Marketing API Client

import { FBAdAccount, FBCampaign, FBAdset, FBAd, FBInsight, FB_METRICS_FIELDS, DateRange } from './types';

const FB_API_VERSION = 'v19.0';
const FB_GRAPH_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

export class FacebookAdsClient {
    private accessToken: string;
    private businessId?: string;

    constructor(accessToken: string, businessId?: string) {
        this.accessToken = accessToken;
        this.businessId = businessId;
    }

    private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
        const url = new URL(`${FB_GRAPH_URL}${endpoint}`);
        url.searchParams.set('access_token', this.accessToken);

        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });

        const response = await fetch(url.toString());

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Facebook API error');
        }

        return response.json();
    }

    // Lấy danh sách Ad Accounts từ Business Manager (cả owned và client)
    async getAdAccounts(): Promise<FBAdAccount[]> {
        if (!this.businessId) {
            throw new Error('Business ID is required to fetch ad accounts');
        }

        const fields = 'id,name,account_status,currency,timezone_name,business{id,name}';

        // Fetch owned ad accounts (tài khoản do BM sở hữu)
        const ownedResponse = await this.fetch<{ data: FBAdAccount[] }>(
            `/${this.businessId}/owned_ad_accounts`,
            { fields, limit: '100' }
        );

        // Fetch client ad accounts (tài khoản được chia sẻ quyền)
        let clientAccounts: FBAdAccount[] = [];
        try {
            const clientResponse = await this.fetch<{ data: FBAdAccount[] }>(
                `/${this.businessId}/client_ad_accounts`,
                { fields, limit: '100' }
            );
            clientAccounts = clientResponse.data || [];
        } catch (error) {
            // Có thể không có quyền hoặc không có client accounts
            console.log('No client ad accounts or missing permission');
        }

        // Merge và loại bỏ trùng lặp
        const allAccounts = [...(ownedResponse.data || []), ...clientAccounts];
        const uniqueAccounts = allAccounts.filter((acc, index, self) =>
            index === self.findIndex(a => a.id === acc.id)
        );

        return uniqueAccounts;
    }

    // Lấy campaigns của một Ad Account
    async getCampaigns(accountId: string): Promise<FBCampaign[]> {
        // Normalize account ID - remove act_ prefix if present, then add it
        const normalizedId = accountId.replace(/^act_/, '');
        const response = await this.fetch<{ data: FBCampaign[] }>(
            `/act_${normalizedId}/campaigns`,
            {
                fields: 'id,name,status,objective,created_time,updated_time,daily_budget,lifetime_budget',
                limit: '500',
            }
        );

        return response.data || [];
    }

    // Lấy adsets của một Campaign
    async getAdsets(campaignId: string): Promise<FBAdset[]> {
        const response = await this.fetch<{ data: FBAdset[] }>(
            `/${campaignId}/adsets`,
            {
                fields: 'id,campaign_id,name,status,optimization_goal,billing_event,bid_amount,daily_budget,lifetime_budget,start_time,end_time',
                limit: '500',
            }
        );

        return response.data;
    }

    // Lấy ads của một Adset
    async getAds(adsetId: string): Promise<FBAd[]> {
        const response = await this.fetch<{ data: FBAd[] }>(
            `/${adsetId}/ads`,
            {
                fields: 'id,adset_id,name,status,creative{id,name,thumbnail_url}',
                limit: '500',
            }
        );

        return response.data;
    }

    // Lấy insights (metrics) của Account/Campaign/Adset/Ad
    async getInsights(
        objectId: string,
        dateRange: DateRange,
        level: 'account' | 'campaign' | 'adset' | 'ad' = 'campaign'
    ): Promise<FBInsight[]> {
        const endpoint = objectId.startsWith('act_')
            ? `/${objectId}/insights`
            : `/act_${objectId}/insights`;

        const response = await this.fetch<{ data: FBInsight[] }>(
            endpoint,
            {
                fields: FB_METRICS_FIELDS,
                level,
                time_range: JSON.stringify({
                    since: dateRange.startDate,
                    until: dateRange.endDate,
                }),
                time_increment: '1', // Daily breakdown
                limit: '1000',
            }
        );

        return response.data || [];
    }

    // Lấy insights aggregated (không breakdown theo ngày)
    async getInsightsSummary(
        accountId: string,
        dateRange: DateRange,
        level: 'account' | 'campaign' | 'adset' | 'ad' = 'campaign'
    ): Promise<FBInsight[]> {
        // Normalize account ID - remove act_ prefix if present
        const normalizedId = accountId.replace(/^act_/, '');
        const response = await this.fetch<{ data: FBInsight[] }>(
            `/act_${normalizedId}/insights`,
            {
                fields: FB_METRICS_FIELDS,
                level,
                time_range: JSON.stringify({
                    since: dateRange.startDate,
                    until: dateRange.endDate,
                }),
                limit: '1000',
            }
        );

        return response.data || [];
    }

    // Tắt/Bật Campaign
    async updateCampaignStatus(campaignId: string, status: 'ACTIVE' | 'PAUSED'): Promise<boolean> {
        const response = await fetch(`${FB_GRAPH_URL}/${campaignId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: this.accessToken,
                status,
            }),
        });

        return response.ok;
    }

    // Tắt/Bật Adset
    async updateAdsetStatus(adsetId: string, status: 'ACTIVE' | 'PAUSED'): Promise<boolean> {
        const response = await fetch(`${FB_GRAPH_URL}/${adsetId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: this.accessToken,
                status,
            }),
        });

        return response.ok;
    }
    // Lấy ads với creative content đầy đủ
    async getAdsWithCreative(accountId: string): Promise<{
        id: string;
        name: string;
        status: string;
        campaign_id: string;
        campaign_name: string;
        adset_id: string;
        adset_name: string;
        creative: {
            id: string;
            title?: string;
            body?: string;
            image_url?: string;
            thumbnail_url?: string;
            video_id?: string;
            call_to_action_type?: string;
            link_url?: string;
            object_story_spec?: object;
        };
    }[]> {
        const normalizedId = accountId.replace(/^act_/, '');

        // Lấy ads với creative fields mở rộng
        const creativeFields = [
            'id',
            'name',
            'title',
            'body',
            'image_url',
            'thumbnail_url',
            'video_id',
            'call_to_action_type',
            'link_url',
            'object_story_spec',
            'asset_feed_spec',
            'effective_object_story_id',
        ].join(',');

        const response = await this.fetch<{
            data: {
                id: string;
                name: string;
                status: string;
                campaign_id: string;
                campaign: { id: string; name: string };
                adset_id: string;
                adset: { id: string; name: string };
                creative: {
                    id: string;
                    title?: string;
                    body?: string;
                    image_url?: string;
                    thumbnail_url?: string;
                    video_id?: string;
                    call_to_action_type?: string;
                    link_url?: string;
                    object_story_spec?: object;
                };
            }[]
        }>(
            `/act_${normalizedId}/ads`,
            {
                fields: `id,name,status,campaign_id,campaign{id,name},adset_id,adset{id,name},creative{${creativeFields}}`,
                limit: '500',
            }
        );

        return response.data.map(ad => ({
            id: ad.id,
            name: ad.name,
            status: ad.status,
            campaign_id: ad.campaign_id,
            campaign_name: ad.campaign?.name || '',
            adset_id: ad.adset_id,
            adset_name: ad.adset?.name || '',
            creative: ad.creative || { id: '' },
        }));
    }

    // Lấy thông tin video từ video_id
    async getVideoDetails(videoId: string): Promise<{
        id: string;
        title?: string;
        description?: string;
        source?: string;
        picture?: string;
        permalink_url?: string;
        length?: number;
    }> {
        const response = await this.fetch<{
            id: string;
            title?: string;
            description?: string;
            source?: string;
            picture?: string;
            permalink_url?: string;
            length?: number;
        }>(
            `/${videoId}`,
            {
                fields: 'id,title,description,source,picture,permalink_url,length',
            }
        );

        return response;
    }

    // Lấy tất cả creatives của account
    async getAdCreatives(accountId: string): Promise<{
        id: string;
        name?: string;
        title?: string;
        body?: string;
        image_url?: string;
        thumbnail_url?: string;
        video_id?: string;
        call_to_action_type?: string;
        link_url?: string;
    }[]> {
        const normalizedId = accountId.replace(/^act_/, '');

        const response = await this.fetch<{
            data: {
                id: string;
                name?: string;
                title?: string;
                body?: string;
                image_url?: string;
                thumbnail_url?: string;
                video_id?: string;
                call_to_action_type?: string;
                link_url?: string;
            }[]
        }>(
            `/act_${normalizedId}/adcreatives`,
            {
                fields: 'id,name,title,body,image_url,thumbnail_url,video_id,call_to_action_type,link_url,object_story_spec',
                limit: '500',
            }
        );

        return response.data || [];
    }
}

// Singleton instance factory
let clientInstance: FacebookAdsClient | null = null;

export function getFacebookClient(): FacebookAdsClient {
    if (!clientInstance) {
        const accessToken = process.env.FB_ACCESS_TOKEN;
        const businessId = process.env.FB_BUSINESS_ID;

        if (!accessToken) {
            throw new Error('FB_ACCESS_TOKEN is not configured');
        }

        clientInstance = new FacebookAdsClient(accessToken, businessId);
    }

    return clientInstance;
}

export function resetFacebookClient(): void {
    clientInstance = null;
}

/**
 * Get Facebook client with dynamic token (from Sheets or .env)
 * Use this for API calls that need fresh token
 */
export async function getDynamicFacebookClient(): Promise<FacebookAdsClient> {
    const { getValidAccessToken } = await import('./token');
    const tokenResult = await getValidAccessToken();

    if (!tokenResult.accessToken) {
        throw new Error(
            tokenResult.error ||
            'No valid access token. Please login with Facebook.'
        );
    }

    const businessId = process.env.FB_BUSINESS_ID;
    return new FacebookAdsClient(tokenResult.accessToken, businessId);
}
