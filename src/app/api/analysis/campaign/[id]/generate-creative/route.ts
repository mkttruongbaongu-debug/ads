/**
 * ===================================================================
 * API: GENERATE CREATIVE (Caption + Image)
 * ===================================================================
 * Route: POST /api/analysis/campaign/[id]/generate-creative
 *
 * Input: Creative Brief + Top Ads data
 * Output: Caption + Generated Images (base64)
 *
 * Pipeline:
 * 1. Gemini 2.5 Flash → Caption + Image Prompt (học phong cách winning ads)
 * 2. Nano Banana Pro → Generate images (phong cách 99% giống gốc)
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// ===================================================================
// STEP 1: GENERATE CAPTION + IMAGE PROMPT (Gemini 2.5 Flash)
// ===================================================================

function buildCaptionPrompt(briefData: any): string {
    const { creativeBrief, winningPatterns, topAds, campaignName } = briefData;

    return `Bạn là CHUYÊN GIA CREATIVE cấp Director cho quảng cáo Facebook F&B Việt Nam, với 15 năm kinh nghiệm food photography chuyên nghiệp.

## NHIỆM VỤ
Dựa vào Creative Brief và Winning Patterns, tạo:
1. **Caption** quảng cáo chất lượng cao
2. **Image prompts CHUYÊN SÂU** — mức độ chi tiết như brief cho photographer chuyên nghiệp

## CHIẾN DỊCH: ${campaignName}

## CREATIVE BRIEF
- Summary: ${creativeBrief?.summary || 'N/A'}
- Target Audience: ${creativeBrief?.targetAudience || 'N/A'}
- Content Format: ${creativeBrief?.contentFormat || 'N/A'}
- Caption Guideline: ${creativeBrief?.captionGuideline || 'N/A'}
- Visual Direction: ${creativeBrief?.visualDirection || 'N/A'}
- CTA: ${creativeBrief?.ctaRecommendation || 'N/A'}

## CAPTION MẪU TỪ ADS THẮNG
${creativeBrief?.captionExamples?.map((ex: string, i: number) => `${i + 1}. "${ex}"`).join('\n') || 'Không có'}

## WINNING PATTERNS
${winningPatterns?.map((p: any) => `- [${p.category}] ${p.pattern} (Evidence: ${p.evidence})`).join('\n') || 'N/A'}

## TOP ADS THẮNG (CẢM HỨNG CHÍNH)
${topAds?.map((ad: any, i: number) => `- Ad #${i + 1} "${ad.name}" (ROAS ${ad.roas?.toFixed(1)}x, CPP ${ad.cpp?.toLocaleString()}): ${ad.whyItWorks}`).join('\n') || 'N/A'}

## NÊN LÀM
${creativeBrief?.doList?.map((d: string) => `✓ ${d}`).join('\n') || 'N/A'}

## KHÔNG NÊN
${creativeBrief?.dontList?.map((d: string) => `✕ ${d}`).join('\n') || 'N/A'}

## YÊU CẦU OUTPUT

### Caption:
- Viết bằng tiếng Việt, phong cách MỀM MẠI, GỢI CẢM GIÁC
- Học 99% phong cách winning ads (cách dùng từ, nhịp câu, cảm xúc)
- Nội dung MỚI nhưng GIỮ NGUYÊN phong cách và tone
- Có CTA phù hợp ở cuối

### Image Prompts — ⚠️ YÊU CẦU CHUYÊN SÂU ⚠️:
Mỗi prompt PHẢI bao gồm TẤT CẢ các yếu tố sau:

1. **Nguồn cảm hứng**: Chỉ rõ lấy cảm hứng từ ad nào (VD: "Inspired by Ad #1 - mâm cơm cận cảnh, ROAS 16x")
2. **Thiết bị chụp**: Camera cụ thể (VD: "Shot on iPhone 15 Pro Max" hoặc "Nikon D850 with 105mm f/2.8 Macro")
3. **Focal length & Aperture**: VD: "85mm, f/2.0 shallow depth of field" hoặc "35mm, f/5.6 wide shot"
4. **Góc chụp (Camera angle)**: overhead flat lay, 45-degree angle, eye-level, low angle, close-up macro
5. **Ánh sáng (Lighting)**: natural window light from left, golden hour warm light, softbox key light with fill, backlit with rim light
6. **Color grading**: warm orange tones, desaturated moody, vibrant saturated, film-like grain, VSCO A6 preset style
7. **Bối cảnh (Setting)**: rustic wooden table, marble countertop, street food stall at night, home kitchen with steam
8. **Food styling**: sắp xếp món ăn, steam/hơi nóng, nước sốt đang rưới, gia vị rắc
9. **Props**: đũa, bát gốm, lá chuối, tay đang gắp, khăn vải
10. **Mood/Atmosphere**: cozy homemade feel, premium restaurant presentation, street food authenticity
11. **Chất lượng**: "Ultra-realistic, 4K, professional food photography, NOT AI-generated looking"

❌ TUYỆT ĐỐI KHÔNG ĐƯỢC:
- Prompt chung chung: "A delicious dish on a table" → RÁC
- Thiếu camera specs → ảnh trông như AI tạo
- Thiếu lighting description → flat, lifeless

✅ VÍ DỤ PROMPT CHUẨN:
"Inspired by Ad #1 (ROAS 16x, mâm cơm gia đình style). Shot on iPhone 15 Pro Max, 26mm wide-angle, f/1.78. Overhead flat-lay composition of a traditional Vietnamese family meal: steaming white rice in a clay pot (center), grilled salmon fillet with crispy skin on a ceramic plate, kimchi and pickled vegetables in small dishes, fresh herbs (rau thơm) scattered. Natural window light from the upper-left creating soft shadows. Warm color grading (orange tones, +15 warmth). Rustic dark wooden table surface with visible grain texture. Steam rising from the rice. A hand reaching with chopsticks to pick up a piece of fish. Ultra-realistic, professional food photography, 4K resolution, shallow depth of field on the main dish."

Số lượng ảnh: 1, 2, hoặc 4 (tuỳ content format)
DÙNG TIẾNG ANH cho image prompt

Trả lời JSON (không markdown, không \`\`\`):
{
  "caption": "Nội dung caption đầy đủ...",
  "imageCount": 1 | 2 | 4,
  "imagePrompts": [
    "Extremely detailed professional photography prompt as described above..."
  ],
  "keyMessage": "Thông điệp chính trong 1 câu",
  "inspirationSource": "Lấy cảm hứng chính từ Ad #X (tên ad, ROAS Xx) vì: lý do"
}`;
}

// ===================================================================
// STEP 2: GENERATE IMAGES (Gemini 3 Pro Image Preview)
// ===================================================================

async function generateImage(
    client: OpenAI,
    prompt: string,
    referenceImageUrls: string[],
): Promise<string | null> {
    try {
        // Build multimodal content: ultra-detailed photography prompt + reference images
        const contentParts: any[] = [
            {
                type: 'text',
                text: `You are a WORLD-CLASS food photographer creating an advertisement photo for Vietnamese F&B brand on Facebook.

YOUR MISSION: Generate an ULTRA-REALISTIC food photograph that is INDISTINGUISHABLE from a real photo. 
The output MUST look like it was shot by a professional photographer, NOT like AI-generated art.

REFERENCE IMAGES: Study the attached reference images carefully. Match their:
- Exact color palette and color grading
- Lighting direction and quality (soft vs hard light)
- Composition style (flat lay, 45-degree, etc.)
- Overall mood and atmosphere
- Level of food styling detail

PHOTOGRAPHY SPECIFICATIONS FROM THE BRIEF:
${prompt}

CRITICAL QUALITY REQUIREMENTS:
- ULTRA-REALISTIC: Must pass as a real photograph, not AI art
- 4K resolution quality (4096x4096), sharp and detailed
- Correct physics: realistic reflections, shadows, steam behavior, liquid dynamics
- Food must look APPETIZING and FRESH — no uncanny valley
- Textures must be photorealistic: wood grain, ceramic glaze, fabric weave, food surface
- Lighting must be physically accurate: consistent direction, proper falloff, natural shadows
- Color science: realistic skin tones if hands are present, accurate food colors
- NO text, watermarks, logos, or overlays unless explicitly specified
- NO surreal or fantasy elements — pure photorealism
- Steam/smoke should look natural, not overdone

OUTPUT: A single ultra-high-quality photograph.`,
            },
        ];

        // Add reference images from winning ads
        for (const url of referenceImageUrls.slice(0, 3)) {
            if (url) {
                contentParts.push({
                    type: 'image_url',
                    image_url: { url },
                });
            }
        }

        const response = await client.chat.completions.create({
            model: 'google/gemini-3-pro-image-preview',
            messages: [
                {
                    role: 'user',
                    content: contentParts,
                },
            ],
            // @ts-ignore - OpenRouter specific: modalities for image generation
            modalities: ['image', 'text'],
        } as any);

        // Extract base64 image from response
        const message = response.choices?.[0]?.message;
        if (message && (message as any).images && (message as any).images.length > 0) {
            return (message as any).images[0].image_url?.url || (message as any).images[0].imageUrl?.url || null;
        }

        // Fallback: check content for inline images
        const content = message?.content || '';
        const base64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        if (base64Match) {
            return base64Match[0];
        }

        console.warn('[GENERATE_CREATIVE] ⚠️ No image in response');
        return null;
    } catch (error) {
        console.error('[GENERATE_CREATIVE] ❌ Image generation failed:', error);
        return null;
    }
}

// ===================================================================
// MAIN HANDLER
// ===================================================================

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: campaignId } = await params;
        const body = await request.json();

        const { creativeBrief, winningPatterns, topAds, campaignName, topAdImageUrls } = body;

        if (!creativeBrief) {
            return NextResponse.json(
                { success: false, error: 'creativeBrief is required' },
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

        const client = new OpenAI({
            apiKey: openrouterKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://tho-ads-ai.netlify.app',
                'X-Title': 'THO ADS AI - Creative Studio',
            },
        });

        console.log(`[GENERATE_CREATIVE] 🎨 Campaign ${campaignId} — Starting pipeline...`);

        // ─── STEP 1: Generate Caption + Image Prompts ────────────────
        console.log('[GENERATE_CREATIVE] 📝 Step 1: Generating caption + image prompts...');

        const captionPrompt = buildCaptionPrompt({
            creativeBrief,
            winningPatterns,
            topAds,
            campaignName,
        });

        const captionResponse = await client.chat.completions.create({
            model: 'google/gemini-2.5-flash',
            messages: [
                { role: 'user', content: captionPrompt },
            ],
            temperature: 0.8,
        });

        const captionText = captionResponse.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        let captionResult: {
            caption: string;
            imageCount: number;
            imagePrompts: string[];
            keyMessage: string;
        };

        try {
            // Remove markdown code blocks if present
            const cleaned = captionText
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();
            captionResult = JSON.parse(cleaned);
        } catch {
            console.error('[GENERATE_CREATIVE] ❌ Failed to parse caption JSON:', captionText);
            return NextResponse.json({
                success: false,
                error: 'AI trả về format không hợp lệ. Vui lòng thử lại.',
            }, { status: 500 });
        }

        console.log(`[GENERATE_CREATIVE] ✅ Caption generated, ${captionResult.imageCount} images requested`);
        console.log(`[GENERATE_CREATIVE] 💬 Key message: ${captionResult.keyMessage}`);

        // ─── STEP 2: Generate Images with Nano Banana Pro ────────────
        console.log(`[GENERATE_CREATIVE] 🖼️ Step 2: Generating ${captionResult.imageCount} image(s)...`);

        const referenceUrls: string[] = topAdImageUrls || [];
        const generatedImages: string[] = [];

        // Generate images in parallel (but with limit)
        const imagePromises = captionResult.imagePrompts
            .slice(0, captionResult.imageCount)
            .map(async (prompt, idx) => {
                console.log(`[GENERATE_CREATIVE] 🖼️ Generating image ${idx + 1}/${captionResult.imageCount}...`);
                const image = await generateImage(client, prompt, referenceUrls);
                return { idx, image };
            });

        const imageResults = await Promise.all(imagePromises);

        for (const { idx, image } of imageResults.sort((a, b) => a.idx - b.idx)) {
            if (image) {
                generatedImages.push(image);
                console.log(`[GENERATE_CREATIVE] ✅ Image ${idx + 1} generated`);
            } else {
                console.warn(`[GENERATE_CREATIVE] ⚠️ Image ${idx + 1} failed`);
            }
        }

        console.log(`[GENERATE_CREATIVE] 🎉 Done! ${generatedImages.length}/${captionResult.imageCount} images generated`);

        return NextResponse.json({
            success: true,
            data: {
                caption: captionResult.caption,
                keyMessage: captionResult.keyMessage,
                imageCount: captionResult.imageCount,
                imagePrompts: captionResult.imagePrompts,
                images: generatedImages,
                captionPrompt, // Trả về prompt gốc để debug & cải tiến
                referenceImageUrls: referenceUrls, // URLs ảnh tham khảo đã dùng
            },
        });

    } catch (error) {
        console.error('[GENERATE_CREATIVE] ❌', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
