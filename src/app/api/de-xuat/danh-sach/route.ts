/**
 * ===================================================================
 * API ENDPOINT: LẤY DANH SÁCH ĐỀ XUẤT
 * ===================================================================
 * Route: GET /api/de-xuat/danh-sach
 * 
 * Mô tả:
 * API để lấy danh sách proposals, hỗ trợ filtering theo status, priority.
 * Dùng cho Proposals Inbox UI.
 * 
 * Query Parameters:
 * - status?: 'CHO_DUYET' | 'DA_DUYET' | 'BI_TU_CHOI' | 'DA_THUC_THI' | 'DANG_GIAM_SAT' | 'HOAN_THANH'
 * - uuTien?: 'NGUY_CAP' | 'CAO' | 'TRUNG_BINH' | 'THAP'
 * - campaignId?: string
 * 
 * Response:
 * {
 *   success: boolean,
 *   data?: DeXuat[],
 *   error?: string
 * }
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { layDanhSachDeXuat } from '@/lib/sheets/de-xuat-sheet';
import type { TrangThaiDeXuat, MucDoUuTien } from '@/lib/de-xuat/types';

// ===================================================================
// GET HANDLER
// ===================================================================

export async function GET(request: NextRequest) {
    try {
        console.log('[API:DANH_SACH_DE_XUAT] 📨 Nhận request lấy danh sách');

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
        console.log(`[API:DANH_SACH_DE_XUAT] 👤 User: ${userId}`);

        // ===================================================================
        // STEP 2: Parse Query Parameters
        // ===================================================================
        const { searchParams } = new URL(request.url);

        const statusParam = searchParams.get('status');
        const uuTienParam = searchParams.get('uuTien');
        const campaignIdParam = searchParams.get('campaignId');

        // Build filter
        const filter: any = {
            userId, // Always filter by current user
        };

        if (statusParam) {
            filter.trangThai = statusParam as TrangThaiDeXuat;
            console.log(`[API:DANH_SACH_DE_XUAT] 🔍 Filter by status: ${statusParam}`);
        }

        if (uuTienParam) {
            filter.uuTien = uuTienParam as MucDoUuTien;
            console.log(`[API:DANH_SACH_DE_XUAT] 🎯 Filter by priority: ${uuTienParam}`);
        }

        if (campaignIdParam) {
            filter.campaignId = campaignIdParam;
            console.log(`[API:DANH_SACH_DE_XUAT] 📊 Filter by campaign: ${campaignIdParam}`);
        }

        // ===================================================================
        // STEP 3: Fetch từ Google Sheets
        // ===================================================================
        console.log('[API:DANH_SACH_DE_XUAT] 📚 Fetching from Google Sheets...');

        const deXuats = await layDanhSachDeXuat(filter);

        console.log(`[API:DANH_SACH_DE_XUAT] ✅ Tìm thấy ${deXuats.length} đề xuất`);

        // ===================================================================
        // STEP 4: Return Response
        // ===================================================================
        return NextResponse.json(
            {
                success: true,
                data: deXuats,
                meta: {
                    total: deXuats.length,
                    filter,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('[API:DANH_SACH_DE_XUAT] ❌ Error:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        );
    }
}
