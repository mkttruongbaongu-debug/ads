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
        // video_id needed to batch-fetch hi-res video thumbnails
        const adsRes = await fetch(
            `${FB_API_BASE}/${campaignId}/ads?` +
            `fields=id,name,status,effective_object_story_id,effective_image_url,` +
            `creative{id,thumbnail_url,image_url,video_id,body,object_story_spec,effective_object_story_id},` +
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
                video_id?: string;
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

            // Enhance thumbnail URLs: try multiple fbcdn patterns for higher resolution
            if (imageUrl && imageUrl.includes('fbcdn')) {
                // Pattern 1: /t45.*/s64x64/ → /s720x720/
                if (imageUrl.match(/\/s\d+x\d+\//)) {
                    imageUrl = imageUrl.replace(/\/s\d+x\d+\//, '/s720x720/');
                }
                // Pattern 2: /t51.*/c64.64.../  (crop params → remove for full size)
                if (imageUrl.match(/\/c\d+\.\d+\./)) {
                    imageUrl = imageUrl.replace(/\/c\d+\.\d+\.[^/]+\//, '/');
                }
                // Pattern 3: width/height query params → upgrade
                if (imageUrl.includes('width=') && imageUrl.includes('height=')) {
                    imageUrl = imageUrl.replace(/width=\d+/, 'width=720').replace(/height=\d+/, 'height=720');
                }
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

        // ===================================================================
        // STEP 2: Batch fetch hi-res images from Facebook Posts
        // Each ad has effective_object_story_id = Facebook Post ID
        // Fetching full_picture + attachments + subattachments (carousel)
        // ===================================================================
        // Helper: detect low-res URLs (used by multiple steps)
        const isLowResUrl = (url: string): boolean => {
            if (!url) return true;
            // Known low-res patterns
            if (url.includes('/t45')) return true;         // FB thumbnail prefix
            if (url.match(/\/s\d{1,2}x\d{1,2}\//)) return true;  // /s64x64/ etc
            if (url.match(/\/p\d{1,2}x\d{1,2}\//)) return true;  // /p64x64/ etc
            if (url.match(/\/c\d{1,3}\.\d{1,3}\./)) return true;  // crop params
            // Check query params for small dimensions
            const widthMatch = url.match(/width=(\d+)/);
            const heightMatch = url.match(/height=(\d+)/);
            if (widthMatch && parseInt(widthMatch[1]) < 200) return true;
            if (heightMatch && parseInt(heightMatch[1]) < 200) return true;
            return false;
        };

        const storyIdMap = new Map<string, number[]>(); // storyId → [adIndex, ...]
        ads.forEach((ad: { postUrl: string | null }, idx: number) => {
            const rawAd = (adsData.data || [])[idx];
            const storyId = rawAd?.effective_object_story_id || rawAd?.creative?.effective_object_story_id;
            if (storyId) {
                if (!storyIdMap.has(storyId)) storyIdMap.set(storyId, []);
                storyIdMap.get(storyId)!.push(idx);
            }
        });

        if (storyIdMap.size > 0) {
            try {
                const storyIds = Array.from(storyIdMap.keys()).join(',');
                const postRes = await fetch(
                    `${FB_API_BASE}/?ids=${storyIds}&fields=full_picture,attachments{media{image{src,height,width}},subattachments{media{image{src,height,width}}}}&access_token=${accessToken}`
                );
                const postData = await postRes.json();

                // Map highest-res image URLs back to ads
                for (const [storyId, adIndexes] of storyIdMap) {
                    const postInfo = postData[storyId];
                    if (!postInfo) continue;

                    // Try attachments first — returns original upload resolution
                    let bestImage = '';
                    const attachment = postInfo.attachments?.data?.[0];

                    if (attachment?.media?.image?.src) {
                        bestImage = attachment.media.image.src;
                    }

                    // For carousel: check subattachments for higher quality
                    if (!bestImage || isLowResUrl(bestImage)) {
                        const subs = attachment?.subattachments?.data || [];
                        for (const sub of subs) {
                            const subSrc = sub?.media?.image?.src;
                            if (subSrc && !isLowResUrl(subSrc)) {
                                bestImage = subSrc;
                                break; // Use first hi-res carousel card as thumbnail
                            }
                        }
                    }

                    // Fallback to full_picture
                    if (!bestImage || isLowResUrl(bestImage)) {
                        if (postInfo.full_picture && !isLowResUrl(postInfo.full_picture)) {
                            bestImage = postInfo.full_picture;
                        }
                    }

                    if (bestImage && !isLowResUrl(bestImage)) {
                        for (const idx of adIndexes) {
                            ads[idx].thumbnail = bestImage;
                        }
                    }
                }
                console.log(`[API:ADS] 🖼️ Batch fetched ${storyIdMap.size} post images (attachments+subattachments+full_picture)`);
            } catch (err) {
                console.warn('[API:ADS] ⚠️ Failed to batch fetch post images:', err);
            }
        }

        // ===================================================================
        // STEP 3: Batch fetch video thumbnails for ads STILL at low-res
        // Video ads often have no effective_image_url or effective_object_story_id
        // → fetch /{video_id}?fields=picture for 720px+ video poster
        // ===================================================================
        const videoMap = new Map<string, number[]>(); // videoId → [adIndex]
        ads.forEach((ad: { thumbnail: string | null }, idx: number) => {
            if (!isLowResUrl(ad.thumbnail || '')) return; // Already hi-res

            const rawAd = (adsData.data || [])[idx];
            const videoId = rawAd?.creative?.video_id || rawAd?.creative?.object_story_spec?.video_data?.video_id;
            if (videoId) {
                if (!videoMap.has(videoId)) videoMap.set(videoId, []);
                videoMap.get(videoId)!.push(idx);
            }
        });

        if (videoMap.size > 0) {
            try {
                const videoIds = Array.from(videoMap.keys()).join(',');
                const vidRes = await fetch(
                    `${FB_API_BASE}/?ids=${videoIds}&fields=picture,format&access_token=${accessToken}`
                );
                const vidData = await vidRes.json();

                let upgraded = 0;
                for (const [videoId, adIndexes] of videoMap) {
                    const vidInfo = vidData[videoId];
                    if (!vidInfo) continue;

                    let bestPic = '';
                    if (vidInfo.format && Array.isArray(vidInfo.format)) {
                        const sorted = [...vidInfo.format].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
                        bestPic = sorted[0]?.picture || '';
                    }
                    if (!bestPic) bestPic = vidInfo.picture || '';

                    if (bestPic) {
                        for (const idx of adIndexes) {
                            ads[idx].thumbnail = bestPic;
                        }
                        upgraded++;
                    }
                }
                console.log(`[API:ADS] 🎬 Video thumbnails: ${upgraded}/${videoMap.size} upgraded to hi-res`);
            } catch (err) {
                console.warn('[API:ADS] ⚠️ Failed to fetch video thumbnails:', err);
            }
        }

        // ===================================================================
        // STEP 4: Batch fetch creative images for ads STILL at low-res
        // Last resort: fetch /{creative_id}?fields=effective_image_url,image_url
        // This catches image/carousel ads that STEP 2 missed
        // ===================================================================
        const creativeMap = new Map<string, number[]>(); // creativeId → [adIndex]
        ads.forEach((ad: { thumbnail: string | null; creativeId?: string }, idx: number) => {
            const thumb = ad.thumbnail || '';
            if (!isLowResUrl(thumb) && thumb) return; // Already hi-res

            const rawAd = (adsData.data || [])[idx];
            const creativeId = ad.creativeId || rawAd?.creative?.id;
            if (creativeId) {
                if (!creativeMap.has(creativeId)) creativeMap.set(creativeId, []);
                creativeMap.get(creativeId)!.push(idx);
            }
        });

        if (creativeMap.size > 0) {
            try {
                const creativeIds = Array.from(creativeMap.keys()).join(',');
                const creativeRes = await fetch(
                    `${FB_API_BASE}/?ids=${creativeIds}&fields=effective_image_url,image_url,object_story_spec{link_data{picture},photo_data{url}}&access_token=${accessToken}`
                );
                const creativeData = await creativeRes.json();

                let upgraded = 0;
                for (const [creativeId, adIndexes] of creativeMap) {
                    const info = creativeData[creativeId];
                    if (!info) continue;

                    // Priority: effective_image_url > image_url > link_data.picture > photo_data.url
                    const candidates = [
                        info.effective_image_url,
                        info.image_url,
                        info.object_story_spec?.link_data?.picture,
                        info.object_story_spec?.photo_data?.url,
                    ].filter(Boolean);

                    const bestImage = candidates.find(u => !isLowResUrl(u)) || candidates[0];

                    if (bestImage && !isLowResUrl(bestImage)) {
                        for (const idx of adIndexes) {
                            ads[idx].thumbnail = bestImage;
                        }
                        upgraded++;
                    }
                }
                console.log(`[API:ADS] 🎨 Creative images: ${upgraded}/${creativeMap.size} upgraded to hi-res`);
            } catch (err) {
                console.warn('[API:ADS] ⚠️ Failed to fetch creative images:', err);
            }
        }

        // Log final image resolution stats
        const hiRes = ads.filter((a: { thumbnail: string | null }) => {
            return !isLowResUrl(a.thumbnail || '');
        }).length;
        console.log(`[API:ADS] 📊 Image quality: ${hiRes}/${ads.length} ads have hi-res images`);

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
