/**
 * ===================================================================
 * COMPONENT: HỘP THƯ ĐỀ XUẤT (PROPOSALS INBOX)
 * ===================================================================
 * Mô tả:
 * Tab hiển thị danh sách proposals với priority queue.
 * Filter theo status, sort theo priority và timestamp.
 * 
 * Features:
 * - Priority queue với color coding
 * - Filter buttons (Pending, Approved, Rejected, All)
 * - Pending badge notification
 * - Responsive grid layout
 * - Empty state
 * 
 * Props:
 * - userId: string
 * 
 * Sử dụng:
 * <HopThuDeXuat userId={session.user.email} />
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import TheDeXuat from '@/components/TheDeXuat';
import type { DeXuat, TrangThaiDeXuat, MucDoUuTien } from '@/lib/de-xuat/types';

// ===================================================================
// TYPES
// ===================================================================

interface Props {
    userId: string;
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
};

// ===================================================================
// STYLES
// ===================================================================

const styles = {
    container: {
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
    },
    header: {
        marginBottom: '24px',
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: 700,
        color: colors.text,
        margin: '0 0 8px 0',
    },
    subtitle: {
        fontSize: '0.875rem',
        color: colors.textMuted,
        margin: 0,
    },
    filterRow: {
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap' as const,
    },
    filterBtn: (active: boolean) => ({
        padding: '8px 16px',
        background: active ? colors.primary : colors.bgCard,
        color: active ? colors.bg : colors.text,
        border: `1px solid ${active ? colors.primary : colors.border}`,
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: 600,
        transition: 'all 0.2s',
    }),
    badge: {
        display: 'inline-block',
        padding: '2px 8px',
        marginLeft: '8px',
        background: colors.error,
        color: colors.text,
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 700,
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '16px',
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '80px 20px',
        background: colors.bgCard,
        borderRadius: '8px',
        border: `1px solid ${colors.border}`,
    },
    emptyIcon: {
        fontSize: '3rem',
        marginBottom: '16px',
    },
    emptyText: {
        fontSize: '1.1rem',
        color: colors.textMuted,
        margin: '0 0 8px 0',
    },
    emptyHint: {
        fontSize: '0.875rem',
        color: colors.textSubtle,
        margin: 0,
    },
    loader: {
        textAlign: 'center' as const,
        padding: '60px 20px',
        color: colors.textMuted,
    },
    error: {
        textAlign: 'center' as const,
        padding: '40px 20px',
        background: `rgba(246, 70, 93, 0.1)`,
        border: `1px solid ${colors.error}`,
        borderRadius: '8px',
        color: colors.error,
    },
};

// ===================================================================
// COMPONENT
// ===================================================================

export default function HopThuDeXuat({ userId }: Props) {
    const [deXuats, setDeXuats] = useState<DeXuat[]>([]);
    const [filteredDeXuats, setFilteredDeXuats] = useState<DeXuat[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<'ALL' | TrangThaiDeXuat>('ALL');

    // ===================================================================
    // FETCH PROPOSALS
    // ===================================================================
    const fetchProposals = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/de-xuat/danh-sach');
            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || 'Failed to fetch proposals');
            }

            setDeXuats(json.data || []);
        } catch (err) {
            console.error('Error fetching proposals:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load on mount
    useEffect(() => {
        fetchProposals();
    }, [fetchProposals]);

    // ===================================================================
    // FILTER LOGIC
    // ===================================================================
    useEffect(() => {
        if (activeFilter === 'ALL') {
            setFilteredDeXuats(deXuats);
        } else {
            setFilteredDeXuats(deXuats.filter(d => d.trangThai === activeFilter));
        }
    }, [deXuats, activeFilter]);

    // ===================================================================
    // COUNTS
    // ===================================================================
    const counts = {
        all: deXuats.length,
        pending: deXuats.filter(d => d.trangThai === 'CHO_DUYET').length,
        approved: deXuats.filter(d => d.trangThai === 'DA_DUYET').length,
        rejected: deXuats.filter(d => d.trangThai === 'BI_TU_CHOI').length,
        executed: deXuats.filter(d => d.trangThai === 'DA_THUC_THI' || d.trangThai === 'DANG_GIAM_SAT').length,
    };

    // ===================================================================
    // HANDLERS
    // ===================================================================
    const handleProposalUpdated = () => {
        // Reload proposals after approve/reject/execute
        fetchProposals();
    };

    // ===================================================================
    // RENDER
    // ===================================================================
    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>
                    Hộp Thư Đề Xuất
                    {counts.pending > 0 && (
                        <span style={styles.badge}>{counts.pending}</span>
                    )}
                </h1>
                <p style={styles.subtitle}>
                    Tất cả đề xuất từ hệ thống AI Guardian
                </p>
            </div>

            {/* Filter Buttons */}
            <div style={styles.filterRow}>
                <button
                    style={styles.filterBtn(activeFilter === 'ALL')}
                    onClick={() => setActiveFilter('ALL')}
                    onMouseEnter={(e) => {
                        if (activeFilter !== 'ALL') {
                            e.currentTarget.style.background = colors.bgAlt;
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (activeFilter !== 'ALL') {
                            e.currentTarget.style.background = colors.bgCard;
                        }
                    }}
                >
                    Tất cả ({counts.all})
                </button>

                <button
                    style={styles.filterBtn(activeFilter === 'CHO_DUYET')}
                    onClick={() => setActiveFilter('CHO_DUYET')}
                    onMouseEnter={(e) => {
                        if (activeFilter !== 'CHO_DUYET') {
                            e.currentTarget.style.background = colors.bgAlt;
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (activeFilter !== 'CHO_DUYET') {
                            e.currentTarget.style.background = colors.bgCard;
                        }
                    }}
                >
                    Chờ Duyệt ({counts.pending})
                </button>

                <button
                    style={styles.filterBtn(activeFilter === 'DA_DUYET')}
                    onClick={() => setActiveFilter('DA_DUYET')}
                    onMouseEnter={(e) => {
                        if (activeFilter !== 'DA_DUYET') {
                            e.currentTarget.style.background = colors.bgAlt;
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (activeFilter !== 'DA_DUYET') {
                            e.currentTarget.style.background = colors.bgCard;
                        }
                    }}
                >
                    Đã Duyệt ({counts.approved})
                </button>

                <button
                    style={styles.filterBtn(activeFilter === 'BI_TU_CHOI')}
                    onClick={() => setActiveFilter('BI_TU_CHOI')}
                    onMouseEnter={(e) => {
                        if (activeFilter !== 'BI_TU_CHOI') {
                            e.currentTarget.style.background = colors.bgAlt;
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (activeFilter !== 'BI_TU_CHOI') {
                            e.currentTarget.style.background = colors.bgCard;
                        }
                    }}
                >
                    Bị Từ Chối ({counts.rejected})
                </button>
            </div>

            {/* Content */}
            {isLoading && (
                <div style={styles.loader}>
                    <p>Đang tải đề xuất...</p>
                </div>
            )}

            {error && (
                <div style={styles.error}>
                    <p>❌ {error}</p>
                    <button
                        onClick={fetchProposals}
                        style={{
                            ...styles.filterBtn(false),
                            marginTop: '16px',
                        }}
                    >
                        Thử lại
                    </button>
                </div>
            )}

            {!isLoading && !error && filteredDeXuats.length === 0 && (
                <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>📭</div>
                    <p style={styles.emptyText}>
                        {activeFilter === 'ALL'
                            ? 'Chưa có đề xuất nào'
                            : `Không có đề xuất ${activeFilter === 'CHO_DUYET' ? 'chờ duyệt' : activeFilter === 'DA_DUYET' ? 'đã duyệt' : 'bị từ chối'}`
                        }
                    </p>
                    <p style={styles.emptyHint}>
                        Đề xuất sẽ được tạo tự động khi phát hiện campaign có vấn đề
                    </p>
                </div>
            )}

            {!isLoading && !error && filteredDeXuats.length > 0 && (
                <div style={styles.grid}>
                    {filteredDeXuats.map((deXuat) => (
                        <TheDeXuat
                            key={deXuat.id}
                            deXuat={deXuat}
                            onUpdated={handleProposalUpdated}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
