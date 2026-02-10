/**
 * ===================================================================
 * COMPONENT: BẢNG THỰC THI (EXECUTION BOARD)
 * ===================================================================
 * Mô tả:
 * Hiển thị đề xuất ĐÃ DUYỆT, bóc tách từng bước thực thi atomic.
 * Mỗi bước có nút duyệt riêng → gọi API tương ứng.
 * 
 * Flow:
 * Tab ĐỀ XUẤT (duyệt) → Tab THỰC THI (bóc tách + execute) → Tab GIÁM SÁT
 * 
 * Loại bước:
 * - BUDGET: Tăng/giảm ngân sách → Gọi Facebook API
 * - PAUSE: Tạm dừng/bật campaign → Gọi Facebook API
 * - CREATIVE: Tạo media mới → AI gen → Duyệt → Tạo adset
 * - MANUAL: Hành động cần làm thủ công
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-10
 * ===================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DeXuat } from '@/lib/de-xuat/types';
import CreativeStudio from './CreativeStudio';

// ===================================================================
// TYPES
// ===================================================================

type LoaiBuoc = 'BUDGET' | 'PAUSE' | 'CREATIVE' | 'TARGET' | 'MANUAL';
type TrangThaiBuoc = 'CHO' | 'DANG_CHAY' | 'HOAN_THANH' | 'LOI' | 'BO_QUA';

interface BuocThucThi {
    id: string;
    stt: number;
    moTa: string;
    loai: LoaiBuoc;
    trangThai: TrangThaiBuoc;
    ketQua?: string;
    thoiGianThucThi?: string;
}

interface DeXuatVoiBuoc {
    deXuat: DeXuat;
    cacBuoc: BuocThucThi[];
}

// ===================================================================
// CEX TRADING COLORS
// ===================================================================

const colors = {
    primary: '#F0B90B',
    primaryHover: '#FCD535',
    bg: '#0B0E11',
    bgAlt: '#1E2329',
    bgCard: '#181A20',
    text: '#EAECEF',
    textMuted: '#848E9C',
    textSubtle: '#5E6673',
    border: '#2B3139',
    success: '#0ECB81',
    error: '#F6465D',
    warning: '#F0B90B',
    info: '#3F8CEE',
};

const loaiBuocConfig: Record<LoaiBuoc, { label: string; color: string; icon: string }> = {
    BUDGET: { label: 'NGÂN SÁCH', color: colors.primary, icon: '💰' },
    PAUSE: { label: 'TẠM DỪNG', color: colors.error, icon: '⏸' },
    CREATIVE: { label: 'CREATIVE', color: colors.info, icon: '🎨' },
    TARGET: { label: 'ĐỐI TƯỢNG', color: '#A855F7', icon: '🎯' },
    MANUAL: { label: 'THỦ CÔNG', color: colors.textMuted, icon: '✋' },
};

const trangThaiBuocConfig: Record<TrangThaiBuoc, { label: string; color: string }> = {
    CHO: { label: 'CHỜ', color: colors.textMuted },
    DANG_CHAY: { label: 'ĐANG CHẠY...', color: colors.primary },
    HOAN_THANH: { label: 'HOÀN THÀNH', color: colors.success },
    LOI: { label: 'LỖI', color: colors.error },
    BO_QUA: { label: 'BỎ QUA', color: colors.textSubtle },
};

// ===================================================================
// HELPER: Bóc tách cacBuoc string[] → BuocThucThi[]
// ===================================================================

function phanLoaiBuoc(moTa: string): LoaiBuoc {
    const lower = moTa.toLowerCase();
    if (lower.includes('budget') || lower.includes('ngân sách') || lower.includes('tăng') || lower.includes('giảm')) {
        if (lower.includes('creative') || lower.includes('content') || lower.includes('media')) return 'CREATIVE';
        return 'BUDGET';
    }
    if (lower.includes('pause') || lower.includes('tạm dừng') || lower.includes('tắt') || lower.includes('dừng')) return 'PAUSE';
    if (lower.includes('creative') || lower.includes('content') || lower.includes('media') || lower.includes('sản xuất')) return 'CREATIVE';
    if (lower.includes('targeting') || lower.includes('đối tượng') || lower.includes('audience')) return 'TARGET';
    return 'MANUAL';
}

function bocTachBuoc(deXuat: DeXuat): BuocThucThi[] {
    const raw = deXuat.hanhDong?.cacBuoc || [];
    if (raw.length === 0) {
        // Fallback: tạo 1 bước từ loại hành động
        return [{
            id: `${deXuat.id}-1`,
            stt: 1,
            moTa: deXuat.hanhDong?.giaTri_DeXuat?.toString() || deXuat.hanhDong?.lyDo || 'Thực thi hành động',
            loai: phanLoaiBuoc(deXuat.hanhDong?.loai || ''),
            trangThai: 'CHO',
        }];
    }

    // Filter ra bước "Theo dõi" / monitoring — không phải hành động thực thi
    const actionable = raw.filter(buoc => {
        const lower = buoc.toLowerCase().trim();
        return !lower.startsWith('theo dõi:')
            && !lower.startsWith('theo dõi ')
            && !lower.startsWith('monitor:')
            && !lower.startsWith('track:');
    });

    // Nếu filter hết → fallback về bước đầu tiên gốc
    const steps = actionable.length > 0 ? actionable : [raw[0]];

    return steps.map((buoc, idx) => ({
        id: `${deXuat.id}-${idx + 1}`,
        stt: idx + 1,
        moTa: buoc,
        loai: phanLoaiBuoc(buoc),
        trangThai: 'CHO' as TrangThaiBuoc,
    }));
}

// ===================================================================
// COMPONENT
// ===================================================================

export default function BangThucThi() {
    const [deXuatList, setDeXuatList] = useState<DeXuatVoiBuoc[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [executingStep, setExecutingStep] = useState<string | null>(null);

    // Creative Studio overlay
    const [creativeStudio, setCreativeStudio] = useState<{
        campaignId: string;
        campaignName: string;
    } | null>(null);

    // Date range (60 days back, same as dashboard)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = (() => { const d = new Date(); d.setDate(d.getDate() - 60); return d.toISOString().split('T')[0]; })();

    // Fetch approved proposals
    const fetchApproved = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/de-xuat/danh-sach?status=DA_DUYET');
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Lỗi tải dữ liệu');

            const danhSach: DeXuat[] = json.data || [];
            const voiBuoc = danhSach.map(dx => ({
                deXuat: dx,
                cacBuoc: bocTachBuoc(dx),
            }));
            setDeXuatList(voiBuoc);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lỗi không xác định');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchApproved();
    }, [fetchApproved]);

    // Execute a single step
    const handleExecuteStep = async (deXuatIdx: number, buocIdx: number) => {
        const item = deXuatList[deXuatIdx];
        const buoc = item.cacBuoc[buocIdx];
        const stepId = buoc.id;



        setExecutingStep(stepId);

        // Update step status to running
        setDeXuatList(prev => {
            const next = [...prev];
            next[deXuatIdx] = {
                ...next[deXuatIdx],
                cacBuoc: next[deXuatIdx].cacBuoc.map((b, i) =>
                    i === buocIdx ? { ...b, trangThai: 'DANG_CHAY' as TrangThaiBuoc } : b
                ),
            };
            return next;
        });

        try {
            // Call execution API
            const res = await fetch('/api/de-xuat/thuc-thi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deXuatId: item.deXuat.id,
                    buocIndex: buocIdx,
                    buocMoTa: buoc.moTa,
                    buocLoai: buoc.loai,
                }),
            });

            const json = await res.json();

            // Update step status
            setDeXuatList(prev => {
                const next = [...prev];
                next[deXuatIdx] = {
                    ...next[deXuatIdx],
                    cacBuoc: next[deXuatIdx].cacBuoc.map((b, i) =>
                        i === buocIdx ? {
                            ...b,
                            trangThai: json.success ? 'HOAN_THANH' as TrangThaiBuoc : 'LOI' as TrangThaiBuoc,
                            ketQua: json.success ? (json.data?.message || 'Thành công') : (json.error || 'Lỗi'),
                            thoiGianThucThi: new Date().toISOString(),
                        } : b
                    ),
                };
                return next;
            });
        } catch (err) {
            setDeXuatList(prev => {
                const next = [...prev];
                next[deXuatIdx] = {
                    ...next[deXuatIdx],
                    cacBuoc: next[deXuatIdx].cacBuoc.map((b, i) =>
                        i === buocIdx ? {
                            ...b,
                            trangThai: 'LOI' as TrangThaiBuoc,
                            ketQua: err instanceof Error ? err.message : 'Lỗi kết nối',
                        } : b
                    ),
                };
                return next;
            });
        } finally {
            setExecutingStep(null);
        }
    };

    // Skip a step
    const handleSkipStep = (deXuatIdx: number, buocIdx: number) => {
        setDeXuatList(prev => {
            const next = [...prev];
            next[deXuatIdx] = {
                ...next[deXuatIdx],
                cacBuoc: next[deXuatIdx].cacBuoc.map((b, i) =>
                    i === buocIdx ? { ...b, trangThai: 'BO_QUA' as TrangThaiBuoc } : b
                ),
            };
            return next;
        });
    };

    // Count stats
    const totalSteps = deXuatList.reduce((s, d) => s + d.cacBuoc.length, 0);
    const completedSteps = deXuatList.reduce((s, d) => s + d.cacBuoc.filter(b => b.trangThai === 'HOAN_THANH').length, 0);
    const pendingSteps = deXuatList.reduce((s, d) => s + d.cacBuoc.filter(b => b.trangThai === 'CHO').length, 0);

    // ===================================================================
    // RENDER
    // ===================================================================

    return (
        <>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: '24px', paddingBottom: '16px',
                    borderBottom: `1px solid ${colors.border}`,
                }}>
                    <div>
                        <h2 style={{
                            fontSize: '1.25rem', fontWeight: 700, color: colors.text,
                            margin: '0 0 4px', letterSpacing: '0.5px',
                        }}>
                            BẢNG THỰC THI
                        </h2>
                        <p style={{ fontSize: '0.8125rem', color: colors.textMuted, margin: 0 }}>
                            Duyệt và thực thi từng bước — mỗi bước = 1 hành động
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        {/* Stats */}
                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem' }}>
                            <span style={{ color: colors.textMuted }}>
                                Chờ: <strong style={{ color: colors.primary }}>{pendingSteps}</strong>
                            </span>
                            <span style={{ color: colors.textMuted }}>
                                Xong: <strong style={{ color: colors.success }}>{completedSteps}</strong>
                            </span>
                            <span style={{ color: colors.textMuted }}>
                                Tổng: <strong style={{ color: colors.text }}>{totalSteps}</strong>
                            </span>
                        </div>

                        {/* Refresh */}
                        <button
                            onClick={fetchApproved}
                            disabled={isLoading}
                            style={{
                                padding: '6px 14px',
                                background: colors.bgAlt,
                                border: `1px solid ${colors.border}`,
                                borderRadius: '4px',
                                color: colors.text,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {isLoading ? 'ĐANG TẢI...' : 'LÀM MỚI'}
                        </button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '12px 16px', marginBottom: '16px',
                        background: 'rgba(246, 70, 93, 0.1)',
                        border: `1px solid ${colors.error}`,
                        borderRadius: '6px',
                        color: colors.error, fontSize: '0.875rem',
                    }}>
                        {error}
                    </div>
                )}

                {/* Loading */}
                {isLoading && (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: colors.textMuted }}>
                        ĐANG TẢI ĐỀ XUẤT ĐÃ DUYỆT...
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && deXuatList.length === 0 && (
                    <div style={{
                        textAlign: 'center', padding: '80px 0', color: colors.textMuted,
                    }}>
                        <p style={{ fontSize: '1.5rem', margin: '0 0 8px' }}>✓</p>
                        <p style={{ fontSize: '0.9375rem', fontWeight: 600 }}>KHÔNG CÓ ĐỀ XUẤT NÀO CẦN THỰC THI</p>
                        <p style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
                            Duyệt đề xuất trong tab ĐỀ XUẤT để bắt đầu
                        </p>
                    </div>
                )}

                {/* Proposals with steps */}
                {deXuatList.map((item, dxIdx) => {
                    const dx = item.deXuat;
                    const stepsComplete = item.cacBuoc.filter(b => b.trangThai === 'HOAN_THANH' || b.trangThai === 'BO_QUA').length;
                    const allDone = stepsComplete === item.cacBuoc.length;

                    return (
                        <div key={dx.id} style={{
                            background: colors.bgCard,
                            border: `1px solid ${allDone ? colors.success : colors.border}`,
                            borderRadius: '8px',
                            marginBottom: '16px',
                            overflow: 'hidden',
                        }}>
                            {/* Proposal header */}
                            <div style={{
                                padding: '16px 20px',
                                borderBottom: `1px solid ${colors.border}`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <div>
                                    <h3 style={{
                                        fontSize: '1rem', fontWeight: 700, color: colors.text,
                                        margin: '0 0 4px',
                                    }}>
                                        {dx.tenCampaign}
                                    </h3>
                                    <p style={{
                                        fontSize: '0.75rem', color: colors.textMuted, margin: 0,
                                    }}>
                                        {dx.hanhDong?.loai?.replace(/_/g, ' ')} · {new Date(dx.thoiGian_Tao).toLocaleDateString('vi-VN')}
                                    </p>
                                </div>

                                {/* Progress */}
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{
                                        fontSize: '0.8125rem', fontWeight: 700,
                                        color: allDone ? colors.success : colors.primary,
                                    }}>
                                        {stepsComplete}/{item.cacBuoc.length}
                                    </span>
                                    <div style={{
                                        width: '80px', height: '4px', marginTop: '4px',
                                        background: colors.bgAlt, borderRadius: '2px', overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            width: `${item.cacBuoc.length > 0 ? (stepsComplete / item.cacBuoc.length) * 100 : 0}%`,
                                            height: '100%',
                                            background: allDone ? colors.success : colors.primary,
                                            borderRadius: '2px',
                                            transition: 'width 0.3s',
                                        }} />
                                    </div>
                                </div>
                            </div>

                            {/* Lý do */}
                            {dx.hanhDong?.lyDo && (
                                <div style={{
                                    padding: '12px 20px',
                                    borderBottom: `1px solid ${colors.border}`,
                                    fontSize: '0.8125rem', color: colors.textMuted,
                                    background: 'rgba(255,255,255,0.02)',
                                    lineHeight: 1.5,
                                }}>
                                    {dx.hanhDong.lyDo}
                                </div>
                            )}

                            {/* Steps list */}
                            <div style={{ padding: '0' }}>
                                {item.cacBuoc.map((buoc, bIdx) => {
                                    const loaiCfg = loaiBuocConfig[buoc.loai];
                                    const trangThaiCfg = trangThaiBuocConfig[buoc.trangThai];
                                    const isExecuting = executingStep === buoc.id;
                                    const canExecute = buoc.trangThai === 'CHO' && !executingStep;
                                    const isDone = buoc.trangThai === 'HOAN_THANH' || buoc.trangThai === 'BO_QUA';

                                    return (
                                        <div key={buoc.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                            padding: '14px 20px',
                                            borderBottom: bIdx < item.cacBuoc.length - 1 ? `1px solid ${colors.border}` : 'none',
                                            opacity: isDone ? 0.6 : 1,
                                            background: isExecuting ? 'rgba(240, 185, 11, 0.05)' : 'transparent',
                                        }}>
                                            {/* Step number */}
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                                                background: isDone ? `${colors.success}20` : `${loaiCfg.color}15`,
                                                color: isDone ? colors.success : loaiCfg.color,
                                                border: `1px solid ${isDone ? colors.success : loaiCfg.color}40`,
                                            }}>
                                                {isDone ? '✓' : buoc.stt}
                                            </div>

                                            {/* Type badge */}
                                            <span style={{
                                                fontSize: '0.625rem', fontWeight: 700,
                                                padding: '2px 6px', borderRadius: '3px',
                                                background: `${loaiCfg.color}15`,
                                                color: loaiCfg.color,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.3px',
                                                flexShrink: 0,
                                                minWidth: '60px', textAlign: 'center',
                                            }}>
                                                {loaiCfg.label}
                                            </span>

                                            {/* Description */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    fontSize: '0.875rem', color: colors.text,
                                                    margin: 0, lineHeight: 1.4,
                                                    textDecoration: buoc.trangThai === 'BO_QUA' ? 'line-through' : 'none',
                                                }}>
                                                    {buoc.moTa}
                                                </p>
                                                {buoc.ketQua && (
                                                    <p style={{
                                                        fontSize: '0.75rem', margin: '4px 0 0',
                                                        color: buoc.trangThai === 'LOI' ? colors.error : colors.success,
                                                    }}>
                                                        {buoc.ketQua}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Status / Actions */}
                                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                                {buoc.trangThai === 'CHO' && (
                                                    <>
                                                        {buoc.loai === 'CREATIVE' ? (
                                                            <button
                                                                onClick={() => setCreativeStudio({
                                                                    campaignId: dx.campaignId,
                                                                    campaignName: dx.tenCampaign,
                                                                })}
                                                                style={{
                                                                    padding: '6px 14px',
                                                                    background: '#8B5CF6',
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    color: '#fff',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer',
                                                                }}
                                                            >
                                                                TẠO CREATIVE
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleExecuteStep(dxIdx, bIdx)}
                                                                disabled={!canExecute}
                                                                style={{
                                                                    padding: '6px 14px',
                                                                    background: canExecute ? colors.success : colors.bgAlt,
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    color: canExecute ? '#000' : colors.textMuted,
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 700,
                                                                    cursor: canExecute ? 'pointer' : 'not-allowed',
                                                                    opacity: canExecute ? 1 : 0.5,
                                                                }}
                                                            >
                                                                THỰC THI
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleSkipStep(dxIdx, bIdx)}
                                                            style={{
                                                                padding: '6px 10px',
                                                                background: 'transparent',
                                                                border: `1px solid ${colors.border}`,
                                                                borderRadius: '4px',
                                                                color: colors.textMuted,
                                                                fontSize: '0.75rem',
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            BỎ QUA
                                                        </button>
                                                    </>
                                                )}

                                                {buoc.trangThai === 'DANG_CHAY' && (
                                                    <span style={{
                                                        padding: '6px 14px',
                                                        fontSize: '0.75rem', fontWeight: 600,
                                                        color: colors.primary,
                                                    }}>
                                                        ĐANG CHẠY...
                                                    </span>
                                                )}

                                                {(buoc.trangThai === 'HOAN_THANH' || buoc.trangThai === 'LOI' || buoc.trangThai === 'BO_QUA') && (
                                                    <span style={{
                                                        padding: '6px 10px',
                                                        fontSize: '0.6875rem', fontWeight: 600,
                                                        color: trangThaiCfg.color,
                                                    }}>
                                                        {trangThaiCfg.label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* All done → mark as executed */}
                            {allDone && (
                                <div style={{
                                    padding: '12px 20px',
                                    borderTop: `1px solid ${colors.border}`,
                                    background: 'rgba(14, 203, 129, 0.05)',
                                    textAlign: 'center',
                                }}>
                                    <span style={{
                                        fontSize: '0.8125rem', fontWeight: 600, color: colors.success,
                                    }}>
                                        ✓ TẤT CẢ BƯỚC ĐÃ HOÀN THÀNH
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Creative Studio Overlay */}
            {
                creativeStudio && (
                    <CreativeStudio
                        campaignId={creativeStudio.campaignId}
                        campaignName={creativeStudio.campaignName}
                        startDate={startDate}
                        endDate={endDate}
                        onClose={() => setCreativeStudio(null)}
                    />
                )
            }
        </>
    );
}

