/**
 * Pattern Detection Engine - QUÂN SƯ ADS v2
 * Phát hiện các pattern vấn đề của campaigns
 */

import { generateMetricTags, MetricTag, CampaignLifeStage, splitHistoryAndWindow } from './metric-bands';

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
    MIN_ROAS: 1,                  // ROAS < 1 = chi ads > doanh thu
    HIGH_FREQUENCY: 3,            // Frequency > 3 = audience burn
    CPM_SPIKE_PERCENT: 30,        // CPM tăng 30% = spike
    GOOD_CTR: 1.5,                // CTR > 1.5% là tốt
    LEARNING_DAYS: 7,             // 7 ngày đầu = learning
    LEARNING_CONVERSIONS: 50,     // Cần 50 conversions để exit learning
    SPEND_SPIKE_PERCENT: 200,     // Spend gấp 2 = spike

    // NEW: Profit-based thresholds (v2)
    ROAS_LOSS: 2,                 // ROAS < 2 = không đủ bù vốn + chi phí (cost SP ~50%)
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
 * Phát hiện issues dựa trên Metric Bands (Z-Score) + absolute checks
 * 
 * Thay thế hoàn toàn thuật toán cũ (3-day hardcoded).
 * Giờ chỉ giữ 2 absolute checks + auto-convert từ metricTags (Bands).
 */
export function detectIssues(campaign: CampaignData): Issue[] {
    const issues: Issue[] = [];
    const metrics = campaign.dailyMetrics;
    const totals = campaign.totals;

    if (metrics.length === 0) return issues;

    // ============================================
    // 1. ABSOLUTE CHECKS (không phụ thuộc Bands)
    // ============================================

    // 1a. Đốt tiền không ra đơn
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

    // 1b. Có đơn nhưng chi ads > doanh thu (ROAS < 1)
    if (totals.purchases > 0 && totals.roas < THRESHOLDS.MIN_ROAS) {
        const adLoss = totals.spend - totals.revenue;
        issues.push({
            type: 'losing_money',
            severity: 'critical',
            message: 'Có đơn nhưng chi ads vượt doanh thu',
            detail: `ROAS ${totals.roas.toFixed(2)}x, chi ads vượt thu ${formatMoney(adLoss)} (chưa tính vốn hàng, nhân sự)`,
            action: 'Giảm budget 50% hoặc tắt',
        });
    }

    // ============================================
    // 2. BANDS-DERIVED ISSUES (từ Z-Score 7-day window)
    // ============================================
    const bandsResult = generateMetricTags(metrics, campaign.created_time);

    for (const tag of bandsResult.tags) {
        // Chỉ tạo issue cho các tag "xấu" (direction phù hợp)
        const isBadDirection = (
            (tag.metric === 'CPP' && tag.direction === 'up') ||    // CPP tăng = xấu
            (tag.metric === 'CTR' && tag.direction === 'down') ||  // CTR giảm = xấu
            (tag.metric === 'ROAS' && tag.direction === 'down')    // ROAS giảm = xấu
        );

        if (!isBadDirection) continue; // Skip good signals

        // Map metric → IssueType
        const typeMap: Record<string, IssueType> = {
            'CPP': 'cpp_rising',
            'CTR': 'content_worn',
            'ROAS': 'losing_money',
        };

        // Map metric → action
        const actionMap: Record<string, string> = {
            'CPP': 'Xem xét thay content hoặc điều chỉnh targeting',
            'CTR': 'Content đang mất hiệu quả, cần refresh creative',
            'ROAS': 'Kiểm tra chi phí và tối ưu conversion',
        };

        issues.push({
            type: typeMap[tag.metric] || 'no_issues',
            severity: tag.severity,
            message: tag.label,
            detail: tag.detail,
            action: actionMap[tag.metric] || 'Theo dõi thêm',
        });
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    debugData?: Record<string, any>; // Full pipeline debug data
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

    // Build debug data (full pipeline)
    const { history, window: windowSlice } = splitHistoryAndWindow(dailyMetrics);
    const debugData = {
        _generated: new Date().toISOString(),
        input: {
            campaignName: campaign.name,
            campaignId: campaign.id,
            created_time: campaign.created_time || 'N/A',
            totalDays: dailyMetrics.length,
            dailyMetrics: dailyMetrics,
            totals: totals,
        },
        processing: {
            lifeStage: bandsResult.lifeStage,
            historySplit: {
                historyDays: history.length,
                historyRange: history.length > 0
                    ? `${history[0]?.date} → ${history[history.length - 1]?.date}`
                    : 'N/A',
                windowDays: windowSlice.length,
                windowRange: windowSlice.length > 0
                    ? `${windowSlice[0]?.date} → ${windowSlice[windowSlice.length - 1]?.date}`
                    : 'N/A',
            },
            bands: bandsResult.bands,
            healthScore: health,
            trend: trend,
        },
        output: {
            tags: bandsResult.tags,
            issues: issues,
        },
    };

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
                : `ROAS ${totals.roas.toFixed(2)}x < 2 = Không đủ bù vốn + chi phí`,
            emoji: '🔴',
            color: '#F6465D',
            trendInfo: trend.summary,
            healthScore: health.total,
            metricTags: bandsResult.tags,
            lifeStage: bandsResult.lifeStage,
            debugData: { ...debugData, output: { ...debugData.output, action: 'STOP' } },
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
            debugData: { ...debugData, output: { ...debugData.output, action: 'SCALE' } },
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
            debugData: { ...debugData, output: { ...debugData.output, action: 'GOOD' } },
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
            debugData: { ...debugData, output: { ...debugData.output, action: 'ADJUST' } },
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
        debugData: { ...debugData, output: { ...debugData.output, action: 'WATCH' } },
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
