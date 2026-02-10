import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/facebook/token';

const FB_API_VERSION = 'v21.0';
const FB_API_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

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

        // Fetch ads with daily insights and creative info
        const adsRes = await fetch(
            `${FB_API_BASE}/${campaignId}/ads?` +
            `fields=id,name,status,effective_object_story_id,effective_image_url,` +
            `creative{id,thumbnail_url,image_url,body,object_story_spec,effective_object_story_id},` +
            `insights.time_range({'since':'${startDate}','until':'${endDate}'}).time_increment(1){` +
            `date_start,spend,impressions,clicks,actions,action_values,ctr,cpc,cpm` +
            `}&limit=100&access_token=${accessToken}`
        );

        const adsData = await adsRes.json();

        if (adsData.error) {
            return NextResponse.json(
                { success: false, error: adsData.error.message },
                { status: 400 }
            );
        }

        // Transform ads data
        const ads = (adsData.data || []).map((ad: {
            id: string;
            name: string;
            status: string;
            effective_object_story_id?: string;
            effective_image_url?: string;
            creative?: {
                id: string;
                thumbnail_url?: string;
                image_url?: string;
                body?: string;
                effective_object_story_id?: string;
                object_story_spec?: {
                    link_data?: { message?: string; link?: string; image_hash?: string };
                    video_data?: { message?: string; video_id?: string; image_url?: string };
                    photo_data?: { caption?: string; url?: string };
                };
            };
            insights?: {
                data?: Array<{
                    date_start: string;
                    spend: string;
                    impressions: string;
                    clicks: string;
                    actions?: Array<{ action_type: string; value: string }>;
                    action_values?: Array<{ action_type: string; value: string }>;
                    ctr: string;
                    cpc: string;
                    cpm: string;
                }>
            };
        }) => {
            const insightsData = ad.insights?.data || [];

            // Calculate totals
            const totals = insightsData.reduce((acc, day) => {
                const spend = parseFloat(day.spend || '0');
                const impressions = parseInt(day.impressions || '0');
                const clicks = parseInt(day.clicks || '0');

                const purchases = day.actions?.find(a =>
                    a.action_type === 'purchase' || a.action_type === 'omni_purchase'
                );
                const revenue = day.action_values?.find(a =>
                    a.action_type === 'purchase' || a.action_type === 'omni_purchase'
                );

                return {
                    spend: acc.spend + spend,
                    impressions: acc.impressions + impressions,
                    clicks: acc.clicks + clicks,
                    purchases: acc.purchases + (purchases ? parseInt(purchases.value) : 0),
                    revenue: acc.revenue + (revenue ? parseFloat(revenue.value) : 0),
                };
            }, { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 });

            // Extract message/caption from creative
            const storySpec = ad.creative?.object_story_spec;
            const message = ad.creative?.body
                || storySpec?.link_data?.message
                || storySpec?.video_data?.message
                || storySpec?.photo_data?.caption
                || null;

            // Extract link
            const link = storySpec?.link_data?.link || null;

            // Build Facebook post URL from effective_object_story_id
            const storyId = ad.effective_object_story_id || ad.creative?.effective_object_story_id;
            const postUrl = storyId ? `https://www.facebook.com/${storyId.replace('_', '/posts/')}` : null;

            // Use full image — ưu tiên effective_image_url (ad-level) > image_url > thumbnail
            // effective_image_url returns ~720px, image_url varies, thumbnail_url is only ~64px
            let imageUrl = ad.effective_image_url
                || ad.creative?.image_url
                || storySpec?.video_data?.image_url
                || storySpec?.photo_data?.url
                || ad.creative?.thumbnail_url
                || null;

            // Enhance thumbnail URLs with width parameter for higher resolution
            if (imageUrl && imageUrl.includes('fbcdn') && imageUrl.includes('/t45') && !imageUrl.includes('width=')) {
                // Facebook thumbnail URLs can be enhanced with width param
                imageUrl = imageUrl.replace(/\/s\d+x\d+\//, '/s720x720/');
            }

            return {
                id: ad.id,
                name: ad.name,
                status: ad.status,
                thumbnail: imageUrl,
                creativeId: ad.creative?.id,
                message,
                link,
                postUrl,
                totals: {
                    ...totals,
                    cpp: totals.purchases > 0 ? totals.spend / totals.purchases : 0,
                    roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
                    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
                },
                dailyMetrics: insightsData.map(day => {
                    const spend = parseFloat(day.spend || '0');
                    const purchases = day.actions?.find(a =>
                        a.action_type === 'purchase' || a.action_type === 'omni_purchase'
                    );
                    const purchaseCount = purchases ? parseInt(purchases.value) : 0;

                    return {
                        date: day.date_start,
                        spend,
                        clicks: parseInt(day.clicks || '0'),
                        purchases: purchaseCount,
                        cpp: purchaseCount > 0 ? spend / purchaseCount : 0,
                        ctr: parseFloat(day.ctr || '0'),
                    };
                }),
            };
        });

        // Sort by spend (highest first) to show most impactful ads first
        ads.sort((a: { totals: { spend: number } }, b: { totals: { spend: number } }) => b.totals.spend - a.totals.spend);

        // Find worst performing ad (highest CPP with significant spend)
        const worstAd = ads.find((ad: { totals: { spend: number; cpp: number } }) =>
            ad.totals.spend > 100000 && ad.totals.cpp > 0
        );

        return NextResponse.json({
            success: true,
            data: {
                campaignId,
                ads,
                worstAd,
                summary: {
                    totalAds: ads.length,
                    activeAds: ads.filter((a: { status: string }) => a.status === 'ACTIVE').length,
                },
            },
        });

    } catch (error) {
        console.error('Campaign ads detail error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
