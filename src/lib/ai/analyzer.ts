// OpenAI GPT Integration for Ads Analysis

import OpenAI from 'openai';
import { FBMetricsRow } from '../facebook/types';

// Lazy init OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
    if (!openaiClient) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not configured');
        }
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return openaiClient;
}

export interface AnalysisResult {
    summary: string;
    insights: string[];
    recommendations: string[];
    alerts: string[];
}

export interface AdsetRecommendation {
    adsetId: string;
    adsetName: string;
    action: 'PAUSE' | 'SCALE' | 'KEEP' | 'REVIEW';
    reason: string;
    confidence: number;
}

// System prompts cho các use cases
const SYSTEM_PROMPTS = {
    performance_analyst: `Bạn là chuyên gia phân tích quảng cáo Facebook cấp cao. 
Nhiệm vụ của bạn là phân tích dữ liệu metrics và đưa ra insights hữu ích bằng tiếng Việt.
Hãy tập trung vào:
- Xu hướng chi phí và hiệu suất
- So sánh các campaigns/adsets
- Phát hiện bất thường
- Đề xuất tối ưu cụ thể`,

    optimizer: `Bạn là chuyên gia tối ưu quảng cáo Facebook.
Dựa trên dữ liệu metrics, hãy đề xuất:
- Adsets nào nên TẮT (hiệu suất kém, chi phí cao)
- Adsets nào nên SCALE (hiệu suất tốt, tiềm năng)
- Adsets nào nên GIỮ NGUYÊN
Trả về JSON với format: { recommendations: AdsetRecommendation[] }`,

    content_analyst: `Bạn là chuyên gia phân tích content marketing.
Phân tích hiệu quả của các ads dựa trên metrics và đề xuất:
- Loại content nào đang hoạt động tốt
- Cần cải thiện gì về copy/creative
- Xu hướng tương tác của audience`,
};

// Phân tích hiệu suất tổng quan
export async function analyzePerformance(
    metrics: FBMetricsRow[],
    dateRange: { startDate: string; endDate: string }
): Promise<AnalysisResult> {
    const prompt = `
Phân tích dữ liệu quảng cáo từ ${dateRange.startDate} đến ${dateRange.endDate}:

${JSON.stringify(metrics.slice(0, 20), null, 2)}

${metrics.length > 20 ? `(Hiển thị 20/${metrics.length} dòng)` : ''}

Tổng chi phí: ${metrics.reduce((sum, m) => sum + m.spend, 0).toLocaleString()} VND
Tổng impressions: ${metrics.reduce((sum, m) => sum + m.impressions, 0).toLocaleString()}
Tổng clicks: ${metrics.reduce((sum, m) => sum + m.clicks, 0).toLocaleString()}

Hãy phân tích và trả về JSON với format:
{
  "summary": "Tóm tắt ngắn gọn hiệu suất",
  "insights": ["insight 1", "insight 2", ...],
  "recommendations": ["đề xuất 1", "đề xuất 2", ...],
  "alerts": ["cảnh báo 1 nếu có", ...]
}`;

    const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: SYSTEM_PROMPTS.performance_analyst },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
    });

    const content = response.choices[0].message.content || '{}';
    return JSON.parse(content);
}

// Đề xuất tắt/bật adsets
export async function getOptimizationRecommendations(
    metrics: FBMetricsRow[]
): Promise<AdsetRecommendation[]> {
    // Filter ra adset-level metrics
    const adsetMetrics = metrics.filter(m => m.adsetId);

    if (adsetMetrics.length === 0) {
        return [];
    }

    const prompt = `
Phân tích các adsets sau và đề xuất hành động:

${JSON.stringify(adsetMetrics.slice(0, 30), null, 2)}

Tiêu chí đánh giá:
- CTR < 1% và CPC > 5000 VND → Cân nhắc TẮT
- CTR > 2% và cost_per_result thấp → Cân nhắc SCALE
- Các trường hợp khác → GIỮ NGUYÊN hoặc CẦN REVIEW

Trả về JSON array:
{
  "recommendations": [
    {
      "adsetId": "123",
      "adsetName": "Tên adset",
      "action": "PAUSE|SCALE|KEEP|REVIEW",
      "reason": "Giải thích ngắn gọn",
      "confidence": 0.8
    }
  ]
}`;

    const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: SYSTEM_PROMPTS.optimizer },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
    });

    const content = response.choices[0].message.content || '{"recommendations":[]}';
    const parsed = JSON.parse(content);
    return parsed.recommendations || [];
}

// Chat với AI về dữ liệu
export async function chatWithAI(
    question: string,
    context: FBMetricsRow[]
): Promise<string> {
    const prompt = `
Dữ liệu quảng cáo hiện tại:
${JSON.stringify(context.slice(0, 15), null, 2)}

Câu hỏi của người dùng: ${question}

Hãy trả lời bằng tiếng Việt, ngắn gọn và hữu ích.`;

    const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: SYSTEM_PROMPTS.performance_analyst },
            { role: 'user', content: prompt },
        ],
        temperature: 0.7,
    });

    return response.choices[0].message.content || 'Không thể phân tích.';
}
