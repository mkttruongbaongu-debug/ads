/**
 * ===================================================================
 * API ENDPOINT: LẤY QUAN SÁT (GET OBSERVATIONS)
 * ===================================================================
 * Route: GET /api/giam-sat/quan-sat?deXuatId=xxx
 * 
 * Trả về danh sách observations (D+1, D+3, D+7) cho 1 đề xuất.
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { layQuanSatTheoDeXuat } from '@/lib/sheets/quan-sat-sheet';

export async function GET(request: NextRequest) {
    const deXuatId = request.nextUrl.searchParams.get('deXuatId');

    if (!deXuatId) {
        return NextResponse.json(
            { success: false, error: 'Missing deXuatId parameter' },
            { status: 400 }
        );
    }

    try {
        const observations = await layQuanSatTheoDeXuat(deXuatId);

        return NextResponse.json({
            success: true,
            data: observations,
            count: observations.length,
        });
    } catch (error) {
        console.error('[QUAN_SAT API] Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
