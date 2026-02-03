'use client';

import { useState } from 'react';

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

const styles = {
    overlay: {
        position: 'fixed' as const,
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 50,
    },
    panel: {
        width: '100%',
        maxWidth: '600px',
        background: '#ffffff',
        height: '100%',
        overflowY: 'auto' as const,
        boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
    },
    header: {
        padding: '20px 24px',
        borderBottom: '1px solid #e4e4e7',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    title: {
        fontSize: '1.25rem',
        fontWeight: 700,
        color: '#18181b',
        margin: '0 0 4px',
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        fontSize: '1.5rem',
        cursor: 'pointer',
        color: '#71717a',
        padding: '4px',
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
        color: '#18181b',
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
        background: '#f4f4f5',
        borderRadius: '8px',
        padding: '12px',
    },
    metricLabel: {
        fontSize: '0.75rem',
        color: '#71717a',
        margin: '0 0 4px',
    },
    metricValue: {
        fontSize: '1.125rem',
        fontWeight: 600,
        color: '#18181b',
        margin: 0,
    },
    aiButton: {
        width: '100%',
        padding: '14px',
        background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
        color: 'white',
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
        background: '#f8f7ff',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #e9e5ff',
    },
    aiSummary: {
        fontSize: '1rem',
        fontWeight: 600,
        color: '#18181b',
        margin: '0 0 12px',
        lineHeight: 1.5,
    },
    aiBlock: {
        marginBottom: '16px',
    },
    aiBlockTitle: {
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#6366f1',
        margin: '0 0 6px',
        textTransform: 'uppercase' as const,
    },
    aiBlockContent: {
        fontSize: '0.875rem',
        color: '#52525b',
        margin: 0,
        lineHeight: 1.6,
    },
    actionBox: {
        background: '#ecfdf5',
        border: '1px solid #a7f3d0',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '8px',
    },
    actionLabel: {
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#059669',
        margin: '0 0 4px',
    },
    actionContent: {
        fontSize: '0.875rem',
        color: '#065f46',
        margin: 0,
    },
    loader: {
        textAlign: 'center' as const,
        padding: '40px',
        color: '#6366f1',
    },
    confidence: {
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 500,
    },
};

export default function CampaignDetailPanel({ campaign, dateRange, onClose, formatMoney }: Props) {
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

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

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.panel} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div>
                        <h2 style={styles.title}>{campaign.name}</h2>
                        <p style={{ fontSize: '0.875rem', color: '#71717a', margin: 0 }}>
                            {dateRange.startDate} → {dateRange.endDate}
                        </p>
                    </div>
                    <button style={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                <div style={styles.content}>
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
                                        background: issue.severity === 'critical' ? '#fef2f2' : '#fffbeb',
                                        border: `1px solid ${issue.severity === 'critical' ? '#fecaca' : '#fde68a'}`,
                                        borderRadius: '8px',
                                        padding: '12px',
                                        marginBottom: '8px',
                                    }}
                                >
                                    <p style={{
                                        fontWeight: 600,
                                        color: issue.severity === 'critical' ? '#dc2626' : '#d97706',
                                        margin: '0 0 4px',
                                    }}>
                                        {issue.message}
                                    </p>
                                    <p style={{ fontSize: '0.875rem', color: '#52525b', margin: '0 0 8px' }}>
                                        {issue.detail}
                                    </p>
                                    <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#059669', margin: 0 }}>
                                        → {issue.action}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* AI Analysis */}
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>🧠 Phân tích AI</h3>

                        {!aiAnalysis && !isLoadingAI && (
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
                                {/* Summary */}
                                <p style={styles.aiSummary}>{aiAnalysis.summary}</p>

                                {/* Confidence */}
                                <span style={{ ...styles.confidence, ...getConfidenceStyle(aiAnalysis.confidence) }}>
                                    Độ tin cậy: {aiAnalysis.confidence === 'high' ? 'Cao' : aiAnalysis.confidence === 'medium' ? 'Trung bình' : 'Thấp'}
                                </span>

                                {/* Diagnosis */}
                                <div style={{ ...styles.aiBlock, marginTop: '16px' }}>
                                    <p style={styles.aiBlockTitle}>Chẩn đoán</p>
                                    <p style={styles.aiBlockContent}>{aiAnalysis.diagnosis}</p>
                                </div>

                                {/* Market Context */}
                                {aiAnalysis.marketContext && (
                                    <div style={styles.aiBlock}>
                                        <p style={styles.aiBlockTitle}>Bối cảnh thị trường</p>
                                        <p style={styles.aiBlockContent}>{aiAnalysis.marketContext}</p>
                                    </div>
                                )}

                                {/* Action Plan */}
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

                                {/* Reasoning */}
                                <div style={{ ...styles.aiBlock, borderTop: '1px solid #e9e5ff', paddingTop: '16px' }}>
                                    <p style={styles.aiBlockTitle}>Lý do</p>
                                    <p style={styles.aiBlockContent}>{aiAnalysis.reasoning}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
