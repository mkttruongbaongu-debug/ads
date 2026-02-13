/**
 * ===================================================================
 * API: CREATIVE INTELLIGENCE
 * ===================================================================
 * Route: GET /api/analysis/campaign/[id]/creative-intel
 *
 * Phân tích creative nào thắng/thua, tại sao,
 * và tạo creative brief cho content mới.
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/facebook/token';
import {
    analyzeCreativeIntelligence,
    type AdPerformanceData,
} from '@/lib/ai/creative-intelligence';

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
        const productFocus = searchParams.get('product') || undefined;

        if (!startDate || !endDate) {
            return NextResponse.json(
                { success: false, error: 'startDate and endDate are required' },
                { status: 400 }
            );
        }

        // Auth
        const tokenResult = await getValidAccessToken();
        if (!tokenResult.accessToken) {
            return NextResponse.json(
                { success: false, error: tokenResult.error || 'No token', needsLogin: true },
                { status: 401 }
            );
        }
        const accessToken = tokenResult.accessToken;

        console.log(`[CREATIVE_INTEL_API] 🎨 Campaign ${campaignId}, ${startDate} → ${endDate}`);

        // Step 1: Fetch ads with insights + creative
        const adsRes = await fetch(
            `${FB_API_BASE}/${campaignId}/ads?` +
            `fields=id,name,status,effective_image_url,effective_object_story_id,` +
            `creative{id,thumbnail_url,image_url,body,title,call_to_action_type,object_story_spec,asset_feed_spec},` +
            `insights.time_range({'since':'${startDate}','until':'${endDate}'}){` +
            `spend,impressions,clicks,actions,action_values` +
            `}&limit=100&access_token=${accessToken}`
        );

        const adsData = await adsRes.json();

        if (adsData.error) {
            return NextResponse.json(
                { success: false, error: adsData.error.message },
                { status: 400 }
            );
        }

        // Step 2: Transform to AdPerformanceData
        const ads: AdPerformanceData[] = (adsData.data || []).map((ad: any) => {
            const insights = ad.insights?.data?.[0] || {};
            const spend = parseFloat(insights.spend || '0');
            const impressions = parseInt(insights.impressions || '0');
            const clicks = parseInt(insights.clicks || '0');

            const purchaseAction = (insights.actions || []).find(
                (a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
            );
            const revenueAction = (insights.action_values || []).find(
                (a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
            );

            const purchases = purchaseAction ? parseInt(purchaseAction.value) : 0;
            const revenue = revenueAction ? parseFloat(revenueAction.value) : 0;

            // Extract creative content
            const storySpec = ad.creative?.object_story_spec;
            const assetFeed = ad.creative?.asset_feed_spec;
            const caption = ad.creative?.body
                || storySpec?.link_data?.message
                || storySpec?.video_data?.message
                || storySpec?.photo_data?.caption
                || assetFeed?.bodies?.[0]?.text
                || '';

            const videoId = storySpec?.video_data?.video_id || '';

            // Extract ALL image URLs — ưu tiên effective_image_url (ad-level) > image_url > thumbnail_url
            const imageUrls: string[] = [];
            if (ad.effective_image_url) imageUrls.push(ad.effective_image_url);
            else if (ad.creative?.image_url) imageUrls.push(ad.creative.image_url);
            if (ad.creative?.thumbnail_url && !imageUrls.includes(ad.creative.thumbnail_url)) {
                // Only add thumbnail as fallback, not alongside full image
                if (imageUrls.length === 0) imageUrls.push(ad.creative.thumbnail_url);
            }
            // Carousel / asset feed images
            if (assetFeed?.images) {
                for (const img of assetFeed.images) {
                    if (img.url && !imageUrls.includes(img.url)) imageUrls.push(img.url);
                }
            }

            // Content type detection
            let contentType: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'UNKNOWN' = 'UNKNOWN';
            if (videoId) contentType = 'VIDEO';
            else if (imageUrls.length > 1 || assetFeed?.images?.length) contentType = 'CAROUSEL';
            else if (imageUrls.length === 1) contentType = 'IMAGE';

            return {
                ad_id: ad.id,
                ad_name: ad.name,
                caption,
                title: ad.creative?.title || storySpec?.link_data?.name || assetFeed?.titles?.[0]?.text || '',
                cta: ad.creative?.call_to_action_type || '',
                content_type: contentType as any,
                image_url: imageUrls[0] || '',
                image_urls: imageUrls,
                metrics: {
                    spend,
                    purchases,
                    revenue,
                    cpp: purchases > 0 ? spend / purchases : 0,
                    roas: spend > 0 ? revenue / spend : 0,
                    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                    impressions,
                    clicks,
                },
            } satisfies AdPerformanceData;
        });

        // ===================================================================
        // STEP 2.5: Batch fetch full_picture from Facebook Posts
        // effective_object_story_id → Post → full_picture (720px+)
        // ===================================================================
        const storyIdMap = new Map<string, number[]>();
        (adsData.data || []).forEach((ad: any, idx: number) => {
            const storyId = ad.effective_object_story_id;
            if (storyId) {
                if (!storyIdMap.has(storyId)) storyIdMap.set(storyId, []);
                storyIdMap.get(storyId)!.push(idx);
            }
        });

        if (storyIdMap.size > 0) {
            try {
                const storyIds = Array.from(storyIdMap.keys()).join(',');
                const postRes = await fetch(
                    `${FB_API_BASE}/?ids=${storyIds}&fields=full_picture,attachments{media{image{src,height,width}}}&access_token=${accessToken}`
                );
                const postData = await postRes.json();

                for (const [storyId, adIndexes] of storyIdMap) {
                    const postInfo = postData[storyId];
                    if (!postInfo) continue;

                    // Priority: attachments.media.image.src (original) > full_picture (compressed)
                    const attachmentSrc = postInfo.attachments?.data?.[0]?.media?.image?.src;
                    const bestImage = attachmentSrc || postInfo.full_picture;

                    if (bestImage) {
                        for (const idx of adIndexes) {
                            const adItem = ads[idx];
                            if (!adItem) continue;
                            adItem.image_url = bestImage;
                            if (adItem.image_urls && !adItem.image_urls.includes(bestImage)) {
                                adItem.image_urls.unshift(bestImage);
                            }
                        }
                    }
                }
                console.log(`[CREATIVE_INTEL_API] 🖼️ Batch fetched ${storyIdMap.size} post images (attachments+full_picture)`);
            } catch (err) {
                console.warn('[CREATIVE_INTEL_API] ⚠️ Failed to batch fetch post images:', err);
            }
        }

        console.log(`[CREATIVE_INTEL_API] 📊 ${ads.length} ads fetched`);

        if (ads.length < 2) {
            return NextResponse.json({
                success: false,
                error: 'Campaign cần ít nhất 2 ads để phân tích creative intelligence',
            }, { status: 400 });
        }

        // Step 3: Run AI analysis
        if (productFocus) {
            console.log(`[CREATIVE_INTEL_API] 🎯 Product focus: "${productFocus}"`);
        }
        const result = await analyzeCreativeIntelligence(ads, productFocus);

        return NextResponse.json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error('[CREATIVE_INTEL_API] ❌', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
