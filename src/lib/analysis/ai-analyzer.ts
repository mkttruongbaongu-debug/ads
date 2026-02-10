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
        revenue?: number;
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
    // Guard Rail tracking
    _guardrail?: {
        originalVerdict: string;
        finalVerdict: string;
        overrideReason: string;
        wasOverridden: boolean;
        trendDetail: string;
    };
}

// ===================================================================
// SYSTEM PROMPT v4 - WITH BENCHMARKS
// ===================================================================
const SYSTEM_PROMPT = `Bạn là QUÂN SƯ ADS - chuyên gia tối ưu quảng cáo Facebook cho ngành F&B Việt Nam.

═══════════════════════════════════════════
QUY TẮC SỐNG CÒN (TUYỆT ĐỐI KHÔNG VI PHẠM)
═══════════════════════════════════════════

BENCHMARK ROAS (Ngành F&B Việt Nam):
- ROAS >= 4    → XUẤT SẮC
- ROAS 2 - 4   → TỐT
- ROAS 1 - 2   → HÒA VỐN
- ROAS < 1     → LỖ

BENCHMARK CPP (Ngành F&B Việt Nam):
- CPP < 30.000đ   → RẤT TỐT
- CPP 30-60K       → TỐT
- CPP 60-100K      → TRUNG BÌNH
- CPP > 100K       → CAO, cần xem xét

BENCHMARK CTR:
- CTR > 3%    → TỐT
- CTR 1-3%    → TRUNG BÌNH
- CTR < 1%    → YẾU

═══════════════════════════════════════════
QUY TẮC VERDICT (TUYỆT ĐỐI KHÔNG VI PHẠM)
═══════════════════════════════════════════

VERDICT PHẢI DỰA TRÊN 7 NGÀY GẦN NHẤT (window), KHÔNG dùng ROAS tổng.

SCALE chỉ được phép khi TẤT CẢ điều kiện sau:
✅ Window ROAS >= 4x (hiệu quả GẦN ĐÂY vẫn xuất sắc)
✅ CPP 7 ngày KHÔNG tăng đáng kể so với lịch sử (z-score <= 0.5)
✅ CTR 7 ngày KHÔNG giảm mạnh (z-score >= -1.0)
✅ Tối đa 1 trong 3 metrics (CPP, CTR, ROAS) có xu hướng xấu

❌ KHÔNG ĐƯỢC SCALE khi:
- CPP đang tăng VÀ CTR đang giảm (dù ROAS tổng cao)
- 2/3 hoặc 3/3 trends đều xấu
- Creative health = warning hoặc critical
→ Trong các trường hợp này, verdict PHẢI là MAINTAIN hoặc thấp hơn

Maintain khi:
- ROAS window >= 4x nhưng có 2+ trends xấu → ưu tiên ổn định
- ROAS window 2-4x và trends ổn

Reduce khi:
- ROAS window < 2x
- HOẶC CPP tăng vượt +2σ
- HOẶC 3/3 trends xấu VÀ ROAS window < 4x

Stop khi:
- ROAS window < 1x (đang lỗ)

KIỂM TRA LOGIC (BẮT BUỘC trước khi output):
✅ Nếu CPP đang tăng + CTR đang giảm → bạn KHÔNG ĐƯỢC recommend SCALE
✅ Nếu ROAS < 1  → bạn KHÔNG ĐƯỢC recommend SCALE
✅ verdict.headline PHẢI nhất quán với xu hướng 7 ngày gần nhất
✅ ROAS tổng chỉ để THAM KHẢO, quyết định dựa trên WINDOW metrics

VÍ DỤ SAI (KHÔNG ĐƯỢC LÀM):
❌ ROAS tổng 10x nhưng CPP tăng 34% + CTR giảm 30% → "SCALE UP" (SAI! Phải MAINTAIN)
❌ ROAS 0.5x → "SCALE UP ngay" (SAI VÌ đang lỗ)
❌ 3/3 trends xấu → "Tăng budget" (SAI! Đang đốt tiền)

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
      "action": "Tắt content \"CUU GIA HUE - V3 REEL\" (bão hoà, CPP +2.1σ). Giữ nguyên \"CUU GIA HUE - V7 STATIC\" (đang tốt).",
      "reason": "V3 REEL: CTR giảm từ 8.5% xuống 4.2% trong 5 ngày, CPP tăng 34%",
      "metric_to_watch": "CTR của V7 STATIC trong 48h tới"
    },
    "shortTerm": {
      "action": "Tạo 2 creative mới dạng Carousel và Video ngắn 15s, test song song với V7",
      "trigger": "Ngay lập tức — không chờ V7 suy giảm mới bắt đầu"
    }
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
}

═══════════════════════════════════════════
QUY TẮC actionPlan (TUYỆT ĐỐI TUÂN THỦ)
═══════════════════════════════════════════

1. immediate.action PHẢI NÊU TÊN CONTENT CỤ THỂ từ data contentAnalysis đã cung cấp.
   ✅ ĐÚNG: "Tắt content \"CUU GIA HUE - V3 REEL\" (bão hoà)"
   ❌ SAI: "Tắt 2 creative hàng đầu đang bão hoà" (KHÔNG CỤ THỂ)

2. shortTerm.action PHẢI CỤ THỂ: bao nhiêu creative, loại gì (video/static/carousel), test như thế nào.
   ✅ ĐÚNG: "Tạo 2 creative: 1 Video 15s + 1 Carousel, A/B test với content đang chạy tốt nhất"
   ❌ SAI: "Test creative mới" (QUÁ CHUNG CHUNG)
   ❌ SAI: "Thiết kế và test 3-5 creative mới" (MƠ HỒ)

3. KHÔNG ĐƯỢC đưa lời khuyên chung chung kiểu sách giáo khoa:
   ❌ SAI: "Luôn duy trì 5 creative thay thế"
   ❌ SAI: "Theo dõi CTR & CPP hàng ngày" (hiển nhiên, vô nghĩa)
   → Chỉ đưa HÀNH ĐỘNG CỤ THỂ mà người dùng có thể THỰC HIỆN NGAY

4. Nếu không cần thay đổi gì (campaign đang tốt), KHÔNG liệt kê bước thực thi:
   ✅ ĐÚNG: immediate.action = "Không cần thay đổi. Campaign đang hoạt động tốt."
   ❌ SAI: Liệt kê 4 bước nhưng không bước nào thực sự thay đổi gì`;


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
        // GUARDRAILS: Validate verdict vs actual metrics + trends
        // ===================================================================
        result = applyGuardrails(result, context.metrics, context.dailyTrend);

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
// GUARDRAILS v2 - Safety net with TREND-BASED checks
// ===================================================================
function applyGuardrails(
    result: AIAnalysisResult,
    metrics: CampaignContext['metrics'],
    dailyTrend: CampaignContext['dailyTrend']
): AIAnalysisResult {
    const roas = metrics.roas;
    let action = result.verdict?.action;
    const originalVerdict = action || 'N/A'; // Save AI's original verdict
    let overrideReason = '';

    // --- Calculate window vs history trends ---
    const windowSize = Math.min(7, Math.floor(dailyTrend.length / 3));
    const windowDays = dailyTrend.slice(-windowSize);
    const historyDays = dailyTrend.slice(0, -windowSize);

    let badTrends = 0;
    let windowRoas = roas; // fallback to overall
    let trendDetail = '';

    if (historyDays.length >= 5 && windowDays.length >= 3) {
        const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const std = (arr: number[], mean: number) => {
            if (arr.length < 2) return 0;
            return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
        };

        const histCtr = avg(historyDays.map(d => d.ctr));
        const histCpp = avg(historyDays.map(d => d.cpp));

        const windowCtr = avg(windowDays.map(d => d.ctr));
        const windowCpp = avg(windowDays.map(d => d.cpp));

        const windowSpend = windowDays.reduce((s, d) => s + d.spend, 0);
        const windowPurchases = windowDays.reduce((s, d) => s + d.purchases, 0);
        // Calculate window ROAS from daily data if revenue available
        const windowRevenue = windowDays.reduce((s, d) => s + (d.revenue || 0), 0);
        windowRoas = windowSpend > 0 && windowRevenue > 0 ? windowRevenue / windowSpend : roas;

        const cppSigma = std(historyDays.map(d => d.cpp), histCpp) || 1;
        const ctrSigma = std(historyDays.map(d => d.ctr), histCtr) || 1;

        const cppZ = (windowCpp - histCpp) / cppSigma;
        const ctrZ = (windowCtr - histCtr) / ctrSigma;

        // Count bad trends
        if (cppZ > 0.5) badTrends++;   // CPP rising
        if (ctrZ < -0.5) badTrends++;  // CTR dropping
        if (windowRoas < roas * 0.7) badTrends++; // ROAS dropping >30%

        trendDetail = `cppZ=${cppZ.toFixed(2)} ctrZ=${ctrZ.toFixed(2)} windowROAS=${windowRoas.toFixed(2)}x badTrends=${badTrends}/3`;
        console.log(`[GUARDRAIL_v2] 📊 Trends: ${trendDetail}`);
    }

    // RULE 1: SCALE blocked when trends are bad
    if (action === 'SCALE' && badTrends >= 2) {
        overrideReason = `AI nói SCALE nhưng ${badTrends}/3 trends xấu → MAINTAIN`;
        console.warn(`[GUARDRAIL_v2] ⚠️ ${overrideReason}`);
        result.verdict = {
            action: 'MAINTAIN',
            headline: `ROAS tốt nhưng ${badTrends}/3 trends đang giảm — ổn định trước, scale sau`,
            condition: result.verdict?.condition,
        };
        result.reasoning = `[GHI ĐÈ: ${trendDetail}] AI đề xuất SCALE nhưng ${badTrends}/3 trends đang xấu — scale lúc này sẽ đốt tiền. ` + result.reasoning;
    }

    // RULE 2: Force REDUCE when window ROAS is bad
    action = result.verdict?.action;
    if (windowRoas < 2.0 && action !== 'REDUCE' && action !== 'STOP') {
        overrideReason = `Window ROAS ${windowRoas.toFixed(2)}x < 2 → REDUCE`;
        console.warn(`[GUARDRAIL_v2] ⚠️ ${overrideReason}`);
        result.verdict = {
            action: 'REDUCE',
            headline: `ROAS gần đây ${windowRoas.toFixed(1)}x quá thấp — Giảm budget ngay`,
            condition: result.verdict?.condition,
        };
        result.reasoning = `[GHI ĐÈ] Window ROAS ${windowRoas.toFixed(2)}x < 2 = gần hòa vốn. ` + result.reasoning;
    }

    // RULE 3: Force REDUCE when ALL trends bad + weak window ROAS
    action = result.verdict?.action;
    if (badTrends === 3 && windowRoas < 4.0 && action !== 'REDUCE' && action !== 'STOP') {
        overrideReason = `3/3 trends xấu + window ROAS ${windowRoas.toFixed(2)}x < 4 → REDUCE`;
        console.warn(`[GUARDRAIL_v2] ⚠️ ${overrideReason}`);
        result.verdict = {
            action: 'REDUCE',
            headline: `Tất cả metrics suy giảm, ROAS gần đây ${windowRoas.toFixed(1)}x — Giảm budget`,
            condition: result.verdict?.condition,
        };
        result.reasoning = `[GHI ĐÈ] 3/3 trends xấu + window ROAS < 4. ` + result.reasoning;
    }

    // RULE 4: ROAS < 1 → CANNOT be SCALE
    action = result.verdict?.action;
    if (roas < 1 && action === 'SCALE') {
        overrideReason = `ROAS ${roas.toFixed(2)}x < 1 (lỗ) → REDUCE`;
        console.warn(`[GUARDRAIL_v2] ⚠️ ${overrideReason}`);
        result.verdict = {
            action: 'REDUCE',
            headline: `ROAS ${roas.toFixed(1)}x - Campaign đang lỗ, cần giảm budget`,
            condition: result.verdict?.condition,
        };
        result.reasoning = `[GHI ĐÈ] ROAS ${roas.toFixed(2)}x < 1 = lỗ. ` + result.reasoning;
    }

    // RULE 5: Financial status must match ROAS
    if (roas >= 4 && result.dimensions?.financial?.status === 'critical') {
        result.dimensions.financial.status = 'excellent';
        result.dimensions.financial.summary = `ROAS ${roas.toFixed(2)}x - XUẤT SẮC (${result.dimensions.financial.summary})`;
    }
    if (roas >= 2 && roas < 4 && result.dimensions?.financial?.status === 'critical') {
        result.dimensions.financial.status = 'good';
    }

    // --- Track guardrail result ---
    const finalVerdict = result.verdict?.action || 'N/A';
    result._guardrail = {
        originalVerdict,
        finalVerdict,
        overrideReason: overrideReason || 'Không can thiệp',
        wasOverridden: originalVerdict !== finalVerdict,
        trendDetail: trendDetail || 'Không đủ data để tính trend',
    };

    if (result._guardrail.wasOverridden) {
        console.warn(`[GUARDRAIL_v2] 🔴 OVERRIDDEN: ${originalVerdict} → ${finalVerdict} | ${overrideReason}`);
    } else {
        console.log(`[GUARDRAIL_v2] 🟢 PASSED: AI verdict ${finalVerdict} matches safety checks`);
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
1. Đánh giá metrics theo BENCHMARK đã cho
2. Tìm ROOT CAUSE cho vấn đề (nếu có)
3. Đưa ra VERDICT dứt khoát - PHẢI dựa trên XU HƯỚNG 7 NGÀY GẦN NHẤT
4. Dự đoán 3-5 ngày tới
${contentAnalysis && contentAnalysis.length > 0 ? `5. Đánh giá TỪNG CONTENT: content nào nên tắt, content nào nên giữ/scale, có cần tạo content mới không?
6. Nếu phát hiện content bão hoà chiếm % chi tiêu lớn → CẢNH BÁO rõ ràng
` : ''}
KIỂM TRA LẦN CUỐI trước khi output:
- Verdict dựa trên 7 NGÀY GẦN NHẤT, không phải ROAS tổng
- Nếu CPP đang TĂNG + CTR đang GIẢM → KHÔNG ĐƯỢC nói SCALE
- Nếu 2/3 metrics đang xấu đi → verdict tối đa là MAINTAIN
- headline phải phản ánh xu hướng gần đây, không phải thành tích quá khứ

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
