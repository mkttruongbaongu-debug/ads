// API Route: AI Campaign Analysis with OpenAI
// Prompt designed like a Vietnam Market Ads Expert + Alex Hormozi style

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface CampaignData {
    id: string;
    name: string;
    status: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    leads?: number;
    purchases?: number;
    revenue?: number;
}

interface DailyTrend {
    date: string;
    spend: number;
    leads: number;
    cpl: number;
}

interface LocalInsight {
    type: string;
    title: string;
    message: string;
    action?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { campaign, dailyTrends, insights } = body as {
            campaign: CampaignData;
            dailyTrends: DailyTrend[];
            insights: LocalInsight[];
        };

        if (!campaign) {
            return NextResponse.json({ success: false, error: 'Missing campaign data' }, { status: 400 });
        }

        // Calculate derived metrics
        const cpl = campaign.leads && campaign.leads > 0 ? campaign.spend / campaign.leads : 0;
        const cvr = campaign.clicks > 0 && campaign.leads ? (campaign.leads / campaign.clicks) * 100 : 0;

        // Build context for AI
        const prompt = buildAdsExpertPrompt(campaign, dailyTrends, insights, cpl, cvr);

        // Call OpenAI with gpt-5-mini
        const completion = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Bạn là chuyên gia quảng cáo Facebook tại Việt Nam với 10+ năm kinh nghiệm. Bạn kết hợp phong cách phân tích dữ liệu sắc bén của Media Buyer chuyên nghiệp với tư duy content của Alex Hormozi. Trả lời ngắn gọn, thực tế, có hành động cụ thể.'
                },
                { role: 'user', content: prompt }
            ],
            max_tokens: 1000,
            temperature: 0.7,
        });

        const advice = completion.choices[0]?.message?.content || 'Không thể phân tích';

        // Token usage tracking
        const usage = completion.usage;
        const inputTokens = usage?.prompt_tokens || 0;
        const cachedTokens = usage?.prompt_tokens_details?.cached_tokens || 0;
        const outputTokens = usage?.completion_tokens || 0;

        // GPT-5-mini pricing (per 1M tokens)
        // Input: $0.25, Cached: $0.03, Output: $2.00
        const PRICING = {
            input: 0.25 / 1_000_000,      // $0.25 per 1M
            cached: 0.03 / 1_000_000,     // $0.03 per 1M  
            output: 2.00 / 1_000_000,     // $2.00 per 1M
            USD_TO_VND: 27000,            // Tỷ giá USD/VND (đã tính phí giao dịch)
        };

        const uncachedInputTokens = inputTokens - cachedTokens;

        // Chi phí chi tiết (USD)
        const costBreakdown = {
            input_tokens: uncachedInputTokens,
            input_cost_usd: uncachedInputTokens * PRICING.input,
            cached_tokens: cachedTokens,
            cached_cost_usd: cachedTokens * PRICING.cached,
            output_tokens: outputTokens,
            output_cost_usd: outputTokens * PRICING.output,
        };

        const totalCostUsd = costBreakdown.input_cost_usd + costBreakdown.cached_cost_usd + costBreakdown.output_cost_usd;
        const totalCostVnd = totalCostUsd * PRICING.USD_TO_VND;

        // Request metadata
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();

        return NextResponse.json({
            success: true,
            advice,
            metrics: { cpl, cvr },
            billing: {
                request_id: requestId,
                timestamp: timestamp,
                model: 'gpt-5-mini',

                // Token counts
                tokens: {
                    input: inputTokens,
                    input_uncached: uncachedInputTokens,
                    cached: cachedTokens,
                    output: outputTokens,
                    total: inputTokens + outputTokens,
                },

                // Chi phí chi tiết (USD)
                cost_usd: {
                    input: Number(costBreakdown.input_cost_usd.toFixed(8)),
                    cached: Number(costBreakdown.cached_cost_usd.toFixed(8)),
                    output: Number(costBreakdown.output_cost_usd.toFixed(8)),
                    total: Number(totalCostUsd.toFixed(8)),
                },

                // Chi phí chi tiết (VND) - để tính tiền user
                cost_vnd: {
                    input: Math.round(costBreakdown.input_cost_usd * PRICING.USD_TO_VND),
                    cached: Math.round(costBreakdown.cached_cost_usd * PRICING.USD_TO_VND),
                    output: Math.round(costBreakdown.output_cost_usd * PRICING.USD_TO_VND),
                    total: Math.round(totalCostVnd),
                },

                // Pricing info (để reference)
                pricing: {
                    model: 'gpt-5-mini',
                    input_per_1m: '$0.25',
                    cached_per_1m: '$0.03',
                    output_per_1m: '$2.00',
                    usd_to_vnd: PRICING.USD_TO_VND,
                }
            }
        });
    } catch (error) {
        console.error('AI analysis error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

function buildAdsExpertPrompt(
    campaign: CampaignData,
    dailyTrends: DailyTrend[],
    insights: LocalInsight[],
    cpl: number,
    cvr: number
): string {
    const trendSummary = dailyTrends.length > 0
        ? dailyTrends.map(t => `${t.date}: ${(t.spend / 1000).toFixed(0)}k spend, ${t.leads} data, CPL ${(t.cpl / 1000).toFixed(0)}k`).join('\n')
        : 'Không có dữ liệu trend theo ngày';

    const insightsSummary = insights.map(i => `- ${i.title}: ${i.message}`).join('\n');

    return `
CAMPAIGN CẦN PHÂN TÍCH:
- Tên: ${campaign.name}
- Trạng thái: ${campaign.status}
- Chi tiêu: ${campaign.spend.toLocaleString('vi-VN')}đ
- Impressions: ${campaign.impressions.toLocaleString()}
- Clicks: ${campaign.clicks.toLocaleString()}
- CTR: ${campaign.ctr.toFixed(2)}%
- CPC: ${campaign.cpc.toLocaleString('vi-VN')}đ
- Data/Leads: ${campaign.leads || 0}
- CPL: ${cpl > 0 ? (cpl / 1000).toFixed(0) + 'k' : 'Chưa có data'}
- CVR (Leads/Clicks): ${cvr.toFixed(2)}%

DIỄN BIẾN THEO NGÀY:
${trendSummary}

INSIGHTS TỪ HỆ THỐNG:
${insightsSummary || 'Chưa có insights'}

HÃY PHÂN TÍCH VÀ ĐƯA RA:

1. **ĐÁNH GIÁ TỔNG QUAN** (1-2 câu)
   - Campaign này đang ở mức nào? (Tốt/Trung bình/Kém)
   
2. **HÀNH ĐỘNG CỤ THỂ** (quan trọng nhất)
   Chọn 1 trong các quyết định:
   - 🟢 SCALE: Tăng ngân sách bao nhiêu %?
   - 🟡 GIỮ NGUYÊN: Theo dõi thêm bao lâu?
   - 🔴 TẮT: Tại sao cần tắt ngay?
   - 🔄 TỐI ƯU: Cần thay đổi gì?

3. **GỢI Ý CONTENT** (nếu CTR thấp hoặc CPL cao)
   - Hook mới theo style Alex Hormozi
   - Góc content thử nghiệm
   - Offer hấp dẫn hơn

4. **TARGETING** (nếu cần tối ưu)
   - Đề xuất audience mới
   - Loại trừ những ai?

QUAN TRỌNG:
- Viết ngắn gọn, đi thẳng vào vấn đề
- Dùng bullet points và emoji
- Đưa ra con số cụ thể (tăng 20%, CPL mục tiêu 50k, v.v.)
- Ưu tiên lợi nhuận và hiệu quả, không chạy theo vanity metrics
`;
}
