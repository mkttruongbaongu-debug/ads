/**
 * ===================================================================
 * GOOGLE SHEETS OPERATIONS - MẪU HỌC ĐƯỢC
 * ===================================================================
 * Mô tả:
 * Thao tác CRUD với Google Sheet "MAU_HOC_DUOC".
 * Lưu trữ các patterns (mẫu) được học từ các đề xuất thành công.
 * Dùng để cải thiện AI recommendations theo thời gian.
 * 
 * Sheet Structure:
 * - Sheet Name: "MAU_HOC_DUOC"
 * - Columns: 12 columns (A-L)
 * - Row 1: Headers
 * - Row 2+: Data (sorted by confidence DESC)
 * 
 * Functions:
 * - themMauHoc(): Thêm pattern mới
 * - layDanhSachMauHoc(): Lấy tất cả patterns
 * - layMauHocTheoUuTien(): Lấy patterns với high confidence
 * - capNhatThongKeMau(): Update stats khi pattern được apply
 * - timMauKhopVoi(): Tìm pattern phù hợp với campaign
 * 
 * Dependencies:
 * - googleapis: Google Sheets API client
 * - types.ts: Type definitions
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

import { google, sheets_v4 } from 'googleapis';
import type { MauHoc } from '../de-xuat/types';

// ===================================================================
// CONSTANTS
// ===================================================================

const SHEET_NAME = 'MAU_HOC_DUOC';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;

/**
 * Column mapping
 */
const COLUMNS = {
    mau_id: 0,                            // A
    ten_mau: 1,                           // B
    dieu_kien: 2,                         // C (JSON)
    hanh_dong_khuyen_nghi: 3,             // D (JSON)
    so_lan_ap_dung: 4,                    // E
    so_lan_thanh_cong: 5,                 // F
    ty_le_thanh_cong: 6,                  // G
    cpp_cai_thien_tb_percent: 7,          // H
    roas_cai_thien_tb_percent: 8,         // I
    do_tin_cay: 9,                        // J
    tu_de_xuat_id: 10,                    // K
    cap_nhat_lan_cuoi: 11,                // L
};

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    return google.sheets({ version: 'v4', auth: authClient as any });
}

/**
 * Chuyển MauHoc object → array row
 */
function mauHocToRow(mauHoc: MauHoc): any[] {
    const row = new Array(12).fill('');

    row[COLUMNS.mau_id] = mauHoc.id;
    row[COLUMNS.ten_mau] = mauHoc.tenMau;
    row[COLUMNS.dieu_kien] = JSON.stringify(mauHoc.dieuKien);
    row[COLUMNS.hanh_dong_khuyen_nghi] = JSON.stringify(mauHoc.hanhDong_KhuyenNghi);
    row[COLUMNS.so_lan_ap_dung] = mauHoc.soLan_ApDung;
    row[COLUMNS.so_lan_thanh_cong] = mauHoc.soLan_ThanhCong;
    row[COLUMNS.ty_le_thanh_cong] = mauHoc.tyLe_ThanhCong;
    row[COLUMNS.cpp_cai_thien_tb_percent] = mauHoc.cpp_CaiThien_TB_Percent;
    row[COLUMNS.roas_cai_thien_tb_percent] = mauHoc.roas_CaiThien_TB_Percent;
    row[COLUMNS.do_tin_cay] = mauHoc.doTinCay;
    row[COLUMNS.tu_de_xuat_id] = mauHoc.tuDeXuatId || '';
    row[COLUMNS.cap_nhat_lan_cuoi] = mauHoc.capNhat_LanCuoi;

    return row;
}

/**
 * Chuyển array row → MauHoc object
 */
function rowToMauHoc(row: any[]): MauHoc {
    let dieuKien: any = {};
    let hanhDongKhuyenNghi: any = {};

    try {
        dieuKien = JSON.parse(row[COLUMNS.dieu_kien] || '{}');
        hanhDongKhuyenNghi = JSON.parse(row[COLUMNS.hanh_dong_khuyen_nghi] || '{}');
    } catch (e) {
        console.error('Failed to parse JSON in MauHoc:', e);
    }

    const mauHoc: MauHoc = {
        id: row[COLUMNS.mau_id],
        tenMau: row[COLUMNS.ten_mau],
        dieuKien,
        hanhDong_KhuyenNghi: hanhDongKhuyenNghi,
        soLan_ApDung: parseInt(row[COLUMNS.so_lan_ap_dung]) || 0,
        soLan_ThanhCong: parseInt(row[COLUMNS.so_lan_thanh_cong]) || 0,
        tyLe_ThanhCong: parseFloat(row[COLUMNS.ty_le_thanh_cong]) || 0,
        cpp_CaiThien_TB_Percent: parseFloat(row[COLUMNS.cpp_cai_thien_tb_percent]) || 0,
        roas_CaiThien_TB_Percent: parseFloat(row[COLUMNS.roas_cai_thien_tb_percent]) || 0,
        doTinCay: parseFloat(row[COLUMNS.do_tin_cay]) || 0,
        tuDeXuatId: row[COLUMNS.tu_de_xuat_id] || undefined,
        capNhat_LanCuoi: row[COLUMNS.cap_nhat_lan_cuoi],
    };

    return mauHoc;
}

// ===================================================================
// PUBLIC FUNCTIONS
// ===================================================================

/**
 * Thêm pattern mới
 * 
 * @param mauHoc - Pattern data
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * await themMauHoc({
 *   id: 'pattern-123',
 *   tenMau: 'High CPP E-commerce',
 *   dieuKien: { cpp_NgưongTren: 120000, roas_NgưongDuoi: 2.0 },
 *   hanhDong_KhuyenNghi: { loai: 'THAY_DOI_NGAN_SACH', giaTri_DeXuat: -40 },
 *   ...
 * });
 * ```
 */
export async function themMauHoc(mauHoc: MauHoc): Promise<void> {
    const sheets = await getSheetsClient();
    const row = mauHocToRow(mauHoc);

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:L`,
        valueInputOption: 'RAW',
        requestBody: {
            values: [row],
        },
    });
}

/**
 * Lấy tất cả patterns
 * 
 * @param minDoTinCay - Lọc theo độ tin cậy tối thiểu (optional)
 * @returns Promise<MauHoc[]> - Sorted by confidence DESC
 * 
 * @example
 * ```typescript
 * // Lấy tất cả patterns
 * const all = await layDanhSachMauHoc();
 * 
 * // Chỉ lấy patterns có độ tin cậy >= 0.7
 * const highConfidence = await layDanhSachMauHoc(0.7);
 * ```
 */
export async function layDanhSachMauHoc(minDoTinCay?: number): Promise<MauHoc[]> {
    const sheets = await getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:L`,
    });

    const rows = response.data.values || [];
    let mauHocs = rows.map(rowToMauHoc);

    // Filter by confidence
    if (minDoTinCay !== undefined) {
        mauHocs = mauHocs.filter(m => m.doTinCay >= minDoTinCay);
    }

    // Sort by confidence DESC, then success rate DESC
    mauHocs.sort((a, b) => {
        if (a.doTinCay !== b.doTinCay) {
            return b.doTinCay - a.doTinCay;
        }
        return b.tyLe_ThanhCong - a.tyLe_ThanhCong;
    });

    return mauHocs;
}

/**
 * Lấy patterns theo ưu tiên (high confidence + high success rate)
 * Dùng để feed vào AI recommendations
 * 
 * @param top - Số lượng patterns (default: 5)
 * @returns Promise<MauHoc[]>
 */
export async function layMauHocTheoUuTien(top: number = 5): Promise<MauHoc[]> {
    const allPatterns = await layDanhSachMauHoc(0.6); // Min 60% confidence

    // Already sorted by confidence, just take top N
    return allPatterns.slice(0, top);
}

/**
 * Cập nhật thống kê khi pattern được apply
 * 
 * @param mauId - ID pattern
 * @param thanhCong - Có thành công không?
 * @param cppChange - % thay đổi CPP
 * @param roasChange - % thay đổi ROAS
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * // Pattern được apply và thành công
 * await capNhatThongKeMau('pattern-123', true, -22, 18);
 * // → CPP giảm 22%, ROAS tăng 18%
 * ```
 */
export async function capNhatThongKeMau(
    mauId: string,
    thanhCong: boolean,
    cppChange?: number,
    roasChange?: number
): Promise<void> {
    const sheets = await getSheetsClient();

    // Find row
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:A`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === mauId);

    if (rowIndex === -1) {
        throw new Error(`Không tìm thấy mẫu học với ID: ${mauId}`);
    }

    // Get current stats
    const fullRowResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A${rowIndex + 2}:L${rowIndex + 2}`,
    });

    const currentRow = fullRowResponse.data.values?.[0] || [];
    const currentMau = rowToMauHoc(currentRow);

    // Calculate new stats
    const newSoLanApDung = currentMau.soLan_ApDung + 1;
    const newSoLanThanhCong = currentMau.soLan_ThanhCong + (thanhCong ? 1 : 0);
    const newTyLeThanhCong = (newSoLanThanhCong / newSoLanApDung) * 100;

    // Update average improvements (moving average)
    let newCppCaiThien = currentMau.cpp_CaiThien_TB_Percent;
    let newRoasCaiThien = currentMau.roas_CaiThien_TB_Percent;

    if (cppChange !== undefined && roasChange !== undefined) {
        const n = newSoLanApDung;
        newCppCaiThien = ((currentMau.cpp_CaiThien_TB_Percent * (n - 1)) + cppChange) / n;
        newRoasCaiThien = ((currentMau.roas_CaiThien_TB_Percent * (n - 1)) + roasChange) / n;
    }

    // Calculate new confidence (based on success rate and sample size)
    // Formula: confidence = success_rate * min(1, sample_size / 20)
    // → Pattern cần ít nhất 20 samples để đạt full confidence
    const sampleSizeFactor = Math.min(1, newSoLanApDung / 20);
    const newDoTinCay = (newTyLeThanhCong / 100) * sampleSizeFactor;

    const actualRowNumber = rowIndex + 2;
    const capNhatLanCuoi = new Date().toISOString();

    // Batch update
    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            valueInputOption: 'RAW',
            data: [
                { range: `${SHEET_NAME}!E${actualRowNumber}`, values: [[newSoLanApDung]] },
                { range: `${SHEET_NAME}!F${actualRowNumber}`, values: [[newSoLanThanhCong]] },
                { range: `${SHEET_NAME}!G${actualRowNumber}`, values: [[Math.round(newTyLeThanhCong * 100) / 100]] },
                { range: `${SHEET_NAME}!H${actualRowNumber}`, values: [[Math.round(newCppCaiThien * 100) / 100]] },
                { range: `${SHEET_NAME}!I${actualRowNumber}`, values: [[Math.round(newRoasCaiThien * 100) / 100]] },
                { range: `${SHEET_NAME}!J${actualRowNumber}`, values: [[Math.round(newDoTinCay * 100) / 100]] },
                { range: `${SHEET_NAME}!L${actualRowNumber}`, values: [[capNhatLanCuoi]] },
            ],
        },
    });
}

/**
 * Tìm pattern khớp với campaign metrics
 * 
 * @param metrics - Campaign metrics hiện tại
 * @returns Promise<MauHoc[]> - Matching patterns sorted by confidence
 * 
 * @example
 * ```typescript
 * const matches = await timMauKhopVoi({
 *   cpp: 135000,
 *   roas: 1.8,
 *   chiTieu: 5000000,
 *   ...
 * });
 * // → Trả về các patterns có điều kiện match (VD: cpp > 120k && roas < 2.0)
 * ```
 */
export async function timMauKhopVoi(metrics: {
    cpp: number;
    roas: number;
    chiTieu: number;
    soNgayChay?: number;
}): Promise<MauHoc[]> {
    const allPatterns = await layDanhSachMauHoc(0.5); // Min 50% confidence

    const matches = allPatterns.filter(pattern => {
        const cond = pattern.dieuKien;

        // Check CPP threshold
        if (cond.cpp_NgưongTren !== undefined && metrics.cpp <= cond.cpp_NgưongTren) {
            return false;
        }

        // Check ROAS threshold
        if (cond.roas_NgưongDuoi !== undefined && metrics.roas >= cond.roas_NgưongDuoi) {
            return false;
        }

        // Check minimum days running
        if (cond.soNgay_ChayTu !== undefined && metrics.soNgayChay !== undefined) {
            if (metrics.soNgayChay < cond.soNgay_ChayTu) {
                return false;
            }
        }

        // All conditions matched
        return true;
    });

    return matches; // Already sorted by confidence
}
