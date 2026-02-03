// AI CPP Analyzer - Phân tích nguyên nhân CPP cao và đề xuất tối ưu

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface BranchMetrics {
    name: string;
    campaignId: string;
    spend: number;
    purchases: number;
    cpp: number;
    revenue: number;
    roas: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpm: number;
    frequency?: number;
}

export interface AnalysisResult {
    branchName: string;
    cppStatus: 'critical' | 'warning' | 'good';
    cppVsAverage: number; // percentage difference
    causes: string[];
    recommendations: string[];
    priority: 'high' | 'medium' | 'low';
    estimatedSaving?: number; // VND có thể tiết kiệm nếu tối ưu
}

/**
 * Phân tích một chi nhánh và đưa ra insights
 */
export async function analyzeBranch(
    branch: BranchMetrics,
    averageCpp: number,
    averageCtr: number,
    averageCpm: number
): Promise<AnalysisResult> {
    const cppVsAverage = ((branch.cpp - averageCpp) / averageCpp) * 100;

    // Determine status
    let cppStatus: AnalysisResult['cppStatus'] = 'good';
    let priority: AnalysisResult['priority'] = 'low';

    if (cppVsAverage >= 50) {
        cppStatus = 'critical';
        priority = 'high';
    } else if (cppVsAverage >= 20) {
        cppStatus = 'warning';
        priority = 'medium';
    }

    // Rule-based analysis (fast, no API call)
    const causes: string[] = [];
    const recommendations: string[] = [];

    // CTR analysis
    const ctrDiff = ((branch.ctr - averageCtr) / averageCtr) * 100;
    if (ctrDiff < -30) {
        causes.push(`CTR thấp (${branch.ctr.toFixed(2)}% vs TB ${averageCtr.toFixed(2)}%) - Content không thu hút`);
        recommendations.push('Thay creative mới: video ngắn < 15s, hook mạnh 3s đầu');
    }

    // CPM analysis
    const cpmDiff = ((branch.cpm - averageCpm) / averageCpm) * 100;
    if (cpmDiff > 30) {
        causes.push(`CPM cao (${formatVND(branch.cpm)} vs TB ${formatVND(averageCpm)}) - Đối thủ bid cao hoặc audience bão hòa`);
        recommendations.push('Mở rộng audience hoặc test interest mới');
    }

    // Frequency analysis
    if (branch.frequency && branch.frequency > 3) {
        causes.push(`Frequency cao (${branch.frequency.toFixed(1)}) - Người dùng thấy ad quá nhiều lần`);
        recommendations.push('Tạm dừng 2-3 ngày để refresh hoặc thay creative');
    }

    // Low purchases
    if (branch.purchases < 5 && branch.spend > 1000000) {
        causes.push('Chi tiêu cao nhưng ít lượt mua - Có thể vấn đề ở landing page');
        recommendations.push('Kiểm tra landing page: tốc độ load, CTA, giá sản phẩm');
    }

    // ROAS analysis
    if (branch.roas < 1) {
        causes.push(`ROAS < 1 (${branch.roas.toFixed(2)}x) - Đang lỗ tiền quảng cáo`);
        recommendations.push('Cân nhắc tạm dừng campaign hoặc giảm 50% budget');
    }

    // If no specific issues found but CPP still high
    if (causes.length === 0 && cppStatus !== 'good') {
        causes.push('Không có chỉ số bất thường rõ ràng - Có thể do thị trường khu vực');
        recommendations.push('So sánh với đối thủ cùng khu vực, test offer mới');
    }

    // Add default recommendation if empty
    if (recommendations.length === 0) {
        recommendations.push('Tiếp tục theo dõi, metrics đang ổn định');
    }

    // Estimate potential saving
    const estimatedSaving = cppStatus !== 'good'
        ? Math.round(branch.spend * (cppVsAverage / 100) * 0.5) // 50% of overspend
        : 0;

    return {
        branchName: branch.name,
        cppStatus,
        cppVsAverage: Math.round(cppVsAverage),
        causes,
        recommendations,
        priority,
        estimatedSaving
    };
}

/**
 * Phân tích chi tiết bằng AI (cho khi user click xem chi tiết)
 */
export async function analyzeWithAI(
    branch: BranchMetrics,
    averages: { cpp: number; ctr: number; cpm: number }
): Promise<string> {
    const prompt = `Bạn là chuyên gia tối ưu quảng cáo Facebook cho doanh nghiệp bán hải sản online tại Việt Nam.

Phân tích chi nhánh "${branch.name}" và đưa ra kế hoạch tối ưu:

METRICS HIỆN TẠI:
- Chi tiêu: ${formatVND(branch.spend)}
- Lượt mua: ${branch.purchases}
- Chi phí/mua (CPP): ${formatVND(branch.cpp)} (TB: ${formatVND(averages.cpp)}, ${branch.cpp > averages.cpp ? '+' : ''}${Math.round(((branch.cpp - averages.cpp) / averages.cpp) * 100)}%)
- Doanh thu: ${formatVND(branch.revenue)}
- ROAS: ${branch.roas.toFixed(2)}x
- CTR: ${branch.ctr.toFixed(2)}% (TB: ${averages.ctr.toFixed(2)}%)
- CPM: ${formatVND(branch.cpm)} (TB: ${formatVND(averages.cpm)})
${branch.frequency ? `- Frequency: ${branch.frequency.toFixed(1)}` : ''}

YÊU CẦU:
1. Phân tích nguyên nhân CPP ${branch.cpp > averages.cpp ? 'cao' : 'thấp'} hơn trung bình
2. Đề xuất 3 hành động cụ thể để tối ưu
3. Ước tính kết quả sau khi tối ưu

Trả lời ngắn gọn, súc tích, có đánh số. Dùng tiếng Việt.`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.7,
        });

        return response.choices[0]?.message?.content || 'Không thể phân tích';
    } catch (error) {
        console.error('AI analysis error:', error);
        return 'Lỗi khi gọi AI. Vui lòng thử lại.';
    }
}

/**
 * Phân tích tất cả chi nhánh và sắp xếp theo priority
 */
export function analyzeAllBranches(branches: BranchMetrics[]): {
    analyses: AnalysisResult[];
    averages: { cpp: number; ctr: number; cpm: number; roas: number };
    summary: {
        totalSpend: number;
        totalRevenue: number;
        totalPurchases: number;
        criticalCount: number;
        warningCount: number;
        potentialSaving: number;
    };
} {
    // Calculate averages
    const totalSpend = branches.reduce((sum, b) => sum + b.spend, 0);
    const totalPurchases = branches.reduce((sum, b) => sum + b.purchases, 0);
    const totalRevenue = branches.reduce((sum, b) => sum + b.revenue, 0);

    const averages = {
        cpp: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
        ctr: branches.reduce((sum, b) => sum + b.ctr, 0) / branches.length,
        cpm: branches.reduce((sum, b) => sum + b.cpm, 0) / branches.length,
        roas: totalSpend > 0 ? totalRevenue / totalSpend : 0
    };

    // Analyze each branch (synchronous, rule-based)
    const analyses: AnalysisResult[] = branches.map(branch => {
        const cppVsAverage = averages.cpp > 0
            ? ((branch.cpp - averages.cpp) / averages.cpp) * 100
            : 0;

        let cppStatus: AnalysisResult['cppStatus'] = 'good';
        let priority: AnalysisResult['priority'] = 'low';

        if (cppVsAverage >= 50) {
            cppStatus = 'critical';
            priority = 'high';
        } else if (cppVsAverage >= 20) {
            cppStatus = 'warning';
            priority = 'medium';
        }

        const causes: string[] = [];
        const recommendations: string[] = [];

        // CTR check
        if (branch.ctr < averages.ctr * 0.7) {
            causes.push('CTR thấp - Content không thu hút');
            recommendations.push('Thay creative mới');
        }

        // CPM check
        if (branch.cpm > averages.cpm * 1.3) {
            causes.push('CPM cao - Audience bão hòa');
            recommendations.push('Mở rộng targeting');
        }

        // Frequency check
        if (branch.frequency && branch.frequency > 3) {
            causes.push('Frequency cao');
            recommendations.push('Tạm dừng 2-3 ngày');
        }

        if (causes.length === 0 && cppStatus === 'good') {
            causes.push('Đang hoạt động tốt');
            recommendations.push('Duy trì chiến lược hiện tại');
        }

        return {
            branchName: branch.name,
            cppStatus,
            cppVsAverage: Math.round(cppVsAverage),
            causes,
            recommendations,
            priority,
            estimatedSaving: cppStatus !== 'good'
                ? Math.round(branch.spend * Math.abs(cppVsAverage) / 100 * 0.3)
                : 0
        };
    });

    // Sort by priority
    analyses.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
    });

    return {
        analyses,
        averages,
        summary: {
            totalSpend,
            totalRevenue,
            totalPurchases,
            criticalCount: analyses.filter(a => a.cppStatus === 'critical').length,
            warningCount: analyses.filter(a => a.cppStatus === 'warning').length,
            potentialSaving: analyses.reduce((sum, a) => sum + (a.estimatedSaving || 0), 0)
        }
    };
}

function formatVND(value: number): string {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
        return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toLocaleString('vi-VN') + 'đ';
}
