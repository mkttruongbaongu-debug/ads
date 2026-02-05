/**
 * ===================================================================
 * API ENDPOINT: DUYỆT ĐỀ XUẤT
 * ===================================================================
 * Route: POST /api/de-xuat/duyet
 * 
 * Mô tả:
 * User approve một proposal.
 * Update status từ CHO_DUYET → DA_DUYET.
 * 
 * Request Body:
 * {
 *   deXuatId: string,
 *   ghiChu?: string
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
    ghiChu?: string;
}

// ===================================================================
// POST HANDLER
// ===================================================================

export async function POST(request: NextRequest) {
    try {
        console.log('[API:DUYET_DE_XUAT] 📨 Nhận request duyệt đề xuất');

        // ===================================================================
        // STEP 1: Authentication
        // ===================================================================
        const session = await getServerSession(authOptions);

        if (!session) {
            console.log('[API:DUYET_DE_XUAT] ❌ Unauthorized: No session');
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

        console.log(`[API:DUYET_DE_XUAT] 🎯 Proposal ID: ${deXuatId}`);

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
                    error: `Cannot approve proposal with status: ${deXuat.trangThai}. Only CHO_DUYET proposals can be approved.`,
                },
                { status: 400 }
            );
        }

        // ===================================================================
        // STEP 4: Update proposal
        // ===================================================================
        console.log('[API:DUYET_DE_XUAT] ✅ Updating proposal to DA_DUYET...');

        await capNhatThongTinDuyet(
            deXuatId,
            userId,
            'DA_DUYET',
            ghiChu
        );

        console.log('[API:DUYET_DE_XUAT] ✅ Proposal approved successfully');

        // ===================================================================
        // STEP 5: Return Response
        // ===================================================================
        return NextResponse.json(
            {
                success: true,
                data: {
                    message: 'Đề xuất đã được duyệt',
                    deXuatId,
                    campaign: deXuat.tenCampaign,
                    action: deXuat.hanhDong.loai,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('[API:DUYET_DE_XUAT] ❌ Error:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        );
    }
}
