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
import { taoDeXuat, type TaoDeXuatInput } from '@/lib/de-xuat/tao-de-xuat';
import { getFacebookClient } from '@/lib/facebook/client';
import { calculateMetrics } from '@/lib/facebook/metrics';

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
        const session = await getServerSession();

        if (!session?.user?.email) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = session.user.email; // Use email as user ID
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

        const fb = await getFacebookClient(userId);

        // Fetch campaign basic info
        const campaignResponse = await fb.get(`${campaignId}`, {
            fields: 'name,status,daily_budget,lifetime_budget,created_time',
        });

        const campaignInfo = campaignResponse.data;
        const tenCampaign = campaignInfo.name;
        const status = campaignInfo.status;

        console.log(`[API:TAO_DE_XUAT] 📊 Campaign: ${tenCampaign} (${status})`);

        // ===================================================================
        // STEP 4: Fetch Metrics (Current Period)
        // ===================================================================
        console.log('[API:TAO_DE_XUAT] 📈 Fetching metrics...');

        const insightsResponse = await fb.get(`${campaignId}/insights`, {
            time_range: JSON.stringify({
                since: startDate,
                until: endDate,
            }),
            fields: 'spend,purchase,purchase_roas,ctr,clicks,impressions,action_values',
            level: 'campaign',
        });

        const insights = insightsResponse.data?.data?.[0];

        if (!insights) {
            return NextResponse.json(
                { success: false, error: 'Không có dữ liệu insights cho campaign này trong khoảng thời gian đã chọn' },
                { status: 404 }
            );
        }

        // Calculate metrics
        const metrics = calculateMetrics([insights]); // Use existing helper
        const metrics_HienTai = {
            cpp: metrics.cpp,
            roas: metrics.roas,
            chiTieu: metrics.spend,
            donHang: metrics.purchases,
            ctr: metrics.ctr,
            doanhThu: metrics.revenue,
        };

        console.log(`[API:TAO_DE_XUAT] ✅ Metrics: CPP ${metrics.cpp.toLocaleString()}, ROAS ${metrics.roas.toFixed(2)}`);

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

            const historyResponse = await fb.get(`${campaignId}/insights`, {
                time_range: JSON.stringify({
                    since: historyStartDate.toISOString().split('T')[0],
                    until: historyEndDate.toISOString().split('T')[0],
                }),
                fields: 'spend,purchase,purchase_roas',
                level: 'campaign',
                time_increment: 1, // Daily breakdown
            });

            const historyData = historyResponse.data?.data || [];

            if (historyData.length > 0) {
                metrics_LichSu = historyData.map((day: any) => {
                    const dayMetrics = calculateMetrics([day]);
                    return {
                        ngay: day.date_start,
                        cpp: dayMetrics.cpp,
                        roas: dayMetrics.roas,
                        chiTieu: dayMetrics.spend,
                    };
                });

                console.log(`[API:TAO_DE_XUAT] ✅ Lịch sử: ${metrics_LichSu.length} ngày`);
            }
        } catch (error) {
            console.warn('[API:TAO_DE_XUAT] ⚠️ Không lấy được lịch sử, tiếp tục without it');
        }

        // ===================================================================
        // STEP 6: Calculate soNgay_DaChay
        // ===================================================================
        let soNgay_DaChay: number | undefined;

        if (campaignInfo.created_time) {
            const createdDate = new Date(campaignInfo.created_time);
            const now = new Date();
            const diffMs = now.getTime() - createdDate.getTime();
            soNgay_DaChay = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        // ===================================================================
        // STEP 7: Get budget (nếu có)
        // ===================================================================
        const ngan_sach_hien_tai = campaignInfo.daily_budget
            ? parseInt(campaignInfo.daily_budget) / 100 // FB API returns cents
            : undefined;

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
