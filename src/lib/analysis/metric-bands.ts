/**
 * ===================================================================
 * METRIC BANDS ENGINE - Bollinger Bands cho Quảng Cáo
 * ===================================================================
 *
 * Thay vì ngưỡng cứng ±20%, mỗi campaign có "dải dao động riêng"
 * dựa trên lịch sử của chính nó, giống Bollinger Bands trong trading.
 *
 * Nguyên lý:
 * - Tách dữ liệu: lịch sử [created → today-8d] vs window [today-7d → yesterday]
 * - Tính MA + σ (độ lệch chuẩn) từ lịch sử
 * - Z-Score = (windowAvg - MA) / σ → đo mức độ lệch
 * - |z| > 1σ = bắt đầu lệch, |z| > 2σ = bất thường nghiêm trọng
 *
 * Đặc thù theo tuổi campaign:
 * - LEARNING (0-3d): Dùng benchmark ngành, không tính Z-Score
 * - EARLY (4-7d): Trend 3d vs 3d, chưa đủ lịch sử cho Z-Score
 * - MATURE (8-21d): Z-Score đầy đủ, khoan dung hơn (|z| > 1.5)
 * - VETERAN (22d+): Z-Score chặt nhất (|z| > 1.0)
 * ===================================================================
 */

import { DailyMetric } from './pattern-engine';

// ===================================================================
// TYPES
// ===================================================================

export type CampaignLifeStage = 'LEARNING' | 'EARLY' | 'MATURE' | 'VETERAN';

export interface MetricBand {
    ma: number;          // Moving Average lịch sử
    sigma: number;       // Độ lệch chuẩn lịch sử
    floor: number;       // Giá trị tốt nhất lịch sử (CPP: thấp nhất, CTR/ROAS: cao nhất)
    ceiling: number;     // Giá trị tệ nhất lịch sử (CPP: cao nhất, CTR/ROAS: thấp nhất)
    windowAvg: number;   // TB 7 ngày gần (window)
    zScore: number;      // (windowAvg - ma) / sigma
}

export interface MetricTag {
    metric: 'CTR' | 'CPP' | 'ROAS';
    direction: 'up' | 'down';
    severity: 'info' | 'warning' | 'critical';
    zScore: number;
    label: string;       // VD: "CTR ↓↓" hoặc "ROAS ⚠"
    detail: string;      // VD: "CTR 2.1% vs TB lịch sử 2.8% (-1.4σ)"
    color: string;       // Mã màu CEX
}

export interface MetricBandsResult {
    lifeStage: CampaignLifeStage;
    bands: {
        ctr: MetricBand | null;
        cpp: MetricBand | null;
        roas: MetricBand | null;
    };
    tags: MetricTag[];
}

// ===================================================================
// CEX COLORS
// ===================================================================
const TAG_COLORS = {
    info: '#3B82F6',      // Blue
    warning: '#F0B90B',   // Yellow (CEX primary)
    critical: '#F6465D',  // Red (CEX error)
    good: '#0ECB81',      // Green (CEX success)
};

// ===================================================================
// BENCHMARK NGÀNH F&B (dùng cho LEARNING + EARLY stage)
// ===================================================================
const FB_BENCHMARKS = {
    ctr: { good: 1.5, avg: 1.0, bad: 0.5 },
    cpp: { good: 50000, avg: 80000, bad: 150000 },
    roas: { good: 3.0, avg: 1.5, bad: 0.5 },
};

// ===================================================================
// CORE FUNCTIONS
// ===================================================================

/**
 * Xác định giai đoạn sống của campaign dựa trên số ngày tuổi
 */
export function getCampaignLifeStage(createdTime?: string, today?: Date): CampaignLifeStage {
    if (!createdTime) return 'VETERAN'; // Không có created_time → giả định camp cũ

    const now = today || new Date();
    const created = new Date(createdTime);
    const ageDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

    if (ageDays <= 3) return 'LEARNING';
    if (ageDays <= 7) return 'EARLY';
    if (ageDays <= 21) return 'MATURE';
    return 'VETERAN';
}

/**
 * Tách dữ liệu thành vùng lịch sử và vùng window
 *
 * Window = 7 ngày gần nhất KHÔNG BAO GỒM hôm nay
 * History = tất cả trước window
 *
 * Ví dụ (today = 2026-02-08):
 *   Window: 01/02 → 07/02 (7 ngày)
 *   History: ngày tạo camp → 31/01
 */
export function splitHistoryAndWindow(
    dailyMetrics: DailyMetric[],
    today?: Date
): { history: DailyMetric[]; window: DailyMetric[] } {
    if (dailyMetrics.length === 0) {
        return { history: [], window: [] };
    }

    const now = today || new Date();
    // Yesterday = today - 1 day
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    // Window start = today - 7 days
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 7);
    windowStart.setHours(0, 0, 0, 0);

    // History cutoff = today - 8 days (end of day)
    const historyCutoff = new Date(windowStart);
    historyCutoff.setDate(historyCutoff.getDate() - 1);
    historyCutoff.setHours(23, 59, 59, 999);

    const history: DailyMetric[] = [];
    const window: DailyMetric[] = [];

    for (const metric of dailyMetrics) {
        const metricDate = new Date(metric.date);
        // Set to noon to avoid timezone edge cases
        metricDate.setHours(12, 0, 0, 0);

        if (metricDate <= historyCutoff) {
            history.push(metric);
        } else if (metricDate >= windowStart && metricDate <= yesterday) {
            window.push(metric);
        }
        // Metrics from "today" are excluded entirely
    }

    return { history, window };
}

/**
 * Tính band (MA + σ) cho 1 metric từ dữ liệu lịch sử
 * historyValues và windowValues đã được xử lý (lọc > 0 hoặc rolling aggregates)
 */
function calculateSingleBand(
    historyValues: number[],
    windowValues: number[],
    isInverse: boolean  // true cho CPP (cao = xấu), false cho CTR/ROAS (cao = tốt)
): MetricBand | null {
    // Lọc ra các giá trị > 0 (bỏ entries không có data)
    const validHistory = historyValues.filter(v => v > 0);
    const validWindow = windowValues.filter(v => v > 0);

    if (validHistory.length < 3 || validWindow.length === 0) {
        return null; // Không đủ data
    }

    // MA = trung bình lịch sử
    const ma = validHistory.reduce((s, v) => s + v, 0) / validHistory.length;

    // σ = độ lệch chuẩn lịch sử
    const variance = validHistory.reduce((s, v) => s + Math.pow(v - ma, 2), 0) / validHistory.length;
    const sigma = Math.sqrt(variance);

    // Floor & Ceiling
    const floor = isInverse ? Math.min(...validHistory) : Math.max(...validHistory);
    const ceiling = isInverse ? Math.max(...validHistory) : Math.min(...validHistory);

    // Window average
    const windowAvg = validWindow.reduce((s, v) => s + v, 0) / validWindow.length;

    // Z-Score
    const zScore = sigma > 0 ? (windowAvg - ma) / sigma : 0;

    return { ma, sigma, floor, ceiling, windowAvg, zScore };
}

/**
 * Tính rolling aggregate ratios cho CPP/ROAS từ daily metrics.
 * 
 * Thay vì averaging daily CPP (vô nghĩa khi đơn rải rác: ngày 0 đơn → CPP=0),
 * dùng rolling 7-day window: CPP = sum(spend) / sum(purchases)
 * 
 * VD: 87 ngày, 8 đơn → ~80 rolling windows, mỗi window tổng hợp 7 ngày
 * → data points có ý nghĩa thống kê hơn
 */
function calculateRollingAggregates(
    metrics: DailyMetric[],
    type: 'cpp' | 'roas',
    windowSize: number = 7
): number[] {
    const results: number[] = [];
    if (metrics.length < windowSize) return results;

    for (let i = windowSize - 1; i < metrics.length; i++) {
        const window = metrics.slice(i - windowSize + 1, i + 1);
        const totalSpend = window.reduce((s, m) => s + m.spend, 0);
        const totalPurchases = window.reduce((s, m) => s + m.purchases, 0);
        const totalRevenue = window.reduce((s, m) => s + (m.revenue || 0), 0);

        if (type === 'cpp') {
            // Chỉ tạo data point khi có ít nhất 1 đơn trong window
            if (totalPurchases > 0) {
                results.push(totalSpend / totalPurchases);
            }
        } else {
            // ROAS: chỉ khi có cả spend và revenue
            if (totalSpend > 0 && totalRevenue > 0) {
                results.push(totalRevenue / totalSpend);
            }
        }
    }
    return results;
}

/**
 * Tính aggregate ratio cho current window (7 ngày gần nhất).
 * CPP = tổng_spend / tổng_purchases
 * ROAS = tổng_revenue / tổng_spend  
 */
function calculateWindowAggregate(
    windowMetrics: DailyMetric[],
    type: 'cpp' | 'roas'
): number | null {
    if (windowMetrics.length === 0) return null;
    const totalSpend = windowMetrics.reduce((s, m) => s + m.spend, 0);
    const totalPurchases = windowMetrics.reduce((s, m) => s + m.purchases, 0);
    const totalRevenue = windowMetrics.reduce((s, m) => s + (m.revenue || 0), 0);

    if (type === 'cpp') {
        return totalPurchases > 0 ? totalSpend / totalPurchases : null;
    } else {
        return totalSpend > 0 && totalRevenue > 0 ? totalRevenue / totalSpend : null;
    }
}

/**
 * Chuyển Z-Score thành severity dựa trên tuổi campaign
 */
function getZScoreSeverity(
    absZ: number,
    lifeStage: CampaignLifeStage
): 'info' | 'warning' | 'critical' | null {
    // LEARNING + EARLY: Không dùng Z-Score
    if (lifeStage === 'LEARNING' || lifeStage === 'EARLY') return null;

    // MATURE: Khoan dung hơn
    if (lifeStage === 'MATURE') {
        if (absZ > 2.0) return 'critical';
        if (absZ > 1.5) return 'warning';
        return null; // Dưới 1.5σ = bỏ qua cho camp non trẻ
    }

    // VETERAN: Chặt nhất
    if (absZ > 2.0) return 'critical';
    if (absZ > 1.5) return 'warning';
    if (absZ > 1.0) return 'info';
    return null;
}

/**
 * Tạo tag label dựa trên severity
 */
function buildTagLabel(_metric: string, severity: 'info' | 'warning' | 'critical', isBad: boolean): string {
    // NOTE: Metric name is already shown separately in the UI row,
    // so label only contains direction icon to avoid duplication like "ROAS  ROAS ↓"
    if (!isBad) {
        return '🔥'; // Đang tốt bất thường
    }
    switch (severity) {
        case 'info': return '↓';
        case 'warning': return '↓↓';
        case 'critical': return '⚠';
    }
}

/**
 * Format số cho detail string
 */
function fmtPct(val: number): string {
    return val.toFixed(2) + '%';
}

function fmtMoney(val: number): string {
    return Math.round(val).toLocaleString('de-DE') + '₫';
}

function fmtRoas(val: number): string {
    return val.toFixed(2) + 'x';
}

// ===================================================================
// BENCHMARK TAGS (cho LEARNING + EARLY)
// ===================================================================

function generateBenchmarkTags(windowMetrics: DailyMetric[]): MetricTag[] {
    if (windowMetrics.length === 0) return [];

    const tags: MetricTag[] = [];
    const avgCtr = windowMetrics.reduce((s, m) => s + m.ctr, 0) / windowMetrics.length;
    const totalSpend = windowMetrics.reduce((s, m) => s + m.spend, 0);
    const totalPurchases = windowMetrics.reduce((s, m) => s + m.purchases, 0);
    const avgCpp = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
    const totalRevenue = windowMetrics.reduce((s, m) => s + m.revenue, 0);
    const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

    // CTR check
    if (avgCtr > 0 && avgCtr < FB_BENCHMARKS.ctr.bad) {
        tags.push({
            metric: 'CTR', direction: 'down', severity: 'warning',
            zScore: 0, label: '↓',
            detail: `CTR ${fmtPct(avgCtr)} < benchmark ngành ${fmtPct(FB_BENCHMARKS.ctr.bad)}`,
            color: TAG_COLORS.warning,
        });
    }

    // CPP check
    if (avgCpp > 0 && avgCpp > FB_BENCHMARKS.cpp.bad) {
        tags.push({
            metric: 'CPP', direction: 'up', severity: 'warning',
            zScore: 0, label: '↑',
            detail: `CPP ${fmtMoney(avgCpp)} > benchmark ngành ${fmtMoney(FB_BENCHMARKS.cpp.bad)}`,
            color: TAG_COLORS.warning,
        });
    }

    // ROAS check
    if (avgRoas > 0 && avgRoas < FB_BENCHMARKS.roas.bad) {
        tags.push({
            metric: 'ROAS', direction: 'down', severity: 'warning',
            zScore: 0, label: '↓',
            detail: `ROAS ${fmtRoas(avgRoas)} < benchmark ngành ${fmtRoas(FB_BENCHMARKS.roas.bad)}`,
            color: TAG_COLORS.warning,
        });
    }

    return tags;
}

// ===================================================================
// MAIN FUNCTION
// ===================================================================

/**
 * Phân tích Metric Bands cho 1 campaign
 *
 * @param dailyMetrics - Dữ liệu ngày đầy đủ (từ Facebook API)
 * @param createdTime - ISO datetime khi campaign được tạo
 * @param today - Ngày hiện tại (mặc định = new Date())
 */
export function generateMetricTags(
    dailyMetrics: DailyMetric[],
    createdTime?: string,
    today?: Date
): MetricBandsResult {
    const noResult: MetricBandsResult = {
        lifeStage: 'LEARNING',
        bands: { ctr: null, cpp: null, roas: null },
        tags: [],
    };

    if (!dailyMetrics || dailyMetrics.length === 0) return noResult;

    const lifeStage = getCampaignLifeStage(createdTime, today);
    const { history, window: windowData } = splitHistoryAndWindow(dailyMetrics, today);

    // LEARNING + EARLY: Không đủ lịch sử → dùng benchmark ngành
    if (lifeStage === 'LEARNING' || lifeStage === 'EARLY') {
        // Cho EARLY, dùng tất cả metrics làm window (vì chưa đủ lịch sử tách)
        const effectiveWindow = windowData.length > 0 ? windowData : dailyMetrics;
        return {
            lifeStage,
            bands: { ctr: null, cpp: null, roas: null },
            tags: generateBenchmarkTags(effectiveWindow),
        };
    }

    // MATURE + VETERAN: Tính Z-Score đầy đủ
    if (history.length < 3) {
        // Vẫn thiếu lịch sử dù camp đã mature → fallback benchmark
        return {
            lifeStage,
            bands: { ctr: null, cpp: null, roas: null },
            tags: generateBenchmarkTags(windowData.length > 0 ? windowData : dailyMetrics),
        };
    }

    // Tính bands cho từng metric
    // CTR: dùng daily values (CTR có ý nghĩa per-day vì không phụ thuộc purchases)
    const ctrBand = calculateSingleBand(
        history.map(m => m.ctr),
        windowData.map(m => m.ctr),
        false // CTR cao = tốt
    );

    // CPP/ROAS: dùng ROLLING AGGREGATE (ratio-of-sums) thay vì average-of-ratios
    // → Tránh bị ảo khi đơn rải rác (VD: 8 đơn / 87 ngày)
    const historyCppValues = calculateRollingAggregates(history, 'cpp');
    const windowCppValue = calculateWindowAggregate(windowData, 'cpp');
    const cppBand = calculateSingleBand(
        historyCppValues,
        windowCppValue !== null ? [windowCppValue] : [],
        true  // CPP cao = xấu
    );

    const historyRoasValues = calculateRollingAggregates(history, 'roas');
    const windowRoasValue = calculateWindowAggregate(windowData, 'roas');
    const roasBand = calculateSingleBand(
        historyRoasValues,
        windowRoasValue !== null ? [windowRoasValue] : [],
        false // ROAS cao = tốt
    );

    // Tạo tags dựa trên Z-Score
    const tags: MetricTag[] = [];

    // CTR tag
    if (ctrBand && ctrBand.sigma > 0) {
        const absZ = Math.abs(ctrBand.zScore);
        const isBad = ctrBand.zScore < 0; // CTR giảm = xấu
        const severity = isBad
            ? getZScoreSeverity(absZ, lifeStage)
            : (absZ > 1.5 ? 'info' as const : null); // Tăng tốt thì chỉ hiện khi rõ ràng

        if (severity) {
            tags.push({
                metric: 'CTR',
                direction: isBad ? 'down' : 'up',
                severity: isBad ? severity : 'info',
                zScore: ctrBand.zScore,
                label: isBad
                    ? buildTagLabel('CTR', severity, true)
                    : '🔥',
                detail: `CTR ${fmtPct(ctrBand.windowAvg)} vs TB lịch sử ${fmtPct(ctrBand.ma)} (${ctrBand.zScore > 0 ? '+' : ''}${ctrBand.zScore.toFixed(1)}σ)`,
                color: isBad ? TAG_COLORS[severity] : TAG_COLORS.good,
            });
        }
    }

    // CPP tag (chiều ngược: z > 0 = CPP tăng = xấu)
    if (cppBand && cppBand.sigma > 0) {
        const absZ = Math.abs(cppBand.zScore);
        const isBad = cppBand.zScore > 0; // CPP tăng = xấu
        const severity = isBad
            ? getZScoreSeverity(absZ, lifeStage)
            : (absZ > 1.5 ? 'info' as const : null);

        if (severity) {
            tags.push({
                metric: 'CPP',
                direction: isBad ? 'up' : 'down',
                severity: isBad ? severity : 'info',
                zScore: cppBand.zScore,
                label: isBad
                    ? buildTagLabel('CPP', severity, true).replace('↓', '↑').replace('⚠', '⚠')
                    : '🔥',
                detail: `CPP ${fmtMoney(cppBand.windowAvg)} vs TB lịch sử ${fmtMoney(cppBand.ma)} (${cppBand.zScore > 0 ? '+' : ''}${cppBand.zScore.toFixed(1)}σ)`,
                color: isBad ? TAG_COLORS[severity] : TAG_COLORS.good,
            });
        }
    }

    // ROAS tag
    if (roasBand && roasBand.sigma > 0) {
        const absZ = Math.abs(roasBand.zScore);
        const isBad = roasBand.zScore < 0; // ROAS giảm = xấu
        const severity = isBad
            ? getZScoreSeverity(absZ, lifeStage)
            : (absZ > 1.5 ? 'info' as const : null);

        if (severity) {
            tags.push({
                metric: 'ROAS',
                direction: isBad ? 'down' : 'up',
                severity: isBad ? severity : 'info',
                zScore: roasBand.zScore,
                label: isBad
                    ? buildTagLabel('ROAS', severity, true)
                    : '🔥',
                detail: `ROAS ${fmtRoas(roasBand.windowAvg)} vs TB lịch sử ${fmtRoas(roasBand.ma)} (${roasBand.zScore > 0 ? '+' : ''}${roasBand.zScore.toFixed(1)}σ)`,
                color: isBad ? TAG_COLORS[severity] : TAG_COLORS.good,
            });
        }
    }

    return {
        lifeStage,
        bands: { ctr: ctrBand, cpp: cppBand, roas: roasBand },
        tags,
    };
}
