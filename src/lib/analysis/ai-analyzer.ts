/**
 * AI Deep Analyzer v2 - Phân tích đa chiều, kết luận dứt khoát
 * Không còn "Độ tin cậy" mơ hồ
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
    comparison?: {
        avgCpp: number;
        avgRoas: number;
        avgCtr: number;
        position: 'above_avg' | 'below_avg' | 'average';
    };
}

// =========================================
// NEW: AI Analysis Result v2
// =========================================
export interface AIAnalysisResult {
    // Cơ sở phân tích (thay thế confidence)
    dataBasis: {
        days: number;
        orders: number;
        spend: number;
    };

    // Phân tích 4 chiều
    dimensions: {
        financial: {
            status: 'excellent' | 'good' | 'warning' | 'critical';
            summary: string;
        };
        content: {
            status: 'excellent' | 'good' | 'warning' | 'critical';
            summary: string;
        };
        audience: {
            status: 'excellent' | 'good' | 'warning' | 'critical';
            summary: string;
        };
        trend: {
            direction: 'improving' | 'stable' | 'declining';
            summary: string;
        };
    };

    // Kết luận dứt khoát
    verdict: {
        action: 'SCALE' | 'MAINTAIN' | 'WATCH' | 'REDUCE' | 'STOP';
        headline: string;
        condition?: string;
    };

    // Action plan chi tiết
    actionPlan: {
        immediate: {
            action: string;
            reason: string;
        };
        shortTerm?: {
            action: string;
            trigger: string;
        };
        prevention?: string;
    };

    // Lý do chi tiết
    reasoning: string;

    // Legacy fields for backward compatibility
    summary?: string;
    diagnosis?: string;
    marketContext?: string;
    confidence?: 'high' | 'medium' | 'low';
}

const SYSTEM_PROMPT = `Bạn là QUÂN SƯ ADS - chuyên gia tối ưu quảng cáo Facebook cho ngành F&B Việt Nam.

NGUYÊN TẮC CỐT LÕI:
1. PHÂN TÍCH ĐA CHIỀU - Luôn nhìn từ 4 góc độ: Tài chính, Content, Audience, Trend
2. KẾT LUẬN DỨT KHOÁT - Không nói "có thể", "nên xem xét" mà phải rõ ràng
3. HÀNH ĐỘNG CỤ THỂ - "Tăng budget 30%" thay vì "Nên tối ưu budget"
4. DỰA TRÊN DATA - Mọi kết luận phải có số liệu chứng minh

CÁCH ĐÁNH GIÁ TỪNG CHIỀU:

💰 TÀI CHÍNH:
- ROAS >= 4: excellent | >= 2.5: good | >= 2: warning | < 2: critical
- CPP: So với TB của chính campaign đó

🎯 CONTENT:
- CTR >= 5%: excellent | >= 2%: good | >= 1%: warning | < 1%: critical
- Xem xét trend CTR (tăng/giảm)

👥 AUDIENCE:
- Frequency < 2: excellent | < 2.5: good | < 3: warning | >= 3: critical
- CPM tăng đột biến = warning

📈 TREND:
- So sánh 3 ngày gần vs 7 ngày: CPP giảm = improving, tăng > 20% = declining

CÁCH XÁC ĐỊNH VERDICT:

| Điều kiện | Verdict |
|-----------|---------|
| ROAS >= 4, trend stable/improving | SCALE |
| ROAS >= 2.5, không issue nghiêm trọng | MAINTAIN |
| ROAS >= 2, có dấu hiệu cần theo dõi | WATCH |
| ROAS >= 2, trend declining mạnh | REDUCE |
| ROAS < 2 hoặc đốt tiền | STOP |

QUAN TRỌNG: Trả về JSON với format sau:
{
  "dataBasis": { "days": 7, "orders": 187, "spend": 4000000 },
  "dimensions": {
    "financial": { "status": "excellent", "summary": "ROAS 9.68x, CPP 18K - Xuất sắc" },
    "content": { "status": "good", "summary": "CTR 9.02% (rất cao), ổn định" },
    "audience": { "status": "excellent", "summary": "Frequency 1.5 - Audience còn mới" },
    "trend": { "direction": "stable", "summary": "CPP ổn định trong 7 ngày qua" }
  },
  "verdict": {
    "action": "SCALE",
    "headline": "🔥 SCALE NGAY - Tăng budget 30% trong 24h",
    "condition": null
  },
  "actionPlan": {
    "immediate": {
      "action": "Tăng budget từ 500K lên 650K",
      "reason": "ROAS > 9x ổn định 7 ngày, còn room để scale"
    },
    "shortTerm": {
      "action": "Chuẩn bị creative backup",
      "trigger": "Khi frequency > 2"
    },
    "prevention": "Theo dõi CTR hàng ngày, thay creative khi CTR < 7%"
  },
  "reasoning": "Campaign đang ở trạng thái xuất sắc với ROAS 9.68x và CTR 9.02%. Tất cả 4 chiều đều positive. Đây là thời điểm tốt để scale."
}`;

export async function analyzeWithAI(context: CampaignContext): Promise<AIAnalysisResult> {
    try {
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
            temperature: 0.5, // Lower for more consistent output
            max_tokens: 1200,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        const result = JSON.parse(content) as AIAnalysisResult;

        // Add legacy fields for backward compatibility
        result.summary = result.verdict?.headline || '';
        result.diagnosis = result.reasoning || '';
        result.confidence = result.dimensions?.financial?.status === 'excellent' ? 'high' :
            result.dimensions?.financial?.status === 'good' ? 'medium' : 'low';

        return result;
    } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        console.error('AI Analysis error:', errMessage);

        // Fallback with new structure
        return {
            dataBasis: {
                days: context.dailyTrend.length,
                orders: context.metrics.purchases,
                spend: context.metrics.spend,
            },
            dimensions: {
                financial: { status: 'warning', summary: 'Không thể phân tích' },
                content: { status: 'warning', summary: 'Không thể phân tích' },
                audience: { status: 'warning', summary: 'Không thể phân tích' },
                trend: { direction: 'stable', summary: 'Không thể phân tích' },
            },
            verdict: {
                action: 'WATCH',
                headline: '⚠️ Lỗi phân tích - Vui lòng thử lại',
            },
            actionPlan: {
                immediate: {
                    action: 'Thử lại phân tích',
                    reason: errMessage.substring(0, 100),
                },
            },
            reasoning: `Lỗi: ${errMessage}`,
            // Legacy
            summary: 'Lỗi phân tích',
            diagnosis: errMessage,
            confidence: 'low',
        };
    }
}

function buildUserPrompt(context: CampaignContext): string {
    const { campaign, metrics, dailyTrend, issues, comparison } = context;

    // Calculate trend
    let trendSummary = '';
    if (dailyTrend.length >= 3) {
        const recent3 = dailyTrend.slice(-3);
        const avgCppRecent = recent3.reduce((sum, d) => sum + d.cpp, 0) / 3;
        const avgCppTotal = dailyTrend.reduce((sum, d) => sum + d.cpp, 0) / dailyTrend.length;
        const cppChange = avgCppTotal > 0 ? ((avgCppRecent - avgCppTotal) / avgCppTotal) * 100 : 0;
        trendSummary = `CPP 3 ngày gần: ${formatMoney(avgCppRecent)} (${cppChange > 0 ? '+' : ''}${cppChange.toFixed(0)}% so với TB)`;
    }

    const trendText = dailyTrend.slice(-7).map(d =>
        `${d.date}: Spend ${formatMoney(d.spend)}, ${d.purchases} đơn, CPP ${formatMoney(d.cpp)}, CTR ${d.ctr.toFixed(2)}%`
    ).join('\n');

    const issuesText = issues.map(i => `- ${i.message}: ${i.detail}`).join('\n');

    let comparisonText = '';
    if (comparison) {
        comparisonText = `
SO SÁNH:
- CPP TB thị trường: ${formatMoney(comparison.avgCpp)}
- ROAS TB: ${comparison.avgRoas.toFixed(2)}x
- Vị trí: ${comparison.position === 'above_avg' ? '✅ Trên TB' : comparison.position === 'below_avg' ? '⚠️ Dưới TB' : 'Trung bình'}`;
    }

    return `CAMPAIGN: ${campaign.name}
Trạng thái: ${campaign.status}

📊 TỔNG QUAN ${dailyTrend.length} NGÀY:
- Chi tiêu: ${formatMoney(metrics.spend)}
- Số đơn: ${metrics.purchases}
- Doanh thu: ${formatMoney(metrics.revenue)}
- CPP: ${formatMoney(metrics.cpp)}
- ROAS: ${metrics.roas.toFixed(2)}x
- CTR: ${metrics.ctr.toFixed(2)}%
- CPM: ${formatMoney(metrics.cpm)}
${metrics.frequency ? `- Frequency: ${metrics.frequency.toFixed(1)}` : ''}

📈 TREND:
${trendSummary}

📅 DIỄN BIẾN THEO NGÀY:
${trendText}

⚠️ VẤN ĐỀ PHÁT HIỆN:
${issuesText || 'Không có vấn đề rõ ràng'}
${comparisonText}

Hãy phân tích theo 4 chiều (Tài chính, Content, Audience, Trend) và đưa ra verdict + action plan cụ thể.`;
}

function formatMoney(amount: number): string {
    const rounded = Math.round(amount);
    return rounded.toLocaleString('de-DE') + 'đ';
}
