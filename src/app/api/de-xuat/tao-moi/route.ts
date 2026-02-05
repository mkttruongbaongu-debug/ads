/**
 * ===================================================================
 * API ENDPOINT: TẠO ĐỀ XUẤT MỚI
 * ===================================================================
 * Route: POST /api/de-xuat/tao-moi
 * 
 * Mô tả:
 * API endpoint để tạo đề xuất mới cho một campaign.
 * Nhận campaign data, gọi AI analysis, tạo proposal và lưu vào database.
 * 
 * Request Body:
 * {
 *   campaignId: string,
 *   startDate: string (ISO date),
 *   endDate: string (ISO date),
 *   accountId: string
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data?: {
 *     deXuatId: string,
 *     uuTien: string,
 *     tomTat: string,
 *     hanhDong: { loai: string, moTa: string }
 *   },
 *   error?: string
 * }
 * 
 * Flow:
 * 1. Authenticate user (NextAuth session)
 * 2. Validate input
 * 3. Fetch campaign data từ Facebook API
 * 4. Fetch historical metrics
 * 5. Call taoDeXuat logic
 * 6. Return response
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { taoDeXuat, type TaoDeXuatInput } from '@/lib/de-xuat/tao-de-xuat';
import { getFacebookClient } from '@/lib/facebook/client';
import { calculateDerivedMetrics } from '@/lib/facebook/metrics';

// ===================================================================
// TYPES
// ===================================================================

interface RequestBody {
    campaignId: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    accountId: string;
}

// ===================================================================
// POST HANDLER
// ===================================================================

export async function POST(request: NextRequest) {
    try {
        console.log('[API:TAO_DE_XUAT] 📨 Nhận request tạo đề xuất');

        // ===================================================================
        // STEP 1: Authentication
        // ===================================================================
        const session = await getServerSession(authOptions);

        if (!session) {
            console.log('[API:TAO_MOI_DE_XUAT] ❌ Unauthorized: No session');
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = session.user?.name || session.user?.email || 'unknown'; // Use name or email as user ID
        console.log(`[API:TAO_DE_XUAT] 👤 User: ${userId}`);

        // ===================================================================
        // STEP 2: Parse & Validate Request
        // ===================================================================
        let body: RequestBody;

        try {
            body = await request.json();
        } catch (e) {
            return NextResponse.json(
                { success: false, error: 'Invalid JSON body' },
                { status: 400 }
            );
        }

        const { campaignId, startDate, endDate, accountId } = body;

        // Validation
        if (!campaignId || !startDate || !endDate || !accountId) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: campaignId, startDate, endDate, accountId' },
                { status: 400 }
            );
        }

        console.log(`[API:TAO_DE_XUAT] 🎯 Campaign: ${campaignId}`);
        console.log(`[API:TAO_DE_XUAT] 📅 Date range: ${startDate} → ${endDate}`);

        // ===================================================================
        // STEP 3: Fetch Campaign Data từ Facebook API
        // ===================================================================
        console.log('[API:TAO_DE_XUAT] 🔍 Fetching campaign data from Facebook...');

        const fb = getFacebookClient();

        // ===================================================================
        // STEP 4: Fetch Metrics (Current Period)
        // ===================================================================
        console.log('[API:TAO_DE_XUAT] 📈 Fetching metrics...');

        const insights = await fb.getInsights(
            accountId,
            {
                startDate: startDate,
                endDate: endDate
            },
            'campaign'
        );

        // Filter insights for this specific campaign
        const campaignInsights = insights.filter(i => i.campaign_id === campaignId);

        if (campaignInsights.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Không có dữ liệu insights cho campaign này trong khoảng thời gian đã chọn' },
                { status: 404 }
            );
        }

        // Aggregate metrics (sum across days if multiple)
        const totalMetrics = campaignInsights.reduce((acc, insight) => {
            // Extract purchases from actions array
            const purchaseAction = insight.actions?.find(a => a.action_type === 'omni_purchase' || a.action_type === 'purchase');
            const purchases = purchaseAction ? parseInt(purchaseAction.value) : 0;

            // Extract revenue from action_values array
            const revenueAction = insight.action_values?.find(a => a.action_type === 'omni_purchase' || a.action_type === 'purchase');
            const revenue = revenueAction ? parseFloat(revenueAction.value) : 0;

            return {
                spend: acc.spend + (parseFloat(insight.spend) || 0),
                purchases: acc.purchases + purchases,
                revenue: acc.revenue + revenue,
                clicks: acc.clicks + (parseInt(insight.clicks) || 0),
                impressions: acc.impressions + (parseInt(insight.impressions) || 0),
            };
        }, { spend: 0, purchases: 0, revenue: 0, clicks: 0, impressions: 0 });

        // Calculate derived metrics
        const cpp = totalMetrics.purchases > 0 ? totalMetrics.spend / totalMetrics.purchases : 0;
        const roas = totalMetrics.spend > 0 ? totalMetrics.revenue / totalMetrics.spend : 0;
        const ctr = totalMetrics.impressions > 0 ? (totalMetrics.clicks / totalMetrics.impressions) * 100 : 0;

        const metrics_HienTai = {
            cpp,
            roas,
            chiTieu: totalMetrics.spend,
            donHang: totalMetrics.purchases,
            ctr,
            doanhThu: totalMetrics.revenue,
        };

        console.log(`[API:TAO_DE_XUAT] ✅ Metrics: CPP ${cpp.toLocaleString()}, ROAS ${roas.toFixed(2)}`);

        // Get campaign name from insights (if available)
        const tenCampaign = campaignInsights[0]?.campaign_name || `Campaign ${campaignId}`;
        const status = 'ACTIVE'; // Default, can be fetched from getCampaigns if needed

        // ===================================================================
        // STEP 5: Fetch Historical Metrics (Optional - last 7 days before startDate)
        // ===================================================================
        let metrics_LichSu: any[] | undefined;

        try {
            const historyEndDate = new Date(startDate);
            historyEndDate.setDate(historyEndDate.getDate() - 1);
            const historyStartDate = new Date(historyEndDate);
            historyStartDate.setDate(historyStartDate.getDate() - 6); // 7 days total

            console.log('[API:TAO_DE_XUAT] 📚 Fetching historical data...');

            const historyInsights = await fb.getInsights(
                accountId,
                {
                    startDate: historyStartDate.toISOString().split('T')[0],
                    endDate: historyEndDate.toISOString().split('T')[0]
                },
                'campaign'
            );

            const historyData = historyInsights.filter(i => i.campaign_id === campaignId);

            if (historyData.length > 0) {
                metrics_LichSu = historyData.map((day) => {
                    const daySpend = parseFloat(day.spend) || 0;
                    const purchaseAction = day.actions?.find(a => a.action_type === 'omni_purchase' || a.action_type === 'purchase');
                    const dayPurchases = purchaseAction ? parseInt(purchaseAction.value) : 0;
                    const revenueAction = day.action_values?.find(a => a.action_type === 'omni_purchase' || a.action_type === 'purchase');
                    const dayRevenue = revenueAction ? parseFloat(revenueAction.value) : 0;

                    return {
                        ngay: day.date_start,
                        cpp: dayPurchases > 0 ? daySpend / dayPurchases : 0,
                        roas: daySpend > 0 ? dayRevenue / daySpend : 0,
                        chiTieu: daySpend,
                    };
                });

                console.log(`[API:TAO_DE_XUAT] ✅ Lịch sử: ${metrics_LichSu.length} ngày`);
            }
        } catch (error) {
            console.warn('[API:TAO_DE_XUAT] ⚠️ Không lấy được lịch sử, tiếp tục without it');
        }

        // ===================================================================
        // STEP 6: Calculate soNgay_DaChay (estimate from insights date_start)
        // ===================================================================
        let soNgay_DaChay: number | undefined;

        if (campaignInsights[0]?.date_start) {
            const createdDate = new Date(campaignInsights[0].date_start);
            const now = new Date();
            const diffMs = now.getTime() - createdDate.getTime();
            soNgay_DaChay = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        // ===================================================================
        // STEP 7: Get budget (if available from insights)
        // ===================================================================
        const ngan_sach_hien_tai = undefined; // Not available from insights API

        // ===================================================================
        // STEP 8: Call taoDeXuat Logic
        // ===================================================================
        console.log('[API:TAO_DE_XUAT] 🤖 Gọi hệ thống tạo đề xuất...');

        const input: TaoDeXuatInput = {
            userId,
            campaignId,
            tenCampaign,
            status,
            metrics_HienTai,
            metrics_LichSu,
            soNgay_DaChay,
            ngan_sach_hien_tai,
            // muc_tieu could be fetched from user settings if available
        };

        const ketQua = await taoDeXuat(input);

        // ===================================================================
        // STEP 9: Return Response
        // ===================================================================
        if (ketQua.success) {
            console.log(`[API:TAO_DE_XUAT] ✅ Thành công! Đề xuất ID: ${ketQua.data?.deXuatId}`);

            return NextResponse.json(ketQua, { status: 200 });
        } else {
            console.error(`[API:TAO_DE_XUAT] ❌ Thất bại: ${ketQua.error}`);

            return NextResponse.json(ketQua, { status: 500 });
        }
    } catch (error) {
        console.error('[API:TAO_DE_XUAT] ❌ Unexpected error:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        );
    }
}
