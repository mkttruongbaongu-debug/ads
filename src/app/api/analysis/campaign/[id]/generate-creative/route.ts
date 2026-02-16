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

### Phong cách: Xiaohongshu food photography — đẹp mà tự nhiên

Mỗi image prompt PHẢI ngắn gọn (50-80 từ tiếng Anh), tập trung vào:
1. **Subject**: Mô tả món ăn chính xác — loại, hình dáng, màu sắc, texture thực tế
2. **Action**: Hành động đang diễn ra (tay cầm đũa gắp, muỗng múc, rót nước sốt...)
3. **Mood**: Tông màu, ánh sáng, cảm giác chung
4. **Context**: Bối cảnh ngắn gọn (bàn ăn, quán, bếp nhà)

### ĐỘ CHÍNH XÁC VẬT LÝ (CỰC KỲ QUAN TRỌNG):
- Mô tả texture thức ăn ĐÚNG thực tế:
  + Cá sống/sashimi → "semi-translucent, glistening raw flesh, visible grain"
  + Thịt nấu chín → "opaque, caramelized, firm"
  + Đồ chiên → "crispy golden crust"
  + Nước sốt → "glossy, viscous"
- KHÔNG thêm steam/khói cho MÓN LẠNH (sashimi, gỏi, salad, đồ ngâm lạnh, sushi)
- CHỈ mô tả steam cho MÓN NÓNG (phở, cơm nóng, đồ nướng, lẩu)
- Mô tả MÀU SẮC thực tế — cá hồi = cam hồng, thịt kho = nâu caramel, rau = xanh tươi

### QUY TẮC VIẾT PROMPT CHO SEEDREAM:
- NGẮN GỌN: 50-80 từ. Seedream hiểu prompt ngắn tốt hơn prompt dài
- KHÔNG liệt kê chi tiết background quá cụ thể (loại đèn, loại bàn, loại sàn)
- KHÔNG nói "NOT AI-generated" hoặc "NOT stock photo" — chỉ mô tả cái BẠN MUỐN, không nói cái không muốn
- KHÔNG nói "phone camera noise" hoặc "slight blur" — Seedream sẽ làm ảnh xấu
- Tập trung mô tả: subject + action + lighting mood + background ngắn
- Background: "casually busy" — có các đĩa khác, gia vị, ly nước xung quanh — nhưng bàn/bề mặt PHẢI SẠCH SẼ, KHÔNG có vết bẩn, nước đổ, hay đồ bẩn

❌ CẤM trong image prompt:
- Prompt dài hơn 100 từ
- Liệt kê 5+ chi tiết background
- Mô tả camera specs (iPhone 14, Samsung S23...)
- Nói "NOT studio", "NOT professional" — chỉ nói cái muốn thôi
- Thêm steam/khói cho món lạnh
- Dùng từ "messy", "cluttered", "dirty" — thay bằng "casually busy", "lived-in"
- Background bẩn, có vết ố, nước sốt vương vãi

✅ VÍ DỤ PROMPT CHUẨN:
"Xiaohongshu food photo. Hand with chopsticks lifting a piece of semi-translucent soy-marinated salmon sashimi from a dark ceramic bowl. The raw fish glistens with soy sauce and sesame seeds. Warm ambient lighting, shallow depth of field. Clean table with other dishes and condiment bottles in blurred background. Close-up, appetizing. Aspect ratio: 3:4."

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
    for (let attempt = 1; attempt <= 3; attempt++) {
        const useRef = attempt === 1 ? refBase64 : null;
        if (attempt === 2) {
            log(`[IMG] 🔄 RETRY attempt 2 — generating WITHOUT reference image`);
        } else if (attempt === 3) {
            log(`[IMG] 🔄 RETRY attempt 3 — simplified prompt, no reference`);
        }

        try {
            const aspectSpec = getAspectRatioSpec(imageCount);

            // For attempt 3, simplify the prompt
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

            // ─── Use stream: true — OpenRouter always streams image gen anyway ───
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

            // ─── Read SSE stream chunk by chunk ───
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

            // ─── Extract image from accumulated data ───
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

    console.log(`[GENERATE_CREATIVE] 🎨 Campaign ${campaignId} — STREAMING pipeline, mode = ${mode} `);
    console.log(`[GENERATE_CREATIVE] 📎 Reference URLs count: ${referenceUrls.length} `);
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
                            text: `\n[Ảnh tham khảo #${i + 1}]: `,
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
                    const fenceMatch = cleaned.match(/```(?: json) ?\s *\n ? ([\s\S] *?) \n ?\s * ```/);
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

                // ─── STEP 2: Send image plan (client will fetch images separately) ────────────
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

                // Build image plan: which prompt + which ref for each image
                const imagePlan: { prompt: string; referenceImageUrl: string | null }[] = [];
                for (let idx = 0; idx < effectiveImageCount; idx++) {
                    let refImage: string | null = null;
                    if (mode === 'clone') {
                        refImage = referenceUrls[idx] || null;
                    } else if (mode === 'inspired') {
                        refImage = referenceUrls[idx % referenceUrls.length] || null;
                    }
                    imagePlan.push({ prompt: effectivePrompts[idx], referenceImageUrl: refImage });
                }

                console.log(`[GENERATE_CREATIVE] 📋 Image plan: ${effectiveImageCount} images, ${effectivePrompts.length} prompts`);

                // Send image plan to client — client will call /generate-image for each
                send({
                    type: 'image_plan',
                    data: {
                        imageCount: effectiveImageCount,
                        images: imagePlan,
                    },
                });

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
