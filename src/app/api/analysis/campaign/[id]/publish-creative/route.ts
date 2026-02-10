/**
 * ===================================================================
 * API: PUBLISH CREATIVE TO FACEBOOK
 * ===================================================================
 * Route: POST /api/analysis/campaign/[id]/publish-creative
 *
 * Input: caption, image (base64), adSetId
 * Output: { adId, creativeId, status }
 *
 * Pipeline:
 * 1. Get ad account ID from campaign
 * 2. Upload image → Facebook Ad Image (get image_hash)
 * 3. Create Ad Creative (caption + image + page_id)
 * 4. Create Ad under the specified Ad Set (PAUSED)
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/facebook/token';

const FB_API_VERSION = 'v21.0';
const FB_API_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: campaignId } = await params;
        const body = await request.json();
        const { caption, image, adSetId, adName } = body;

        if (!caption || !image || !adSetId) {
            return NextResponse.json(
                { success: false, error: 'caption, image (base64), and adSetId are required' },
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

        console.log(`[PUBLISH_CREATIVE] 🚀 Campaign ${campaignId}, AdSet ${adSetId}`);

        // ─── Step 1: Get ad account ID + page ID from campaign ────────
        console.log('[PUBLISH_CREATIVE] 📋 Step 1: Getting campaign info...');
        const campaignRes = await fetch(
            `${FB_API_BASE}/${campaignId}?fields=account_id,name&access_token=${accessToken}`
        );
        const campaignData = await campaignRes.json();

        if (campaignData.error) {
            return NextResponse.json(
                { success: false, error: `Campaign error: ${campaignData.error.message}` },
                { status: 400 }
            );
        }

        const adAccountId = `act_${campaignData.account_id}`;
        console.log(`[PUBLISH_CREATIVE] 📋 Ad Account: ${adAccountId}`);

        // Get page_id from the ad account's promoted pages
        const pagesRes = await fetch(
            `${FB_API_BASE}/${adAccountId}/promote_pages?access_token=${accessToken}`
        );
        const pagesData = await pagesRes.json();
        const pageId = pagesData.data?.[0]?.id;

        if (!pageId) {
            // Fallback: try to get page from existing ads in this campaign
            const existingAdsRes = await fetch(
                `${FB_API_BASE}/${campaignId}/ads?fields=creative{object_story_spec}&limit=1&access_token=${accessToken}`
            );
            const existingAdsData = await existingAdsRes.json();
            const fallbackPageId = existingAdsData.data?.[0]?.creative?.object_story_spec?.page_id;

            if (!fallbackPageId) {
                return NextResponse.json(
                    { success: false, error: 'Không tìm được Page ID. Kiểm tra quyền truy cập.' },
                    { status: 400 }
                );
            }
            console.log(`[PUBLISH_CREATIVE] 📋 Page ID (fallback): ${fallbackPageId}`);
            var resolvedPageId = fallbackPageId;
        } else {
            console.log(`[PUBLISH_CREATIVE] 📋 Page ID: ${pageId}`);
            var resolvedPageId = pageId;
        }

        // ─── Step 2: Upload image ────────────────────────────────────
        console.log('[PUBLISH_CREATIVE] 🖼️ Step 2: Uploading image...');

        // Extract base64 data (remove data:image/...;base64, prefix if present)
        const base64Data = image.replace(/^data:image\/[^;]+;base64,/, '');

        const uploadForm = new FormData();
        // Convert base64 to blob
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
        uploadForm.append('filename', imageBlob, 'creative-studio.png');
        uploadForm.append('access_token', accessToken);

        const uploadRes = await fetch(
            `${FB_API_BASE}/${adAccountId}/adimages`,
            { method: 'POST', body: uploadForm }
        );
        const uploadData = await uploadRes.json();

        if (uploadData.error) {
            return NextResponse.json(
                { success: false, error: `Image upload error: ${uploadData.error.message}` },
                { status: 400 }
            );
        }

        // Get image hash from response
        const imageHash = Object.values(uploadData.images || {})[0] as any;
        if (!imageHash?.hash) {
            console.error('[PUBLISH_CREATIVE] ❌ Upload response:', JSON.stringify(uploadData));
            return NextResponse.json(
                { success: false, error: 'Không thể upload ảnh lên Facebook' },
                { status: 500 }
            );
        }

        console.log(`[PUBLISH_CREATIVE] ✅ Image uploaded, hash: ${imageHash.hash}`);

        // ─── Step 3: Create Ad Creative ──────────────────────────────
        console.log('[PUBLISH_CREATIVE] 🎨 Step 3: Creating ad creative...');

        const creativeForm = new URLSearchParams();
        creativeForm.append('name', adName || `Creative Studio - ${new Date().toLocaleDateString('vi-VN')}`);
        creativeForm.append('object_story_spec', JSON.stringify({
            page_id: resolvedPageId,
            link_data: {
                message: caption,
                image_hash: imageHash.hash,
                link: `https://www.facebook.com/${resolvedPageId}`,
                call_to_action: {
                    type: 'MESSAGE_PAGE',
                },
            },
        }));
        creativeForm.append('access_token', accessToken);

        const creativeRes = await fetch(
            `${FB_API_BASE}/${adAccountId}/adcreatives`,
            {
                method: 'POST',
                body: creativeForm,
            }
        );
        const creativeData = await creativeRes.json();

        if (creativeData.error) {
            return NextResponse.json(
                { success: false, error: `Creative error: ${creativeData.error.message}` },
                { status: 400 }
            );
        }

        const creativeId = creativeData.id;
        console.log(`[PUBLISH_CREATIVE] ✅ Creative created: ${creativeId}`);

        // ─── Step 4: Create Ad (PAUSED) ──────────────────────────────
        console.log('[PUBLISH_CREATIVE] 📢 Step 4: Creating ad (PAUSED)...');

        const adForm = new URLSearchParams();
        adForm.append('name', adName || `CS ${new Date().toLocaleDateString('vi-VN')} - ${caption.substring(0, 30)}...`);
        adForm.append('adset_id', adSetId);
        adForm.append('creative', JSON.stringify({ creative_id: creativeId }));
        adForm.append('status', 'PAUSED');
        adForm.append('access_token', accessToken);

        const adRes = await fetch(
            `${FB_API_BASE}/${adAccountId}/ads`,
            {
                method: 'POST',
                body: adForm,
            }
        );
        const adData = await adRes.json();

        if (adData.error) {
            return NextResponse.json(
                { success: false, error: `Ad creation error: ${adData.error.message}` },
                { status: 400 }
            );
        }

        console.log(`[PUBLISH_CREATIVE] 🎉 Ad created: ${adData.id} (PAUSED)`);

        return NextResponse.json({
            success: true,
            data: {
                adId: adData.id,
                creativeId,
                imageHash: imageHash.hash,
                status: 'PAUSED',
                message: 'Ad đã tạo ở trạng thái TẠM DỪNG. Bật thủ công khi sẵn sàng.',
            },
        });

    } catch (error) {
        console.error('[PUBLISH_CREATIVE] ❌', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
