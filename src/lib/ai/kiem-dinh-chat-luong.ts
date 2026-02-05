/**
 * ===================================================================
 * AI KIỂM ĐỊNH CHẤT LƯỢNG (QA AUDITOR)
 * ===================================================================
 * Vai trò:
 * Đánh giá kết quả SAU KHI thực thi hành động.
 * Phân tích before/after để xác định success/failure.
 * 
 * Nhiệm vụ:
 * - So sánh metrics before vs after
 * - Đánh giá: CAI_THIEN | TRUNG_TINH | XAU_DI
 * - Root cause analysis nếu failed
 * - Rút ra bài học (learning) để improve future recommendations
 * - Cập nhật confidence cho patterns
 * 
 * Input:
 * - Metrics before action
 * - Metrics after action (D+1, D+3, D+7)
 * - Action đã thực hiện
 * 
 * Output:
 * - Verdict: Success/Neutral/Failed
 * - % improvement/decline cho từng metric
 * - Root cause nếu failed
 * - Learning extracted
 * - Confidence score
 * 
 * Nguyên tắc:
 * - Objective: Chỉ dựa trên data
 * - Fair: Không bias
 * - Constructive: Học hỏi từ cả success lẫn failure
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

import OpenAI from 'openai';
import type { PhanTichChuyenGia, DanhGiaKetQua, MetricsTaiThoiDiem } from '../de-xuat/types';

// ===================================================================
// TYPES
// ===================================================================

interface DuLieuDanhGia {
    campaignId: string;
    tenCampaign: string;
    hanhDong_DaThucThi: {
        loai: string;
        moTa: string; // VD: "Giảm budget từ 500k → 300k (-40%)"
    };
    metrics_TruocKhi: MetricsTaiThoiDiem;
    metrics_SauKhi: MetricsTaiThoiDiem;
    checkpoint_Ngay: 1 | 3 | 7; // D+1, D+3, or D+7
}

interface KetQua_KiemDinh {
    danh_gia: DanhGiaKetQua;
    ty_le_thanh_cong: number; // 0-100
    phan_tich_metrics: {
        cpp: {
            truoc: number;
            sau: number;
            thay_doi_percent: number;
            danh_gia: string;
        };
        roas: {
            truoc: number;
            sau: number;
            thay_doi_percent: number;
            danh_gia: string;
        };
    };
    nguyen_nhan_goc?: string; // If failed, what went wrong?
    bai_hoc: string; // Learning extracted
    khuyen_nghi_tuong_lai: string;
    do_tin_cay: number;
}

// ===================================================================
// PROMPT TEMPLATE
// ===================================================================

function taoPrompt_KiemDinh(data: DuLieuDanhGia): string {
    const before = data.metrics_TruocKhi;
    const after = data.metrics_SauKhi;

    // Calculate changes
    const cppChange = ((after.cpp - before.cpp) / before.cpp) * 100;
    const roasChange = ((after.roas - before.roas) / before.roas) * 100;
    const chiTieuChange = ((after.chiTieu - before.chiTieu) / before.chiTieu) * 100;

    return `Bạn là Kiểm định viên Chất lượng (QA Auditor), đánh giá kết quả sau khi thực thi hành động.

CAMPAIGN: ${data.tenCampaign}

HÀNH ĐỘNG ĐÃ THỰC THI:
Loại: ${data.hanhDong_DaThucThi.loai}
Chi tiết: ${data.hanhDong_DaThucThi.moTa}

CHECKPOINT: D+${data.checkpoint_Ngay}

═══════════════════════════════════════════════════
SO SÁNH METRICS (BEFORE vs AFTER):
═══════════════════════════════════════════════════

CPP (Chi phí/đơn):
- Trước: ${before.cpp.toLocaleString()} VND
- Sau:  ${after.cpp.toLocaleString()} VND
- Thay đổi: ${cppChange > 0 ? '+' : ''}${cppChange.toFixed(1)}%

ROAS:
- Trước: ${before.roas.toFixed(2)}
- Sau:  ${after.roas.toFixed(2)}
- Thay đổi: ${roasChange > 0 ? '+' : ''}${roasChange.toFixed(1)}%

CHI TIÊU:
- Trước: ${before.chiTieu.toLocaleString()} VND
- Sau:  ${after.chiTieu.toLocaleString()} VND
- Thay đổi: ${chiTieuChange > 0 ? '+' : ''}${chiTieuChange.toFixed(1)}%

ĐƠN HÀNG:
- Trước: ${before.donHang}
- Sau:  ${after.donHang}

DOANH THU:
- Trước: ${before.doanhThu.toLocaleString()} VND
- Sau:  ${after.doanhThu.toLocaleString()} VND

═══════════════════════════════════════════════════
NHIỆM VỤ:
═══════════════════════════════════════════════════

Đánh giá kết quả hành động:

1. ĐÁNH GIÁ TỔNG THỂ:
   - CAI_THIEN: Metrics chính (CPP, ROAS) cải thiện đáng kể
   - TRUNG_TINH: Không thay đổi nhiều (< 10%)
   - XAU_DI: Metrics xấu đi

2. TỶ LỆ THÀNH CÔNG:
   - 0-100
   - Dựa trên: independent improvement của metrics quan trọng
   - 80-100: Rất thành công
   - 50-80: Thành công một phần
   - 0-50: Không thành công

3. PHÂN TÍCH METRICS:
   Cho CPP và ROAS:
   - Giá trị trước/sau
   - % thay đổi
   - Đánh giá (tốt/xấu)

4. NGUYÊN NHÂN GỐC (nếu XAU_DI):
   - Tại sao metrics xấu đi?
   - Do hành động sai? Hay external factors?
   - VD: "Giảm budget quá mạnh làm giảm reach, CTR sụt"

5. BÀI HỌC:
   - Rút ra learning để improve future recommendations
   - VD: "Budget cut 40% là phù hợp cho high CPP campaigns"
   - VD: "Nên test budget cut từ từ, không quá aggressive"

6. KHUYẾN NGHỊ TƯƠNG LAI:
   - Nên làm gì tiếp theo?
   - Continue monitor? Adjust further?

7. ĐỘ TIN CẬY:
   - Dựa trên:
     + Checkpoint day (D+7 > D+3 > D+1)
     + Data quality
     + Consistency

Quy tắc:
- OBJECTIVE: Chỉ dựa vào data, không bias
- FAIR: Thừa nhận cả success và failure
- CONSTRUCTIVE: Focus vào learning

Trả về JSON format:
{
  "danh_gia": "CAI_THIEN | TRUNG_TINH | XAU_DI",
  "ty_le_thanh_cong": 75,
  "phan_tich_metrics": {
    "cpp": {
      "truoc": ${before.cpp},
      "sau": ${after.cpp},
      "thay_doi_percent": ${cppChange.toFixed(2)},
      "danh_gia": "..."
    },
    "roas": {
      "truoc": ${before.roas},
      "sau": ${after.roas},
      "thay_doi_percent": ${roasChange.toFixed(2)},
      "danh_gia": "..."
    }
  },
  "nguyen_nhan_goc": "... (if XAU_DI)" hoặc null,
  "bai_hoc": "...",
  "khuyen_nghi_tuong_lai": "...",
  "do_tin_cay": 0.85
}`;
}

// ===================================================================
// MAIN FUNCTION
// ===================================================================

/**
 * Đánh giá kết quả sau khi thực thi hành động
 * 
 * @param data - Dữ liệu before/after
 * @param openaiApiKey - OpenAI API key (optional)
 * @returns Promise<{ phanTich: PhanTichChuyenGia, danhGia: DanhGiaKetQua, baiHoc: string }>
 * 
 * @example
 * ```typescript
 * const ketQua = await kiemDinh_KetQua({
 *   campaignId: '123',
 *   hanhDong_DaThucThi: { loai: 'THAY_DOI_NGAN_SACH', moTa: '...' },
 *   metrics_TruocKhi: { cpp: 150000, roas: 1.5, ... },
 *   metrics_SauKhi: { cpp: 110000, roas: 2.1, ... },
 *   checkpoint_Ngay: 3
 * });
 * 
 * if (ketQua.danhGia === 'CAI_THIEN') {
 *   console.log('Hành động thành công!');
 *   console.log('Bài học:', ketQua.baiHoc);
 * }
 * ```
 */
export async function kiemDinh_KetQua(
    data: DuLieuDanhGia,
    openaiApiKey?: string
): Promise<{
    phanTich: PhanTichChuyenGia;
    danhGia: DanhGiaKetQua;
    baiHoc: string;
    tyLeThanhCong: number;
}> {
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY không được cấu hình');
    }

    const openai = new OpenAI({ apiKey });

    try {
        const prompt = taoPrompt_KiemDinh(data);

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Bạn là QA Auditor chuyên đánh giá kết quả objectively. Bạn fair, constructive và focus vào learning.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.3, // Low for objective analysis
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        const ketQua: KetQua_KiemDinh = JSON.parse(responseText);

        // Build nhận định
        const nhanDinh = `D+${data.checkpoint_Ngay}: ${ketQua.danh_gia}. Success rate: ${ketQua.ty_le_thanh_cong}%. ${ketQua.bai_hoc}`;

        const phanTich: PhanTichChuyenGia = {
            tenChuyenGia: 'KIEM_DINH',
            nhanDinh,
            duLieuHoTro: {
                danhGia: ketQua.danh_gia,
                tyLeThanhCong: ketQua.ty_le_thanh_cong,
                phanTichMetrics: ketQua.phan_tich_metrics,
                nguyenNhanGoc: ketQua.nguyen_nhan_goc,
                baiHoc: ketQua.bai_hoc,
                khuyenNghiTuongLai: ketQua.khuyen_nghi_tuong_lai,
            },
            doTinCay: ketQua.do_tin_cay,
            thoiGian: new Date().toISOString(),
        };

        return {
            phanTich,
            danhGia: ketQua.danh_gia,
            baiHoc: ketQua.bai_hoc,
            tyLeThanhCong: ketQua.ty_le_thanh_cong,
        };
    } catch (error) {
        console.error('[KIEM_DINH] Lỗi khi phân tích:', error);

        return {
            phanTich: {
                tenChuyenGia: 'KIEM_DINH',
                nhanDinh: 'Không thể đánh giá do lỗi hệ thống.',
                duLieuHoTro: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
                doTinCay: 0,
                thoiGian: new Date().toISOString(),
            },
            danhGia: 'TRUNG_TINH',
            baiHoc: 'N/A',
            tyLeThanhCong: 0,
        };
    }
}
