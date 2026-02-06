/**
 * ===================================================================
 * AI QUẢN LÝ THỰC THI (EXECUTION MANAGER)
 * ===================================================================
 * Vai trò:
 * Tổng hợp insights từ 3 chuyên gia (Chiến lược, Hiệu suất, Nội dung).
 * Đưa ra HÀNH ĐỘNG CỤ THỂ, có thể execute được ngay.
 * 
 * Nhiệm vụ:
 * - Nhận inputs từ 3 chuyên gia khác
 * - Tổng hợp thành actionable recommendation
 * - Đưa ra HÀNH ĐỘNG CỤ THỂ (pause, budget change, etc)
 * - Prioritize actions (urgent vs nice-to-have)
 * - Estimate expected outcome
 * 
 * Input:
 * - Phân tích từ 3 chuyên gia trước
 * - Campaign data
 * 
 * Output:
 * - Loại hành động (TAM_DUNG, THAY_DOI_NGAN_SACH...)
 * - Chi tiết hành động (giá trị cũ → mới)
 * - Lý do rõ ràng
 * - Expected outcome
 * - Priority level
 * 
 * Nguyên tắc:
 * - ACTIONABLE: Phải là hành động có thể execute ngay
 * - SPECIFIC: Rõ ràng, cụ thể (không nói chung chung)
 * - SAFE: Không recommend actions quá rủi ro
 * - EXPLAIN: Luôn giải thích tại sao
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

import OpenAI from 'openai';
import type { PhanTichChuyenGia, ChiTietHanhDong, LoaiHanhDong, MucDoUuTien } from '../de-xuat/types';

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
    ngan_sach_hien_tai?: number;
}

interface KetQua_QuanLyThucThi {
    loai_hanh_dong: LoaiHanhDong;
    muc_do_uu_tien: MucDoUuTien;
    chi_tiet_hanh_dong: {
        gia_tri_hien_tai?: string | number;
        gia_tri_de_xuat: string | number;
        phan_tram_thay_doi?: number;
    };
    ly_do: string;
    cac_buoc: string[]; // Step-by-step execution instructions
    ket_qua_ky_vong: string;
    tom_tat_executive: string; // Summary for decision maker
    do_tin_cay: number;
}

// ===================================================================
// PROMPT TEMPLATE
// ===================================================================

function taoPrompt_ThucThi(
    campaign: DuLieuCampaign,
    phanTichChienLuoc: PhanTichChuyenGia,
    phanTichHieuSuat: PhanTichChuyenGia,
    phanTichNoiDung: PhanTichChuyenGia
): string {
    const m = campaign.metrics_HienTai;

    return `Bạn là Quản lý Thực thi (Execution Manager), tổng hợp insights và đưa ra HÀNH ĐỘNG CỤ THỂ.

CAMPAIGN: ${campaign.name}
Status: ${campaign.status}

METRICS HIỆN TẠI:
- CPP: ${m.cpp.toLocaleString()} VND
- ROAS: ${m.roas.toFixed(2)}
- Chi tiêu: ${m.chiTieu.toLocaleString()} VND
- Đơn hàng: ${m.donHang}
- CTR: ${m.ctr.toFixed(2)}%
- Doanh thu: ${m.doanhThu.toLocaleString()} VND
${campaign.ngan_sach_hien_tai ? `- Budget hiện tại: ${campaign.ngan_sach_hien_tai.toLocaleString()} VND/ngày` : ''}

═══════════════════════════════════════════════════
PHÂN TÍCH TỪ 3 CHUYÊN GIA:
═══════════════════════════════════════════════════

1. CHUYÊN GIA CHIẾN LƯỢC:
${phanTichChienLuoc.nhanDinh}

Chi tiết:
${JSON.stringify(phanTichChienLuoc.duLieuHoTro, null, 2)}

---

2. CHUYÊN GIA HIỆU SUẤT:
${phanTichHieuSuat.nhanDinh}

Chi tiết:
${JSON.stringify(phanTichHieuSuat.duLieuHoTro, null, 2)}

---

3. CHUYÊN GIA NỘI DUNG:
${phanTichNoiDung.nhanDinh}

Chi tiết:
${JSON.stringify(phanTichNoiDung.duLieuHoTro, null, 2)}

═══════════════════════════════════════════════════
NHIỆM VỤ CỦA BẠN:
═══════════════════════════════════════════════════

Tổng hợp 3 phân tích trên và đưa ra 1 HÀNH ĐỘNG CỤ THỂ duy nhất, quan trọng nhất.

1. LOẠI HÀNH ĐỘNG:
   Chọn 1 trong:
   - TAM_DUNG: Pause campaign tạm thời
   - THAY_DOI_NGAN_SACH: Tăng/giảm budget
   - LAM_MOI_CREATIVE: Đề xuất refresh creative
   - DIEU_CHINH_DOI_TUONG: Adjust targeting/audience
   - DUNG_VINH_VIEN: Stop campaign hoàn toàn

2. MỨC ĐỘ ƯU TIÊN:
   - NGUY_CAP: Phải làm NGAY (đang burn money, hoặc critical issue)
   - CAO: Làm trong 24h
   - TRUNG_BINH: Làm trong tuần
   - THAP: Nice to have

3. CHI TIẾT HÀNH ĐỘNG:
   gia_tri_hien_tai: Giá trị hiện tại (VD: budget 500k)
   gia_tri_de_xuat: Giá trị đề xuất (VD: 300k)
   phan_tram_thay_doi: % thay đổi (VD: -40)

4. LÝ DO:
   - Tại sao recommend hànhđộng này?
   - Dựa trên metrics CỤ THỂ, số liệu THỰC TẾ
   - VD: "CPP tăng 45% trong 3 ngày (82k → 119k), vượt ngưỡng cảnh báo 70%"
   - Rõ ràng, cụ thể (2-3 câu)

5. CÁC BƯỚC THỰC THI:
   - Danh sách các bước CỤ THỂ để execute hành động
   - Mỗi bước phải rõ ràng, actionable
   - ❌ KHÔNG NÓI: "Theo dõi trong X ngày" (system tự monitor)
   - ✅ VD: ["Giảm daily budget từ 500k → 300k", "Kiểm tra CPP sau 2 giờ", "Nếu CPP vẫn > 80k → Escalate to pause"]
   
6. KẾT QUẢ KỲ VỌNG:
   - Nếu làm theo hành động này, kết quả sẽ như thế nào?
   - VD: "CPP giảm 20-30%, ROAS cải thiện lên 2.2"

7. TÓM TẮT EXECUTIVE:
   - 1 câu ngắn gọn cho decision maker
   - VD: "Giảm 40% budget để kiểm soát CPP tăng cao"

8. ĐỘ TIN CẬY:
   - Average của 3 chuyên gia

Quy tắc quan trọng:
- ACTIONABLE: Hành động phải CỤ THỂ, có thể execute ngay qua Facebook API
- CONCRETE STEPS: Mỗi bước phải rõ ràng, có số liệu
- NO MONITORING TASKS: ❌ "Theo dõi daily" → System tự làm (D+1, D+3, D+7)
- SAFE: Không recommend actions quá extreme (VD: giảm > 70% budget)
- PRIORITIZE: Chọn action quan trọng NHẤT

Trả về JSON format:
{
  "loai_hanh_dong": "TAM_DUNG | THAY_DOI_NGAN_SACH | LAM_MOI_CREATIVE | DIEU_CHINH_DOI_TUONG | DUNG_VINH_VIEN",
  "muc_do_uu_tien": "NGUY_CAP | CAO | TRUNG_BINH | THAP",
  "chi_tiet_hanh_dong": {
    "gia_tri_hien_tai": "500000" hoặc "N/A",
    "gia_tri_de_xuat": "300000" hoặc "Refresh creative ngay",
    "phan_tram_thay_doi": -40
  },
  "ly_do": "CPP tăng 37% trong 3 ngày (65k → 89k). Giảm budget để kiểm soát chi phí trong khi làm mới creative.",
  "cac_buoc": [
    "Giảm daily budget từ 500k → 300k qua Facebook Ads Manager",
    "Kiểm tra CPP sau 2 giờ để verify thay đổi có effect",
    "Nếu CPP vẫn > 80k sau 3 ngày → Escalate to pause campaign"
  ],
  "ket_qua_ky_vong": "CPP giảm 15-25%, giảm risk của overspending while maintaining delivery",
  "tom_tat_executive": "Giảm 40% budget để kiểm soát CPP tăng cao (65k → 89k, +37%)",
  "do_tin_cay": 0.85
}`;
}

// ===================================================================
// MAIN FUNCTION
// ===================================================================

/**
 * Tổng hợp insights và đưa ra hành động cụ thể
 * 
 * @param campaign - Dữ liệu campaign
 * @param phanTichChienLuoc - Output từ Chuyên gia Chiến lược
 * @param phanTichHieuSuat - Output từ Chuyên gia Hiệu suất
 * @param phanTichNoiDung - Output từ Chuyên gia Nội dung
 * @param openaiApiKey - OpenAI API key (optional)
 * @returns Promise<{ phanTich: PhanTichChuyenGia, hanhDong: ChiTietHanhDong, uuTien: MucDoUuTien }>
 * 
 * @example
 * ```typescript
 * const ketQua = await quanLy_ThucThi(
 *   campaign,
 *   phanTichChienLuoc,
 *   phanTichHieuSuat,
 *   phanTichNoiDung
 * );
 * 
 * console.log(ketQua.hanhDong.loai); // → 'THAY_DOI_NGAN_SACH'
 * console.log(ketQua.uuTien); // → 'NGUY_CAP'
 * ```
 */
export async function quanLy_ThucThi(
    campaign: DuLieuCampaign,
    phanTichChienLuoc: PhanTichChuyenGia,
    phanTichHieuSuat: PhanTichChuyenGia,
    phanTichNoiDung: PhanTichChuyenGia,
    openaiApiKey?: string
): Promise<{
    phanTich: PhanTichChuyenGia;
    hanhDong: ChiTietHanhDong;
    uuTien: MucDoUuTien;
}> {
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY không được cấu hình');
    }

    const openai = new OpenAI({ apiKey });

    try {
        const prompt = taoPrompt_ThucThi(
            campaign,
            phanTichChienLuoc,
            phanTichHieuSuat,
            phanTichNoiDung
        );

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Bạn là Execution Manager có khả năng tổng hợp insights và đưa ra actionable recommendations. Bạn luôn specific, clear và practical.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.4, // Balanced between creativity and consistency
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        const ketQua: KetQua_QuanLyThucThi = JSON.parse(responseText);

        // Build ChiTietHanhDong
        const hanhDong: ChiTietHanhDong = {
            loai: ketQua.loai_hanh_dong,
            giaTri_HienTai: ketQua.chi_tiet_hanh_dong.gia_tri_hien_tai,
            giaTri_DeXuat: ketQua.chi_tiet_hanh_dong.gia_tri_de_xuat,
            phanTram_ThayDoi: ketQua.chi_tiet_hanh_dong.phan_tram_thay_doi,
            lyDo: ketQua.ly_do,
            cacBuoc: ketQua.cac_buoc || [],
            ketQua_KyVong: ketQua.ket_qua_ky_vong,
        };

        // Build PhanTichChuyenGia
        const phanTich: PhanTichChuyenGia = {
            tenChuyenGia: 'THUC_THI',
            nhanDinh: ketQua.tom_tat_executive,
            duLieuHoTro: {
                loaiHanhDong: ketQua.loai_hanh_dong,
                mucDoUuTien: ketQua.muc_do_uu_tien,
                chiTietHanhDong: ketQua.chi_tiet_hanh_dong,
                lyDo: ketQua.ly_do,
                ketQuaKyVong: ketQua.ket_qua_ky_vong,
            },
            doTinCay: ketQua.do_tin_cay,
            thoiGian: new Date().toISOString(),
        };

        return {
            phanTich,
            hanhDong,
            uuTien: ketQua.muc_do_uu_tien,
        };
    } catch (error) {
        console.error('[THUC_THI] Lỗi khi phân tích:', error);

        // Fallback action
        const fallbackAction: ChiTietHanhDong = {
            loai: 'TAM_DUNG',
            giaTri_DeXuat: 'N/A',
            lyDo: 'Không thể phân tích do lỗi hệ thống. Đề xuất pause để check manual.',
            cacBuoc: ['Pause campaign qua Facebook Ads Manager', 'Review chi tiết campaign metrics', 'Kiểm tra lại sau khi hệ thống ổn định'],
            ketQua_KyVong: 'N/A',
        };

        return {
            phanTich: {
                tenChuyenGia: 'THUC_THI',
                nhanDinh: 'Lỗi hệ thống, cần review manual.',
                duLieuHoTro: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
                doTinCay: 0,
                thoiGian: new Date().toISOString(),
            },
            hanhDong: fallbackAction,
            uuTien: 'CAO',
        };
    }
}
