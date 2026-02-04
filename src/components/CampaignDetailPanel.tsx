'use client';

import { useState, useEffect } from 'react';

interface AIAnalysis {
    // NEW: Cơ sở phân tích
    dataBasis?: {
        days: number;
        orders: number;
        spend: number;
    };
    // NEW: 4 chiều phân tích
    dimensions?: {
        financial: { status: 'excellent' | 'good' | 'warning' | 'critical'; summary: string };
        content: { status: 'excellent' | 'good' | 'warning' | 'critical'; summary: string };
        audience: { status: 'excellent' | 'good' | 'warning' | 'critical'; summary: string };
        trend: { direction: 'improving' | 'stable' | 'declining'; summary: string };
    };
    // NEW: Verdict dứt khoát
    verdict?: {
        action: 'SCALE' | 'MAINTAIN' | 'WATCH' | 'REDUCE' | 'STOP';
        headline: string;
        condition?: string;
    };
    // NEW: Action plan v2
    actionPlan: {
        immediate: string | { action: string; reason: string };
        shortTerm?: string | { action: string; trigger: string };
        prevention?: string;
    };
    // Legacy fields
    summary?: string;
    diagnosis?: string;
    marketContext?: string;
    confidence?: 'high' | 'medium' | 'low';
    reasoning?: string;
}

interface Issue {
    type: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    detail: string;
    action: string;
}

interface Ad {
    id: string;
    name: string;
    status: string;
    thumbnail: string | null;
    totals: {
        spend: number;
        purchases: number;
        cpp: number;
        ctr: number;
    };
}

interface Props {
    campaign: {
        id: string;
        name: string;
        totals: {
            spend: number;
            purchases: number;
            revenue: number;
            cpp: number;
            roas: number;
            ctr: number;
        };
        issues: Issue[];
        dailyMetrics?: Array<{
            date: string;
            spend: number;
            purchases: number;
            cpp: number;
            ctr: number;
        }>;
    };
    dateRange: { startDate: string; endDate: string };
    onClose: () => void;
    formatMoney: (n: number) => string;
}

// Mini Bar Chart Component for issue visualization
function MiniBarChart({
    data,
    metricKey,
    label,
    formatValue,
    highlightCondition
}: {
    data: Array<{ date: string;[key: string]: number | string }>;
    metricKey: 'cpp' | 'ctr';
    label: string;
    formatValue: (v: number) => string;
    highlightCondition?: (value: number, avgValue: number) => boolean;
}) {
    if (!data || data.length === 0) return null;

    const values = data.map(d => typeof d[metricKey] === 'number' ? d[metricKey] as number : 0);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values.filter(v => v > 0)); // Filter out 0s for better scaling
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;

    // Chart container height in pixels
    const chartHeight = 80;

    return (
        <div style={{ marginTop: '16px' }}>
            <p style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: colors.textMuted,
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
            }}>
                📊 {label} qua {data.length} ngày
            </p>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: `${chartHeight}px` }}>
                {data.map((d, idx) => {
                    const value = typeof d[metricKey] === 'number' ? d[metricKey] as number : 0;
                    // Scale from minValue to maxValue for better visualization
                    // If all values are same, show 50% height
                    let heightPercent: number;
                    if (maxValue === minValue) {
                        heightPercent = 50;
                    } else {
                        // Scale between 15% (min) and 100% (max) for better visual differentiation
                        heightPercent = 15 + ((value - minValue) / (maxValue - minValue)) * 85;
                    }
                    const barHeight = Math.max((heightPercent / 100) * chartHeight, 4);
                    const isHighlighted = highlightCondition ? highlightCondition(value, avgValue) : false;

                    return (
                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                            <div
                                style={{
                                    width: '100%',
                                    height: `${barHeight}px`,
                                    background: isHighlighted
                                        ? 'linear-gradient(180deg, #F6465D, #F6465D80)'
                                        : `linear-gradient(180deg, ${colors.primary}, ${colors.primary}80)`,
                                    borderRadius: '3px 3px 0 0',
                                    transition: 'height 0.3s ease',
                                }}
                                title={`${d.date}: ${formatValue(value)}`}
                            />
                            <span style={{
                                fontSize: '0.5rem',
                                color: colors.textSubtle,
                                marginTop: '4px',
                                whiteSpace: 'nowrap'
                            }}>
                                {d.date.slice(8)} {/* DD only */}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                fontSize: '0.7rem',
                color: colors.textMuted
            }}>
                <span>Thấp nhất: {formatValue(Math.min(...values))}</span>
                <span>TB: {formatValue(avgValue)}</span>
                <span>Cao nhất: {formatValue(maxValue)}</span>
            </div>
        </div>
    );
}

// CEX Trading Design System - Exact Colors
const colors = {
    primary: '#F0B90B',
    primaryHover: '#FCD535',
    accent: '#0ECB81',
    success: '#0ECB81',
    error: '#F6465D',
    warning: '#F0B90B',
    bg: '#0B0E11',
    bgAlt: '#1E2329',
    bgCard: '#181A20',
    text: '#EAECEF',
    textMuted: '#848E9C',
    textSubtle: '#5E6673',
    border: '#2B3139',
};

const styles = {
    overlay: {
        position: 'fixed' as const,
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 50,
    },
    panel: {
        width: '100%',
        maxWidth: '650px',
        background: colors.bgCard,
        height: '100%',
        overflowY: 'auto' as const,
        boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
    },
    header: {
        padding: '20px 24px 0',
        borderBottom: `1px solid ${colors.border}`,
    },
    headerRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '16px',
    },
    title: {
        fontSize: '1.25rem',
        fontWeight: 700,
        color: colors.text,
        margin: '0 0 4px',
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        fontSize: '1.5rem',
        cursor: 'pointer',
        color: colors.textMuted,
        padding: '4px',
    },
    tabs: {
        display: 'flex',
        gap: '0',
    },
    tab: {
        padding: '12px 20px',
        border: 'none',
        background: 'transparent',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: colors.textMuted,
        cursor: 'pointer',
        borderBottom: '2px solid transparent',
        transition: 'all 0.2s',
    },
    tabActive: {
        color: colors.primary,
        borderBottomColor: colors.primary,
    },
    content: {
        padding: '24px',
    },
    section: {
        marginBottom: '24px',
    },
    sectionTitle: {
        fontSize: '0.875rem',
        fontWeight: 600,
        color: colors.text,
        marginBottom: '12px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
    },
    metricsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
    },
    metricCard: {
        background: colors.bgAlt,
        borderRadius: '8px',
        padding: '12px',
        border: `1px solid ${colors.border}`,
    },
    metricLabel: {
        fontSize: '0.75rem',
        color: colors.textMuted,
        margin: '0 0 4px',
    },
    metricValue: {
        fontSize: '1.125rem',
        fontWeight: 600,
        color: colors.text,
        margin: 0,
        fontFamily: '"JetBrains Mono", monospace',
    },
    aiButton: {
        width: '100%',
        padding: '14px',
        background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})`,
        color: colors.bg,
        border: 'none',
        borderRadius: '10px',
        fontSize: '1rem',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
    },
    aiResult: {
        background: colors.bgAlt,
        borderRadius: '12px',
        padding: '20px',
        border: `1px solid ${colors.border}`,
    },
    aiSummary: {
        fontSize: '1rem',
        fontWeight: 600,
        color: colors.text,
        margin: '0 0 12px',
        lineHeight: 1.5,
    },
    aiBlock: {
        marginBottom: '16px',
    },
    aiBlockTitle: {
        fontSize: '0.75rem',
        fontWeight: 600,
        color: colors.primary,
        margin: '0 0 6px',
        textTransform: 'uppercase' as const,
    },
    aiBlockContent: {
        fontSize: '0.875rem',
        color: colors.textMuted,
        margin: 0,
        lineHeight: 1.6,
    },
    actionBox: {
        background: 'rgba(14, 203, 129, 0.1)',
        border: `1px solid rgba(14, 203, 129, 0.3)`,
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '8px',
    },
    actionLabel: {
        fontSize: '0.75rem',
        fontWeight: 600,
        color: colors.success,
        margin: '0 0 4px',
    },
    actionContent: {
        fontSize: '0.875rem',
        color: colors.text,
        margin: 0,
    },
    loader: {
        textAlign: 'center' as const,
        padding: '40px',
        color: colors.primary,
    },
    confidence: {
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 500,
    },
    // Ads styles
    adCard: {
        display: 'flex',
        gap: '16px',
        padding: '16px',
        background: colors.bgAlt,
        borderRadius: '12px',
        marginBottom: '12px',
        border: `1px solid ${colors.border}`,
    },
    adThumbnail: {
        width: '80px',
        height: '80px',
        borderRadius: '8px',
        objectFit: 'cover' as const,
        background: colors.border,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        flexShrink: 0,
    },
    adInfo: {
        flex: 1,
        minWidth: 0,
    },
    adName: {
        fontSize: '0.9375rem',
        fontWeight: 600,
        color: colors.text,
        margin: '0 0 8px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
    },
    adMetrics: {
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap' as const,
    },
    adMetric: {
        fontSize: '0.8125rem',
        color: colors.textMuted,
    },
    adBadge: {
        display: 'inline-block',
        fontSize: '0.6875rem',
        padding: '2px 6px',
        borderRadius: '4px',
        fontWeight: 500,
        marginLeft: '8px',
    },
};

export default function CampaignDetailPanel({ campaign, dateRange, onClose, formatMoney }: Props) {
    const [activeTab, setActiveTab] = useState<'overview' | 'ads'>('overview');
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [dailyTrend, setDailyTrend] = useState<Array<{
        date: string;
        spend: number;
        purchases: number;
        cpp: number;
        ctr: number;
    }>>([]);

    // Ads data
    const [ads, setAds] = useState<Ad[]>([]);
    const [isLoadingAds, setIsLoadingAds] = useState(false);
    const [adsError, setAdsError] = useState<string | null>(null);

    // Fetch ads when tab changes
    useEffect(() => {
        if (activeTab === 'ads' && ads.length === 0 && !isLoadingAds) {
            fetchAds();
        }
    }, [activeTab]);

    const fetchAds = async () => {
        setIsLoadingAds(true);
        setAdsError(null);

        try {
            const res = await fetch(
                `/api/analysis/campaign/${campaign.id}/ads?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
            );
            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error);
            }

            setAds(json.data.ads || []);
        } catch (error) {
            setAdsError(error instanceof Error ? error.message : 'Có lỗi xảy ra');
        } finally {
            setIsLoadingAds(false);
        }
    };

    const handleAnalyzeAI = async () => {
        setIsLoadingAI(true);
        setAiError(null);

        try {
            const res = await fetch(`/api/analysis/campaign/${campaign.id}/ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                }),
            });

            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error);
            }

            setAiAnalysis(json.data.aiAnalysis);
            // Save daily trend for chart
            if (json.data.dailyTrend) {
                setDailyTrend(json.data.dailyTrend);
            }
        } catch (error) {
            setAiError(error instanceof Error ? error.message : 'Có lỗi xảy ra');
        } finally {
            setIsLoadingAI(false);
        }
    };

    const getConfidenceStyle = (confidence: string) => {
        switch (confidence) {
            case 'high':
                return { background: '#dcfce7', color: '#166534' };
            case 'medium':
                return { background: '#fef3c7', color: '#92400e' };
            default:
                return { background: '#fee2e2', color: '#991b1b' };
        }
    };

    const getCppBadge = (cpp: number, avgCpp: number) => {
        if (cpp === 0) return null;
        if (cpp < avgCpp * 0.8) {
            return { text: 'Tốt', bg: '#dcfce7', color: '#166534' };
        }
        if (cpp > avgCpp * 1.3) {
            return { text: 'Kém', bg: '#fee2e2', color: '#991b1b' };
        }
        return null;
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.panel} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.headerRow}>
                        <div>
                            <h2 style={styles.title}>{campaign.name}</h2>
                            <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: 0 }}>
                                {dateRange.startDate} → {dateRange.endDate}
                            </p>
                        </div>
                        <button style={styles.closeBtn} onClick={onClose}>×</button>
                    </div>

                    {/* Tabs */}
                    <div style={styles.tabs}>
                        <button
                            style={{
                                ...styles.tab,
                                ...(activeTab === 'overview' ? styles.tabActive : {})
                            }}
                            onClick={() => setActiveTab('overview')}
                        >
                            📊 Tổng quan
                        </button>
                        <button
                            style={{
                                ...styles.tab,
                                ...(activeTab === 'ads' ? styles.tabActive : {})
                            }}
                            onClick={() => setActiveTab('ads')}
                        >
                            🖼️ Ads ({ads.length || '...'})
                        </button>
                    </div>
                </div>

                <div style={styles.content}>
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Metrics */}
                            <div style={styles.section}>
                                <h3 style={styles.sectionTitle}>Tổng quan</h3>
                                <div style={styles.metricsGrid}>
                                    <div style={styles.metricCard}>
                                        <p style={styles.metricLabel}>Chi tiêu</p>
                                        <p style={styles.metricValue}>{formatMoney(campaign.totals.spend)}</p>
                                    </div>
                                    <div style={styles.metricCard}>
                                        <p style={styles.metricLabel}>Số đơn</p>
                                        <p style={styles.metricValue}>{campaign.totals.purchases}</p>
                                    </div>
                                    <div style={styles.metricCard}>
                                        <p style={styles.metricLabel}>CPP</p>
                                        <p style={styles.metricValue}>{formatMoney(campaign.totals.cpp)}</p>
                                    </div>
                                    <div style={styles.metricCard}>
                                        <p style={styles.metricLabel}>ROAS</p>
                                        <p style={styles.metricValue}>{campaign.totals.roas.toFixed(2)}x</p>
                                    </div>
                                    <div style={styles.metricCard}>
                                        <p style={styles.metricLabel}>CTR</p>
                                        <p style={styles.metricValue}>{campaign.totals.ctr.toFixed(2)}%</p>
                                    </div>
                                    <div style={styles.metricCard}>
                                        <p style={styles.metricLabel}>Doanh thu</p>
                                        <p style={styles.metricValue}>{formatMoney(campaign.totals.revenue)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Issues */}
                            {campaign.issues.length > 0 && (
                                <div style={styles.section}>
                                    <h3 style={styles.sectionTitle}>Vấn đề phát hiện</h3>
                                    {campaign.issues.map((issue, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                background: issue.severity === 'critical' ? 'rgba(246, 70, 93, 0.1)' : 'rgba(240, 185, 11, 0.1)',
                                                border: `1px solid ${issue.severity === 'critical' ? 'rgba(246, 70, 93, 0.3)' : 'rgba(240, 185, 11, 0.3)'}`,
                                                borderRadius: '8px',
                                                padding: '12px',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            <p style={{
                                                fontWeight: 600,
                                                color: issue.severity === 'critical' ? colors.error : colors.warning,
                                                margin: '0 0 4px',
                                            }}>
                                                {issue.message}
                                            </p>
                                            <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: '0 0 8px' }}>
                                                {issue.detail}
                                            </p>
                                            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: colors.success, margin: 0 }}>
                                                → {issue.action}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Mini Bar Chart for Issue Metrics */}
                            {dailyTrend.length > 0 && campaign.issues.length > 0 && (
                                <div style={styles.section}>
                                    <h3 style={styles.sectionTitle}>📈 Biểu đồ chi tiết</h3>
                                    {campaign.issues.some(i => i.type.toLowerCase().includes('cpp')) && (
                                        <MiniBarChart
                                            data={dailyTrend}
                                            metricKey="cpp"
                                            label="CPP (Chi phí/đơn)"
                                            formatValue={(v) => formatMoney(v)}
                                            highlightCondition={(value, avg) => value > avg * 1.2}
                                        />
                                    )}
                                    {campaign.issues.some(i => i.type.toLowerCase().includes('ctr')) && (
                                        <MiniBarChart
                                            data={dailyTrend}
                                            metricKey="ctr"
                                            label="CTR (Click rate)"
                                            formatValue={(v) => v.toFixed(2) + '%'}
                                            highlightCondition={(value, avg) => value < avg * 0.8}
                                        />
                                    )}
                                </div>
                            )}

                            {/* AI Analysis */}
                            <div style={styles.section}>
                                <h3 style={styles.sectionTitle}>🧠 Phân tích AI</h3>

                                {!aiAnalysis && !isLoadingAI && !aiError && (
                                    <button
                                        style={styles.aiButton}
                                        onClick={handleAnalyzeAI}
                                    >
                                        🧠 Phân tích sâu với AI
                                    </button>
                                )}

                                {isLoadingAI && (
                                    <div style={styles.loader}>
                                        <p>⏳ Đang phân tích...</p>
                                        <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>
                                            AI đang xem xét dữ liệu và đưa ra khuyến nghị
                                        </p>
                                    </div>
                                )}

                                {aiError && (
                                    <div style={{ textAlign: 'center', padding: '20px', color: '#dc2626' }}>
                                        <p>❌ {aiError}</p>
                                        <button
                                            onClick={handleAnalyzeAI}
                                            style={{ ...styles.aiButton, marginTop: '12px', background: '#dc2626' }}
                                        >
                                            Thử lại
                                        </button>
                                    </div>
                                )}

                                {aiAnalysis && (
                                    <div style={styles.aiResult}>
                                        {/* NEW: Verdict Header */}
                                        {aiAnalysis.verdict && (
                                            <div style={{
                                                padding: '16px',
                                                borderRadius: '12px',
                                                marginBottom: '16px',
                                                background: aiAnalysis.verdict.action === 'SCALE' ? 'linear-gradient(135deg, #059669, #10b981)' :
                                                    aiAnalysis.verdict.action === 'MAINTAIN' ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)' :
                                                        aiAnalysis.verdict.action === 'WATCH' ? 'linear-gradient(135deg, #d97706, #fbbf24)' :
                                                            aiAnalysis.verdict.action === 'REDUCE' ? 'linear-gradient(135deg, #ea580c, #fb923c)' :
                                                                'linear-gradient(135deg, #dc2626, #f87171)',
                                            }}>
                                                <p style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>
                                                    {aiAnalysis.verdict.headline}
                                                </p>
                                                {aiAnalysis.verdict.condition && (
                                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', marginTop: '8px' }}>
                                                        📋 {aiAnalysis.verdict.condition}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* NEW: Data Basis (thay thế Độ tin cậy) */}
                                        {aiAnalysis.dataBasis && (
                                            <div style={{
                                                display: 'flex',
                                                gap: '12px',
                                                marginBottom: '16px',
                                                fontSize: '12px',
                                                color: '#8b8b8b',
                                            }}>
                                                <span>📊 Cơ sở: {aiAnalysis.dataBasis.days} ngày</span>
                                                <span>|</span>
                                                <span>{aiAnalysis.dataBasis.orders} đơn</span>
                                                <span>|</span>
                                                <span>{formatMoney(aiAnalysis.dataBasis.spend)} chi tiêu</span>
                                            </div>
                                        )}

                                        {/* NEW: 4 Dimensions */}
                                        {aiAnalysis.dimensions && (
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(2, 1fr)',
                                                gap: '12px',
                                                marginBottom: '20px',
                                            }}>
                                                {/* Financial */}
                                                <div style={{
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    background: '#1a1a1a',
                                                    border: '1px solid #2a2a2a',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                        <span>💰</span>
                                                        <span style={{ fontWeight: 600, color: '#e0e0e0' }}>Tài chính</span>
                                                        <span style={{
                                                            marginLeft: 'auto',
                                                            fontSize: '11px',
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            background: aiAnalysis.dimensions.financial.status === 'excellent' ? '#059669' :
                                                                aiAnalysis.dimensions.financial.status === 'good' ? '#3b82f6' :
                                                                    aiAnalysis.dimensions.financial.status === 'warning' ? '#d97706' : '#dc2626',
                                                            color: '#fff',
                                                        }}>
                                                            {aiAnalysis.dimensions.financial.status === 'excellent' ? '✓ Xuất sắc' :
                                                                aiAnalysis.dimensions.financial.status === 'good' ? '✓ Tốt' :
                                                                    aiAnalysis.dimensions.financial.status === 'warning' ? '⚠ Cần chú ý' : '✗ Nghiêm trọng'}
                                                        </span>
                                                    </div>
                                                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{aiAnalysis.dimensions.financial.summary}</p>
                                                </div>

                                                {/* Content */}
                                                <div style={{
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    background: '#1a1a1a',
                                                    border: '1px solid #2a2a2a',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                        <span>🎯</span>
                                                        <span style={{ fontWeight: 600, color: '#e0e0e0' }}>Content</span>
                                                        <span style={{
                                                            marginLeft: 'auto',
                                                            fontSize: '11px',
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            background: aiAnalysis.dimensions.content.status === 'excellent' ? '#059669' :
                                                                aiAnalysis.dimensions.content.status === 'good' ? '#3b82f6' :
                                                                    aiAnalysis.dimensions.content.status === 'warning' ? '#d97706' : '#dc2626',
                                                            color: '#fff',
                                                        }}>
                                                            {aiAnalysis.dimensions.content.status === 'excellent' ? '✓ Xuất sắc' :
                                                                aiAnalysis.dimensions.content.status === 'good' ? '✓ Tốt' :
                                                                    aiAnalysis.dimensions.content.status === 'warning' ? '⚠ Cần chú ý' : '✗ Nghiêm trọng'}
                                                        </span>
                                                    </div>
                                                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{aiAnalysis.dimensions.content.summary}</p>
                                                </div>

                                                {/* Audience */}
                                                <div style={{
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    background: '#1a1a1a',
                                                    border: '1px solid #2a2a2a',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                        <span>👥</span>
                                                        <span style={{ fontWeight: 600, color: '#e0e0e0' }}>Audience</span>
                                                        <span style={{
                                                            marginLeft: 'auto',
                                                            fontSize: '11px',
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            background: aiAnalysis.dimensions.audience.status === 'excellent' ? '#059669' :
                                                                aiAnalysis.dimensions.audience.status === 'good' ? '#3b82f6' :
                                                                    aiAnalysis.dimensions.audience.status === 'warning' ? '#d97706' : '#dc2626',
                                                            color: '#fff',
                                                        }}>
                                                            {aiAnalysis.dimensions.audience.status === 'excellent' ? '✓ Xuất sắc' :
                                                                aiAnalysis.dimensions.audience.status === 'good' ? '✓ Tốt' :
                                                                    aiAnalysis.dimensions.audience.status === 'warning' ? '⚠ Cần chú ý' : '✗ Nghiêm trọng'}
                                                        </span>
                                                    </div>
                                                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{aiAnalysis.dimensions.audience.summary}</p>
                                                </div>

                                                {/* Trend */}
                                                <div style={{
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    background: '#1a1a1a',
                                                    border: '1px solid #2a2a2a',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                        <span>📈</span>
                                                        <span style={{ fontWeight: 600, color: '#e0e0e0' }}>Trend</span>
                                                        <span style={{
                                                            marginLeft: 'auto',
                                                            fontSize: '11px',
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            background: aiAnalysis.dimensions.trend.direction === 'improving' ? '#059669' :
                                                                aiAnalysis.dimensions.trend.direction === 'stable' ? '#3b82f6' : '#dc2626',
                                                            color: '#fff',
                                                        }}>
                                                            {aiAnalysis.dimensions.trend.direction === 'improving' ? '↗️ Đang tốt lên' :
                                                                aiAnalysis.dimensions.trend.direction === 'stable' ? '→ Ổn định' : '↘️ Đang xấu đi'}
                                                        </span>
                                                    </div>
                                                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{aiAnalysis.dimensions.trend.summary}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Fallback: Legacy summary if no verdict */}
                                        {!aiAnalysis.verdict && aiAnalysis.summary && (
                                            <p style={styles.aiSummary}>{aiAnalysis.summary}</p>
                                        )}

                                        {/* Action Plan */}
                                        <div style={{ ...styles.aiBlock, marginTop: '16px' }}>
                                            <p style={styles.aiBlockTitle}>Kế hoạch hành động</p>

                                            <div style={styles.actionBox}>
                                                <p style={styles.actionLabel}>⚡ LÀM NGAY</p>
                                                <p style={styles.actionContent}>
                                                    {typeof aiAnalysis.actionPlan.immediate === 'string'
                                                        ? aiAnalysis.actionPlan.immediate
                                                        : aiAnalysis.actionPlan.immediate.action}
                                                </p>
                                                {typeof aiAnalysis.actionPlan.immediate === 'object' && aiAnalysis.actionPlan.immediate.reason && (
                                                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                                        💡 {aiAnalysis.actionPlan.immediate.reason}
                                                    </p>
                                                )}
                                            </div>

                                            {aiAnalysis.actionPlan.shortTerm && (
                                                <div style={{ ...styles.actionBox, background: '#0f172a', borderColor: '#1e3a5f' }}>
                                                    <p style={{ ...styles.actionLabel, color: '#38bdf8' }}>📅 2-3 NGÀY TỚI</p>
                                                    <p style={{ ...styles.actionContent, color: '#7dd3fc' }}>
                                                        {typeof aiAnalysis.actionPlan.shortTerm === 'string'
                                                            ? aiAnalysis.actionPlan.shortTerm
                                                            : aiAnalysis.actionPlan.shortTerm.action}
                                                    </p>
                                                    {typeof aiAnalysis.actionPlan.shortTerm === 'object' && aiAnalysis.actionPlan.shortTerm.trigger && (
                                                        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                                            🎯 Trigger: {aiAnalysis.actionPlan.shortTerm.trigger}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {aiAnalysis.actionPlan.prevention && (
                                                <div style={{ ...styles.actionBox, background: '#1a1625', borderColor: '#2e2640' }}>
                                                    <p style={{ ...styles.actionLabel, color: '#a78bfa' }}>🛡️ PHÒNG NGỪA</p>
                                                    <p style={{ ...styles.actionContent, color: '#c4b5fd' }}>{aiAnalysis.actionPlan.prevention}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Reasoning */}
                                        {aiAnalysis.reasoning && (
                                            <div style={{ ...styles.aiBlock, borderTop: '1px solid #2a2a2a', paddingTop: '16px', marginTop: '16px' }}>
                                                <p style={styles.aiBlockTitle}>Lý do</p>
                                                <p style={styles.aiBlockContent}>{aiAnalysis.reasoning}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Ads Tab */}
                    {activeTab === 'ads' && (
                        <div style={styles.section}>
                            <h3 style={styles.sectionTitle}>
                                Danh sách Ads
                                <span style={{ fontWeight: 400, color: '#71717a', marginLeft: '8px' }}>
                                    (sắp theo chi tiêu cao nhất)
                                </span>
                            </h3>

                            {isLoadingAds && (
                                <div style={styles.loader}>
                                    <p>⏳ Đang tải danh sách ads...</p>
                                </div>
                            )}

                            {adsError && (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#dc2626' }}>
                                    <p>❌ {adsError}</p>
                                    <button
                                        onClick={fetchAds}
                                        style={{ ...styles.aiButton, marginTop: '12px', background: '#dc2626' }}
                                    >
                                        Thử lại
                                    </button>
                                </div>
                            )}

                            {!isLoadingAds && !adsError && ads.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#71717a' }}>
                                    <p>Không có ads nào trong khoảng thời gian này</p>
                                </div>
                            )}

                            {ads.map((ad) => {
                                const badge = getCppBadge(ad.totals.cpp, campaign.totals.cpp);
                                return (
                                    <div key={ad.id} style={styles.adCard}>
                                        {/* Thumbnail */}
                                        {ad.thumbnail ? (
                                            <img
                                                src={ad.thumbnail}
                                                alt={ad.name}
                                                style={styles.adThumbnail as React.CSSProperties}
                                            />
                                        ) : (
                                            <div style={styles.adThumbnail}>🖼️</div>
                                        )}

                                        {/* Info */}
                                        <div style={styles.adInfo}>
                                            <p style={styles.adName}>
                                                {ad.name}
                                                {ad.status !== 'ACTIVE' && (
                                                    <span style={{
                                                        ...styles.adBadge,
                                                        background: '#f4f4f5',
                                                        color: '#71717a'
                                                    }}>
                                                        {ad.status}
                                                    </span>
                                                )}
                                                {badge && (
                                                    <span style={{
                                                        ...styles.adBadge,
                                                        background: badge.bg,
                                                        color: badge.color
                                                    }}>
                                                        {badge.text}
                                                    </span>
                                                )}
                                            </p>
                                            <div style={styles.adMetrics}>
                                                <span style={styles.adMetric}>
                                                    💰 <strong>{formatMoney(ad.totals.spend)}</strong>
                                                </span>
                                                <span style={styles.adMetric}>
                                                    🛒 <strong>{ad.totals.purchases}</strong> đơn
                                                </span>
                                                <span style={styles.adMetric}>
                                                    📊 CPP: <strong>{formatMoney(ad.totals.cpp)}</strong>
                                                </span>
                                                <span style={styles.adMetric}>
                                                    👆 CTR: <strong>{ad.totals.ctr.toFixed(2)}%</strong>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
