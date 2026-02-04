'use client';

import { useState, useEffect } from 'react';

interface AIAnalysis {
    summary: string;
    diagnosis: string;
    marketContext: string;
    actionPlan: {
        immediate: string;
        shortTerm: string;
        prevention: string;
    };
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
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
    };
    dateRange: { startDate: string; endDate: string };
    onClose: () => void;
    formatMoney: (n: number) => string;
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
                                        <p style={styles.aiSummary}>{aiAnalysis.summary}</p>

                                        <span style={{ ...styles.confidence, ...getConfidenceStyle(aiAnalysis.confidence) }}>
                                            Độ tin cậy: {aiAnalysis.confidence === 'high' ? 'Cao' : aiAnalysis.confidence === 'medium' ? 'Trung bình' : 'Thấp'}
                                        </span>

                                        <div style={{ ...styles.aiBlock, marginTop: '16px' }}>
                                            <p style={styles.aiBlockTitle}>Chẩn đoán</p>
                                            <p style={styles.aiBlockContent}>{aiAnalysis.diagnosis}</p>
                                        </div>

                                        {aiAnalysis.marketContext && (
                                            <div style={styles.aiBlock}>
                                                <p style={styles.aiBlockTitle}>Bối cảnh thị trường</p>
                                                <p style={styles.aiBlockContent}>{aiAnalysis.marketContext}</p>
                                            </div>
                                        )}

                                        <div style={{ ...styles.aiBlock, marginTop: '20px' }}>
                                            <p style={styles.aiBlockTitle}>Kế hoạch hành động</p>

                                            <div style={styles.actionBox}>
                                                <p style={styles.actionLabel}>⚡ LÀM NGAY</p>
                                                <p style={styles.actionContent}>{aiAnalysis.actionPlan.immediate}</p>
                                            </div>

                                            {aiAnalysis.actionPlan.shortTerm && (
                                                <div style={{ ...styles.actionBox, background: '#eff6ff', borderColor: '#bfdbfe' }}>
                                                    <p style={{ ...styles.actionLabel, color: '#2563eb' }}>📅 2-3 NGÀY TỚI</p>
                                                    <p style={{ ...styles.actionContent, color: '#1e40af' }}>{aiAnalysis.actionPlan.shortTerm}</p>
                                                </div>
                                            )}

                                            {aiAnalysis.actionPlan.prevention && (
                                                <div style={{ ...styles.actionBox, background: '#f8f7ff', borderColor: '#e9e5ff' }}>
                                                    <p style={{ ...styles.actionLabel, color: '#6366f1' }}>🛡️ PHÒNG NGỪA</p>
                                                    <p style={{ ...styles.actionContent, color: '#4338ca' }}>{aiAnalysis.actionPlan.prevention}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ ...styles.aiBlock, borderTop: '1px solid #e9e5ff', paddingTop: '16px' }}>
                                            <p style={styles.aiBlockTitle}>Lý do</p>
                                            <p style={styles.aiBlockContent}>{aiAnalysis.reasoning}</p>
                                        </div>
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
