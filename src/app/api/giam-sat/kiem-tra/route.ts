/**
 * ===================================================================
 * API ENDPOINT: KIỂM TRA GIÁM SÁT (MONITORING CHECKER) v2
 * ===================================================================
 * Route: POST /api/giam-sat/kiem-tra
 * 
 * v2 Changes:
 * - Fetch daily metrics (time_increment=1) thay vì 3-day aggregate
 * - evaluateWithTrend(): thuật toán tính trend/delta/volatility
 * - evaluateWithAI(): gọi OpenAI với data đã tính sẵn
 * - Lưu dailyTrend_SauKhi + dailyTrend_TruocKhi vào observation
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Apps Script helpers
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

type DailyMetric = {
    date: string;
    spend: number;
    purchases: number;
    revenue: number;
    cpp: number;
    ctr: number;
    roas: number;
};

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
    return null;
}

function formatMoney(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return `${Math.round(n)}đ`;
}

// ===================================================================
// TREND ANALYSIS (THUẬT TOÁN — nhanh, chính xác, miễn phí)
// ===================================================================

interface TrendAnalysis {
    direction: 'TANG' | 'GIAM' | 'ON_DINH' | 'DAO_DONG';
    avgCpp: number;
    avgRoas: number;
    avgSpend: number;
    totalPurchases: number;
    totalRevenue: number;
    cppChange_Percent: number;
    volatility_Percent: number;
    days: number;
}

function analyzeTrend(daily: DailyMetric[]): TrendAnalysis {
    if (daily.length === 0) {
        return {
            direction: 'ON_DINH', avgCpp: 0, avgRoas: 0, avgSpend: 0,
            totalPurchases: 0, totalRevenue: 0, cppChange_Percent: 0, volatility_Percent: 0, days: 0,
        };
    }

    const totalSpend = daily.reduce((s, d) => s + d.spend, 0);
    const totalPurchases = daily.reduce((s, d) => s + d.purchases, 0);
    const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);

    const avgCpp = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
    const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const avgSpend = totalSpend / daily.length;

    // CPP trend: first half vs second half
    const daysWithPurchases = daily.filter(d => d.purchases > 0);

    let cppChange_Percent = 0;
    if (daysWithPurchases.length >= 4) {
        const halfIdx = Math.floor(daysWithPurchases.length / 2);
        const firstHalf = daysWithPurchases.slice(0, halfIdx);
        const secondHalf = daysWithPurchases.slice(halfIdx);
        const avgFirst = firstHalf.reduce((s, d) => s + d.cpp, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((s, d) => s + d.cpp, 0) / secondHalf.length;
        cppChange_Percent = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;
    } else if (daily.length >= 2) {
        const mid = Math.floor(daily.length / 2);
        const firstHalf = daily.slice(0, mid);
        const secondHalf = daily.slice(mid);
        const spendFirst = firstHalf.reduce((s, d) => s + d.spend, 0) / firstHalf.length;
        const spendSecond = secondHalf.reduce((s, d) => s + d.spend, 0) / secondHalf.length;
        cppChange_Percent = spendFirst > 0 ? ((spendSecond - spendFirst) / spendFirst) * 100 : 0;
    }

    // Volatility: coefficient of variation of CPP
    const cpps = daysWithPurchases.map(d => d.cpp);
    let volatility_Percent = 0;
    if (cpps.length >= 3) {
        const mean = cpps.reduce((s, v) => s + v, 0) / cpps.length;
        if (mean > 0) {
            const variance = cpps.reduce((s, v) => s + (v - mean) ** 2, 0) / cpps.length;
            volatility_Percent = (Math.sqrt(variance) / mean) * 100;
        }
    }

    // Direction
    let direction: TrendAnalysis['direction'];
    if (volatility_Percent > 50) {
        direction = 'DAO_DONG';
    } else if (cppChange_Percent < -10) {
        direction = 'GIAM';
    } else if (cppChange_Percent > 10) {
        direction = 'TANG';
    } else {
        direction = 'ON_DINH';
    }

    return {
        direction, avgCpp, avgRoas, avgSpend,
        totalPurchases, totalRevenue, cppChange_Percent, volatility_Percent,
        days: daily.length,
    };
}

function evaluateWithTrend(
    trendBefore: TrendAnalysis,
    trendAfter: TrendAnalysis,
    before: MetricsTaiThoiDiem,
    after: MetricsTaiThoiDiem
): { danhGia: DanhGiaKetQua; cppChange: number; roasChange: number } {
    const cppChange = before.cpp > 0
        ? ((after.cpp - before.cpp) / before.cpp) * 100
        : 0;
    const roasChange = before.roas > 0
        ? ((after.roas - before.roas) / before.roas) * 100
        : 0;

    let score = 0;
    if (cppChange < -10) score += 2;
    else if (cppChange < -5) score += 1;
    else if (cppChange > 10) score -= 2;
    else if (cppChange > 5) score -= 1;

    if (roasChange > 10) score += 2;
    else if (roasChange > 5) score += 1;
    else if (roasChange < -10) score -= 2;
    else if (roasChange < -5) score -= 1;

    // Bonus: trend direction improved
    if (trendBefore.direction === 'TANG' && trendAfter.direction !== 'TANG') score += 1;
    if (trendBefore.direction !== 'GIAM' && trendAfter.direction === 'GIAM') score += 1;

    const danhGia: DanhGiaKetQua = score >= 2 ? 'CAI_THIEN' : score <= -2 ? 'XAU_DI' : 'TRUNG_TINH';

    return { danhGia, cppChange, roasChange };
}

// ===================================================================
// AI EVALUATION (OpenAI — suy luận context)
// ===================================================================

async function evaluateWithAI(
    deXuat: DeXuat,
    checkpoint: number,
    trendBefore: TrendAnalysis,
    trendAfter: TrendAnalysis,
    dailyBefore: DailyMetric[],
    dailyAfter: DailyMetric[],
    cppChange: number,
    roasChange: number,
    danhGia: DanhGiaKetQua
): Promise<{ giaiThich: string; yeuTo_AnhHuong: string[]; duDoan_TiepTheo: string }> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const beforeText = dailyBefore.map(d =>
        `${d.date}: spend=${formatMoney(d.spend)}, ${d.purchases}đơn, CPP=${d.purchases > 0 ? formatMoney(d.cpp) : '-'}, ROAS=${d.roas > 0 ? d.roas.toFixed(2) + 'x' : '-'}`
    ).join('\n');

    const afterText = dailyAfter.map(d =>
        `${d.date}: spend=${formatMoney(d.spend)}, ${d.purchases}đơn, CPP=${d.purchases > 0 ? formatMoney(d.cpp) : '-'}, ROAS=${d.roas > 0 ? d.roas.toFixed(2) + 'x' : '-'}`
    ).join('\n');

    const trendLabel = (t: TrendAnalysis) =>
        `${t.direction} | CPP TB: ${formatMoney(t.avgCpp)} | ROAS TB: ${t.avgRoas.toFixed(2)}x | Volatility: ${t.volatility_Percent.toFixed(0)}% | CPP change: ${t.cppChange_Percent > 0 ? '+' : ''}${t.cppChange_Percent.toFixed(0)}%`;

    const nextCheckpoint = checkpoint < 7 ? (checkpoint === 1 ? 3 : 7) : 'kết thúc';

    const prompt = `Bạn là chuyên gia Facebook Ads. Phân tích kết quả sau khi thực thi hành động.

HÀNH ĐỘNG ĐÃ THỰC THI: ${deXuat.hanhDong.loai}
LÝ DO: ${deXuat.hanhDong.lyDo}
CÁC BƯỚC: ${deXuat.hanhDong.cacBuoc?.join(', ') || 'N/A'}

CHECKPOINT: D+${checkpoint}

===== TREND TRƯỚC THỰC THI (${trendBefore.days} ngày) =====
${trendLabel(trendBefore)}
${beforeText || 'Không có data daily'}

===== TREND SAU THỰC THI (${trendAfter.days} ngày) =====
${trendLabel(trendAfter)}
${afterText}

===== DELTA (thuật toán đã tính) =====
CPP: ${cppChange > 0 ? '+' : ''}${cppChange.toFixed(1)}%
ROAS: ${roasChange > 0 ? '+' : ''}${roasChange.toFixed(1)}%
Đánh giá sơ bộ: ${danhGia}

===== YÊU CẦU =====
1. Hành động có TẠO RA thay đổi hay xu hướng ĐÃ CÓ SẴN từ trước?
2. Nếu D+1: cảnh báo rằng FB cần 24-48h redistribute, kết luận có thể chưa chính xác
3. Yếu tố nào có thể ảnh hưởng ngoài hành động?
4. Dự đoán tiếp theo (D+${nextCheckpoint})

Trả lời JSON:
{
  "giaiThich": "2-3 câu phân tích ngắn gọn bằng tiếng Việt",
  "yeuTo_AnhHuong": ["yếu tố 1", "yếu tố 2"],
  "duDoan_TiepTheo": "1 câu dự đoán"
}`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            max_tokens: 500,
            temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
            const parsed = JSON.parse(content);
            return {
                giaiThich: parsed.giaiThich || 'Không có phân tích',
                yeuTo_AnhHuong: parsed.yeuTo_AnhHuong || [],
                duDoan_TiepTheo: parsed.duDoan_TiepTheo || 'Tiếp tục giám sát',
            };
        }
    } catch (err) {
        console.warn('[GIAM_SAT] ⚠️ AI evaluation failed, using fallback:', err);
    }

    // Fallback: template-based (khi AI fail)
    return {
        giaiThich: `D+${checkpoint}: CPP ${cppChange > 0 ? 'tăng' : 'giảm'} ${Math.abs(cppChange).toFixed(0)}%, ROAS ${roasChange > 0 ? 'tăng' : 'giảm'} ${Math.abs(roasChange).toFixed(0)}%. Trend trước: ${trendBefore.direction}. Trend sau: ${trendAfter.direction}.`,
        yeuTo_AnhHuong: danhGia === 'CAI_THIEN' ? ['Metrics cải thiện'] : danhGia === 'XAU_DI' ? ['Metrics xấu đi'] : ['Chưa có thay đổi rõ ràng'],
        duDoan_TiepTheo: checkpoint < 7 ? `Tiếp tục giám sát đến D+${checkpoint === 1 ? 3 : 7}` : 'Kết thúc giám sát',
    };
}

// ===================================================================
// POST HANDLER
// ===================================================================

export async function POST(request: NextRequest) {
    console.log('[GIAM_SAT] 🔍 Bắt đầu kiểm tra giám sát v2...');

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

        // ===== FETCH DAILY METRICS SAU THỰC THI =====
        const endDate = new Date().toISOString().split('T')[0];
        const execDate = new Date(executionDate);
        const startDate = execDate.toISOString().split('T')[0];

        let dailyAfter: DailyMetric[] = [];
        let currentMetrics: MetricsTaiThoiDiem;

        try {
            const insights = await fb.getInsights(
                deXuat.campaignId,
                { startDate, endDate },
                'campaign'
            );

            if (!insights || insights.length === 0) {
                errors.push(`${deXuat.tenCampaign}: Không có data kể từ ngày thực thi`);
                return;
            }

            let totalSpend = 0, totalRevenue = 0, totalPurchases = 0;
            let totalClicks = 0, totalImpressions = 0;

            for (const day of insights) {
                const spend = parseFloat(day.spend || '0');
                const impressions = parseInt(day.impressions || '0');
                const clicks = parseInt(day.clicks || '0');

                const actions = day.actions || [];
                const actionValues = day.action_values || [];

                const purchaseAction = actions.find(
                    (a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
                );
                const purchases = purchaseAction ? parseInt(purchaseAction.value || '0') : 0;

                const revenueAction = actionValues.find(
                    (a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
                );
                const revenue = revenueAction ? parseFloat(revenueAction.value || '0') : 0;

                totalSpend += spend;
                totalImpressions += impressions;
                totalClicks += clicks;
                totalPurchases += purchases;
                totalRevenue += revenue;

                dailyAfter.push({
                    date: day.date_start,
                    spend,
                    purchases,
                    revenue,
                    cpp: purchases > 0 ? spend / purchases : 0,
                    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                    roas: spend > 0 ? revenue / spend : 0,
                });
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

        // ===== TREND ANALYSIS (THUẬT TOÁN) =====
        const dailyBefore: DailyMetric[] = deXuat.dailyTrend_TruocKhi || [];
        const trendBefore = analyzeTrend(dailyBefore);
        const trendAfter = analyzeTrend(dailyAfter);

        const beforeMetrics = deXuat.metrics_TruocKhi;
        const { danhGia, cppChange, roasChange } = evaluateWithTrend(trendBefore, trendAfter, beforeMetrics, currentMetrics);

        console.log(`[GIAM_SAT] 📈 D+${checkpoint}: CPP ${cppChange > 0 ? '+' : ''}${cppChange.toFixed(1)}%, ROAS ${roasChange > 0 ? '+' : ''}${roasChange.toFixed(1)}% → ${danhGia}`);
        console.log(`[GIAM_SAT] 📊 Trend: ${trendBefore.direction} → ${trendAfter.direction} | Before CPP: ${formatMoney(trendBefore.avgCpp)} → After CPP: ${formatMoney(trendAfter.avgCpp)}`);

        // ===== AI EVALUATION (OpenAI) =====
        const phanTich_AI = await evaluateWithAI(
            deXuat, checkpoint,
            trendBefore, trendAfter,
            dailyBefore, dailyAfter,
            cppChange, roasChange, danhGia
        );

        // Create observation
        const quanSat: QuanSat = {
            id: generateId(),
            deXuatId: deXuat.id,
            checkpoint_Ngay: checkpoint,
            thoiGian_QuanSat: new Date().toISOString(),
            campaignId: deXuat.campaignId,
            metrics_HienTai: currentMetrics,
            metrics_TruocKhi: beforeMetrics,
            dailyTrend_SauKhi: dailyAfter,
            dailyTrend_TruocKhi: dailyBefore,
            cpp_ThayDoi_Percent: cppChange,
            roas_ThayDoi_Percent: roasChange,
            danhGia,
            phanTich_AI,
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
