/**
 * ===================================================================
 * API: GENERATE SINGLE IMAGE — BytePlus Seedream 4.5 Direct
 * ===================================================================
 * Route: POST /api/analysis/campaign/[id]/generate-image
 *
 * Input: { prompt, referenceImageUrl, imageCount }
 * Output: { success, data: imageUrl } or { success: false, error }
 *
 * Uses BytePlus ARK API directly for Seedream 4.5:
 *   - Text-to-Image (T2I): prompt only
 *   - Image-to-Image (I2I): prompt + reference image URL
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';

// Extend serverless timeout
export const maxDuration = 120; // 2 minutes per image

// ─── Constants ───────────────────────────────────────────────────────
const BYTEPLUS_ENDPOINT = 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations';
const SEEDREAM_MODEL = 'seedream-4-5-251128';

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

// ─── Xiaohongshu Food Photography Prompt (ADAPTIVE) ──────────────────

function buildXiaohongshuPrompt(basePrompt: string, aspectSpec: ReturnType<typeof getAspectRatioSpec>, hasRef: boolean): string {
    const refInstruction = hasRef
        ? `\n=== REFERENCE IMAGE ===\nA reference image is attached. Use it ONLY as inspiration for the food type and color mood.\nYou MUST create a COMPLETELY DIFFERENT photo with:\n- DIFFERENT camera angle (if ref is overhead, try 45°; if ref is close-up, try medium shot)\n- DIFFERENT composition and framing\n- DIFFERENT props, plates, or utensils\n- DIFFERENT background arrangement\n- SAME food type and SAME warm color temperature\nThe result must look like a DIFFERENT photographer took a DIFFERENT photo of the SAME dish.\n`
        : '';

    return `Create a STUNNING food photo in the Xiaohongshu (小红书) Chinese food photography style.

=== YOUR TASK ===
Analyze the food subject below and AUTOMATICALLY choose the most appropriate visual style from the style palette. Each food type has its own ideal color grading, lighting, and mood — DO NOT use the same look for every dish.
${refInstruction}
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
- Hands: disposable PE gloves (găng PE trong suốt), bare hands, or hands with tongs/chopstips
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

⛔ CRITICAL PROHIBITIONS (MUST follow):
- absolutely NO text, words, letters, titles, captions, watermarks, or labels anywhere on the image
- absolutely NO visible light fixtures, light bulbs, lamp shades, or ceiling lights in the frame
- absolutely NO logos, brand names, or stamps
- The lighting should be FELT (warm glow, soft shadows) but the light SOURCE must NOT be visible
- Keep the food as the ONLY focal point — no distracting overhead objects

=== ASPECT RATIO ===
${aspectSpec.instruction} (${aspectSpec.resolution})

=== FOOD SUBJECT ===
${basePrompt}

OUTPUT: ONE photo that matches the ideal Xiaohongshu sub-style for this specific food. The viewer must feel HUNGRY immediately.`;
}

function buildSimplifiedPrompt(basePrompt: string, aspectSpec: ReturnType<typeof getAspectRatioSpec>): string {
    return `Xiaohongshu (小红书) food photography. Choose the ideal color grading and lighting to match this food: ${basePrompt}. Close-up, shallow depth of field, ultra-sharp food texture, authentic feel, human element (hands/utensils). Make it look delicious and real. CRITICAL: No text, no watermarks, no visible light bulbs or lamps in frame. Aspect ratio: ${aspectSpec.ratio} (${aspectSpec.resolution}).`;
}

// ─── Call BytePlus Seedream 4.5 API ──────────────────────────────────

async function callSeedream(
    apiKey: string,
    prompt: string,
    referenceImageUrl: string | null,
): Promise<{ image: string } | { error: string }> {
    const log = (msg: string) => console.log(msg);

    const TIMEOUT_MS = 120_000;
    const abortCtrl = new AbortController();
    const timer = setTimeout(() => abortCtrl.abort(), TIMEOUT_MS);

    try {
        const body: Record<string, any> = {
            model: SEEDREAM_MODEL,
            prompt: prompt,
            response_format: 'url',
            size: '2K',
            stream: false,
            watermark: false,
            sequential_image_generation: 'disabled',
        };

        // I2I mode: pass reference image URL
        if (referenceImageUrl) {
            body.image = [referenceImageUrl];
            log(`[SEEDREAM] 🖼️ I2I mode — ref: ${referenceImageUrl.substring(0, 80)}...`);
        } else {
            log(`[SEEDREAM] ✏️ T2I mode — text only`);
        }

        const rawRes = await fetch(BYTEPLUS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: abortCtrl.signal,
        });
        clearTimeout(timer);

        log(`[SEEDREAM] Response: ${rawRes.status} ${rawRes.headers.get('content-type')}`);

        if (!rawRes.ok) {
            const errText = await rawRes.text().catch(() => '');
            log(`[SEEDREAM] ❌ HTTP ${rawRes.status}: ${errText.substring(0, 500)}`);
            return { error: `BytePlus HTTP ${rawRes.status}: ${errText.substring(0, 300)}` };
        }

        const data = await rawRes.json();

        // BytePlus response format: { data: [{ url: "..." }] }
        // Check for API-level error
        if (data?.error) {
            log(`[SEEDREAM] ❌ API error: ${JSON.stringify(data.error)}`);
            return { error: `BytePlus API: ${data.error.message || JSON.stringify(data.error)}` };
        }

        const imageUrl = data?.data?.[0]?.url;
        if (imageUrl) {
            log(`[SEEDREAM] ✅ Image URL received (${imageUrl.substring(0, 80)}...)`);
            return { image: imageUrl };
        }

        // Fallback: check b64_json format
        const b64 = data?.data?.[0]?.b64_json;
        if (b64) {
            log(`[SEEDREAM] ✅ Base64 image received (${Math.round(b64.length / 1024)}KB)`);
            return { image: `data:image/png;base64,${b64}` };
        }

        log(`[SEEDREAM] ⚠️ No image in response: ${JSON.stringify(data).substring(0, 300)}`);
        return { error: `No image in response: ${JSON.stringify(data).substring(0, 200)}` };
    } catch (error: any) {
        clearTimeout(timer);
        log(`[SEEDREAM] ❌ Error: ${error?.message || String(error)}`);
        return { error: `Seedream error: ${error?.message || String(error)}` };
    }
}

// ─── Main generation: 3 attempts ─────────────────────────────────────

async function generateImage(
    apiKey: string,
    prompt: string,
    referenceImageUrl: string | null,
    imageCount: number,
): Promise<{ image: string } | { error: string }> {
    const log = (msg: string) => console.log(msg);
    const aspectSpec = getAspectRatioSpec(imageCount);
    const hasRef = !!referenceImageUrl;
    let lastError = 'Unknown error';

    // ─── Attempt 1: Full Xiaohongshu prompt ───
    log(`[IMG] 🎯 Attempt 1: Seedream 4.5 — full prompt (ref=${hasRef ? 'YES' : 'NO'})`);
    const result1 = await callSeedream(apiKey, buildXiaohongshuPrompt(prompt, aspectSpec, hasRef), referenceImageUrl);
    if ('image' in result1) return result1;
    lastError = result1.error;
    log(`[IMG] Attempt 1 failed: ${lastError}`);

    // ─── Attempt 2: Simplified prompt ───
    log(`[IMG] 🔄 Attempt 2: Seedream 4.5 — simplified prompt`);
    const result2 = await callSeedream(apiKey, buildSimplifiedPrompt(prompt, aspectSpec), referenceImageUrl);
    if ('image' in result2) return result2;
    lastError = result2.error;
    log(`[IMG] Attempt 2 failed: ${lastError}`);

    // ─── Attempt 3: Minimal prompt, no ref ───
    log(`[IMG] 🔄 Attempt 3: Seedream 4.5 — minimal prompt, no ref`);
    const result3 = await callSeedream(apiKey, `Xiaohongshu food photo: ${prompt}. Aspect ratio: ${aspectSpec.ratio}.`, null);
    if ('image' in result3) return result3;
    lastError = result3.error;

    log(`[IMG] ❌ All 3 attempts failed. Last error: ${lastError}`);
    return { error: lastError };
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

    const arkKey = process.env.BYTEPLUS_ARK_API_KEY;
    if (!arkKey) {
        return NextResponse.json({ success: false, error: 'BYTEPLUS_ARK_API_KEY not configured' }, { status: 500 });
    }

    console.log(`[GENERATE_IMAGE] 🖼️ Campaign ${campaignId} — Seedream 4.5 via BytePlus`);
    console.log(`[GENERATE_IMAGE] 📝 prompt: ${prompt.substring(0, 100)}...`);
    console.log(`[GENERATE_IMAGE] 📎 ref: ${referenceImageUrl ? 'YES (I2I clone)' : 'NO (T2I new)'}`);

    try {
        const result = await generateImage(arkKey, prompt, referenceImageUrl || null, imageCount || 1);

        if ('image' in result) {
            console.log(`[GENERATE_IMAGE] ✅ Image generated (${result.image.substring(0, 60)}...)`);
            return NextResponse.json({ success: true, data: result.image });
        } else {
            console.warn(`[GENERATE_IMAGE] ⚠️ Failed: ${result.error}`);
            return NextResponse.json(
                { success: false, error: result.error },
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
