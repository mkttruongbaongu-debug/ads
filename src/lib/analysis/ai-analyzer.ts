/**
 * ===================================================================
 * AI DEEP ANALYZER v5 - REASONING-FIRST
 * ===================================================================
 * Model: o4-mini (reasoning model)
 * v5 Changes:
 * - Removed hard benchmarks → AI calculates context-aware benchmarks
 * - Removed rule-based verdict → AI reasons freely (only 2 safety guardrails)
 * - Requires specific content names in actionPlan
 * - Reasoning chain: Observe → Hypothesize → Verify → Conclude
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
        adId: string;
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
// SYSTEM PROMPT v5 - REASONING-FIRST
// ===================================================================
const SYSTEM_PROMPT = `Bạn là một Performance Analyst chuyên Facebook Ads cho ngành F&B Việt Nam.
Bạn KHÔNG phải chatbot. Bạn là chuyên gia phân tích — suy luận từ DATA, không phải lặp lại quy tắc.

═══════════════════════════════════════════
PHƯƠNG PHÁP PHÂN TÍCH
═══════════════════════════════════════════

Với mỗi campaign, bạn phải tư duy theo chuỗi:

1. QUAN SÁT: Data nói gì? Trends thực tế ra sao? Có gì bất thường?
2. GIẢ THUYẾT: Tại sao metrics thay đổi? Nguyên nhân gốc rễ là gì?
   - CPP tăng → do creative fatigue? do audience cạn? do FB thay đổi phân phối?
   - CTR giảm → do content cũ? do tần suất cao? do đối tượng không phù hợp?
   - ROAS tốt nhưng trend xấu → đang ăn vào quán tính cũ, sắp sụp?
3. KIỂM CHỨNG: Daily data có ủng hộ giả thuyết không? Content nào đang kéo/đẩy?
4. KẾT LUẬN: Hành động cụ thể là gì? Dựa trên bằng chứng nào?

QUAN TRỌNG — BẠN PHẢI TỰ TÍNH BENCHMARK:
- Giá sản phẩm TB = Doanh thu / Số đơn → CPP hợp lý = khoảng 30-50% giá sản phẩm
- Nếu bán sản phẩm 500K mà CPP 100K → vẫn rất tốt (ROAS ~5x)
- Nếu bán sản phẩm 50K mà CPP 30K → gần hòa vốn, nguy hiểm
- KHÔNG dùng benchmark cứng — mỗi campaign có context riêng

═══════════════════════════════════════════
QUY TẮC AN TOÀN
═══════════════════════════════════════════

1. ROAS < 1 = ĐANG LỖ → verdict KHÔNG được là SCALE
2. Window ROAS (7 ngày gần nhất) mới phản ánh thực tế — ROAS tổng có thể misleading
3. dataBasis.days PHẢI = TỔNG SỐ NGÀY data được cung cấp (đếm dailyTrend). KHÔNG tự ý cắt bớt.

═══════════════════════════════════════════
QUY TẮC TUYỆT ĐỐI — KHÔNG ĐƯỢC VI PHẠM
═══════════════════════════════════════════

- KHÔNG ĐƯỢC gợi ý NỘI DUNG creative cụ thể (video gì, hình gì, viết về gì, chủ đề gì)
- BẠN KHÔNG BIẾT sản phẩm là gì, ngành hàng gì → KHÔNG ĐƯỢC SUY DIỄN từ tên campaign
- Ví dụ CẤM: "video 15s giới thiệu đặc sản Huế", "carousel combo sản phẩm", "UGC review"
- shortTerm.action CHỈ ghi HÀNH ĐỘNG: "Tạo 2 creative mới để A/B test thay thế content đang yếu"
- KHÔNG mô tả nội dung creative vì bạn KHÔNG CÓ thông tin về sản phẩm/ngành hàng

Ngoài các quy tắc trên, bạn HOÀN TOÀN TỰ DO suy luận và đưa verdict.

═══════════════════════════════════════════
VERDICT
═══════════════════════════════════════════

5 mức: SCALE | MAINTAIN | WATCH | REDUCE | STOP
Bạn tự quyết dựa trên phân tích. KHÔNG có công thức — dùng NÃO.

═══════════════════════════════════════════
NGUYÊN TẮC CỐT LÕI: 1 ĐỀ XUẤT = 1 HÀNH ĐỘNG DUY NHẤT
═══════════════════════════════════════════

Hệ thống chạy vòng lặp tự động: SOI → TỐI ƯU → GIÁM SÁT → SOI LẠI.
Mỗi lần phân tích CHỈ đề xuất 1 HÀNH ĐỘNG DUY NHẤT — hành động ưu tiên cao nhất.

TẠI SAO: Nếu thay đổi nhiều biến cùng lúc (vừa tắt content, vừa tăng budget),
khi metrics thay đổi sẽ KHÔNG BIẾT do yếu tố nào → KHÔNG HỌC ĐƯỢC GÌ.
1 thay đổi → đo → kết luận → thay đổi tiếp. Các hành động còn lại sẽ được đề xuất ở vòng SOI tiếp theo.

THỨ TỰ ƯU TIÊN HÀNH ĐỘNG:
1. Tắt content đang gây hại (CPP cao, ROAS thấp) → ưu tiên cao nhất vì giảm phí ngay
2. Thay đổi budget (tăng/giảm) → ưu tiên thứ 2
3. Tạo creative mới → ưu tiên thứ 3 (chỉ đề xuất khi không có content cần tắt và budget đã ổn)

QUY TẮC actionPlan:

1. immediate.action = 1 HÀNH ĐỘNG DUY NHẤT, CỤ THỂ:
   ✅ "Tắt content \\"V3 REEL\\" (CPP +2.1σ, CTR giảm 35%)" — 1 hành động
   ✅ "Tăng daily budget 20% (từ 200K lên 240K)" — 1 hành động
   ✅ "Không cần thay đổi. Giữ nguyên chiến lược." — MAINTAIN
   ❌ "Tắt content + Tăng budget + Tạo creative mới" — CẤM gom nhiều hành động!
   ❌ "Tắt 2 creative đang bão hoà" — KHÔNG CỤ THỂ, cấm!

2. KHÔNG CÓ shortTerm — hệ thống sẽ tự đề xuất ở vòng SOI tiếp theo

3. CẤM lời khuyên chung chung kiểu sách giáo khoa:
   ❌ "Luôn duy trì 5 creative thay thế"
   ❌ "Theo dõi CTR & CPP hàng ngày"

═══════════════════════════════════════════
OUTPUT FORMAT (JSON — giữ nguyên structure)
═══════════════════════════════════════════
{
  "dataBasis": { "days": <TỔNG SỐ NGÀY trong dailyTrend>, "orders": <tổng purchases>, "spend": <tổng spend> },
  "dimensions": {
    "financial": {
      "status": "good|excellent|warning|critical",
      "summary": "Phân tích TÀI CHÍNH dựa trên context sản phẩm, KHÔNG dùng benchmark cứng",
      "detail": "Giải thích WHY — tại sao status này, bằng chứng nào"
    },
    "content": {
      "status": "...",
      "summary": "Phân tích CONTENT: content nào tốt/xấu, NÊU TÊN CỤ THỂ",
      "detail": "NÊU TÊN content + lý do: V3 REEL đang bão hoà vì CTR giảm từ 8% xuống 4%"
    },
    "audience": {
      "status": "...",
      "summary": "Phân tích ĐỐI TƯỢNG: frequency, reach, cạn audience?",
      "detail": "..."
    },
    "trend": {
      "direction": "improving|stable|declining",
      "summary": "XU HƯỚNG tổng: campaign đang đi lên hay xuống? Dựa trên 3-5 ngày gần nhất",
      "detail": "..."
    }
  },
  "patterns": {
    "peakInsight": "Ngày tốt nhất + giải thích TẠI SAO",
    "troughInsight": "Ngày tệ nhất + giải thích TẠI SAO",
    "dayOfWeekPattern": "Pattern thứ trong tuần nếu có",
    "volatilityAssessment": "Mức biến động: ổn định hay thất thường?"
  },
  "creativeHealth": {
    "status": "healthy|early_warning|fatigued|critical",
    "ctrTrend": "CTR đang thế nào, DÙNG SỐ CỤ THỂ",
    "frequencyStatus": "Frequency bao nhiêu, ý nghĩa gì",
    "diagnosis": "CHẨN ĐOÁN gốc rễ: creative fatigue? audience saturated? content nicht relevant?",
    "urgency": "none|low|medium|high|critical"
  },
  "verdict": {
    "action": "SCALE|MAINTAIN|WATCH|REDUCE|STOP",
    "headline": "1 câu ngắn gọn — HÀNH ĐỘNG + LÝ DO cốt lõi",
    "condition": "Điều kiện chuyển sang verdict khác"
  },
  "actionPlan": {
    "immediate": {
      "action": "1 HÀNH ĐỘNG DUY NHẤT — cụ thể: tên content/con số/deadline. KHÔNG gom nhiều hành động.",
      "reason": "TẠI SAO làm điều này (dựa trên bằng chứng từ data)",
      "metric_to_watch": "SỐ CỤ THỂ cần theo dõi trong bao lâu"
    }
  },
  "prediction": {
    "noAction": "Nếu KHÔNG làm gì: dự đoán CỤ THỂ bằng số liệu",
    "withAction": "Nếu LÀM THEO actionPlan: kỳ vọng CỤ THỂ bằng số liệu"
  },
  "warningSignals": [
    {
      "type": "loại cảnh báo",
      "severity": "low|medium|high|critical",
      "evidence": "BẰNG CHỨNG cụ thể từ data"
    }
  ],
  "reasoning": "CHUỖI SUY LUẬN ĐẦY ĐỦ: Tôi thấy X trong data → Giả thuyết Y → Kiểm chứng bằng Z → Kết luận W. Đây là phần QUAN TRỌNG NHẤT — cho thấy bạn THỰC SỰ HIỂU campaign."
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
// GUARDRAILS v3 - MINIMAL SAFETY NET (trust AI reasoning)
// ===================================================================
function applyGuardrails(
    result: AIAnalysisResult,
    metrics: CampaignContext['metrics'],
    dailyTrend: CampaignContext['dailyTrend']
): AIAnalysisResult {
    const roas = metrics.roas;
    let action = result.verdict?.action;
    const originalVerdict = action || 'N/A';
    let overrideReason = '';

    // --- Calculate window trends (for logging only) ---
    const windowSize = Math.min(7, Math.floor(dailyTrend.length / 3));
    const windowDays = dailyTrend.slice(-windowSize);
    const historyDays = dailyTrend.slice(0, -windowSize);
    let trendDetail = '';

    if (historyDays.length >= 5 && windowDays.length >= 3) {
        const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const histCtr = avg(historyDays.map(d => d.ctr));
        const histCpp = avg(historyDays.map(d => d.cpp));
        const windowCtr = avg(windowDays.map(d => d.ctr));
        const windowCpp = avg(windowDays.map(d => d.cpp));
        const windowRevenue = windowDays.reduce((s, d) => s + (d.revenue || 0), 0);
        const windowSpend = windowDays.reduce((s, d) => s + d.spend, 0);
        const windowRoas = windowSpend > 0 && windowRevenue > 0 ? windowRevenue / windowSpend : roas;

        trendDetail = `windowCPP=${formatMoney(windowCpp)} vs hist=${formatMoney(histCpp)} | windowCTR=${windowCtr.toFixed(2)}% vs hist=${histCtr.toFixed(2)}% | windowROAS=${windowRoas.toFixed(2)}x`;
        console.log(`[GUARDRAIL_v3] 📊 Trends: ${trendDetail}`);
    }

    // RULE 1 (AN TOÀN): ROAS < 1 = ĐANG LỖ → KHÔNG được SCALE
    action = result.verdict?.action;
    if (roas < 1 && action === 'SCALE') {
        overrideReason = `ROAS ${roas.toFixed(2)}x < 1 (lỗ) → không cho SCALE`;
        console.warn(`[GUARDRAIL_v3] ⚠️ ${overrideReason}`);
        result.verdict = {
            action: 'REDUCE',
            headline: `ROAS ${roas.toFixed(1)}x — Campaign đang lỗ`,
            condition: result.verdict?.condition,
        };
        result.reasoning = `[GUARDRAIL] ROAS < 1 = lỗ, không thể SCALE. ` + result.reasoning;
    }

    // RULE 2 (AN TOÀN): ROAS < 1 + AI nói MAINTAIN → nâng lên REDUCE
    action = result.verdict?.action;
    if (roas < 1 && (action === 'MAINTAIN' || action === 'WATCH')) {
        overrideReason = `ROAS ${roas.toFixed(2)}x < 1 nhưng AI nói ${action} → REDUCE`;
        console.warn(`[GUARDRAIL_v3] ⚠️ ${overrideReason}`);
        result.verdict = {
            action: 'REDUCE',
            headline: `ROAS ${roas.toFixed(1)}x — Campaign đang lỗ, cần giảm chi tiêu`,
            condition: result.verdict?.condition,
        };
        result.reasoning = `[GUARDRAIL] ROAS < 1 = đang lỗ tiền, không thể duy trì. ` + result.reasoning;
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
        console.warn(`[GUARDRAIL_v3] 🔴 OVERRIDDEN: ${originalVerdict} → ${finalVerdict} | ${overrideReason}`);
    } else {
        console.log(`[GUARDRAIL_v3] 🟢 PASSED: AI verdict ${finalVerdict} — tin tưởng AI reasoning`);
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

💰 PHÂN TÍCH NGÂN SÁCH (BUDGET vs HIỆU SUẤT):
- Chi tiêu TB/ngày: ${formatMoney(preprocessed.budgetAnalysis.avgDailySpend)}
- Khoảng: ${formatMoney(preprocessed.budgetAnalysis.minDailySpend)} - ${formatMoney(preprocessed.budgetAnalysis.maxDailySpend)}/ngày
${preprocessed.budgetAnalysis.optimalSpendRange
            ? `- 🎯 VÙNG TỐI ƯU: ${formatMoney(preprocessed.budgetAnalysis.optimalSpendRange.min)}-${formatMoney(preprocessed.budgetAnalysis.optimalSpendRange.max)}/ngày (CPP ${formatMoney(preprocessed.budgetAnalysis.optimalSpendRange.avgCpp)})`
            : '- Chưa xác định vùng tối ưu'}
- Tương quan Spend↔CPP: ${preprocessed.budgetAnalysis.spendCppCorrelation === 'positive' ? '⚠️ DƯƠNG (chi nhiều → CPP tăng)' : preprocessed.budgetAnalysis.spendCppCorrelation === 'negative' ? '✅ ÂM (chi nhiều → CPP giảm)' : 'Không rõ ràng'}
${preprocessed.budgetAnalysis.budgetSpikes.length > 0
            ? `- Budget Spikes: ${preprocessed.budgetAnalysis.budgetSpikes.map(s => `${s.date}: +${s.changePercent.toFixed(0)}% → CPP ${s.cppImpact > 0 ? '+' : ''}${s.cppImpact.toFixed(0)}%`).join(', ')}`
            : '- Không có budget spike'}
- ${preprocessed.budgetAnalysis.insight}

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
        const summary = `${i + 1}. [${c.badge}] "${c.name}" (ID: ${c.adId}) — FB chi ${c.spendShare.toFixed(0)}% — Chi: ${formatMoney(c.spend)} — Thu: ${formatMoney(c.revenue)} — ${c.purchases} đơn — CPP: ${formatMoney(c.cpp)} — CTR: ${c.ctr.toFixed(2)}% — ROAS: ${roasText}\n   → ${c.zScoreTip}`;
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
${contentAnalysis && contentAnalysis.length > 0 ? `5. Đánh giá TỪNG CONTENT: xác định content NÀO đang kéo hiệu quả xuống nhiều nhất
6. actionPlan.immediate CHỈ chứa 1 HÀNH ĐỘNG DUY NHẤT — ưu tiên: tắt content xấu > thay budget > tạo creative mới
7. ⚠️ BẮT BUỘC GHI AD ID: Khi nhắc đến content/ad trong action, LUÔN ghi kèm (ID: xxx). VD: Tắt content "3" (ID: 120215940419750361). Nếu KHÔNG ghi ID → hệ thống TẮT NHẦM khi có nhiều ad cùng tên.
` : ''}
KIỂM TRA LẦN CUỐI trước khi output:
- Verdict dựa trên 7 NGÀY GẦN NHẤT, không phải ROAS tổng
- Nếu CPP đang TĂNG + CTR đang GIẢM → KHÔNG ĐƯỢC nói SCALE
- Nếu 2/3 metrics đang xấu đi → verdict tối đa là MAINTAIN
- headline phải phản ánh xu hướng gần đây, không phải thành tích quá khứ
- actionPlan.immediate PHẢI là 1 HÀNH ĐỘNG DUY NHẤT — KHÔNG gom nhiều bước

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
