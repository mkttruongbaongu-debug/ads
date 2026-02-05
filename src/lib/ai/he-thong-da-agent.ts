/**
 * ===================================================================
 * HỆ THỐNG ĐA AGENT (MULTI-AGENT ORCHESTRATOR)
 * ===================================================================
 * Vai trò:
 * Điều phối 5 AI agents, orchestrate workflow, tổng hợp kết quả.
 * Đây là entry point chính cho toàn bộ AI analysis system.
 * 
 * Workflow:
 * 1. Gọi 3 agents song song: Chiến lược, Hiệu suất, Nội dung
 * 2. Chờ 3 agents hoàn thành
 * 3. Gọi Quản lý Thực thi với inputs từ 3 agents
 * 4. Return tổng hợp: 4 phân tích + hành động + priority
 * 
 * Future workflow (sau khi execute):
 * 5. Execute action → Wait D+1, D+3, D+7
 * 6. Gọi Kiểm định Chất lượng để đánh giá
 * 7. Extract learning → Update patterns
 * 
 * Dependencies:
 * - chuyen-gia-chien-luoc.ts
 * - chuyen-gia-hieu-suat.ts
 * - chuyen-gia-noi-dung.ts
 * - quan-ly-thuc-thi.ts
 * - kiem-dinh-chat-luong.ts (for post-action evaluation)
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

import { phanTich_ChienLuoc } from './chuyen-gia-chien-luoc';
import { phanTich_HieuSuat } from './chuyen-gia-hieu-suat';
import { phanTich_NoiDung } from './chuyen-gia-noi-dung';
import { quanLy_ThucThi } from './quan-ly-thuc-thi';
import { kiemDinh_KetQua } from './kiem-dinh-chat-luong';
import type {
    PhanTichChuyenGia,
    ChiTietHanhDong,
    MucDoUuTien,
    KetQua_PhanTichDaAgent,
    MetricsTaiThoiDiem,
    DanhGiaKetQua,
} from '../de-xuat/types';

// ===================================================================
// TYPES
// ===================================================================

/**
 * Input data cho hệ thống phân tích
 */
export interface DuLieuPhanTich {
    // Campaign info
    campaignId: string;
    tenCampaign: string;
    status: string;

    // Current metrics
    metrics_HienTai: {
        cpp: number;
        roas: number;
        chiTieu: number;
        donHang: number;
        ctr: number;
        doanhThu: number;
    };

    // Historical data (optional but recommended)
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

    // OpenAI API key (optional, will use env if not provided)
    openaiApiKey?: string;
}

/**
 * Output từ hệ thống phân tích
 */
export interface KetQua_HeThongPhanTich {
    // Tất cả phân tích từ 4 agents
    phanTich_ChienLuoc: PhanTichChuyenGia;
    phanTich_HieuSuat: PhanTichChuyenGia;
    phanTich_NoiDung: PhanTichChuyenGia;
    phanTich_ThucThi: PhanTichChuyenGia;

    // Hành động được đề xuất
    hanhDong_DeXuat: ChiTietHanhDong;

    // Priority level
    mucDo_UuTien: MucDoUuTien;

    // Summary
    tomTat: {
        doDongThuan: number; // Agreement level between agents (0-1)
        diemManh: string[]; // Strengths
        diemYeu: string[]; // Weaknesses
        khuyenNghi_TongThe: string; // Overall recommendation
    };

    // Metadata
    thoiGian_PhanTich: string;
    doTinCay_TrungBinh: number;
}

// ===================================================================
// MAIN ORCHESTRATION FUNCTION
// ===================================================================

/**
 * Phân tích campaign với hệ thống đa chuyên gia AI
 * 
 * @param data - Campaign data cần phân tích
 * @returns Promise<KetQua_HeThongPhanTich>
 * 
 * @example
 * ```typescript
 * const ketQua = await phanTich_DaChuyenGia({
 *   campaignId: '123456',
 *   tenCampaign: 'Áo Hoodie Cao Cấp',
 *   status: 'ACTIVE',
 *   metrics_HienTai: {
 *     cpp: 145000,
 *     roas: 1.7,
 *     chiTieu: 3500000,
 *     donHang: 24,
 *     ctr: 1.2,
 *     doanhThu: 5950000
 *   },
 *   metrics_LichSu: [...],
 *   soNgay_DaChay: 12,
 *   ngan_sach_hien_tai: 500000
 * });
 * 
 * console.log('Priority:', ketQua.mucDo_UuTien);
 * console.log('Action:', ketQua.hanhDong_DeXuat.loai);
 * console.log('Reason:', ketQua.hanhDong_DeXuat.lyDo);
 * ```
 */
export async function phanTich_DaChuyenGia(
    data: DuLieuPhanTich
): Promise<KetQua_HeThongPhanTich> {
    const startTime = new Date();

    console.log(`[HE_THONG_DA_AGENT] 🚀 Bắt đầu phân tích campaign: ${data.tenCampaign}`);

    // ===================================================================
    // STAGE 1: Gọi 3 agents song song
    // ===================================================================
    console.log('[HE_THONG_DA_AGENT] 📊 Stage 1: Phân tích từ 3 chuyên gia...');

    const [
        phanTichChienLuoc,
        phanTichHieuSuat,
        phanTichNoiDung,
    ] = await Promise.all([
        phanTich_ChienLuoc(
            {
                id: data.campaignId,
                name: data.tenCampaign,
                status: data.status,
                metrics_HienTai: data.metrics_HienTai,
                metrics_LichSu: data.metrics_LichSu,
                soNgay_DaChay: data.soNgay_DaChay,
            },
            data.openaiApiKey
        ),

        phanTich_HieuSuat(
            {
                id: data.campaignId,
                name: data.tenCampaign,
                metrics_HienTai: data.metrics_HienTai,
                metrics_LichSu: data.metrics_LichSu,
                muc_tieu: data.muc_tieu,
            },
            data.openaiApiKey
        ),

        phanTich_NoiDung(
            {
                id: data.campaignId,
                name: data.tenCampaign,
                metrics_HienTai: {
                    ctr: data.metrics_HienTai.ctr,
                    donHang: data.metrics_HienTai.donHang,
                    chiTieu: data.metrics_HienTai.chiTieu,
                },
                ctr_LichSu: data.ctr_LichSu,
                soNgay_DaChay: data.soNgay_DaChay,
            },
            data.openaiApiKey
        ),
    ]);

    console.log('[HE_THONG_DA_AGENT] ✅ Stage 1 hoàn thành');

    // ===================================================================
    // STAGE 2: Gọi Execution Manager với inputs từ 3 agents
    // ===================================================================
    console.log('[HE_THONG_DA_AGENT] ⚡ Stage 2: Quản lý thực thi...');

    const ketQuaThucThi = await quanLy_ThucThi(
        {
            id: data.campaignId,
            name: data.tenCampaign,
            status: data.status,
            metrics_HienTai: data.metrics_HienTai,
            ngan_sach_hien_tai: data.ngan_sach_hien_tai,
        },
        phanTichChienLuoc,
        phanTichHieuSuat,
        phanTichNoiDung,
        data.openaiApiKey
    );

    console.log('[HE_THONG_DA_AGENT] ✅ Stage 2 hoàn thành');

    // ===================================================================
    // STAGE 3: Tổng hợp kết quả
    // ===================================================================
    console.log('[HE_THONG_DA_AGENT] 📝 Stage 3: Tổng hợp kết quả...');

    // Calculate average confidence
    const allAgents = [
        phanTichChienLuoc,
        phanTichHieuSuat,
        phanTichNoiDung,
        ketQuaThucThi.phanTich,
    ];
    const doTinCay_TrungBinh = allAgents.reduce((sum, a) => sum + a.doTinCay, 0) / allAgents.length;

    // Calculate agreement level (simplified: based on consistency of priorities)
    // High agreement = all agents point to same severity level
    const doDongThuan = tinhDoDongThuan(allAgents, ketQuaThucThi.uuTien);

    // Extract strengths and weaknesses
    const { diemManh, diemYeu } = trichXuat_DiemManhYeu(
        phanTichChienLuoc,
        phanTichHieuSuat,
        phanTichNoiDung
    );

    // Build overall recommendation
    const khuyenNghi_TongThe = `${ketQuaThucThi.uuTien}: ${ketQuaThucThi.hanhDong.loai}. ${ketQuaThucThi.hanhDong.lyDo}`;

    const ketQua: KetQua_HeThongPhanTich = {
        phanTich_ChienLuoc: phanTichChienLuoc,
        phanTich_HieuSuat: phanTichHieuSuat,
        phanTich_NoiDung: phanTichNoiDung,
        phanTich_ThucThi: ketQuaThucThi.phanTich,
        hanhDong_DeXuat: ketQuaThucThi.hanhDong,
        mucDo_UuTien: ketQuaThucThi.uuTien,
        tomTat: {
            doDongThuan,
            diemManh,
            diemYeu,
            khuyenNghi_TongThe,
        },
        thoiGian_PhanTich: new Date().toISOString(),
        doTinCay_TrungBinh: doTinCay_TrungBinh,
    };

    const duration = Date.now() - startTime.getTime();
    console.log(`[HE_THONG_DA_AGENT] ✨ Hoàn thành phân tích trong ${duration}ms`);
    console.log(`[HE_THONG_DA_AGENT] 🎯 Khuyến nghị: ${khuyenNghi_TongThe}`);

    return ketQua;
}

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

/**
 * Tính độ đồng thuận giữa các agents
 * Simplified logic: Dựa trên độ nghiêm trọng được đề xuất
 */
function tinhDoDongThuan(
    agents: PhanTichChuyenGia[],
    mucDoUuTien: MucDoUuTien
): number {
    // Nếu tất cả agents đều có confidence cao và priority match → high agreement
    const avgConfidence = agents.reduce((sum, a) => sum + a.doTinCay, 0) / agents.length;

    // Simplified: Agreement = average confidence
    // TODO: More sophisticated logic considering actual recommendations
    return Math.round(avgConfidence * 100) / 100;
}

/**
 * Trích xuất điểm mạnh và yếu từ phân tích
 */
function trichXuat_DiemManhYeu(
    chienLuoc: PhanTichChuyenGia,
    hieuSuat: PhanTichChuyenGia,
    noiDung: PhanTichChuyenGia
): { diemManh: string[]; diemYeu: string[] } {
    const diemManh: string[] = [];
    const diemYeu: string[] = [];

    // From Chiến lược
    const xuHuong = chienLuoc.duLieuHoTro.xuHuong;
    if (xuHuong === 'TANG_TRUONG') {
        diemManh.push('Campaign đang trong xu hướng tăng trưởng');
    } else if (xuHuong === 'SUY_GIAM') {
        diemYeu.push('Campaign đang suy giảm');
    }

    // From Hiệu suất
    const trangThai = hieuSuat.duLieuHoTro.trangThaiTongQuan;
    if (trangThai === 'TOT') {
        diemManh.push('Metrics tổng thể tốt');
    } else if (trangThai === 'NGUY_CAP') {
        diemYeu.push('Metrics ở mức nguy cấp');
    }

    const redFlags = hieuSuat.duLieuHoTro.redFlags || [];
    redFlags.forEach((flag: string) => diemYeu.push(flag));

    // From Nội dung
    const danhGiaCreative = noiDung.duLieuHoTro.danhGiaCreative;
    if (danhGiaCreative === 'TUYET_VOI' || danhGiaCreative === 'TOT') {
        diemManh.push('Creative hiệu quả cao');
    } else if (danhGiaCreative === 'YEU') {
        diemYeu.push('Creative yếu, cần cải thiện');
    }

    if (noiDung.duLieuHoTro.coDauHieuFatigue) {
        diemYeu.push('Phát hiện creative fatigue');
    }

    return { diemManh, diemYeu };
}

// ===================================================================
// EXPORT POST-ACTION EVALUATION
// ===================================================================

/**
 * Đánh giá kết quả sau khi thực thi (D+1, D+3, D+7)
 * Gọi AI Kiểm định Chất lượng
 * 
 * @param data - Dữ liệu before/after
 * @returns Promise với verdict, learning, success rate
 */
export async function danhGia_SauThucThi(data: {
    campaignId: string;
    tenCampaign: string;
    hanhDong_DaThucThi: {
        loai: string;
        moTa: string;
    };
    metrics_TruocKhi: MetricsTaiThoiDiem;
    metrics_SauKhi: MetricsTaiThoiDiem;
    checkpoint_Ngay: 1 | 3 | 7;
    openaiApiKey?: string;
}): Promise<{
    phanTich: PhanTichChuyenGia;
    danhGia: DanhGiaKetQua;
    baiHoc: string;
    tyLeThanhCong: number;
}> {
    console.log(`[HE_THONG_DA_AGENT] 🔍 Đánh giá kết quả D+${data.checkpoint_Ngay}: ${data.tenCampaign}`);

    const ketQua = await kiemDinh_KetQua(data, data.openaiApiKey);

    console.log(`[HE_THONG_DA_AGENT] ✅ Verdict: ${ketQua.danhGia} (${ketQua.tyLeThanhCong}%)`);
    console.log(`[HE_THONG_DA_AGENT] 📚 Learning: ${ketQua.baiHoc}`);

    return ketQua;
}
