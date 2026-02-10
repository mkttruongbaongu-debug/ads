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
    content_type: 'IMAGE' | 'VIDEO' | 'UNKNOWN';
    image_url?: string;
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
        return `
#${rank}: "${ad.ad_name}"
- Content Type: ${ad.content_type}
- Caption: "${ad.caption?.slice(0, 300) || '(trống)'}"
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
- Trả lời HOÀN TOÀN bằng JSON, không thêm text.`;
}

// ===================================================================
// MAIN FUNCTION
// ===================================================================

export async function analyzeCreativeIntelligence(
    ads: AdPerformanceData[],
    openaiApiKey?: string
): Promise<CreativeIntelligenceResult> {
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

    // Filter ads with meaningful spend
    const meaningfulAds = ads.filter(a => a.metrics.spend > 50000);
    if (meaningfulAds.length < 2) {
        throw new Error('Cần ít nhất 2 ads có chi tiêu > 50K để phân tích');
    }

    console.log(`[CREATIVE_INTEL] 🎨 Phân tích ${meaningfulAds.length} ads...`);

    const openai = new OpenAI({ apiKey });
    const prompt = buildAnalysisPrompt(meaningfulAds);

    const response = await openai.chat.completions.create({
        model: 'o4-mini',
        messages: [
            { role: 'user', content: prompt },
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

    // Map to result type
    const sorted = [...meaningfulAds].sort((a, b) => b.metrics.roas - a.metrics.roas);

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
