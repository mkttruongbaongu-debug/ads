/**
 * ===================================================================
 * COMPONENT: BẢNG GIÁM SÁT (MONITORING DASHBOARD)
 * ===================================================================
 * Mô tả:
 * Component hiển thị proposals đang được giám sát.
 * Timeline view: D+1 → D+3 → D+7 với progress indicators.
 * 
 * Features:
 * - Display proposals DANG_GIAM_SAT
 * - Timeline progress (D+1/D+3/D+7)
 * - Metrics comparison before/after
 * - Success/Fail indicators
 * - Observations history
 * 
 * Props:
 * - userId: string
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DeXuat } from '@/lib/de-xuat/types';
import { daysUntilNextCheckpoint, getAllPassedCheckpoints } from '@/lib/monitoring/checkpoint-calculator';

// ===================================================================
// TYPES
// ===================================================================

interface Props {
    userId: string;
}

interface MonitoringProposal extends DeXuat {
    observations?: any[];
    nextCheckpoint?: string;
    daysRemaining?: number;
}

// ===================================================================
// CEX TRADING COLORS
// ===================================================================

const colors = {
    primary: '#F0B90B',
    bg: '#0B0E11',
    bgCard: '#181A20',
    bgAlt: '#1E2329',
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
// STYLES
// ===================================================================

const styles = {
    container: {
        padding: '24px',
        maxWidth: '1400px',
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
    grid: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '16px',
    },
    card: {
        background: colors.bgCard,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        overflow: 'hidden' as const,
    },
    cardHeader: {
        padding: '20px 24px',
        borderBottom: `1px solid ${colors.border}`,
    },
    campaignName: {
        fontSize: '1.125rem',
        fontWeight: 700,
        color: colors.text,
        margin: '0 0 8px 0',
    },
    meta: {
        fontSize: '0.8125rem',
        color: colors.textMuted,
    },
    timeline: {
        padding: '24px',
        background: colors.bgAlt,
    },
    timelineTitle: {
        fontSize: '0.75rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        color: colors.textMuted,
        margin: '0 0 16px 0',
        fontWeight: 600,
    },
    checkpoints: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative' as const,
    },
    checkpoint: (active: boolean, completed: boolean) => ({
        flex: 1,
        textAlign: 'center' as const,
        position: 'relative' as const,
        zIndex: 1,
    }),
    checkpointDot: (active: boolean, completed: boolean) => ({
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: completed ? colors.success : active ? colors.primary : colors.bgCard,
        border: `2px solid ${completed ? colors.success : active ? colors.primary : colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 8px',
        fontSize: '0.875rem',
        fontWeight: 700,
        color: completed || active ? colors.bg : colors.textMuted,
    }),
    checkpointLabel: {
        fontSize: '0.8125rem',
        color: colors.text,
        fontWeight: 600,
        marginBottom: '4px',
    },
    checkpointStatus: {
        fontSize: '0.75rem',
        color: colors.textMuted,
    },
    progressLine: {
        position: 'absolute' as const,
        top: '20px',
        left: '25%',
        right: '25%',
        height: '2px',
        background: colors.border,
        zIndex: 0,
    },
    metricsSection: {
        padding: '20px 24px',
        borderTop: `1px solid ${colors.border}`,
    },
    metricsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
    },
    metricCard: {
        background: colors.bg,
        padding: '16px',
        borderRadius: '6px',
        border: `1px solid ${colors.border}`,
    },
    metricLabel: {
        fontSize: '0.75rem',
        color: colors.textMuted,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        marginBottom: '8px',
    },
    metricValue: {
        fontSize: '1.5rem',
        fontWeight: 700,
        color: colors.text,
        margin: '0 0 4px 0',
    },
    metricChange: (positive: boolean) => ({
        fontSize: '0.8125rem',
        color: positive ? colors.success : colors.error,
        fontWeight: 600,
    }),
    emptyState: {
        textAlign: 'center' as const,
        padding: '80px 20px',
        background: colors.bgCard,
        borderRadius: '8px',
        border: `1px solid ${colors.border}`,
    },
    loader: {
        textAlign: 'center' as const,
        padding: '60px 20px',
        color: colors.textMuted,
    },
};

// ===================================================================
// COMPONENT
// ===================================================================

export default function BangGiamSat({ userId }: Props) {
    const [proposals, setProposals] = useState<MonitoringProposal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ===================================================================
    // FETCH MONITORING PROPOSALS
    // ===================================================================
    const fetchMonitoringProposals = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/de-xuat/danh-sach?status=DANG_GIAM_SAT');
            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || 'Failed to fetch');
            }

            // Enrich với monitoring data
            const enriched: MonitoringProposal[] = (json.data || []).map((p: DeXuat) => {
                const executedTime = p.thoiGian_ThucThi || new Date().toISOString();
                const passedCheckpoints = getAllPassedCheckpoints(executedTime);
                const lastCheckpoint = passedCheckpoints[passedCheckpoints.length - 1] || null;

                return {
                    ...p,
                    nextCheckpoint: lastCheckpoint === 'D7' ? 'Completed' :
                        lastCheckpoint === 'D3' ? 'D7' :
                            lastCheckpoint === 'D1' ? 'D3' : 'D1',
                    daysRemaining: daysUntilNextCheckpoint(executedTime, lastCheckpoint),
                };
            });

            setProposals(enriched);
        } catch (err) {
            console.error('Error fetching monitoring proposals:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMonitoringProposals();
    }, [fetchMonitoringProposals]);

    // ===================================================================
    // HELPERS
    // ===================================================================
    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('vi-VN');
    };

    const formatCurrency = (value: number) => {
        return value.toLocaleString('de-DE') + ' ₫';
    };

    const calculateChange = (before: number, after: number) => {
        if (before === 0) return 0;
        return ((after - before) / before) * 100;
    };

    // ===================================================================
    // RENDER
    // ===================================================================
    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>Bảng Giám Sát</h1>
                <p style={styles.subtitle}>
                    Theo dõi kết quả của các đề xuất đã thực thi
                </p>
            </div>

            {/* Loading */}
            {isLoading && (
                <div style={styles.loader}>
                    <p>Đang tải...</p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{ ...styles.emptyState, border: `1px solid ${colors.error}` }}>
                    <p style={{ color: colors.error }}>❌ {error}</p>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && proposals.length === 0 && (
                <div style={styles.emptyState}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👁️</div>
                    <p style={{ fontSize: '1.1rem', fontWeight: 500, color: colors.text }}>
                        Chưa có đề xuất nào đang được giám sát
                    </p>
                    <p style={{ fontSize: '0.875rem', color: colors.textMuted, marginTop: '8px' }}>
                        Proposals sẽ hiển thị ở đây sau khi được thực thi
                    </p>
                </div>
            )}

            {/* Monitoring Cards */}
            {!isLoading && !error && proposals.length > 0 && (
                <div style={styles.grid}>
                    {proposals.map((proposal) => {
                        const executedTime = proposal.thoiGian_ThucThi || new Date().toISOString();
                        const monitoringEnd = proposal.giamSat_DenNgay || new Date().toISOString();
                        const passedCheckpoints = getAllPassedCheckpoints(executedTime);

                        return (
                            <div key={proposal.id} style={styles.card}>
                                {/* Header */}
                                <div style={styles.cardHeader}>
                                    <h3 style={styles.campaignName}>{proposal.tenCampaign}</h3>
                                    <div style={styles.meta}>
                                        <span>Thực thi: {formatDate(executedTime)}</span>
                                        {' • '}
                                        <span>Giám sát đến: {formatDate(monitoringEnd)}</span>
                                        {proposal.daysRemaining !== undefined && proposal.daysRemaining > 0 && (
                                            <>
                                                {' • '}
                                                <span>Còn {proposal.daysRemaining} ngày</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Timeline */}
                                <div style={styles.timeline}>
                                    <p style={styles.timelineTitle}>Timeline Giám Sát</p>
                                    <div style={styles.checkpoints}>
                                        <div style={styles.progressLine} />

                                        {/* D+1 */}
                                        <div style={styles.checkpoint(false, passedCheckpoints.includes('D1'))}>
                                            <div style={styles.checkpointDot(false, passedCheckpoints.includes('D1'))}>
                                                {passedCheckpoints.includes('D1') ? '✓' : '1'}
                                            </div>
                                            <div style={styles.checkpointLabel}>D+1</div>
                                            <div style={styles.checkpointStatus}>
                                                {passedCheckpoints.includes('D1') ? 'Hoàn thành' : 'Chờ'}
                                            </div>
                                        </div>

                                        {/* D+3 */}
                                        <div style={styles.checkpoint(false, passedCheckpoints.includes('D3'))}>
                                            <div style={styles.checkpointDot(false, passedCheckpoints.includes('D3'))}>
                                                {passedCheckpoints.includes('D3') ? '✓' : '3'}
                                            </div>
                                            <div style={styles.checkpointLabel}>D+3</div>
                                            <div style={styles.checkpointStatus}>
                                                {passedCheckpoints.includes('D3') ? 'Hoàn thành' : 'Chờ'}
                                            </div>
                                        </div>

                                        {/* D+7 */}
                                        <div style={styles.checkpoint(false, passedCheckpoints.includes('D7'))}>
                                            <div style={styles.checkpointDot(false, passedCheckpoints.includes('D7'))}>
                                                {passedCheckpoints.includes('D7') ? '✓' : '7'}
                                            </div>
                                            <div style={styles.checkpointLabel}>D+7</div>
                                            <div style={styles.checkpointStatus}>
                                                {passedCheckpoints.includes('D7') ? 'Hoàn thành' : 'Chờ'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Metrics Comparison */}
                                <div style={styles.metricsSection}>
                                    <p style={styles.timelineTitle}>So Sánh Metrics</p>
                                    <div style={styles.metricsGrid}>
                                        {/* CPP */}
                                        <div style={styles.metricCard}>
                                            <div style={styles.metricLabel}>CPP</div>
                                            <div style={styles.metricValue}>
                                                {formatCurrency(proposal.metrics_TruocKhi?.cpp || 0)}
                                            </div>
                                            <div style={styles.metricChange(false)}>
                                                Trước khi thực thi
                                            </div>
                                        </div>

                                        {/* ROAS */}
                                        <div style={styles.metricCard}>
                                            <div style={styles.metricLabel}>ROAS</div>
                                            <div style={styles.metricValue}>
                                                {(proposal.metrics_TruocKhi?.roas || 0).toFixed(2)}x
                                            </div>
                                            <div style={styles.metricChange(false)}>
                                                Trước khi thực thi
                                            </div>
                                        </div>

                                        {/* Chi tiêu */}
                                        <div style={styles.metricCard}>
                                            <div style={styles.metricLabel}>Chi tiêu</div>
                                            <div style={styles.metricValue}>
                                                {formatCurrency(proposal.metrics_TruocKhi?.chiTieu || 0)}
                                            </div>
                                            <div style={styles.metricChange(false)}>
                                                Trước khi thực thi
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
