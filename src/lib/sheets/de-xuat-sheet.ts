/**
 * ===================================================================
 * GOOGLE SHEETS OPERATIONS - ĐỀ XUẤT
 * ===================================================================
 * Mô tả:
 * Thao tác CRUD với Google Sheet "DE_XUAT".
 * Chứa tất cả đề xuất từ AI system, theo dõi workflow từ tạo → duyệt → thực thi.
 * 
 * Sheet Structure:
 * - Sheet Name: "DE_XUAT"
 * - Columns: 21 columns (A-U)
 * - Row 1: Headers
 * - Row 2+: Data (sorted by timestamp DESC)
 * 
 * Functions:
 * - themDeXuat(): Thêm đề xuất mới
 * - layDanhSachDeXuat(): Lấy danh sách (có filter)
 * - layDeXuatTheoId(): Lấy 1 đề xuất by ID
 * - capNhatTrangThai(): Update workflow state
 * - capNhatThongTinDuyet(): Update approval info
 * - capNhatThongTinThucThi(): Update execution info
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
import type {
    DeXuat,
    TrangThaiDeXuat,
    MucDoUuTien,
    DeXuatFilter,
} from '../de-xuat/types';

// ===================================================================
// CONSTANTS
// ===================================================================

const SHEET_NAME = 'DE_XUAT';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;

/**
 * Column mapping (0-indexed for arrays, but 1-indexed for A1 notation)
 */
const COLUMNS = {
    de_xuat_id: 0,           // A
    thoi_gian_tao: 1,        // B
    campaign_id: 2,          // C
    ten_campaign: 3,         // D
    user_id: 4,              // E
    uu_tien: 5,              // F
    loai_hanh_dong: 6,       // G
    trang_thai: 7,           // H
    tom_tat_hanh_dong: 8,    // I
    gia_tri_hien_tai: 9,     // J
    gia_tri_de_xuat: 10,     // K
    cpp_truoc: 11,           // L
    roas_truoc: 12,          // M
    chi_tieu_truoc: 13,      // N
    phan_tich_ai: 14,        // O (JSON string)
    nguoi_duyet: 15,         // P
    thoi_gian_duyet: 16,     // Q
    thoi_gian_thuc_thi: 17,  // R
    giam_sat_den_ngay: 18,   // S
    ket_qua_cuoi_cung: 19,   // T
    ghi_chu_nguoi_dung: 20,  // U
};

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

/**
 * Lấy Sheets API client
 */
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
 * Chuyển DeXuat object → array row values
 */
function deXuatToRow(deXuat: DeXuat): any[] {
    const row = new Array(21).fill('');

    row[COLUMNS.de_xuat_id] = deXuat.id;
    row[COLUMNS.thoi_gian_tao] = deXuat.thoiGian_Tao;
    row[COLUMNS.campaign_id] = deXuat.campaignId;
    row[COLUMNS.ten_campaign] = deXuat.tenCampaign;
    row[COLUMNS.user_id] = deXuat.userId;
    row[COLUMNS.uu_tien] = deXuat.uuTien;
    row[COLUMNS.loai_hanh_dong] = deXuat.hanhDong.loai;
    row[COLUMNS.trang_thai] = deXuat.trangThai;

    // Action summary
    row[COLUMNS.tom_tat_hanh_dong] = `${deXuat.hanhDong.loai}: ${deXuat.hanhDong.lyDo}`;
    row[COLUMNS.gia_tri_hien_tai] = deXuat.hanhDong.giaTri_HienTai || '';
    row[COLUMNS.gia_tri_de_xuat] = deXuat.hanhDong.giaTri_DeXuat;

    // Metrics snapshot
    row[COLUMNS.cpp_truoc] = deXuat.metrics_TruocKhi.cpp;
    row[COLUMNS.roas_truoc] = deXuat.metrics_TruocKhi.roas;
    row[COLUMNS.chi_tieu_truoc] = deXuat.metrics_TruocKhi.chiTieu;

    // AI analysis (JSON stringified)
    row[COLUMNS.phan_tich_ai] = JSON.stringify({
        cacChuyenGia: deXuat.phanTich_ChuyenGia,
        hanhDong: deXuat.hanhDong,
    });

    // Approval info
    row[COLUMNS.nguoi_duyet] = deXuat.nguoiDuyet || '';
    row[COLUMNS.thoi_gian_duyet] = deXuat.thoiGian_Duyet || '';

    // Execution info
    row[COLUMNS.thoi_gian_thuc_thi] = deXuat.thoiGian_ThucThi || '';

    // Monitoring info
    row[COLUMNS.giam_sat_den_ngay] = deXuat.giamSat_DenNgay || '';
    row[COLUMNS.ket_qua_cuoi_cung] = deXuat.ketQua_CuoiCung || '';

    // User note
    row[COLUMNS.ghi_chu_nguoi_dung] = deXuat.ghiChu_NguoiDung || '';

    return row;
}

/**
 * Chuyển array row values → DeXuat object
 */
function rowToDeXuat(row: any[]): DeXuat {
    // Parse JSON fields
    let phanTichData: any = {};
    try {
        phanTichData = JSON.parse(row[COLUMNS.phan_tich_ai] || '{}');
    } catch (e) {
        console.error('Failed to parse phan_tich_ai JSON:', e);
    }

    const deXuat: DeXuat = {
        id: row[COLUMNS.de_xuat_id],
        thoiGian_Tao: row[COLUMNS.thoi_gian_tao],
        campaignId: row[COLUMNS.campaign_id],
        tenCampaign: row[COLUMNS.ten_campaign],
        userId: row[COLUMNS.user_id],
        uuTien: row[COLUMNS.uu_tien] as MucDoUuTien,
        hanhDong: phanTichData.hanhDong || {
            loai: row[COLUMNS.loai_hanh_dong],
            giaTri_HienTai: row[COLUMNS.gia_tri_hien_tai] || undefined,
            giaTri_DeXuat: row[COLUMNS.gia_tri_de_xuat],
            lyDo: '',
            ketQua_KyVong: '',
        },
        phanTich_ChuyenGia: phanTichData.cacChuyenGia || [],
        metrics_TruocKhi: {
            cpp: parseFloat(row[COLUMNS.cpp_truoc]) || 0,
            roas: parseFloat(row[COLUMNS.roas_truoc]) || 0,
            chiTieu: parseFloat(row[COLUMNS.chi_tieu_truoc]) || 0,
            donHang: 0, // Not stored in sheet, derive if needed
            ctr: 0,
            doanhThu: 0,
        },
        trangThai: row[COLUMNS.trang_thai] as TrangThaiDeXuat,
        nguoiDuyet: row[COLUMNS.nguoi_duyet] || undefined,
        thoiGian_Duyet: row[COLUMNS.thoi_gian_duyet] || undefined,
        thoiGian_ThucThi: row[COLUMNS.thoi_gian_thuc_thi] || undefined,
        giamSat_DenNgay: row[COLUMNS.giam_sat_den_ngay] || undefined,
        ketQua_CuoiCung: row[COLUMNS.ket_qua_cuoi_cung] || undefined,
        ghiChu_NguoiDung: row[COLUMNS.ghi_chu_nguoi_dung] || undefined,
    };

    return deXuat;
}

// ===================================================================
// PUBLIC FUNCTIONS
// ===================================================================

/**
 * Thêm đề xuất mới vào Sheet
 * 
 * @param deXuat - Đề xuất cần thêm
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * await themDeXuat({
 *   id: 'uuid-123',
 *   thoiGian_Tao: new Date().toISOString(),
 *   campaignId: '123456',
 *   tenCampaign: 'Campaign A',
 *   ...
 * });
 * ```
 */
export async function themDeXuat(deXuat: DeXuat): Promise<void> {
    const sheets = await getSheetsClient();
    const row = deXuatToRow(deXuat);

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:U`,
        valueInputOption: 'RAW',
        requestBody: {
            values: [row],
        },
    });
}

/**
 * Lấy danh sách đề xuất (có filter)
 * 
 * @param filter - Điều kiện lọc (optional)
 * @returns Promise<DeXuat[]>
 * 
 * @example
 * ```typescript
 * // Lấy tất cả đề xuất chờ duyệt
 * const pending = await layDanhSachDeXuat({ trangThai: 'CHO_DUYET' });
 * 
 * // Lấy đề xuất critical của user
 * const critical = await layDanhSachDeXuat({ 
 *   uuTien: 'NGUY_CAP',
 *   userId: 'user-123' 
 * });
 * ```
 */
export async function layDanhSachDeXuat(filter?: DeXuatFilter): Promise<DeXuat[]> {
    const sheets = await getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:U`, // Skip header row
    });

    const rows = response.data.values || [];
    let deXuats = rows.map(rowToDeXuat);

    // Apply filters
    if (filter) {
        if (filter.trangThai) {
            const states = Array.isArray(filter.trangThai) ? filter.trangThai : [filter.trangThai];
            deXuats = deXuats.filter(d => states.includes(d.trangThai));
        }

        if (filter.uuTien) {
            const priorities = Array.isArray(filter.uuTien) ? filter.uuTien : [filter.uuTien];
            deXuats = deXuats.filter(d => priorities.includes(d.uuTien));
        }

        if (filter.campaignId) {
            deXuats = deXuats.filter(d => d.campaignId === filter.campaignId);
        }

        if (filter.userId) {
            deXuats = deXuats.filter(d => d.userId === filter.userId);
        }

        if (filter.tuNgay) {
            deXuats = deXuats.filter(d => d.thoiGian_Tao >= filter.tuNgay!);
        }

        if (filter.denNgay) {
            deXuats = deXuats.filter(d => d.thoiGian_Tao <= filter.denNgay!);
        }
    }

    // Sort by priority then timestamp (newest first)
    const priorityOrder = { NGUY_CAP: 0, CAO: 1, TRUNG_BINH: 2, THAP: 3 };
    deXuats.sort((a, b) => {
        const pDiff = priorityOrder[a.uuTien] - priorityOrder[b.uuTien];
        if (pDiff !== 0) return pDiff;
        return b.thoiGian_Tao.localeCompare(a.thoiGian_Tao);
    });

    return deXuats;
}

/**
 * Lấy 1 đề xuất theo ID
 * 
 * @param deXuatId - ID đề xuất
 * @returns Promise<DeXuat | null>
 */
export async function layDeXuatTheoId(deXuatId: string): Promise<DeXuat | null> {
    const allDeXuats = await layDanhSachDeXuat();
    return allDeXuats.find(d => d.id === deXuatId) || null;
}

/**
 * Cập nhật trạng thái đề xuất
 * 
 * @param deXuatId - ID đề xuất
 * @param trangThaiMoi - Trạng thái mới
 * @returns Promise<void>
 */
export async function capNhatTrangThai(
    deXuatId: string,
    trangThaiMoi: TrangThaiDeXuat
): Promise<void> {
    const sheets = await getSheetsClient();

    // Find row index
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:A`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === deXuatId);

    if (rowIndex === -1) {
        throw new Error(`Không tìm thấy đề xuất với ID: ${deXuatId}`);
    }

    // Update status (row index + 2 because: +1 for header, +1 for 0-index)
    const actualRowNumber = rowIndex + 2;
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!H${actualRowNumber}`, // Column H = trang_thai
        valueInputOption: 'RAW',
        requestBody: {
            values: [[trangThaiMoi]],
        },
    });
}

/**
 * Cập nhật thông tin duyệt (approve/reject)
 * 
 * @param deXuatId - ID đề xuất
 * @param nguoiDuyet - User ID người duyệt
 * @param trangThai - DA_DUYET hoặc BI_TU_CHOI
 * @param ghiChu - Ghi chú (optional)
 * @returns Promise<void>
 */
export async function capNhatThongTinDuyet(
    deXuatId: string,
    nguoiDuyet: string,
    trangThai: 'DA_DUYET' | 'BI_TU_CHOI',
    ghiChu?: string
): Promise<void> {
    const sheets = await getSheetsClient();

    // Find row
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:A`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === deXuatId);

    if (rowIndex === -1) {
        throw new Error(`Không tìm thấy đề xuất với ID: ${deXuatId}`);
    }

    const actualRowNumber = rowIndex + 2;
    const thoiGianDuyet = new Date().toISOString();

    // Update H (status), P (nguoi_duyet), Q (thoi_gian_duyet), U (ghi_chu)
    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            valueInputOption: 'RAW',
            data: [
                { range: `${SHEET_NAME}!H${actualRowNumber}`, values: [[trangThai]] },
                { range: `${SHEET_NAME}!P${actualRowNumber}`, values: [[nguoiDuyet]] },
                { range: `${SHEET_NAME}!Q${actualRowNumber}`, values: [[thoiGianDuyet]] },
                { range: `${SHEET_NAME}!U${actualRowNumber}`, values: [[ghiChu || '']] },
            ],
        },
    });
}

/**
 * Cập nhật thông tin thực thi
 * 
 * @param deXuatId - ID đề xuất
 * @param thanhCong - Thực thi thành công?
 * @param thongDiep - Message từ FB API
 * @param giamSatDenNgay - Ngày kết thúc monitoring (D+7)
 * @returns Promise<void>
 */
export async function capNhatThongTinThucThi(
    deXuatId: string,
    thanhCong: boolean,
    thongDiep: string,
    giamSatDenNgay: string
): Promise<void> {
    const sheets = await getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:A`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === deXuatId);

    if (rowIndex === -1) {
        throw new Error(`Không tìm thấy đề xuất với ID: ${deXuatId}`);
    }

    const actualRowNumber = rowIndex + 2;
    const thoiGianThucThi = new Date().toISOString();
    const trangThaiMoi = thanhCong ? 'DANG_GIAM_SAT' : 'DA_DUYET'; // If failed, back to approved

    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            valueInputOption: 'RAW',
            data: [
                { range: `${SHEET_NAME}!H${actualRowNumber}`, values: [[trangThaiMoi]] },
                { range: `${SHEET_NAME}!R${actualRowNumber}`, values: [[thoiGianThucThi]] },
                { range: `${SHEET_NAME}!S${actualRowNumber}`, values: [[giamSatDenNgay]] },
            ],
        },
    });
}
