/**
 * ===================================================================
 * HỆ THỐNG ĐỀ XUẤT - ĐỊNH NGHĨA TYPES
 * ===================================================================
 * Mô tả: 
 * Chứa tất cả TypeScript interfaces và types cho Campaign Guardian System.
 * Hệ thống đề xuất tự động phân tích campaigns, đưa ra khuyến nghị hành động,
 * theo dõi kết quả và học hỏi từ lịch sử.
 * 
 * Cấu trúc:
 * - Loại hành động: Các actions có thể thực hiện trên campaign
 * - Mức ưu tiên: Độ khẩn cấp của đề xuất
 * - Trạng thái: Workflow states của đề xuất
 * - Phân tích: Output từ các AI agents
 * - Đề xuất: Core data structure
 * - Quan sát: Monitoring data
 * - Mẫu học: Learned patterns
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

// ===================================================================
// ENUMS & LITERAL TYPES
// ===================================================================

/**
 * Loại hành động có thể thực hiện trên Facebook Ad Campaign
 */
export type LoaiHanhDong =
    | 'TAM_DUNG'              // Pause campaign (temporary)
    | 'THAY_DOI_NGAN_SACH'    // Increase/decrease budget
    | 'LAM_MOI_CREATIVE'      // Suggest creative refresh
    | 'DIEU_CHINH_DOI_TUONG'  // Adjust targeting/audience
    | 'DUNG_VINH_VIEN';       // Stop campaign permanently

/**
 * Mức độ ưu tiên xử lý đề xuất
 * Quy tắc:
 * - NGUY_CAP: Cần xử lý NGAY (đang burn money)
 * - CAO: Xử lý trong 24h
 * - TRUNG_BINH: Xử lý trong tuần
 * - THAP: Tham khảo, không cấp thiết
 */
export type MucDoUuTien =
    | 'NGUY_CAP'      // Critical - immediate action needed
    | 'CAO'           // High - within 24 hours
    | 'TRUNG_BINH'    // Medium - within a week
    | 'THAP';         // Low - nice to have

/**
 * Trạng thái workflow của đề xuất
 * Flow: CHO_DUYET → DA_DUYET → DA_THUC_THI → DANG_GIAM_SAT → HOAN_THANH
 *       hoặc: CHO_DUYET → BI_TU_CHOI (end)
 */
export type TrangThaiDeXuat =
    | 'CHO_DUYET'      // Pending user approval
    | 'DA_DUYET'       // Approved by user
    | 'BI_TU_CHOI'     // Rejected by user
    | 'DA_THUC_THI'    // Executed (FB API called)
    | 'DANG_GIAM_SAT'  // Monitoring results (D+1 to D+7)
    | 'HOAN_THANH';    // Completed after D+7 evaluation

/**
 * Tên các AI chuyên gia trong hệ thống
 */
export type TenChuyenGia =
    | 'CHIEN_LUOC'      // Strategist - long-term view
    | 'HIEU_SUAT'       // Performance analyst - metrics deep dive
    | 'NOI_DUNG'        // Creative analyst - ad content evaluation
    | 'THUC_THI'        // Execution manager - actionable recommendations
    | 'KIEM_DINH';      // QA auditor - post-action evaluation

/**
 * Đánh giá kết quả sau khi thực thi
 */
export type DanhGiaKetQua =
    | 'CAI_THIEN'    // Improved - metrics got better
    | 'TRUNG_TINH'   // Neutral - no significant change
    | 'XAU_DI';      // Worsened - metrics got worse

/**
 * Hướng xu hướng của campaign
 */
export type HuongXuHuong =
    | 'TANG_TRUONG'  // Growing/improving
    | 'ON_DINH'      // Stable
    | 'SUY_GIAM'     // Declining
    | 'DAO_DONG';    // Fluctuating/volatile

// ===================================================================
// CORE INTERFACES
// ===================================================================

/**
 * Phân tích từ một AI chuyên gia
 */
export interface PhanTichChuyenGia {
    /** Tên chuyên gia */
    tenChuyenGia: TenChuyenGia;

    /** Nhận định tóm tắt (1-2 câu ngắn gọn) */
    nhanDinh: string;

    /** Dữ liệu hỗ trợ cho nhận định (metrics, insights, etc) */
    duLieuHoTro: Record<string, any>;

    /** Độ tin cậy của phân tích (0.0 - 1.0) */
    doTinCay: number;

    /** Thời gian phân tích (ISO string) */
    thoiGian?: string;
}

/**
 * Chi tiết hành động được đề xuất
 */
export interface ChiTietHanhDong {
    /** Loại hành động */
    loai: LoaiHanhDong;

    /** Giá trị hiện tại (nếu có - VD: budget hiện tại) */
    giaTri_HienTai?: number | string;

    /** Giá trị đề xuất (VD: budget mới) */
    giaTri_DeXuat: number | string;

    /** % thay đổi (VD: -40% budget) */
    phanTram_ThayDoi?: number;

    /** Lý do cụ thể cho hành động này */
    lyDo: string;

    /** Các bước thực thi cụ thể */
    cacBuoc: string[];

    /** Kết quả kỳ vọng sau khi thực hiện */
    ketQua_KyVong: string;
}

/**
 * Snapshot metrics của campaign tại một thời điểm
 */
export interface MetricsTaiThoiDiem {
    /** Chi phí / đơn hàng (VND) */
    cpp: number;

    /** Return on Ad Spend (revenue/spend) */
    roas: number;

    /** Tổng chi tiêu (VND) */
    chiTieu: number;

    /** Số đơn hàng */
    donHang: number;

    /** Click-through rate (%) */
    ctr: number;

    /** Doanh thu (VND) */
    doanhThu: number;

    /** Ngày bắt đầu data window */
    ngayBatDau?: string;

    /** Ngày kết thúc data window */
    ngayKetThuc?: string;
}

/**
 * Đề xuất từ hệ thống AI
 * Đây là core data structure, chứa toàn bộ thông tin về một đề xuất
 */
export interface DeXuat {
    /** ID duy nhất (UUID) */
    id: string;

    /** Thời gian tạo đề xuất (ISO string) */
    thoiGian_Tao: string;

    // ============ Campaign Info ============
    /** Facebook Campaign ID */
    campaignId: string;

    /** Tên campaign */
    tenCampaign: string;

    // ============ User Context ============
    /** User ID (owner của campaign) */
    userId: string;

    // ============ Priority & Classification ============
    /** Mức độ ưu tiên */
    uuTien: MucDoUuTien;

    // ============ AI Analysis ============
    /** Phân tích từ 5 AI chuyên gia */
    phanTich_ChuyenGia: PhanTichChuyenGia[];

    // ============ Proposed Action ============
    /** Chi tiết hành động được đề xuất */
    hanhDong: ChiTietHanhDong;

    // ============ Metrics Snapshot ============
    /** Metrics tại thời điểm tạo đề xuất */
    metrics_TruocKhi: MetricsTaiThoiDiem;

    // ============ Workflow State ============
    /** Trạng thái hiện tại */
    trangThai: TrangThaiDeXuat;

    // ============ User Review ============
    /** User đã review (approve/reject) */
    nguoiDuyet?: string;

    /** Thời gian review */
    thoiGian_Duyet?: string;

    /** Ghi chú từ user khi approve/reject */
    ghiChu_NguoiDung?: string;

    // ============ Execution ============
    /** Thời gian thực thi hành động */
    thoiGian_ThucThi?: string;

    /** Kết quả từ Facebook API */
    ketQua_ThucThi?: {
        thanhCong: boolean;
        thongDiep: string;
        facebook_Response?: any;
    };

    // ============ Monitoring ============
    /** Giám sát đến ngày (D+7 date) */
    giamSat_DenNgay?: string;

    /** Đánh giá cuối cùng sau D+7 */
    ketQua_CuoiCung?: DanhGiaKetQua;
}

/**
 * Quan sát (observation) tại các checkpoint D+1, D+3, D+7
 * Dùng để track metrics sau khi thực thi hành động
 */
export interface QuanSat {
    /** ID duy nhất */
    id: string;

    /** ID đề xuất (foreign key) */
    deXuatId: string;

    /** Checkpoint ngày (1, 3, hoặc 7) */
    checkpoint_Ngay: 1 | 3 | 7;

    /** Thời gian ghi nhận quan sát */
    thoiGian_QuanSat: string;

    /** Campaign ID */
    campaignId: string;

    // ============ Current Metrics ============
    /** Metrics hiện tại tại checkpoint */
    metrics_HienTai: MetricsTaiThoiDiem;

    /** Metrics trước khi thực thi (reference) */
    metrics_TruocKhi: MetricsTaiThoiDiem;

    // ============ Comparison ============
    /** % thay đổi CPP */
    cpp_ThayDoi_Percent: number;

    /** % thay đổi ROAS */
    roas_ThayDoi_Percent: number;

    /** Đánh giá tổng thể */
    danhGia: DanhGiaKetQua;

    // ============ AI Assessment ============
    /** Phân tích từ AI về kết quả */
    phanTich_AI: {
        giaiThich: string;
        yeuTo_AnhHuong: string[];
        duDoan_TiepTheo?: string;
    };

    /** Bài học rút ra (nếu có) */
    baiHoc?: string;
}

/**
 * Mẫu học được (learned pattern)
 * Hệ thống tự động phát hiện patterns từ các đề xuất thành công
 */
export interface MauHoc {
    /** ID duy nhất */
    id: string;

    /** Tên mô tả mẫu */
    tenMau: string;

    // ============ Pattern Definition ============
    /** Điều kiện để pattern match (JSON) */
    dieuKien: {
        loaiCampaign?: string;
        cpp_NgưongTren?: number;
        roas_NgưongDuoi?: number;
        soNgay_ChayTu?: number;
        [key: string]: any;
    };

    /** Hành động khuyến nghị khi match */
    hanhDong_KhuyenNghi: ChiTietHanhDong;

    // ============ Performance Stats ============
    /** Số lần pattern được áp dụng */
    soLan_ApDung: number;

    /** Số lần thành công (improved) */
    soLan_ThanhCong: number;

    /** Tỷ lệ thành công (0.0 - 1.0) */
    tyLe_ThanhCong: number;

    /** % cải thiện CPP trung bình */
    cpp_CaiThien_TB_Percent: number;

    /** % cải thiện ROAS trung bình */
    roas_CaiThien_TB_Percent: number;

    /** Độ tin cậy của pattern (0.0 - 1.0) */
    doTinCay: number;

    // ============ Metadata ============
    /** ID đề xuất đầu tiên tạo ra pattern này */
    tuDeXuatId?: string;

    /** Lần cập nhật gần nhất */
    capNhat_LanCuoi: string;
}

// ===================================================================
// HELPER TYPES
// ===================================================================

/**
 * Filter options cho query đề xuất
 */
export interface DeXuatFilter {
    trangThai?: TrangThaiDeXuat | TrangThaiDeXuat[];
    uuTien?: MucDoUuTien | MucDoUuTien[];
    campaignId?: string;
    userId?: string;
    tuNgay?: string;
    denNgay?: string;
}

/**
 * Kết quả phân tích từ multi-agent system
 */
export interface KetQua_PhanTichDaAgent {
    /** Tất cả phân tích từ 5 agents */
    cacPhanTich: PhanTichChuyenGia[];

    /** Tóm tắt tổng hợp */
    tomTat: string;

    /** Mức độ đồng thuận giữa các agents (0.0 - 1.0) */
    doDongThuan: number;

    /** Khuyến nghị hành động (từ Execution Manager) */
    khuyenNghi_HanhDong: ChiTietHanhDong;
}

/**
 * Request body cho API tạo đề xuất
 */
export interface TaoDeXuatRequest {
    campaignId: string;
    startDate: string;
    endDate: string;
    accountId: string;
}

/**
 * Response từ API tạo đề xuất
 */
export interface TaoDeXuatResponse {
    success: boolean;
    data?: {
        deXuatId: string;
        uuTien: MucDoUuTien;
        tomTat: string;
    };
    error?: string;
}
