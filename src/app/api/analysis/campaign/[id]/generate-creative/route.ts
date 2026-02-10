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

    return `Bạn là CHUYÊN GIA CREATIVE quảng cáo Facebook Việt Nam — chuyên tạo nội dung UGC (User-Generated Content) chân thực, tự nhiên.

## NHIỆM VỤ
Dựa vào Creative Brief và Winning Patterns, tạo:
1. **Caption** quảng cáo tự nhiên, đọc như người thật viết
2. **Image prompts CHI TIẾT** — mô tả ảnh kiểu NGƯỜI THẬT CHỤP BẰNG ĐIỆN THOẠI (UGC / POV style)

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
- Viết bằng tiếng Việt, phong cách TỰ NHIÊN, như người thật chia sẻ trải nghiệm
- Học 99% phong cách winning ads (cách dùng từ, nhịp câu, cảm xúc)
- Nội dung MỚI nhưng GIỮ NGUYÊN phong cách và tone
- Có CTA phù hợp ở cuối
- ⚠️ QUY TẮC EMOJI — TUYỆT ĐỐI TUÂN THỦ:
  + Tối đa 2-3 emoji trong TOÀN BỘ caption
  + Chỉ dùng emoji phù hợp ngữ cảnh (ít, tinh tế)
  + CẤM spam emoji liên tục — trông rất bị AI
  + CẤM emoji ở đầu mỗi dòng — trông như chatbot
  + Caption phải đọc TỰ NHIÊN như người thật viết, KHÔNG PHẢI AI

### Image Prompts — ⚠️ PHONG CÁCH UGC / POV — QUAN TRỌNG NHẤT ⚠️:

#### TRIẾT LÝ CỐT LÕI:
Ảnh PHẢI trông như NGƯỜI THẬT tự chụp bằng điện thoại rồi đăng lên mạng xã hội.
KHÔNG PHẢI ảnh studio, KHÔNG PHẢI ảnh dàn dựng, KHÔNG PHẢI ảnh "đẹp hoàn hảo".
Sự CHÂN THỰC và TỰ NHIÊN quan trọng hơn sự HOÀN HẢO.

#### KHỔ ẢNH THEO SỐ LƯỢNG (BẮT BUỘC):
- **1 ảnh**: Dọc 4:5 (1080×1350px)
- **2 ảnh**: Mỗi ảnh dọc 4:5 (1080×1350px)
- **4 ảnh**: Mỗi ảnh vuông 1:1 (1080×1080px)
→ MỌI image prompt PHẢI ghi rõ aspect ratio + resolution ở CUỐI prompt

Mỗi prompt PHẢI bao gồm TẤT CẢ các yếu tố sau:

1. **Nguồn cảm hứng**: Chỉ rõ lấy cảm hứng từ ad nào
2. **Thiết bị chụp**: LUÔN LÀ smartphone (VD: "Casual photo taken with iPhone", "Quick snap from Samsung Galaxy")
3. **Góc chụp**: POV (first-person), selfie angle, slightly tilted, off-center — KHÔNG bao giờ perfectly centered hoặc symmetrical
4. **Ánh sáng**: Ánh sáng THỰC TẾ của môi trường — đèn tuýp nhà hàng bình dân, ánh sáng cửa sổ ban ngày, đèn LED phòng khách, ánh đèn đường ban đêm. KHÔNG BAO GIỜ dùng softbox, studio light, rim light, hay bất kỳ thiết bị chiếu sáng chuyên nghiệp nào.
5. **Bối cảnh (Setting)**: Môi trường THẬT, SỐNG ĐỘNG, có chi tiết "lộn xộn" tự nhiên — bàn ăn có ly nước dùng dở, khăn giấy, điện thoại để bên cạnh, túi xách, bàn làm việc có giấy tờ, phòng khách có remote TV
6. **Sản phẩm**: Sản phẩm trong bối cảnh sử dụng thực tế, KHÔNG phải trưng bày. Đang dùng, đang mở, đang cầm trên tay.
7. **Con người (nếu có)**: Chỉ thấy tay/cánh tay đang tương tác với sản phẩm (POV style). Da tay tự nhiên, có thể thấy móng tay, đồng hồ, vòng tay.
8. **Texture & Grain**: Slight phone camera noise, not tack-sharp everywhere, natural depth of field from phone lens
9. **Mood**: Casual, everyday, authentic, lived-in — như scroll Facebook thấy bạn bè đăng
10. **Chất lượng**: "Authentic smartphone photo, UGC style, NOT studio, NOT AI-generated, NOT stock photo"

❌ TUYỆT ĐỐI KHÔNG ĐƯỢC (CẤM HOÀN TOÀN):
- Bố cục đối xứng hoàn hảo — kiểu studio
- Ánh sáng hoàn hảo từ mọi góc — kiểu dàn dựng
- Background sạch sẽ, trống trơn — kiểu chụp sản phẩm
- Sản phẩm đặt chính giữa trên nền trắng/đơn sắc — kiểu e-commerce
- Bất kỳ yếu tố nào trông "quá hoàn hảo" hoặc "quá đẹp" — đó là dấu hiệu ảnh giả
- Camera specs chuyên nghiệp (Nikon, Canon, Sony, DSLR, mirrorless)
- Props styling quá cầu kỳ, quá đẹp, quá nghệ thuật

✅ VÍ DỤ PROMPT CHUẨN UGC (1 ảnh = 4:5):
"Inspired by Ad #1 (ROAS 16x). Casual smartphone photo, slightly tilted angle, taken from first-person POV at a typical Vietnamese family dinner table. The main dish is in the foreground, slightly off-center to the left. Background shows other dishes, a rice cooker, condiment bottles, and someone's elbow across the table. Warm yellowish indoor lighting from overhead fluorescent tube, creating slight color cast. Table surface is a common formica/plastic top with some water drops and used napkins nearby. A pair of chopsticks resting on the bowl edge. The photo has natural smartphone depth of field — foreground sharp, background slightly soft. Slight motion blur on the steam. The whole scene feels like someone just sat down to eat and quickly snapped a photo to share on Facebook. NOT a professional photo, NOT studio lighting, NOT perfectly composed. Authentic, messy, real. Aspect ratio: 4:5 portrait (1080x1350px)."

Số lượng ảnh: 1, 2, hoặc 4 (tuỳ content format)
DÙNG TIẾNG ANH cho image prompt

Trả lời JSON (không markdown, không \`\`\`):
{
  "caption": "Nội dung caption đầy đủ...",
  "imageCount": 1 | 2 | 4,
  "imagePrompts": [
    "Extremely detailed UGC-style smartphone photo prompt... Aspect ratio: 4:5 portrait (1080x1350px)."
  ],
  "keyMessage": "Thông điệp chính trong 1 câu",
  "inspirationSource": "Lấy cảm hứng chính từ Ad #X (tên ad, ROAS Xx) vì: lý do"
}`;
}
// ===================================================================
// STEP 2: GENERATE IMAGES (Gemini 3 Pro Image Preview)
// ===================================================================

// Xác định aspect ratio dựa trên số lượng ảnh tổng
function getAspectRatioSpec(imageCount: number): { ratio: string; resolution: string; instruction: string } {
    switch (imageCount) {
        case 2:
            return { ratio: '4:5', resolution: '1080x1350', instruction: 'PORTRAIT 4:5 aspect ratio (1080x1350px). Two images will display as vertical columns side by side on Facebook feed.' };
        case 4:
            return { ratio: '1:1', resolution: '1080x1080', instruction: 'SQUARE 1:1 aspect ratio (1080x1080px). Four images will display as a 2x2 grid on Facebook feed.' };
        default: // 1 image
            return { ratio: '4:5', resolution: '1080x1350', instruction: 'PORTRAIT 4:5 aspect ratio (1080x1350px). Single image maximizes vertical screen real estate on mobile Facebook feed.' };
    }
}

async function generateImage(
    client: OpenAI,
    prompt: string,
    referenceImageUrls: string[],
    imageCount: number,
): Promise<string | null> {
    try {
        const aspectSpec = getAspectRatioSpec(imageCount);

        // Build multimodal content: ultra-detailed photography prompt + reference images
        const contentParts: any[] = [
            {
                type: 'text',
                text: `You are creating an AUTHENTIC smartphone photo that looks like a REAL PERSON took it and posted on social media. This is for a Vietnamese Facebook ad.

CRITICAL IDENTITY: You are NOT a professional photographer. You are a REGULAR PERSON casually taking a quick photo with your phone to share with friends on Facebook. The photo should feel SPONTANEOUS and LIVED-IN.

⚠️ MANDATORY ASPECT RATIO: ${aspectSpec.instruction}
The image MUST be generated in ${aspectSpec.ratio} ratio (${aspectSpec.resolution}). This is NON-NEGOTIABLE.

REFERENCE IMAGES: Study the attached reference images. Match their overall vibe and mood, but make the output feel MORE CASUAL and AUTHENTIC — like a real customer sharing their experience.

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

OUTPUT: A single authentic-looking smartphone photo in ${aspectSpec.ratio} aspect ratio.`,
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
                const image = await generateImage(client, prompt, referenceUrls, captionResult.imageCount);
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
