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
};

/**
 * Phát hiện tất cả issues của một campaign
 */
export function detectIssues(campaign: CampaignData): Issue[] {
    const issues: Issue[] = [];
    const metrics = campaign.dailyMetrics;
    const totals = campaign.totals;

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

    // 2. CPP tăng liên tục
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
                issues.push({
                    type: 'cpp_rising',
                    severity: 'warning',
                    message: 'CPP tăng liên tục',
                    detail: `${THRESHOLDS.CPP_INCREASE_DAYS} ngày: ${formatMoney(firstCpp)} → ${formatMoney(lastCpp)} (+${increase.toFixed(0)}%)`,
                    action: 'Thay content mới',
                });
            }
        }
    }

    // 3. Có đơn nhưng lỗ (ROAS < 1)
    if (totals.purchases > 0 && totals.roas < THRESHOLDS.MIN_ROAS) {
        const loss = totals.spend - totals.revenue;
        issues.push({
            type: 'losing_money',
            severity: 'critical',
            message: 'Có đơn nhưng đang lỗ',
            detail: `ROAS ${totals.roas.toFixed(2)}x, lỗ ${formatMoney(loss)}`,
            action: 'Giảm budget 50% hoặc tắt',
        });
    }

    // 4. Frequency cao
    if (todayMetric && todayMetric.frequency && todayMetric.frequency > THRESHOLDS.HIGH_FREQUENCY) {
        issues.push({
            type: 'high_frequency',
            severity: 'warning',
            message: 'Audience đã xem quá nhiều lần',
            detail: `Frequency: ${todayMetric.frequency.toFixed(1)}`,
            action: 'Mở rộng audience hoặc tạm dừng 2-3 ngày',
        });
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
 * Format tiền VND
 */
function formatMoney(amount: number): string {
    return amount.toLocaleString('vi-VN') + 'đ';
}

/**
 * Phân tích tất cả campaigns và trả về Daily Action Board data
 */
export function analyzeCampaigns(campaigns: CampaignData[]): {
    critical: Array<CampaignData & { issues: Issue[] }>;
    warning: Array<CampaignData & { issues: Issue[] }>;
    good: Array<CampaignData & { issues: Issue[] }>;
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
        return { ...campaign, issues };
    });

    const critical = results.filter(c => classifyCampaign(c.issues) === 'critical');
    const warning = results.filter(c => classifyCampaign(c.issues) === 'warning');
    const good = results.filter(c => classifyCampaign(c.issues) === 'good');

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
