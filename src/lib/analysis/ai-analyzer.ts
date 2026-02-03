/**
 * AI Deep Analyzer - Phân tích sâu với GPT-5-mini
 * Đưa ra insight chi tiết, bao quát và thực tế
 */

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface CampaignContext {
    campaign: {
        id: string;
        name: string;
        status: string;
    };
    metrics: {
        spend: number;
        purchases: number;
        revenue: number;
        cpp: number;
        roas: number;
        ctr: number;
        cpm: number;
        frequency?: number;
    };
    dailyTrend: Array<{
        date: string;
        spend: number;
        purchases: number;
        cpp: number;
        ctr: number;
    }>;
    issues: Array<{
        type: string;
        message: string;
        detail: string;
    }>;
    // So sánh với các campaigns khác
    comparison?: {
        avgCpp: number;
        avgRoas: number;
        avgCtr: number;
        position: 'above_avg' | 'below_avg' | 'average';
    };
}

export interface AIAnalysisResult {
    summary: string;           // Tóm tắt 1-2 câu
    diagnosis: string;         // Chẩn đoán nguyên nhân
    marketContext: string;     // Bối cảnh thị trường
    actionPlan: {
        immediate: string;     // Làm ngay
        shortTerm: string;     // 2-3 ngày tới
        prevention: string;    // Phòng tránh sau này
    };
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;         // Giải thích lý do đưa ra khuyến nghị
}

const SYSTEM_PROMPT = `Bạn là một chuyên gia tối ưu quảng cáo Facebook cho ngành F&B (đồ ăn online) tại Việt Nam.

NHIỆM VỤ:
Phân tích dữ liệu campaign quảng cáo và đưa ra insight THỰC TẾ, CỤ THỂ, HÀNH ĐỘNG ĐƯỢC.

NGUYÊN TẮC PHÂN TÍCH:

1. CHẨN ĐOÁN NGUYÊN NHÂN - Xác định GỐC RỄ vấn đề:
   - CPP cao có thể do: content mòn, audience sai, thời điểm không phù hợp, đối thủ cạnh tranh
   - CTR giảm có thể do: creative nhàm chán, headline không hấp dẫn, offer không đủ mạnh
   - Không có đơn có thể do: landing page, giá cao, khu vực không phù hợp
   
2. XEM XÉT BỐI CẢNH:
   - Cuối tuần/đầu tuần: hành vi mua sắm khác nhau
   - Đầu tháng/cuối tháng: khả năng chi tiêu khác nhau
   - Thời tiết, sự kiện: ảnh hưởng đến demand
   - So sánh với chính campaign đó ở giai đoạn trước
   
3. KHUYẾN NGHỊ PHẢI CỤ THỂ:
   - ĐÚNG: "Giảm budget từ 500K xuống 250K trong 2 ngày"
   - SAI: "Nên tối ưu budget"
   
   - ĐÚNG: "Thay video hook đầu, 3 giây đầu cần có món ăn close-up"
   - SAI: "Nên thay content mới"

4. THÀNH THẬT VỀ GIỚI HẠN:
   - Nếu data không đủ để kết luận, nói rõ
   - Nếu có nhiều khả năng, liệt kê theo xác suất
   - Không đoán mò khi không có căn cứ

5. NGÔN NGỮ:
   - Dùng tiếng Việt tự nhiên
   - Không dùng từ ngữ marketing sáo rỗng
   - Nói thẳng vào vấn đề

FORMAT OUTPUT:
{
  "summary": "Tóm tắt 1-2 câu vấn đề chính",
  "diagnosis": "Nguyên nhân gốc rễ",
  "marketContext": "Bối cảnh thị trường/thời điểm ảnh hưởng gì không",
  "actionPlan": {
    "immediate": "Làm ngay hôm nay",
    "shortTerm": "Làm trong 2-3 ngày tới",
    "prevention": "Để không lặp lại sau này"
  },
  "confidence": "high/medium/low",
  "reasoning": "Giải thích tại sao đưa ra khuyến nghị này"
}`;

export async function analyzeWithAI(context: CampaignContext): Promise<AIAnalysisResult> {
    try {
        // Check API key
        if (!process.env.OPENAI_API_KEY) {
            console.error('AI Analysis error: OPENAI_API_KEY not configured');
            throw new Error('OPENAI_API_KEY not configured');
        }

        const userPrompt = buildUserPrompt(context);

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 1000,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        return JSON.parse(content) as AIAnalysisResult;
    } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        console.error('AI Analysis error:', errMessage);
        console.error('Full error:', error);

        // Fallback response with actual error message
        return {
            summary: 'Không thể phân tích do lỗi kỹ thuật',
            diagnosis: errMessage.includes('API key')
                ? 'API key chưa được cấu hình'
                : errMessage.includes('quota')
                    ? 'Hết quota OpenAI'
                    : 'Vui lòng thử lại sau',
            marketContext: '',
            actionPlan: {
                immediate: 'Kiểm tra lại sau 5 phút',
                shortTerm: '',
                prevention: '',
            },
            confidence: 'low',
            reasoning: `Lỗi kỹ thuật khi gọi AI: ${errMessage.substring(0, 100)}`,
        };
    }
}

function buildUserPrompt(context: CampaignContext): string {
    const { campaign, metrics, dailyTrend, issues, comparison } = context;

    // Format daily trend
    const trendText = dailyTrend.map(d =>
        `${d.date}: Spend ${formatMoney(d.spend)}, ${d.purchases} đơn, CPP ${formatMoney(d.cpp)}, CTR ${d.ctr.toFixed(2)}%`
    ).join('\n');

    // Format issues
    const issuesText = issues.map(i => `- ${i.message}: ${i.detail}`).join('\n');

    // Format comparison
    let comparisonText = '';
    if (comparison) {
        comparisonText = `
SO SÁNH VỚI CÁC CAMPAIGN KHÁC:
- CPP trung bình thị trường: ${formatMoney(comparison.avgCpp)}
- ROAS trung bình: ${comparison.avgRoas.toFixed(2)}x
- Vị trí: ${comparison.position === 'above_avg' ? 'Trên trung bình' : comparison.position === 'below_avg' ? 'Dưới trung bình' : 'Trung bình'}`;
    }

    return `CAMPAIGN: ${campaign.name}
Trạng thái: ${campaign.status}

TỔNG QUAN ${dailyTrend.length} NGÀY:
- Chi tiêu: ${formatMoney(metrics.spend)}
- Số đơn: ${metrics.purchases}
- Doanh thu: ${formatMoney(metrics.revenue)}
- CPP (chi phí/đơn): ${formatMoney(metrics.cpp)}
- ROAS: ${metrics.roas.toFixed(2)}x
- CTR: ${metrics.ctr.toFixed(2)}%
- CPM: ${formatMoney(metrics.cpm)}
${metrics.frequency ? `- Frequency: ${metrics.frequency.toFixed(1)}` : ''}

DIỄN BIẾN THEO NGÀY:
${trendText}

VẤN ĐỀ PHÁT HIỆN:
${issuesText || 'Không có vấn đề rõ ràng'}
${comparisonText}

Hãy phân tích và đưa ra khuyến nghị.`;
}

function formatMoney(amount: number): string {
    if (amount >= 1000000) {
        return (amount / 1000000).toFixed(1) + ' triệu';
    }
    if (amount >= 1000) {
        return (amount / 1000).toFixed(0) + 'K';
    }
    return amount.toLocaleString('vi-VN') + 'đ';
}
