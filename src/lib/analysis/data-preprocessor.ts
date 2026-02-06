/**
 * ===================================================================
 * DATA PRE-PROCESSOR FOR AI ANALYSIS
 * ===================================================================
 * Tính toán insights TRƯỚC khi gửi cho AI để AI có context tốt hơn.
 * 
 * Bao gồm:
 * - Day-of-week pattern analysis
 * - Peak/Trough detection
 * - Creative fatigue detection (CTR + Frequency correlation)
 * - Trend analysis với moving average
 * - Phase segmentation
 * - Volatility scoring
 * ===================================================================
 */

export interface DailyMetric {
    date: string;
    spend: number;
    purchases: number;
    revenue: number;
    cpp: number;
    roas: number;
    ctr: number;
    cpm: number;
    frequency?: number;
    impressions: number;
    clicks: number;
}

export interface PreprocessedInsights {
    // Thống kê cơ bản
    basics: {
        totalDays: number;
        totalSpend: number;
        totalPurchases: number;
        avgCpp: number;
        avgRoas: number;
        avgCtr: number;
    };

    // Peak/Trough analysis
    peakDay: {
        date: string;
        dayOfWeek: string;
        cpp: number;
        roas: number;
        purchases: number;
        reason: string;
    } | null;

    troughDay: {
        date: string;
        dayOfWeek: string;
        cpp: number;
        roas: number;
        purchases: number;
        reason: string;
    } | null;

    // Day-of-week patterns (F&B rất quan trọng!)
    dayOfWeekPattern: {
        bestDays: string[];        // e.g., ["T6", "T7", "CN"]
        worstDays: string[];       // e.g., ["T2", "T3"]
        avgByDay: Record<string, { cpp: number; roas: number; purchases: number }>;
        hasClearPattern: boolean;  // true nếu variance đủ lớn
        insight: string;
    };

    // Creative fatigue detection
    creativeFatigue: {
        status: 'healthy' | 'early_warning' | 'fatigued' | 'critical';
        ctrTrend: 'stable' | 'declining' | 'improving';
        ctrDeclinePercent: number;
        frequencyLevel: 'low' | 'medium' | 'high' | 'saturated';
        frequencyValue: number;
        diagnosis: string;
        recommendation: string;
    };

    // Trend analysis (3 ngày gần vs toàn bộ)
    trend: {
        direction: 'improving' | 'stable' | 'declining' | 'volatile';
        cppChange: number;      // % change
        roasChange: number;     // % change
        movingAvg3Day: { cpp: number; roas: number };
        movingAvg7Day: { cpp: number; roas: number };
        insight: string;
    };

    // Phase segmentation
    phases: Array<{
        startDate: string;
        endDate: string;
        type: 'learning' | 'growth' | 'stable' | 'declining' | 'volatile';
        avgCpp: number;
        avgRoas: number;
        daysCount: number;
    }>;

    // Volatility (độ biến động)
    volatility: {
        level: 'low' | 'medium' | 'high';
        cppStdDev: number;
        cppCoeffVar: number;  // stdDev / mean - normalized
        insight: string;
    };

    // Warning signals
    warningSignals: Array<{
        type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        evidence: string;
        recommendation: string;
    }>;

    // Prediction
    prediction: {
        noAction: string;
        withAction: string;
    };
}

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function getDayOfWeek(dateStr: string): string {
    const date = new Date(dateStr);
    return DAY_NAMES[date.getDay()];
}

function calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function formatMoney(amount: number): string {
    return Math.round(amount).toLocaleString('de-DE') + '₫';
}

// ===================================================================
// MAIN PREPROCESSING FUNCTION
// ===================================================================

export function preprocessCampaignData(dailyMetrics: DailyMetric[]): PreprocessedInsights {
    if (dailyMetrics.length === 0) {
        return getEmptyInsights();
    }

    // Sort by date
    const sorted = [...dailyMetrics].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate basics
    const basics = calculateBasics(sorted);

    // Find peak and trough
    const { peakDay, troughDay } = findPeakAndTrough(sorted, basics);

    // Day-of-week analysis
    const dayOfWeekPattern = analyzeDayOfWeek(sorted);

    // Creative fatigue detection
    const creativeFatigue = detectCreativeFatigue(sorted);

    // Trend analysis
    const trend = analyzeTrend(sorted, basics);

    // Phase segmentation
    const phases = segmentPhases(sorted, basics);

    // Volatility
    const volatility = calculateVolatility(sorted, basics);

    // Warning signals
    const warningSignals = detectWarningSignals({
        basics, creativeFatigue, trend, volatility, sorted
    });

    // Prediction
    const prediction = generatePrediction({
        trend, creativeFatigue, warningSignals, sorted
    });

    return {
        basics,
        peakDay,
        troughDay,
        dayOfWeekPattern,
        creativeFatigue,
        trend,
        phases,
        volatility,
        warningSignals,
        prediction,
    };
}

// ===================================================================
// CALCULATION FUNCTIONS
// ===================================================================

function calculateBasics(data: DailyMetric[]) {
    const totalSpend = data.reduce((sum, d) => sum + d.spend, 0);
    const totalPurchases = data.reduce((sum, d) => sum + d.purchases, 0);
    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

    // Weighted averages for CPP/ROAS/CTR
    const avgCpp = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
    const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const avgCtr = data.reduce((sum, d) => sum + d.ctr, 0) / data.length;

    return {
        totalDays: data.length,
        totalSpend,
        totalPurchases,
        avgCpp,
        avgRoas,
        avgCtr,
    };
}

function findPeakAndTrough(data: DailyMetric[], basics: ReturnType<typeof calculateBasics>) {
    // Filter days with purchases for meaningful comparison
    const daysWithPurchases = data.filter(d => d.purchases > 0);

    if (daysWithPurchases.length === 0) {
        return { peakDay: null, troughDay: null };
    }

    // Peak = lowest CPP (best efficiency)
    const peak = daysWithPurchases.reduce((best, d) =>
        d.cpp < best.cpp ? d : best
    );

    // Trough = highest CPP (worst efficiency)
    const trough = daysWithPurchases.reduce((worst, d) =>
        d.cpp > worst.cpp ? d : worst
    );

    const peakDay = {
        date: peak.date,
        dayOfWeek: getDayOfWeek(peak.date),
        cpp: peak.cpp,
        roas: peak.roas,
        purchases: peak.purchases,
        reason: `CPP thấp nhất ${formatMoney(peak.cpp)} (thấp hơn TB ${((1 - peak.cpp / basics.avgCpp) * 100).toFixed(0)}%)`,
    };

    const troughDay = {
        date: trough.date,
        dayOfWeek: getDayOfWeek(trough.date),
        cpp: trough.cpp,
        roas: trough.roas,
        purchases: trough.purchases,
        reason: `CPP cao nhất ${formatMoney(trough.cpp)} (cao hơn TB ${((trough.cpp / basics.avgCpp - 1) * 100).toFixed(0)}%)`,
    };

    return { peakDay, troughDay };
}

function analyzeDayOfWeek(data: DailyMetric[]) {
    const byDay: Record<string, DailyMetric[]> = {};

    // Group by day of week
    for (const d of data) {
        const dow = getDayOfWeek(d.date);
        if (!byDay[dow]) byDay[dow] = [];
        byDay[dow].push(d);
    }

    // Calculate averages per day
    const avgByDay: Record<string, { cpp: number; roas: number; purchases: number }> = {};

    for (const [day, metrics] of Object.entries(byDay)) {
        const totalSpend = metrics.reduce((s, m) => s + m.spend, 0);
        const totalPurchases = metrics.reduce((s, m) => s + m.purchases, 0);
        const totalRevenue = metrics.reduce((s, m) => s + m.revenue, 0);

        avgByDay[day] = {
            cpp: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
            roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
            purchases: totalPurchases / metrics.length,
        };
    }

    // Find best and worst days (by ROAS)
    const dayEntries = Object.entries(avgByDay).filter(([_, v]) => v.purchases > 0);
    dayEntries.sort((a, b) => b[1].roas - a[1].roas);

    const bestDays = dayEntries.slice(0, 3).map(([d]) => d);
    const worstDays = dayEntries.slice(-2).map(([d]) => d);

    // Check if pattern is clear (variance > 20%)
    const roasValues = dayEntries.map(([_, v]) => v.roas);
    const roasStdDev = calculateStdDev(roasValues);
    const roasMean = roasValues.reduce((a, b) => a + b, 0) / roasValues.length;
    const hasClearPattern = roasMean > 0 && (roasStdDev / roasMean) > 0.2;

    // Generate insight
    let insight = '';
    if (hasClearPattern) {
        const weekendDays = ['T6', 'T7', 'CN'];
        const bestAreWeekend = bestDays.every(d => weekendDays.includes(d));
        if (bestAreWeekend) {
            insight = `Pattern F&B điển hình: Cuối tuần (${bestDays.join(', ')}) hiệu suất cao hơn 20-40%.`;
        } else {
            insight = `Ngày tốt nhất: ${bestDays.join(', ')}. Ngày yếu: ${worstDays.join(', ')}.`;
        }
    } else {
        insight = 'Không có pattern ngày trong tuần rõ ràng.';
    }

    return {
        bestDays,
        worstDays,
        avgByDay,
        hasClearPattern,
        insight,
    };
}

function detectCreativeFatigue(data: DailyMetric[]) {
    if (data.length < 3) {
        return {
            status: 'healthy' as const,
            ctrTrend: 'stable' as const,
            ctrDeclinePercent: 0,
            frequencyLevel: 'low' as const,
            frequencyValue: 0,
            diagnosis: 'Chưa đủ dữ liệu để đánh giá',
            recommendation: 'Tiếp tục theo dõi',
        };
    }

    // CTR trend: first half vs last half
    const half = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, half);
    const lastHalf = data.slice(-half);

    const avgCtrFirst = firstHalf.reduce((s, d) => s + d.ctr, 0) / firstHalf.length;
    const avgCtrLast = lastHalf.reduce((s, d) => s + d.ctr, 0) / lastHalf.length;
    const ctrDeclinePercent = avgCtrFirst > 0 ? ((avgCtrFirst - avgCtrLast) / avgCtrFirst) * 100 : 0;

    let ctrTrend: 'stable' | 'declining' | 'improving' = 'stable';
    if (ctrDeclinePercent > 15) ctrTrend = 'declining';
    else if (ctrDeclinePercent < -15) ctrTrend = 'improving';

    // Frequency analysis
    const freqData = data.filter(d => d.frequency !== undefined);
    const avgFreq = freqData.length > 0
        ? freqData.reduce((s, d) => s + (d.frequency || 0), 0) / freqData.length
        : 0;

    let frequencyLevel: 'low' | 'medium' | 'high' | 'saturated' = 'low';
    if (avgFreq >= 3) frequencyLevel = 'saturated';
    else if (avgFreq >= 2.5) frequencyLevel = 'high';
    else if (avgFreq >= 2) frequencyLevel = 'medium';

    // Diagnose fatigue
    let status: 'healthy' | 'early_warning' | 'fatigued' | 'critical' = 'healthy';
    let diagnosis = '';
    let recommendation = '';

    if (ctrTrend === 'declining' && frequencyLevel === 'saturated') {
        status = 'critical';
        diagnosis = `Creative đã kiệt sức: CTR giảm ${ctrDeclinePercent.toFixed(0)}% + Frequency ${avgFreq.toFixed(1)} (bão hòa).`;
        recommendation = 'Thay creative MỚI HOÀN TOÀN ngay lập tức. Không thể cứu creative cũ.';
    } else if (ctrTrend === 'declining' && frequencyLevel === 'high') {
        status = 'fatigued';
        diagnosis = `Creative đang mệt: CTR giảm ${ctrDeclinePercent.toFixed(0)}%, Frequency ${avgFreq.toFixed(1)} đang cao.`;
        recommendation = 'Chuẩn bị creative backup trong 24-48h. Có thể test thêm interest mới.';
    } else if (ctrTrend === 'declining' && frequencyLevel === 'low') {
        status = 'early_warning';
        diagnosis = `CTR giảm ${ctrDeclinePercent.toFixed(0)}% nhưng Frequency còn thấp (${avgFreq.toFixed(1)}) - có thể do content yếu, không phải audience exhaustion.`;
        recommendation = 'Review lại hook/angle của creative. Test variant khác.';
    } else if (ctrTrend === 'stable' && frequencyLevel === 'high') {
        status = 'early_warning';
        diagnosis = `Frequency ${avgFreq.toFixed(1)} đang cao dù CTR còn ổn. Audience sắp bão hòa.`;
        recommendation = 'Mở rộng audience hoặc chuẩn bị creative mới trước khi CTR giảm.';
    } else {
        status = 'healthy';
        diagnosis = `Creative khỏe mạnh: CTR ổn định, Frequency ${avgFreq.toFixed(1)} còn thấp.`;
        recommendation = 'Tiếp tục chạy, theo dõi hàng ngày.';
    }

    return {
        status,
        ctrTrend,
        ctrDeclinePercent,
        frequencyLevel,
        frequencyValue: avgFreq,
        diagnosis,
        recommendation,
    };
}

function analyzeTrend(data: DailyMetric[], basics: ReturnType<typeof calculateBasics>) {
    if (data.length < 3) {
        return {
            direction: 'stable' as const,
            cppChange: 0,
            roasChange: 0,
            movingAvg3Day: { cpp: basics.avgCpp, roas: basics.avgRoas },
            movingAvg7Day: { cpp: basics.avgCpp, roas: basics.avgRoas },
            insight: 'Chưa đủ dữ liệu để phân tích trend',
        };
    }

    // Last 3 days moving average
    const last3 = data.slice(-3);
    const last3Spend = last3.reduce((s, d) => s + d.spend, 0);
    const last3Purchases = last3.reduce((s, d) => s + d.purchases, 0);
    const last3Revenue = last3.reduce((s, d) => s + d.revenue, 0);
    const movingAvg3Day = {
        cpp: last3Purchases > 0 ? last3Spend / last3Purchases : 0,
        roas: last3Spend > 0 ? last3Revenue / last3Spend : 0,
    };

    // Last 7 days (or all if < 7)
    const last7 = data.slice(-Math.min(7, data.length));
    const last7Spend = last7.reduce((s, d) => s + d.spend, 0);
    const last7Purchases = last7.reduce((s, d) => s + d.purchases, 0);
    const last7Revenue = last7.reduce((s, d) => s + d.revenue, 0);
    const movingAvg7Day = {
        cpp: last7Purchases > 0 ? last7Spend / last7Purchases : 0,
        roas: last7Spend > 0 ? last7Revenue / last7Spend : 0,
    };

    // Calculate changes
    const cppChange = movingAvg7Day.cpp > 0
        ? ((movingAvg3Day.cpp - movingAvg7Day.cpp) / movingAvg7Day.cpp) * 100
        : 0;
    const roasChange = movingAvg7Day.roas > 0
        ? ((movingAvg3Day.roas - movingAvg7Day.roas) / movingAvg7Day.roas) * 100
        : 0;

    // Determine direction
    let direction: 'improving' | 'stable' | 'declining' | 'volatile' = 'stable';
    const cppStdDev = calculateStdDev(data.map(d => d.cpp));
    const isVolatile = basics.avgCpp > 0 && (cppStdDev / basics.avgCpp) > 0.4;

    if (isVolatile) {
        direction = 'volatile';
    } else if (cppChange > 20) {
        direction = 'declining';  // CPP increasing = bad
    } else if (cppChange < -10) {
        direction = 'improving';  // CPP decreasing = good
    }

    // Generate insight
    let insight = '';
    if (direction === 'improving') {
        insight = `Đang cải thiện: CPP giảm ${Math.abs(cppChange).toFixed(0)}% trong 3 ngày gần (${formatMoney(movingAvg3Day.cpp)} vs TB ${formatMoney(movingAvg7Day.cpp)})`;
    } else if (direction === 'declining') {
        insight = `Đang suy giảm: CPP tăng ${cppChange.toFixed(0)}% trong 3 ngày gần (${formatMoney(movingAvg3Day.cpp)} vs TB ${formatMoney(movingAvg7Day.cpp)})`;
    } else if (direction === 'volatile') {
        insight = `Biến động mạnh: CPP dao động lớn (độ lệch chuẩn ${formatMoney(cppStdDev)}). Cần thêm dữ liệu.`;
    } else {
        insight = `Ổn định: CPP 3 ngày gần (${formatMoney(movingAvg3Day.cpp)}) tương đương TB (${formatMoney(movingAvg7Day.cpp)})`;
    }

    return {
        direction,
        cppChange,
        roasChange,
        movingAvg3Day,
        movingAvg7Day,
        insight,
    };
}

function segmentPhases(data: DailyMetric[], basics: ReturnType<typeof calculateBasics>) {
    // Simple phase detection: learning (first 3 days), then stable/growth/decline
    if (data.length < 5) {
        return [{
            startDate: data[0]?.date || '',
            endDate: data[data.length - 1]?.date || '',
            type: 'learning' as const,
            avgCpp: basics.avgCpp,
            avgRoas: basics.avgRoas,
            daysCount: data.length,
        }];
    }

    const phases: PreprocessedInsights['phases'] = [];

    // First 3 days = learning
    const learningDays = data.slice(0, 3);
    const learningSpend = learningDays.reduce((s, d) => s + d.spend, 0);
    const learningPurchases = learningDays.reduce((s, d) => s + d.purchases, 0);
    const learningRevenue = learningDays.reduce((s, d) => s + d.revenue, 0);

    phases.push({
        startDate: learningDays[0].date,
        endDate: learningDays[learningDays.length - 1].date,
        type: 'learning',
        avgCpp: learningPurchases > 0 ? learningSpend / learningPurchases : 0,
        avgRoas: learningSpend > 0 ? learningRevenue / learningSpend : 0,
        daysCount: 3,
    });

    // Rest: determine if stable, growth, or decline
    const restDays = data.slice(3);
    if (restDays.length > 0) {
        const restSpend = restDays.reduce((s, d) => s + d.spend, 0);
        const restPurchases = restDays.reduce((s, d) => s + d.purchases, 0);
        const restRevenue = restDays.reduce((s, d) => s + d.revenue, 0);
        const restCpp = restPurchases > 0 ? restSpend / restPurchases : 0;
        const restRoas = restSpend > 0 ? restRevenue / restSpend : 0;

        // Compare first half vs last half of rest
        const half = Math.floor(restDays.length / 2);
        const firstHalf = restDays.slice(0, Math.max(1, half));
        const lastHalf = restDays.slice(-Math.max(1, half));

        const firstCpp = firstHalf.reduce((s, d) => s + d.cpp, 0) / firstHalf.length;
        const lastCpp = lastHalf.reduce((s, d) => s + d.cpp, 0) / lastHalf.length;

        let type: 'stable' | 'growth' | 'declining' | 'volatile' = 'stable';
        const cppChange = firstCpp > 0 ? ((lastCpp - firstCpp) / firstCpp) * 100 : 0;

        if (cppChange > 20) type = 'declining';
        else if (cppChange < -15) type = 'growth';

        phases.push({
            startDate: restDays[0].date,
            endDate: restDays[restDays.length - 1].date,
            type,
            avgCpp: restCpp,
            avgRoas: restRoas,
            daysCount: restDays.length,
        });
    }

    return phases;
}

function calculateVolatility(data: DailyMetric[], basics: ReturnType<typeof calculateBasics>) {
    const cppValues = data.filter(d => d.purchases > 0).map(d => d.cpp);

    if (cppValues.length < 2) {
        return {
            level: 'low' as const,
            cppStdDev: 0,
            cppCoeffVar: 0,
            insight: 'Chưa đủ dữ liệu',
        };
    }

    const cppStdDev = calculateStdDev(cppValues);
    const cppCoeffVar = basics.avgCpp > 0 ? cppStdDev / basics.avgCpp : 0;

    let level: 'low' | 'medium' | 'high' = 'low';
    if (cppCoeffVar > 0.4) level = 'high';
    else if (cppCoeffVar > 0.2) level = 'medium';

    let insight = '';
    if (level === 'high') {
        insight = `Biến động CAO: CPP dao động mạnh (±${formatMoney(cppStdDev)}). Khó dự đoán. Cân nhắc chờ ổn định.`;
    } else if (level === 'medium') {
        insight = `Biến động TB: CPP có dao động (±${formatMoney(cppStdDev)}) nhưng vẫn trong tầm kiểm soát.`;
    } else {
        insight = `Ổn định: CPP ít dao động (±${formatMoney(cppStdDev)}). Dễ dự đoán và scale.`;
    }

    return {
        level,
        cppStdDev,
        cppCoeffVar,
        insight,
    };
}

function detectWarningSignals(params: {
    basics: ReturnType<typeof calculateBasics>;
    creativeFatigue: PreprocessedInsights['creativeFatigue'];
    trend: PreprocessedInsights['trend'];
    volatility: PreprocessedInsights['volatility'];
    sorted: DailyMetric[];
}) {
    const { basics, creativeFatigue, trend, volatility, sorted } = params;
    const signals: PreprocessedInsights['warningSignals'] = [];

    // 1. Low ROAS
    if (basics.avgRoas < 2) {
        signals.push({
            type: 'low_roas',
            severity: basics.avgRoas < 1.5 ? 'critical' : 'high',
            evidence: `ROAS ${basics.avgRoas.toFixed(2)}x < 2 (ngưỡng hòa vốn)`,
            recommendation: basics.avgRoas < 1.5
                ? 'Dừng campaign hoặc giảm budget 50% ngay'
                : 'Theo dõi sát, sẵn sàng dừng nếu tiếp tục giảm',
        });
    }

    // 2. High CPP trend
    if (trend.direction === 'declining' && trend.cppChange > 30) {
        signals.push({
            type: 'cpp_surge',
            severity: 'high',
            evidence: `CPP tăng ${trend.cppChange.toFixed(0)}% trong 3 ngày gần`,
            recommendation: 'Không scale. Tìm nguyên nhân: creative fatigue? audience? bid?',
        });
    }

    // 3. Creative fatigue
    if (creativeFatigue.status === 'critical') {
        signals.push({
            type: 'creative_exhausted',
            severity: 'critical',
            evidence: creativeFatigue.diagnosis,
            recommendation: creativeFatigue.recommendation,
        });
    } else if (creativeFatigue.status === 'fatigued') {
        signals.push({
            type: 'creative_fatigue',
            severity: 'high',
            evidence: creativeFatigue.diagnosis,
            recommendation: creativeFatigue.recommendation,
        });
    }

    // 4. No purchases in last 2 days
    const last2Days = sorted.slice(-2);
    const recentPurchases = last2Days.reduce((s, d) => s + d.purchases, 0);
    const recentSpend = last2Days.reduce((s, d) => s + d.spend, 0);
    if (recentSpend > 0 && recentPurchases === 0) {
        signals.push({
            type: 'no_conversions',
            severity: 'critical',
            evidence: `0 đơn trong 2 ngày gần dù đã chi ${formatMoney(recentSpend)}`,
            recommendation: 'DỪNG NGAY. Kiểm tra pixel, landing page, hoặc audience.',
        });
    }

    // 5. High volatility
    if (volatility.level === 'high') {
        signals.push({
            type: 'high_volatility',
            severity: 'medium',
            evidence: volatility.insight,
            recommendation: 'Chờ ổn định trước khi quyết định scale/reduce.',
        });
    }

    return signals;
}

function generatePrediction(params: {
    trend: PreprocessedInsights['trend'];
    creativeFatigue: PreprocessedInsights['creativeFatigue'];
    warningSignals: PreprocessedInsights['warningSignals'];
    sorted: DailyMetric[];
}) {
    const { trend, creativeFatigue, warningSignals } = params;
    const hasCritical = warningSignals.some(w => w.severity === 'critical');
    const hasHigh = warningSignals.some(w => w.severity === 'high');

    let noAction = '';
    let withAction = '';

    if (hasCritical) {
        noAction = 'Tiếp tục đốt tiền. CPP có thể tăng thêm 20-50% trong 3 ngày tới.';
        withAction = 'Dừng/giảm budget sẽ cắt lỗ ngay. Tái cấu trúc creative/audience.';
    } else if (trend.direction === 'declining') {
        noAction = `CPP sẽ tiếp tục tăng khoảng ${Math.min(trend.cppChange * 0.5, 30).toFixed(0)}% nếu không can thiệp.`;
        withAction = 'Refresh creative hoặc giảm budget 20-30% sẽ ổn định CPP.';
    } else if (creativeFatigue.status === 'fatigued') {
        noAction = 'CTR sẽ tiếp tục giảm, CPP tăng dần trong 5-7 ngày tới.';
        withAction = 'Thay creative mới sẽ reset CTR và giữ CPP ổn định.';
    } else if (trend.direction === 'improving') {
        noAction = 'Campaign đang tốt. Có thể giữ hoặc scale nhẹ 10-20%.';
        withAction = 'Scale 30% nếu ROAS > 3x và creative còn khỏe.';
    } else {
        noAction = 'Hiệu suất ổn định. Có thể duy trì thêm 5-7 ngày nữa.';
        withAction = 'Chuẩn bị creative backup để sẵn sàng khi cần refresh.';
    }

    return { noAction, withAction };
}

function getEmptyInsights(): PreprocessedInsights {
    return {
        basics: { totalDays: 0, totalSpend: 0, totalPurchases: 0, avgCpp: 0, avgRoas: 0, avgCtr: 0 },
        peakDay: null,
        troughDay: null,
        dayOfWeekPattern: { bestDays: [], worstDays: [], avgByDay: {}, hasClearPattern: false, insight: 'Chưa có dữ liệu' },
        creativeFatigue: { status: 'healthy', ctrTrend: 'stable', ctrDeclinePercent: 0, frequencyLevel: 'low', frequencyValue: 0, diagnosis: 'Chưa có dữ liệu', recommendation: '' },
        trend: { direction: 'stable', cppChange: 0, roasChange: 0, movingAvg3Day: { cpp: 0, roas: 0 }, movingAvg7Day: { cpp: 0, roas: 0 }, insight: 'Chưa có dữ liệu' },
        phases: [],
        volatility: { level: 'low', cppStdDev: 0, cppCoeffVar: 0, insight: 'Chưa có dữ liệu' },
        warningSignals: [],
        prediction: { noAction: '', withAction: '' },
    };
}
