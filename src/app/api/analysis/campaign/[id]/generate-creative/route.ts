/**
 * ===================================================================
 * API: GENERATE CREATIVE (Caption + Image) — STREAMING
 * ===================================================================
 * Route: POST /api/analysis/campaign/[id]/generate-creative
 *
 * Input: Creative Brief + Top Ads data
 * Output: NDJSON Stream — caption first, then images one-by-one
 *
 * Pipeline:
 * 1. Gemini 2.5 Flash → Caption + Image Prompt
 * 2. Gemini 3 Pro Image Preview → Generate images (streamed 1 by 1)
 * ===================================================================
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';

// Extend serverless timeout (Vercel/Netlify)
export const maxDuration = 300; // 5 minutes

// ===================================================================
// STEP 1: GENERATE CAPTION + IMAGE PROMPT (Gemini 2.5 Flash)
// ===================================================================

function buildCaptionPrompt(briefData: any, referenceImageCount?: number, referenceImageUrls?: string[]): string {
    const { creativeBrief, winningPatterns, topAds, campaignName, genMode, winnerCaption } = briefData;
    const mode = genMode || 'inspired';

    // Mode-specific mission description
    let missionBlock = '';
    if (mode === 'clone' && winnerCaption) {
        missionBlock = `## CHẾ ĐỘ: NHÂN BẢN (SPIN)
⚠️ BẮT BUỘC: SPIN caption gốc bên dưới.
GIỮ NGUYÊN: nhịp câu, tone, CTA, độ dài tương đương.
ĐỔI: từ ngữ khác (paraphrase), chi tiết cụ thể khác.

CAPTION GỐC CẦN SPIN:
"""
${winnerCaption}
"""

Image prompts phải MATCH nội dung caption mới.`;
    } else if (mode === 'fresh') {
        missionBlock = `## CHẾ ĐỘ: SÁNG TẠO MỚI
Viết caption HOÀN TOÀN MỚI, góc tiếp cận KHÁC winning ads.
Chỉ dựa trên Creative Brief + thông tin sản phẩm.`;
    } else {
        // inspired (default)
        missionBlock = `## CHẾ ĐỘ: LẤY CẢM HỨNG
Học phong cách winning ads (cách dùng từ, nhịp câu, cảm xúc).
Tạo bản MỚI nhưng GIỮ phong cách đã chứng minh hiệu quả.
KHÔNG copy nguyên văn.`;
    }

    if (mode === 'clone') {
        missionBlock += `\n\n⛔ QUY TẮC SẢN PHẨM:
- Sản phẩm caption spin PHẢI GIỐNG Y caption gốc
- KHÔNG thay đổi, KHÔNG trộn lẫn sản phẩm khác
- Image prompts PHẢI mô tả ĐÚNG sản phẩm trong caption gốc`;
    }

    const briefBlock = mode === 'clone' ? `## STYLE GUIDELINES
- Caption Guideline: ${creativeBrief?.captionGuideline || 'N/A'}
- Visual Direction: ${creativeBrief?.visualDirection || 'N/A'}
- CTA: ${creativeBrief?.ctaRecommendation || 'N/A'}` : `## CREATIVE BRIEF
- Summary: ${creativeBrief?.summary || 'N/A'}
- Target Audience: ${creativeBrief?.targetAudience || 'N/A'}
- Content Format: ${creativeBrief?.contentFormat || 'N/A'}
- Caption Guideline: ${creativeBrief?.captionGuideline || 'N/A'}
- Visual Direction: ${creativeBrief?.visualDirection || 'N/A'}
- CTA: ${creativeBrief?.ctaRecommendation || 'N/A'}`;

    const captionExamplesBlock = mode === 'clone' ? '' :
        (mode !== 'fresh' && creativeBrief?.captionExamples?.length ? `## CAPTION MẪU TỪ ADS THẮNG
${creativeBrief.captionExamples.map((ex: string, i: number) => `${i + 1}. \"${ex}\"`).join('\n')}` : '');

    const winningPatternsBlock = mode === 'clone' ? '' :
        (mode !== 'fresh' ? `## WINNING PATTERNS
${winningPatterns?.map((p: any) => `- [${p.category}] ${p.pattern} (Evidence: ${p.evidence})`).join('\n') || 'N/A'}` : '');

    const topAdsBlock = mode === 'clone' ? '' :
        (mode !== 'fresh' ? `## TOP ADS THẮNG
${topAds?.map((ad: any, i: number) => `- Ad #${i + 1} \"${ad.name}\" (ROAS ${ad.roas?.toFixed(1)}x, CPP ${ad.cpp?.toLocaleString()}): ${ad.whyItWorks}`).join('\n') || 'N/A'}` : '');

    return `Bạn là copywriter Facebook Việt Nam — chuyên viết caption TỰ NHIÊN, NGẮN GỌN, đọc như NGƯỜI THẬT chia sẻ, KHÔNG PHẢI quảng cáo.

## PHONG CÁCH CAPTION BẮT BUỘC

### TRIẾT LÝ: "Viết như nhắn tin cho bạn bè, không viết như quảng cáo"

CAPTION PHẢI:
- NGẮN GỌN: Tối đa 5-7 dòng. Mỗi dòng ngắn, dễ đọc trên điện thoại
- TỰ NHIÊN 100%: Viết đúng giọng nói đời thường của người Việt (có thể hơi xuề xoà, thân mật)
- KHÔNG CÓ TIÊU ĐỀ: Không ✨ TIÊU ĐỀ IN HOA, không --- phân cách, không bullet points
- HOOK MẠNH: 1 câu đầu phải khiến người ta dừng scroll — gây tò mò, shock nhẹ, hoặc đồng cảm
- THẲNG VÀO VẤN ĐỀ: Không dẫn dắt vòng vo, không "Bạn có bao giờ...", không mở bài dài dòng
- KẾT THÚC GỌN: CTA nhẹ nhàng, tự nhiên (inbox, comment, hoặc link) — không ép buộc

CẤU TRÚC LÝ TƯỞNG (Alex Hormozi style thuần Việt):
Dòng 1: Hook — 1 câu gây tò mò / shock nhẹ / nhận định thẳng
Dòng 2-4: Value — chia sẻ trải nghiệm / review thật / mẹo hay (ngắn, cụ thể, có số liệu nếu được)
Dòng 5-6: CTA tự nhiên — "inbox mình", "link ở comment", hoặc thông tin liên hệ

❌ TUYỆT ĐỐI CẤM (nếu vi phạm = FAIL):
- Caption dài hơn 10 dòng
- Có tiêu đề / header / phân cách bằng emoji dàn hàng (🔥🔥🔥)
- Giọng điệu "chuyên gia" hoặc "thương hiệu" — phải là giọng người thật
- Mở bài kiểu "Bạn đã bao giờ...", "Xin chào...", "Giới thiệu đến bạn..."
- Liệt kê nhiều bullet points — quá quảng cáo
- Câu CTA ép buộc kiểu "MUA NGAY", "ĐẶT HÀNG NGAY HÔM NAY", "ĐỪNG BỎ LỠ"
- Lặp lại ý — mỗi dòng phải có thông tin MỚI
- Viết hoa toàn bộ để nhấn mạnh

✅ VÍ DỤ CAPTION CHUẨN (tone tự nhiên Việt):
---
Thịt kho tàu mà kho kiểu này thì cơm 3 bát chứ không đùa 😂

Mẹo là phi hành cho thơm trước, rim vỏ trứng trước khi thả vào, nước dừa tươi chứ đừng dùng nước dừa hộp.

Ăn nóng với cơm trắng, kèm dưa leo + canh chua.

Ship Huế, inbox mình nhé.
---

## NHIỆM VỤ
${mode === 'clone' ? 'SPIN caption gốc thành caption mới, giữ nguyên sản phẩm và phong cách.' : 'Tạo:'}
1. **Caption** — tự nhiên, ngắn gọn, đọc như NGƯỜI THẬT chia sẻ
2. **Image prompts CHI TIẾT** — mô tả ảnh kiểu NGƯỜI THẬT CHỤP BẰNG ĐIỆN THOẠI (UGC / POV style)

## CHIẾN DỊCH: ${campaignName}

${missionBlock}

${briefBlock}

${captionExamplesBlock}

${winningPatternsBlock}

${topAdsBlock}

## IMAGE PROMPT REQUIREMENTS

### Phong cách TUYỆT ĐỐI: UGC / POV (User-Generated Content / Point-of-View)

Mỗi image prompt PHẢI mô tả ảnh trông như "NGƯỜI THẬT chụp bằng ĐIỆN THOẠI ở đời thường":

1. **Camera**: LUÔN LÀ smartphone camera (iPhone 13/14/15, Samsung Galaxy S23/S24). KHÔNG BAO GIỜ dùng DSLR, mirrorless, hay bất kỳ camera chuyên nghiệp nào.
2. **Góc chụp**: Slightly tilted (2-5 degrees), first-person POV, selfie-with-product, or casual overhead. KHÔNG BAO GIỜ centered/symmetrical.
3. **Ánh sáng**: Chỉ dùng ánh sáng thực tế tại chỗ:
   - Trong nhà: đèn huỳnh quang trần (ánh vàng), đèn LED (ánh trắng lạnh), ánh sáng cửa sổ
   - Quán ăn: đèn neon, đèn treo warm, ánh sáng lẫn từ nhiều nguồn
   - Ngoài trời: nắng tự nhiên, bóng râm, golden hour
   → KHÔNG BAO GIỜ studio lighting, softbox, ring light
4. **Background**: LUÔN messy/cluttered — nền thực tế không dọn dẹp:
   - Đồ ăn: bàn ăn có ly nước dùng dở, khăn giấy, chai nước mắm, bát đũa lung tung
   - Mỹ phẩm/skincare: bàn trang điểm có gương, bông tẩy trang, vài lọ khác bày bừa, điện thoại
   - Thời trang: phòng thử đồ có gương, tủ quần áo, sàn có giày dép, túi shopping
   - Nội thất/gia dụng: phòng khách/bếp thật có remote TV, ly cà phê, sách báo, dép đi trong nhà
   - Đồ công nghệ: bàn làm việc có dây sạc, ly cà phê, sticky note, chuột bàn phím
   - Ngoài trời: quán cà phê vỉa hè, công viên, xe máy đậu gần, ghế nhựa
   → Luôn có 2-3 vật dụng "thừa" không liên quan sản phẩm để tạo cảm giác đời thường
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

Số lượng ảnh: ${mode === 'clone' && referenceImageCount ? referenceImageCount : '1, 2, hoặc 4 (tuỳ content format)'}
${mode === 'clone' && referenceImageCount ? `⚠️ BẮT BUỘC: imageCount PHẢI = ${referenceImageCount} và imagePrompts PHẢI có ĐÚNG ${referenceImageCount} prompt riêng biệt (mỗi prompt mô tả 1 ảnh khác nhau).` : ''}
${referenceImageUrls && referenceImageUrls.length > 0 ? `
## ẢNH THAM KHẢO ĐÃ ĐÍNH KÈM
⚠️ QUAN TRỌNG: ${referenceImageUrls.length} ảnh tham khảo đã được đính kèm bên dưới (Ảnh tham khảo #1, #2, ...).
Bạn PHẢI viết imagePrompts THEO THỨ TỰ TƯƠNG ỨNG:
- imagePrompts[0] → mô tả ảnh MỚI lấy CẢM HỨNG từ Ảnh tham khảo #1 (cùng góc chụp, bố cục, sản phẩm, nhưng khác chi tiết)
- imagePrompts[1] → mô tả ảnh MỚI lấy CẢM HỨNG từ Ảnh tham khảo #2
- ... và tương tự cho các ảnh còn lại
Mỗi prompt phải MATCH với ảnh tham khảo tương ứng — nhìn ảnh ref rồi mô tả ảnh mới giống kiểu đó.` : ''}
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

// Validate if a URL is accessible (quick HEAD check)
async function isUrlAccessible(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
        const res = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
        });
        clearTimeout(timeout);
        return res.ok; // 200-299
    } catch {
        return false;
    }
}

// Download image and convert to base64 for inline_data
async function downloadImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
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
    sendDebug?: (msg: string) => void,
): Promise<string | null> {
    const log = (msg: string) => {
        console.log(msg);
        sendDebug?.(msg);
    };

    // ─── Download reference image as base64 (OpenRouter/Gemini can't fetch Facebook CDN directly) ───
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

    // ─── Attempt generation (with retry) ───
    for (let attempt = 1; attempt <= 2; attempt++) {
        const useRef = attempt === 1 ? refBase64 : null;
        if (attempt === 2) {
            log(`[IMG] 🔄 RETRY attempt 2 — generating WITHOUT reference image`);
        }

        try {
            const aspectSpec = getAspectRatioSpec(imageCount);

            const contentParts: any[] = [
                {
                    type: 'text',
                    text: `You are creating an AUTHENTIC smartphone photo that looks like a REAL PERSON took it and posted on social media. This is for a Vietnamese Facebook ad.

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

OUTPUT: A single authentic-looking smartphone photo in ${aspectSpec.ratio} aspect ratio.`,
                },
            ];

            if (useRef) {
                contentParts.push({
                    type: 'image_url',
                    image_url: { url: `data:${useRef.mimeType};base64,${useRef.data}` },
                });
            }

            log(`[IMG] Calling OpenRouter (attempt ${attempt}, ref=${useRef ? 'YES' : 'NO'})...`);

            // ─── Direct fetch() instead of OpenAI SDK to preserve raw multimodal response ───
            const TIMEOUT_MS = 120_000; // 2 minute timeout for image gen
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
                    stream: false,
                }),
                signal: abortCtrl.signal,
            });
            clearTimeout(timer);

            if (!rawRes.ok) {
                const errText = await rawRes.text().catch(() => '');
                log(`[IMG] ❌ OpenRouter HTTP ${rawRes.status}: ${errText.substring(0, 300)}`);
                throw new Error(`OpenRouter HTTP ${rawRes.status}`);
            }

            const contentType = rawRes.headers.get('content-type') || '';
            log(`[IMG] Response content-type: ${contentType}`);

            let message: any = null;

            // ─── Handle SSE Stream (OpenRouter may force streaming for image gen) ───
            if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
                log(`[IMG] ⚡ Streaming response detected — parsing SSE...`);
                const rawText = await rawRes.text();
                const lines = rawText.split('\n');
                let accumulatedContent = '';
                const accumulatedImages: any[] = [];

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.substring(6).trim();
                    if (data === '[DONE]') break;
                    try {
                        const chunk = JSON.parse(data);
                        const delta = chunk?.choices?.[0]?.delta;
                        if (!delta) continue;

                        // Accumulate text content
                        if (typeof delta.content === 'string') {
                            accumulatedContent += delta.content;
                        }
                        // Accumulate content array parts
                        if (Array.isArray(delta.content)) {
                            for (const part of delta.content) {
                                if (part?.inline_data?.data) {
                                    accumulatedImages.push(part);
                                } else if (part?.type === 'image_url' && part?.image_url?.url) {
                                    accumulatedImages.push(part);
                                }
                            }
                        }
                        // Accumulate images from delta.images
                        if (Array.isArray(delta.images)) {
                            accumulatedImages.push(...delta.images);
                        }
                    } catch {
                        // skip invalid JSON lines
                    }
                }

                log(`[IMG] SSE parsed: text_len=${accumulatedContent.length}, images=${accumulatedImages.length}`);

                // Build a pseudo-message object for unified extraction below
                message = {
                    content: accumulatedContent || null,
                    images: accumulatedImages.length > 0 ? accumulatedImages : undefined,
                };
            } else {
                // ─── Regular JSON response ───
                const rawJson = await rawRes.json();
                const choice = rawJson?.choices?.[0];
                message = choice?.message;
                log(`[IMG] JSON response: finish=${choice?.finish_reason}, content_type=${typeof message?.content}, is_array=${Array.isArray(message?.content)}, has_images=${!!message?.images}`);
            }

            // ─── DEBUG: Dump response structure ───
            if (Array.isArray(message?.content)) {
                log(`[IMG] Content parts: ${message.content.length}`);
                message.content.forEach((part: any, i: number) => {
                    const keys = Object.keys(part || {});
                    log(`[IMG] part[${i}]: type=${part?.type || 'none'} keys=[${keys.join(',')}]${part?.inline_data ? ' HAS_INLINE_DATA' : ''}`);
                });
            } else if (typeof message?.content === 'string') {
                log(`[IMG] Content string len=${message.content.length}`);
            }
            if (message?.images?.length > 0) {
                log(`[IMG] Images array: ${message.images.length} items`);
                message.images.forEach((img: any, i: number) => {
                    log(`[IMG] images[${i}]: type=${img?.type}, has_url=${!!img?.image_url?.url}, url_len=${img?.image_url?.url?.length || 0}`);
                });
            }

            // ─── Extract image — Priority: message.images > content array > content string ───

            // Format 1: message.images array (OpenRouter standard for image gen)
            if (message?.images?.length > 0) {
                const img = message.images[0];
                const url = img?.image_url?.url || img?.url || (typeof img === 'string' ? img : null);
                if (url) {
                    log(`[IMG] ✅ Found image in .images[] (${url.substring(0, 50)}...)`);
                    return url;
                }
            }

            // Format 2: content array with inline_data (Gemini native via OpenRouter)
            if (Array.isArray(message?.content)) {
                for (const part of message.content) {
                    // Gemini inline_data format
                    if (part?.inline_data?.data) {
                        const mime = part.inline_data.mime_type || 'image/png';
                        log(`[IMG] ✅ Found inline_data (${mime}, ${Math.round(part.inline_data.data.length / 1024)}KB)`);
                        return `data:${mime};base64,${part.inline_data.data}`;
                    }
                    // OpenRouter image_url format
                    if (part?.type === 'image_url' && part?.image_url?.url) {
                        log(`[IMG] ✅ Found image_url in content`);
                        return part.image_url.url;
                    }
                    // Generic image part
                    if (part?.type === 'image' && (part?.url || part?.image_url?.url)) {
                        log(`[IMG] ✅ Found image part`);
                        return part.url || part.image_url.url;
                    }
                    // Data URL embedded in text
                    if (part?.type === 'text' && typeof part?.text === 'string') {
                        const m = part.text.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
                        if (m) { log(`[IMG] ✅ Found data URL in text`); return m[0]; }
                    }
                }
            }

            // Format 3: content is string with embedded data URL
            if (typeof message?.content === 'string' && message.content.length > 0) {
                const base64Match = message.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
                if (base64Match) { log(`[IMG] ✅ Found data URL in content string`); return base64Match[0]; }
            }

            log(`[IMG] ⚠️ No image extracted from response. Message keys: ${JSON.stringify(Object.keys(message || {}))}`);

            if (attempt === 1 && refBase64) {
                log(`[IMG] Will retry without ref...`);
                continue;
            }
            return null;

        } catch (error: any) {
            const errMsg = error?.message || String(error);
            log(`[IMG] ❌ FAILED (attempt ${attempt}): ${errMsg}`);

            if (attempt === 1 && refBase64) {
                log(`[IMG] Will retry without ref...`);
                continue;
            }
            return null;
        }
    }
    return null;
}

// ===================================================================
// MAIN HANDLER — STREAMING NDJSON
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
        return new Response(
            JSON.stringify({ type: 'error', error: 'Invalid JSON body' }) + '\n',
            { status: 400, headers: { 'Content-Type': 'application/x-ndjson' } }
        );
    }

    const { genMode, winnerCaption, creativeBrief, winningPatterns, topAds, campaignName, topAdImageUrls } = body;

    if (!creativeBrief) {
        return new Response(
            JSON.stringify({ type: 'error', error: 'creativeBrief is required' }) + '\n',
            { status: 400, headers: { 'Content-Type': 'application/x-ndjson' } }
        );
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
        return new Response(
            JSON.stringify({ type: 'error', error: 'OPENROUTER_API_KEY not configured' }) + '\n',
            { status: 500, headers: { 'Content-Type': 'application/x-ndjson' } }
        );
    }

    const client = new OpenAI({
        apiKey: openrouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
            'HTTP-Referer': 'https://ads.supbaongu.vn',
            'X-Title': 'THO ADS AI - Creative Studio',
        },
    });

    const referenceUrls: string[] = topAdImageUrls || [];
    const mode = genMode || 'inspired';

    console.log(`[GENERATE_CREATIVE] 🎨 Campaign ${campaignId} — STREAMING pipeline, mode=${mode}`);
    console.log(`[GENERATE_CREATIVE] 📎 Reference URLs count: ${referenceUrls.length}`);
    referenceUrls.forEach((url, i) => console.log(`[GENERATE_CREATIVE] 📎 ref[${i}]: ${url.substring(0, 120)}...`));

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: any) => {
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
            };

            try {
                // ─── STEP 1: Generate Caption + Image Prompts ────────────
                send({ type: 'step', message: 'Đang tạo caption & image prompts...' });

                const captionPrompt = buildCaptionPrompt({
                    creativeBrief,
                    winningPatterns,
                    topAds,
                    campaignName,
                    genMode: mode,
                    winnerCaption: winnerCaption || '',
                }, mode === 'clone' ? referenceUrls.length : undefined, referenceUrls);

                // Build multimodal content: text prompt + reference images
                const captionContentParts: any[] = [{ type: 'text', text: captionPrompt }];
                if (referenceUrls.length > 0) {
                    referenceUrls.forEach((url, i) => {
                        captionContentParts.push({
                            type: 'text',
                            text: `\n[Ảnh tham khảo #${i + 1}]:`,
                        });
                        captionContentParts.push({
                            type: 'image_url',
                            image_url: { url },
                        });
                    });
                }

                const captionResponse = await client.chat.completions.create({
                    model: 'google/gemini-2.5-flash',
                    messages: [{ role: 'user', content: captionContentParts }],
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
                    let cleaned = captionText;
                    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
                    if (fenceMatch) cleaned = fenceMatch[1];
                    const startIdx = cleaned.indexOf('{');
                    if (startIdx === -1) throw new Error('No JSON object found');
                    let depth = 0;
                    let endIdx = -1;
                    for (let i = startIdx; i < cleaned.length; i++) {
                        if (cleaned[i] === '{') depth++;
                        else if (cleaned[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
                    }
                    if (endIdx === -1) throw new Error('Unbalanced JSON braces');
                    captionResult = JSON.parse(cleaned.substring(startIdx, endIdx + 1));
                } catch {
                    console.error('[GENERATE_CREATIVE] ❌ Failed to parse caption JSON:', captionText.slice(0, 500));
                    send({ type: 'error', error: 'AI trả về format không hợp lệ. Vui lòng thử lại.' });
                    controller.close();
                    return;
                }

                console.log(`[GENERATE_CREATIVE] ✅ Caption generated, ${captionResult.imageCount} images requested`);

                // Stream caption result immediately
                send({
                    type: 'caption',
                    data: {
                        caption: captionResult.caption,
                        keyMessage: captionResult.keyMessage,
                        imageCount: captionResult.imageCount,
                        imagePrompts: captionResult.imagePrompts,
                        captionPrompt, // debug
                        referenceImageUrls: referenceUrls,
                    },
                });

                // ─── STEP 2: Generate Images ONE BY ONE ────────────
                let effectiveImageCount: number;
                if (mode === 'clone' && referenceUrls.length > 0) {
                    effectiveImageCount = referenceUrls.length;
                } else {
                    effectiveImageCount = captionResult.imageCount;
                }

                const effectivePrompts = captionResult.imagePrompts.slice(0, effectiveImageCount);
                while (effectivePrompts.length < effectiveImageCount) {
                    effectivePrompts.push(captionResult.imagePrompts[captionResult.imagePrompts.length - 1] || captionResult.imagePrompts[0]);
                }

                send({ type: 'step', message: `Đang tạo ${effectiveImageCount} ảnh...` });
                console.log(`[GENERATE_CREATIVE] 📋 Image plan: ${effectiveImageCount} images, ${effectivePrompts.length} prompts, ${referenceUrls.length} refs`);
                effectivePrompts.forEach((p, i) => console.log(`[GENERATE_CREATIVE] 📋 prompt[${i}]: ${p.substring(0, 80)}...`));

                for (let idx = 0; idx < effectiveImageCount; idx++) {
                    const prompt = effectivePrompts[idx];
                    let refImage: string | null = null;
                    if (mode === 'clone') {
                        refImage = referenceUrls[idx] || null;
                    } else if (mode === 'inspired') {
                        refImage = referenceUrls[idx % referenceUrls.length] || null;
                    }

                    send({ type: 'step', message: `Đang vẽ ảnh ${idx + 1}/${effectiveImageCount}...` });
                    // Stream debug info to client console
                    send({ type: 'debug', message: `Image ${idx + 1}: prompt=${prompt.substring(0, 60)}... | ref=${refImage ? refImage.substring(0, 80) + '...' : 'NONE'}` });
                    console.log(`[GENERATE_CREATIVE] 🖼️ Image ${idx + 1}/${effectiveImageCount} [${mode}] ref: ${refImage ? refImage.substring(0, 100) : 'NONE'}`);
                    console.log(`[GENERATE_CREATIVE] 🖼️ Image ${idx + 1} prompt: ${prompt.substring(0, 100)}...`);

                    const sendDebug = (msg: string) => send({ type: 'debug', message: msg });
                    const image = await generateImage(openrouterKey, prompt, refImage, effectiveImageCount, sendDebug);

                    send({
                        type: 'image',
                        index: idx,
                        total: effectiveImageCount,
                        data: image, // base64 or null
                    });

                    if (image) {
                        console.log(`[GENERATE_CREATIVE] ✅ Image ${idx + 1} generated`);
                    } else {
                        console.warn(`[GENERATE_CREATIVE] ⚠️ Image ${idx + 1} failed`);
                    }
                }

                // ─── DONE ────────────
                send({ type: 'done' });
                console.log(`[GENERATE_CREATIVE] 🎉 Streaming pipeline done`);

            } catch (error) {
                console.error('[GENERATE_CREATIVE] ❌', error);
                send({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
