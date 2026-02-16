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

function getAspectRatioSpec(imageCount: number): { ratio: string; byteplusRatio: string } {
    switch (imageCount) {
        case 4:
            return { ratio: '1:1', byteplusRatio: '1:1' };
        default:
            // 3:4 is the closest BytePlus ratio to 4:5 (portrait)
            return { ratio: '3:4', byteplusRatio: '3:4' };
    }
}

// ─── Xiaohongshu Food Photography Prompt (Beautiful + Real) ─────────

function buildXiaohongshuPrompt(basePrompt: string, aspectSpec: ReturnType<typeof getAspectRatioSpec>, hasRef: boolean): string {
    const refInstruction = hasRef
        ? `\nA reference image is attached. Use it to understand the food type and color mood. Create a DIFFERENT photo — different angle, different plate, different background. Same dish, different shot.\n`
        : '';

    return `Xiaohongshu (小红书) style food photography — beautiful, warm, and appetizing.
${refInstruction}
FOOD: ${basePrompt}

VISUAL STYLE:
- Xiaohongshu aesthetic: warm inviting tones, beautiful color grading, the food looks irresistible
- Choose lighting and color temperature that best suits this specific dish naturally
- Close-up, food fills 70-80% of the frame, shallow depth of field
- Glossy sauce, oil sheen, juice dripping — make it look DELICIOUS

PHYSICAL ACCURACY (critical):
- Render the food EXACTLY as it looks in real life
- Raw/sashimi fish = semi-translucent flesh, visible grain, moist surface, NOT opaque or cooked-looking
- Cooked meat = opaque, caramelized, firm texture
- Cold dishes (sashimi, salad, cold noodles) = NO steam, NO smoke, NO heat haze
- Hot dishes (soup, stir-fry, grilled) = steam rising naturally
- If the food is cold, there must be ZERO steam or smoke in the entire image

CAMERA FEEL:
- Shot on a high-end phone camera (iPhone Pro), NOT a professional DSLR in a studio
- Slightly casual framing — like a foodie took this at a restaurant or home kitchen
- Human element: a hand with chopsticks lifting food, or fingers holding the dish
- Real environment visible in blurred background: other dishes, condiments, kitchen items

IMPORTANT:
- The food and styling should feel REAL and AUTHENTIC, not like a 3D render or stock photo
- Vary the plates and props naturally — do not always use the same plate style
- Background should be a real messy table or kitchen counter, NOT staged with decorative props
- No text, watermarks, or labels on the image
- No visible lamps, light bulbs, or ceiling in frame

Aspect ratio: ${aspectSpec.ratio}.`;
}

function buildSimplifiedPrompt(basePrompt: string, aspectSpec: ReturnType<typeof getAspectRatioSpec>): string {
    return `Xiaohongshu style food photo. ${basePrompt}. Warm appetizing tones, close-up, shallow depth of field, hand with chopsticks. Shot on iPhone, casual angle, real kitchen background. Beautiful but authentic, not a 3D render. No text, no lamps. Aspect ratio: ${aspectSpec.ratio}.`;
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
            size: '4K',
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
