/**
 * ===================================================================
 * API ENDPOINT: THỰC THI ĐỀ XUẤT
 * ===================================================================
 * Route: POST /api/de-xuat/thuc-thi
 * 
 * Mô tả:
 * Execute một approved proposal bằng cách call Facebook API.
 * Hỗ trợ các actions:
 * - TAM_DUNG: Pause campaign
 * - THAY_DOI_NGAN_SACH: Update daily budget
 * - DUNG_VINH_VIEN: Stop campaign
 * 
 * Request Body:
 * {
 *   deXuatId: string
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data?: {
 *     message: string,
 *     facebook_response: any
 *   },
 *   error?: string
 * }
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
    layDeXuatTheoId,
    capNhatThongTinThucThi,
} from '@/lib/sheets/de-xuat-sheet';
import { getFacebookClient } from '@/lib/facebook/client';

// ===================================================================
// TYPES
// ===================================================================

interface RequestBody {
    deXuatId: string;
}

// ===================================================================
// POST HANDLER
// ===================================================================

export async function POST(request: NextRequest) {
    try {
        console.log('[API:THUC_THI_DE_XUAT] 📨 Nhận request thực thi đề xuất');

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

        const userId = session.user.email;

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

        const { deXuatId } = body;

        if (!deXuatId) {
            return NextResponse.json(
                { success: false, error: 'Missing deXuatId' },
                { status: 400 }
            );
        }

        console.log(`[API:THUC_THI_DE_XUAT] 🎯 Proposal ID: ${deXuatId}`);

        // ===================================================================
        // STEP 3: Verify proposal
        // ===================================================================
        const deXuat = await layDeXuatTheoId(deXuatId);

        if (!deXuat) {
            return NextResponse.json(
                { success: false, error: 'Proposal not found' },
                { status: 404 }
            );
        }

        if (deXuat.userId !== userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 403 }
            );
        }

        // Check status
        if (deXuat.trangThai !== 'DA_DUYET') {
            return NextResponse.json(
                {
                    success: false,
                    error: `Cannot execute proposal with status: ${deXuat.trangThai}. Only DA_DUYET proposals can be executed.`,
                },
                { status: 400 }
            );
        }

        console.log(`[API:THUC_THI_DE_XUAT] ⚡ Action: ${deXuat.hanhDong.loai}`);

        // ===================================================================
        // STEP 4: Execute via Facebook API
        // ===================================================================
        const fb = await getFacebookClient(userId);
        let fbResponse: any;
        let thanhCong = false;
        let thongDiep = '';

        try {
            switch (deXuat.hanhDong.loai) {
                case 'TAM_DUNG':
                    // Pause campaign
                    console.log('[API:THUC_THI_DE_XUAT] ⏸️ Pausing campaign...');
                    fbResponse = await fb.post(`${deXuat.campaignId}`, {
                        status: 'PAUSED',
                    });
                    thanhCong = true;
                    thongDiep = 'Campaign đã được tạm dừng';
                    break;

                case 'THAY_DOI_NGAN_SACH':
                    // Update daily budget
                    const newBudget = deXuat.hanhDong.giaTri_DeXuat;
                    console.log(`[API:THUC_THI_DE_XUAT] 💰 Updating budget to ${newBudget}...`);

                    // Facebook expects budget in cents
                    const budgetInCents = typeof newBudget === 'number' ? newBudget * 100 : parseInt(String(newBudget)) * 100;

                    fbResponse = await fb.post(`${deXuat.campaignId}`, {
                        daily_budget: budgetInCents.toString(),
                    });
                    thanhCong = true;
                    thongDiep = `Budget đã được cập nhật thành ${newBudget.toLocaleString()} VND`;
                    break;

                case 'DUNG_VINH_VIEN':
                    // Stop campaign permanently
                    console.log('[API:THUC_THI_DE_XUAT] 🛑 Stopping campaign permanently...');
                    fbResponse = await fb.post(`${deXuat.campaignId}`, {
                        status: 'DELETED',
                    });
                    thanhCong = true;
                    thongDiep = 'Campaign đã được dừng vĩnh viễn';
                    break;

                case 'LAM_MOI_CREATIVE':
                case 'DIEU_CHINH_DOI_TUONG':
                    // These actions cannot be automated via API
                    // Require manual intervention
                    thanhCong = false;
                    thongDiep = 'Action này cần thực hiện manual. Vui lòng vào Facebook Ads Manager để thực hiện.';
                    break;

                default:
                    throw new Error(`Unsupported action type: ${deXuat.hanhDong.loai}`);
            }
        } catch (error: any) {
            console.error('[API:THUC_THI_DE_XUAT] ❌ Facebook API error:', error);
            thanhCong = false;
            thongDiep = error.message || 'Failed to execute action on Facebook';
            fbResponse = { error: error.message };
        }

        // ===================================================================
        // STEP 5: Update proposal status
        // ===================================================================
        // Calculate monitoring end date (D+7)
        const giamSatDenNgay = new Date();
        giamSatDenNgay.setDate(giamSatDenNgay.getDate() + 7);
        const giamSatDenNgayStr = giamSatDenNgay.toISOString().split('T')[0];

        console.log('[API:THUC_THI_DE_XUAT] 💾 Updating proposal status...');

        await capNhatThongTinThucThi(
            deXuatId,
            thanhCong,
            thongDiep,
            giamSatDenNgayStr
        );

        console.log(`[API:THUC_THI_DE_XUAT] ✅ Execution ${thanhCong ? 'successful' : 'failed'}`);

        // ===================================================================
        // STEP 6: Return Response
        // ===================================================================
        return NextResponse.json(
            {
                success: thanhCong,
                data: {
                    message: thongDiep,
                    deXuatId,
                    campaign: deXuat.tenCampaign,
                    action: deXuat.hanhDong.loai,
                    facebook_response: fbResponse,
                    monitoring_until: thanhCong ? giamSatDenNgayStr : null,
                },
                error: thanhCong ? undefined : thongDiep,
            },
            { status: thanhCong ? 200 : 500 }
        );
    } catch (error) {
        console.error('[API:THUC_THI_DE_XUAT] ❌ Unexpected error:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        );
    }
}
