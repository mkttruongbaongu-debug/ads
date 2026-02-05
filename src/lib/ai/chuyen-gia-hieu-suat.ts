/**
 * ===================================================================
 * AI CHUYÊN GIA: HIỆU SUẤT (PERFORMANCE ANALYST)
 * ===================================================================
 * Vai trò:
 * Deep dive vào metrics, phát hiện anomalies và performance issues.
 * Chuyên gia về số liệu, chỉ số và benchmark.
 * 
 * Nhiệm vụ:
 * - Phân tích chi tiết từng metrics (CPP, ROAS, CTR, CVR...)
 * - So sánh với industry benchmarks
 * - Phát hiện anomalies (spikes, drops, unusual patterns)
 * - Xác định root cause của performance issues
 * - Đánh giá efficiency (spend vs results)
 * 
 * Input:
 * - Campaign metrics (current + historical)
 * - Benchmarks (nếu có)
 * 
 * Output:
 * - Đánh giá từng metrics
 * - Red flags (nếu có)
 * - Comparison với targets
 * - Độ tin cậy
 * 
 * Nguyên tắc:
 * - Data-driven, không subjective
 * - Focus vào numbers, not opinions
 * - Identify specific metrics problems
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

import OpenAI from 'openai';
import type { PhanTichChuyenGia } from '../de-xuat/types';

// ===================================================================
// TYPES
// ===================================================================

interface MetricsData {
    cpp: number;
    roas: number;
    chiTieu: number;
    donHang: number;
    ctr: number;
    doanhThu: number;
    cvr?: number; // Conversion rate (nếu có)
}

interface DuLieuCampaign {
    id: string;
    name: string;
    metrics_HienTai: MetricsData;
    metrics_LichSu?: Array<{
        ngay: string;
        cpp: number;
        roas: number;
        chiTieu: number;
    }>;
    muc_tieu?: {
        cpp_max?: number;
        roas_min?: number;
    };
}

interface PhanTichHieuSuat {
    trang_thai_tong_quan: 'TOT' | 'TRUNG_BINH' | 'XAU' | 'NGUY_CAP';
    metrics_co_van_de: string[]; // ['CPP', 'ROAS', ...]
    phan_tich_chi_tiet: {
        cpp: string;
        roas: string;
        ctr: string;
        efficiency: string;
    };
    red_flags: string[]; // Danh sách cảnh báo
    khuyen_nghi_uu_tien: string;
    do_tin_cay: number;
}

// ===================================================================
// BENCHMARKS (E-commerce Vietnam 2026)
// ===================================================================

const BENCHMARKS = {
    cpp_excellent: 80000,    // < 80k: Excellent
    cpp_good: 100000,        // < 100k: Good
    cpp_acceptable: 150000,  // < 150k: Acceptable
    // > 150k: Poor

    roas_excellent: 3.0,     // > 3.0: Excellent
    roas_good: 2.0,          // > 2.0: Good
    roas_acceptable: 1.5,    // > 1.5: Acceptable
    // < 1.5: Poor

    ctr_good: 1.5,           // > 1.5%: Good
    ctr_acceptable: 1.0,     // > 1.0%: Acceptable
    // < 1.0%: Poor
};

// ===================================================================
// PROMPT TEMPLATE
// ===================================================================

function taoPrompt_HieuSuat(campaign: DuLieuCampaign): string {
    const m = campaign.metrics_HienTai;
    const target = campaign.muc_tieu || {};

    // Calculate derived metrics
    const aov = m.donHang > 0 ? m.doanhThu / m.donHang : 0;
    const cvr = m.ctr > 0 && m.donHang > 0 ? (m.donHang / (m.chiTieu / (m.cpp || 1))) * 100 : 0;

    return `Bạn là Chuyên gia Phân tích Hiệu suất (Performance Analyst), chuyên deep dive vào metrics.

CAMPAIGN: ${campaign.name}

METRICS HIỆN TẠI:
1. CPP (Chi phí/đơn): ${m.cpp.toLocaleString()} VND
   - Mục tiêu: ${target.cpp_max ? `< ${target.cpp_max.toLocaleString()}` : 'N/A'}
   - Benchmark Excellent: < 80,000 VND
   - Benchmark Good: < 100,000 VND
   - Benchmark Acceptable: < 150,000 VND

2. ROAS (Return on Ad Spend): ${m.roas.toFixed(2)}
   - Mục tiêu: ${target.roas_min ? `> ${target.roas_min.toFixed(2)}` : 'N/A'}
   - Benchmark Excellent: > 3.0
   - Benchmark Good: > 2.0
   - Benchmark Acceptable: > 1.5

3. CTR (Click-Through Rate): ${m.ctr.toFixed(2)}%
   - Benchmark Good: > 1.5%
   - Benchmark Acceptable: > 1.0%

4. CHI TIÊU: ${m.chiTieu.toLocaleString()} VND
5. ĐƠN HÀNG: ${m.donHang}
6. DOANH THU: ${m.doanhThu.toLocaleString()} VND
7. AOV (Average Order Value): ${aov.toLocaleString()} VND
8. CVR (Conversion Rate - ước tính): ${cvr.toFixed(2)}%

NHIỆM VỤ:
Phân tích HIỆU SUẤT chi tiết:

1. TRANG THÁI TỔNG QUAN:
   - TOT: Tất cả metrics đều trong ngưỡng Good+
   - TRUNG_BINH: Một số metrics Acceptable
   - XAU: Nhiều metrics dưới Acceptable
   - NGUY_CAP: Metrics Critical (CPP > 150k hoặc ROAS < 1.5)

2. METRICS CÓ VẤN ĐỀ:
   - Liệt kê các metrics KHÔNG ĐẠT mục tiêu/benchmark
   - Ví dụ: ["CPP", "ROAS", "CTR"]

3. PHÂN TÍCH CHI TIẾT:
   cpp: "Đánh giá CPP so với benchmark và target"
   roas: "Đánh giá ROAS, có lời không?"
   ctr: "CTR có đủ tốt? Ảnh hưởng thế nào?"
   efficiency: "Tổng thể efficiency campaign ra sao?"

4. RED FLAGS (Cảnh báo):
   - Các vấn đề NGUY HIỂM cần attention ngay
   - VD: "CPP quá cao 150k, đang burn money"
   - VD: "ROAS < 1.5, đang lỗ"
   - VD: "CTR quá thấp, creative không hấp dẫn"

5. KHUYẾN NGHỊ ƯU TIÊN:
   - Action ngay lập tức để fix performance issue
   - Focus vào metrics quan trọng nhất

6. ĐỘ TIN CẬY:
   - 0.0 - 1.0 (dựa vào độ rõ ràng của data)

Trả về JSON format:
{
  "trang_thai_tong_quan": "TOT | TRUNG_BINH | XAU | NGUY_CAP",
  "metrics_co_van_de": ["CPP", "ROAS"],
  "phan_tich_chi_tiet": {
    "cpp": "...",
    "roas": "...",
    "ctr": "...",
    "efficiency": "..."
  },
  "red_flags": ["...", "..."],
  "khuyen_nghi_uu_tien": "...",
  "do_tin_cay": 0.9
}`;
}

// ===================================================================
// MAIN FUNCTION
// ===================================================================

/**
 * Phân tích hiệu suất campaign (metrics deep dive)
 * 
 * @param campaign - Dữ liệu campaign
 * @param openaiApiKey - OpenAI API key (optional)
 * @returns Promise<PhanTichChuyenGia>
 * 
 * @example
 * ```typescript
 * const phanTich = await phanTich_HieuSuat({
 *   id: '123',
 *   name: 'Campaign A',
 *   metrics_HienTai: { cpp: 145000, roas: 1.6, ... },
 *   muc_tieu: { cpp_max: 100000, roas_min: 2.0 }
 * });
 * 
 * console.log(phanTich.duLieuHoTro.red_flags);
 * // → ["CPP vượt mục tiêu 45%", "ROAS dưới target"]
 * ```
 */
export async function phanTich_HieuSuat(
    campaign: DuLieuCampaign,
    openaiApiKey?: string
): Promise<PhanTichChuyenGia> {
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY không được cấu hình');
    }

    const openai = new OpenAI({ apiKey });

    try {
        const prompt = taoPrompt_HieuSuat(campaign);

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Bạn là Performance Analyst chuyên sâu về metrics và data analysis. Bạn chỉ dựa vào số liệu cụ thể, không đoán mò.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.2, // Very low for precise analysis
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        const ketQua: PhanTichHieuSuat = JSON.parse(responseText);

        // Tạo nhận định tóm tắt
        const nhanDinh = `Trạng thái: ${ketQua.trang_thai_tong_quan}. ${ketQua.metrics_co_van_de.length > 0
            ? `Metrics cần chú ý: ${ketQua.metrics_co_van_de.join(', ')}.`
            : 'Tất cả metrics đều tốt.'}`;

        const phanTich: PhanTichChuyenGia = {
            tenChuyenGia: 'HIEU_SUAT',
            nhanDinh,
            duLieuHoTro: {
                trangThaiTongQuan: ketQua.trang_thai_tong_quan,
                metricsCoVanDe: ketQua.metrics_co_van_de,
                phanTichChiTiet: ketQua.phan_tich_chi_tiet,
                redFlags: ketQua.red_flags,
                khuyenNghiUuTien: ketQua.khuyen_nghi_uu_tien,
            },
            doTinCay: ketQua.do_tin_cay,
            thoiGian: new Date().toISOString(),
        };

        return phanTich;
    } catch (error) {
        console.error('[HIEU_SUAT] Lỗi khi phân tích:', error);

        return {
            tenChuyenGia: 'HIEU_SUAT',
            nhanDinh: 'Không thể phân tích do lỗi hệ thống.',
            duLieuHoTro: {
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            doTinCay: 0,
            thoiGian: new Date().toISOString(),
        };
    }
}
