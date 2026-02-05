/**
 * ===================================================================
 * AI CHUYÊN GIA: NỘI DUNG (CREATIVE ANALYST)
 * ===================================================================
 * Vai trò:
 * Đánh giá hiệu quả của ad creative (hình ảnh, video, copy).
 * Chuyên gia về engagement và creative performance.
 * 
 * Nhiệm vụ:
 * - Phân tích CTR (proxy cho creative effectiveness)
 * - Đánh giá engagement patterns
 * - So sánh creative performance nếu có nhiều ads
 * - Phát hiện creative fatigue (CTR declining over time)
 * - Đề xuất creative refresh strategy
 * 
 * Input:
 * - Campaign metrics (focus on CTR, engagement)
 * - Ad-level data nếu có (multiple ads comparison)
 * - Historical CTR trend
 * 
 * Output:
 * - Đánh giá creative effectiveness
 * - Phát hiện fatigue signals
 * - Khuyến nghị refresh
 * - Độ tin cậy
 * 
 * Nguyên tắc:
 * - CTR là KPI chính để đánh giá creative
 * - Creative fatigue thường xuất hiện sau 7-14 ngày
 * - Fresh creative = better performance
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

interface DuLieuCampaign {
    id: string;
    name: string;
    metrics_HienTai: {
        ctr: number;
        donHang: number;
        chiTieu: number;
    };
    ctr_LichSu?: Array<{
        ngay: string;
        ctr: number;
    }>;
    soNgay_DaChay?: number;
    soLuong_Ads?: number; // Number of ads in campaign
}

interface PhanTichNoiDung {
    danh_gia_creative: 'TUYET_VOI' | 'TOT' | 'TRUNG_BINH' | 'YEU';
    co_dau_hieu_fatigue: boolean;
    ctr_trend: 'TANG' | 'ON_DINH' | 'GIAM';
    phan_tich_chi_tiet: string;
    khuyen_nghi_creative: string;
    muc_do_uu_tien_refresh: 'CAO' | 'TRUNG_BINH' | 'THAP' | 'KHONG_CAN';
    do_tin_cay: number;
}

// ===================================================================
// PROMPT TEMPLATE
// ===================================================================

function taoPrompt_NoiDung(campaign: DuLieuCampaign): string {
    const ctr = campaign.metrics_HienTai.ctr;
    const ctrHistory = campaign.ctr_LichSu || [];
    const soNgay = campaign.soNgay_DaChay || 0;

    // Calculate CTR trend
    let ctrTrendInfo = 'Không có dữ liệu lịch sử CTR.';
    if (ctrHistory.length >= 3) {
        const first = ctrHistory[0].ctr;
        const last = ctrHistory[ctrHistory.length - 1].ctr;
        const change = ((last - first) / first) * 100;

        ctrTrendInfo = `
Lịch sử CTR (${ctrHistory.length} ngày):
- Ban đầu: ${first.toFixed(2)}%
- Hiện tại: ${last.toFixed(2)}%
- Thay đổi: ${change > 0 ? '+' : ''}${change.toFixed(1)}%
- Trend: ${ctrHistory.map(d => `${d.ngay}: ${d.ctr.toFixed(2)}%`).join('\n  ')}
`;
    }

    return `Bạn là Chuyên gia Nội dung Quảng cáo (Creative Analyst), đánh giá hiệu quả creative.

CAMPAIGN: ${campaign.name}

THỐNG TIN CREATIVE:
- CTR hiện tại: ${ctr.toFixed(2)}%
- Số ngày đã chạy: ${soNgay}
- Số lượng ads: ${campaign.soLuong_Ads || 'N/A'}

${ctrTrendInfo}

BENCHMARKS CTR (E-commerce Vietnam):
- Xuất sắc: > 2.0%
- Tốt: > 1.5%
- Trung bình: > 1.0%
- Yếu: < 1.0%

CREATIVE FATIGUE SIGNALS:
- CTR giảm > 20% trong 7 ngày → Strong signal
- CTR giảm > 30% trong 14 ngày → Very strong
- Campaign chạy > 14 ngày với same creative → Risk cao
- Campaign chạy > 21 ngày → Very high risk

NHIỆM VỤ:
Phân tích CREATIVE PERFORMANCE:

1. ĐÁNH GIÁ CREATIVE:
   - TUYET_VOI: CTR > 2.0%, engagement cao
   - TOT: CTR 1.5-2.0%, stable
   - TRUNG_BINH: CTR 1.0-1.5%, acceptable
   - YEU: CTR < 1.0%, cần action

2. DẤU HIỆU FATIGUE:
   - Có hay không? (true/false)
   - Dựa vào: CTR trend + số ngày chạy
   - Creative fatigue = audience đã "ngán" creative

3. CTR TREND:
   - TANG: CTR đang tăng (creative còn fresh)
   - ON_DINH: CTR stable (OK nhưng cần monitor)
   - GIAM: CTR đang giảm (fatigue risk)

4. PHÂN TÍCH CHI TIẾT:
   - Giải thích creative performance
   - Tại sao CTR như vậy?
   - Có signals nào đáng chú ý?

5. KHUYẾN NGHỊ CREATIVE:
   - Nên làm gì với creative?
   - Refresh? Test new? Keep running?

6. MỨC ĐỘ ƯU TIÊN REFRESH:
   - CAO: Cần refresh ngay (fatigue rõ ràng)
   - TRUNG_BINH: Nên prepare creative mới
   - THAP: Có thể refresh để optimize
   - KHONG_CAN: Creative vẫn tốt

7. ĐỘ TIN CẬY:
   - Dựa vào data availability

Trả về JSON format:
{
  "danh_gia_creative": "TUYET_VOI | TOT | TRUNG_BINH | YEU",
  "co_dau_hieu_fatigue": true/false,
  "ctr_trend": "TANG | ON_DINH | GIAM",
  "phan_tich_chi_tiet": "...",
  "khuyen_nghi_creative": "...",
  "muc_do_uu_tien_refresh": "CAO | TRUNG_BINH | THAP | KHONG_CAN",
  "do_tin_cay": 0.85
}`;
}

// ===================================================================
// MAIN FUNCTION
// ===================================================================

/**
 * Phân tích creative effectiveness
 * 
 * @param campaign - Dữ liệu campaign
 * @param openaiApiKey - OpenAI API key (optional)
 * @returns Promise<PhanTichChuyenGia>
 * 
 * @example
 * ```typescript
 * const phanTich = await phanTich_NoiDung({
 *   id: '123',
 *   name: 'Campaign A',
 *   metrics_HienTai: { ctr: 0.8, ... },
 *   ctr_LichSu: [...],
 *   soNgay_DaChay: 18
 * });
 * 
 * if (phanTich.duLieuHoTro.coDauHieuFatigue) {
 *   console.log('Cần refresh creative ngay!');
 * }
 * ```
 */
export async function phanTich_NoiDung(
    campaign: DuLieuCampaign,
    openaiApiKey?: string
): Promise<PhanTichChuyenGia> {
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY không được cấu hình');
    }

    const openai = new OpenAI({ apiKey });

    try {
        const prompt = taoPrompt_NoiDung(campaign);

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Bạn là Creative Analyst chuyên đánh giá hiệu quả nội dung quảng cáo. Bạn hiểu rõ creative fatigue và best practices.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        const ketQua: PhanTichNoiDung = JSON.parse(responseText);

        // Tạo nhận định tóm tắt
        const fatigueWarning = ketQua.co_dau_hieu_fatigue ? ' ⚠️ Phát hiện creative fatigue!' : '';
        const nhanDinh = `Creative: ${ketQua.danh_gia_creative}. CTR trend: ${ketQua.ctr_trend}.${fatigueWarning}`;

        const phanTich: PhanTichChuyenGia = {
            tenChuyenGia: 'NOI_DUNG',
            nhanDinh,
            duLieuHoTro: {
                danhGiaCreative: ketQua.danh_gia_creative,
                coDauHieuFatigue: ketQua.co_dau_hieu_fatigue,
                ctrTrend: ketQua.ctr_trend,
                phanTichChiTiet: ketQua.phan_tich_chi_tiet,
                khuyenNghiCreative: ketQua.khuyen_nghi_creative,
                mucDoUuTienRefresh: ketQua.muc_do_uu_tien_refresh,
            },
            doTinCay: ketQua.do_tin_cay,
            thoiGian: new Date().toISOString(),
        };

        return phanTich;
    } catch (error) {
        console.error('[NOI_DUNG] Lỗi khi phân tích:', error);

        return {
            tenChuyenGia: 'NOI_DUNG',
            nhanDinh: 'Không thể phân tích do lỗi hệ thống.',
            duLieuHoTro: {
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            doTinCay: 0,
            thoiGian: new Date().toISOString(),
        };
    }
}
