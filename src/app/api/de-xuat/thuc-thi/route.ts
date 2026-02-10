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
                    // Detect target level: content (= ad), adset, or campaign?
                    const moTa = buocMoTa || '';
                    const lower = moTa.toLowerCase();
                    const isContentTarget = lower.includes('content') || lower.includes('ad ') || lower.includes('quảng cáo');
                    const isAdsetTarget = lower.includes('adset') || lower.includes('nhóm');

                    // Extract target name from step description
                    // e.g. "Tắt content "3" (chi 5%, spend 181.039đ, ROAS 0)" → "3"
                    const cleaned = moTa
                        .replace(/\s*\(FB\s+chi\b.*$/, '')
                        .replace(/\s*\(chi\s+\d.*$/, '')
                        .replace(/\s*\(CPP\b.*$/, '')
                        .replace(/\s*\(ROAS\b.*$/, '')
                        .replace(/\s*\(spend\b.*$/i, '')
                        .trim();
                    const nameMatch = cleaned.match(/[\u0022\u201C\u201D\u201E\u2018\u2019']([^\u0022\u201C\u201D\u201E\u2018\u2019']+)[\u0022\u201C\u201D\u201E\u2018\u2019']/)
                        || cleaned.match(/content\s+(\S+)/i)
                        || cleaned.match(/adset\s+(\S+)/i);
                    const targetName = nameMatch ? nameMatch[1].trim() : cleaned.replace(/^(tắt|dừng|pause)\s+(content|adset|nhóm|ad|quảng cáo)\s*/i, '').trim();

                    // Extract Ad ID from description if present
                    // e.g. "Tắt content "3" (ID: 120215940419750361)" → "120215940419750361"
                    const idMatch = moTa.match(/\(ID:\s*(\d+)\)/i);
                    const targetAdId = idMatch ? idMatch[1] : null;

                    console.log(`[API:THUC_THI] 🎯 Target: "${targetName}", adId=${targetAdId || 'N/A'}, isContent=${isContentTarget}, isAdset=${isAdsetTarget}`);

                    if (isContentTarget) {
                        // "Content" = individual AD within adset(s)
                        // Step 1: Get all adsets, then get all ads from each
                        const adsets = await fb.getAdsets(deXuat.campaignId);
                        console.log(`[API:THUC_THI] 📦 Found ${adsets.length} adsets in campaign`);

                        // Gather all ads from all adsets
                        type AdInfo = { id: string; name: string; status: string; adsetId: string; adsetName: string };
                        const allAds: AdInfo[] = [];
                        for (const adset of adsets) {
                            try {
                                const ads = await fb.getAds(adset.id);
                                for (const ad of ads) {
                                    allAds.push({
                                        id: ad.id,
                                        name: ad.name,
                                        status: ad.status,
                                        adsetId: adset.id,
                                        adsetName: adset.name,
                                    });
                                }
                            } catch (e) {
                                console.error(`[API:THUC_THI] ⚠️ Failed to get ads for adset ${adset.id}: ${e}`);
                            }
                        }

                        console.log(`[API:THUC_THI] 📋 Total ads: ${allAds.length}: [${allAds.map(a => `"${a.name}" (${a.id})`).join(', ')}]`);

                        let targetAd: AdInfo | undefined;

                        // PRIORITY 1: Match by Ad ID (most reliable, prevents wrong-ad-paused bug)
                        if (targetAdId) {
                            targetAd = allAds.find(a => a.id === targetAdId);
                            if (targetAd) {
                                console.log(`[API:THUC_THI] ✅ Matched by Ad ID: "${targetAd.name}" (${targetAd.id})`);
                            } else {
                                console.warn(`[API:THUC_THI] ⚠️ Ad ID ${targetAdId} not found, falling back to name match`);
                            }
                        }

                        // PRIORITY 2: Match by name (fallback when no ID)
                        if (!targetAd) {
                            const matchingAds = allAds.filter(a =>
                                a.name === targetName ||
                                a.id === targetName
                            );

                            if (matchingAds.length === 1) {
                                targetAd = matchingAds[0];
                            } else if (matchingAds.length > 1) {
                                // Multiple matches — WARN: this is the dangerous case
                                const activeAds = matchingAds.filter(a => a.status === 'ACTIVE');
                                targetAd = activeAds[0] || matchingAds[0];
                                console.warn(`[API:THUC_THI] ⚠️ ${matchingAds.length} ads match "${targetName}" by NAME — picked ${targetAd.id} (${targetAd.status}). AD ID MISSING from proposal, risk of wrong match!`);
                            } else {
                                // Try partial match
                                const partialMatches = allAds.filter(a => a.name.includes(targetName));
                                if (partialMatches.length > 0) {
                                    const activePartial = partialMatches.filter(a => a.status === 'ACTIVE');
                                    targetAd = activePartial[0] || partialMatches[0];
                                    console.log(`[API:THUC_THI] 🔍 Partial match: "${targetAd.name}" (${targetAd.id})`);
                                }
                            }
                        }

                        if (targetAd) {
                            thanhCong = await fb.updateAdStatus(targetAd.id, 'PAUSED');
                            thongDiep = thanhCong
                                ? `Ad "${targetAd.name}" (ID: ${targetAd.id}) trong adset "${targetAd.adsetName}" đã được tạm dừng`
                                : `Không thể tạm dừng ad "${targetAd.name}"`;
                            fbResponse = { success: thanhCong, adId: targetAd.id, adName: targetAd.name, adsetId: targetAd.adsetId, status: 'PAUSED' };
                        } else {
                            thanhCong = false;
                            thongDiep = `Không tìm thấy content "${targetName}" trong campaign. Ads có sẵn: ${allAds.map(a => `"${a.name}"`).join(', ')}`;
                            fbResponse = { error: thongDiep, availableAds: allAds.map(a => ({ name: a.name, id: a.id, status: a.status })) };
                        }
                    } else if (isAdsetTarget) {
                        // Pause adset
                        const adsets = await fb.getAdsets(deXuat.campaignId);
                        const targetAdset = adsets.find(a => a.name === targetName || a.id === targetName);
                        if (targetAdset) {
                            thanhCong = await fb.updateAdsetStatus(targetAdset.id, 'PAUSED');
                            thongDiep = thanhCong
                                ? `Adset "${targetAdset.name}" (ID: ${targetAdset.id}) đã được tạm dừng`
                                : `Không thể tạm dừng adset "${targetAdset.name}"`;
                            fbResponse = { success: thanhCong, adsetId: targetAdset.id, adsetName: targetAdset.name, status: 'PAUSED' };
                        } else {
                            thanhCong = false;
                            thongDiep = `Không tìm thấy adset "${targetName}" trong campaign`;
                            fbResponse = { error: thongDiep, availableAdsets: adsets.map(a => `${a.name} (${a.id})`) };
                        }
                    } else {
                        // Pause entire campaign
                        console.log('[API:THUC_THI] ⏸️ Pausing campaign...');
                        thanhCong = await fb.updateCampaignStatus(deXuat.campaignId, 'PAUSED');
                        fbResponse = { success: thanhCong, status: 'PAUSED' };
                        thongDiep = thanhCong ? 'Campaign đã được tạm dừng' : 'Không thể tạm dừng campaign';
                    }
                    break;
                }

                case 'THAY_DOI_NGAN_SACH': {
                    // Smart budget parser: handle both numbers and text
                    const rawBudgetValue = deXuat.hanhDong?.giaTri_DeXuat ?? deXuat.giaTriDeXuat ?? '0';
                    let newBudget = 0;

                    if (typeof rawBudgetValue === 'number') {
                        newBudget = rawBudgetValue;
                    } else {
                        const budgetStr = String(rawBudgetValue);
                        // Try direct parse first: "600000" → 600000
                        newBudget = parseFloat(budgetStr);

                        if (isNaN(newBudget)) {
                            // Try extracting number from text: "từ 500k lên 600k" → 600000
                            // Pick the LAST number found (= target budget)
                            const numbers = budgetStr.match(/[\d,.]+k?/gi) || [];
                            if (numbers.length > 0) {
                                const lastNum = numbers[numbers.length - 1];
                                newBudget = parseFloat(lastNum.replace(/[,]/g, ''));
                                // Handle "k" suffix: 600k → 600000
                                if (lastNum.toLowerCase().endsWith('k')) {
                                    newBudget *= 1000;
                                }
                            }
                        }
                    }

                    if (!newBudget || isNaN(newBudget) || newBudget <= 0) {
                        thanhCong = false;
                        thongDiep = `Giá trị budget không hợp lệ: "${rawBudgetValue}". Cần con số cụ thể (VD: 500000).`;
                        console.error(`[API:THUC_THI] ❌ Budget parse failed. Raw: "${rawBudgetValue}", Parsed: ${newBudget}`);
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
