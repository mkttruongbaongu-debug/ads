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

        // Fetch Page Access Tokens — needed to read page posts (bypasses pages_read_engagement Advanced Access)
        // Page Tokens have inherent permission to read their own posts
        const pageTokenMap = new Map<string, string>();
        try {
            const pagesRes = await fetch(
                `${FB_API_BASE}/me/accounts?fields=id,access_token&limit=100&access_token=${accessToken}`
            );
            const pagesData = await pagesRes.json();
            if (pagesData.data) {
                for (const page of pagesData.data) {
                    if (page.id && page.access_token) {
                        pageTokenMap.set(page.id, page.access_token);
                    }
                }
            }
            console.log(`[API:ADS] 🔑 Page tokens: ${pageTokenMap.size} pages`);
        } catch (err) {
            console.warn('[API:ADS] ⚠️ Could not fetch page tokens:', err);
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
                    link_data?: { message?: string; link?: string; image_hash?: string; picture?: string; child_attachments?: Array<{ picture?: string; image_hash?: string; link?: string }> };
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

            // Use full image — ưu tiên effective_image_url (ad-level) > image_url > link_data > thumbnail
            // effective_image_url returns ~720px, image_url varies, thumbnail_url is only ~64px
            let imageUrl = ad.effective_image_url
                || ad.creative?.image_url
                || storySpec?.video_data?.image_url
                || storySpec?.photo_data?.url
                || null;

            // Extract child_attachments for carousel from object_story_spec
            const childAttachments = storySpec?.link_data?.child_attachments || [];
            const linkDataPicture = storySpec?.link_data?.picture || null;

            // If no high-res URL yet, try link_data.picture (may have full-res)
            if (!imageUrl && linkDataPicture) {
                imageUrl = extractHighResUrl(linkDataPicture);
            }

            // Last resort: thumbnail_url
            if (!imageUrl) {
                imageUrl = ad.creative?.thumbnail_url || null;
            }

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

            // Build carousel thumbnails from child_attachments
            let carouselThumbnails: string[] = [];
            if (childAttachments.length > 1) {
                carouselThumbnails = childAttachments
                    .map((c: any) => c.picture ? extractHighResUrl(c.picture) : null)
                    .filter((u: string | null): u is string => u !== null);
                // Use first carousel image as main thumbnail if current is low-res
                if (carouselThumbnails.length > 0 && imageUrl?.includes('p64x64')) {
                    imageUrl = carouselThumbnails[0];
                }
            }

            return {
                id: ad.id,
                name: ad.name,
                status: ad.status,
                thumbnail: imageUrl,
                thumbnails: carouselThumbnails.length > 1 ? carouselThumbnails : undefined,
                creativeId: ad.creative?.id,
                imageHash: ad.creative?.image_hash || storySpec?.link_data?.image_hash || null,
                message,
                link,
                postUrl,
                _debug: {
                    step1_effective_image_url: ad.effective_image_url || null,
                    step1_creative_image_url: ad.creative?.image_url || null,
                    step1_creative_thumbnail_url: ad.creative?.thumbnail_url || null,
                    step1_video_image_url: storySpec?.video_data?.image_url || null,
                    step1_photo_url: storySpec?.photo_data?.url || null,
                    step1_link_data_picture: linkDataPicture,
                    step1_child_attachments_count: childAttachments.length,
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
            // Group storyIds by pageId so we use the correct Page Token for each
            const pageGroups = new Map<string, { storyId: string; adIndexes: number[] }[]>();
            for (const [storyId, adIndexes] of storyIdMap) {
                const pageId = storyId.split('_')[0];
                if (!pageGroups.has(pageId)) pageGroups.set(pageId, []);
                pageGroups.get(pageId)!.push({ storyId, adIndexes });
            }

            for (const [pageId, stories] of pageGroups) {
                // Use Page Token if available, fallback to user token
                const token = pageTokenMap.get(pageId) || accessToken;
                const tokenType = pageTokenMap.has(pageId) ? 'page' : 'user';
                try {
                    const storyIds = stories.map(s => s.storyId).join(',');
                    const postRes = await fetch(
                        `${FB_API_BASE}/?ids=${storyIds}&fields=full_picture,attachments{media{image{src,height,width}},subattachments{media{image{src,height,width}}}}&access_token=${token}`
                    );
                    const postData = await postRes.json();

                    for (const { storyId, adIndexes } of stories) {
                        const postInfo = postData[storyId];
                        if (!postInfo || postInfo.error) {
                            for (const idx of adIndexes) {
                                if (ads[idx]._debug) {
                                    ads[idx]._debug.step2 = postInfo?.error ? 'POST_ERROR' : 'NOT_FOUND';
                                    ads[idx]._debug.step2_token = tokenType;
                                    if (postInfo?.error) ads[idx]._debug.step2_error = `${postInfo.error.code}: ${postInfo.error.message?.substring(0, 80)}`;
                                }
                            }
                            continue;
                        }

                        const attachment = postInfo.attachments?.data?.[0];
                        const subs = attachment?.subattachments?.data || [];

                        // Multiple images: collect ALL subattachment images
                        if (subs.length > 1) {
                            const allImages: string[] = [];
                            for (const sub of subs) {
                                if (sub?.media?.image?.src) {
                                    allImages.push(extractHighResUrl(sub.media.image.src));
                                }
                            }
                            if (allImages.length > 0) {
                                for (const idx of adIndexes) {
                                    ads[idx].thumbnails = allImages;
                                    ads[idx].thumbnail = allImages[0];
                                    if (ads[idx]._debug) {
                                        ads[idx]._debug.step2 = 'multi';
                                        ads[idx]._debug.step2_count = allImages.length;
                                        ads[idx]._debug.step2_token = tokenType;
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
                                        ads[idx]._debug.step2_token = tokenType;
                                    }
                                }
                            } else {
                                for (const idx of adIndexes) {
                                    if (ads[idx]._debug) {
                                        ads[idx]._debug.step2 = 'NO_IMAGE';
                                        ads[idx]._debug.step2_token = tokenType;
                                        ads[idx]._debug.step2_full_picture = postInfo.full_picture || null;
                                        ads[idx]._debug.step2_post_keys = Object.keys(postInfo);
                                    }
                                }
                            }
                        }
                    }
                    console.log(`[API:ADS] 🖼️ STEP 2: Page ${pageId} (${tokenType} token) — ${stories.length} posts`);
                } catch (err) {
                    console.warn(`[API:ADS] ⚠️ STEP 2 failed for page ${pageId}:`, err);
                }
            }
        }

        // ===================================================================
        // STEP 2.5: HD thumbnails + multi-image via Creative API
        // 1) Fetch creative with object_story_spec → find child_attachments
        // 2) If image_hashes found → AdImage API for full URLs (Marketing API, no page perms needed)
        // 3) Fallback: thumbnail_url with thumbnail_width=1080 for single images
        // ===================================================================
        const lowResOrNoCarousel: Array<{ idx: number; creativeId: string }> = [];
        ads.forEach((ad: any, idx: number) => {
            if (videoAdIndexes.has(idx)) return;
            const thumb = ad.thumbnail || '';
            const needsHD = thumb.includes('p64x64') || thumb.includes('dst-emg0') || thumb.includes('_s.') || !thumb || thumb.length < 50;
            const noCarousel = !ad.thumbnails || ad.thumbnails.length <= 1;
            if (needsHD || noCarousel) {
                const creativeId = ad.creativeId;
                if (creativeId) {
                    lowResOrNoCarousel.push({ idx, creativeId });
                }
            }
        });

        if (lowResOrNoCarousel.length > 0) {
            console.log(`[API:ADS] 🔍 STEP 2.5: ${lowResOrNoCarousel.length} ads — fetching HD + multi-image via Creative API`);
            let upgraded25 = 0;
            let carouselFound = 0;

            // Collect image_hashes to batch-fetch via AdImage API
            const hashToAdIndexes = new Map<string, number[]>();

            await Promise.allSettled(
                lowResOrNoCarousel.map(async ({ idx, creativeId }) => {
                    try {
                        const res = await fetch(
                            `${FB_API_BASE}/${creativeId}?fields=thumbnail_url,object_story_spec&thumbnail_width=1080&access_token=${accessToken}`
                        );
                        const data = await res.json();

                        if (data.error) {
                            if (ads[idx]._debug) {
                                ads[idx]._debug.step25 = 'CREATIVE_ERROR';
                                ads[idx]._debug.step25_error = `${data.error.code}: ${data.error.message?.substring(0, 80)}`;
                            }
                            return;
                        }

                        // Check for carousel / multi-image in object_story_spec
                        const spec = data.object_story_spec;
                        const childAttachments = spec?.link_data?.child_attachments || [];

                        if (childAttachments.length > 1) {
                            // Carousel: collect image_hashes and pictures
                            const pictures: string[] = [];
                            const hashes: string[] = [];
                            for (const child of childAttachments) {
                                if (child.picture) pictures.push(child.picture);
                                if (child.image_hash) {
                                    hashes.push(child.image_hash);
                                    if (!hashToAdIndexes.has(child.image_hash)) hashToAdIndexes.set(child.image_hash, []);
                                    hashToAdIndexes.get(child.image_hash)!.push(idx);
                                }
                            }

                            if (pictures.length > 1) {
                                ads[idx].thumbnails = pictures.map(p => extractHighResUrl(p));
                                ads[idx].thumbnail = ads[idx].thumbnails[0];
                                if (ads[idx]._debug) {
                                    ads[idx]._debug.step25 = 'carousel_spec';
                                    ads[idx]._debug.step25_count = pictures.length;
                                    ads[idx]._debug.step25_hashes = hashes.length;
                                }
                                carouselFound++;
                                upgraded25++;
                                return; // Done — got carousel images
                            }

                            // Has hashes but no pictures — will batch-fetch via AdImage API below
                            if (hashes.length > 1) {
                                ads[idx]._debug_pending_hashes = hashes;
                                if (ads[idx]._debug) {
                                    ads[idx]._debug.step25 = 'carousel_hashes_pending';
                                    ads[idx]._debug.step25_hash_count = hashes.length;
                                }
                                return;
                            }
                        }

                        // Single image: use HD thumbnail
                        const hdUrl = data.thumbnail_url;
                        if (hdUrl && !hdUrl.includes('p64x64')) {
                            ads[idx].thumbnail = hdUrl;
                            if (ads[idx]._debug) {
                                ads[idx]._debug.step25 = 'creative_hd';
                                ads[idx]._debug.step25_url = hdUrl;
                            }
                            upgraded25++;
                        } else if (ads[idx]._debug) {
                            ads[idx]._debug.step25 = hdUrl ? 'STILL_LOW_RES' : 'NO_URL';
                            ads[idx]._debug.step25_url = hdUrl || null;
                        }
                    } catch (err: any) {
                        if (ads[idx]._debug) {
                            ads[idx]._debug.step25 = 'FETCH_ERROR';
                            ads[idx]._debug.step25_error = err?.message?.substring(0, 80) || 'unknown';
                        }
                    }
                })
            );

            // Batch fetch image_hashes via AdImage API (if any pending)
            if (hashToAdIndexes.size > 0 && adAccountId) {
                let hashUrlMap: Map<string, string> | undefined;
                try {
                    const allHashes = Array.from(hashToAdIndexes.keys());
                    const hashParam = JSON.stringify(allHashes);
                    const imgRes = await fetch(
                        `${FB_API_BASE}/${adAccountId}/adimages?hashes=${encodeURIComponent(hashParam)}&fields=hash,url_128,url&access_token=${accessToken}`
                    );
                    const imgData = await imgRes.json();

                    if (imgData.data) {
                        // Build hash → url map
                        hashUrlMap = new Map<string, string>();
                        for (const img of imgData.data) {
                            if (img.hash && (img.url || img.url_128)) {
                                hashUrlMap.set(img.hash, img.url || img.url_128);
                            }
                        }

                        // Apply to ads with pending hashes
                        for (const ad of ads as any[]) {
                            if (ad._debug_pending_hashes && hashUrlMap) {
                                const urls = ad._debug_pending_hashes
                                    .map((h: string) => hashUrlMap!.get(h))
                                    .filter((u: string | undefined): u is string => !!u);
                                if (urls.length > 1) {
                                    ad.thumbnails = urls;
                                    ad.thumbnail = urls[0];
                                    if (ad._debug) {
                                        ad._debug.step25 = 'carousel_adimage';
                                        ad._debug.step25_count = urls.length;
                                    }
                                    carouselFound++;
                                    upgraded25++;
                                }
                                delete ad._debug_pending_hashes;
                            }
                        }
                    }
                    console.log(`[API:ADS] 🖼️ STEP 2.5 AdImage: ${hashUrlMap?.size ?? 0} hashes resolved`);
                } catch (err) {
                    console.warn(`[API:ADS] ⚠️ STEP 2.5 AdImage API failed:`, err);
                }
            }

            console.log(`[API:ADS] 🖼️ STEP 2.5: ${upgraded25} upgraded, ${carouselFound} carousels found`);
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
