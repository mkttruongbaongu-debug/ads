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

// ─── Food Photography Prompt (Casual & Real) ──────────────────────────

function buildXiaohongshuPrompt(basePrompt: string, aspectSpec: ReturnType<typeof getAspectRatioSpec>, hasRef: boolean): string {
    const refInstruction = hasRef
        ? `\nA reference image is attached. Use it ONLY to understand the food type and color mood. Create a COMPLETELY DIFFERENT photo — different angle, different plate, different background. Same dish, different shot.\n`
        : '';

    return `Vietnamese food photo, casual smartphone style.
${refInstruction}
SUBJECT: ${basePrompt}

STYLE:
- Shot on iPhone in a real Vietnamese kitchen or restaurant
- Warm, appetizing color tones that match the food naturally
- Close-up, food fills most of the frame
- Slightly messy environment — real table, real dishes around
- A hand holding chopsticks, lifting food, or scooping with a spoon
- Shallow depth of field, background softly blurred

FEEL:
- Like a real person snapped this to share on social media
- Candid, spontaneous, NOT posed or styled
- Imperfect but appetizing — sauce drips, steam, oil sheen
- The food must look REAL and DELICIOUS, not like a 3D render

DO NOT:
- No text, watermarks, or labels on the image
- No visible lamps, light bulbs, or ceiling in frame
- No overly perfect studio lighting
- No bamboo mat styling or decorative props arranged around the food
- No stock photo look

Aspect ratio: ${aspectSpec.ratio}.`;
}

function buildSimplifiedPrompt(basePrompt: string, aspectSpec: ReturnType<typeof getAspectRatioSpec>): string {
    return `Casual Vietnamese food photo, shot on iPhone. ${basePrompt}. Close-up, warm tones, real messy kitchen background, hand with chopsticks. Candid and appetizing, not studio-perfect. No text, no lamps in frame. Aspect ratio: ${aspectSpec.ratio}.`;
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
