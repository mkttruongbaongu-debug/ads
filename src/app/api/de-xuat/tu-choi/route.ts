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
 * Uses Apps Script Proxy instead of direct Google Sheets API
 * to avoid Service Account credential issues.
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
 * Updated: 2026-02-06 - Switch to Apps Script Proxy
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

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
        console.log(`[API:TU_CHOI_DE_XUAT] 👤 User: ${userId}`);

        // ===================================================================
        // STEP 3: Call Apps Script to update proposal
        // ===================================================================
        const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const apiSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

        if (!appsScriptUrl || !apiSecret) {
            console.error('[API:TU_CHOI_DE_XUAT] ❌ Missing Apps Script config');
            return NextResponse.json(
                { success: false, error: 'Server configuration error' },
                { status: 500 }
            );
        }

        console.log('[API:TU_CHOI_DE_XUAT] 📤 Calling Apps Script capNhatDeXuat...');

        const updatePayload = {
            action: 'capNhatDeXuat',
            secret: apiSecret,
            id: deXuatId,
            trangThai: 'BI_TU_CHOI',
            nguoiDuyet: userId,
            thoiGian_Duyet: new Date().toISOString(),
            ghiChu_NguoiDung: ghiChu,
        };

        console.log('[API:TU_CHOI_DE_XUAT] 📦 Payload:', JSON.stringify(updatePayload, null, 2));

        const response = await fetch(`${appsScriptUrl}?action=capNhatDeXuat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatePayload),
        });

        const responseText = await response.text();
        console.log('[API:TU_CHOI_DE_XUAT] 📥 Response text:', responseText);

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error('[API:TU_CHOI_DE_XUAT] ❌ Failed to parse response:', e);
            return NextResponse.json(
                { success: false, error: 'Invalid response from Apps Script' },
                { status: 500 }
            );
        }

        if (!result.success) {
            console.error('[API:TU_CHOI_DE_XUAT] ❌ Apps Script error:', result.error);
            return NextResponse.json(
                { success: false, error: result.error || 'Apps Script error' },
                { status: 500 }
            );
        }

        console.log('[API:TU_CHOI_DE_XUAT] ✅ Proposal rejected successfully');

        // ===================================================================
        // STEP 4: Return Response
        // ===================================================================
        return NextResponse.json(
            {
                success: true,
                data: {
                    message: 'Đề xuất đã bị từ chối',
                    deXuatId,
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
