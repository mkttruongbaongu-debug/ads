/**
 * Pattern Detection Engine - QUÂN SƯ ADS v2
 * Phát hiện các pattern vấn đề của campaigns
 */

import { generateMetricTags, MetricTag, CampaignLifeStage } from './metric-bands';

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
    // NEW: Campaign metadata
    created_time?: string;          // ISO datetime khi campaign được tạo
    daily_budget?: number;          // Ngân sách hàng ngày thật (từ Facebook)
    daily_budget_estimated?: number; // Ước lượng = totalSpend / numberOfDays
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
 * Action Recommendation Types - v3 (Health Score Based)
 * STOP: Chắc chắn lỗ
 * ADJUST: Metrics tổng đẹp nhưng gần đây đang suy giảm - Cần can thiệp
 * WATCH: Đang theo dõi, chưa rõ xu hướng
 * GOOD: Ổn định, sinh lời
 * SCALE: Xuất sắc CẢ tổng thể LẪN gần đây
 */
export type ActionType = 'STOP' | 'ADJUST' | 'WATCH' | 'GOOD' | 'SCALE';

export interface ActionRecommendation {
    action: ActionType;
    reason: string;
    emoji: string;
    color: string;
    trendInfo?: string;
    healthScore?: number;      // 0-100 campaign health
    windowAlert?: string;      // Cảnh báo khi gần đây khác quá khứ
    metricTags?: MetricTag[];  // Bollinger Bands tags (CTR↓, CPP↑, ROAS↓)
    lifeStage?: CampaignLifeStage; // Campaign age stage
}

/**
 * ===================================================================
 * HEALTH SCORE SYSTEM - v3
 * ===================================================================
 * 
 * NGUYÊN TẮC CỐT LÕI:
 * Chỉ số TỔNG đẹp không có nghĩa campaign đang khoẻ.
 * Phải so sánh WINDOW (3 ngày gần) vs TỔNG để phát hiện suy giảm ngầm.
 * 
 * Health Score = Tài chính gần đây (30%) + Trend (30%) + Creative/CTR (25%) + Stability (15%)
 * 
 * VÍ DỤ:
 * Campaign ROAS tổng 10x nhưng 3 ngày gần ROAS 2x:
 *   Tài chính gần đây: 40/100 (ROAS gần đây thấp)
 *   Trend: 20/100 (ROAS sụt giảm mạnh)
 *   Creative: 50/100
 *   Stability: 30/100
 *   → Health Score = 40×0.3 + 20×0.3 + 50×0.25 + 30×0.15 = 35 → ADJUST!
 * ===================================================================
 */

interface HealthScoreBreakdown {
    financial: number;      // 0-100: Dựa trên ROAS 3 ngày gần (không phải tổng!)
    trend: number;          // 0-100: Xu hướng ROAS/CPP đang lên hay xuống
    creative: number;       // 0-100: CTR trend + frequency
    stability: number;      // 0-100: Biến động ít = ổn định
    total: number;          // 0-100: weighted average
    windowAlert: string;    // Cảnh báo cụ thể nếu có
}

function calculateHealthScore(dailyMetrics: DailyMetric[], totals: CampaignData['totals']): HealthScoreBreakdown {
    const noData: HealthScoreBreakdown = {
        financial: 50, trend: 50, creative: 50, stability: 50, total: 50,
        windowAlert: '',
    };

    if (dailyMetrics.length < 3) {
        return { ...noData, windowAlert: 'Chưa đủ dữ liệu (cần ≥ 3 ngày)' };
    }

    // ============================================
    // 1. FINANCIAL (30%): Dựa trên ROAS 3 NGÀY GẦN NHẤT
    // ============================================
    const recent3 = dailyMetrics.slice(-3);
    const recent3Spend = recent3.reduce((s, d) => s + d.spend, 0);
    const recent3Revenue = recent3.reduce((s, d) => s + d.revenue, 0);
    const recent3Roas = recent3Spend > 0 ? recent3Revenue / recent3Spend : 0;
    const recent3Purchases = recent3.reduce((s, d) => s + d.purchases, 0);
    const recent3Cpp = recent3Purchases > 0 ? recent3Spend / recent3Purchases : 0;

    let financial = 50;
    if (recent3Roas >= 5) financial = 100;
    else if (recent3Roas >= 4) financial = 90;
    else if (recent3Roas >= 3) financial = 80;
    else if (recent3Roas >= 2.5) financial = 70;
    else if (recent3Roas >= 2) financial = 55;
    else if (recent3Roas >= 1.5) financial = 35;
    else if (recent3Roas >= 1) financial = 20;
    else if (recent3Purchases === 0 && recent3Spend > 200000) financial = 5;
    else financial = 10;

    // ============================================
    // 2. TREND (30%): So sánh 3 ngày gần vs tổng
    // ============================================
    let trend = 50;
    let windowAlert = '';

    // ROAS window comparison
    const roasRatio = totals.roas > 0 ? recent3Roas / totals.roas : 1;
    if (roasRatio < 0.3) {
        // ROAS 3 ngày < 30% ROAS tổng → Sụt giảm NGHIÊM TRỌNG
        trend = 5;
        windowAlert = `ROAS 3 ngày gần (${recent3Roas.toFixed(1)}x) chỉ bằng ${(roasRatio * 100).toFixed(0)}% ROAS tổng (${totals.roas.toFixed(1)}x)`;
    } else if (roasRatio < 0.5) {
        trend = 15;
        windowAlert = `ROAS 3 ngày gần (${recent3Roas.toFixed(1)}x) sụt ${((1 - roasRatio) * 100).toFixed(0)}% so với tổng (${totals.roas.toFixed(1)}x)`;
    } else if (roasRatio < 0.7) {
        trend = 30;
        windowAlert = `ROAS đang giảm: 3 ngày gần ${recent3Roas.toFixed(1)}x vs tổng ${totals.roas.toFixed(1)}x`;
    } else if (roasRatio < 0.9) {
        trend = 50;
    } else if (roasRatio <= 1.1) {
        trend = 70; // Ổn định
    } else if (roasRatio <= 1.3) {
        trend = 85; // Đang cải thiện
    } else {
        trend = 95; // Bùng nổ
    }

    // CPP window comparison (bổ sung)
    if (totals.cpp > 0 && recent3Cpp > 0) {
        const cppRatio = recent3Cpp / totals.cpp;
        if (cppRatio > 2) {
            trend = Math.min(trend, 15); // CPP gấp đôi = rất xấu
            if (!windowAlert) windowAlert = `CPP 3 ngày gần (${formatMoney(recent3Cpp)}) gấp đôi TB (${formatMoney(totals.cpp)})`;
        } else if (cppRatio > 1.5) {
            trend = Math.min(trend, 30);
            if (!windowAlert) windowAlert = `CPP 3 ngày gần tăng ${((cppRatio - 1) * 100).toFixed(0)}%`;
        }
    }

    // ============================================
    // 3. CREATIVE/CTR (25%): CTR trend
    // ============================================
    let creative = 50;

    // So sánh CTR 3 ngày gần vs 7 ngày hoặc tổng
    const recent3Ctr = recent3.reduce((s, d) => s + d.ctr, 0) / 3;
    const totalCtr = dailyMetrics.reduce((s, d) => s + d.ctr, 0) / dailyMetrics.length;

    if (totalCtr > 0) {
        const ctrRatio = recent3Ctr / totalCtr;
        if (ctrRatio >= 1.1) creative = 90;        // CTR tăng
        else if (ctrRatio >= 0.95) creative = 75;   // CTR ổn định
        else if (ctrRatio >= 0.85) creative = 55;   // CTR giảm nhẹ
        else if (ctrRatio >= 0.75) creative = 35;   // CTR giảm rõ
        else creative = 15;                          // CTR sụt mạnh
    }

    // Frequency check (nếu có)
    const lastDay = dailyMetrics[dailyMetrics.length - 1];
    if (lastDay.frequency) {
        if (lastDay.frequency > 3) creative = Math.min(creative, 10);
        else if (lastDay.frequency > 2.5) creative = Math.min(creative, 30);
        else if (lastDay.frequency > 2) creative = Math.min(creative, 50);
    }

    // ============================================
    // 4. STABILITY (15%): Biến động CPP
    // ============================================
    let stability = 50;

    const cppValues = dailyMetrics.filter(d => d.cpp > 0).map(d => d.cpp);
    if (cppValues.length >= 3) {
        const avgCpp = cppValues.reduce((s, v) => s + v, 0) / cppValues.length;
        const variance = cppValues.reduce((s, v) => s + Math.pow(v - avgCpp, 2), 0) / cppValues.length;
        const cv = avgCpp > 0 ? Math.sqrt(variance) / avgCpp : 0; // Coefficient of variation

        if (cv < 0.15) stability = 90;       // Rất ổn định
        else if (cv < 0.3) stability = 70;    // Ổn định
        else if (cv < 0.5) stability = 50;    // Dao động vừa
        else if (cv < 0.7) stability = 30;    // Bất ổn
        else stability = 10;                   // Rất bất ổn
    }

    // ============================================
    // TÍNH TỔNG
    // ============================================
    const total = Math.round(
        financial * 0.30 +
        trend * 0.30 +
        creative * 0.25 +
        stability * 0.15
    );

    return { financial, trend, creative, stability, total, windowAlert };
}

export function getRecommendedAction(
    campaign: CampaignData,
    issues: Issue[]
): ActionRecommendation {
    const { totals, dailyMetrics } = campaign;

    // Tính Metric Bands (Bollinger Bands)
    const bandsResult = generateMetricTags(dailyMetrics, campaign.created_time);

    // Tính Health Score
    const health = calculateHealthScore(dailyMetrics, totals);
    const trend = calculateTrendVsAverage(dailyMetrics);

    // ============================================
    // 🔴 STOP: CHỈ KHI CHẮC CHẮN LỖ
    // ============================================
    const isLosing = totals.roas < THRESHOLDS.ROAS_LOSS &&
        totals.spend >= THRESHOLDS.MIN_SPEND_FOR_ANALYSIS;
    const isBurningMoney = totals.spend > 1000000 && totals.purchases === 0;

    if (isLosing || isBurningMoney) {
        return {
            action: 'STOP',
            reason: isBurningMoney
                ? `Chi ${formatMoney(totals.spend)} không ra đơn`
                : `ROAS ${totals.roas.toFixed(2)}x < 2 = Lỗ`,
            emoji: '🔴',
            color: '#F6465D',
            trendInfo: trend.summary,
            healthScore: health.total,
            metricTags: bandsResult.tags,
            lifeStage: bandsResult.lifeStage,
        };
    }

    // ============================================
    // HEALTH SCORE → ACTION MAPPING
    // ============================================

    // 🔥 SCALE (Health >= 75): Khoẻ CẢ tổng LẪN gần đây
    if (health.total >= 75 && totals.roas >= THRESHOLDS.ROAS_EXCELLENT &&
        totals.spend >= THRESHOLDS.MIN_SPEND_FOR_ANALYSIS) {
        return {
            action: 'SCALE',
            reason: `Health ${health.total}/100 | ROAS 3 ngày gần vẫn mạnh | ${trend.summary}`,
            emoji: '🔥',
            color: '#1E90FF',
            trendInfo: trend.summary,
            healthScore: health.total,
            metricTags: bandsResult.tags,
            lifeStage: bandsResult.lifeStage,
        };
    }

    // 🟢 GOOD (Health >= 60): Đang tốt
    if (health.total >= 60 && totals.roas >= THRESHOLDS.ROAS_GOOD) {
        return {
            action: 'GOOD',
            reason: `Health ${health.total}/100 | ROAS ${totals.roas.toFixed(2)}x | ${trend.summary}`,
            emoji: '🟢',
            color: '#0ECB81',
            trendInfo: trend.summary,
            healthScore: health.total,
            metricTags: bandsResult.tags,
            lifeStage: bandsResult.lifeStage,
        };
    }

    // 🟠 ADJUST (Health 35-59): Metrics tổng có vẻ OK nhưng gần đây đang suy giảm
    // Đây là case quan trọng nhất: ROAS tổng đẹp nhưng 3 ngày gần xấu
    if (health.total >= 35 || totals.roas >= THRESHOLDS.ROAS_GOOD) {
        return {
            action: 'ADJUST',
            reason: health.windowAlert
                ? `Health ${health.total}/100 | ${health.windowAlert}`
                : `Health ${health.total}/100 | Hiệu suất gần đây giảm, cần điều chỉnh`,
            emoji: '🟠',
            color: '#FF8C00', // Dark Orange
            trendInfo: trend.summary,
            healthScore: health.total,
            windowAlert: health.windowAlert,
            metricTags: bandsResult.tags,
            lifeStage: bandsResult.lifeStage,
        };
    }

    // 🟡 WATCH (Health < 35): Yếu nhưng chưa đến mức STOP
    let watchReason = `Health ${health.total}/100`;
    if (!trend.hasEnoughData) {
        watchReason += ' | Chưa đủ data để phân tích trend';
    } else if (totals.purchases < 5) {
        watchReason += ` | Chỉ ${totals.purchases} đơn - Cần thêm data`;
    } else if (health.windowAlert) {
        watchReason += ` | ${health.windowAlert}`;
    }

    return {
        action: 'WATCH',
        reason: watchReason,
        emoji: '🟡',
        color: '#F0B90B',
        trendInfo: trend.summary,
        healthScore: health.total,
        windowAlert: health.windowAlert,
        metricTags: bandsResult.tags,
        lifeStage: bandsResult.lifeStage,
    };
}

/**
 * Format tiền VND - làm tròn và dùng dấu chấm phân cách: 3.400.000 ₫
 */
function formatMoney(amount: number): string {
    const rounded = Math.round(amount);
    return rounded.toLocaleString('de-DE') + ' ₫';
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
    // STOP → critical, ADJUST + WATCH → warning, GOOD + SCALE → good
    const critical = results.filter(c => c.actionRecommendation.action === 'STOP');
    const warning = results.filter(c =>
        c.actionRecommendation.action === 'WATCH' ||
        c.actionRecommendation.action === 'ADJUST'
    );
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
