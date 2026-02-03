// Trend Detection - Phát hiện chiến dịch kém hiệu quả
// So sánh metrics hiện tại với lịch sử để phát hiện bất thường

import { AlertData } from '../telegram/bot';

export interface CampaignMetrics {
    campaignId: string;
    campaignName: string;
    date: string;
    spend: number;
    revenue: number;
    leads: number;
    purchases: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    cpp: number; // Cost per purchase
    roas: number;
}

export interface TrendAnalysis {
    campaignId: string;
    campaignName: string;
    alerts: AlertData[];
    trend: 'improving' | 'stable' | 'declining' | 'critical';
    metrics: {
        cpp: { current: number; previous: number; change: number };
        roas: { current: number; previous: number; change: number };
        ctr: { current: number; previous: number; change: number };
        leads: { current: number; previous: number; change: number };
    };
}

// Thresholds for alerts
const THRESHOLDS = {
    CPP_INCREASE_WARNING: 30,    // 30% tăng → warning
    CPP_INCREASE_CRITICAL: 50,   // 50% tăng → critical
    ROAS_DROP_WARNING: 20,       // 20% giảm → warning
    ROAS_DROP_CRITICAL: 40,      // 40% giảm → critical
    CTR_DROP_WARNING: 25,        // CTR giảm 25%
    LEADS_DROP_WARNING: 30,      // Leads giảm 30%
    CONSECUTIVE_DECLINE_DAYS: 3, // 3 ngày giảm liên tiếp
};

/**
 * Phân tích xu hướng của một campaign
 */
export function analyzeCampaignTrend(
    current: CampaignMetrics,
    history: CampaignMetrics[] // 7 ngày gần nhất
): TrendAnalysis {
    const alerts: AlertData[] = [];

    // Tính trung bình 7 ngày trước
    const avgMetrics = calculateAverage(history);

    // So sánh CPP (Cost per Purchase)
    const cppChange = calculateChange(current.cpp, avgMetrics.cpp);
    if (cppChange >= THRESHOLDS.CPP_INCREASE_CRITICAL) {
        alerts.push({
            type: 'critical',
            title: 'CHI PHÍ/MUA TĂNG ĐỘT BIẾN',
            campaignName: current.campaignName,
            metrics: {
                current: current.cpp,
                previous: avgMetrics.cpp,
                change: cppChange,
                unit: 'đ'
            },
            reason: 'Creative fatigue hoặc đối thủ tăng bid',
            suggestion: 'Tạm dừng và thay creative mới',
            campaignId: current.campaignId
        });
    } else if (cppChange >= THRESHOLDS.CPP_INCREASE_WARNING) {
        alerts.push({
            type: 'warning',
            title: 'Chi phí/mua đang tăng',
            campaignName: current.campaignName,
            metrics: {
                current: current.cpp,
                previous: avgMetrics.cpp,
                change: cppChange,
                unit: 'đ'
            },
            suggestion: 'Theo dõi trong 24h tới',
            campaignId: current.campaignId
        });
    }

    // So sánh ROAS
    const roasChange = calculateChange(current.roas, avgMetrics.roas);
    if (roasChange <= -THRESHOLDS.ROAS_DROP_CRITICAL) {
        alerts.push({
            type: 'critical',
            title: 'ROAS GIẢM MẠNH',
            campaignName: current.campaignName,
            metrics: {
                current: current.roas,
                previous: avgMetrics.roas,
                change: roasChange,
                unit: ''
            },
            reason: 'Doanh thu giảm hoặc chi phí tăng',
            suggestion: 'Kiểm tra landing page và offer',
            campaignId: current.campaignId
        });
    }

    // So sánh CTR
    const ctrChange = calculateChange(current.ctr, avgMetrics.ctr);
    if (ctrChange <= -THRESHOLDS.CTR_DROP_WARNING) {
        alerts.push({
            type: 'warning',
            title: 'CTR giảm - Creative có thể đã bão hòa',
            campaignName: current.campaignName,
            metrics: {
                current: current.ctr,
                previous: avgMetrics.ctr,
                change: ctrChange,
                unit: '%'
            },
            suggestion: 'Cân nhắc thay creative mới',
            campaignId: current.campaignId
        });
    }

    // Kiểm tra downtrend liên tiếp
    const consecutiveDecline = checkConsecutiveDecline(history, 'leads');
    if (consecutiveDecline >= THRESHOLDS.CONSECUTIVE_DECLINE_DAYS) {
        alerts.push({
            type: 'warning',
            title: `Leads giảm ${consecutiveDecline} ngày liên tiếp`,
            campaignName: current.campaignName,
            metrics: {
                current: current.leads,
                previous: history[history.length - consecutiveDecline]?.leads || 0,
                change: calculateChange(current.leads, history[0]?.leads || 0),
                unit: ''
            },
            suggestion: 'Chiến dịch đang downtrend, cần refresh',
            campaignId: current.campaignId
        });
    }

    // Xác định trend tổng thể
    let trend: TrendAnalysis['trend'] = 'stable';
    if (alerts.some(a => a.type === 'critical')) {
        trend = 'critical';
    } else if (alerts.some(a => a.type === 'warning')) {
        trend = 'declining';
    } else if (roasChange > 10 || cppChange < -10) {
        trend = 'improving';
    }

    return {
        campaignId: current.campaignId,
        campaignName: current.campaignName,
        alerts,
        trend,
        metrics: {
            cpp: { current: current.cpp, previous: avgMetrics.cpp, change: cppChange },
            roas: { current: current.roas, previous: avgMetrics.roas, change: roasChange },
            ctr: { current: current.ctr, previous: avgMetrics.ctr, change: ctrChange },
            leads: { current: current.leads, previous: avgMetrics.leads, change: calculateChange(current.leads, avgMetrics.leads) }
        }
    };
}

/**
 * Tính phần trăm thay đổi
 */
function calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
}

/**
 * Tính trung bình metrics
 */
function calculateAverage(history: CampaignMetrics[]): CampaignMetrics {
    if (history.length === 0) {
        return {
            campaignId: '',
            campaignName: '',
            date: '',
            spend: 0,
            revenue: 0,
            leads: 0,
            purchases: 0,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            cpc: 0,
            cpm: 0,
            cpp: 0,
            roas: 0
        };
    }

    const sum = history.reduce((acc, m) => ({
        spend: acc.spend + m.spend,
        revenue: acc.revenue + m.revenue,
        leads: acc.leads + m.leads,
        purchases: acc.purchases + m.purchases,
        impressions: acc.impressions + m.impressions,
        clicks: acc.clicks + m.clicks,
        ctr: acc.ctr + m.ctr,
        cpc: acc.cpc + m.cpc,
        cpm: acc.cpm + m.cpm,
        cpp: acc.cpp + m.cpp,
        roas: acc.roas + m.roas
    }), {
        spend: 0, revenue: 0, leads: 0, purchases: 0,
        impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, cpp: 0, roas: 0
    });

    const count = history.length;
    return {
        campaignId: history[0].campaignId,
        campaignName: history[0].campaignName,
        date: '',
        spend: sum.spend / count,
        revenue: sum.revenue / count,
        leads: sum.leads / count,
        purchases: sum.purchases / count,
        impressions: sum.impressions / count,
        clicks: sum.clicks / count,
        ctr: sum.ctr / count,
        cpc: sum.cpc / count,
        cpm: sum.cpm / count,
        cpp: sum.cpp / count,
        roas: sum.roas / count
    };
}

/**
 * Kiểm tra số ngày giảm liên tiếp
 */
function checkConsecutiveDecline(
    history: CampaignMetrics[],
    metric: keyof CampaignMetrics
): number {
    if (history.length < 2) return 0;

    let count = 0;
    // Sắp xếp theo ngày mới nhất trước
    const sorted = [...history].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i][metric] as number;
        const previous = sorted[i + 1][metric] as number;
        if (current < previous) {
            count++;
        } else {
            break;
        }
    }

    return count;
}

/**
 * Phân tích tất cả campaigns và trả về những cái cần alert
 */
export function analyzeAllCampaigns(
    currentData: CampaignMetrics[],
    historicalData: Map<string, CampaignMetrics[]>
): TrendAnalysis[] {
    const results: TrendAnalysis[] = [];

    for (const campaign of currentData) {
        const history = historicalData.get(campaign.campaignId) || [];
        const analysis = analyzeCampaignTrend(campaign, history);

        // Chỉ return những campaign có alert hoặc đang critical/declining
        if (analysis.alerts.length > 0 || analysis.trend === 'critical' || analysis.trend === 'declining') {
            results.push(analysis);
        }
    }

    // Sắp xếp theo severity: critical > declining > stable
    results.sort((a, b) => {
        const order = { critical: 0, declining: 1, stable: 2, improving: 3 };
        return order[a.trend] - order[b.trend];
    });

    return results;
}
