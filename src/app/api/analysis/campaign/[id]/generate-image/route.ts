/**
 * ===================================================================
 * API: GENERATE SINGLE IMAGE
 * ===================================================================
 * Route: POST /api/analysis/campaign/[id]/generate-image
 *
 * Input: { prompt, referenceImageUrl, imageCount }
 * Output: { success, data: base64ImageUrl } or { success: false, error }
 *
 * Strategy:
 *   Attempt 1: Seedream 4.5 (ByteDance) — Xiaohongshu food style
 *   Attempt 2: Seedream 4.5 — simplified prompt
 *   Attempt 3: Gemini 3 Pro (fallback, supports image reference)
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';

// Extend serverless timeout
export const maxDuration = 120; // 2 minutes per image

// ─── Constants ───────────────────────────────────────────────────────
const MODEL_SEEDREAM = 'bytedance-seed/seedream-4.5';
const MODEL_GEMINI = 'google/gemini-3-pro-image-preview';

// ─── Helpers ─────────────────────────────────────────────────────────

function getAspectRatioSpec(imageCount: number): { ratio: string; resolution: string; instruction: string } {
    switch (imageCount) {
        case 2:
            return { ratio: '4:5', resolution: '1080x1350', instruction: 'PORTRAIT 4:5 aspect ratio (1080x1350px).' };
        case 4:
            return { ratio: '1:1', resolution: '1080x1080', instruction: 'SQUARE 1:1 aspect ratio (1080x1080px).' };
        default:
            return { ratio: '4:5', resolution: '1080x1350', instruction: 'PORTRAIT 4:5 aspect ratio (1080x1350px).' };
    }
}

async function downloadImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
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

// ─── Xiaohongshu Food Photography Prompt (ADAPTIVE) ──────────────────

function buildXiaohongshuPrompt(basePrompt: string, aspectSpec: ReturnType<typeof getAspectRatioSpec>): string {
    return `Create a STUNNING food photo in the Xiaohongshu (小红书) Chinese food photography style.

=== YOUR TASK ===
Analyze the food subject below and AUTOMATICALLY choose the most appropriate visual style from the style palette. Each food type has its own ideal color grading, lighting, and mood — DO NOT use the same look for every dish.

=== XIAOHONGSHU STYLE PALETTE (choose the BEST match) ===

🍯 WARM AMBER GLAZE — for braised meats, kho, sốt nâu, caramelized dishes:
   Color: 3000-3500K amber/caramel cast, rich brown tones, golden highlights
   Surface: glossy sauce/glaze, caramelized lacquer finish
   Light: warm overhead kitchen light, specular highlights on wet surfaces

🌿 FRESH & BRIGHT — for seafood, salads, sushi, raw dishes, light meals:
   Color: clean daylight 5500K, vibrant greens/whites, fresh & crisp
   Surface: dewy, moist, glistening water droplets
   Light: natural window light, soft and bright, airy feel

🔥 SMOKY & DARK — for grilled, BBQ, charcoal, lẩu, roasted dishes:
   Color: deep moody tones, charred blacks, ember reds/oranges, smoky atmosphere
   Surface: charred crust with juicy interior, smoke wisps
   Light: dramatic low light, fire glow, strong contrast

🍜 STEAM & WARMTH — for phở, soup, noodles, dim sum, hot pot, steamed dishes:
   Color: gentle warm tones 4000-4500K, soft and inviting
   Surface: steam rising, condensation, broth shimmer
   Light: soft diffused warm light, cozy atmosphere

🌶️ VIBRANT SPICY — for mala, chili dishes, Sichuan, spicy street food:
   Color: INTENSE saturated reds, oranges, chili oil sheen, peppercorn greens
   Surface: glistening chili oil layer, visible spice flakes, wet & fiery
   Light: bright and punchy, high saturation, bold contrast

🍰 SOFT & ELEGANT — for desserts, pastries, tea, café items, bánh:
   Color: soft pastel tones, creamy whites, gentle warm accents
   Surface: smooth, powdered sugar, drizzle, delicate textures
   Light: soft natural light, dreamy and airy

=== UNIVERSAL RULES (apply to ALL styles) ===

COMPOSITION:
- Close-up filling 70-90% of frame — food is the HERO
- Shallow depth of field — background blurred
- Slightly imperfect framing — feels real, not studio-perfect
- Show some environment context (table, plate edge, utensils)

AUTHENTICITY:
- Must look like a REAL person took this with a good phone camera
- Human presence: hand holding food, chopsticks, spoon, or cooking action
- Real environment: kitchen, restaurant table, street food stall
- NOT a sterile studio setup — life and context around the food

PROPS & UTENSILS (vary based on context):
- Plates/bowls: classic Vietnamese rooster plate (đĩa con gà), ceramic bowls, bamboo baskets (rổ tre), white plastic takeaway containers, steel bowls
- Utensils: chopsticks, soup ladle, large kitchen knife (dao phay), wooden spatula, tongs
- Hands: disposable PE gloves (găng PE trong suốt), bare hands, or hands with tongs/chopsticks
- Surfaces: stainless steel kitchen table, wooden cutting board (thớt gỗ), bamboo mat

BACKGROUND & SPACE (critical for authenticity):
- REAL working kitchen visible: gas stove, pots, other dishes being prepped
- Other food items partially visible at edges — the scene is BUSY, not isolated
- Condensation on containers, sauce splatters on table — signs of active cooking
- NOT a clean empty background — messy, lived-in, working environment
- Blurred background elements add depth and context without distracting

TEXTURE & DETAIL:
- Ultra-sharp food texture — every fiber, grain, flake visible
- Micro-details: oil droplets, sauce bubbles, steam particles, spice flakes
- The surface quality must be TACTILE — viewer can almost feel the texture

=== ASPECT RATIO ===
${aspectSpec.instruction} (${aspectSpec.resolution})

=== FOOD SUBJECT ===
${basePrompt}

OUTPUT: ONE photo that matches the ideal Xiaohongshu sub-style for this specific food. The viewer must feel HUNGRY immediately.`;
}

function buildSimplifiedPrompt(basePrompt: string, aspectSpec: ReturnType<typeof getAspectRatioSpec>): string {
    return `Xiaohongshu (小红书) food photography. Choose the ideal color grading and lighting to match this food: ${basePrompt}. Close-up, shallow depth of field, ultra-sharp food texture, authentic feel, human element (hands/utensils). Make it look delicious and real. Aspect ratio: ${aspectSpec.ratio} (${aspectSpec.resolution}).`;
}

function buildGeminiFallbackPrompt(basePrompt: string, aspectSpec: ReturnType<typeof getAspectRatioSpec>, hasRef: boolean): string {
    return `Create a food photo in Xiaohongshu (小红书) Chinese social media style.

STYLE: Choose the ideal lighting and color grading that MATCHES the food type — warm amber for braised dishes, bright and fresh for seafood/salads, dark and smoky for grilled/BBQ, vibrant for spicy dishes, soft for desserts. Let the FOOD dictate the visual style.

QUALITY: Close-up, sharp texture detail, shallow depth of field, authentic environment, human element visible.

⚠️ ASPECT RATIO: ${aspectSpec.instruction} (${aspectSpec.resolution}).

${hasRef ? `REFERENCE IMAGE: Create a NEW photo matching the same food type, composition, and mood as the reference, with appropriate Xiaohongshu styling.` : ''}

FOOD SUBJECT:
${basePrompt}

Make the viewer INSTANTLY hungry.`;
}

// ─── Call Seedream 4.5 (text-to-image, non-streaming) ────────────────

async function callSeedream(apiKey: string, prompt: string): Promise<string | null> {
    const log = (msg: string) => console.log(msg);

    const TIMEOUT_MS = 120_000;
    const abortCtrl = new AbortController();
    const timer = setTimeout(() => abortCtrl.abort(), TIMEOUT_MS);

    try {
        const rawRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://ads.supbaongu.vn',
                'X-Title': 'THO ADS AI - Creative Studio',
            },
            body: JSON.stringify({
                model: MODEL_SEEDREAM,
                messages: [{ role: 'user', content: prompt }],
                modalities: ['image'],
            }),
            signal: abortCtrl.signal,
        });
        clearTimeout(timer);

        log(`[SEEDREAM] Response: ${rawRes.status} ${rawRes.headers.get('content-type')}`);

        if (!rawRes.ok) {
            const errText = await rawRes.text().catch(() => '');
            log(`[SEEDREAM] ❌ HTTP ${rawRes.status}: ${errText.substring(0, 300)}`);
            return null;
        }

        const data = await rawRes.json();
        const message = data?.choices?.[0]?.message;

        // Check for image in content array
        if (Array.isArray(message?.content)) {
            for (const part of message.content) {
                if (part?.type === 'image_url' && part?.image_url?.url) {
                    log(`[SEEDREAM] ✅ Image received (url_len=${part.image_url.url.length})`);
                    return part.image_url.url;
                }
                if (part?.inline_data?.data) {
                    const mime = part.inline_data.mime_type || 'image/png';
                    log(`[SEEDREAM] ✅ Inline image received (${mime})`);
                    return `data:${mime};base64,${part.inline_data.data}`;
                }
            }
        }

        // Check for image_url directly on message
        if (message?.image_url?.url) {
            log(`[SEEDREAM] ✅ Image from message.image_url`);
            return message.image_url.url;
        }

        // Check string content for data URL
        if (typeof message?.content === 'string') {
            const match = message.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
            if (match) {
                log(`[SEEDREAM] ✅ Image from text content`);
                return match[0];
            }
            log(`[SEEDREAM] ⚠️ Text response, no image: ${message.content.substring(0, 200)}`);
        }

        log(`[SEEDREAM] ⚠️ No image found in response`);
        return null;
    } catch (error: any) {
        clearTimeout(timer);
        log(`[SEEDREAM] ❌ Error: ${error?.message || String(error)}`);
        return null;
    }
}

// ─── Call Gemini 3 Pro (supports image reference, uses streaming) ─────

async function callGemini(
    apiKey: string,
    prompt: string,
    refBase64: { data: string; mimeType: string } | null,
): Promise<string | null> {
    const log = (msg: string) => console.log(msg);

    const contentParts: any[] = [{ type: 'text', text: prompt }];
    if (refBase64) {
        contentParts.push({
            type: 'image_url',
            image_url: { url: `data:${refBase64.mimeType};base64,${refBase64.data}` },
        });
    }

    const TIMEOUT_MS = 120_000;
    const abortCtrl = new AbortController();
    const timer = setTimeout(() => abortCtrl.abort(), TIMEOUT_MS);

    try {
        const rawRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://ads.supbaongu.vn',
                'X-Title': 'THO ADS AI - Creative Studio',
            },
            body: JSON.stringify({
                model: MODEL_GEMINI,
                messages: [{ role: 'user', content: contentParts }],
                modalities: ['image', 'text'],
                stream: true,
            }),
            signal: abortCtrl.signal,
        });
        clearTimeout(timer);

        log(`[GEMINI] Response: ${rawRes.status}`);
        if (!rawRes.ok) {
            const errText = await rawRes.text().catch(() => '');
            log(`[GEMINI] ❌ HTTP ${rawRes.status}: ${errText.substring(0, 300)}`);
            return null;
        }

        // Read SSE stream
        const reader = rawRes.body?.getReader();
        if (!reader) return null;

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';
        const accumulatedImages: any[] = [];

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
                    const delta = chunk?.choices?.[0]?.delta;
                    if (!delta) continue;

                    if (typeof delta.content === 'string') accumulatedContent += delta.content;

                    if (Array.isArray(delta.images)) {
                        for (const img of delta.images) accumulatedImages.push(img);
                    }
                    if (Array.isArray(delta.content)) {
                        for (const part of delta.content) {
                            if (part?.inline_data?.data || (part?.type === 'image_url' && part?.image_url?.url)) {
                                accumulatedImages.push(part);
                            }
                        }
                    }
                } catch { /* skip */ }
            }
        }

        // Extract image
        if (accumulatedImages.length > 0) {
            const img = accumulatedImages[0];
            const url = img?.image_url?.url || img?.url || (typeof img === 'string' ? img : null);
            if (url) { log(`[GEMINI] ✅ Image found`); return url; }
            if (img?.inline_data?.data) {
                const mime = img.inline_data.mime_type || 'image/png';
                log(`[GEMINI] ✅ Inline image found`);
                return `data:${mime};base64,${img.inline_data.data}`;
            }
        }

        if (accumulatedContent) {
            const match = accumulatedContent.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
            if (match) { log(`[GEMINI] ✅ Image in text`); return match[0]; }
        }

        log(`[GEMINI] ⚠️ No image in response`);
        return null;
    } catch (error: any) {
        clearTimeout(timer);
        log(`[GEMINI] ❌ Error: ${error?.message || String(error)}`);
        return null;
    }
}

// ─── Main generation with 3-attempt strategy ─────────────────────────

async function generateImage(
    apiKey: string,
    prompt: string,
    referenceImageUrl: string | null,
    imageCount: number,
): Promise<string | null> {
    const log = (msg: string) => console.log(msg);
    const aspectSpec = getAspectRatioSpec(imageCount);

    // Download reference image for Gemini fallback
    let refBase64: { data: string; mimeType: string } | null = null;
    if (referenceImageUrl) {
        log(`[IMG] Downloading ref image for Gemini fallback...`);
        refBase64 = await downloadImageAsBase64(referenceImageUrl);
        if (refBase64) log(`[IMG] ✅ Ref downloaded (${Math.round(refBase64.data.length / 1024)}KB)`);
        else log(`[IMG] ⚠️ Ref download failed`);
    }

    // ─── Attempt 1: Seedream 4.5 — Full Xiaohongshu prompt ───
    log(`[IMG] 🎯 Attempt 1: Seedream 4.5 — Xiaohongshu style`);
    const prompt1 = buildXiaohongshuPrompt(prompt, aspectSpec);
    const result1 = await callSeedream(apiKey, prompt1);
    if (result1) return result1;

    // ─── Attempt 2: Seedream 4.5 — Simplified prompt ───
    log(`[IMG] 🔄 Attempt 2: Seedream 4.5 — simplified prompt`);
    const prompt2 = buildSimplifiedPrompt(prompt, aspectSpec);
    const result2 = await callSeedream(apiKey, prompt2);
    if (result2) return result2;

    // ─── Attempt 3: Gemini 3 Pro fallback (with ref image if available) ───
    log(`[IMG] 🔄 Attempt 3: Gemini 3 Pro fallback (ref=${refBase64 ? 'YES' : 'NO'})`);
    const prompt3 = buildGeminiFallbackPrompt(prompt, aspectSpec, !!refBase64);
    const result3 = await callGemini(apiKey, prompt3, refBase64);
    if (result3) return result3;

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
        return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { prompt, referenceImageUrl, imageCount } = body;

    if (!prompt) {
        return NextResponse.json({ success: false, error: 'prompt is required' }, { status: 400 });
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
        return NextResponse.json({ success: false, error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
    }

    console.log(`[GENERATE_IMAGE] 🖼️ Campaign ${campaignId} — Seedream 4.5 primary`);
    console.log(`[GENERATE_IMAGE] 📝 prompt: ${prompt.substring(0, 100)}...`);

    try {
        const image = await generateImage(openrouterKey, prompt, referenceImageUrl || null, imageCount || 1);

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
