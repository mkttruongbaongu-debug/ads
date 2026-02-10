/**
 * ===================================================================
 * API ENDPOINT: THỰC THI ĐỀ XUẤT
 * ===================================================================
 * Route: POST /api/de-xuat/thuc-thi
 * 
 * Mô tả:
 * Execute một approved proposal bằng cách call Facebook API.
 * Uses Apps Script Proxy (NOT direct Google Sheets API).
 * 
 * Hỗ trợ các actions:
 * - TAM_DUNG: Pause campaign
 * - THAY_DOI_NGAN_SACH: Update daily budget
 * - DUNG_VINH_VIEN: Stop campaign
 * - GIU_NGUYEN: Keep current strategy (no changes)
 * - LAM_MOI_CREATIVE / DIEU_CHINH_DOI_TUONG: Manual actions
 * 
 * Request Body:
 * {
 *   deXuatId: string
 * }
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * Updated: 2026-02-10 - Switch to Apps Script Proxy
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDynamicFacebookClient } from '@/lib/facebook/client';

// ===================================================================
// TYPES
// ===================================================================

interface RequestBody {
    deXuatId: string;
    buocIndex?: number;
    buocMoTa?: string;
    buocLoai?: string;
}

// ===================================================================
// HELPER: Fetch proposal by ID via Apps Script
// ===================================================================

async function layDeXuatViaAppsScript(deXuatId: string, userId: string): Promise<any | null> {
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';

    if (!scriptUrl) {
        throw new Error('GOOGLE_APPS_SCRIPT_URL not configured');
    }

    const url = new URL(scriptUrl);
    url.searchParams.set('secret', secret);
    url.searchParams.set('action', 'layDanhSachDeXuat');
    url.searchParams.set('userId', userId);

    console.log('[API:THUC_THI] 📡 Fetching proposals from Apps Script...');
    const response = await fetch(url.toString());
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || 'Apps Script returned error');
    }

    const allDeXuats = data.data || [];
    const found = allDeXuats.find((dx: any) => dx.id === deXuatId);

    return found || null;
}

// ===================================================================
// HELPER: Update proposal status via Apps Script
// ===================================================================

async function capNhatDeXuatViaAppsScript(
    deXuatId: string,
    thanhCong: boolean,
    thongDiep: string,
    giamSatDenNgay: string
): Promise<void> {
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';

    if (!scriptUrl) {
        throw new Error('GOOGLE_APPS_SCRIPT_URL not configured');
    }

    const trangThaiMoi = thanhCong ? 'DANG_GIAM_SAT' : 'DA_DUYET';

    const payload = {
        action: 'capNhatDeXuat',
        secret,
        id: deXuatId,
        trangThai: trangThaiMoi,
        thoiGian_ThucThi: new Date().toISOString(),
        giamSat_DenNgay: giamSatDenNgay,
        ketQua_CuoiCung: thongDiep,
    };

    console.log('[API:THUC_THI] 📤 Updating proposal via Apps Script...');

    const response = await fetch(`${scriptUrl}?action=capNhatDeXuat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[API:THUC_THI] 📥 Apps Script response:', responseText.substring(0, 200));

    let result;
    try {
        result = JSON.parse(responseText);
    } catch (e) {
        console.error('[API:THUC_THI] ❌ Failed to parse Apps Script response');
        throw new Error('Invalid response from Apps Script');
    }

    if (!result.success) {
        console.error('[API:THUC_THI] ❌ Apps Script error:', result.error);
        throw new Error(result.error || 'Apps Script update failed');
    }

    console.log(`[API:THUC_THI] ✅ Proposal updated to ${trangThaiMoi}`);
}

// ===================================================================
// HELPER: Detect effective action type from step info
// ===================================================================

function detectEffectiveAction(buocLoai?: string, buocMoTa?: string, proposalAction?: string): string {
    // Priority 1: Step-level type from frontend (buocLoai)
    if (buocLoai) {
        const loai = buocLoai.toUpperCase();
        if (loai === 'PAUSE') return 'TAM_DUNG';
        if (loai === 'BUDGET') return 'THAY_DOI_NGAN_SACH';
        if (loai === 'CREATIVE') return 'LAM_MOI_CREATIVE';
        if (loai === 'TARGET') return 'DIEU_CHINH_DOI_TUONG';
        if (loai === 'MANUAL') return 'THU_CONG';
    }

    // Priority 2: Detect from step description (buocMoTa)
    if (buocMoTa) {
        const lower = buocMoTa.toLowerCase();
        if (lower.includes('tắt') || lower.includes('dừng') || lower.includes('pause') || lower.includes('tạm dừng')) {
            return 'TAM_DUNG';
        }
        if (lower.includes('budget') || lower.includes('ngân sách') || lower.includes('tăng') && lower.includes('%')) {
            return 'THAY_DOI_NGAN_SACH';
        }
    }

    // Priority 3: Fallback to proposal-level action
    return proposalAction || 'UNKNOWN';
}

// ===================================================================
// POST HANDLER
// ===================================================================

export async function POST(request: NextRequest) {
    try {
        console.log('[API:THUC_THI] 📨 Nhận request thực thi đề xuất');

        // ===================================================================
        // STEP 1: Authentication
        // ===================================================================
        const session = await getServerSession(authOptions);

        if (!session) {
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

        const { deXuatId, buocLoai, buocMoTa } = body;

        if (!deXuatId) {
            return NextResponse.json(
                { success: false, error: 'Missing deXuatId' },
                { status: 400 }
            );
        }

        console.log(`[API:THUC_THI] 🎯 Proposal ID: ${deXuatId}, Step: ${buocLoai || 'N/A'}, Desc: ${buocMoTa || 'N/A'}`);

        // ===================================================================
        // STEP 3: Verify proposal via Apps Script
        // ===================================================================
        const deXuat = await layDeXuatViaAppsScript(deXuatId, userId);

        if (!deXuat) {
            return NextResponse.json(
                { success: false, error: 'Không tìm thấy đề xuất' },
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
                    error: `Đề xuất có trạng thái ${deXuat.trangThai}, chỉ DA_DUYET mới thực thi được.`,
                },
                { status: 400 }
            );
        }

        const proposalAction = deXuat.hanhDong?.loai || deXuat.loaiHanhDong || 'UNKNOWN';
        const effectiveAction = detectEffectiveAction(buocLoai, buocMoTa, proposalAction);
        console.log(`[API:THUC_THI] ⚡ Proposal action: ${proposalAction}, Effective step action: ${effectiveAction}`);

        // ===================================================================
        // STEP 4: Execute via Facebook API
        // ===================================================================
        const fb = await getDynamicFacebookClient();
        let fbResponse: any;
        let thanhCong = false;
        let thongDiep = '';

        try {
            switch (effectiveAction) {
                case 'TAM_DUNG': {
                    // Detect target: adset or campaign?
                    // If step description mentions content/adset → pause adset
                    // Otherwise pause campaign
                    const moTa = buocMoTa || '';
                    const lower = moTa.toLowerCase();
                    const isAdsetTarget = lower.includes('content') || lower.includes('adset') || lower.includes('nhóm');

                    if (isAdsetTarget) {
                        // Find matching adset by name/number from step description
                        console.log(`[API:THUC_THI] ⏸️ Pausing adset (from step: "${moTa}")...`);
                        const adsets = await fb.getAdsets(deXuat.campaignId);

                        // Extract target identifier from step description (e.g. "Tắt content "3"" → "3")
                        const match = moTa.match(/[""]([^""]+)[""]/) || moTa.match(/"([^"]+)"/);
                        const targetName = match ? match[1] : moTa.replace(/^(tắt|dừng|pause)\s+(content|adset|nhóm)\s*/i, '').trim();

                        const targetAdset = adsets.find(a =>
                            a.name === targetName ||
                            a.name.includes(targetName) ||
                            a.id === targetName
                        );

                        if (targetAdset) {
                            thanhCong = await fb.updateAdsetStatus(targetAdset.id, 'PAUSED');
                            thongDiep = thanhCong
                                ? `Adset "${targetAdset.name}" đã được tạm dừng`
                                : `Không thể tạm dừng adset "${targetAdset.name}"`;
                            fbResponse = { success: thanhCong, adsetId: targetAdset.id, adsetName: targetAdset.name, status: 'PAUSED' };
                        } else {
                            thanhCong = false;
                            thongDiep = `Không tìm thấy adset "${targetName}" trong campaign`;
                            fbResponse = { error: thongDiep, availableAdsets: adsets.map(a => a.name) };
                        }
                    } else {
                        console.log('[API:THUC_THI] ⏸️ Pausing campaign...');
                        thanhCong = await fb.updateCampaignStatus(deXuat.campaignId, 'PAUSED');
                        fbResponse = { success: thanhCong, status: 'PAUSED' };
                        thongDiep = thanhCong ? 'Campaign đã được tạm dừng' : 'Không thể tạm dừng campaign';
                    }
                    break;
                }

                case 'THAY_DOI_NGAN_SACH': {
                    const newBudget = typeof deXuat.hanhDong?.giaTri_DeXuat === 'number'
                        ? deXuat.hanhDong.giaTri_DeXuat
                        : parseFloat(String(deXuat.hanhDong?.giaTri_DeXuat || deXuat.giaTriDeXuat || '0'));

                    if (!newBudget || isNaN(newBudget)) {
                        thanhCong = false;
                        thongDiep = `Giá trị budget không hợp lệ: ${deXuat.hanhDong?.giaTri_DeXuat}`;
                        break;
                    }

                    console.log(`[API:THUC_THI] 💰 Updating budget to ${newBudget.toLocaleString()}₫...`);
                    const budgetResult = await fb.updateCampaignBudget(deXuat.campaignId, newBudget);
                    thanhCong = budgetResult.success;
                    thongDiep = budgetResult.message;
                    fbResponse = budgetResult;
                    break;
                }

                case 'DUNG_VINH_VIEN':
                    console.log('[API:THUC_THI] 🛑 Stopping campaign...');
                    thanhCong = await fb.updateCampaignStatus(deXuat.campaignId, 'PAUSED');
                    fbResponse = { success: thanhCong, status: 'PAUSED' };
                    thongDiep = 'Campaign đã được tạm dừng';
                    break;

                case 'LAM_MOI_CREATIVE':
                case 'DIEU_CHINH_DOI_TUONG':
                case 'THU_CONG':
                    thanhCong = true;
                    thongDiep = 'Đã ghi nhận. Action này cần thực hiện manual trong Facebook Ads Manager.';
                    fbResponse = { note: 'Manual action required' };
                    break;

                case 'GIU_NGUYEN':
                    thanhCong = true;
                    thongDiep = 'Giữ nguyên chiến lược hiện tại. Không thay đổi gì trên Facebook.';
                    fbResponse = { note: 'No changes applied' };
                    break;

                default:
                    thanhCong = false;
                    thongDiep = `Action type "${effectiveAction}" chưa được hỗ trợ tự động.`;
                    fbResponse = { unsupported: effectiveAction };
            }
        } catch (error: any) {
            console.error('[API:THUC_THI] ❌ Facebook API error:', error);
            thanhCong = false;
            thongDiep = error.message || 'Failed to execute action on Facebook';
            fbResponse = { error: error.message };
        }

        // ===================================================================
        // STEP 5: Update proposal status via Apps Script
        // ===================================================================
        const giamSatDenNgay = new Date();
        giamSatDenNgay.setDate(giamSatDenNgay.getDate() + 7);
        const giamSatDenNgayStr = giamSatDenNgay.toISOString().split('T')[0];

        try {
            await capNhatDeXuatViaAppsScript(deXuatId, thanhCong, thongDiep, giamSatDenNgayStr);
        } catch (updateError) {
            console.error('[API:THUC_THI] ⚠️ Failed to update proposal status:', updateError);
            // Don't fail the whole request if FB action succeeded but sheet update failed
        }

        console.log(`[API:THUC_THI] ✅ Execution ${thanhCong ? 'successful' : 'failed'}`);

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
                    action: effectiveAction,
                    facebook_response: fbResponse,
                    monitoring_until: thanhCong ? giamSatDenNgayStr : null,
                },
                error: thanhCong ? undefined : thongDiep,
            },
            { status: thanhCong ? 200 : 500 }
        );
    } catch (error) {
        console.error('[API:THUC_THI] ❌ Unexpected error:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        );
    }
}
