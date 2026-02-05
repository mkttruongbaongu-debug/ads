/**
 * ===================================================================
 * HELPER: METRICS COMPARISON
 * ===================================================================
 * Mô tả:
 * So sánh metrics trước/sau khi thực thi proposal.
 * Tính % thay đổi và đánh giá improvement.
 * 
 * Sử dụng:
 * const comparison = compareMetrics(metricsBefore, metricsAfter);
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

// ===================================================================
// TYPES
// ===================================================================

export interface CampaignMetrics {
    cpp: number;      // Cost per purchase
    roas: number;     // Return on ad spend
    chiTieu: number;  // Spend
    donHang?: number; // Purchases
    ctr?: number;     // Click-through rate
    doanhThu?: number; // Revenue
}

export interface MetricsComparison {
    before: CampaignMetrics;
    after: CampaignMetrics;
    changes: {
        cpp_change: number;        // % change (negative = better)
        roas_change: number;       // % change (positive = better)
        chiTieu_change: number;    // % change
        donHang_change?: number;   // % change
        ctr_change?: number;       // % change
        doanhThu_change?: number;  // % change
    };
    improvement: {
        cpp_improved: boolean;     // CPP giảm = tốt
        roas_improved: boolean;    // ROAS tăng = tốt
        overall_improved: boolean; // Tổng thể cải thiện
    };
}

// ===================================================================
// MAIN FUNCTION
// ===================================================================

/**
 * So sánh metrics trước/sau
 * 
 * @param before - Metrics trước khi thực thi
 * @param after - Metrics sau khi thực thi
 * @returns Comparison object với % changes và improvement flags
 */
export function compareMetrics(
    before: CampaignMetrics,
    after: CampaignMetrics
): MetricsComparison {
    // ===================================================================
    // CALCULATE % CHANGES
    // ===================================================================

    const cpp_change = calculatePercentChange(before.cpp, after.cpp);
    const roas_change = calculatePercentChange(before.roas, after.roas);
    const chiTieu_change = calculatePercentChange(before.chiTieu, after.chiTieu);

    const changes: MetricsComparison['changes'] = {
        cpp_change,
        roas_change,
        chiTieu_change,
    };

    // Optional metrics
    if (before.donHang !== undefined && after.donHang !== undefined) {
        changes.donHang_change = calculatePercentChange(before.donHang, after.donHang);
    }

    if (before.ctr !== undefined && after.ctr !== undefined) {
        changes.ctr_change = calculatePercentChange(before.ctr, after.ctr);
    }

    if (before.doanhThu !== undefined && after.doanhThu !== undefined) {
        changes.doanhThu_change = calculatePercentChange(before.doanhThu, after.doanhThu);
    }

    // ===================================================================
    // DETERMINE IMPROVEMENT
    // ===================================================================

    // CPP giảm = improvement (negative change is good)
    const cpp_improved = cpp_change < -5; // Giảm >= 5%

    // ROAS tăng = improvement (positive change is good)
    const roas_improved = roas_change > 5; // Tăng >= 5%

    // Overall: Ít nhất 1 metric cải thiện và không có metric nào xấu đi quá nhiều
    const overall_improved = (cpp_improved || roas_improved) &&
        cpp_change > -50 && // CPP không tăng quá 50%
        roas_change > -30;  // ROAS không giảm quá 30%

    // ===================================================================
    // BUILD RESULT
    // ===================================================================

    return {
        before,
        after,
        changes,
        improvement: {
            cpp_improved,
            roas_improved,
            overall_improved,
        },
    };
}

/**
 * Tính % thay đổi
 * 
 * @param before - Giá trị trước
 * @param after - Giá trị sau
 * @returns % thay đổi (positive = tăng, negative = giảm)
 */
function calculatePercentChange(before: number, after: number): number {
    if (before === 0) {
        return after > 0 ? 100 : 0;
    }

    return ((after - before) / before) * 100;
}

/**
 * Format % change thành string hiển thị
 * 
 * @param change - % thay đổi
 * @returns Formatted string (e.g., "+15.2%" or "-8.7%")
 */
export function formatPercentChange(change: number): string {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
}

/**
 * Đánh giá mức độ improvement dựa trên % change
 * 
 * @param change - % thay đổi
 * @param lowerIsBetter - true nếu giảm = tốt (như CPP)
 * @returns 'excellent' | 'good' | 'neutral' | 'bad'
 */
export function evaluateChange(
    change: number,
    lowerIsBetter: boolean = false
): 'excellent' | 'good' | 'neutral' | 'bad' {
    const effectiveChange = lowerIsBetter ? -change : change;

    if (effectiveChange >= 20) return 'excellent';
    if (effectiveChange >= 10) return 'good';
    if (effectiveChange >= -5) return 'neutral';
    return 'bad';
}

/**
 * Generate text summary của comparison
 * 
 * @param comparison - MetricsComparison object
 * @returns Human-readable summary
 */
export function summarizeComparison(comparison: MetricsComparison): string {
    const { changes, improvement } = comparison;

    const parts: string[] = [];

    // CPP
    if (improvement.cpp_improved) {
        parts.push(`CPP giảm ${Math.abs(changes.cpp_change).toFixed(1)}%`);
    } else if (changes.cpp_change > 10) {
        parts.push(`CPP tăng ${changes.cpp_change.toFixed(1)}%`);
    }

    // ROAS
    if (improvement.roas_improved) {
        parts.push(`ROAS tăng ${changes.roas_change.toFixed(1)}%`);
    } else if (changes.roas_change < -10) {
        parts.push(`ROAS giảm ${Math.abs(changes.roas_change).toFixed(1)}%`);
    }

    if (parts.length === 0) {
        return 'Metrics ổn định, không có thay đổi đáng kể';
    }

    return parts.join(', ');
}
