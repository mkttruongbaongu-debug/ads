/**
 * ===================================================================
 * API ENDPOINT: TẠO ĐỀ XUẤT MỚI (SIMPLIFIED v2)
 * ===================================================================
 * Route: POST /api/de-xuat/tao-moi
 * 
 * Flow đơn giản:
 * 1. Nhận aiAnalysis từ frontend (kết quả AI Analyzer)
 * 2. Map trực tiếp sang format đề xuất
 * 3. Lưu vào Google Sheets
 * 4. KHÔNG chạy AI lần 2 → đảm bảo đồng bộ
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// ===================================================================
// TYPES
// ===================================================================

interface RequestBody {
    campaignId: string;
    startDate: string;
    endDate: string;
    accountId: string;
    campaignData?: {
        name: string;
        metrics_HienTai: {
            cpp: number;
            roas: number;
            chiTieu: number;
            donHang: number;
            ctr: number;
            doanhThu: number;
        };
    };
    aiAnalysis?: {
        verdict?: {
            action: 'SCALE' | 'MAINTAIN' | 'WATCH' | 'REDUCE' | 'STOP';
            headline: string;
            condition?: string;
        };
        dimensions?: {
            financial: { status: string; summary: string };
            content: { status: string; summary: string };
            audience: { status: string; summary: string };
            trend: { direction: string; summary: string };
        };
        actionPlan?: {
            immediate: string | { action: string; reason: string; metric_to_watch?: string };
            shortTerm?: string | { action: string; trigger: string };
            prevention?: string;
        };
        creativeHealth?: {
            status: string;
            ctrTrend: string;
            frequencyStatus: string;
            diagnosis: string;
            urgency: string;
        };
        prediction?: {
            noAction: string;
            withAction: string;
        };
        reasoning?: string;
        warningSignals?: Array<{
            type: string;
            severity: string;
            evidence: string;
        }>;
        summary?: string;
        confidence?: string;
    };
}

// ===================================================================
// MAPPING: AI Analyzer verdict → Đề xuất action
// ===================================================================

/**
 * Map AI Analyzer action → LoaiHanhDong
 * Dựa trên context (creative health, dimensions) để quyết định chính xác
 */
function mapToLoaiHanhDong(
    aiAnalysis: RequestBody['aiAnalysis']
): { loai: string; moTa: string; giaTri_DeXuat: string } {
    const action = aiAnalysis?.verdict?.action || 'MAINTAIN';
    const creativeStatus = aiAnalysis?.creativeHealth?.status;
    const contentStatus = aiAnalysis?.dimensions?.content?.status;

    // Extract immediate action text
    const immediate = aiAnalysis?.actionPlan?.immediate;
    const immediateText = typeof immediate === 'string'
        ? immediate
        : immediate?.action || '';

    switch (action) {
        case 'STOP':
            return {
                loai: 'TAM_DUNG',
                moTa: aiAnalysis?.verdict?.headline || 'Tạm dừng campaign',
                giaTri_DeXuat: 'Pause campaign ngay',
            };

        case 'REDUCE':
            // REDUCE + creative fatigue → LÀM MỚI CREATIVE (không giảm budget)
            if (creativeStatus === 'fatigued' || creativeStatus === 'critical' ||
                contentStatus === 'warning' || contentStatus === 'critical') {
                return {
                    loai: 'LAM_MOI_CREATIVE',
                    moTa: aiAnalysis?.verdict?.headline || 'Làm mới creative',
                    giaTri_DeXuat: immediateText || 'Refresh creative ngay',
                };
            }
            return {
                loai: 'THAY_DOI_NGAN_SACH',
                moTa: aiAnalysis?.verdict?.headline || 'Giảm ngân sách',
                giaTri_DeXuat: 'Giảm 30% daily budget',
            };

        case 'WATCH':
            // WATCH + creative warning → ưu tiên creative
            if (creativeStatus === 'early_warning' || creativeStatus === 'fatigued') {
                return {
                    loai: 'LAM_MOI_CREATIVE',
                    moTa: aiAnalysis?.verdict?.headline || 'Creative cần refresh',
                    giaTri_DeXuat: immediateText || 'Chuẩn bị creative mới',
                };
            }
            return {
                loai: 'DIEU_CHINH_DOI_TUONG',
                moTa: aiAnalysis?.verdict?.headline || 'Theo dõi và điều chỉnh',
                giaTri_DeXuat: immediateText || 'Điều chỉnh targeting/audience',
            };

        case 'SCALE':
            return {
                loai: 'THAY_DOI_NGAN_SACH',
                moTa: aiAnalysis?.verdict?.headline || 'Scale campaign',
                giaTri_DeXuat: 'Tăng 20-30% daily budget',
            };

        case 'MAINTAIN':
        default:
            return {
                loai: 'THAY_DOI_NGAN_SACH',
                moTa: aiAnalysis?.verdict?.headline || 'Giữ nguyên chiến lược',
                giaTri_DeXuat: 'Giữ nguyên budget hiện tại',
            };
    }
}

/**
 * Map AI Analyzer action → Mức độ ưu tiên
 */
function mapToUuTien(aiAnalysis: RequestBody['aiAnalysis']): string {
    const action = aiAnalysis?.verdict?.action || 'MAINTAIN';
    const creativeUrgency = aiAnalysis?.creativeHealth?.urgency;
    const hasWarnings = (aiAnalysis?.warningSignals?.length || 0) > 0;
    const hasCriticalWarning = aiAnalysis?.warningSignals?.some(w => w.severity === 'critical');

    if (action === 'STOP' || hasCriticalWarning) return 'NGUY_CAP';
    if (action === 'REDUCE' || creativeUrgency === 'high' || creativeUrgency === 'critical') return 'CAO';
    if (action === 'WATCH' || hasWarnings) return 'CAO';
    if (action === 'SCALE') return 'TRUNG_BINH';
    return 'THAP';
}

// ===================================================================
// POST HANDLER
// ===================================================================

export async function POST(request: NextRequest) {
    try {
        console.log('[API:TAO_DE_XUAT_V2] 📨 Nhận request tạo đề xuất');

        // STEP 1: Auth
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user?.name || session.user?.email || 'unknown';

        // STEP 2: Parse request
        let body: RequestBody;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
        }

        const { campaignId, campaignData, aiAnalysis } = body;

        if (!campaignId) {
            return NextResponse.json({ success: false, error: 'Missing campaignId' }, { status: 400 });
        }

        if (!aiAnalysis?.verdict) {
            return NextResponse.json({
                success: false,
                error: 'Missing aiAnalysis.verdict - Chạy phân tích AI trước khi tạo đề xuất'
            }, { status: 400 });
        }

        const tenCampaign = campaignData?.name || `Campaign ${campaignId}`;

        console.log(`[API:TAO_DE_XUAT_V2] 🎯 Campaign: ${tenCampaign}`);
        console.log(`[API:TAO_DE_XUAT_V2] 📋 Verdict: ${aiAnalysis.verdict.action} - ${aiAnalysis.verdict.headline}`);

        // STEP 3: Map AI Analyzer → Đề xuất (ĐỒNG BỘ 100%)
        const hanhDongMapping = mapToLoaiHanhDong(aiAnalysis);
        const uuTien = mapToUuTien(aiAnalysis);

        // Build các bước thực thi từ actionPlan
        const cacBuoc: string[] = [];
        if (aiAnalysis.actionPlan) {
            const immediate = aiAnalysis.actionPlan.immediate;
            if (typeof immediate === 'string') {
                cacBuoc.push(immediate);
            } else if (immediate) {
                cacBuoc.push(immediate.action);
                if (immediate.metric_to_watch) {
                    cacBuoc.push(`Theo dõi: ${immediate.metric_to_watch}`);
                }
            }

            const shortTerm = aiAnalysis.actionPlan.shortTerm;
            if (typeof shortTerm === 'string') {
                cacBuoc.push(shortTerm);
            } else if (shortTerm) {
                cacBuoc.push(`${shortTerm.action} (trigger: ${shortTerm.trigger})`);
            }

            if (aiAnalysis.actionPlan.prevention) {
                cacBuoc.push(aiAnalysis.actionPlan.prevention);
            }
        }

        // Build kết quả kỳ vọng từ prediction
        const ketQuaKyVong = aiAnalysis.prediction?.withAction || '';

        // Build lý do từ reasoning
        const lyDo = aiAnalysis.reasoning || aiAnalysis.verdict.headline;

        const deXuatId = `DX-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const thoiGianTao = new Date().toISOString();

        // Build proposal object
        const deXuatData = {
            id: deXuatId,
            thoiGian_Tao: thoiGianTao,
            campaignId,
            tenCampaign,
            userId,
            uuTien,
            trangThai: 'CHO_DUYET',

            // Hành động - MAP TRỰC TIẾP từ AI Analyzer
            hanhDong: {
                loai: hanhDongMapping.loai,
                lyDo,
                giaTri_DeXuat: hanhDongMapping.giaTri_DeXuat,
                cacBuoc,
                ketQua_KyVong: ketQuaKyVong,
            },

            // 4 chuyên gia = 4 dimensions từ AI Analyzer (CÙNG 1 NGUỒN)
            phanTich_ChuyenGia: [
                {
                    tenChuyenGia: 'CHIEN_LUOC',
                    nhanDinh: aiAnalysis.dimensions?.financial?.summary || 'N/A',
                    doTinCay: 0.85,
                },
                {
                    tenChuyenGia: 'HIEU_SUAT',
                    nhanDinh: aiAnalysis.dimensions?.audience?.summary || 'N/A',
                    doTinCay: 0.90,
                },
                {
                    tenChuyenGia: 'NOI_DUNG',
                    nhanDinh: aiAnalysis.dimensions?.content?.summary || 'N/A',
                    doTinCay: 0.85,
                },
                {
                    tenChuyenGia: 'THUC_THI',
                    nhanDinh: aiAnalysis.dimensions?.trend?.summary || 'N/A',
                    doTinCay: 0.85,
                },
            ],

            // Metrics snapshot
            metrics_TruocKhi: campaignData?.metrics_HienTai || {},

            // Summary
            summary: aiAnalysis.verdict.headline,
        };

        console.log('[API:TAO_DE_XUAT_V2] 📦 Proposal built:', JSON.stringify({
            loai: hanhDongMapping.loai,
            uuTien,
            lyDo: lyDo.substring(0, 80),
            cacBuoc: cacBuoc.length,
        }));

        // STEP 4: Save to Google Sheets
        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

        if (!scriptUrl) {
            console.warn('[API:TAO_DE_XUAT_V2] ⚠️ No GOOGLE_APPS_SCRIPT_URL, skipping save');
        } else {
            try {
                console.log('[API:TAO_DE_XUAT_V2] 📤 Saving to Google Sheets...');

                const saveResponse = await fetch(scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'ghiDeXuat',
                        secret,
                        ...deXuatData,
                    }),
                });

                const saveResult = await saveResponse.text();
                console.log('[API:TAO_DE_XUAT_V2] 📥 Sheets response:', saveResult.substring(0, 200));
            } catch (saveError) {
                console.error('[API:TAO_DE_XUAT_V2] ❌ Save error:', saveError);
                // Continue - don't fail the whole request
            }
        }

        // STEP 5: Return success
        console.log(`[API:TAO_DE_XUAT_V2] ✅ Done! ID: ${deXuatId}`);

        return NextResponse.json({
            success: true,
            data: {
                deXuatId,
                uuTien,
                tomTat: aiAnalysis.verdict.headline,
                hanhDong: {
                    loai: hanhDongMapping.loai,
                    moTa: hanhDongMapping.moTa,
                },
            },
        }, { status: 200 });

    } catch (error) {
        console.error('[API:TAO_DE_XUAT_V2] ❌ Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        }, { status: 500 });
    }
}
