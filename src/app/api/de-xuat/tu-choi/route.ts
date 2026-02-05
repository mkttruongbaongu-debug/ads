/**
 * ===================================================================
 * API ENDPOINT: TỪ CHỐI ĐỀ XUẤT
 * ===================================================================
 * Route: POST /api/de-xuat/tu-choi
 * 
 * Mô tả:
 * User reject một proposal.
 * Update status từ CHO_DUYET → BI_TU_CHOI.
 * 
 * Request Body:
 * {
 *   deXuatId: string,
 *   ghiChu: string (required - lý do từ chối)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data?: { message: string },
 *   error?: string
 * }
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { capNhatThongTinDuyet, layDeXuatTheoId } from '@/lib/sheets/de-xuat-sheet';

// ===================================================================
// TYPES
// ===================================================================

interface RequestBody {
    deXuatId: string;
    ghiChu: string; // Required for rejection
}

// ===================================================================
// POST HANDLER
// ===================================================================

export async function POST(request: NextRequest) {
    try {
        console.log('[API:TU_CHOI_DE_XUAT] 📨 Nhận request từ chối đề xuất');

        // ===================================================================
        // STEP 1: Authentication
        // ===================================================================
        const session = await getServerSession(authOptions);

        if (!session) {
            console.log('[API:TU_CHOI_DE_XUAT] ❌ Unauthorized: No session');
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = session.user?.name || session.user?.email || 'unknown';

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

        const { deXuatId, ghiChu } = body;

        if (!deXuatId) {
            return NextResponse.json(
                { success: false, error: 'Missing deXuatId' },
                { status: 400 }
            );
        }

        if (!ghiChu || ghiChu.trim() === '') {
            return NextResponse.json(
                { success: false, error: 'ghiChu (rejection reason) is required' },
                { status: 400 }
            );
        }

        console.log(`[API:TU_CHOI_DE_XUAT] 🎯 Proposal ID: ${deXuatId}`);
        console.log(`[API:TU_CHOI_DE_XUAT] 📝 Reason: ${ghiChu}`);

        // ===================================================================
        // STEP 3: Verify proposal exists & belongs to user
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
                { success: false, error: 'Unauthorized: Proposal belongs to another user' },
                { status: 403 }
            );
        }

        // Check current status
        if (deXuat.trangThai !== 'CHO_DUYET') {
            return NextResponse.json(
                {
                    success: false,
                    error: `Cannot reject proposal with status: ${deXuat.trangThai}. Only CHO_DUYET proposals can be rejected.`,
                },
                { status: 400 }
            );
        }

        // ===================================================================
        // STEP 4: Update proposal
        // ===================================================================
        console.log('[API:TU_CHOI_DE_XUAT] 🚫 Updating proposal to BI_TU_CHOI...');

        await capNhatThongTinDuyet(
            deXuatId,
            userId,
            'BI_TU_CHOI',
            ghiChu
        );

        console.log('[API:TU_CHOI_DE_XUAT] ✅ Proposal rejected successfully');

        // ===================================================================
        // STEP 5: Return Response
        // ===================================================================
        return NextResponse.json(
            {
                success: true,
                data: {
                    message: 'Đề xuất đã bị từ chối',
                    deXuatId,
                    campaign: deXuat.tenCampaign,
                    reason: ghiChu,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('[API:TU_CHOI_DE_XUAT] ❌ Error:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        );
    }
}
