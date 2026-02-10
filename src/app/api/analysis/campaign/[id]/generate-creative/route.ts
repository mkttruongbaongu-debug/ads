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

    return `Bạn là CHUYÊN GIA CREATIVE cho quảng cáo Facebook thị trường Việt Nam, chuyên về ngành F&B (đồ ăn, thức uống).

## NHIỆM VỤ
Dựa vào Creative Brief và phân tích Winning Patterns bên dưới, hãy tạo:
1. **Caption** quảng cáo chất lượng cao 
2. **Image prompts** mô tả CHI TIẾT ảnh cần tạo 

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
${winningPatterns?.map((p: any) => `- [${p.category}] ${p.pattern}`).join('\n') || 'N/A'}

## NÊN LÀM
${creativeBrief?.doList?.map((d: string) => `✓ ${d}`).join('\n') || 'N/A'}

## KHÔNG NÊN
${creativeBrief?.dontList?.map((d: string) => `✕ ${d}`).join('\n') || 'N/A'}

## TOP ADS THẮNG
${topAds?.map((ad: any) => `- "${ad.name}" (ROAS ${ad.roas?.toFixed(1)}x): ${ad.whyItWorks}`).join('\n') || 'N/A'}

## YÊU CẦU OUTPUT

### Caption:
- Viết bằng tiếng Việt, phong cách MỀM MẠI, GỢI CẢM GIÁC, tạo cảm xúc
- Học 99% phong cách từ caption mẫu winning ads (cách dùng từ, nhịp câu, cảm xúc)
- Điểm khác biệt: sáng tạo nội dung MỚI nhưng GIỮ NGUYÊN phong cách và tone
- Không lặp lại caption cũ, phải có ý tưởng mới
- Có CTA phù hợp ở cuối

### Image Prompts:
- Mỗi prompt mô tả 1 ảnh cụ thể cần tạo
- Số lượng ảnh: 1, 2, hoặc 4 (tuỳ key message và content format)
- MÔ TẢ CỰC KỸ: bố cục, góc chụp, ánh sáng, màu sắc, food styling, background, props
- Phong cách ảnh PHẢI GIỐNG 99% top ads (warm tone, close-up, natural light, v.v.)
- Nếu có text overlay: ghi rõ nội dung text, font style, vị trí trên ảnh
- DÙNG TIẾNG ANH cho image prompt

Trả lời JSON (không markdown, không \`\`\`):
{
  "caption": "Nội dung caption đầy đủ...",
  "imageCount": 1 | 2 | 4,
  "imagePrompts": [
    "Detailed description of image 1...",
    "Detailed description of image 2 (if applicable)..."
  ],
  "keyMessage": "Thông điệp chính trong 1 câu"
}`;
}

// ===================================================================
// STEP 2: GENERATE IMAGES (Nano Banana Pro)
// ===================================================================

async function generateImage(
    client: OpenAI,
    prompt: string,
    referenceImageUrls: string[],
): Promise<string | null> {
    try {
        // Build multimodal content: text prompt + reference images
        const contentParts: any[] = [
            {
                type: 'text',
                text: `Generate a high-quality food advertisement photo based on this description. Match the exact style, lighting, composition and color palette of the reference images provided. The output should look like a professional food photography for Facebook ads.

IMAGE DESCRIPTION:
${prompt}

IMPORTANT RULES:
- Match the reference images' style 99%: same color tone, lighting direction, composition style
- Professional food photography quality
- Vibrant, appetizing colors
- Sharp focus on the main subject
- Clean, uncluttered composition
- If text overlay is mentioned, render it clearly and legibly
- Output a single high-quality image`,
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
