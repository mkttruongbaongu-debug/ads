/**
 * ===================================================================
 * COMPONENT: THẺ ĐỀ XUẤT (PROPOSAL CARD)
 * ===================================================================
 * Mô tả:
 * Card hiển thị chi tiết 1 proposal với phân tích từ 4 AI agents.
 * Hỗ trợ approve, reject, execute actions.
 * 
 * Features:
 * - Priority badge với color coding
 * - 4 AI agents insights (collapsible)
 * - Proposed action highlight
 * - Action buttons (Approve/Reject/Execute)
 * - Status indicators
 * - Responsive layout
 * 
 * Props:
 * - deXuat: DeXuat
 * - onUpdated: () => void
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

'use client';

import { useState } from 'react';
import type { DeXuat, MucDoUuTien, TrangThaiDeXuat } from '@/lib/de-xuat/types';

// ===================================================================
// TYPES
// ===================================================================

interface Props {
    deXuat: DeXuat;
    onUpdated: () => void;
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

// ===================================================================
// PRIORITY & STATUS CONFIGS
// ===================================================================

const priorityConfig: Record<MucDoUuTien, { label: string; color: string; bg: string }> = {
    NGUY_CAP: { label: 'NGUY CẤP', color: colors.error, bg: 'rgba(246, 70, 93, 0.1)' },
    CAO: { label: 'CAO', color: colors.warning, bg: 'rgba(240, 185, 11, 0.1)' },
    TRUNG_BINH: { label: 'TRUNG BÌNH', color: colors.info, bg: 'rgba(63, 140, 238, 0.1)' },
    THAP: { label: 'THẤP', color: colors.textMuted, bg: 'rgba(94, 102, 115, 0.1)' },
};

const statusConfig: Record<TrangThaiDeXuat, { label: string; color: string }> = {
    CHO_DUYET: { label: 'CHỜ DUYỆT', color: colors.warning },
    DA_DUYET: { label: 'ĐÃ DUYỆT', color: colors.success },
    BI_TU_CHOI: { label: 'BỊ TỪ CHỐI', color: colors.error },
    DA_THUC_THI: { label: 'ĐÃ THỰC THI', color: colors.info },
    DANG_GIAM_SAT: { label: 'ĐANG GIÁM SÁT', color: colors.info },
    HOAN_THANH: { label: 'HOÀN THÀNH', color: colors.success },
};

// Vietnamese display names with diacritics
const actionTypeLabels: Record<string, string> = {
    TAM_DUNG: 'TẠM DỪNG',
    THAY_DOI_NGAN_SACH: 'THAY ĐỔI NGÂN SÁCH',
    LAM_MOI_CREATIVE: 'LÀM MỚI CREATIVE',
    DIEU_CHINH_DOI_TUONG: 'ĐIỀU CHỈNH ĐỐI TƯỢNG',
    DUNG_VINH_VIEN: 'DỪNG VĨNH VIỄN',
    TANG_NGAN_SACH: 'TĂNG NGÂN SÁCH',
    GIAM_NGAN_SACH: 'GIẢM NGÂN SÁCH',
    GIU_NGUYEN: 'GIỮ NGUYÊN',
    TIEP_TUC: 'TIẾP TỤC',
    THEO_DOI: 'THEO DÕI',
};

const agentNameLabels: Record<string, string> = {
    CHIEN_LUOC: 'CHIẾN LƯỢC',
    HIEU_SUAT: 'HIỆU SUẤT',
    NOI_DUNG: 'NỘI DUNG',
    THUC_THI: 'THỰC THI',
};

// ===================================================================
// STYLES
// ===================================================================

const styles = {
    card: (priority: MucDoUuTien) => ({
        background: colors.bgCard,
        border: `2px solid ${priorityConfig[priority].color}`,
        borderRadius: '8px',
        padding: '0',
        overflow: 'hidden' as const,
    }),
    header: {
        padding: '20px 24px',
        borderBottom: `1px solid ${colors.border}`,
    },
    headerRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px',
    },
    campaignName: {
        fontSize: '1.125rem',
        fontWeight: 700,
        color: colors.text,
        margin: 0,
    },
    badges: {
        display: 'flex',
        gap: '8px',
    },
    badge: (color: string, bg: string) => ({
        padding: '4px 12px',
        background: bg,
        color,
        border: `1px solid ${color}`,
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    }),
    meta: {
        display: 'flex',
        gap: '16px',
        fontSize: '0.8125rem',
        color: colors.textMuted,
    },
    actionSection: {
        padding: '20px 24px',
        background: 'rgba(240, 185, 11, 0.05)',
        borderBottom: `1px solid ${colors.border}`,
    },
    actionTitle: {
        fontSize: '0.75rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        color: colors.textMuted,
        margin: '0 0 8px 0',
        fontWeight: 600,
    },
    actionType: {
        fontSize: '1.125rem',
        fontWeight: 700,
        color: colors.primary,
        margin: '0 0 8px 0',
    },
    actionDesc: {
        fontSize: '0.9375rem',
        color: colors.text,
        margin: '0 0 12px 0',
        lineHeight: 1.5,
    },
    actionMeta: {
        fontSize: '0.8125rem',
        color: colors.textMuted,
    },
    agentsSection: {
        padding: '20px 24px',
    },
    agentItem: {
        marginBottom: '16px',
        paddingBottom: '16px',
        borderBottom: `1px solid ${colors.border}`,
    },
    agentHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
    },
    agentName: {
        fontSize: '0.875rem',
        fontWeight: 700,
        color: colors.primary,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    agentConfidence: (conf: number) => ({
        fontSize: '0.75rem',
        color: conf >= 0.8 ? colors.success : conf >= 0.5 ? colors.warning : colors.error,
        fontWeight: 600,
    }),
    agentText: {
        fontSize: '0.9375rem',
        color: colors.text,
        margin: 0,
        lineHeight: 1.5,
    },
    buttonsRow: {
        padding: '20px 24px',
        display: 'flex',
        gap: '12px',
        borderTop: `1px solid ${colors.border}`,
    },
    button: (variant: 'approve' | 'reject' | 'execute' | 'neutral') => {
        const variants = {
            approve: { bg: colors.success, hover: '#12BB7B' },
            reject: { bg: colors.error, hover: '#F25A72' },
            execute: { bg: colors.primary, hover: colors.primaryHover },
            neutral: { bg: colors.bgAlt, hover: '#2B3139' },
        };
        const v = variants[variant];

        return {
            flex: 1,
            padding: '12px 24px',
            background: v.bg,
            color: variant === 'neutral' ? colors.text : colors.bg,
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
        };
    },
    disabledButton: {
        opacity: 0.4,
        cursor: 'not-allowed',
    },
};

// ===================================================================
// COMPONENT
// ===================================================================

export default function TheDeXuat({ deXuat, onUpdated }: Props) {
    const [isProcessing, setIsProcessing] = useState(false);


    // ===================================================================
    // HANDLERS
    // ===================================================================
    const handleApprove = async () => {
        if (!confirm(`Xác nhận duyệt đề xuất cho campaign "${deXuat.tenCampaign}"?`)) {
            return;
        }

        setIsProcessing(true);

        try {
            const res = await fetch('/api/de-xuat/duyet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deXuatId: deXuat.id }),
            });

            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error);
            }

            alert('✅ Đề xuất đã được duyệt!');
            onUpdated();
        } catch (err) {
            console.error('Error approving:', err);
            alert('❌ Lỗi: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        const reason = prompt('Nhập lý do từ chối:');
        if (!reason || reason.trim() === '') {
            return;
        }

        setIsProcessing(true);

        try {
            const res = await fetch('/api/de-xuat/tu-choi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deXuatId: deXuat.id,
                    ghiChu: reason,
                }),
            });

            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error);
            }

            alert('✅ Đề xuất đã bị từ chối');
            onUpdated();
        } catch (err) {
            console.error('Error rejecting:', err);
            alert('❌ Lỗi: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExecute = async () => {
        if (!confirm(`Xác nhận THỰC THI đề xuất? Action: ${deXuat.hanhDong.loai}`)) {
            return;
        }

        setIsProcessing(true);

        try {
            const res = await fetch('/api/de-xuat/thuc-thi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deXuatId: deXuat.id }),
            });

            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || json.data?.message);
            }

            alert('✅ ' + json.data.message);
            onUpdated();
        } catch (err) {
            console.error('Error executing:', err);
            alert('❌ Lỗi: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setIsProcessing(false);
        }
    };

    // ===================================================================
    // RENDER HELPERS
    // ===================================================================
    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatCurrency = (value: number) => {
        return Math.round(value).toLocaleString('de-DE') + ' ₫';
    };

    // Round budget to nearest 100K for realistic display
    const roundBudget = (value: number): number => {
        if (value <= 0) return 0;
        return Math.round(value / 100000) * 100000;
    };

    // ===================================================================
    // RENDER
    // ===================================================================
    const priority = priorityConfig[deXuat.uuTien];
    const status = statusConfig[deXuat.trangThai];

    return (
        <div style={styles.card(deXuat.uuTien)}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerRow}>
                    <h3 style={styles.campaignName}>{deXuat.tenCampaign}</h3>
                    <div style={styles.badges}>
                        <span style={styles.badge(priority.color, priority.bg)}>
                            {priority.label}
                        </span>
                        <span style={styles.badge(status.color, `${status.color}20`)}>
                            {status.label}
                        </span>
                    </div>
                </div>
                <div style={styles.meta}>
                    <span>Campaign ID: {deXuat.campaignId}</span>
                    <span>•</span>
                    <span>{formatDate(deXuat.thoiGian_Tao)}</span>
                </div>
            </div>

            {/* Proposed Action — PHÂN TÍCH → HÀNH ĐỘNG */}
            <div style={styles.actionSection}>
                {/* PHÂN TÍCH */}
                <p style={styles.actionTitle}>Phân tích</p>

                {/* Lý do chi tiết */}
                {deXuat.hanhDong.lyDo && (
                    <p style={{ ...styles.actionDesc, background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '6px', border: `1px solid ${colors.border}` }}>
                        {deXuat.hanhDong.lyDo}
                    </p>
                )}

                {/* HÀNH ĐỘNG */}
                {(() => {
                    // Filter ra chỉ các bước actionable — bỏ bước "Theo dõi" (monitoring, không phải action)
                    const actionSteps = (deXuat.hanhDong.cacBuoc || []).filter(buoc => {
                        const lower = buoc.toLowerCase();
                        return !lower.startsWith('theo dõi:') && !lower.startsWith('theo dõi ');
                    });
                    const hasContent = actionSteps.length > 0 || deXuat.hanhDong.giaTri_DeXuat;
                    if (!hasContent) return null;
                    return (
                        <div style={{ marginTop: '16px' }}>
                            <p style={{ ...styles.actionTitle, marginBottom: '8px' }}>Hành động</p>

                            {/* Budget suggestion */}
                            {deXuat.hanhDong.giaTri_DeXuat && (
                                <div style={{
                                    marginBottom: '10px', padding: '8px 14px',
                                    background: 'rgba(255, 193, 7, 0.08)', borderRadius: '4px',
                                    border: `1px solid rgba(255, 193, 7, 0.2)`,
                                    fontSize: '0.8125rem', color: colors.warning,
                                }}>
                                    {deXuat.hanhDong.giaTri_HienTai && (
                                        <span>Hiện tại: {formatCurrency(roundBudget(Number(deXuat.hanhDong.giaTri_HienTai)))} → </span>
                                    )}
                                    <span style={{ fontWeight: 700 }}>Đề xuất: {typeof deXuat.hanhDong.giaTri_DeXuat === 'number'
                                        ? formatCurrency(roundBudget(deXuat.hanhDong.giaTri_DeXuat))
                                        : typeof deXuat.hanhDong.giaTri_DeXuat === 'string' && !isNaN(Number(deXuat.hanhDong.giaTri_DeXuat))
                                            ? formatCurrency(roundBudget(Number(deXuat.hanhDong.giaTri_DeXuat)))
                                            : deXuat.hanhDong.giaTri_DeXuat
                                    }</span>
                                    {deXuat.hanhDong.phanTram_ThayDoi && (
                                        <span> ({deXuat.hanhDong.phanTram_ThayDoi > 0 ? '+' : ''}{deXuat.hanhDong.phanTram_ThayDoi}%)</span>
                                    )}
                                </div>
                            )}

                            {actionSteps.length > 0 && (
                                <ol style={{
                                    margin: 0,
                                    paddingLeft: '20px',
                                    color: colors.text,
                                    fontSize: '0.875rem',
                                    lineHeight: 1.8,
                                }}>
                                    {actionSteps.map((buoc, idx) => (
                                        <li key={idx} style={{ marginBottom: '4px' }}>{buoc}</li>
                                    ))}
                                </ol>
                            )}
                        </div>
                    );
                })()}

                {/* Kết quả kỳ vọng */}
                {deXuat.hanhDong.ketQua_KyVong && (
                    <div style={{
                        marginTop: '16px',
                        padding: '12px 16px',
                        background: 'rgba(14, 203, 129, 0.08)',
                        borderRadius: '6px',
                        border: `1px solid rgba(14, 203, 129, 0.2)`,
                    }}>
                        <p style={{ ...styles.actionTitle, color: colors.success, marginBottom: '4px' }}>Kết quả kỳ vọng</p>
                        <p style={{ ...styles.agentText, fontSize: '0.875rem' }}>{deXuat.hanhDong.ketQua_KyVong}</p>
                    </div>
                )}
            </div>

            {/* Metrics Snapshot */}
            {deXuat.metrics_TruocKhi && (
                <div style={{
                    padding: '16px 24px',
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ROAS</p>
                        <p style={{ color: (deXuat.metrics_TruocKhi.roas || 0) >= 2 ? colors.success : colors.error, fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                            {(deXuat.metrics_TruocKhi.roas || 0).toFixed(2)}x
                        </p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CPP</p>
                        <p style={{ color: colors.text, fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                            {formatCurrency(deXuat.metrics_TruocKhi.cpp || 0)}
                        </p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ĐƠN HÀNG</p>
                        <p style={{ color: colors.text, fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                            {deXuat.metrics_TruocKhi.donHang || 0}
                        </p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CHI TIÊU</p>
                        <p style={{ color: colors.text, fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                            {formatCurrency(deXuat.metrics_TruocKhi.chiTieu || 0)}
                        </p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DOANH THU</p>
                        <p style={{ color: colors.text, fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                            {formatCurrency(deXuat.metrics_TruocKhi.doanhThu || 0)}
                        </p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CTR</p>
                        <p style={{ color: colors.text, fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                            {(deXuat.metrics_TruocKhi.ctr || 0).toFixed(2)}%
                        </p>
                    </div>
                </div>
            )}



            {/* Action Buttons */}
            {deXuat.trangThai === 'CHO_DUYET' && (
                <div style={styles.buttonsRow}>
                    <button
                        style={isProcessing ? { ...styles.button('approve'), ...styles.disabledButton } : styles.button('approve')}
                        onClick={handleApprove}
                        disabled={isProcessing}
                    >
                        ✓ Duyệt
                    </button>
                    <button
                        style={isProcessing ? { ...styles.button('reject'), ...styles.disabledButton } : styles.button('reject')}
                        onClick={handleReject}
                        disabled={isProcessing}
                    >
                        ✕ Từ chối
                    </button>
                </div>
            )}



            {(deXuat.trangThai === 'BI_TU_CHOI' || deXuat.trangThai === 'DA_THUC_THI' || deXuat.trangThai === 'DANG_GIAM_SAT') && deXuat.ghiChu_NguoiDung && (
                <div style={{ ...styles.agentsSection, borderTop: `1px solid ${colors.border}` }}>
                    <p style={styles.actionTitle}>Ghi chú</p>
                    <p style={styles.agentText}>{deXuat.ghiChu_NguoiDung}</p>
                </div>
            )}
        </div>
    );
}
