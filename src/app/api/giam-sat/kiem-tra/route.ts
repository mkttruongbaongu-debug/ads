/**
 * ===================================================================
 * API ENDPOINT: KIỂM TRA GIÁM SÁT (MONITORING CHECKER)
 * ===================================================================
 * Route: POST /api/giam-sat/kiem-tra
 * 
 * Chức năng:
 * 1. Lấy danh sách đề xuất đang ở trạng thái DA_THUC_THI / DANG_GIAM_SAT
 * 2. Xác định checkpoint (D+1, D+3, D+7)
 * 3. Fetch metrics hiện tại từ Facebook API
 * 4. So sánh trước/sau, đánh giá kết quả
 * 5. Ghi observation vào Google Sheets
 * 6. Chuyển trạng thái HOAN_THANH khi hết D+7
 * 
 * Có thể gọi bằng cron job hoặc manual trigger.
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
// Apps Script helpers (thay vì direct Google Sheets API)
async function layDanhSachDeXuatViaAppsScript(filter: { trangThai?: any }): Promise<any[]> {
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';
    if (!scriptUrl) throw new Error('GOOGLE_APPS_SCRIPT_URL not configured');

    const url = new URL(scriptUrl);
    url.searchParams.set('secret', secret);
    url.searchParams.set('action', 'layDanhSachDeXuat');
    if (filter.trangThai) {
        const statuses = Array.isArray(filter.trangThai) ? filter.trangThai : [filter.trangThai];
        url.searchParams.set('status', statuses.join(','));
    }

    const res = await fetch(url.toString());
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Apps Script error');
    return data.data || [];
}

async function capNhatTrangThaiViaAppsScript(deXuatId: string, trangThai: string): Promise<void> {
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';
    if (!scriptUrl) throw new Error('GOOGLE_APPS_SCRIPT_URL not configured');

    await fetch(`${scriptUrl}?action=capNhatDeXuat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'capNhatDeXuat', secret, id: deXuatId, trangThai }),
    });
}
import { ghiNhanQuanSat, layQuanSatTheoDeXuat } from '@/lib/sheets/quan-sat-sheet';
import { getDynamicFacebookClient } from '@/lib/facebook/client';
import type { QuanSat, MetricsTaiThoiDiem, DanhGiaKetQua, DeXuat } from '@/lib/de-xuat/types';

// ===================================================================
// HELPERS
// ===================================================================

function generateId(): string {
    return `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function daysSince(isoDate: string): number {
    const then = new Date(isoDate);
    const now = new Date();
    return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function determineCheckpoint(daysSinceExecution: number): 1 | 3 | 7 | null {
    if (daysSinceExecution >= 7) return 7;
    if (daysSinceExecution >= 3) return 3;
    if (daysSinceExecution >= 1) return 1;
    return null; // Too soon
}

function evaluateResults(
    before: MetricsTaiThoiDiem,
    after: MetricsTaiThoiDiem
): { danhGia: DanhGiaKetQua; cppChange: number; roasChange: number } {
    const cppChange = before.cpp > 0
        ? ((after.cpp - before.cpp) / before.cpp) * 100
        : 0;
    const roasChange = before.roas > 0
        ? ((after.roas - before.roas) / before.roas) * 100
        : 0;

    // CPP giảm = tốt, ROAS tăng = tốt
    let score = 0;
    if (cppChange < -5) score++; // CPP giảm > 5%
    if (cppChange > 5) score--;  // CPP tăng > 5%
    if (roasChange > 5) score++; // ROAS tăng > 5%
    if (roasChange < -5) score--; // ROAS giảm > 5%

    const danhGia: DanhGiaKetQua = score > 0 ? 'CAI_THIEN' : score < 0 ? 'XAU_DI' : 'TRUNG_TINH';

    return { danhGia, cppChange, roasChange };
}

// ===================================================================
// POST HANDLER
// ===================================================================

export async function POST(request: NextRequest) {
    console.log('[GIAM_SAT] 🔍 Bắt đầu kiểm tra giám sát...');

    const errors: string[] = [];
    let processed = 0;
    let observationsCreated = 0;

    try {
        // Step 1: Lấy đề xuất cần giám sát
        const deXuats = await layDanhSachDeXuatViaAppsScript({
            trangThai: ['DA_THUC_THI', 'DANG_GIAM_SAT'],
        });

        console.log(`[GIAM_SAT] 📋 Tìm thấy ${deXuats.length} đề xuất cần giám sát`);

        if (deXuats.length === 0) {
            return NextResponse.json({
                success: true,
                data: { processed: 0, observations_created: 0, errors: [] },
                message: 'Không có đề xuất nào cần giám sát',
            });
        }

        // Step 2: Khởi tạo Facebook client
        let fb;
        try {
            fb = await getDynamicFacebookClient();
        } catch (err) {
            console.error('[GIAM_SAT] ❌ Không thể kết nối Facebook:', err);
            return NextResponse.json({
                success: false,
                error: 'Không thể kết nối Facebook API. Kiểm tra access token.',
            }, { status: 500 });
        }

        // Step 3: Xử lý từng đề xuất
        for (const deXuat of deXuats) {
            try {
                await processDeXuat(deXuat, fb, errors);
                processed++;
            } catch (err) {
                const msg = `Lỗi xử lý ${deXuat.id}: ${err instanceof Error ? err.message : String(err)}`;
                console.error(`[GIAM_SAT] ❌ ${msg}`);
                errors.push(msg);
            }
        }

        console.log(`[GIAM_SAT] ✅ Hoàn tất: ${processed} processed, ${observationsCreated} observations`);

        return NextResponse.json({
            success: true,
            data: {
                processed,
                observations_created: observationsCreated,
                errors,
            },
            message: `Đã kiểm tra ${processed}/${deXuats.length} đề xuất`,
        });

    } catch (error) {
        console.error('[GIAM_SAT] ❌ Lỗi:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }

    // --- Inner function ---
    async function processDeXuat(deXuat: DeXuat, fb: any, errors: string[]) {
        const executionDate = deXuat.thoiGian_ThucThi || deXuat.thoiGian_Duyet || deXuat.thoiGian_Tao;
        const daysSinceExec = daysSince(executionDate);
        const checkpoint = determineCheckpoint(daysSinceExec);

        console.log(`[GIAM_SAT] 📊 ${deXuat.tenCampaign}: D+${daysSinceExec}, checkpoint=${checkpoint}`);

        if (!checkpoint) {
            console.log(`[GIAM_SAT] ⏳ Quá sớm (< 1 ngày), bỏ qua`);
            return;
        }

        // Check: đã có observation cho checkpoint này chưa?
        const existingObs = await layQuanSatTheoDeXuat(deXuat.id);
        const alreadyHas = existingObs.some(o => o.checkpoint_Ngay === checkpoint);

        if (alreadyHas) {
            console.log(`[GIAM_SAT] ⏭️ Đã có observation D+${checkpoint}, bỏ qua`);

            // Nếu đã có D+7 → chuyển HOAN_THANH
            if (checkpoint === 7 && deXuat.trangThai !== 'HOAN_THANH') {
                const d7Obs = existingObs.find(o => o.checkpoint_Ngay === 7);
                if (d7Obs) {
                    await capNhatTrangThaiViaAppsScript(deXuat.id, 'HOAN_THANH');
                    console.log(`[GIAM_SAT] 🏁 ${deXuat.tenCampaign} → HOAN_THANH`);
                }
            }
            return;
        }

        // Chuyển sang DANG_GIAM_SAT nếu đang DA_THUC_THI
        if (deXuat.trangThai === 'DA_THUC_THI') {
            await capNhatTrangThaiViaAppsScript(deXuat.id, 'DANG_GIAM_SAT');
        }

        // Fetch metrics hiện tại
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        let currentMetrics: MetricsTaiThoiDiem;
        try {
            const insights = await fb.getInsights(
                deXuat.campaignId,
                { startDate, endDate },
                'campaign'
            );

            if (!insights || insights.length === 0) {
                errors.push(`${deXuat.tenCampaign}: Không có data gần đây`);
                return;
            }

            // Aggregate 3-day window
            let totalSpend = 0, totalRevenue = 0, totalPurchases = 0;
            let totalClicks = 0, totalImpressions = 0;

            for (const day of insights) {
                totalSpend += parseFloat(day.spend || '0');
                totalImpressions += parseInt(day.impressions || '0');
                totalClicks += parseInt(day.clicks || '0');

                const actions = day.actions || [];
                const actionValues = day.action_values || [];

                const purchaseAction = actions.find(
                    (a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
                );
                totalPurchases += purchaseAction ? parseInt(purchaseAction.value || '0') : 0;

                const revenueAction = actionValues.find(
                    (a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
                );
                totalRevenue += revenueAction ? parseFloat(revenueAction.value || '0') : 0;
            }

            currentMetrics = {
                cpp: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
                roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
                chiTieu: totalSpend,
                donHang: totalPurchases,
                ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
                doanhThu: totalRevenue,
                ngayBatDau: startDate,
                ngayKetThuc: endDate,
            };
        } catch (err) {
            errors.push(`${deXuat.tenCampaign}: FB API error - ${err instanceof Error ? err.message : String(err)}`);
            return;
        }

        // Evaluate
        const beforeMetrics = deXuat.metrics_TruocKhi;
        const { danhGia, cppChange, roasChange } = evaluateResults(beforeMetrics, currentMetrics);

        console.log(`[GIAM_SAT] 📈 D+${checkpoint}: CPP ${cppChange > 0 ? '+' : ''}${cppChange.toFixed(1)}%, ROAS ${roasChange > 0 ? '+' : ''}${roasChange.toFixed(1)}% → ${danhGia}`);

        // Create observation
        const quanSat: QuanSat = {
            id: generateId(),
            deXuatId: deXuat.id,
            checkpoint_Ngay: checkpoint,
            thoiGian_QuanSat: new Date().toISOString(),
            campaignId: deXuat.campaignId,
            metrics_HienTai: currentMetrics,
            metrics_TruocKhi: beforeMetrics,
            cpp_ThayDoi_Percent: cppChange,
            roas_ThayDoi_Percent: roasChange,
            danhGia,
            phanTich_AI: {
                giaiThich: buildExplanation(checkpoint, cppChange, roasChange, danhGia, deXuat),
                yeuTo_AnhHuong: identifyFactors(cppChange, roasChange, currentMetrics),
                duDoan_TiepTheo: checkpoint < 7
                    ? `Tiếp tục giám sát đến D+${checkpoint === 1 ? 3 : 7}`
                    : 'Kết thúc giám sát',
            },
        };

        // Save to Sheets
        await ghiNhanQuanSat(quanSat);
        observationsCreated++;
        console.log(`[GIAM_SAT] 💾 Observation D+${checkpoint} saved: ${quanSat.id}`);

        // D+7: Complete monitoring
        if (checkpoint === 7) {
            await capNhatTrangThaiViaAppsScript(deXuat.id, 'HOAN_THANH');
            console.log(`[GIAM_SAT] 🏁 ${deXuat.tenCampaign} → HOAN_THANH (${danhGia})`);
        }
    }
}

// ===================================================================
// EXPLANATION BUILDERS
// ===================================================================

function buildExplanation(
    checkpoint: number,
    cppChange: number,
    roasChange: number,
    danhGia: DanhGiaKetQua,
    deXuat: DeXuat
): string {
    const action = deXuat.hanhDong.loai;
    const parts: string[] = [];

    parts.push(`Checkpoint D+${checkpoint} sau khi thực hiện ${action}.`);

    if (cppChange < -10) {
        parts.push(`CPP giảm ${Math.abs(cppChange).toFixed(0)}% — chi phí/đơn đã cải thiện rõ rệt.`);
    } else if (cppChange > 10) {
        parts.push(`CPP tăng ${cppChange.toFixed(0)}% — chi phí/đơn đang xấu đi.`);
    } else {
        parts.push(`CPP thay đổi ${cppChange > 0 ? '+' : ''}${cppChange.toFixed(0)}% — ổn định.`);
    }

    if (roasChange > 10) {
        parts.push(`ROAS tăng ${roasChange.toFixed(0)}% — hiệu quả sinh lời cải thiện.`);
    } else if (roasChange < -10) {
        parts.push(`ROAS giảm ${Math.abs(roasChange).toFixed(0)}% — hiệu quả sinh lời suy giảm.`);
    }

    if (danhGia === 'CAI_THIEN') {
        parts.push('Kết luận: Hành động ĐÃ CÓ HIỆU QUẢ.');
    } else if (danhGia === 'XAU_DI') {
        parts.push('Kết luận: Hành động CHƯA CÓ HIỆU QUẢ, cần xem xét lại.');
    } else {
        parts.push('Kết luận: Chưa có thay đổi đáng kể, tiếp tục theo dõi.');
    }

    return parts.join(' ');
}

function identifyFactors(
    cppChange: number,
    roasChange: number,
    current: MetricsTaiThoiDiem
): string[] {
    const factors: string[] = [];

    if (current.donHang === 0) factors.push('Không có đơn hàng trong kỳ');
    if (current.ctr < 1) factors.push('CTR thấp < 1%');
    if (current.ctr > 3) factors.push('CTR tốt > 3%');
    if (cppChange < -10) factors.push('CPP cải thiện mạnh');
    if (cppChange > 10) factors.push('CPP tăng đáng lo');
    if (roasChange > 10) factors.push('ROAS tăng tích cực');
    if (roasChange < -10) factors.push('ROAS giảm cần chú ý');
    if (current.roas >= 4) factors.push('ROAS xuất sắc >= 4x');
    if (current.roas < 2 && current.roas > 0) factors.push('ROAS gần hòa vốn');

    return factors.length > 0 ? factors : ['Chưa có yếu tố đặc biệt'];
}
