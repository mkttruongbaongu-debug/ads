/**
 * ===================================================================
 * GOOGLE SHEETS OPERATIONS - QUAN SÁT
 * ===================================================================
 * Mô tả:
 * Thao tác CRUD với Google Sheet "QUAN_SAT".
 * Ghi nhận observations tại các checkpoint D+1, D+3, D+7 sau khi thực thi đề xuất.
 * So sánh metrics before/after để đánh giá hiệu quả.
 * 
 * Sheet Structure:
 * - Sheet Name: "QUAN_SAT"
 * - Columns: 14 columns (A-N)
 * - Row 1: Headers
 * - Row 2+: Data (sorted by observed_at DESC)
 * 
 * Functions:
 * - ghiNhanQuanSat(): Ghi nhận observation mới
 * - layQuanSatTheoDeXuat(): Lấy tất cả observations của 1 đề xuất
 * - layQuanSatTheoCheckpoint(): Lấy observations theo checkpoint day
 * - tinhTyLeThanhCong(): Tính success rate của các observations
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
import type { QuanSat, DanhGiaKetQua, MetricsTaiThoiDiem } from '../de-xuat/types';

// ===================================================================
// CONSTANTS
// ===================================================================

const SHEET_NAME = 'QUAN_SAT';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;

/**
 * Column mapping
 */
const COLUMNS = {
    quan_sat_id: 0,              // A
    de_xuat_id: 1,               // B
    checkpoint_ngay: 2,          // C
    thoi_gian_quan_sat: 3,       // D
    campaign_id: 4,              // E
    cpp_hien_tai: 5,             // F
    roas_hien_tai: 6,            // G
    chi_tieu_hien_tai: 7,        // H
    don_hang_hien_tai: 8,        // I
    cpp_thay_doi_percent: 9,     // J
    roas_thay_doi_percent: 10,   // K
    danh_gia: 11,                // L (CAI_THIEN|TRUNG_TINH|XAU_DI)
    phan_tich_ai: 12,            // M (JSON)
    bai_hoc: 13,                 // N
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
 * Chuyển QuanSat object → array row
 */
function quanSatToRow(quanSat: QuanSat): any[] {
    const row = new Array(14).fill('');

    row[COLUMNS.quan_sat_id] = quanSat.id;
    row[COLUMNS.de_xuat_id] = quanSat.deXuatId;
    row[COLUMNS.checkpoint_ngay] = quanSat.checkpoint_Ngay;
    row[COLUMNS.thoi_gian_quan_sat] = quanSat.thoiGian_QuanSat;
    row[COLUMNS.campaign_id] = quanSat.campaignId;

    // Current metrics
    row[COLUMNS.cpp_hien_tai] = quanSat.metrics_HienTai.cpp;
    row[COLUMNS.roas_hien_tai] = quanSat.metrics_HienTai.roas;
    row[COLUMNS.chi_tieu_hien_tai] = quanSat.metrics_HienTai.chiTieu;
    row[COLUMNS.don_hang_hien_tai] = quanSat.metrics_HienTai.donHang;

    // Changes
    row[COLUMNS.cpp_thay_doi_percent] = quanSat.cpp_ThayDoi_Percent;
    row[COLUMNS.roas_thay_doi_percent] = quanSat.roas_ThayDoi_Percent;

    // Assessment
    row[COLUMNS.danh_gia] = quanSat.danhGia;

    // AI analysis (JSON)
    row[COLUMNS.phan_tich_ai] = JSON.stringify(quanSat.phanTich_AI);

    // Learnings
    row[COLUMNS.bai_hoc] = quanSat.baiHoc || '';

    return row;
}

/**
 * Chuyển array row → QuanSat object
 */
function rowToQuanSat(row: any[]): QuanSat {
    let phanTichAI: any = {};
    try {
        phanTichAI = JSON.parse(row[COLUMNS.phan_tich_ai] || '{}');
    } catch (e) {
        console.error('Failed to parse phan_tich_ai JSON:', e);
    }

    const quanSat: QuanSat = {
        id: row[COLUMNS.quan_sat_id],
        deXuatId: row[COLUMNS.de_xuat_id],
        checkpoint_Ngay: parseInt(row[COLUMNS.checkpoint_ngay]) as 1 | 3 | 7,
        thoiGian_QuanSat: row[COLUMNS.thoi_gian_quan_sat],
        campaignId: row[COLUMNS.campaign_id],
        metrics_HienTai: {
            cpp: parseFloat(row[COLUMNS.cpp_hien_tai]) || 0,
            roas: parseFloat(row[COLUMNS.roas_hien_tai]) || 0,
            chiTieu: parseFloat(row[COLUMNS.chi_tieu_hien_tai]) || 0,
            donHang: parseFloat(row[COLUMNS.don_hang_hien_tai]) || 0,
            ctr: 0, // Not stored
            doanhThu: 0,
        },
        metrics_TruocKhi: {
            cpp: 0,
            roas: 0,
            chiTieu: 0,
            donHang: 0,
            ctr: 0,
            doanhThu: 0,
        }, // Will be populated from DeXuat if needed
        cpp_ThayDoi_Percent: parseFloat(row[COLUMNS.cpp_thay_doi_percent]) || 0,
        roas_ThayDoi_Percent: parseFloat(row[COLUMNS.roas_thay_doi_percent]) || 0,
        danhGia: row[COLUMNS.danh_gia] as DanhGiaKetQua,
        phanTich_AI: phanTichAI,
        baiHoc: row[COLUMNS.bai_hoc] || undefined,
    };

    return quanSat;
}

// ===================================================================
// PUBLIC FUNCTIONS
// ===================================================================

/**
 * Ghi nhận observation mới
 * 
 * @param quanSat - Observation data
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * await ghiNhanQuanSat({
 *   id: 'obs-123',
 *   deXuatId: 'prop-456',
 *   checkpoint_Ngay: 3, // D+3
 *   metrics_HienTai: { cpp: 95000, roas: 2.5, ... },
 *   danhGia: 'CAI_THIEN',
 *   ...
 * });
 * ```
 */
export async function ghiNhanQuanSat(quanSat: QuanSat): Promise<void> {
    const sheets = await getSheetsClient();
    const row = quanSatToRow(quanSat);

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:N`,
        valueInputOption: 'RAW',
        requestBody: {
            values: [row],
        },
    });
}

/**
 * Lấy tất cả observations của 1 đề xuất
 * 
 * @param deXuatId - ID đề xuất
 * @returns Promise<QuanSat[]> - Sorted by checkpoint_ngay ASC (D+1, D+3, D+7)
 * 
 * @example
 * ```typescript
 * const observations = await layQuanSatTheoDeXuat('prop-123');
 * // → [D+1 obs, D+3 obs, D+7 obs]
 * ```
 */
export async function layQuanSatTheoDeXuat(deXuatId: string): Promise<QuanSat[]> {
    const sheets = await getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:N`,
    });

    const rows = response.data.values || [];
    const quanSats = rows
        .map(rowToQuanSat)
        .filter(q => q.deXuatId === deXuatId);

    // Sort by checkpoint day
    quanSats.sort((a, b) => a.checkpoint_Ngay - b.checkpoint_Ngay);

    return quanSats;
}

/**
 * Lấy observations theo checkpoint day
 * Hữu ích để phân tích performance tại từng checkpoint
 * 
 * @param checkpointNgay - 1, 3, hoặc 7
 * @param tuNgay - From date (optional)
 * @param denNgay - To date (optional)
 * @returns Promise<QuanSat[]>
 * 
 * @example
 * ```typescript
 * // Lấy tất cả D+7 observations
 * const d7Obs = await layQuanSatTheoCheckpoint(7);
 * 
 * // Lấy D+3 observations trong tháng này
 * const d3ThisMonth = await layQuanSatTheoCheckpoint(3, '2026-02-01', '2026-02-28');
 * ```
 */
export async function layQuanSatTheoCheckpoint(
    checkpointNgay: 1 | 3 | 7,
    tuNgay?: string,
    denNgay?: string
): Promise<QuanSat[]> {
    const sheets = await getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:N`,
    });

    const rows = response.data.values || [];
    let quanSats = rows
        .map(rowToQuanSat)
        .filter(q => q.checkpoint_Ngay === checkpointNgay);

    // Date range filter
    if (tuNgay) {
        quanSats = quanSats.filter(q => q.thoiGian_QuanSat >= tuNgay);
    }
    if (denNgay) {
        quanSats = quanSats.filter(q => q.thoiGian_QuanSat <= denNgay);
    }

    // Sort by time DESC (newest first)
    quanSats.sort((a, b) => b.thoiGian_QuanSat.localeCompare(a.thoiGian_QuanSat));

    return quanSats;
}

/**
 * Tính tỷ lệ thành công từ observations
 * Dùng để đánh giá overall effectiveness
 * 
 * @param quanSats - Danh sách observations
 * @returns { 
 *   total: number,
 *   caiThien: number,
 *   trungTinh: number,
 *   xauDi: number,
 *   tyLeThanhCong: number
 * }
 * 
 * @example
 * ```typescript
 * const d7Obs = await layQuanSatTheoCheckpoint(7);
 * const stats = tinhTyLeThanhCong(d7Obs);
 * console.log(`Success rate: ${stats.tyLeThanhCong}%`);
 * ```
 */
export function tinhTyLeThanhCong(quanSats: QuanSat[]) {
    const total = quanSats.length;

    const caiThien = quanSats.filter(q => q.danhGia === 'CAI_THIEN').length;
    const trungTinh = quanSats.filter(q => q.danhGia === 'TRUNG_TINH').length;
    const xauDi = quanSats.filter(q => q.danhGia === 'XAU_DI').length;

    const tyLeThanhCong = total > 0 ? (caiThien / total) * 100 : 0;

    return {
        total,
        caiThien,
        trungTinh,
        xauDi,
        tyLeThanhCong: Math.round(tyLeThanhCong * 100) / 100, // 2 decimal places
    };
}

/**
 * Tính metrics improvement trung bình
 * 
 * @param quanSats - Danh sách observations
 * @returns {
 *   cpp_TrungBinh_Percent: number,
 *   roas_TrungBinh_Percent: number
 * }
 */
export function tinhCaiThienTrungBinh(quanSats: QuanSat[]) {
    if (quanSats.length === 0) {
        return {
            cpp_TrungBinh_Percent: 0,
            roas_TrungBinh_Percent: 0,
        };
    }

    const totalCppChange = quanSats.reduce((sum, q) => sum + q.cpp_ThayDoi_Percent, 0);
    const totalRoasChange = quanSats.reduce((sum, q) => sum + q.roas_ThayDoi_Percent, 0);

    return {
        cpp_TrungBinh_Percent: Math.round((totalCppChange / quanSats.length) * 100) / 100,
        roas_TrungBinh_Percent: Math.round((totalRoasChange / quanSats.length) * 100) / 100,
    };
}
