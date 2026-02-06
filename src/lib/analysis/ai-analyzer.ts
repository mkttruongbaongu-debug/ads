/**
 * ===================================================================
 * AI DEEP ANALYZER v3 - QUÂN SƯ ADS
 * ===================================================================
 * Phân tích SÂU, KẾT LUẬN ĐỨKHOÁT, HÀNH ĐỘNG CỤ THỂ
 * 
 * Changes from v2:
 * - Uses preprocessed data with peak/trough, day-of-week patterns
 * - Focuses on ROOT CAUSE analysis
 * - Outputs actionable predictions
 * ===================================================================
 */

import OpenAI from 'openai';
import { preprocessCampaignData, PreprocessedInsights, DailyMetric } from './data-preprocessor';

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
// NEW: AI Analysis Result v3
// =========================================
export interface AIAnalysisResult {
    // Cơ sở phân tích
    dataBasis: {
        days: number;
        orders: number;
        spend: number;
    };

    // Phân tích 4 chiều - DEEPER
    dimensions: {
        financial: {
            status: 'excellent' | 'good' | 'warning' | 'critical';
            summary: string;
            detail: string;  // NEW: deeper explanation
        };
        content: {
            status: 'excellent' | 'good' | 'warning' | 'critical';
            summary: string;
            detail: string;
        };
        audience: {
            status: 'excellent' | 'good' | 'warning' | 'critical';
            summary: string;
            detail: string;
        };
        trend: {
            direction: 'improving' | 'stable' | 'declining';
            summary: string;
            detail: string;
        };
    };

    // Pattern analysis - NEW
    patterns: {
        peakInsight: string;       // "Ngày tốt nhất: T6 với CPP 28K (thấp hơn TB 35%)"
        troughInsight: string;     // "Ngày yếu nhất: T2 với CPP 52K (cao hơn TB 20%)"
        dayOfWeekPattern: string;  // "Pattern F&B: Cuối tuần mạnh, đầu tuần yếu"
        volatilityAssessment: string;
    };

    // Creative health - NEW
    creativeHealth: {
        status: 'healthy' | 'early_warning' | 'fatigued' | 'critical';
        ctrTrend: string;
        frequencyStatus: string;
        diagnosis: string;
        urgency: 'none' | 'low' | 'medium' | 'high' | 'critical';
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
            metric_to_watch: string;  // NEW
        };
        shortTerm?: {
            action: string;
            trigger: string;
        };
        prevention?: string;
    };

    // Prediction - NEW
    prediction: {
        noAction: string;    // "Nếu không làm gì: CPP sẽ tăng 15% trong 3 ngày"
        withAction: string;  // "Nếu làm đúng: CPP giữ ổn định, có thể giảm 10%"
    };

    // Lý do chi tiết
    reasoning: string;

    // Warning signals - NEW
    warningSignals: Array<{
        type: string;
        severity: string;
        evidence: string;
    }>;

    // Legacy fields for backward compatibility
    summary?: string;
    diagnosis?: string;
    marketContext?: string;
    confidence?: 'high' | 'medium' | 'low';
}

// ===================================================================
// ENHANCED SYSTEM PROMPT
// ===================================================================
const SYSTEM_PROMPT = `Bạn là QUÂN SƯ ADS - chuyên gia tối ưu quảng cáo Facebook cho ngành F&B Việt Nam.

BẠN KHÁC BIỆT VÌ:
1. PHÂN TÍCH PATTERN - Không chỉ xem tổng, mà xem TỪNG NGÀY để tìm peak/trough
2. TÌM ROOT CAUSE - Không nói "CTR giảm", mà giải thích TẠI SAO giảm
3. DỰ ĐOÁN - Nói rõ sẽ xảy ra gì nếu HÀNH ĐỘNG vs KHÔNG HÀNH ĐỘNG
4. HÀNH ĐỘNG CỤ THỂ - "Tăng budget 200K" thay vì "Nên tối ưu"

NGUYÊN TẮC PHÂN TÍCH:

1. PEAK/TROUGH ANALYSIS:
- Ngày CPP thấp nhất = Peak (tìm nguyên nhân: day-of-week? creative mới? audience segment?)
- Ngày CPP cao nhất = Trough (tìm nguyên nhân: đầu tuần? audience exhaustion? technical issue?)

2. DAY-OF-WEEK PATTERN (Rất quan trọng với F&B):
- T6-T7-CN thường peak (người ta order đồ ăn cuối tuần)
- T2-T3 thường trough
- NẾU campaign peak vào T2-T3 = có vấn đề hoặc target đặc biệt

3. CREATIVE FATIGUE DETECTION:
- CTR giảm + Frequency thấp (<2) = Content yếu từ đầu
- CTR giảm + Frequency cao (>2.5) = Audience mệt với creative
- CTR ổn + Frequency cao = Vẫn OK nhưng cần chuẩn bị

4. TREND không chỉ là "tăng/giảm":
- So sánh 3 ngày gần vs 7 ngày
- Xem có đột biến không (sudden spike/drop)
- Xem độ volatility (dao động mạnh = khó dự đoán)

OUTPUT FORMAT (JSON):
{
  "dataBasis": { "days": 14, "orders": 45, "spend": 8500000 },
  "dimensions": {
    "financial": {
      "status": "good",
      "summary": "ROAS 2.8x - Có lãi nhưng chưa xuất sắc",
      "detail": "CPP 189K ổn định, margin ~15%. Có room để scale nếu giữ được CPP."
    },
    "content": {
      "status": "warning",
      "summary": "CTR giảm 25% trong 7 ngày",
      "detail": "CTR từ 3.2% xuống 2.4%. Correlation với Frequency tăng từ 1.8 lên 2.3 - dấu hiệu fatigue."
    },
    "audience": {
      "status": "good",
      "summary": "Frequency 2.3 - Còn room nhưng đang cận ngưỡng",
      "detail": "Chưa bão hòa nhưng cần theo dõi. Không nên scale mạnh lúc này."
    },
    "trend": {
      "direction": "declining",
      "summary": "CPP tăng 18% trong 5 ngày gần",
      "detail": "Moving avg 3 ngày: 210K vs 7 ngày: 178K. Trend xấu dần."
    }
  },
  "patterns": {
    "peakInsight": "Peak ngày 12/01 (T6): CPP 145K, ROAS 3.5x. Cuối tuần hiệu suất tốt nhất.",
    "troughInsight": "Trough ngày 15/01 (T2): CPP 245K, ROAS 2.1x. Đầu tuần yếu như pattern F&B.",
    "dayOfWeekPattern": "Pattern F&B chuẩn: T6-T7-CN mạnh (+25% ROAS), T2-T3 yếu.",
    "volatilityAssessment": "Dao động TRUNG BÌNH (±22%). Có thể dự đoán được."
  },
  "creativeHealth": {
    "status": "early_warning",
    "ctrTrend": "Giảm 25% trong 7 ngày (3.2% → 2.4%)",
    "frequencyStatus": "2.3 - Cận ngưỡng 2.5",
    "diagnosis": "Creative đang bắt đầu mệt. CTR giảm song song với Frequency tăng = audience exhaustion.",
    "urgency": "medium"
  },
  "verdict": {
    "action": "WATCH",
    "headline": "⚠️ THEO DÕI - Chuẩn bị creative mới trong 48h",
    "condition": "Chuyển sang REDUCE nếu CTR < 2% hoặc Frequency > 2.5"
  },
  "actionPlan": {
    "immediate": {
      "action": "Giữ nguyên budget. Bắt đầu làm creative mới ngay hôm nay.",
      "reason": "Scale lúc này sẽ đẩy nhanh fatigue. Cần creative mới trước.",
      "metric_to_watch": "CTR và Frequency hàng ngày"
    },
    "shortTerm": {
      "action": "Test creative mới với 20% budget",
      "trigger": "Khi creative mới ready (mục tiêu 24-48h)"
    },
    "prevention": "Luôn có 2-3 creative backup sẵn sàng"
  },
  "prediction": {
    "noAction": "CTR tiếp tục giảm về 1.8%, CPP tăng lên 250K trong 5 ngày. ROI sẽ âm.",
    "withAction": "Creative mới reset CTR về 3%+, CPP giảm về 180K. Có thể scale sau 3 ngày."
  },
  "warningSignals": [
    {
      "type": "creative_fatigue",
      "severity": "medium",
      "evidence": "CTR -25%, Frequency 2.3"
    }
  ],
  "reasoning": "Campaign đang ở giai đoạn cần can thiệp. Tài chính còn OK nhưng trend xấu. Root cause là creative fatigue (CTR giảm + Frequency tăng). Ưu tiên #1: Làm creative mới ngay."
}`;

// ===================================================================
// MAIN FUNCTION
// ===================================================================
export async function analyzeWithAI(context: CampaignContext): Promise<AIAnalysisResult> {
    try {
        if (!process.env.OPENAI_API_KEY) {
            console.error('AI Analysis error: OPENAI_API_KEY not configured');
            throw new Error('OPENAI_API_KEY not configured');
        }

        // NEW: Preprocess data first
        const dailyMetrics = context.dailyTrend.map(d => ({
            date: d.date,
            spend: d.spend,
            purchases: d.purchases,
            revenue: 0, // Will be calculated
            cpp: d.cpp,
            roas: 0,
            ctr: d.ctr,
            cpm: 0,
            impressions: 0,
            clicks: 0,
        })) as DailyMetric[];

        const preprocessed = preprocessCampaignData(dailyMetrics);

        // Build enhanced prompt with preprocessed insights
        const userPrompt = buildEnhancedPrompt(context, preprocessed);

        console.log('[AI_ANALYZER] 🧠 Sending enhanced prompt to AI...');
        console.log('[AI_ANALYZER] 📊 Preprocessed insights:', JSON.stringify(preprocessed, null, 2));

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.4, // Lower for more consistent output
            max_tokens: 2000, // Increased for detailed analysis
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

        // Merge preprocessed warning signals if AI missed any
        if (!result.warningSignals) {
            result.warningSignals = preprocessed.warningSignals.map(w => ({
                type: w.type,
                severity: w.severity,
                evidence: w.evidence,
            }));
        }

        console.log('[AI_ANALYZER] ✅ Analysis complete:', result.verdict?.action);

        return result;
    } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        console.error('AI Analysis error:', errMessage);

        // Fallback with new structure
        return getFallbackResult(context, errMessage);
    }
}

// ===================================================================
// ENHANCED PROMPT BUILDER
// ===================================================================
function buildEnhancedPrompt(context: CampaignContext, preprocessed: PreprocessedInsights): string {
    const { campaign, metrics, dailyTrend, issues, comparison } = context;

    // Format daily data
    const trendText = dailyTrend.map(d => {
        const dow = getDayOfWeek(d.date);
        return `${d.date} (${dow}): Spend ${formatMoney(d.spend)}, ${d.purchases} đơn, CPP ${formatMoney(d.cpp)}, CTR ${d.ctr.toFixed(2)}%`;
    }).join('\n');

    const issuesText = issues.map(i => `- ${i.message}: ${i.detail}`).join('\n');

    let comparisonText = '';
    if (comparison) {
        comparisonText = `
SO SÁNH VỚI CAMPAIGN KHÁC:
- CPP TB: ${formatMoney(comparison.avgCpp)}
- ROAS TB: ${comparison.avgRoas.toFixed(2)}x
- Vị trí: ${comparison.position === 'above_avg' ? '✅ Trên TB' : comparison.position === 'below_avg' ? '⚠️ Dưới TB' : 'Trung bình'}`;
    }

    // Build preprocessed insights section
    const preprocessedSection = `
===== PHÂN TÍCH TRƯỚC (DATA-DRIVEN) =====

📈 PEAK & TROUGH:
${preprocessed.peakDay ? `- PEAK: ${preprocessed.peakDay.date} (${preprocessed.peakDay.dayOfWeek}) - ${preprocessed.peakDay.reason}` : '- Không có peak rõ ràng'}
${preprocessed.troughDay ? `- TROUGH: ${preprocessed.troughDay.date} (${preprocessed.troughDay.dayOfWeek}) - ${preprocessed.troughDay.reason}` : '- Không có trough rõ ràng'}

📅 DAY-OF-WEEK PATTERN:
${preprocessed.dayOfWeekPattern.insight}
- Ngày tốt: ${preprocessed.dayOfWeekPattern.bestDays.join(', ') || 'N/A'}
- Ngày yếu: ${preprocessed.dayOfWeekPattern.worstDays.join(', ') || 'N/A'}

🎨 CREATIVE HEALTH:
- Status: ${preprocessed.creativeFatigue.status.toUpperCase()}
- CTR Trend: ${preprocessed.creativeFatigue.ctrTrend} (${preprocessed.creativeFatigue.ctrDeclinePercent > 0 ? '-' : '+'}${Math.abs(preprocessed.creativeFatigue.ctrDeclinePercent).toFixed(0)}%)
- Frequency: ${preprocessed.creativeFatigue.frequencyValue.toFixed(1)} (${preprocessed.creativeFatigue.frequencyLevel})
- Diagnosis: ${preprocessed.creativeFatigue.diagnosis}

📊 TREND:
- Direction: ${preprocessed.trend.direction.toUpperCase()}
- CPP Change: ${preprocessed.trend.cppChange > 0 ? '+' : ''}${preprocessed.trend.cppChange.toFixed(0)}%
- ${preprocessed.trend.insight}

⚡ VOLATILITY:
- Level: ${preprocessed.volatility.level.toUpperCase()}
- ${preprocessed.volatility.insight}

⚠️ WARNING SIGNALS:
${preprocessed.warningSignals.length > 0
            ? preprocessed.warningSignals.map(w => `- [${w.severity.toUpperCase()}] ${w.type}: ${w.evidence}`).join('\n')
            : '- Không có cảnh báo'}

🔮 DỰ ĐOÁN (TÍNH TOÁN):
- Không làm gì: ${preprocessed.prediction.noAction}
- Có hành động: ${preprocessed.prediction.withAction}
`;

    return `CAMPAIGN: ${campaign.name}
Trạng thái: ${campaign.status}
ID: ${campaign.id}

===== TỔNG QUAN ${dailyTrend.length} NGÀY =====
- Chi tiêu: ${formatMoney(metrics.spend)}
- Số đơn: ${metrics.purchases}
- Doanh thu: ${formatMoney(metrics.revenue)}
- CPP: ${formatMoney(metrics.cpp)}
- ROAS: ${metrics.roas.toFixed(2)}x
- CTR: ${metrics.ctr.toFixed(2)}%
- CPM: ${formatMoney(metrics.cpm)}
${metrics.frequency ? `- Frequency: ${metrics.frequency.toFixed(1)}` : ''}

===== DIỄN BIẾN THEO NGÀY =====
${trendText}

===== VẤN ĐỀ PHÁT HIỆN =====
${issuesText || 'Không có vấn đề rõ ràng'}
${comparisonText}

${preprocessedSection}

===== YÊU CẦU =====
Dựa trên dữ liệu và phân tích trước ở trên, hãy:
1. Xác nhận hoặc điều chỉnh các insights đã tính toán
2. Tìm ROOT CAUSE chính xác cho vấn đề (nếu có)
3. Đưa ra VERDICT dứt khoát với HÀNH ĐỘNG CỤ THỂ
4. Dự đoán sẽ xảy ra gì trong 3-5 ngày tới

Trả về JSON đúng format đã hướng dẫn.`;
}

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function getDayOfWeek(dateStr: string): string {
    const date = new Date(dateStr);
    return DAY_NAMES[date.getDay()];
}

function formatMoney(amount: number): string {
    return Math.round(amount).toLocaleString('de-DE') + '₫';
}

function getFallbackResult(context: CampaignContext, errorMessage: string): AIAnalysisResult {
    return {
        dataBasis: {
            days: context.dailyTrend.length,
            orders: context.metrics.purchases,
            spend: context.metrics.spend,
        },
        dimensions: {
            financial: { status: 'warning', summary: 'Không thể phân tích', detail: errorMessage },
            content: { status: 'warning', summary: 'Không thể phân tích', detail: '' },
            audience: { status: 'warning', summary: 'Không thể phân tích', detail: '' },
            trend: { direction: 'stable', summary: 'Không thể phân tích', detail: '' },
        },
        patterns: {
            peakInsight: 'Không thể phân tích',
            troughInsight: 'Không thể phân tích',
            dayOfWeekPattern: 'Không thể phân tích',
            volatilityAssessment: 'Không thể phân tích',
        },
        creativeHealth: {
            status: 'healthy',
            ctrTrend: 'Không thể phân tích',
            frequencyStatus: 'Không thể phân tích',
            diagnosis: errorMessage,
            urgency: 'none',
        },
        verdict: {
            action: 'WATCH',
            headline: '⚠️ Lỗi phân tích - Vui lòng thử lại',
        },
        actionPlan: {
            immediate: {
                action: 'Thử lại phân tích',
                reason: errorMessage.substring(0, 100),
                metric_to_watch: 'N/A',
            },
        },
        prediction: {
            noAction: 'Không thể dự đoán',
            withAction: 'Không thể dự đoán',
        },
        warningSignals: [],
        reasoning: `Lỗi: ${errorMessage}`,
        // Legacy
        summary: 'Lỗi phân tích',
        diagnosis: errorMessage,
        confidence: 'low',
    };
}
