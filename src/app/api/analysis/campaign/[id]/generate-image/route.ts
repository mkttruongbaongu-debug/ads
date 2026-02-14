/**
 * ===================================================================
 * API: GENERATE SINGLE IMAGE
 * ===================================================================
 * Route: POST /api/analysis/campaign/[id]/generate-image
 *
 * Input: { prompt, referenceImageUrl, imageCount }
 * Output: { success, data: base64ImageUrl } or { success: false, error }
 *
 * Separated from generate-creative to avoid HTTP/2 stream size limits
 * when streaming multiple large base64 images through NDJSON.
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';

// Extend serverless timeout
export const maxDuration = 120; // 2 minutes per image

// ─── Helpers ─────────────────────────────────────────────────────────

function getAspectRatioSpec(imageCount: number): { ratio: string; resolution: string; instruction: string } {
    switch (imageCount) {
        case 2:
            return { ratio: '4:5', resolution: '1080x1350', instruction: 'PORTRAIT 4:5 aspect ratio (1080x1350px). Two images will display as vertical columns side by side on Facebook feed.' };
        case 4:
            return { ratio: '1:1', resolution: '1080x1080', instruction: 'SQUARE 1:1 aspect ratio (1080x1080px). Four images will display as a 2x2 grid on Facebook feed.' };
        default:
            return { ratio: '4:5', resolution: '1080x1350', instruction: 'PORTRAIT 4:5 aspect ratio (1080x1350px). Single image maximizes vertical screen real estate on mobile Facebook feed.' };
    }
}

async function downloadImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, {
            signal: controller.signal,
            redirect: 'follow',
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const mimeType = contentType.split(';')[0].trim();
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return { data: base64, mimeType };
    } catch {
        return null;
    }
}

async function generateImage(
    apiKey: string,
    prompt: string,
    referenceImageUrl: string | null,
    imageCount: number,
): Promise<string | null> {
    const log = (msg: string) => console.log(msg);

    // Download reference image as base64
    let refBase64: { data: string; mimeType: string } | null = null;
    if (referenceImageUrl) {
        log(`[IMG] Downloading ref image: ${referenceImageUrl.substring(0, 80)}...`);
        refBase64 = await downloadImageAsBase64(referenceImageUrl);
        if (!refBase64) {
            log(`[IMG] ⚠️ Failed to download ref → generating WITHOUT reference`);
        } else {
            log(`[IMG] ✅ Ref downloaded (${Math.round(refBase64.data.length / 1024)}KB, ${refBase64.mimeType})`);
        }
    }

    // 3-attempt retry
    for (let attempt = 1; attempt <= 3; attempt++) {
        const useRef = attempt === 1 ? refBase64 : null;
        if (attempt === 2) log(`[IMG] 🔄 RETRY attempt 2 — generating WITHOUT reference image`);
        else if (attempt === 3) log(`[IMG] 🔄 RETRY attempt 3 — simplified prompt, no reference`);

        try {
            const aspectSpec = getAspectRatioSpec(imageCount);

            const effectivePrompt = attempt === 3
                ? `Generate a high-quality food photography image. ${prompt.substring(0, 200)}. Aspect ratio: ${aspectSpec.ratio} (${aspectSpec.resolution}).`
                : `You are creating an AUTHENTIC smartphone photo that looks like a REAL PERSON took it and posted on social media. This is for a Vietnamese Facebook ad.

CRITICAL IDENTITY: You are NOT a professional photographer. You are a REGULAR PERSON casually taking a quick photo with your phone to share with friends on Facebook. The photo should feel SPONTANEOUS and LIVED-IN.

⚠️ MANDATORY ASPECT RATIO: ${aspectSpec.instruction}
The image MUST be generated in ${aspectSpec.ratio} ratio (${aspectSpec.resolution}). This is NON-NEGOTIABLE.

${useRef ? `REFERENCE IMAGE: The attached image is the ORIGINAL winning ad photo. Your job is to create a NEW photo that:
- Has the SAME composition, angle, and framing as the reference
- Features the SAME type of product/subject in a SIMILAR setting
- Matches the SAME lighting conditions and color temperature
- Keeps the SAME mood and vibe
- But with ENOUGH variation that it looks like a DIFFERENT photo (different angle, slightly different items, etc.)
Think of it as: "Same person, same product, different day, different photo"` : 'No reference image available — create based on the prompt description only.'}

PHOTOGRAPHY BRIEF:
${prompt}

=== UGC / POV STYLE REQUIREMENTS (MOST IMPORTANT) ===

MUST HAVE — Signs of authenticity:
- Smartphone camera characteristics: slight noise/grain, natural phone lens depth of field
- IMPERFECT composition: subject slightly off-center, slightly tilted horizon, not perfectly framed
- REAL environment clutter: other objects visible (phone, keys, bag, cup, napkins, random items on table)
- NATURAL lighting from the actual environment: overhead fluorescent, window daylight, warm lamp, screen glow — whatever is realistic for the setting
- Human presence hints: a hand holding/touching the product, part of an arm, sleeve visible
- The scene should tell a story: someone is IN THE MIDDLE of using/experiencing the product

ABSOLUTELY FORBIDDEN — Dead giveaways of fake/staged photos:
- ❌ Perfect symmetry or centered composition — INSTANT red flag
- ❌ Studio lighting, softbox, rim light, any professional lighting setup
- ❌ Clean/empty/minimalist background — real life is messy
- ❌ Product floating on solid color background — that's e-commerce, not UGC
- ❌ Professional food/product styling with artistic garnish placement
- ❌ DSLR/mirrorless camera quality (too sharp, too perfect bokeh)
- ❌ Perfectly white-balanced, color-corrected look
- ❌ Any text, watermarks, logos, or overlays
- ❌ Surreal, fantasy, or obviously AI-generated elements
- ❌ "Magazine cover" or "editorial" aesthetic

THE ULTIMATE TEST: If someone scrolling Facebook would pause and think "this looks like a real person posted this, not an ad" — you succeeded.

OUTPUT: A single authentic-looking smartphone photo in ${aspectSpec.ratio} aspect ratio.`;

            const contentParts: any[] = [
                { type: 'text', text: effectivePrompt },
            ];

            if (useRef) {
                contentParts.push({
                    type: 'image_url',
                    image_url: { url: `data:${useRef.mimeType};base64,${useRef.data}` },
                });
            }

            log(`[IMG] Calling OpenRouter (attempt ${attempt}, ref=${useRef ? 'YES' : 'NO'})...`);

            const TIMEOUT_MS = 120_000;
            const abortCtrl = new AbortController();
            const timer = setTimeout(() => abortCtrl.abort(), TIMEOUT_MS);

            const rawRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://ads.supbaongu.vn',
                    'X-Title': 'THO ADS AI - Creative Studio',
                },
                body: JSON.stringify({
                    model: 'google/gemini-3-pro-image-preview',
                    messages: [{ role: 'user', content: contentParts }],
                    modalities: ['image', 'text'],
                    stream: true,
                }),
                signal: abortCtrl.signal,
            });
            clearTimeout(timer);

            log(`[IMG] Response status: ${rawRes.status}, content-type: ${rawRes.headers.get('content-type')}`);

            if (!rawRes.ok) {
                const errText = await rawRes.text().catch(() => '');
                log(`[IMG] ❌ OpenRouter HTTP ${rawRes.status}: ${errText.substring(0, 300)}`);
                throw new Error(`OpenRouter HTTP ${rawRes.status}`);
            }

            // Read SSE stream chunk by chunk
            const reader = rawRes.body?.getReader();
            if (!reader) throw new Error('No response body reader');

            const decoder = new TextDecoder();
            let buffer = '';
            let accumulatedContent = '';
            const accumulatedImages: any[] = [];
            let lastFinishReason = '';
            let chunkCount = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ')) continue;
                    const data = trimmed.substring(6);
                    if (data === '[DONE]') continue;

                    try {
                        const chunk = JSON.parse(data);
                        chunkCount++;
                        const choice = chunk?.choices?.[0];
                        const delta = choice?.delta;
                        if (choice?.finish_reason) lastFinishReason = choice.finish_reason;

                        if (!delta) continue;

                        if (typeof delta.content === 'string') {
                            accumulatedContent += delta.content;
                        }

                        if (Array.isArray(delta.images)) {
                            for (const img of delta.images) {
                                accumulatedImages.push(img);
                                log(`[IMG] 📥 Received image chunk (type=${img?.type}, url_len=${img?.image_url?.url?.length || 0})`);
                            }
                        }

                        if (Array.isArray(delta.content)) {
                            for (const part of delta.content) {
                                if (part?.inline_data?.data) {
                                    accumulatedImages.push(part);
                                    log(`[IMG] 📥 Received inline_data (${Math.round(part.inline_data.data.length / 1024)}KB)`);
                                } else if (part?.type === 'image_url' && part?.image_url?.url) {
                                    accumulatedImages.push(part);
                                    log(`[IMG] 📥 Received image_url in content`);
                                }
                            }
                        }
                    } catch {
                        // Skip malformed JSON lines
                    }
                }
            }

            log(`[IMG] Stream complete: ${chunkCount} chunks, finish=${lastFinishReason}, text_len=${accumulatedContent.length}, images=${accumulatedImages.length}`);

            // Extract image
            if (accumulatedImages.length > 0) {
                const img = accumulatedImages[0];
                const url = img?.image_url?.url || img?.url || (typeof img === 'string' ? img : null);
                if (url) {
                    log(`[IMG] ✅ Found image from stream (${url.substring(0, 60)}...)`);
                    return url;
                }
                if (img?.inline_data?.data) {
                    const mime = img.inline_data.mime_type || 'image/png';
                    log(`[IMG] ✅ Found inline_data from stream (${mime})`);
                    return `data:${mime};base64,${img.inline_data.data}`;
                }
            }

            if (accumulatedContent.length > 0) {
                const base64Match = accumulatedContent.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
                if (base64Match) {
                    log(`[IMG] ✅ Found data URL in text content`);
                    return base64Match[0];
                }
            }

            log(`[IMG] ⚠️ No image in stream (attempt ${attempt}). text_preview: ${accumulatedContent.substring(0, 200)}`);
            continue;

        } catch (error: any) {
            const errMsg = error?.message || String(error);
            log(`[IMG] ❌ FAILED (attempt ${attempt}): ${errMsg}`);
            continue;
        }
    }
    log(`[IMG] ❌ All 3 attempts failed`);
    return null;
}

// ===================================================================
// MAIN HANDLER
// ===================================================================

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: campaignId } = await params;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, error: 'Invalid JSON body' },
            { status: 400 }
        );
    }

    const { prompt, referenceImageUrl, imageCount } = body;

    if (!prompt) {
        return NextResponse.json(
            { success: false, error: 'prompt is required' },
            { status: 400 }
        );
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
        return NextResponse.json(
            { success: false, error: 'OPENROUTER_API_KEY not configured' },
            { status: 500 }
        );
    }

    console.log(`[GENERATE_IMAGE] 🖼️ Campaign ${campaignId} — single image request`);
    console.log(`[GENERATE_IMAGE] 📝 prompt: ${prompt.substring(0, 100)}...`);
    console.log(`[GENERATE_IMAGE] 📎 ref: ${referenceImageUrl ? referenceImageUrl.substring(0, 100) : 'NONE'}`);

    try {
        const image = await generateImage(
            openrouterKey,
            prompt,
            referenceImageUrl || null,
            imageCount || 1,
        );

        if (image) {
            console.log(`[GENERATE_IMAGE] ✅ Image generated (${image.substring(0, 50)}...)`);
            return NextResponse.json({ success: true, data: image });
        } else {
            console.warn(`[GENERATE_IMAGE] ⚠️ All attempts failed`);
            return NextResponse.json(
                { success: false, error: 'Image generation failed after 3 attempts' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('[GENERATE_IMAGE] ❌', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
