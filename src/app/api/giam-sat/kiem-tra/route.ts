/**
 * ===================================================================
 * API ENDPOINT: KIỂM TRA GIÁM SÁT
 * ===================================================================
 * Route: POST /api/giam-sat/kiem-tra
 * 
 * Mô tả:
 * Tự động kiểm tra các proposals đang được giám sát.
 * Chạy daily để ghi observations tại D+1, D+3, D+7.
 * 
 * Flow:
 * 1. Tìm proposals có status DANG_GIAM_SAT
 * 2. Check checkpoint (D+1/D+3/D+7)
 * 3. Fetch metrics hiện tại từ Facebook
 * 4. So sánh với metrics trước execution
 * 5. Call QA Auditor để đánh giá
 * 6. Lưu observation vào QUAN_SAT sheet
 * 7. Nếu D+7 → extract pattern, update status HOAN_THANH
 * 
 * Trigger:
 * - Manual: POST request
 * - Auto: Cron job (daily 00:00 UTC)
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     processed: number,
 *     observations_created: number,
 *     patterns_extracted: number,
 *     errors: string[]
 *   }
 * }
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { layDanhSachDeXuat, capNhatTrangThaiDeXuat } from '@/lib/sheets/de-xuat-sheet';
import {
    ghiQuanSat,
    layQuanSatTheoDeXuat,
    tinhTySThanhCong
} from '@/lib/sheets/quan-sat-sheet';
import { luuMauHoc, capNhatThongKeMau } from '@/lib/sheets/mau-hoc-sheet';
import { getFacebookClient } from '@/lib/facebook/client';
import { calculateMetrics } from '@/lib/facebook/metrics';
import { kiemDinhChatLuong } from '@/lib/ai/kiem-dinh-chat-luong';
import {
    getNextCheckpoint,
    hasReachedCheckpoint,
    type Checkpoint
} from '@/lib/monitoring/checkpoint-calculator';
import {
    compareMetrics,
    summarizeComparison,
    type CampaignMetrics
} from '@/lib/monitoring/metrics-comparison';

// ===================================================================
// TYPES
// ===================================================================

interface ProcessingResult {
    processed: number;
    observations_created: number;
    patterns_extracted: number;
    errors: string[];
}

// ===================================================================
// POST HANDLER
// ===================================================================

export async function POST(request: NextRequest) {
    console.log('[API:KIEM_TRA_GIAM_SAT] 🔍 Bắt đầu kiểm tra monitoring...');

    const result: ProcessingResult = {
        processed: 0,
        observations_created: 0,
        patterns_extracted: 0,
        errors: [],
    };

    try {
        // ===================================================================
        // STEP 1: Find proposals đang được giám sát
        // ===================================================================
        console.log('[API:KIEM_TRA_GIAM_SAT] 📋 Tìm proposals DANG_GIAM_SAT...');

        const proposals = await layDanhSachDeXuat({
            trangThai: 'DANG_GIAM_SAT',
        });

        if (proposals.length === 0) {
            console.log('[API:KIEM_TRA_GIAM_SAT] ✅ Không có proposal nào cần monitor');
            return NextResponse.json({
                success: true,
                data: result,
            });
        }

        console.log(`[API:KIEM_TRA_GIAM_SAT] 📊 Tìm thấy ${proposals.length} proposals`);

        // ===================================================================
        // STEP 2: Process từng proposal
        // ===================================================================
        for (const proposal of proposals) {
            try {
                result.processed++;
                console.log(`[API:KIEM_TRA_GIAM_SAT] 🎯 Processing: ${proposal.tenCampaign}`);

                // Check: Đã hết hạn giám sát chưa?
                const monitoringEndDate = new Date(proposal.giamSat_DenNgay);
                const now = new Date();

                if (now > monitoringEndDate) {
                    console.log('[API:KIEM_TRA_GIAM_SAT] ⏰ Hết hạn giám sát, skip');
                    continue;
                }

                // ===================================================================
                // STEP 3: Determine checkpoint cần ghi
                // ===================================================================

                // Lấy observations đã ghi
                const existingObservations = await layQuanSatTheoDeXuat(proposal.id);
                const recordedCheckpoints: Checkpoint[] = existingObservations.map(o => o.checkpoint);

                // Tìm checkpoint tiếp theo
                const nextCheckpoint = getNextCheckpoint(
                    proposal.thoiGian_ThucThi,
                    recordedCheckpoints
                );

                if (!nextCheckpoint) {
                    console.log('[API:KIEM_TRA_GIAM_SAT] ✅ Đã ghi đủ checkpoints');
                    continue;
                }

                // Check: Đã đến checkpoint chưa?
                if (!hasReachedCheckpoint(proposal.thoiGian_ThucThi, nextCheckpoint)) {
                    console.log(`[API:KIEM_TRA_GIAM_SAT] ⏳ Chưa đến ${nextCheckpoint}`);
                    continue;
                }

                console.log(`[API:KIEM_TRA_GIAM_SAT] 📍 Checkpoint: ${nextCheckpoint}`);

                // ===================================================================
                // STEP 4: Fetch current metrics từ Facebook
                // ===================================================================
                console.log('[API:KIEM_TRA_GIAM_SAT] 📈 Fetching metrics từ Facebook...');

                const fb = await getFacebookClient(proposal.userId);

                // Calculate date range (yesterday to capture completed data)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];

                const insightsResponse = await fb.get(`${proposal.campaignId}/insights`, {
                    time_range: JSON.stringify({
                        since: yesterdayStr,
                        until: yesterdayStr,
                    }),
                    fields: 'spend,purchase,purchase_roas,ctr,clicks,impressions,action_values',
                    level: 'campaign',
                });

                const insights = insightsResponse.data?.data?.[0];

                if (!insights) {
                    result.errors.push(`Không có insights cho ${proposal.tenCampaign}`);
                    console.warn('[API:KIEM_TRA_GIAM_SAT] ⚠️ Không có insights');
                    continue;
                }

                const currentMetrics = calculateMetrics([insights]);

                // ===================================================================
                // STEP 5: So sánh metrics before/after
                // ===================================================================
                console.log('[API:KIEM_TRA_GIAM_SAT] 🔄 So sánh metrics...');

                const metricsBefore: CampaignMetrics = {
                    cpp: proposal.cpp_TruocKhiThucThi || 0,
                    roas: proposal.roas_TruocKhiThucThi || 0,
                    chiTieu: proposal.chiTieu_TruocKhiThucThi || 0,
                };

                const metricsAfter: CampaignMetrics = {
                    cpp: currentMetrics.cpp,
                    roas: currentMetrics.roas,
                    chiTieu: currentMetrics.spend,
                    donHang: currentMetrics.purchases,
                    ctr: currentMetrics.ctr,
                    doanhThu: currentMetrics.revenue,
                };

                const comparison = compareMetrics(metricsBefore, metricsAfter);
                const summary = summarizeComparison(comparison);

                console.log(`[API:KIEM_TRA_GIAM_SAT] 📊 ${summary}`);

                // ===================================================================
                // STEP 6: Call QA Auditor để đánh giá
                // ===================================================================
                console.log('[API:KIEM_TRA_GIAM_SAT] 🤖 Gọi QA Auditor...');

                const daysAfterExecution = nextCheckpoint === 'D1' ? 1 :
                    nextCheckpoint === 'D3' ? 3 : 7;

                const qaResult = await kiemDinhChatLuong({
                    deXuat: proposal,
                    metricsTruoc: metricsBefore,
                    metricsSau: metricsAfter,
                    soNgay: daysAfterExecution,
                });

                // ===================================================================
                // STEP 7: Lưu observation vào QUAN_SAT
                // ===================================================================
                console.log('[API:KIEM_TRA_GIAM_SAT] 💾 Lưu observation...');

                await ghiQuanSat({
                    deXuatId: proposal.id,
                    checkpoint: nextCheckpoint,
                    metrics: metricsAfter,
                    danhGia: qaResult.danhGia,
                    phanTich: qaResult.phanTich,
                });

                result.observations_created++;

                // ===================================================================
                // STEP 8: Nếu D+7 → Extract pattern & update status
                // ===================================================================
                if (nextCheckpoint === 'D7') {
                    console.log('[API:KIEM_TRA_GIAM_SAT] 🎓 D+7 checkpoint - Extracting pattern...');

                    // Nếu thành công → extract pattern
                    if (qaResult.danhGia === 'THANH_CONG' && qaResult.baiHocRutRa) {
                        try {
                            const pattern = qaResult.baiHocRutRa;

                            await luuMauHoc({
                                loaiHanhDong: proposal.hanhDong.loai,
                                danhMuc: extractCategory(proposal),
                                moTa: pattern.moTa || 'Pattern từ campaign thành công',
                                dieuKien: extractConditions(proposal, comparison),
                                ketQua: pattern.ketQua || 'Cải thiện metrics',
                                soLanThanhCong: 1,
                                soLanThatBai: 0,
                            });

                            result.patterns_extracted++;
                            console.log('[API:KIEM_TRA_GIAM_SAT] ✅ Pattern extracted');
                        } catch (error) {
                            console.error('[API:KIEM_TRA_GIAM_SAT] ❌ Error extracting pattern:', error);
                            result.errors.push(`Pattern extraction failed: ${proposal.id}`);
                        }
                    }

                    // Update proposal status → HOAN_THANH
                    await capNhatTrangThaiDeXuat(proposal.id, {
                        trangThai: 'HOAN_THANH',
                        ketQua_CuoiCung: qaResult.danhGia,
                    });

                    console.log(`[API:KIEM_TRA_GIAM_SAT] 🏁 Hoàn thành: ${qaResult.danhGia}`);
                }

            } catch (error) {
                console.error(`[API:KIEM_TRA_GIAM_SAT] ❌ Error processing ${proposal.id}:`, error);
                result.errors.push(`${proposal.tenCampaign}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // ===================================================================
        // STEP 9: Return results
        // ===================================================================
        console.log('[API:KIEM_TRA_GIAM_SAT] ✅ Hoàn thành monitoring check');
        console.log(`[API:KIEM_TRA_GIAM_SAT] 📊 Processed: ${result.processed}, Observations: ${result.observations_created}`);

        return NextResponse.json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error('[API:KIEM_TRA_GIAM_SAT] ❌ Fatal error:', error);

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
            data: result,
        }, { status: 500 });
    }
}

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

/**
 * Extract category từ proposal để classify pattern
 */
function extractCategory(proposal: any): string {
    const cpp = proposal.cpp_TruocKhiThucThi || 0;
    const roas = proposal.roas_TruocKhiThucThi || 0;

    if (cpp > 300000) return 'HIGH_CPP';
    if (roas < 1.5) return 'LOW_ROAS';
    if (proposal.hanhDong.loai === 'TAM_DUNG') return 'PAUSE_CAMPAIGN';
    if (proposal.hanhDong.loai === 'THAY_DOI_NGAN_SACH') return 'BUDGET_CHANGE';

    return 'GENERAL';
}

/**
 * Extract conditions từ proposal state
 */
function extractConditions(proposal: any, comparison: any): string {
    const conditions: string[] = [];

    if (proposal.cpp_TruocKhiThucThi > 250000) {
        conditions.push('CPP > 250k');
    }

    if (proposal.roas_TruocKhiThucThi < 2.0) {
        conditions.push('ROAS < 2.0');
    }

    if (comparison.improvement.overall_improved) {
        conditions.push('Sau khi áp dụng có cải thiện');
    }

    return conditions.join(', ') || 'Standard conditions';
}
