import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/facebook/token';

const FB_API_VERSION = 'v21.0';
const FB_API_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

/**
 * Extract original full-res URL from Facebook's safe_image.php proxy URLs.
 * safe_image.php URLs return low-res (~200px) thumbnails.
 * The actual high-res URL is embedded in the `url` query parameter.
 * Falls back to the original URL if not a safe_image.php URL.
 */
function extractHighResUrl(url: string): string {
    if (!url) return url;
    try {
        // Pattern 1: https://external.xx.fbcdn.net/safe_image.php?d=xxx&url=ENCODED_URL
        if (url.includes('safe_image.php')) {
            const parsed = new URL(url);
            const originalUrl = parsed.searchParams.get('url');
            if (originalUrl) return originalUrl;
        }
        // Pattern 2: https://external-*.fbcdn.net/emg1/...?url=ENCODED_URL 
        // Facebook's emg proxy also embeds original URL in `url` param
        if ((url.includes('/emg1/') || url.includes('/emg/') || url.includes('external-')) && url.includes('url=')) {
            const parsed = new URL(url);
            const originalUrl = parsed.searchParams.get('url');
            if (originalUrl && !originalUrl.includes('p64x64')) return originalUrl;
        }
    } catch { /* ignore parse errors */ }
    return url;
}

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

        // Fetch account_id for AdImage API (STEP 5)
        let adAccountId = '';
        try {
            const campaignRes = await fetch(
                `${FB_API_BASE}/${campaignId}?fields=account_id&access_token=${accessToken}`
            );
            const campaignMeta = await campaignRes.json();
            if (campaignMeta.account_id) {
                adAccountId = `act_${campaignMeta.account_id}`;
                console.log(`[API:ADS] 🔑 Account ID: ${adAccountId}`);
            }
        } catch (err) {
            console.warn('[API:ADS] ⚠️ Could not fetch account_id:', err);
        }

        // Fetch ads with daily insights and creative info
        // video_id needed to batch-fetch hi-res video thumbnails
        // image_hash needed for AdImage API fallback (STEP 5)
        const adsRes = await fetch(
            `${FB_API_BASE}/${campaignId}/ads?` +
            `fields=id,name,status,effective_object_story_id,effective_image_url,` +
            `creative{id,thumbnail_url,image_url,image_hash,video_id,body,object_story_spec,effective_object_story_id},` +
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
                image_hash?: string; // Added image_hash
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
                // NOTE: DO NOT modify stp= param (p64x64→p720x720): URLs are signed with `oh=`,
                // changing any param invalidates the signature → 403 Forbidden
            }

            return {
                id: ad.id,
                name: ad.name,
                status: ad.status,
                thumbnail: imageUrl,
                creativeId: ad.creative?.id,
                imageHash: ad.creative?.image_hash || null,
                message,
                link,
                postUrl,
                _debug: {
                    step1_effective_image_url: ad.effective_image_url || null,
                    step1_creative_image_url: ad.creative?.image_url || null,
                    step1_creative_thumbnail_url: ad.creative?.thumbnail_url || null,
                    step1_video_image_url: storySpec?.video_data?.image_url || null,
                    step1_photo_url: storySpec?.photo_data?.url || null,
                    step1_final: imageUrl,
                    step1_image_hash: ad.creative?.image_hash || storySpec?.link_data?.image_hash || null,
                    hasStoryId: !!(ad.effective_object_story_id || ad.creative?.effective_object_story_id),
                    hasVideoId: !!(ad.creative?.video_id || storySpec?.video_data?.video_id),
                },
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
        // IMAGE UPGRADE PIPELINE
        // Strategy:
        //   Video ads → STEP 3 (video thumbnail, highest quality)
        //   Image/carousel → STEP 2 (post attachments) + STEP 4 (creative)
        //   Carousel ads → collect ALL images into thumbnails[]
        //
        // DO NOT trust effective_image_url — it often returns 64px
        // ===================================================================

        // ===================================================================
        // STEP 2: Batch fetch images from Facebook Posts
        // Fetches attachments + subattachments
        // For carousel: collects ALL images into thumbnails[]
        // ===================================================================
        const storyIdMap = new Map<string, number[]>();
        const videoAdIndexes = new Set<number>();
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

                for (const [storyId, adIndexes] of storyIdMap) {
                    const postInfo = postData[storyId];
                    if (!postInfo) continue;

                    const attachment = postInfo.attachments?.data?.[0];
                    const subs = attachment?.subattachments?.data || [];

                    // Carousel: collect ALL subattachment images (highest quality source)
                    if (subs.length > 1) {
                        const allImages: string[] = [];
                        for (const sub of subs) {
                            if (sub?.media?.image?.src) {
                                // Extract original URL from safe_image.php proxy for full resolution
                                allImages.push(extractHighResUrl(sub.media.image.src));
                            }
                        }
                        if (allImages.length > 0) {
                            for (const idx of adIndexes) {
                                ads[idx].thumbnails = allImages;
                                ads[idx].thumbnail = allImages[0];
                                if (ads[idx]._debug) {
                                    ads[idx]._debug.step2 = 'carousel';
                                    ads[idx]._debug.step2_count = allImages.length;
                                    ads[idx]._debug.step2_urls = allImages;
                                }
                            }
                        }
                    } else {
                        // Single image: use attachment or full_picture
                        const rawImage = attachment?.media?.image?.src || postInfo.full_picture;
                        const bestImage = rawImage ? extractHighResUrl(rawImage) : null;
                        if (bestImage) {
                            for (const idx of adIndexes) {
                                ads[idx].thumbnail = bestImage;
                                if (ads[idx]._debug) {
                                    ads[idx]._debug.step2 = 'single';
                                    ads[idx]._debug.step2_url = bestImage;
                                    ads[idx]._debug.step2_full_picture = postInfo.full_picture || null;
                                    ads[idx]._debug.step2_attachment_src = attachment?.media?.image?.src || null;
                                }
                            }
                        } else {
                            // Debug: STEP 2 found post but no usable image
                            for (const idx of adIndexes) {
                                if (ads[idx]._debug) {
                                    ads[idx]._debug.step2 = 'NO_IMAGE';
                                    ads[idx]._debug.step2_full_picture = postInfo.full_picture || null;
                                    ads[idx]._debug.step2_attachment_src = attachment?.media?.image?.src || null;
                                    ads[idx]._debug.step2_has_attachment = !!attachment;
                                    ads[idx]._debug.step2_sub_count = subs.length;
                                    ads[idx]._debug.step2_post_keys = Object.keys(postInfo);
                                }
                            }
                        }
                    }
                }
                console.log(`[API:ADS] 🖼️ STEP 2: Fetched ${storyIdMap.size} post images`);
            } catch (err) {
                console.warn('[API:ADS] ⚠️ STEP 2 failed:', err);
            }
        }

        // ===================================================================
        // STEP 2.5: Ad Preview API for ads STILL with p64x64 URLs
        // Uses /{adId}/previews — only needs ads_read permission (no pages_read_engagement)
        // Parses HTML preview to extract full-res image URLs
        // ===================================================================
        const lowResAdsForStep25: Array<{ idx: number; adId: string }> = [];
        ads.forEach((ad: any, idx: number) => {
            if (videoAdIndexes.has(idx)) return;
            const thumb = ad.thumbnail || '';
            if (thumb.includes('p64x64') || thumb.includes('dst-emg0') || thumb.includes('_s.') || !thumb || thumb.length < 50) {
                lowResAdsForStep25.push({ idx, adId: ad.id });
            }
        });

        if (lowResAdsForStep25.length > 0) {
            console.log(`[API:ADS] 🔍 STEP 2.5: ${lowResAdsForStep25.length} ads still low-res, trying Ad Preview API`);
            let upgraded25 = 0;
            const results = await Promise.allSettled(
                lowResAdsForStep25.map(async ({ idx, adId }) => {
                    try {
                        const res = await fetch(
                            `${FB_API_BASE}/${adId}/previews?ad_format=DESKTOP_FEED_STANDARD&access_token=${accessToken}`
                        );
                        const data = await res.json();

                        if (data.error) {
                            if (ads[idx]._debug) {
                                ads[idx]._debug.step25 = 'PREVIEW_ERROR';
                                ads[idx]._debug.step25_error = `${data.error.code}: ${data.error.message?.substring(0, 100)}`;
                            }
                            return;
                        }

                        const html = data.data?.[0]?.body || '';
                        if (!html) {
                            if (ads[idx]._debug) ads[idx]._debug.step25 = 'NO_HTML';
                            return;
                        }

                        // Extract all img src URLs from HTML preview
                        const imgRegex = /src="(https?:\/\/[^"]+)"/g;
                        const allUrls: string[] = [];
                        let match;
                        while ((match = imgRegex.exec(html)) !== null) {
                            let url = match[1]
                                .replace(/&amp;/g, '&')  // Decode HTML entities
                                .replace(/\\"/g, '"');
                            // Filter: only keep scontent/fbcdn image URLs, skip icons/emojis/logos
                            if ((url.includes('scontent') || url.includes('fbcdn')) &&
                                !url.includes('emoji') && !url.includes('rsrc.php') &&
                                !url.includes('/icons/') && !url.includes('logo')) {
                                // Skip if still 64px
                                if (!url.includes('p64x64') && !url.includes('s64x64')) {
                                    allUrls.push(url);
                                }
                            }
                        }

                        // Deduplicate
                        const uniqueUrls = [...new Set(allUrls)];

                        if (uniqueUrls.length > 1) {
                            // Carousel detected!
                            ads[idx].thumbnails = uniqueUrls;
                            ads[idx].thumbnail = uniqueUrls[0];
                            if (ads[idx]._debug) {
                                ads[idx]._debug.step25 = 'preview_carousel';
                                ads[idx]._debug.step25_count = uniqueUrls.length;
                            }
                            upgraded25++;
                        } else if (uniqueUrls.length === 1) {
                            // Single image
                            ads[idx].thumbnail = uniqueUrls[0];
                            if (ads[idx]._debug) {
                                ads[idx]._debug.step25 = 'preview_single';
                                ads[idx]._debug.step25_url = uniqueUrls[0];
                            }
                            upgraded25++;
                        } else if (ads[idx]._debug) {
                            ads[idx]._debug.step25 = 'NO_URLS_IN_HTML';
                            ads[idx]._debug.step25_html_length = html.length;
                            ads[idx]._debug.step25_html_snippet = html.substring(0, 300);
                        }
                    } catch (err: any) {
                        if (ads[idx]._debug) {
                            ads[idx]._debug.step25 = 'FETCH_ERROR';
                            ads[idx]._debug.step25_error = err?.message?.substring(0, 80) || 'unknown';
                        }
                    }
                })
            );
            console.log(`[API:ADS] 🖼️ STEP 2.5: ${upgraded25}/${lowResAdsForStep25.length} upgraded via Ad Preview API`);
        }

        // ===================================================================
        // STEP 3: Video thumbnails — ALWAYS runs for ALL video ads
        // Video thumbnail from /{video_id}?fields=picture,format is the
        // most reliable source for video ads (720px+ guaranteed)
        // This OVERRIDES any previous step for video ads
        // ===================================================================
        const videoMap = new Map<string, number[]>();
        ads.forEach((_ad: any, idx: number) => {
            const rawAd = (adsData.data || [])[idx];
            const videoId = rawAd?.creative?.video_id || rawAd?.creative?.object_story_spec?.video_data?.video_id;
            if (videoId) {
                videoAdIndexes.add(idx);
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

                    // Pick largest format, fallback to picture
                    let bestPic = '';
                    if (vidInfo.format && Array.isArray(vidInfo.format)) {
                        const sorted = [...vidInfo.format].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
                        bestPic = sorted[0]?.picture || '';
                    }
                    if (!bestPic) bestPic = vidInfo.picture || '';

                    if (bestPic) {
                        for (const idx of adIndexes) {
                            ads[idx].thumbnail = bestPic; // ALWAYS override for video
                            if (ads[idx]._debug) {
                                ads[idx]._debug.step3 = 'video';
                                ads[idx]._debug.step3_url = bestPic;
                            }
                        }
                        upgraded++;
                    }
                }
                console.log(`[API:ADS] 🎬 STEP 3: Video thumbnails ${upgraded}/${videoMap.size} upgraded`);
            } catch (err) {
                console.warn('[API:ADS] ⚠️ STEP 3 failed:', err);
            }
        }

        // ===================================================================
        // STEP 4: Creative images — for ALL non-video ads
        // Fetch /{creative_id}?fields=effective_image_url,image_url,
        //   object_story_spec{link_data{child_attachments}}
        // Always runs — OVERRIDES STEP 2 (which may have low-res images)
        // ===================================================================
        const creativeMap = new Map<string, number[]>();
        ads.forEach((ad: any, idx: number) => {
            if (videoAdIndexes.has(idx)) return; // Video already handled by STEP 3

            const rawAd = (adsData.data || [])[idx];
            const creativeId = ad.creativeId || rawAd?.creative?.id;
            if (creativeId) {
                if (!creativeMap.has(creativeId)) creativeMap.set(creativeId, []);
                creativeMap.get(creativeId)!.push(idx);
            }
        });

        // Collect image_hashes for STEP 5 fallback
        const imageHashMap = new Map<string, number[]>();

        if (creativeMap.size > 0) {
            try {
                const creativeIds = Array.from(creativeMap.keys()).join(',');
                const creativeRes = await fetch(
                    `${FB_API_BASE}/?ids=${creativeIds}&fields=effective_image_url,image_url,image_hash,object_story_spec{link_data{picture,image_hash,child_attachments{image_hash,picture}},photo_data{url}}&access_token=${accessToken}`
                );
                const creativeData = await creativeRes.json();

                let upgraded = 0;
                for (const [creativeId, adIndexes] of creativeMap) {
                    const info = creativeData[creativeId];
                    if (!info) continue;

                    // Collect image_hash for STEP 5 fallback
                    const hash = info.image_hash || info.object_story_spec?.link_data?.image_hash;
                    if (hash) {
                        if (!imageHashMap.has(hash)) imageHashMap.set(hash, []);
                        for (const idx of adIndexes) {
                            imageHashMap.get(hash)!.push(idx);
                        }
                    }

                    // Carousel: child_attachments have individual pictures
                    const childAttachments = info.object_story_spec?.link_data?.child_attachments || [];
                    if (childAttachments.length > 1) {
                        const carouselImages: string[] = childAttachments
                            .map((c: any) => c.picture ? extractHighResUrl(c.picture) : null)
                            .filter(Boolean);
                        if (carouselImages.length > 0) {
                            for (const idx of adIndexes) {
                                // STEP 2 subattachments are HIGHER quality — never override them
                                if (!ads[idx].thumbnails || ads[idx].thumbnails.length === 0) {
                                    ads[idx].thumbnails = carouselImages;
                                }
                                // Use first carousel image as main thumbnail (NOT effective_image_url which is often 64px)
                                ads[idx].thumbnail = ads[idx].thumbnails?.[0] || carouselImages[0];
                                if (ads[idx]._debug) {
                                    ads[idx]._debug.step4 = 'carousel';
                                    ads[idx]._debug.step4_count = carouselImages.length;
                                }
                            }
                            upgraded++;
                            continue;
                        }
                    }

                    // Single image — pick best source, extract from safe_image proxy
                    const rawBest = info.image_url
                        || info.object_story_spec?.photo_data?.url
                        || info.object_story_spec?.link_data?.picture
                        || info.effective_image_url; // effective_image_url last (often 64px)
                    const bestImage = rawBest ? extractHighResUrl(rawBest) : null;
                    if (bestImage) {
                        for (const idx of adIndexes) {
                            ads[idx].thumbnail = bestImage;
                            if (ads[idx]._debug) {
                                ads[idx]._debug.step4 = 'single';
                                ads[idx]._debug.step4_url = bestImage;
                                ads[idx]._debug.step4_image_url = info.image_url || null;
                                ads[idx]._debug.step4_photo_url = info.object_story_spec?.photo_data?.url || null;
                                ads[idx]._debug.step4_link_picture = info.object_story_spec?.link_data?.picture || null;
                                ads[idx]._debug.step4_effective = info.effective_image_url || null;
                            }
                        }
                        upgraded++;
                    }
                }
                console.log(`[API:ADS] 🎨 STEP 4: Creative images ${upgraded}/${creativeMap.size} upgraded`);
            } catch (err) {
                console.warn('[API:ADS] ⚠️ STEP 4 failed:', err);
            }
        }

        // Also collect image_hash from initial ad data (for ads skipped by STEP 4)
        ads.forEach((_ad: any, idx: number) => {
            if (videoAdIndexes.has(idx)) return;
            const rawAd = (adsData.data || [])[idx];
            const hash = rawAd?.creative?.image_hash || rawAd?.creative?.object_story_spec?.link_data?.image_hash;
            if (hash && !imageHashMap.has(hash)) {
                imageHashMap.set(hash, [idx]);
            }
        });

        // ===================================================================
        // STEP 5: AdImage API fallback — for ads STILL with low-res images
        // Fetches original uploaded images via image_hash
        // /{act_account_id}/adimages?hashes=['hash1','hash2',...]
        // Returns full-res `url` (temporary ~24h) and `permalink_url`
        // ===================================================================
        if (adAccountId && imageHashMap.size > 0) {
            // Find ads that still have low-res thumbnails (64px indicators)
            const lowResIndexes = new Set<number>();
            ads.forEach((ad: any, idx: number) => {
                if (videoAdIndexes.has(idx)) return;
                const thumb = ad.thumbnail || '';
                // Detect 64px images: fbcdn URLs with /s64x64/ or /p64x64/ or very short URLs
                if (!thumb || thumb.includes('/s64x64/') || thumb.includes('/p64x64/') || thumb.includes('_s.') || thumb.length < 50) {
                    lowResIndexes.add(idx);
                }
            });

            if (lowResIndexes.size > 0) {
                // Collect hashes only for low-res ads
                const hashesNeeded = new Map<string, number[]>();
                for (const [hash, indexes] of imageHashMap) {
                    const needUpgrade = indexes.filter(i => lowResIndexes.has(i));
                    if (needUpgrade.length > 0) {
                        hashesNeeded.set(hash, needUpgrade);
                    }
                }

                if (hashesNeeded.size > 0) {
                    try {
                        const hashArray = Array.from(hashesNeeded.keys());
                        const hashParam = encodeURIComponent(JSON.stringify(hashArray));
                        const adImageRes = await fetch(
                            `${FB_API_BASE}/${adAccountId}/adimages?hashes=${hashParam}&fields=hash,url,permalink_url,original_height,original_width&access_token=${accessToken}`
                        );
                        const adImageData = await adImageRes.json();
                        const images = adImageData.data || [];

                        let upgraded = 0;
                        for (const img of images) {
                            const hash = img.hash;
                            const fullUrl = img.permalink_url || img.url;
                            if (hash && fullUrl && hashesNeeded.has(hash)) {
                                const adIndexes = hashesNeeded.get(hash)!;
                                for (const idx of adIndexes) {
                                    ads[idx].thumbnail = fullUrl;
                                    if (ads[idx]._debug) {
                                        ads[idx]._debug.step5 = 'adimage';
                                        ads[idx]._debug.step5_url = fullUrl;
                                        ads[idx]._debug.step5_permalink = img.permalink_url || null;
                                        ads[idx]._debug.step5_temp_url = img.url || null;
                                        ads[idx]._debug.step5_original_size = `${img.original_width || '?'}x${img.original_height || '?'}`;
                                    }
                                }
                                upgraded++;
                            }
                        }
                        console.log(`[API:ADS] 🖼️ STEP 5: AdImage API ${upgraded}/${hashesNeeded.size} upgraded (${lowResIndexes.size} were low-res)`);
                    } catch (err) {
                        console.warn('[API:ADS] ⚠️ STEP 5 AdImage fallback failed:', err);
                    }
                }
            }
        }

        // Record final_url in _debug for every ad
        ads.forEach((ad: any) => {
            if (ad._debug) {
                ad._debug.final_url = ad.thumbnail || null;
                ad._debug.has_carousel = !!(ad.thumbnails && ad.thumbnails.length > 1);
                ad._debug.carousel_count = ad.thumbnails?.length || 0;
            }
        });

        // Log final stats + debug low-res detection
        const withCarousel = ads.filter((a: any) => a.thumbnails?.length > 1).length;
        const stillLowRes = ads.filter((ad: any) => {
            const t = ad.thumbnail || '';
            return !t || t.includes('/s64x64/') || t.includes('/p64x64/') || t.includes('_s.') || t.length < 50;
        }).length;
        console.log(`[API:ADS] 📊 Final: ${ads.length} ads, ${withCarousel} carousel, ${videoAdIndexes.size} video, ${stillLowRes} still-low-res`);
        if (stillLowRes > 0) {
            ads.forEach((ad: any, idx: number) => {
                const t = ad.thumbnail || '';
                if (!t || t.includes('/s64x64/') || t.includes('/p64x64/') || t.includes('_s.') || t.length < 50) {
                    console.log(`[API:ADS] ⚠️ LOW-RES #${idx}: name="${ad.name}", thumb="${t.substring(0, 100)}"`);
                }
            });
        }

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
