/**
 * Pattern Detection Engine - QUÂN SƯ ADS v2
 * Phát hiện các pattern vấn đề của campaigns
 */

// Types
export interface DailyMetric {
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    purchases: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpp: number;
    roas: number;
    frequency?: number;
    cpm: number;
}

export interface CampaignData {
    id: string;
    name: string;
    status: string;
    dailyMetrics: DailyMetric[];
    totals: {
        spend: number;
        purchases: number;
        revenue: number;
        cpp: number;
        roas: number;
        ctr: number;
    };
}

export interface Issue {
    type: IssueType;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    detail: string;
    action: string;
}

export type IssueType =
    | 'burning_money'      // Đốt tiền không ra gì
    | 'cpp_rising'         // CPP tăng liên tục
    | 'content_worn'       // Content từng tốt giờ tệ
    | 'losing_money'       // Có đơn nhưng lỗ
    | 'high_frequency'     // Frequency cao
    | 'cpm_spike'          // CPM tăng đột ngột
    | 'clicks_no_sales'    // CTR tốt nhưng không có đơn
    | 'learning'           // Campaign đang learning
    | 'spend_spike'        // Spend bất thường
    | 'no_issues';         // Không có vấn đề

// Constants
const THRESHOLDS = {
    BURN_MONEY_SPEND: 500000,     // 500K không có đơn = đốt tiền
    CPP_INCREASE_DAYS: 3,         // 3 ngày CPP tăng liên tục
    CPP_INCREASE_PERCENT: 20,     // CPP tăng 20% = cảnh báo
    MIN_ROAS: 1,                  // ROAS < 1 = lỗ
    HIGH_FREQUENCY: 3,            // Frequency > 3 = audience burn
    CPM_SPIKE_PERCENT: 30,        // CPM tăng 30% = spike
    GOOD_CTR: 1.5,                // CTR > 1.5% là tốt
    LEARNING_DAYS: 7,             // 7 ngày đầu = learning
    LEARNING_CONVERSIONS: 50,     // Cần 50 conversions để exit learning
    SPEND_SPIKE_PERCENT: 200,     // Spend gấp 2 = spike

    // NEW: Profit-based thresholds (v2)
    ROAS_LOSS: 2,                 // ROAS < 2 = chắc chắn lỗ (cost SP ~50%)
    ROAS_EXCELLENT: 4,            // ROAS >= 4 = xuất sắc, có thể scale
    ROAS_GOOD: 2.5,               // ROAS >= 2.5 = tốt
    VARIANCE_THRESHOLD: 20,       // ±20% = ngưỡng biến động bất thường
    MIN_SPEND_FOR_ANALYSIS: 500000, // 500k để có data đủ tin cậy
};

/**
 * Time Context - Xét ngày trong tháng/tuần để điều chỉnh đánh giá
 */
export interface TimeContext {
    isEndOfMonth: boolean;  // Ngày 25-30/31
    isWeekend: boolean;     // Thứ 7/CN
    dayOfMonth: number;
    dayOfWeek: number;      // 0 = CN, 6 = Thứ 7
    contextNote: string;
}

export function getTimeContext(date?: Date): TimeContext {
    const now = date || new Date();
    const dayOfMonth = now.getDate();
    const dayOfWeek = now.getDay();
    const isEndOfMonth = dayOfMonth >= 25;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    let contextNote = '';
    if (isEndOfMonth) {
        contextNote = '📅 Cuối tháng (người tiêu dùng hạn chế chi tiêu)';
    }
    if (isWeekend) {
        contextNote = contextNote
            ? contextNote + ' | 🎉 Weekend (F&B thường tăng đơn)'
            : '🎉 Weekend (F&B thường tăng đơn)';
    }

    return {
        isEndOfMonth,
        isWeekend,
        dayOfMonth,
        dayOfWeek,
        contextNote,
    };
}

/**
 * Weekly Benchmark - So sánh với tuần trước
 */
export interface WeeklyBenchmark {
    cppChange: number;      // % thay đổi CPP
    roasChange: number;     // % thay đổi ROAS
    ctrChange: number;      // % thay đổi CTR
    hasBenchmark: boolean;  // Có đủ data để so sánh không
}

export function calculateWeeklyBenchmark(dailyMetrics: DailyMetric[]): WeeklyBenchmark {
    // Cần ít nhất 6 ngày data để so sánh 3 ngày gần nhất vs 3 ngày trước đó
    if (dailyMetrics.length < 6) {
        return { cppChange: 0, roasChange: 0, ctrChange: 0, hasBenchmark: false };
    }

    const recent3 = dailyMetrics.slice(-3);
    const previous3 = dailyMetrics.slice(-6, -3);

    // Average of recent 3 days
    const recentCpp = recent3.reduce((sum, m) => sum + m.cpp, 0) / 3;
    const recentRoas = recent3.reduce((sum, m) => sum + m.roas, 0) / 3;
    const recentCtr = recent3.reduce((sum, m) => sum + m.ctr, 0) / 3;

    // Average of previous 3 days
    const prevCpp = previous3.reduce((sum, m) => sum + m.cpp, 0) / 3;
    const prevRoas = previous3.reduce((sum, m) => sum + m.roas, 0) / 3;
    const prevCtr = previous3.reduce((sum, m) => sum + m.ctr, 0) / 3;

    // Calculate % change
    const cppChange = prevCpp > 0 ? ((recentCpp - prevCpp) / prevCpp) * 100 : 0;
    const roasChange = prevRoas > 0 ? ((recentRoas - prevRoas) / prevRoas) * 100 : 0;
    const ctrChange = prevCtr > 0 ? ((recentCtr - prevCtr) / prevCtr) * 100 : 0;

    return {
        cppChange,
        roasChange,
        ctrChange,
        hasBenchmark: true,
    };
}

/**
 * Format benchmark thay đổi
 */
function formatBenchmarkChange(change: number, metric: string): string {
    if (change === 0) return '';
    const sign = change > 0 ? '+' : '';
    const emoji = (metric === 'CPP' && change > 0) || (metric === 'ROAS' && change < 0)
        ? '📉' // Bad direction
        : '📈'; // Good direction  
    return ` ${emoji} ${sign}${change.toFixed(0)}% vs tuần trước`;
}

/**
 * Trend Analysis v2 - So sánh với TB của chính campaign
 */
export interface TrendAnalysis {
    cppVsTotal: number;       // % CPP 3 ngày gần so với TB toàn bộ
    cppVsRecent7: number;     // % CPP 3 ngày gần so với 7 ngày gần
    roasVsTotal: number;      // % ROAS so với TB toàn bộ
    roasVsRecent7: number;    // % ROAS so với 7 ngày gần
    trendDirection: 'improving' | 'stable' | 'worsening';
    hasEnoughData: boolean;
    summary: string;          // Mô tả ngắn gọn
}

/**
 * Tính trend so với TB của chính campaign đó
 * Logic: So sánh 3 ngày gần nhất với:
 * - TB toàn bộ khoảng request
 * - TB 7 ngày gần nhất
 */
export function calculateTrendVsAverage(dailyMetrics: DailyMetric[]): TrendAnalysis {
    const noData: TrendAnalysis = {
        cppVsTotal: 0,
        cppVsRecent7: 0,
        roasVsTotal: 0,
        roasVsRecent7: 0,
        trendDirection: 'stable',
        hasEnoughData: false,
        summary: 'Chưa đủ dữ liệu để phân tích trend',
    };

    if (dailyMetrics.length < 3) return noData;

    // TB 3 ngày gần nhất
    const recent3 = dailyMetrics.slice(-3);
    const recent3Cpp = recent3.reduce((sum, m) => sum + (m.cpp || 0), 0) / 3;
    const recent3Roas = recent3.reduce((sum, m) => sum + (m.roas || 0), 0) / 3;

    // TB toàn bộ khoảng request
    const totalCpp = dailyMetrics.reduce((sum, m) => sum + (m.cpp || 0), 0) / dailyMetrics.length;
    const totalRoas = dailyMetrics.reduce((sum, m) => sum + (m.roas || 0), 0) / dailyMetrics.length;

    // TB 7 ngày gần (hoặc tất cả nếu < 7 ngày)
    const recent7 = dailyMetrics.slice(-Math.min(7, dailyMetrics.length));
    const recent7Cpp = recent7.reduce((sum, m) => sum + (m.cpp || 0), 0) / recent7.length;
    const recent7Roas = recent7.reduce((sum, m) => sum + (m.roas || 0), 0) / recent7.length;

    // Tính % thay đổi
    const cppVsTotal = totalCpp > 0 ? ((recent3Cpp - totalCpp) / totalCpp) * 100 : 0;
    const cppVsRecent7 = recent7Cpp > 0 ? ((recent3Cpp - recent7Cpp) / recent7Cpp) * 100 : 0;
    const roasVsTotal = totalRoas > 0 ? ((recent3Roas - totalRoas) / totalRoas) * 100 : 0;
    const roasVsRecent7 = recent7Roas > 0 ? ((recent3Roas - recent7Roas) / recent7Roas) * 100 : 0;

    // Xác định trend direction dựa trên CPP (quan trọng nhất)
    let trendDirection: 'improving' | 'stable' | 'worsening' = 'stable';
    let summary = 'CPP ổn định';

    if (cppVsTotal > THRESHOLDS.VARIANCE_THRESHOLD || cppVsRecent7 > THRESHOLDS.VARIANCE_THRESHOLD) {
        trendDirection = 'worsening';
        summary = `CPP đang tăng ${Math.max(cppVsTotal, cppVsRecent7).toFixed(0)}% so với TB`;
    } else if (cppVsTotal < -THRESHOLDS.VARIANCE_THRESHOLD || cppVsRecent7 < -THRESHOLDS.VARIANCE_THRESHOLD) {
        trendDirection = 'improving';
        summary = `CPP đang giảm ${Math.abs(Math.min(cppVsTotal, cppVsRecent7)).toFixed(0)}% - Tốt!`;
    }

    return {
        cppVsTotal,
        cppVsRecent7,
        roasVsTotal,
        roasVsRecent7,
        trendDirection,
        hasEnoughData: true,
        summary,
    };
}

/**
 * Phát hiện tất cả issues của một campaign
 */
export function detectIssues(campaign: CampaignData): Issue[] {
    const issues: Issue[] = [];
    const metrics = campaign.dailyMetrics;
    const totals = campaign.totals;
    const timeContext = getTimeContext();
    const benchmark = calculateWeeklyBenchmark(metrics);

    if (metrics.length === 0) return issues;

    // 1. Đốt tiền không ra gì
    const todayMetric = metrics[metrics.length - 1];
    if (todayMetric && todayMetric.spend >= THRESHOLDS.BURN_MONEY_SPEND && todayMetric.purchases === 0) {
        issues.push({
            type: 'burning_money',
            severity: 'critical',
            message: 'Đốt tiền không ra đơn',
            detail: `Spend ${formatMoney(todayMetric.spend)} hôm nay, 0 đơn`,
            action: 'Tắt campaign ngay',
        });
    }

    // 2. CPP tăng liên tục (điều chỉnh theo time context + benchmark)
    if (metrics.length >= THRESHOLDS.CPP_INCREASE_DAYS) {
        const recentMetrics = metrics.slice(-THRESHOLDS.CPP_INCREASE_DAYS);
        const allIncreasing = recentMetrics.every((m, i) => {
            if (i === 0) return true;
            return m.cpp > 0 && recentMetrics[i - 1].cpp > 0 && m.cpp > recentMetrics[i - 1].cpp;
        });

        if (allIncreasing && recentMetrics[0].cpp > 0) {
            const firstCpp = recentMetrics[0].cpp;
            const lastCpp = recentMetrics[recentMetrics.length - 1].cpp;
            const increase = ((lastCpp - firstCpp) / firstCpp) * 100;

            if (increase >= THRESHOLDS.CPP_INCREASE_PERCENT) {
                // Giảm severity nếu cuối tháng
                const severity = timeContext.isEndOfMonth ? 'info' : 'warning';
                const contextNote = timeContext.isEndOfMonth
                    ? ' [📅 Cuối tháng]'
                    : '';
                const benchmarkNote = benchmark.hasBenchmark
                    ? formatBenchmarkChange(benchmark.cppChange, 'CPP')
                    : '';

                issues.push({
                    type: 'cpp_rising',
                    severity,
                    message: 'CPP tăng liên tục' + (timeContext.isEndOfMonth ? ' (cuối tháng)' : ''),
                    detail: `${THRESHOLDS.CPP_INCREASE_DAYS} ngày: ${formatMoney(firstCpp)} → ${formatMoney(lastCpp)} (+${increase.toFixed(0)}%)${benchmarkNote}${contextNote}`,
                    action: timeContext.isEndOfMonth
                        ? 'Theo dõi thêm, có thể ổn định đầu tháng sau'
                        : 'Thay content mới',
                });
            }
        }
    }

    // 3. Có đơn nhưng lỗ (ROAS < 1) + benchmark
    if (totals.purchases > 0 && totals.roas < THRESHOLDS.MIN_ROAS) {
        const loss = totals.spend - totals.revenue;
        const benchmarkNote = benchmark.hasBenchmark
            ? formatBenchmarkChange(benchmark.roasChange, 'ROAS')
            : '';
        issues.push({
            type: 'losing_money',
            severity: 'critical',
            message: 'Có đơn nhưng đang lỗ',
            detail: `ROAS ${totals.roas.toFixed(2)}x, lỗ ${formatMoney(loss)}${benchmarkNote}`,
            action: 'Giảm budget 50% hoặc tắt',
        });
    }

    // 4. Frequency - 3 mức cảnh báo (early warning system)
    if (todayMetric && todayMetric.frequency) {
        const freq = todayMetric.frequency;

        if (freq > 3) {
            // Critical - Audience đã mòn
            issues.push({
                type: 'high_frequency',
                severity: 'critical',
                message: 'Audience đã mòn hoàn toàn',
                detail: `Frequency: ${freq.toFixed(1)} - Mỗi người xem > 3 lần`,
                action: 'TẮT NGAY hoặc đổi audience mới 100%',
            });
        } else if (freq >= 2.5) {
            // Warning - Cần refresh sớm
            issues.push({
                type: 'high_frequency',
                severity: 'warning',
                message: 'Cần refresh creative SỚM',
                detail: `Frequency: ${freq.toFixed(1)} - Sắp bão hòa`,
                action: 'Thay content mới trong 1-2 ngày',
            });
        } else if (freq >= 2) {
            // Info - Theo dõi
            issues.push({
                type: 'high_frequency',
                severity: 'info',
                message: 'Frequency đang tăng',
                detail: `Frequency: ${freq.toFixed(1)} - Theo dõi xu hướng`,
                action: 'Chuẩn bị content mới để thay thế',
            });
        }
    }

    // 5. CTR tốt nhưng không có đơn
    if (totals.ctr >= THRESHOLDS.GOOD_CTR && totals.purchases === 0 && totals.spend > 200000) {
        issues.push({
            type: 'clicks_no_sales',
            severity: 'warning',
            message: 'Clicks nhiều nhưng không ra đơn',
            detail: `CTR ${totals.ctr.toFixed(2)}%, 0 purchases`,
            action: 'Kiểm tra landing page và offer',
        });
    }

    // 6. CPM spike
    if (metrics.length >= 7) {
        const avgCpm = metrics.slice(0, -1).reduce((sum, m) => sum + m.cpm, 0) / (metrics.length - 1);
        const todayCpm = todayMetric?.cpm || 0;
        const cpmIncrease = ((todayCpm - avgCpm) / avgCpm) * 100;

        if (cpmIncrease >= THRESHOLDS.CPM_SPIKE_PERCENT) {
            issues.push({
                type: 'cpm_spike',
                severity: 'info',
                message: 'CPM tăng đột ngột',
                detail: `Hôm nay: ${formatMoney(todayCpm)}, TB: ${formatMoney(avgCpm)} (+${cpmIncrease.toFixed(0)}%)`,
                action: 'Có thể do cạnh tranh cao, theo dõi thêm',
            });
        }
    }

    // 7. Spend spike bất thường
    if (metrics.length >= 7) {
        const avgSpend = metrics.slice(0, -1).reduce((sum, m) => sum + m.spend, 0) / (metrics.length - 1);
        const todaySpend = todayMetric?.spend || 0;

        if (avgSpend > 0 && todaySpend > avgSpend * (THRESHOLDS.SPEND_SPIKE_PERCENT / 100)) {
            issues.push({
                type: 'spend_spike',
                severity: 'info',
                message: 'Spend cao bất thường',
                detail: `Hôm nay: ${formatMoney(todaySpend)}, TB: ${formatMoney(avgSpend)}`,
                action: 'Kiểm tra xem có đang hiệu quả không',
            });
        }
    }

    return issues;
}

/**
 * Phân loại campaign: critical / warning / good
 */
export function classifyCampaign(issues: Issue[]): 'critical' | 'warning' | 'good' {
    if (issues.some(i => i.severity === 'critical')) return 'critical';
    if (issues.some(i => i.severity === 'warning')) return 'warning';
    return 'good';
}

/**
 * Action Recommendation Types - v2
 * STOP: Chắc chắn lỗ (ROAS < 2)
 * WATCH: Còn lời nhưng trend xấu
 * GOOD: Ổn định, sinh lời
 * SCALE: Xuất sắc, có thể tăng budget
 */
export type ActionType = 'STOP' | 'WATCH' | 'GOOD' | 'SCALE';

export interface ActionRecommendation {
    action: ActionType;
    reason: string;
    emoji: string;
    color: string;
    trendInfo?: string; // Thông tin trend chi tiết
}

/**
 * Xác định action recommendation cho campaign - v2 (Profit-based)
 * 
 * NGUYÊN TẮC MỚI:
 * - STOP CHỈ KHI chắc chắn lỗ: ROAS < 2 hoặc đốt tiền không ra đơn
 * - ROAS >= 2 = KHÔNG BAO GIỜ STOP, phân loại dựa trên TREND của chính campaign đó
 */
export function getRecommendedAction(
    campaign: CampaignData,
    issues: Issue[]
): ActionRecommendation {
    const { totals, dailyMetrics } = campaign;

    // Tính trend so với TB của chính campaign
    const trend = calculateTrendVsAverage(dailyMetrics);

    // ============================================
    // 🔴 STOP: CHỈ KHI CHẮC CHẮN LỖ
    // ============================================

    // Điều kiện 1: ROAS < 2 VÀ đã chi đủ tiền để đánh giá
    const isLosing = totals.roas < THRESHOLDS.ROAS_LOSS &&
        totals.spend >= THRESHOLDS.MIN_SPEND_FOR_ANALYSIS;

    // Điều kiện 2: Đốt tiền không ra đơn (chi > 1tr mà 0 đơn)
    const isBurningMoney = totals.spend > 1000000 && totals.purchases === 0;

    if (isLosing || isBurningMoney) {
        let reason = '';
        if (isBurningMoney) {
            reason = `Chi ${formatMoney(totals.spend)} không ra đơn - Dừng ngay!`;
        } else {
            reason = `ROAS ${totals.roas.toFixed(2)}x < 2 = Lỗ (Cost SP ~50% + ADS)`;
        }

        return {
            action: 'STOP',
            reason,
            emoji: '🔴',
            color: '#F6465D',
            trendInfo: trend.summary,
        };
    }

    // ============================================
    // ROAS >= 2: KHÔNG BAO GIỜ STOP
    // Phân loại dựa trên TREND của chính campaign
    // ============================================

    // 🔥 SCALE: ROAS xuất sắc + trend tốt/ổn định
    if (totals.roas >= THRESHOLDS.ROAS_EXCELLENT &&
        trend.trendDirection !== 'worsening' &&
        totals.spend >= THRESHOLDS.MIN_SPEND_FOR_ANALYSIS) {
        return {
            action: 'SCALE',
            reason: `ROAS ${totals.roas.toFixed(2)}x xuất sắc, ${trend.summary} - Tăng budget 20-30%`,
            emoji: '🔥',
            color: '#1E90FF', // Dodger Blue
            trendInfo: trend.summary,
        };
    }

    // 🟡 WATCH: Còn lời nhưng trend đang xấu đi
    if (trend.trendDirection === 'worsening') {
        const cppChange = Math.max(trend.cppVsTotal, trend.cppVsRecent7);
        return {
            action: 'WATCH',
            reason: `${trend.summary}. Theo dõi thêm 2-3 ngày.`,
            emoji: '🟡',
            color: '#F0B90B',
            trendInfo: `CPP tăng ${cppChange.toFixed(0)}% so với TB`,
        };
    }

    // 🟢 GOOD: ROAS tốt + trend ổn định/improving
    if (totals.roas >= THRESHOLDS.ROAS_GOOD || trend.trendDirection === 'improving') {
        return {
            action: 'GOOD',
            reason: `ROAS ${totals.roas.toFixed(2)}x, ${trend.summary}`,
            emoji: '🟢',
            color: '#0ECB81',
            trendInfo: trend.summary,
        };
    }

    // 🟡 WATCH: Default cho các trường hợp khác (chưa đủ data, ROAS trung bình)
    let watchReason = 'Đang theo dõi';
    if (!trend.hasEnoughData) {
        watchReason = 'Chưa đủ dữ liệu để phân tích trend';
    } else if (totals.purchases < 5) {
        watchReason = `Chỉ ${totals.purchases} đơn - Cần thêm data`;
    } else if (totals.roas < THRESHOLDS.ROAS_GOOD) {
        watchReason = `ROAS ${totals.roas.toFixed(2)}x - Cần cải thiện`;
    }

    return {
        action: 'WATCH',
        reason: watchReason,
        emoji: '🟡',
        color: '#F0B90B',
        trendInfo: trend.summary,
    };
}

/**
 * Format tiền VND - làm tròn và dùng dấu chấm phân cách: 3.400.000đ
 */
function formatMoney(amount: number): string {
    const rounded = Math.round(amount);
    return rounded.toLocaleString('de-DE') + 'đ';
}

/**
 * Phân tích tất cả campaigns và trả về Daily Action Board data
 */
export function analyzeCampaigns(campaigns: CampaignData[]): {
    critical: Array<CampaignData & { issues: Issue[]; actionRecommendation: ActionRecommendation }>;
    warning: Array<CampaignData & { issues: Issue[]; actionRecommendation: ActionRecommendation }>;
    good: Array<CampaignData & { issues: Issue[]; actionRecommendation: ActionRecommendation }>;
    summary: {
        total: number;
        critical: number;
        warning: number;
        good: number;
        totalSpend: number;
        totalRevenue: number;
    };
} {
    const results = campaigns.map(campaign => {
        const issues = detectIssues(campaign);
        const actionRecommendation = getRecommendedAction(campaign, issues);
        return { ...campaign, issues, actionRecommendation };
    });

    // Use actionRecommendation for classification (matches the badge)
    // STOP → critical, WATCH → warning, GOOD + SCALE → good
    const critical = results.filter(c => c.actionRecommendation.action === 'STOP');
    const warning = results.filter(c => c.actionRecommendation.action === 'WATCH');
    const good = results.filter(c =>
        c.actionRecommendation.action === 'GOOD' ||
        c.actionRecommendation.action === 'SCALE'
    );

    return {
        critical,
        warning,
        good,
        summary: {
            total: campaigns.length,
            critical: critical.length,
            warning: warning.length,
            good: good.length,
            totalSpend: campaigns.reduce((sum, c) => sum + c.totals.spend, 0),
            totalRevenue: campaigns.reduce((sum, c) => sum + c.totals.revenue, 0),
        },
    };
}
