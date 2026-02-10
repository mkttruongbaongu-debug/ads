/**
 * ===================================================================
 * LOGIC TẠO ĐỀ XUẤT (PROPOSAL CREATION)
 * ===================================================================
 * Mô tả:
 * Core business logic để tạo đề xuất từ campaign data.
 * Orchestrate toàn bộ flow: AI analysis → Create proposal → Save to Sheets.
 * 
 * Flow:
 * 1. Nhận campaign data (metrics, history)
 * 2. Gọi hệ thống đa chuyên gia AI
 * 3. Nhận recommendations (action + priority)
 * 4. Build DeXuat object
 * 5. Lưu vào Google Sheet DE_XUAT
 * 6. Return proposal ID
 * 
 * Dependencies:
 * - he-thong-da-agent.ts: Multi-agent AI system
 * - de-xuat-sheet.ts: Google Sheets operations
 * - types.ts: Type definitions
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

import { v4 as uuidv4 } from 'uuid';
import { phanTich_DaChuyenGia, type DuLieuPhanTich } from '../ai/he-thong-da-agent';
import type { DeXuat, MucDoUuTien } from './types';

// ===================================================================
// TYPES
// ===================================================================

/**
 * Input để tạo đề xuất
 */
export interface TaoDeXuatInput {
    // User context
    userId: string;

    // Campaign info
    campaignId: string;
    tenCampaign: string;
    status: string;

    // Metrics
    metrics_HienTai: {
        cpp: number;
        roas: number;
        chiTieu: number;
        donHang: number;
        ctr: number;
        doanhThu: number;
    };

    // Historical data (optional)
    metrics_LichSu?: Array<{
        ngay: string;
        cpp: number;
        roas: number;
        chiTieu: number;
    }>;

    ctr_LichSu?: Array<{
        ngay: string;
        ctr: number;
    }>;

    // Context
    soNgay_DaChay?: number;
    ngan_sach_hien_tai?: number;
    muc_tieu?: {
        cpp_max?: number;
        roas_min?: number;
    };

    // Config
    openaiApiKey?: string;
}

/**
 * Output sau khi tạo đề xuất
 */
export interface TaoDeXuatOutput {
    success: boolean;
    data?: {
        deXuatId: string;
        uuTien: MucDoUuTien;
        tomTat: string;
        hanhDong: {
            loai: string;
            moTa: string;
        };
        // Debug: track if save to Google Sheets worked
        _saveStatus?: {
            saved: boolean;
            error?: string;
        };
    };
    error?: string;
}

// ===================================================================
// MAIN FUNCTION
// ===================================================================

/**
 * Tạo đề xuất mới cho campaign
 * 
 * @param input - Campaign data và context
 * @returns Promise<TaoDeXuatOutput>
 * 
 * @example
 * ```typescript
 * const ketQua = await taoDeXuat({
 *   userId: 'user-123',
 *   campaignId: 'camp-456',
 *   tenCampaign: 'Áo Hoodie Premium',
 *   status: 'ACTIVE',
 *   metrics_HienTai: {
 *     cpp: 145000,
 *     roas: 1.7,
 *     chiTieu: 3500000,
 *     donHang: 24,
 *     ctr: 1.2,
 *     doanhThu: 5950000
 *   },
 *   soNgay_DaChay: 12,
 *   ngan_sach_hien_tai: 500000
 * });
 * 
 * if (ketQua.success) {
 *   console.log('Đề xuất đã tạo:', ketQua.data.deXuatId);
 *   console.log('Priority:', ketQua.data.uuTien);
 * }
 * ```
 */
export async function taoDeXuat(
    input: TaoDeXuatInput
): Promise<TaoDeXuatOutput> {
    try {
        console.log(`[TAO_DE_XUAT] 🔍 Bắt đầu tạo đề xuất cho campaign: ${input.tenCampaign}`);

        // ===================================================================
        // STEP 1: Prepare data cho AI analysis
        // ===================================================================
        const duLieuPhanTich: DuLieuPhanTich = {
            campaignId: input.campaignId,
            tenCampaign: input.tenCampaign,
            status: input.status,
            metrics_HienTai: input.metrics_HienTai,
            metrics_LichSu: input.metrics_LichSu,
            ctr_LichSu: input.ctr_LichSu,
            soNgay_DaChay: input.soNgay_DaChay,
            ngan_sach_hien_tai: input.ngan_sach_hien_tai,
            muc_tieu: input.muc_tieu,
            openaiApiKey: input.openaiApiKey,
        };

        // ===================================================================
        // STEP 2: Gọi hệ thống đa chuyên gia AI
        // ===================================================================
        console.log('[TAO_DE_XUAT] 🤖 Gọi hệ thống AI đa chuyên gia...');

        const ketQuaAI = await phanTich_DaChuyenGia(duLieuPhanTich);

        console.log('[TAO_DE_XUAT] ✅ AI analysis hoàn thành');
        console.log(`[TAO_DE_XUAT] 🎯 Priority: ${ketQuaAI.mucDo_UuTien}`);
        console.log(`[TAO_DE_XUAT] ⚡ Action: ${ketQuaAI.hanhDong_DeXuat.loai}`);

        // ===================================================================
        // STEP 3: Build DeXuat object
        // ===================================================================
        const deXuatId = uuidv4();
        const thoiGianTao = new Date().toISOString();

        const deXuat: DeXuat = {
            id: deXuatId,
            thoiGian_Tao: thoiGianTao,

            // Campaign info
            campaignId: input.campaignId,
            tenCampaign: input.tenCampaign,

            // User
            userId: input.userId,

            // Priority
            uuTien: ketQuaAI.mucDo_UuTien,

            // AI Analysis (4 chuyên gia)
            phanTich_ChuyenGia: [
                ketQuaAI.phanTich_ChienLuoc,
                ketQuaAI.phanTich_HieuSuat,
                ketQuaAI.phanTich_NoiDung,
                ketQuaAI.phanTich_ThucThi,
            ],

            // Proposed Action
            hanhDong: ketQuaAI.hanhDong_DeXuat,

            // Metrics snapshot
            metrics_TruocKhi: {
                cpp: input.metrics_HienTai.cpp,
                roas: input.metrics_HienTai.roas,
                chiTieu: input.metrics_HienTai.chiTieu,
                donHang: input.metrics_HienTai.donHang,
                ctr: input.metrics_HienTai.ctr,
                doanhThu: input.metrics_HienTai.doanhThu,
            },

            // Initial state
            trangThai: 'CHO_DUYET',
        };

        // ===================================================================
        // STEP 4: Lưu vào Google Sheets via Apps Script
        // ===================================================================
        console.log('[TAO_DE_XUAT] 💾 Lưu đề xuất vào Google Sheets...');
        console.log('[TAO_DE_XUAT] 📋 Proposal data:', JSON.stringify(deXuat, null, 2));

        let saveStatus: { saved: boolean; error?: string } = { saved: false };

        try {
            const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
            console.log('[TAO_DE_XUAT] 🔗 Apps Script URL:', appsScriptUrl ? 'SET ✅' : 'NOT SET ❌');

            if (!appsScriptUrl) {
                console.warn('[TAO_DE_XUAT] ⚠️ Warning: GOOGLE_APPS_SCRIPT_URL not configured, skipping save');
                saveStatus = { saved: false, error: 'GOOGLE_APPS_SCRIPT_URL not configured' };
            } else {
                const fullUrl = `${appsScriptUrl}?action=ghiDeXuat`;
                const apiSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

                console.log('[TAO_DE_XUAT] 📤 Calling:', fullUrl);
                console.log('[TAO_DE_XUAT] 🔑 API Secret:', apiSecret ? 'SET ✅' : 'NOT SET ❌');
                console.log('[TAO_DE_XUAT] 📦 Request body:', JSON.stringify(deXuat, null, 2));

                const response = await fetch(fullUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...deXuat,  // Spread first
                        action: 'ghiDeXuat',  // Then action (won't be overwritten)
                        secret: apiSecret,    // Then secret
                    }),
                });

                console.log('[TAO_DE_XUAT] 📥 Response status:', response.status, response.statusText);

                const result = await response.json();
                console.log('[TAO_DE_XUAT] 📥 Response data:', JSON.stringify(result, null, 2));

                if (!result.success) {
                    console.error('[TAO_DE_XUAT] ❌ Lỗi khi lưu:', result.error);
                    saveStatus = { saved: false, error: result.error || 'Unknown error from Apps Script' };
                } else {
                    console.log('[TAO_DE_XUAT] ✅ Đã lưu đề xuất vào Sheets thành công');
                    saveStatus = { saved: true };
                }
            }
        } catch (saveError) {
            console.error('[TAO_DE_XUAT] ❌ Lỗi khi gọi Apps Script:', saveError);
            console.error('[TAO_DE_XUAT] ❌ Error details:', saveError instanceof Error ? saveError.message : saveError);
            saveStatus = { saved: false, error: saveError instanceof Error ? saveError.message : 'Network error' };
        }

        // ===================================================================
        // STEP 5: Return success response
        // ===================================================================
        const moTaHanhDong = taoMoTaHanhDong(ketQuaAI.hanhDong_DeXuat);

        return {
            success: true,
            data: {
                deXuatId: deXuatId,
                uuTien: ketQuaAI.mucDo_UuTien,
                tomTat: ketQuaAI.tomTat.khuyenNghi_TongThe,
                hanhDong: {
                    loai: ketQuaAI.hanhDong_DeXuat.loai,
                    moTa: moTaHanhDong,
                },
                // Include save status so client knows if DB save worked
                _saveStatus: saveStatus,
            },
        };
    } catch (error) {
        console.error('[TAO_DE_XUAT] ❌ Lỗi khi tạo đề xuất:', error);

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Lỗi không xác định',
        };
    }
}

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

/**
 * Tạo mô tả ngắn gọn cho hành động
 */
function taoMoTaHanhDong(hanhDong: any): string {
    const loai = hanhDong.loai;

    switch (loai) {
        case 'TAM_DUNG':
            return 'Tạm dừng campaign';

        case 'THAY_DOI_NGAN_SACH':
            const from = hanhDong.giaTri_HienTai;
            const to = hanhDong.giaTri_DeXuat;
            const percent = hanhDong.phanTram_ThayDoi || 0;
            return `Thay đổi budget: ${formatMoney(from)} → ${formatMoney(to)} (${percent > 0 ? '+' : ''}${percent}%)`;

        case 'LAM_MOI_CREATIVE':
            return 'Làm mới creative (phát hiện creative fatigue)';

        case 'DIEU_CHINH_DOI_TUONG':
            return 'Điều chỉnh targeting/audience';

        case 'DUNG_VINH_VIEN':
            return 'Dừng campaign hoàn toàn';

        default:
            return hanhDong.lyDo || 'Không có mô tả';
    }
}

/**
 * Format money
 */
function formatMoney(value: any): string {
    if (typeof value === 'number') {
        return value.toLocaleString('de-DE') + ' ₫';
    }
    return String(value);
}
