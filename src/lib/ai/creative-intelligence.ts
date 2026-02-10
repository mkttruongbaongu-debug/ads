/**
 * ===================================================================
 * CREATIVE INTELLIGENCE ENGINE
 * ===================================================================
 * Phân tích WHY creative thắng/thua, rút ra winning patterns,
 * và tạo creative brief cho content mới.
 *
 * Input: Ads data + performance metrics
 * Output: Winning patterns + Creative brief
 * ===================================================================
 */

import OpenAI from 'openai';

// ===================================================================
// TYPES
// ===================================================================

export interface AdPerformanceData {
    ad_id: string;
    ad_name: string;
    caption: string;
    title?: string;
    cta?: string;
    content_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'UNKNOWN';
    image_url?: string;
    image_urls?: string[];
    metrics: {
        spend: number;
        purchases: number;
        revenue: number;
        cpp: number;
        roas: number;
        ctr: number;
        impressions: number;
        clicks: number;
    };
}

export interface WinningPattern {
    category: string;        // VD: "Caption Style", "CTA Type", "Content Format"
    pattern: string;         // VD: "Caption ngắn < 100 ký tự"
    evidence: string;        // VD: "3/5 top ads đều dùng"
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CreativeBrief {
    summary: string;
    targetAudience: string;
    contentFormat: string;       // Image / Video / Carousel
    captionGuideline: string;
    captionExamples: string[];   // 2-3 mẫu caption gợi ý
    visualDirection: string;
    ctaRecommendation: string;
    doList: string[];            // Nên làm
    dontList: string[];          // Không nên làm
    estimatedImpact: string;
}

export interface CreativeIntelligenceResult {
    winningPatterns: WinningPattern[];
    losingPatterns: WinningPattern[];
    creativeBrief: CreativeBrief;
    topAds: Array<{ name: string; cpp: number; roas: number; whyItWorks: string }>;
    bottomAds: Array<{ name: string; cpp: number; roas: number; whyItFails: string }>;
    overallHealth: 'EXCELLENT' | 'GOOD' | 'NEEDS_REFRESH' | 'CRITICAL';
    refreshUrgency: string;
}

// ===================================================================
// PROMPT
// ===================================================================

function buildAnalysisPrompt(ads: AdPerformanceData[]): string {
    // Sort by ROAS (best first)
    const sorted = [...ads].sort((a, b) => b.metrics.roas - a.metrics.roas);
    const top = sorted.slice(0, 5);
    const bottom = sorted.slice(-5).reverse();

    const formatAd = (ad: AdPerformanceData, rank: number) => {
        const imgCount = ad.image_urls?.length || (ad.image_url ? 1 : 0);
        const imgInfo = imgCount > 1 ? `(${imgCount} ảnh)` : imgCount === 1 ? '(1 ảnh)' : '(không có ảnh)';
        return `
#${rank}: "${ad.ad_name}"
- Content Type: ${ad.content_type} ${imgInfo}
- Caption: "${ad.caption?.slice(0, 400) || '(trống)'}"
- CTA: ${ad.cta || 'N/A'}
- Metrics: CPP=${Math.round(ad.metrics.cpp).toLocaleString()}₫, ROAS=${ad.metrics.roas.toFixed(2)}x, CTR=${ad.metrics.ctr.toFixed(2)}%, Spend=${Math.round(ad.metrics.spend).toLocaleString()}₫, Purchases=${ad.metrics.purchases}
`;
    };

    return `Bạn là Creative Strategist chuyên phân tích quảng cáo Facebook cho ngành F&B (thực phẩm, đồ uống) tại Việt Nam.

=== TOP PERFORMING ADS ===
${top.map((a, i) => formatAd(a, i + 1)).join('\n')}

=== BOTTOM PERFORMING ADS ===
${bottom.map((a, i) => formatAd(a, i + 1)).join('\n')}

=== TỔNG QUAN ===
- Tổng ads: ${ads.length}
- Ads có purchase: ${ads.filter(a => a.metrics.purchases > 0).length}
- CPP trung bình: ${Math.round(ads.reduce((s, a) => s + a.metrics.cpp, 0) / ads.length).toLocaleString()}₫
- ROAS trung bình: ${(ads.reduce((s, a) => s + a.metrics.roas, 0) / ads.length).toFixed(2)}x

Hãy phân tích và trả lời theo format JSON:
{
    "winning_patterns": [
        { "category": "...", "pattern": "...", "evidence": "...", "impact": "HIGH|MEDIUM|LOW" }
    ],
    "losing_patterns": [
        { "category": "...", "pattern": "...", "evidence": "...", "impact": "HIGH|MEDIUM|LOW" }
    ],
    "top_ads_analysis": [
        { "name": "...", "why_it_works": "giải thích ngắn gọn tại sao ad này hiệu quả" }
    ],
    "bottom_ads_analysis": [
        { "name": "...", "why_it_fails": "giải thích ngắn gọn tại sao ad này kém" }
    ],
    "creative_brief": {
        "summary": "tóm tắt 2-3 câu về hướng creative tiếp theo",
        "target_audience": "mô tả đối tượng dựa trên data",
        "content_format": "IMAGE hoặc VIDEO hoặc CAROUSEL — kèm lý do",
        "caption_guideline": "hướng dẫn viết caption (độ dài, tone, hook, CTA)",
        "caption_examples": ["mẫu caption 1", "mẫu caption 2", "mẫu caption 3"],
        "visual_direction": "hướng dẫn hình ảnh/video (màu sắc, bố cục, phong cách)",
        "cta_recommendation": "nút CTA nào nên dùng",
        "do_list": ["nên làm 1", "nên làm 2"],
        "dont_list": ["không nên làm 1", "không nên làm 2"],
        "estimated_impact": "ước lượng tác động nếu làm đúng brief"
    },
    "overall_health": "EXCELLENT|GOOD|NEEDS_REFRESH|CRITICAL",
    "refresh_urgency": "mô tả mức độ cấp bách cần refresh creative"
}

LƯU Ý:
- Phân tích DỰA TRÊN DATA thực tế, không đoán mò.
- So sánh TOP vs BOTTOM để tìm pattern khác biệt.
- Caption examples phải viết bằng tiếng Việt, phù hợp ngành F&B.
- Nếu có ẢNH đính kèm, hãy PHÂN TÍCH VISUAL:
  + Bố cục ảnh (composition, góc chụp, khoảng cách)
  + Màu sắc chủ đạo, tone ảnh (warm/cool/natural)
  + Food styling (cách sắp xếp món ăn, dụng cụ, background)
  + Text overlay (chữ trên ảnh, font, size, vị trí)
  + Số lượng ảnh tối ưu (1 ảnh đơn, 2 ảnh, 4 ảnh carousel)
  + So sánh visual giữa top ads vs bottom ads
- visual_direction trong creative_brief phải CỤ THỂ: mô tả chính xác ảnh nên trông như thế nào
- Trả lời HOÀN TOÀN bằng JSON, không thêm text.`;
}

// ===================================================================
// MAIN FUNCTION
// ===================================================================

export async function analyzeCreativeIntelligence(
    ads: AdPerformanceData[],
): Promise<CreativeIntelligenceResult> {
    // OpenRouter API cho phân tích media chuyên dụng
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openrouterKey && !openaiKey) {
        throw new Error('Missing OPENROUTER_API_KEY or OPENAI_API_KEY');
    }

    // Filter ads with meaningful spend
    const meaningfulAds = ads.filter(a => a.metrics.spend > 50000);
    if (meaningfulAds.length < 2) {
        throw new Error('Cần ít nhất 2 ads có chi tiêu > 50K để phân tích');
    }

    console.log(`[CREATIVE_INTEL] 🎨 Phân tích ${meaningfulAds.length} ads...`);

    // Ưu tiên OpenRouter (chuyên media analysis), fallback OpenAI
    const client = openrouterKey
        ? new OpenAI({
            apiKey: openrouterKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://tho-ads-ai.netlify.app',
                'X-Title': 'THO ADS AI - Creative Intelligence',
            },
        })
        : new OpenAI({ apiKey: openaiKey });

    const model = openrouterKey
        ? 'google/gemini-2.5-flash'  // Gemini 2.5 Flash — nhanh, mạnh phân tích media
        : 'o4-mini';

    console.log(`[CREATIVE_INTEL] 🔗 Using ${openrouterKey ? 'OpenRouter' : 'OpenAI'} → ${model}`);

    const prompt = buildAnalysisPrompt(meaningfulAds);

    // Build vision messages: text prompt + top ad images
    const sorted = [...meaningfulAds].sort((a, b) => b.metrics.roas - a.metrics.roas);
    const topAdsWithImages = sorted.slice(0, 5).filter(a => a.image_url || (a.image_urls && a.image_urls.length > 0));
    const bottomAdsWithImages = sorted.slice(-3).filter(a => a.image_url || (a.image_urls && a.image_urls.length > 0));

    // Build multimodal content: text + images
    const contentParts: any[] = [{ type: 'text', text: prompt }];

    // Add top ad images for AI vision analysis
    const addedImages: string[] = [];
    for (const ad of [...topAdsWithImages, ...bottomAdsWithImages]) {
        const urls = ad.image_urls?.length ? ad.image_urls : (ad.image_url ? [ad.image_url] : []);
        for (const url of urls.slice(0, 2)) { // Max 2 images per ad
            if (addedImages.length >= 8) break; // Max 8 images total
            if (url && !addedImages.includes(url)) {
                contentParts.push({
                    type: 'image_url',
                    image_url: { url, detail: 'low' },
                });
                contentParts.push({
                    type: 'text',
                    text: `↑ Ảnh của ad "${ad.ad_name}" (ROAS: ${ad.metrics.roas.toFixed(2)}x, CPP: ${Math.round(ad.metrics.cpp).toLocaleString()}₫)`,
                });
                addedImages.push(url);
            }
        }
    }

    console.log(`[CREATIVE_INTEL] 📸 Gửi ${addedImages.length} ảnh cho AI vision`);

    const response = await client.chat.completions.create({
        model,
        messages: [
            {
                role: 'user',
                content: addedImages.length > 0 ? contentParts : prompt,
            },
        ],
    });

    const content = response.choices[0]?.message?.content || '';
    console.log(`[CREATIVE_INTEL] 📝 AI response length: ${content.length}`);

    // Parse JSON
    let parsed: any;
    try {
        // Try to extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
        console.error('[CREATIVE_INTEL] ❌ Parse error:', err);
        throw new Error('AI trả về format không hợp lệ');
    }

    // Map to result type (sorted was defined above for vision)

    const result: CreativeIntelligenceResult = {
        winningPatterns: (parsed.winning_patterns || []).map((p: any) => ({
            category: p.category,
            pattern: p.pattern,
            evidence: p.evidence,
            impact: p.impact || 'MEDIUM',
        })),
        losingPatterns: (parsed.losing_patterns || []).map((p: any) => ({
            category: p.category,
            pattern: p.pattern,
            evidence: p.evidence,
            impact: p.impact || 'MEDIUM',
        })),
        creativeBrief: {
            summary: parsed.creative_brief?.summary || '',
            targetAudience: parsed.creative_brief?.target_audience || '',
            contentFormat: parsed.creative_brief?.content_format || '',
            captionGuideline: parsed.creative_brief?.caption_guideline || '',
            captionExamples: parsed.creative_brief?.caption_examples || [],
            visualDirection: parsed.creative_brief?.visual_direction || '',
            ctaRecommendation: parsed.creative_brief?.cta_recommendation || '',
            doList: parsed.creative_brief?.do_list || [],
            dontList: parsed.creative_brief?.dont_list || [],
            estimatedImpact: parsed.creative_brief?.estimated_impact || '',
        },
        topAds: (parsed.top_ads_analysis || []).map((a: any, i: number) => ({
            name: a.name,
            cpp: sorted[i]?.metrics.cpp || 0,
            roas: sorted[i]?.metrics.roas || 0,
            whyItWorks: a.why_it_works,
        })),
        bottomAds: (parsed.bottom_ads_analysis || []).map((a: any, i: number) => {
            const bottomAd = sorted[sorted.length - 1 - i];
            return {
                name: a.name,
                cpp: bottomAd?.metrics.cpp || 0,
                roas: bottomAd?.metrics.roas || 0,
                whyItFails: a.why_it_fails,
            };
        }),
        overallHealth: parsed.overall_health || 'GOOD',
        refreshUrgency: parsed.refresh_urgency || '',
    };

    console.log(`[CREATIVE_INTEL] ✅ ${result.winningPatterns.length} winning, ${result.losingPatterns.length} losing patterns`);
    return result;
}
