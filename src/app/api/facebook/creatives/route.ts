// API Route: Get Ad Creatives with content (caption, image, video)

import { NextRequest, NextResponse } from 'next/server';
import { getDynamicFacebookClient } from '@/lib/facebook/client';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const accountId = searchParams.get('accountId');
        const includeVideoDetails = searchParams.get('includeVideo') === 'true';

        if (!accountId) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameter: accountId' },
                { status: 400 }
            );
        }

        const fbClient = await getDynamicFacebookClient();

        // Lấy ads với creative content
        const ads = await fbClient.getAdsWithCreative(accountId);

        // Parse và format creative data
        const creatives = await Promise.all(ads.map(async (ad) => {
            const creative = ad.creative || {};

            // Extract caption/body from different sources
            let caption = creative.body || '';
            let title = creative.title || '';
            let imageUrl = creative.image_url || creative.thumbnail_url || '';
            let videoUrl = '';
            let videoId = creative.video_id || '';

            // Try to extract from object_story_spec if available
            const storySpec = creative.object_story_spec as {
                link_data?: { message?: string; name?: string; description?: string };
                video_data?: { message?: string; title?: string; image_url?: string };
                photo_data?: { message?: string };
            } | undefined;

            if (storySpec) {
                if (storySpec.link_data) {
                    caption = caption || storySpec.link_data.message || '';
                    title = title || storySpec.link_data.name || '';
                }
                if (storySpec.video_data) {
                    caption = caption || storySpec.video_data.message || '';
                    title = title || storySpec.video_data.title || '';
                    imageUrl = imageUrl || storySpec.video_data.image_url || '';
                }
                if (storySpec.photo_data) {
                    caption = caption || storySpec.photo_data.message || '';
                }
            }

            // Fetch video details if requested and video_id exists
            if (includeVideoDetails && videoId) {
                try {
                    const videoDetails = await fbClient.getVideoDetails(videoId);
                    videoUrl = videoDetails.source || videoDetails.permalink_url || '';
                    if (!imageUrl) {
                        imageUrl = videoDetails.picture || '';
                    }
                } catch (e) {
                    console.warn(`Failed to fetch video ${videoId}:`, e);
                }
            }

            return {
                ad_id: ad.id,
                ad_name: ad.name,
                ad_status: ad.status,
                campaign_id: ad.campaign_id,
                campaign_name: ad.campaign_name,
                adset_id: ad.adset_id,
                adset_name: ad.adset_name,

                // Creative content
                creative_id: creative.id || '',
                title,
                caption,
                cta: creative.call_to_action_type || '',
                link_url: creative.link_url || '',

                // Media
                image_url: imageUrl,
                thumbnail_url: creative.thumbnail_url || '',
                video_id: videoId,
                video_url: videoUrl,

                // Type detection
                content_type: videoId ? 'VIDEO' : imageUrl ? 'IMAGE' : 'UNKNOWN',
            };
        }));

        return NextResponse.json({
            success: true,
            data: creatives,
            count: creatives.length,
        });
    } catch (error) {
        console.error('Creatives fetch error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
