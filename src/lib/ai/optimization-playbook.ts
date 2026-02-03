// Optimization Playbook - Framework xử lý campaigns không hiệu quả
// Dựa trên best practices Facebook Ads

export type CampaignIssue =
    | 'high_cpp'           // CPP cao hơn target
    | 'low_roas'           // ROAS < 1, đang lỗ
    | 'declining_ctr'      // CTR giảm dần
    | 'high_frequency'     // Tần suất > 3
    | 'high_cpm'           // CPM cao bất thường
    | 'zero_results'       // Chi tiêu nhưng không có kết quả
    | 'budget_depleting'   // Budget sắp hết
    | 'learning_stuck';    // Kẹt ở learning phase

export interface ActionStep {
    action: string;
    detail: string;
    expectedResult: string;
    timeframe: string;
}

export interface OptimizationPlaybook {
    issue: CampaignIssue;
    severity: 'critical' | 'warning' | 'info';
    diagnosis: string;
    immediateAction: ActionStep;
    followUpActions: ActionStep[];
    dontDo: string[];
    successMetric: string;
}

/**
 * Playbook cho từng loại vấn đề
 */
export const PLAYBOOKS: Record<CampaignIssue, OptimizationPlaybook> = {
    high_cpp: {
        issue: 'high_cpp',
        severity: 'critical',
        diagnosis: 'Chi phí/lượt mua cao hơn mục tiêu. Có thể do: target sai, creative mòn, hoặc offer không hấp dẫn.',
        immediateAction: {
            action: 'GIẢM BUDGET 50%',
            detail: 'Giảm ngân sách xuống 50% để giảm tổn thất trong khi phân tích',
            expectedResult: 'Giảm chi phí lãng phí ngay lập tức',
            timeframe: 'Làm ngay'
        },
        followUpActions: [
            {
                action: 'Kiểm tra CTR',
                detail: 'Nếu CTR < 1.5% → Creative không thu hút, cần thay mới',
                expectedResult: 'Xác định nguyên nhân gốc',
                timeframe: '30 phút'
            },
            {
                action: 'Kiểm tra CPM',
                detail: 'Nếu CPM > 150K → Audience bão hòa hoặc đối thủ bid cao',
                expectedResult: 'Quyết định mở rộng hay đổi audience',
                timeframe: '30 phút'
            },
            {
                action: 'Test creative mới',
                detail: 'Duplicate campaign, thay creative mới, budget thấp (200K/ngày)',
                expectedResult: 'Tìm creative hiệu quả hơn',
                timeframe: '24-48h'
            }
        ],
        dontDo: [
            'KHÔNG tắt ngay - mất dữ liệu learning',
            'KHÔNG tăng budget khi chưa fix vấn đề',
            'KHÔNG đổi quá nhiều thứ cùng lúc'
        ],
        successMetric: 'CPP giảm về ≤ target trong 3-5 ngày'
    },

    low_roas: {
        issue: 'low_roas',
        severity: 'critical',
        diagnosis: 'ROAS < 1 nghĩa là đang lỗ tiền quảng cáo. Cần action ngay.',
        immediateAction: {
            action: 'TẠM DỪNG CAMPAIGN',
            detail: 'Pause ngay để ngừng đốt tiền. Phân tích trước khi chạy lại.',
            expectedResult: 'Ngừng lỗ ngay lập tức',
            timeframe: 'Làm ngay'
        },
        followUpActions: [
            {
                action: 'Review landing page',
                detail: 'Kiểm tra tốc độ load, giá sản phẩm, CTA, form đặt hàng',
                expectedResult: 'Tìm điểm rò rỉ conversion',
                timeframe: '1 giờ'
            },
            {
                action: 'So sánh với campaign tốt',
                detail: 'Xem campaign ROAS cao dùng creative/audience gì',
                expectedResult: 'Học hỏi pattern thành công',
                timeframe: '30 phút'
            },
            {
                action: 'Test offer mới',
                detail: 'Thử giảm giá, combo, freeship để tăng conversion',
                expectedResult: 'Tăng tỷ lệ chuyển đổi',
                timeframe: '1-2 ngày'
            }
        ],
        dontDo: [
            'KHÔNG tiếp tục chạy với hy vọng sẽ tốt hơn',
            'KHÔNG đổ thêm budget vào',
            'KHÔNG blame Facebook - vấn đề ở offer/creative'
        ],
        successMetric: 'ROAS ≥ 1.5 khi chạy lại'
    },

    declining_ctr: {
        issue: 'declining_ctr',
        severity: 'warning',
        diagnosis: 'CTR giảm dần cho thấy creative đang mòn (ad fatigue). Audience đã thấy ad nhiều lần.',
        immediateAction: {
            action: 'CHUẨN BỊ CREATIVE MỚI',
            detail: 'Tạo 2-3 creative mới trong khi campaign vẫn chạy',
            expectedResult: 'Sẵn sàng thay thế khi cần',
            timeframe: '24 giờ'
        },
        followUpActions: [
            {
                action: 'Kiểm tra Frequency',
                detail: 'Nếu Frequency > 2.5, audience đã thấy ad quá nhiều',
                expectedResult: 'Xác nhận ad fatigue',
                timeframe: '10 phút'
            },
            {
                action: 'Duplicate và test',
                detail: 'Tạo campaign mới với creative mới, giữ nguyên audience',
                expectedResult: 'So sánh hiệu quả',
                timeframe: '2-3 ngày'
            },
            {
                action: 'Mở rộng audience',
                detail: 'Thêm interest mới hoặc dùng Lookalike rộng hơn',
                expectedResult: 'Tiếp cận người mới',
                timeframe: '1 ngày'
            }
        ],
        dontDo: [
            'KHÔNG chờ đến khi CTR = 0',
            'KHÔNG tăng budget để bù số lượng',
            'KHÔNG đổi audience cùng lúc đổi creative'
        ],
        successMetric: 'CTR mới ≥ CTR ban đầu của creative cũ'
    },

    high_frequency: {
        issue: 'high_frequency',
        severity: 'warning',
        diagnosis: 'Frequency > 3 nghĩa là mỗi người trong audience đã thấy ad > 3 lần. Hiệu quả sẽ giảm dần.',
        immediateAction: {
            action: 'MỞ RỘNG AUDIENCE',
            detail: 'Thêm interest mới hoặc dùng Lookalike 5-10% thay vì 1-3%',
            expectedResult: 'Giảm frequency, tiếp cận người mới',
            timeframe: '1 ngày'
        },
        followUpActions: [
            {
                action: 'Tạm dừng 2-3 ngày',
                detail: 'Nếu không thể mở rộng, pause để audience "quên" ad',
                expectedResult: 'Reset hiệu quả',
                timeframe: '2-3 ngày'
            },
            {
                action: 'Thay creative hoàn toàn mới',
                detail: 'Concept khác, màu sắc khác, hook khác',
                expectedResult: 'Audience cảm thấy như ad mới',
                timeframe: '1 ngày'
            }
        ],
        dontDo: [
            'KHÔNG ép chạy tiếp khi Frequency > 5',
            'KHÔNG chỉ đổi thumbnail, phải đổi concept'
        ],
        successMetric: 'Frequency < 2.5 trong 7 ngày tiếp theo'
    },

    high_cpm: {
        issue: 'high_cpm',
        severity: 'warning',
        diagnosis: 'CPM cao có thể do: đối thủ bid cao, audience nhỏ/cạnh tranh, hoặc ad quality thấp.',
        immediateAction: {
            action: 'MỞ RỘNG TARGETING',
            detail: 'Bỏ bớt narrowing, dùng Advantage+ Audience',
            expectedResult: 'Facebook tìm được người rẻ hơn',
            timeframe: '1 ngày'
        },
        followUpActions: [
            {
                action: 'Review ad relevance',
                detail: 'Kiểm tra Quality Ranking, Engagement Ranking trong Ads Manager',
                expectedResult: 'Xác định ad có bị Facebook đánh giá thấp',
                timeframe: '10 phút'
            },
            {
                action: 'Test placement mới',
                detail: 'Thử Instagram Reels, Stories - thường CPM thấp hơn Feed',
                expectedResult: 'Tìm placement rẻ hơn',
                timeframe: '2-3 ngày'
            }
        ],
        dontDo: [
            'KHÔNG bid manual cao hơn - sẽ đắt thêm',
            'KHÔNG thu hẹp audience - sẽ đắt thêm'
        ],
        successMetric: 'CPM giảm 20-30% trong 5-7 ngày'
    },

    zero_results: {
        issue: 'zero_results',
        severity: 'critical',
        diagnosis: 'Chi tiêu nhưng không có conversion. Có thể Pixel không track đúng hoặc offer không phù hợp.',
        immediateAction: {
            action: 'TẠM DỪNG NGAY',
            detail: 'Pause để không đốt tiền vô ích',
            expectedResult: 'Dừng lỗ',
            timeframe: 'Làm ngay'
        },
        followUpActions: [
            {
                action: 'Kiểm tra Pixel',
                detail: 'Dùng Facebook Pixel Helper để verify events đang fire đúng',
                expectedResult: 'Xác nhận tracking hoạt động',
                timeframe: '30 phút'
            },
            {
                action: 'Kiểm tra landing page',
                detail: 'Test thử mua hàng xem có hoạt động không',
                expectedResult: 'Xác nhận flow mua hàng OK',
                timeframe: '15 phút'
            },
            {
                action: 'Đổi optimization event',
                detail: 'Nếu optimize cho Purchase không có data, thử Add to Cart hoặc Lead',
                expectedResult: 'Có data để Facebook học',
                timeframe: '3-5 ngày'
            }
        ],
        dontDo: [
            'KHÔNG chạy tiếp với hy vọng',
            'KHÔNG tăng budget để "ép" ra kết quả'
        ],
        successMetric: 'Có conversion đầu tiên trong 48h sau khi fix'
    },

    budget_depleting: {
        issue: 'budget_depleting',
        severity: 'info',
        diagnosis: 'Budget sắp hết, cần quyết định có tăng hay không dựa trên hiệu quả.',
        immediateAction: {
            action: 'ĐÁNH GIÁ HIỆU QUẢ',
            detail: 'Nếu ROAS > 1.5 và CPP ≤ target → Tăng budget 20-30%',
            expectedResult: 'Scale campaign tốt',
            timeframe: '15 phút'
        },
        followUpActions: [
            {
                action: 'Tăng từ từ',
                detail: 'Không tăng quá 20% budget mỗi ngày để không reset learning',
                expectedResult: 'Duy trì hiệu quả khi scale',
                timeframe: 'Hàng ngày'
            }
        ],
        dontDo: [
            'KHÔNG tăng gấp đôi budget một lần - sẽ reset learning',
            'KHÔNG tăng budget cho campaign đang kém'
        ],
        successMetric: 'Duy trì CPP và ROAS khi tăng budget'
    },

    learning_stuck: {
        issue: 'learning_stuck',
        severity: 'warning',
        diagnosis: 'Campaign kẹt ở "Learning Limited" - không đủ conversion để Facebook tối ưu.',
        immediateAction: {
            action: 'GỘP ADSETS',
            detail: 'Gộp các adsets nhỏ lại thành 1 để tập trung data',
            expectedResult: 'Đủ 50 conversions/week trong 1 adset',
            timeframe: '30 phút'
        },
        followUpActions: [
            {
                action: 'Tăng budget',
                detail: 'Budget = CPP mục tiêu × 50 ÷ 7 (để đủ 50 conversion/tuần)',
                expectedResult: 'Exit learning phase',
                timeframe: '5-7 ngày'
            },
            {
                action: 'Đổi optimization event',
                detail: 'Optimize cho event phổ biến hơn (Add to Cart thay vì Purchase)',
                expectedResult: 'Dễ đạt 50 events/week hơn',
                timeframe: '3-5 ngày'
            }
        ],
        dontDo: [
            'KHÔNG tạo nhiều adsets với budget nhỏ',
            'KHÔNG thay đổi liên tục - reset learning mỗi lần'
        ],
        successMetric: 'Exit "Learning Limited" trong 7 ngày'
    }
};

/**
 * Xác định vấn đề của campaign dựa trên metrics
 */
export function detectIssues(metrics: {
    cpp: number;
    cppTarget: number;
    roas: number;
    ctr: number;
    ctrPrevious: number;
    frequency: number;
    cpm: number;
    cpmAverage: number;
    purchases: number;
    spend: number;
    isLearning: boolean;
}): CampaignIssue[] {
    const issues: CampaignIssue[] = [];

    // Check each condition
    if (metrics.spend > 500000 && metrics.purchases === 0) {
        issues.push('zero_results');
    }
    if (metrics.roas < 1 && metrics.spend > 1000000) {
        issues.push('low_roas');
    }
    if (metrics.cpp > metrics.cppTarget * 1.3) {
        issues.push('high_cpp');
    }
    if (metrics.ctr < metrics.ctrPrevious * 0.7) {
        issues.push('declining_ctr');
    }
    if (metrics.frequency > 3) {
        issues.push('high_frequency');
    }
    if (metrics.cpm > metrics.cpmAverage * 1.4) {
        issues.push('high_cpm');
    }
    if (metrics.isLearning && metrics.purchases < 7) { // 7 per day = 49 per week
        issues.push('learning_stuck');
    }

    return issues;
}

/**
 * Lấy playbook cho các issues
 */
export function getPlaybooks(issues: CampaignIssue[]): OptimizationPlaybook[] {
    return issues.map(issue => PLAYBOOKS[issue]);
}
