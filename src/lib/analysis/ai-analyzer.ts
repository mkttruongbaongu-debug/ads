/**
 * ===================================================================
 * AI DEEP ANALYZER v4 - QUÂN SƯ ADS
 * ===================================================================
 * Model: o4-mini (reasoning model)
 * Changes from v3:
 * - Switched from gpt-4o-mini → o4-mini for better numerical reasoning
 * - Added BENCHMARK rules to prevent hallucination
 * - Added post-AI guardrails to validate verdict vs actual metrics
 * ===================================================================
 */

import OpenAI from 'openai';
import { preprocessCampaignData, PreprocessedInsights, DailyMetric } from './data-preprocessor';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ===================================================================
// TYPES
// ===================================================================

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
        severity: string;
        message: string;
        detail: string;
    }>;
    comparison?: {
        avgCpp: number;
        avgRoas: number;
        avgCtr: number;
        position: 'above_avg' | 'below_avg' | 'average';
    };
    contentAnalysis?: Array<{
        name: string;
        status: string;
        badge: string;
        spendShare: number;
        spend: number;
        revenue: number;
        purchases: number;
        cpp: number;
        ctr: number;
        roas: number;
        zScoreTip: string;
        dailyMetrics?: Array<{
            date: string;
            spend: number;
            purchases: number;
            cpp: number;
            ctr: number;
        }>;
    }>;
}

export interface AIAnalysisResult {
    dataBasis: {
        days: number;
        orders: number;
        spend: number;
    };
    dimensions: {
        financial: {
            status: 'excellent' | 'good' | 'warning' | 'critical';
            summary: string;
            detail: string;
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
    patterns: {
        peakInsight: string;
        troughInsight: string;
        dayOfWeekPattern: string;
        volatilityAssessment: string;
    };
    creativeHealth: {
        status: 'healthy' | 'early_warning' | 'fatigued' | 'critical';
        ctrTrend: string;
        frequencyStatus: string;
        diagnosis: string;
        urgency: 'none' | 'low' | 'medium' | 'high' | 'critical';
    };
    verdict: {
        action: 'SCALE' | 'MAINTAIN' | 'WATCH' | 'REDUCE' | 'STOP';
        headline: string;
        condition?: string;
    };
    actionPlan: {
        immediate: {
            action: string;
            reason: string;
            metric_to_watch: string;
        };
        shortTerm?: {
            action: string;
            trigger: string;
        };
        prevention?: string;
    };
    prediction: {
        noAction: string;
        withAction: string;
    };
    reasoning: string;
    warningSignals: Array<{
        type: string;
        severity: string;
        evidence: string;
    }>;
    // Legacy
    summary?: string;
    diagnosis?: string;
    marketContext?: string;
    confidence?: 'high' | 'medium' | 'low';
}

// ===================================================================
// SYSTEM PROMPT v4 - WITH BENCHMARKS
// ===================================================================
const SYSTEM_PROMPT = `Bạn là QUÂN SƯ ADS - chuyên gia tối ưu quảng cáo Facebook cho ngành F&B Việt Nam.

═══════════════════════════════════════════
QUY TẮC SỐNG CÒN (TUYỆT ĐỐI KHÔNG VI PHẠM)
═══════════════════════════════════════════

BENCHMARK ROAS (Ngành F&B Việt Nam):
- ROAS >= 4    → XUẤT SẮC → verdict.action PHẢI là SCALE hoặc MAINTAIN
- ROAS 2 - 4   → TỐT     → verdict.action PHẢI là MAINTAIN hoặc WATCH
- ROAS 1 - 2   → HÒA VỐN → verdict.action nên là WATCH hoặc REDUCE
- ROAS < 1     → LỖ      → verdict.action PHẢI là REDUCE hoặc STOP

BENCHMARK CPP (Ngành F&B Việt Nam):
- CPP < 30.000đ   → RẤT TỐT
- CPP 30-60K       → TỐT
- CPP 60-100K      → TRUNG BÌNH
- CPP > 100K       → CAO, cần xem xét

BENCHMARK CTR:
- CTR > 3%    → TỐT
- CTR 1-3%    → TRUNG BÌNH
- CTR < 1%    → YẾU

KIỂM TRA LOGIC (BẮT BUỘC trước khi output):
✅ Nếu ROAS >= 4 → bạn KHÔNG ĐƯỢC nói "ROAS thấp" hay recommend STOP/REDUCE
✅ Nếu ROAS < 1  → bạn KHÔNG ĐƯỢC recommend SCALE
✅ verdict.headline PHẢI nhất quán với data thực tế
✅ dimensions.financial.status PHẢI match với verdict.action

VÍ DỤ SAI (KHÔNG ĐƯỢC LÀM):
❌ ROAS 10x → "ROAS thấp, cần cắt lỗ" (SAI VÌ 10x = xuất sắc)
❌ ROAS 0.5x → "SCALE UP ngay" (SAI VÌ đang lỗ)
❌ financial.status = "excellent" + verdict.action = "STOP" (MÂU THUẪN)

═══════════════════════════════════════════
NGUYÊN TẮC PHÂN TÍCH
═══════════════════════════════════════════

1. PEAK/TROUGH ANALYSIS:
- Ngày CPP thấp nhất = Peak → tìm nguyên nhân
- Ngày CPP cao nhất = Trough → tìm nguyên nhân

2. DAY-OF-WEEK PATTERN (F&B):
- T6-T7-CN thường peak (order đồ ăn cuối tuần)
- T2-T3 thường trough

3. CREATIVE FATIGUE:
- CTR giảm + Frequency < 2 = Content yếu từ đầu
- CTR giảm + Frequency > 2.5 = Audience mệt với creative
- CTR ổn + Frequency cao = OK nhưng cần chuẩn bị

4. TREND:
- So sánh 3 ngày gần vs tổng
- Có đột biến không?
- Volatility cao = khó dự đoán

5. CHI TIÊU vs DAILY BUDGET:
- Số "chi tiêu" trong data là TỔNG CHI TIÊU cả kỳ, KHÔNG phải daily budget
- Đừng nhầm lẫn 2 con số này

OUTPUT FORMAT (JSON):
{
  "dataBasis": { "days": 14, "orders": 45, "spend": 8500000 },
  "dimensions": {
    "financial": {
      "status": "good",
      "summary": "ROAS 2.8x - Có lãi, đạt mức TỐT theo benchmark F&B",
      "detail": "Chi tiết..."
    },
    "content": {
      "status": "warning",
      "summary": "CTR giảm 25% trong 7 ngày",
      "detail": "Chi tiết..."
    },
    "audience": {
      "status": "good",
      "summary": "Frequency 2.3 - Còn room",
      "detail": "Chi tiết..."
    },
    "trend": {
      "direction": "declining",
      "summary": "CPP tăng 18% trong 5 ngày",
      "detail": "Chi tiết..."
    }
  },
  "patterns": {
    "peakInsight": "...",
    "troughInsight": "...",
    "dayOfWeekPattern": "...",
    "volatilityAssessment": "..."
  },
  "creativeHealth": {
    "status": "early_warning",
    "ctrTrend": "...",
    "frequencyStatus": "...",
    "diagnosis": "...",
    "urgency": "medium"
  },
  "verdict": {
    "action": "WATCH",
    "headline": "Campaign đang tốt nhưng creative cần refresh trong 48h",
    "condition": "Chuyển REDUCE nếu CTR < 2%"
  },
  "actionPlan": {
    "immediate": {
      "action": "Giữ budget, bắt đầu làm creative mới",
      "reason": "Creative đang fatigue, scale lúc này sẽ tăng CPP",
      "metric_to_watch": "CTR và Frequency hàng ngày"
    },
    "shortTerm": {
      "action": "Test creative mới",
      "trigger": "Khi creative mới ready"
    },
    "prevention": "Luôn có 2-3 creative backup"
  },
  "prediction": {
    "noAction": "CTR giảm về 1.8%, CPP tăng 250K trong 5 ngày",
    "withAction": "Creative mới reset CTR, CPP giảm 15%"
  },
  "warningSignals": [
    {
      "type": "creative_fatigue",
      "severity": "medium",
      "evidence": "CTR -25%, Frequency 2.3"
    }
  ],
  "reasoning": "Phân tích reasoning chi tiết..."
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

        // Preprocess data
        const dailyMetrics = context.dailyTrend.map(d => ({
            date: d.date,
            spend: d.spend,
            purchases: d.purchases,
            revenue: 0,
            cpp: d.cpp,
            roas: 0,
            ctr: d.ctr,
            cpm: 0,
            impressions: 0,
            clicks: 0,
        })) as DailyMetric[];

        const preprocessed = preprocessCampaignData(dailyMetrics);
        const userPrompt = buildEnhancedPrompt(context, preprocessed);

        console.log('[AI_ANALYZER_v4] 🧠 Sending to o4-mini (reasoning model)...');
        console.log('[AI_ANALYZER_v4] 📊 ROAS:', context.metrics.roas.toFixed(2), 'CPP:', Math.round(context.metrics.cpp));

        // o4-mini API: no temperature, use reasoning_effort
        const response = await openai.chat.completions.create({
            model: 'o4-mini',
            reasoning_effort: 'medium',
            messages: [
                { role: 'developer', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            max_completion_tokens: 16000,
            response_format: { type: 'json_object' },
        } as any);

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        let result = JSON.parse(content) as AIAnalysisResult;

        // ===================================================================
        // GUARDRAILS: Validate verdict vs actual metrics
        // ===================================================================
        result = applyGuardrails(result, context.metrics);

        // Legacy fields
        result.summary = result.verdict?.headline || '';
        result.diagnosis = result.reasoning || '';
        result.confidence = result.dimensions?.financial?.status === 'excellent' ? 'high' :
            result.dimensions?.financial?.status === 'good' ? 'medium' : 'low';

        // Merge preprocessed warnings if AI missed any
        if (!result.warningSignals || result.warningSignals.length === 0) {
            result.warningSignals = preprocessed.warningSignals.map(w => ({
                type: w.type,
                severity: w.severity,
                evidence: w.evidence,
            }));
        }

        console.log('[AI_ANALYZER_v4] ✅ Analysis complete:', result.verdict?.action, '-', result.verdict?.headline);

        return result;
    } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        console.error('[AI_ANALYZER_v4] ❌ Error:', errMessage);
        return getFallbackResult(context, errMessage);
    }
}

// ===================================================================
// GUARDRAILS - Safety net after AI response
// ===================================================================
function applyGuardrails(
    result: AIAnalysisResult,
    metrics: CampaignContext['metrics']
): AIAnalysisResult {
    const roas = metrics.roas;
    const action = result.verdict?.action;

    // RULE 1: ROAS >= 4 → CANNOT be STOP/REDUCE
    if (roas >= 4 && (action === 'STOP' || action === 'REDUCE')) {
        console.warn(`[GUARDRAIL] ⚠️ OVERRIDE: ROAS ${roas.toFixed(2)}x nhưng AI nói ${action} → force MAINTAIN`);
        result.verdict = {
            action: 'MAINTAIN',
            headline: `ROAS ${roas.toFixed(1)}x xuất sắc - Giữ nguyên chiến lược`,
            condition: result.verdict?.condition,
        };
        result.reasoning = `[GHI ĐÈ] AI đề xuất ${action} nhưng ROAS ${roas.toFixed(2)}x > 4 = xuất sắc. ` + result.reasoning;
    }

    // RULE 2: ROAS < 1 → CANNOT be SCALE
    if (roas < 1 && action === 'SCALE') {
        console.warn(`[GUARDRAIL] ⚠️ OVERRIDE: ROAS ${roas.toFixed(2)}x < 1 nhưng AI nói SCALE → force REDUCE`);
        result.verdict = {
            action: 'REDUCE',
            headline: `ROAS ${roas.toFixed(1)}x - Campaign đang lỗ, cần giảm budget`,
            condition: result.verdict?.condition,
        };
        result.reasoning = `[GHI ĐÈ] AI đề xuất SCALE nhưng ROAS ${roas.toFixed(2)}x < 1 = lỗ. ` + result.reasoning;
    }

    // RULE 3: Financial status must match ROAS
    if (roas >= 4 && result.dimensions?.financial?.status === 'critical') {
        console.warn(`[GUARDRAIL] ⚠️ OVERRIDE: financial.status critical nhưng ROAS ${roas.toFixed(2)}x`);
        result.dimensions.financial.status = 'excellent';
        result.dimensions.financial.summary = `ROAS ${roas.toFixed(2)}x - XUẤT SẮC (${result.dimensions.financial.summary})`;
    }
    if (roas >= 2 && roas < 4 && result.dimensions?.financial?.status === 'critical') {
        result.dimensions.financial.status = 'good';
    }

    return result;
}

// ===================================================================
// ENHANCED PROMPT BUILDER
// ===================================================================
function buildEnhancedPrompt(context: CampaignContext, preprocessed: PreprocessedInsights): string {
    const { campaign, metrics, dailyTrend, issues, comparison, contentAnalysis } = context;

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
- Chi tiêu (TỔNG cả kỳ): ${formatMoney(metrics.spend)}
- Số đơn: ${metrics.purchases}
- Doanh thu: ${formatMoney(metrics.revenue)}
- CPP: ${formatMoney(metrics.cpp)}
- ROAS: ${metrics.roas.toFixed(2)}x
- CTR: ${metrics.ctr.toFixed(2)}%
- CPM: ${formatMoney(metrics.cpm)}
${metrics.frequency ? `- Frequency: ${metrics.frequency.toFixed(1)}` : ''}

LƯU Ý: "Chi tiêu" ở trên là TỔNG CHI TIÊU cả ${dailyTrend.length} ngày, KHÔNG phải daily budget.

===== DIỄN BIẾN THEO NGÀY =====
${trendText}

===== VẤN ĐỀ PHÁT HIỆN =====
${issuesText || 'Không có vấn đề rõ ràng'}
${comparisonText}

${preprocessedSection}

${contentAnalysis && contentAnalysis.length > 0 ? `===== PHÂN TÍCH TỪNG CONTENT (${contentAnalysis.length} ads) =====
${contentAnalysis.map((c, i) => {
        const roasText = c.roas > 0 ? c.roas.toFixed(2) + 'x' : 'N/A';
        const summary = `${i + 1}. [${c.badge}] "${c.name}" — FB chi ${c.spendShare.toFixed(0)}% — Chi: ${formatMoney(c.spend)} — Thu: ${formatMoney(c.revenue)} — ${c.purchases} đơn — CPP: ${formatMoney(c.cpp)} — CTR: ${c.ctr.toFixed(2)}% — ROAS: ${roasText}\n   → ${c.zScoreTip}`;
        // Include full daily breakdown for all content
        const dailyText = c.dailyMetrics
            ? '\n   Diễn biến: ' + c.dailyMetrics.map(d => {
                const cppText = d.purchases > 0 ? formatMoney(d.cpp) : '-';
                return `${d.date.slice(5)}: ${d.purchases}đơn CPP=${cppText} CTR=${d.ctr.toFixed(1)}%`;
            }).join(' | ')
            : '';
        return summary + dailyText;
    }).join('\n')}

LƯU Ý CONTENT:
- Content có badge "Bão hoà" = CPP vượt +2σ so với lịch sử, CẦN TẮT hoặc THAY THẾ
- Content có badge "Đang tốt" = metrics ổn định, nên GIỮ
- Content có badge "Yếu" = FB chi ít, hiệu quả thấp
- Content chiếm >40% chi tiêu = RỦI RO TẬP TRUNG, xem xét đa dạng hóa
` : ''}
===== YÊU CẦU =====
1. Đánh giá metrics theo BENCHMARK đã cho (ROAS >= 4 = xuất sắc, etc.)
2. Tìm ROOT CAUSE cho vấn đề (nếu có)
3. Đưa ra VERDICT dứt khoát - PHẢI nhất quán với data thực tế
4. Dự đoán 3-5 ngày tới
${contentAnalysis && contentAnalysis.length > 0 ? `5. Đánh giá TỪNG CONTENT: content nào nên tắt, content nào nên giữ/scale, có cần tạo content mới không?
6. Nếu phát hiện content bão hoà chiếm % chi tiêu lớn → CẢNH BÁO rõ ràng
` : ''}
KIỂM TRA LẦN CUỐI trước khi output:
- verdict.action có match với ROAS ${metrics.roas.toFixed(2)}x theo benchmark không?
- Nếu ROAS >= 4: action PHẢI là SCALE hoặc MAINTAIN
- headline có nói đúng sự thật không?

Trả về JSON đúng format.`;
}

// ===================================================================
// HELPERS
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
            headline: 'Lỗi phân tích - Vui lòng thử lại',
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
        summary: 'Lỗi phân tích',
        diagnosis: errorMessage,
        confidence: 'low',
    };
}
