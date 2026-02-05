/**
 * ===================================================================
 * AI CHUYÊN GIA: CHIẾN LƯỢC (STRATEGIST)
 * ===================================================================
 * Vai trò:
 * Nhìn nhận campaign từ góc độ chiến lược tổng thể và dài hạn.
 * Không sa đà vào metrics chi tiết ngắn hạn.
 * 
 * Nhiệm vụ:
 * - Phân tích xu hướng (trend) của campaign qua thời gian
 * - Đánh giá vị trí campaign trong portfolio tổng thể
 * - Nhận diện lifecycle stage (launch/growth/mature/decline)
 * - Đề xuất chiến lược tiếp theo (scale/optimize/pivot/stop)
 * - Tư vấn budget allocation strategy
 * 
 * Input:
 * - Campaign data (current metrics)
 * - Historical data (7-30 days trend)
 * - Account-level context (nếu có)
 * 
 * Output:
 * - Đánh giá xu hướng
 * - Phân loại lifecycle stage
 * - Khuyến nghị chiến lược
 * - Độ tin cậy (confidence score)
 * 
 * Nguyên tắc:
 * - Think long-term (ít nhất 7-14 ngày)
 * - Không react với biến động 1-2 ngày
 * - Focus vào sustainability, không chỉ short-term gains
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

import OpenAI from 'openai';
import type { PhanTichChuyenGia, HuongXuHuong } from '../de-xuat/types';

// ===================================================================
// TYPES
// ===================================================================

interface DuLieuCampaign {
    id: string;
    name: string;
    status: string;
    metrics_HienTai: {
        cpp: number;
        roas: number;
        chiTieu: number;
        donHang: number;
        ctr: number;
        doanhThu: number;
    };
    metrics_LichSu?: Array<{
        ngay: string;
        cpp: number;
        roas: number;
        chiTieu: number;
    }>;
    soNgay_DaChay?: number;
}

interface PhanTichChienLuoc {
    xuHuong: HuongXuHuong;
    giai_doan_vong_doi: 'KHOI_DONG' | 'TANG_TRUONG' | 'TRUONG_THANH' | 'SUY_THOAI';
    danh_gia_tong_quan: string;
    khuyen_nghi_chien_luoc: string;
    ly_do_chi_tiet: string;
    do_tin_cay: number;
}

// ===================================================================
// PROMPT TEMPLATE
// ===================================================================

function taoPrompt_ChienLuoc(campaign: DuLieuCampaign): string {
    const metrics = campaign.metrics_HienTai;
    const lichSu = campaign.metrics_LichSu || [];

    // Tính toán trend nếu có lịch sử
    let trendInfo = 'Không có dữ liệu lịch sử.';
    if (lichSu.length >= 3) {
        const dauTien = lichSu[0];
        const cuoiCung = lichSu[lichSu.length - 1];
        const cppChange = ((cuoiCung.cpp - dauTien.cpp) / dauTien.cpp) * 100;
        const roasChange = ((cuoiCung.roas - dauTien.roas) / dauTien.roas) * 100;

        trendInfo = `
Lịch sử ${lichSu.length} ngày:
- CPP: ${dauTien.cpp.toLocaleString()} → ${cuoiCung.cpp.toLocaleString()} (${cppChange > 0 ? '+' : ''}${cppChange.toFixed(1)}%)
- ROAS: ${dauTien.roas.toFixed(2)} → ${cuoiCung.roas.toFixed(2)} (${roasChange > 0 ? '+' : ''}${roasChange.toFixed(1)}%)
- Trend: ${lichSu.map(d => `${d.ngay}: CPP ${d.cpp.toLocaleString()}, ROAS ${d.roas.toFixed(2)}`).join('\n  ')}
`;
    }

    return `Bạn là Chuyên gia Chiến lược Marketing, phân tích campaign Facebook Ads từ góc độ dài hạn.

THỐNG TIN CAMPAIGN:
- Tên: ${campaign.name}
- Trạng thái: ${campaign.status}
- Số ngày đã chạy: ${campaign.soNgay_DaChay || 'N/A'}

METRICS HIỆN TẠI:
- CPP (Chi phí/đơn): ${metrics.cpp.toLocaleString()} VND
- ROAS: ${metrics.roas.toFixed(2)}
- Chi tiêu: ${metrics.chiTieu.toLocaleString()} VND
- Đơn hàng: ${metrics.donHang}
- CTR: ${metrics.ctr.toFixed(2)}%
- Doanh thu: ${metrics.doanhThu.toLocaleString()} VND

${trendInfo}

NHIỆM VỤ:
Phân tích từ góc độ CHIẾN LƯỢC:

1. XU HƯỚNG (TREND):
   - Campaign đang trong xu hướng nào? (TANG_TRUONG | ON_DINH | SUY_GIAM | DAO_DONG)
   - Dựa trên dữ liệu lịch sử và metrics hiện tại
   - Lưu ý: Tránh phản ứng với biến động ngắn hạn 1-2 ngày

2. GIAI ĐOẠN VÒNG ĐỜI:
   - KHOI_DONG: Campaign mới, đang learning, chưa ổn định
   - TANG_TRUONG: Metrics đang cải thiện, nên scale
   - TRUONG_THANH: Đã ổn định, performance tốt nhưng không còn tăng
   - SUY_THOAI: Metrics đang xấu đi, cần intervention

3. ĐÁNH GIÁ TỔNG QUAN:
   - Nhìn nhận campaign trong big picture
   - Sustainability: Campaign có bền vững không?
   - Có nên tiếp tục invest hay pivot?

4. KHUYẾN NGHỊ CHIẾN LƯỢC:
   - SCALE: Tăng budget để mở rộng
   - OPTIMIZE: Giữ nguyên budget, tối ưu creative/targeting
   - PIVOT: Thay đổi chiến lược (đổi sản phẩm, audience...)
   - STOP: Dừng campaign, reallocate budget

5. ĐỘ TIN CẬY:
   - Từ 0.0 đến 1.0
   - Phụ thuộc vào: độ dài lịch sử, tính nhất quán của data

Trả về JSON format:
{
  "xuHuong": "TANG_TRUONG | ON_DINH | SUY_GIAM | DAO_DONG",
  "giai_doan_vong_doi": "KHOI_DONG | TANG_TRUONG | TRUONG_THANH | SUY_THOAI",
  "danh_gia_tong_quan": "Nhận định ngắn gọn, rõ ràng (2-3 câu)",
  "khuyen_nghi_chien_luoc": "SCALE | OPTIMIZE | PIVOT | STOP với lý do ngắn",
  "ly_do_chi_tiet": "Giải thích chi tiết cho khuyến nghị (3-4 câu)",
  "do_tin_cay": 0.85
}`;
}

// ===================================================================
// MAIN FUNCTION
// ===================================================================

/**
 * Phân tích campaign từ góc độ chiến lược
 * 
 * @param campaign - Dữ liệu campaign cần phân tích
 * @param openaiApiKey - OpenAI API key (optional, sẽ lấy từ env nếu không truyền)
 * @returns Promise<PhanTichChuyenGia>
 * 
 * @example
 * ```typescript
 * const phanTich = await phanTich_ChienLuoc({
 *   id: '123',
 *   name: 'Campaign A',
 *   metrics_HienTai: { cpp: 120000, roas: 1.8, ... },
 *   metrics_LichSu: [...],
 *   soNgay_DaChay: 14
 * });
 * 
 * console.log(phanTich.nhanDinh);
 * // → "Campaign đang trong giai đoạn suy thoái, ROAS giảm 15% trong 7 ngày..."
 * ```
 */
export async function phanTich_ChienLuoc(
    campaign: DuLieuCampaign,
    openaiApiKey?: string
): Promise<PhanTichChuyenGia> {
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY không được cấu hình');
    }

    const openai = new OpenAI({ apiKey });

    try {
        const prompt = taoPrompt_ChienLuoc(campaign);

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Bạn là chuyên gia chiến lược marketing với 10+ năm kinh nghiệm quản lý Facebook Ads. Bạn luôn phân tích từ góc độ dài hạn và bền vững.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.3, // Low temperature for consistent analysis
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        const ketQua: PhanTichChienLuoc = JSON.parse(responseText);

        // Tạo nhận định tóm tắt
        const nhanDinh = `${ketQua.danh_gia_tong_quan} Khuyến nghị: ${ketQua.khuyen_nghi_chien_luoc}`;

        const phanTich: PhanTichChuyenGia = {
            tenChuyenGia: 'CHIEN_LUOC',
            nhanDinh,
            duLieuHoTro: {
                xuHuong: ketQua.xuHuong,
                giaiDoanVongDoi: ketQua.giai_doan_vong_doi,
                khuyenNghiChienLuoc: ketQua.khuyen_nghi_chien_luoc,
                lyDoChiTiet: ketQua.ly_do_chi_tiet,
            },
            doTinCay: ketQua.do_tin_cay,
            thoiGian: new Date().toISOString(),
        };

        return phanTich;
    } catch (error) {
        console.error('[CHIEN_LUOC] Lỗi khi phân tích:', error);

        // Fallback: Trả về phân tích cơ bản nếu AI failed
        return {
            tenChuyenGia: 'CHIEN_LUOC',
            nhanDinh: 'Không thể phân tích do lỗi hệ thống. Vui lòng thử lại.',
            duLieuHoTro: {
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            doTinCay: 0,
            thoiGian: new Date().toISOString(),
        };
    }
}
