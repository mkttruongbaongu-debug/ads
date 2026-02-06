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
 * Uses Apps Script Proxy instead of direct Google Sheets API
 * to avoid Service Account credential issues.
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
        console.log(`[API:DUYET_DE_XUAT] 👤 User: ${userId}`);

        // ===================================================================
        // STEP 3: Call Apps Script to update proposal
        // ===================================================================
        const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const apiSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

        if (!appsScriptUrl || !apiSecret) {
            console.error('[API:DUYET_DE_XUAT] ❌ Missing Apps Script config');
            return NextResponse.json(
                { success: false, error: 'Server configuration error' },
                { status: 500 }
            );
        }

        console.log('[API:DUYET_DE_XUAT] 📤 Calling Apps Script capNhatDeXuat...');

        const updatePayload = {
            action: 'capNhatDeXuat',
            secret: apiSecret,
            id: deXuatId,
            trangThai: 'DA_DUYET',
            nguoiDuyet: userId,
            thoiGian_Duyet: new Date().toISOString(),
            ghiChu_NguoiDung: ghiChu || '',
        };

        console.log('[API:DUYET_DE_XUAT] 📦 Payload:', JSON.stringify(updatePayload, null, 2));

        const response = await fetch(`${appsScriptUrl}?action=capNhatDeXuat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatePayload),
        });

        const responseText = await response.text();
        console.log('[API:DUYET_DE_XUAT] 📥 Response text:', responseText);

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error('[API:DUYET_DE_XUAT] ❌ Failed to parse response:', e);
            return NextResponse.json(
                { success: false, error: 'Invalid response from Apps Script' },
                { status: 500 }
            );
        }

        if (!result.success) {
            console.error('[API:DUYET_DE_XUAT] ❌ Apps Script error:', result.error);
            return NextResponse.json(
                { success: false, error: result.error || 'Apps Script error' },
                { status: 500 }
            );
        }

        console.log('[API:DUYET_DE_XUAT] ✅ Proposal approved successfully');

        // ===================================================================
        // STEP 4: Return Response
        // ===================================================================
        return NextResponse.json(
            {
                success: true,
                data: {
                    message: 'Đề xuất đã được duyệt',
                    deXuatId,
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
