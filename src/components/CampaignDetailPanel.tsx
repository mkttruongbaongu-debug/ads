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
        actionRecommendation?: {
            action: string;
            reason: string;
            emoji: string;
            color: string;
            healthScore?: number;
            metricTags?: Array<{
                metric: 'CTR' | 'CPP' | 'ROAS';
                direction: 'up' | 'down';
                severity: 'info' | 'warning' | 'critical';
                label: string;
                detail: string;
                color: string;
                zScore?: number;
            }>;
            lifeStage?: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            debugData?: Record<string, any>;
        };
        created_time?: string;
    };
    dateRange: { startDate: string; endDate: string };
    onClose: () => void;
    formatMoney: (n: number) => string;
    accountId: string; // Facebook Ad Account ID
}

// Bollinger Bands Bar Chart — Terminal Style
function BandsChart({
    data,
    metricKey,
    label,
    formatValue,
    ma,
    sigma,
    windowDays = 7,
}: {
    data: Array<{ date: string;[key: string]: number | string }>;
    metricKey: 'cpp' | 'ctr' | 'roas';
    label: string;
    formatValue: (v: number) => string;
    ma?: number;
    sigma?: number;
    windowDays?: number;
}) {
    if (!data || data.length === 0) return null;

    const values = data.map(d => typeof d[metricKey] === 'number' ? d[metricKey] as number : 0);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values.filter(v => v > 0));

    // Include MA and bands in range calculation for proper scaling
    const upperBand = ma && sigma ? ma + 2 * sigma : maxValue;
    const lowerBand = ma && sigma ? Math.max(0, ma - 2 * sigma) : minValue;
    const chartMax = Math.max(maxValue, upperBand) * 1.05;
    const chartMin = Math.min(minValue, lowerBand) * 0.95;
    const chartRange = chartMax - chartMin || 1;

    const chartHeight = 90;
    const historyCount = data.length - windowDays;

    // Convert value to Y position (pixels from bottom)
    const valueToY = (val: number) => {
        return ((val - chartMin) / chartRange) * chartHeight;
    };

    const maY = ma ? valueToY(ma) : undefined;
    const upperY = ma && sigma ? valueToY(ma + 2 * sigma) : undefined;
    const lowerY = ma && sigma ? valueToY(Math.max(0, ma - 2 * sigma)) : undefined;

    return (
        <div style={{ marginBottom: '16px' }}>
            <p style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: colors.textMuted,
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
            }}>
                {label} — {data.length}D
            </p>
            <div style={{ position: 'relative', height: `${chartHeight}px` }}>
                {/* Band lines */}
                {maY !== undefined && (
                    <div style={{
                        position: 'absolute', bottom: `${maY}px`, left: 0, right: 0,
                        borderBottom: `1px solid ${colors.primary}60`,
                        zIndex: 1,
                    }}>
                        <span style={{
                            position: 'absolute', right: 0, top: '-14px',
                            fontSize: '0.5625rem', color: colors.primary, fontFamily: '"JetBrains Mono", monospace',
                        }}>MA</span>
                    </div>
                )}
                {upperY !== undefined && upperY <= chartHeight && (
                    <div style={{
                        position: 'absolute', bottom: `${upperY}px`, left: 0, right: 0,
                        borderBottom: `1px dashed ${colors.error}40`,
                        zIndex: 1,
                    }}>
                        <span style={{
                            position: 'absolute', right: 0, top: '-14px',
                            fontSize: '0.5rem', color: `${colors.error}80`, fontFamily: '"JetBrains Mono", monospace',
                        }}>+2σ</span>
                    </div>
                )}
                {lowerY !== undefined && lowerY >= 0 && (
                    <div style={{
                        position: 'absolute', bottom: `${lowerY}px`, left: 0, right: 0,
                        borderBottom: `1px dashed ${colors.success}40`,
                        zIndex: 1,
                    }}>
                        <span style={{
                            position: 'absolute', right: 0, top: '-14px',
                            fontSize: '0.5rem', color: `${colors.success}80`, fontFamily: '"JetBrains Mono", monospace',
                        }}>-2σ</span>
                    </div>
                )}

                {/* Bars */}
                <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '100%', position: 'relative', zIndex: 2 }}>
                    {data.map((d, idx) => {
                        const value = typeof d[metricKey] === 'number' ? d[metricKey] as number : 0;
                        const barHeight = Math.max(valueToY(value), 3);
                        const isWindow = idx >= historyCount;
                        // For CPP (inverse metric), higher = worse
                        const isInverse = metricKey === 'cpp';
                        const isBad = isInverse ? (ma && value > ma * 1.3) : (ma && value < ma * 0.7);

                        return (
                            <div key={idx} style={{
                                flex: 1, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'flex-end', height: '100%'
                            }}>
                                <div
                                    style={{
                                        width: '100%',
                                        height: `${barHeight}px`,
                                        background: isBad
                                            ? colors.error
                                            : isWindow
                                                ? colors.primary
                                                : `${colors.textSubtle}80`,
                                        borderRadius: '2px 2px 0 0',
                                        opacity: isWindow ? 1 : 0.6,
                                        transition: 'height 0.3s ease',
                                    }}
                                    title={`${d.date}: ${formatValue(value)}${isWindow ? ' (window)' : ''}`}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* Legend */}
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: '6px', fontSize: '0.625rem', color: colors.textSubtle,
                fontFamily: '"JetBrains Mono", monospace',
            }}>
                <span>MIN {formatValue(Math.min(...values))}</span>
                {ma && <span>MA {formatValue(ma)}</span>}
                <span>MAX {formatValue(maxValue)}</span>
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
        padding: '32px 24px 0', // Increased top padding from 20px to 32px for breathing room
        borderBottom: `1px solid ${colors.border}`,
    },
    headerRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '16px',
    },
    title: {
        fontSize: '1.5rem', // Increased from 1.25rem for more prominence
        fontWeight: 700,
        color: colors.text,
        margin: '0 0 6px', // Increased bottom margin for better spacing
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
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
    },
    metricCard: {
        background: colors.bgAlt,
        borderRadius: '8px',
        padding: '16px',
        border: `1px solid ${colors.border}`,
        transition: 'transform 0.2s ease, border-color 0.2s ease',
    },
    metricCardHover: {
        transform: 'translateY(-2px)',
        borderColor: colors.primary,
    },
    metricLabel: {
        fontSize: '0.75rem',
        color: colors.textMuted,
        margin: '0 0 4px',
    },
    metricValue: {
        fontSize: '1.25rem',
        fontWeight: 600,
        color: colors.text,
        margin: 0,
        fontFamily: '"JetBrains Mono", monospace',
    },
    aiButton: {
        width: '100%',
        padding: '12px',
        background: colors.primary,
        color: colors.bg,
        border: 'none',
        borderRadius: '6px',
        fontSize: '0.875rem',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'background 0.2s ease, transform 0.1s ease',
    },
    aiButtonHover: {
        background: colors.primaryHover,
        transform: 'scale(1.02)',
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
        margin: '0 0 16px',
        lineHeight: 1.6,
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
        background: colors.bgAlt,
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        padding: '12px 16px',
        marginBottom: '8px',
    },
    actionLabel: {
        fontSize: '0.6875rem',
        fontWeight: 600,
        color: colors.textMuted,
        margin: '0 0 6px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
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

export default function CampaignDetailPanel({ campaign, dateRange, onClose, formatMoney, accountId }: Props) {
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

    // Create proposal state
    const [isCreatingProposal, setIsCreatingProposal] = useState(false);
    const [proposalSuccess, setProposalSuccess] = useState<string | null>(null);

    // Auto-prompt modal state
    const [showProposalPrompt, setShowProposalPrompt] = useState(false);

    // Auto-trigger AI analysis when campaign is selected
    useEffect(() => {
        // CRITICAL: Reset ALL campaign-specific state when campaign changes
        // This prevents stale data from previous campaign being used in proposals
        console.log(`[CAMPAIGN_DETAIL] 🔄 Campaign changed to: ${campaign.id} (${campaign.name})`);
        console.log('[CAMPAIGN_DETAIL] 🧹 Resetting all campaign-specific state...');

        // Reset AI analysis state
        setAiAnalysis(null);
        setAiError(null);
        setIsLoadingAI(false);

        // Reset trend data  
        setDailyTrend([]);

        // Reset ads data
        setAds([]);
        setAdsError(null);

        // Reset proposal state
        setProposalSuccess(null);
        setIsCreatingProposal(false);
        setShowProposalPrompt(false);

        // Reset tab to overview
        setActiveTab('overview');

        console.log('[CAMPAIGN_DETAIL] ✅ State reset complete. Starting fresh AI analysis...');

        // Now trigger fresh AI analysis for the new campaign
        handleAnalyzeAI();
    }, [campaign.id]); // Trigger when campaign changes

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

            // Get the FRESH AI analysis from the response
            const freshAiAnalysis = json.data.aiAnalysis;

            setAiAnalysis(freshAiAnalysis);
            // Save daily trend for chart
            if (json.data.dailyTrend) {
                setDailyTrend(json.data.dailyTrend);
            }

            // Mark campaign as analyzed in localStorage
            const analyzedCampaigns = JSON.parse(localStorage.getItem('analyzedCampaigns') || '{}');
            analyzedCampaigns[campaign.id] = true;
            localStorage.setItem('analyzedCampaigns', JSON.stringify(analyzedCampaigns));

            // AUTO-CREATE PROPOSAL - PASS FRESH DATA DIRECTLY!
            // DO NOT use state (aiAnalysis) here because React state updates are async
            // and the closure would capture the OLD value
            console.log('[AI_ANALYSIS] ✅ Complete! Auto-creating proposal with FRESH data...');
            console.log('[AI_ANALYSIS] 📋 Fresh recommendation:', freshAiAnalysis?.recommendation);
            handleCreateProposal(freshAiAnalysis);
        } catch (error) {
            setAiError(error instanceof Error ? error.message : 'Có lỗi xảy ra');
        } finally {
            setIsLoadingAI(false);
        }
    };

    // Create AI Proposal
    // CRITICAL: Accept fresh AI analysis as parameter to avoid stale closure issue!
    const handleCreateProposal = async (freshAiAnalysis?: AIAnalysis | null) => {
        // Use the FRESH data passed as parameter, fallback to state only if not provided
        const analysisToUse = freshAiAnalysis ?? aiAnalysis;

        console.log('[HANDLE_CREATE_PROPOSAL] 🚀 Starting proposal creation...');
        console.log('[HANDLE_CREATE_PROPOSAL] 📋 Campaign:', campaign.id, campaign.name);
        console.log('[HANDLE_CREATE_PROPOSAL] 📅 Date range:', dateRange);
        console.log('[HANDLE_CREATE_PROPOSAL] 🏦 Account:', accountId);
        console.log('[HANDLE_CREATE_PROPOSAL] 🤖 Using AI analysis:', analysisToUse?.verdict?.action || 'NO DATA');

        setIsCreatingProposal(true);
        setProposalSuccess(null);

        try {
            console.log('[HANDLE_CREATE_PROPOSAL] 📤 Calling API /api/de-xuat/tao-moi...');

            const requestBody = {
                campaignId: campaign.id,
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
                accountId: accountId,
                // Send cached campaign data to avoid re-fetching from Facebook
                campaignData: {
                    name: campaign.name,
                    metrics_HienTai: {
                        cpp: campaign.totals.cpp,
                        roas: campaign.totals.roas,
                        chiTieu: campaign.totals.spend,
                        donHang: campaign.totals.purchases,
                        ctr: campaign.totals.ctr,
                        doanhThu: campaign.totals.revenue,
                    },
                    dailyMetrics: campaign.dailyMetrics || [],
                },
                // CRITICAL: Send the FRESH AI analysis passed as parameter!
                // This ensures the proposal matches what the user sees on screen
                aiAnalysis: analysisToUse,
            };

            console.log('[HANDLE_CREATE_PROPOSAL] 📦 Request body:', JSON.stringify(requestBody, null, 2));

            const res = await fetch('/api/de-xuat/tao-moi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            console.log('[HANDLE_CREATE_PROPOSAL] 📥 Response status:', res.status, res.statusText);

            const json = await res.json();
            console.log('[HANDLE_CREATE_PROPOSAL] 📥 Response data:', JSON.stringify(json, null, 2));

            if (!json.success) {
                console.error('[HANDLE_CREATE_PROPOSAL] ❌ API returned error:', json.error);
                throw new Error(json.error || 'Failed to create proposal');
            }

            // Proposal created successfully
            const proposal = json.data;
            console.log('[PROPOSAL_CREATED] ✅ Success!', proposal);

            // Show detailed success message
            const priorityLabel = proposal.uuTien === 'NGUY_CAP' ? '🔴 NGUY CẤP'
                : proposal.uuTien === 'CAO' ? '🟡 CAO'
                    : proposal.uuTien === 'TRUNG_BINH' ? '🟢 TRUNG BÌNH' : '⚪ THẤP';

            setProposalSuccess(
                `✅ Đã tạo đề xuất! ${priorityLabel} | ${proposal.hanhDong.loai} | Vào tab ĐỀ XUẤT để duyệt`
            );

            // Close prompt modal
            setShowProposalPrompt(false);

            // Auto-hide after 8s
            setTimeout(() => setProposalSuccess(null), 8000);
        } catch (error) {
            console.error('[HANDLE_CREATE_PROPOSAL] ❌ Error:', error);
            console.error('[HANDLE_CREATE_PROPOSAL] ❌ Error details:', error instanceof Error ? error.message : error);
            console.error('[HANDLE_CREATE_PROPOSAL] ❌ Error stack:', error instanceof Error ? error.stack : 'N/A');
            alert(`❌ Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            console.log('[HANDLE_CREATE_PROPOSAL] 🏁 Finished (success or error)');
            setIsCreatingProposal(false);
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
                            <p style={{
                                fontSize: '0.8125rem', color: colors.textMuted, margin: 0,
                                fontFamily: '"JetBrains Mono", monospace',
                                display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
                            }}>
                                <span>{dateRange.startDate} → {dateRange.endDate}</span>
                                {campaign.actionRecommendation?.lifeStage && (
                                    <>
                                        <span style={{ color: colors.textSubtle }}>·</span>
                                        <span style={{
                                            fontSize: '0.625rem', fontWeight: 600,
                                            padding: '1px 6px', borderRadius: '3px',
                                            background: `${colors.primary}20`, color: colors.primary,
                                        }}>{campaign.actionRecommendation.lifeStage}</span>
                                    </>
                                )}
                                {campaign.created_time && (() => {
                                    const ageDays = Math.floor((Date.now() - new Date(campaign.created_time).getTime()) / 86400000);
                                    return (
                                        <>
                                            <span style={{ color: colors.textSubtle }}>·</span>
                                            <span>{ageDays}D</span>
                                        </>
                                    );
                                })()}
                                {campaign.actionRecommendation && (
                                    <>
                                        <span style={{ color: colors.textSubtle }}>·</span>
                                        <span style={{
                                            fontSize: '0.625rem', fontWeight: 700,
                                            padding: '1px 6px', borderRadius: '3px',
                                            background: campaign.actionRecommendation.color + '20',
                                            color: campaign.actionRecommendation.color,
                                        }}>{campaign.actionRecommendation.action}</span>
                                    </>
                                )}
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* Create Proposal Button */}
                            <button
                                onClick={() => handleCreateProposal()}
                                disabled={isCreatingProposal}
                                style={{
                                    padding: '10px 20px',
                                    background: isCreatingProposal ? colors.bgAlt : colors.primary,
                                    color: colors.bg,
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: isCreatingProposal ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                    opacity: isCreatingProposal ? 0.6 : 1,
                                    whiteSpace: 'nowrap' as const,
                                }}
                                onMouseEnter={(e) => {
                                    if (!isCreatingProposal) {
                                        e.currentTarget.style.background = colors.primaryHover;
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isCreatingProposal) {
                                        e.currentTarget.style.background = colors.primary;
                                    }
                                }}
                            >
                                {isCreatingProposal ? '⏳ Đang tạo...' : '🤖 Tạo đề xuất AI'}
                            </button>
                            <button style={styles.closeBtn} onClick={onClose}>×</button>
                        </div>
                    </div>

                    {/* Success Message */}
                    {proposalSuccess && (
                        <div style={{
                            marginTop: '12px',
                            padding: '12px 16px',
                            background: 'rgba(14, 203, 129, 0.1)',
                            border: `1px solid ${colors.success}`,
                            borderRadius: '6px',
                            color: colors.success,
                            fontSize: '0.875rem',
                            fontWeight: 600,
                        }}>
                            {proposalSuccess}
                        </div>
                    )}

                    {/* Tabs */}
                    <div style={styles.tabs}>
                        <button
                            style={{
                                ...styles.tab,
                                ...(activeTab === 'overview' ? styles.tabActive : {})
                            }}
                            onClick={() => setActiveTab('overview')}
                        >
                            Tổng quan
                        </button>
                        <button
                            style={{
                                ...styles.tab,
                                ...(activeTab === 'ads' ? styles.tabActive : {})
                            }}
                            onClick={() => setActiveTab('ads')}
                        >
                            Ads ({ads.length || '...'})
                        </button>
                    </div>
                </div>

                <div style={styles.content}>
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <>
                            {/* ═══ TICKER BAR ═══ */}
                            <div style={{
                                display: 'flex', flexWrap: 'wrap', gap: '0',
                                borderBottom: `1px solid ${colors.border}`,
                                marginBottom: '20px',
                            }}>
                                {[
                                    { label: 'SPEND', value: formatMoney(campaign.totals.spend) },
                                    { label: 'ĐƠN', value: String(campaign.totals.purchases) },
                                    { label: 'CPP', value: formatMoney(campaign.totals.cpp) },
                                    { label: 'ROAS', value: `${campaign.totals.roas.toFixed(2)}x` },
                                    { label: 'CTR', value: `${campaign.totals.ctr.toFixed(2)}%` },
                                    { label: 'DOANH THU', value: formatMoney(campaign.totals.revenue) },
                                ].map((item, idx) => (
                                    <div key={idx} style={{
                                        flex: '1 1 auto',
                                        minWidth: '90px',
                                        padding: '12px 16px',
                                        borderRight: idx < 5 ? `1px solid ${colors.border}` : 'none',
                                    }}>
                                        <p style={{
                                            fontSize: '0.5625rem', fontWeight: 600, color: colors.textSubtle,
                                            margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em',
                                        }}>{item.label}</p>
                                        <p style={{
                                            fontSize: '1rem', fontWeight: 700, color: colors.text,
                                            margin: 0, fontFamily: '"JetBrains Mono", monospace',
                                        }}>{item.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* ═══ BANDS ANALYSIS ═══ */}
                            {(() => {
                                const rec = campaign.actionRecommendation;
                                const bands = rec?.debugData?.processing?.bands;
                                const tags = rec?.metricTags || [];
                                const healthScore = rec?.healthScore;
                                const lifeStage = rec?.lifeStage || rec?.debugData?.processing?.lifeStage;

                                if (!bands && tags.length === 0) return null;

                                return (
                                    <div style={{
                                        background: colors.bgAlt,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: '8px',
                                        padding: '16px',
                                        marginBottom: '20px',
                                    }}>
                                        {/* Header */}
                                        <div style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            marginBottom: '16px', paddingBottom: '10px',
                                            borderBottom: `1px solid ${colors.border}`,
                                        }}>
                                            <span style={{
                                                fontSize: '0.6875rem', fontWeight: 700, color: colors.textMuted,
                                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                            }}>METRIC BANDS</span>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                {lifeStage && (
                                                    <span style={{
                                                        fontSize: '0.625rem', fontWeight: 600,
                                                        padding: '2px 8px', borderRadius: '3px',
                                                        background: `${colors.primary}20`, color: colors.primary,
                                                        fontFamily: '"JetBrains Mono", monospace',
                                                    }}>{lifeStage}</span>
                                                )}
                                                {healthScore !== undefined && (
                                                    <span style={{
                                                        fontSize: '0.75rem', fontWeight: 700,
                                                        fontFamily: '"JetBrains Mono", monospace',
                                                        color: healthScore >= 75 ? colors.success
                                                            : healthScore >= 50 ? colors.warning
                                                                : colors.error,
                                                    }}>HP {healthScore}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Metric Rows */}
                                        {(['CTR', 'CPP', 'ROAS'] as const).map(metric => {
                                            const band = bands?.[metric.toLowerCase()];
                                            const tag = tags.find(t => t.metric === metric);
                                            if (!band && !tag) return null;

                                            const windowAvg = band?.windowAvg;
                                            const ma = band?.ma;
                                            const zScore = band?.zScore ?? tag?.zScore;
                                            const isInverse = metric === 'CPP';

                                            // Format values
                                            const fmtWindow = metric === 'CTR' ? `${windowAvg?.toFixed(2)}%`
                                                : metric === 'ROAS' ? `${windowAvg?.toFixed(2)}x`
                                                    : formatMoney(windowAvg || 0);
                                            const fmtMA = metric === 'CTR' ? `${ma?.toFixed(2)}%`
                                                : metric === 'ROAS' ? `${ma?.toFixed(2)}x`
                                                    : formatMoney(ma || 0);

                                            // Deviation ratio for progress bar
                                            let ratio = ma && windowAvg ? windowAvg / ma : 1;
                                            if (isInverse) ratio = ma && windowAvg ? ma / windowAvg : 1;
                                            const barPercent = Math.min(Math.max(ratio * 100, 5), 200);
                                            const isGood = isInverse ? (windowAvg || 0) < (ma || 0) : (windowAvg || 0) > (ma || 0);

                                            // Severity color
                                            const sevColor = tag?.severity === 'critical' ? colors.error
                                                : tag?.severity === 'warning' ? colors.warning
                                                    : tag ? '#3B82F6' : colors.textMuted;

                                            return (
                                                <div key={metric} style={{
                                                    padding: '10px 0',
                                                    borderBottom: metric !== 'ROAS' ? `1px solid ${colors.border}30` : 'none',
                                                }}>
                                                    {/* Top row: metric name, value, tag, z-score, MA */}
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        marginBottom: '6px',
                                                    }}>
                                                        <span style={{
                                                            fontSize: '0.75rem', fontWeight: 700, color: colors.text,
                                                            fontFamily: '"JetBrains Mono", monospace',
                                                            width: '40px',
                                                        }}>{metric}</span>
                                                        <span style={{
                                                            fontSize: '0.9375rem', fontWeight: 700,
                                                            color: colors.text,
                                                            fontFamily: '"JetBrains Mono", monospace',
                                                            minWidth: '80px',
                                                        }}>{fmtWindow}</span>
                                                        {tag && (
                                                            <span style={{
                                                                fontSize: '0.6875rem', fontWeight: 700,
                                                                padding: '2px 6px', borderRadius: '3px',
                                                                background: `${sevColor}20`, color: sevColor,
                                                            }}>{tag.label}</span>
                                                        )}
                                                        {zScore !== undefined && (
                                                            <span style={{
                                                                fontSize: '0.6875rem', fontWeight: 600,
                                                                color: sevColor,
                                                                fontFamily: '"JetBrains Mono", monospace',
                                                            }}>{zScore > 0 ? '+' : ''}{zScore.toFixed(1)}σ</span>
                                                        )}
                                                        <span style={{
                                                            fontSize: '0.6875rem', color: colors.textSubtle,
                                                            marginLeft: 'auto',
                                                            fontFamily: '"JetBrains Mono", monospace',
                                                        }}>MA: {fmtMA}</span>
                                                    </div>
                                                    {/* Deviation bar */}
                                                    <div style={{
                                                        height: '4px', borderRadius: '2px',
                                                        background: colors.border,
                                                        position: 'relative',
                                                        overflow: 'hidden',
                                                    }}>
                                                        <div style={{
                                                            height: '100%', borderRadius: '2px',
                                                            width: `${Math.min(barPercent, 100)}%`,
                                                            background: isGood ? colors.success
                                                                : tag?.severity === 'critical' ? colors.error
                                                                    : tag?.severity === 'warning' ? colors.warning
                                                                        : '#3B82F6',
                                                            transition: 'width 0.5s ease',
                                                        }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}

                            {/* ═══ ISSUES (compact) ═══ */}
                            {campaign.issues.length > 0 && (
                                <div style={{ marginBottom: '20px' }}>
                                    {campaign.issues.map((issue, idx) => (
                                        <div key={idx} style={{
                                            display: 'flex', alignItems: 'flex-start', gap: '8px',
                                            padding: '8px 12px', marginBottom: '4px',
                                            background: colors.bgAlt,
                                            borderLeft: `3px solid ${issue.severity === 'critical' ? colors.error : colors.warning}`,
                                            borderRadius: '0 4px 4px 0',
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                <span style={{
                                                    fontSize: '0.8125rem', fontWeight: 600,
                                                    color: issue.severity === 'critical' ? colors.error : colors.warning,
                                                }}>{issue.message}</span>
                                                <span style={{
                                                    fontSize: '0.75rem', color: colors.textMuted, marginLeft: '8px',
                                                }}>{issue.detail}</span>
                                            </div>
                                            <span style={{
                                                fontSize: '0.6875rem', color: colors.success,
                                                fontWeight: 500, whiteSpace: 'nowrap',
                                            }}>→ {issue.action}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ═══ BANDS CHARTS ═══ */}
                            {dailyTrend.length > 0 && (() => {
                                const bands = campaign.actionRecommendation?.debugData?.processing?.bands;
                                const windowDays = campaign.actionRecommendation?.debugData?.processing?.historySplit?.windowDays || 7;
                                return (
                                    <div style={{
                                        background: colors.bgAlt,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: '8px',
                                        padding: '16px',
                                        marginBottom: '20px',
                                    }}>
                                        <BandsChart
                                            data={dailyTrend}
                                            metricKey="cpp"
                                            label="CPP (Chi phí/đơn)"
                                            formatValue={(v) => formatMoney(v)}
                                            ma={bands?.cpp?.ma}
                                            sigma={bands?.cpp?.sigma}
                                            windowDays={windowDays}
                                        />
                                        <BandsChart
                                            data={dailyTrend}
                                            metricKey="ctr"
                                            label="CTR (Click rate)"
                                            formatValue={(v) => v.toFixed(2) + '%'}
                                            ma={bands?.ctr?.ma}
                                            sigma={bands?.ctr?.sigma}
                                            windowDays={windowDays}
                                        />
                                    </div>
                                );
                            })()}

                            {/* ═══ AI ANALYSIS ═══ */}
                            <div style={styles.section}>
                                <h3 style={styles.sectionTitle}>Phân tích AI</h3>

                                {!aiAnalysis && !isLoadingAI && !aiError && (
                                    <button
                                        style={styles.aiButton}
                                        onClick={handleAnalyzeAI}
                                    >
                                        Phân tích sâu với AI
                                    </button>
                                )}

                                {isLoadingAI && (
                                    <div style={styles.loader}>
                                        <p>Đang phân tích...</p>
                                        <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>
                                            AI đang xem xét dữ liệu và đưa ra khuyến nghị
                                        </p>
                                    </div>
                                )}

                                {aiError && (
                                    <div style={{ textAlign: 'center', padding: '20px', color: '#dc2626' }}>
                                        <p>{aiError}</p>
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
                                        {/* Verdict Header */}
                                        {aiAnalysis.verdict && (
                                            <div style={{
                                                padding: '14px 16px',
                                                borderRadius: '6px',
                                                marginBottom: '16px',
                                                background: colors.bgAlt,
                                                border: `1px solid ${aiAnalysis.verdict.action === 'SCALE' ? colors.success :
                                                    aiAnalysis.verdict.action === 'MAINTAIN' ? '#3b82f6' :
                                                        aiAnalysis.verdict.action === 'WATCH' ? colors.warning :
                                                            aiAnalysis.verdict.action === 'REDUCE' ? '#ea580c' : colors.error}`,
                                                borderLeftWidth: '4px',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{
                                                        fontSize: '0.6875rem',
                                                        fontWeight: 600,
                                                        padding: '3px 8px',
                                                        borderRadius: '4px',
                                                        background: aiAnalysis.verdict.action === 'SCALE' ? colors.success :
                                                            aiAnalysis.verdict.action === 'MAINTAIN' ? '#3b82f6' :
                                                                aiAnalysis.verdict.action === 'WATCH' ? colors.warning :
                                                                    aiAnalysis.verdict.action === 'REDUCE' ? '#ea580c' : colors.error,
                                                        color: aiAnalysis.verdict.action === 'WATCH' ? colors.bg : '#fff',
                                                    }}>
                                                        {aiAnalysis.verdict.action}
                                                    </span>
                                                    <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: colors.text }}>
                                                        {aiAnalysis.verdict.headline}
                                                    </span>
                                                </div>
                                                {aiAnalysis.verdict.condition && (
                                                    <p style={{ fontSize: '0.8125rem', color: colors.textMuted, marginTop: '8px', marginBottom: 0 }}>
                                                        {aiAnalysis.verdict.condition}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Proposal Status */}
                                        {(isCreatingProposal || proposalSuccess) && (
                                            <div style={{
                                                padding: '20px',
                                                background: proposalSuccess ? colors.success + '15' : colors.bgAlt,
                                                border: `1px solid ${proposalSuccess ? colors.success + '40' : colors.border}`,
                                                borderRadius: '8px',
                                                marginBottom: '16px',
                                                textAlign: 'center' as const,
                                            }}>
                                                {isCreatingProposal && !proposalSuccess && (
                                                    <>
                                                        <p style={{
                                                            color: colors.text, fontSize: '0.875rem',
                                                            fontWeight: 600, margin: '0 0 12px',
                                                        }}>
                                                            Phân tích hoàn tất! Đang tự động tạo đề xuất...
                                                        </p>
                                                        <div style={{
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            gap: '12px', padding: '16px',
                                                            background: colors.primary + '10', borderRadius: '6px',
                                                            border: `1px solid ${colors.primary}30`,
                                                        }}>
                                                            <div style={{
                                                                width: '20px', height: '20px',
                                                                border: `3px solid ${colors.primary}30`,
                                                                borderTop: `3px solid ${colors.primary}`,
                                                                borderRadius: '50%',
                                                                animation: 'spin 1s linear infinite',
                                                            }} />
                                                            <span style={{ color: colors.primary, fontWeight: 600 }}>
                                                                Đang tạo đề xuất hành động...
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                                {proposalSuccess && (
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        gap: '12px', padding: '16px',
                                                    }}>
                                                        <span style={{ fontSize: '1.5rem' }}>✅</span>
                                                        <span style={{
                                                            color: colors.success, fontWeight: 600, fontSize: '0.9375rem',
                                                        }}>
                                                            {proposalSuccess}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <style jsx>{`
                                            @keyframes spin {
                                                0% { transform: rotate(0deg); }
                                                100% { transform: rotate(360deg); }
                                            }
                                        `}</style>

                                        {/* Data Basis */}
                                        {aiAnalysis.dataBasis && (
                                            <div style={{
                                                display: 'flex', gap: '12px', marginBottom: '16px',
                                                fontSize: '0.75rem', color: colors.textMuted,
                                                fontFamily: '"JetBrains Mono", monospace',
                                            }}>
                                                <span>{aiAnalysis.dataBasis.days}D</span>
                                                <span style={{ color: colors.textSubtle }}>|</span>
                                                <span>{aiAnalysis.dataBasis.orders} đơn</span>
                                                <span style={{ color: colors.textSubtle }}>|</span>
                                                <span>{formatMoney(aiAnalysis.dataBasis.spend)}</span>
                                            </div>
                                        )}

                                        {/* Fallback: Legacy summary if no verdict */}
                                        {!aiAnalysis.verdict && aiAnalysis.summary && (
                                            <p style={styles.aiSummary}>{aiAnalysis.summary}</p>
                                        )}

                                        {/* Reasoning */}
                                        {aiAnalysis.reasoning && (
                                            <div style={{ ...styles.aiBlock, borderTop: `1px solid ${colors.border}`, paddingTop: '16px', marginTop: '16px' }}>
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
                                    <p>Đang tải danh sách ads...</p>
                                </div>
                            )}

                            {adsError && (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#dc2626' }}>
                                    <p>{adsError}</p>
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
                                            <div style={styles.adThumbnail}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.textMuted }}>AD</span>
                                            </div>
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
                                                    Spend: <strong>{formatMoney(ad.totals.spend)}</strong>
                                                </span>
                                                <span style={styles.adMetric}>
                                                    Orders: <strong>{ad.totals.purchases}</strong>
                                                </span>
                                                <span style={styles.adMetric}>
                                                    CPP: <strong>{formatMoney(ad.totals.cpp)}</strong>
                                                </span>
                                                <span style={styles.adMetric}>
                                                    CTR: <strong>{ad.totals.ctr.toFixed(2)}%</strong>
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

            {/* Auto-Prompt Modal */}
            {showProposalPrompt && (
                <div style={{
                    position: 'fixed' as const,
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                }} onClick={() => setShowProposalPrompt(false)}>
                    <div style={{
                        background: colors.bgCard,
                        borderRadius: '12px',
                        padding: '32px',
                        maxWidth: '480px',
                        width: '90%',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                        border: `1px solid ${colors.border}`,
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ textAlign: 'center' as const }}>

                            <h3 style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: colors.text,
                                margin: '0 0 12px',
                            }}>
                                Phân tích hoàn tất!
                            </h3>
                            <p style={{
                                fontSize: '0.9375rem',
                                color: colors.textMuted,
                                margin: '0 0 24px',
                                lineHeight: 1.6,
                            }}>
                                AI đã phát hiện <strong>{aiAnalysis?.verdict ? 1 : 0}</strong> khuyến nghị quan trọng.
                                <br />
                                Bạn muốn tạo đề xuất tự động không?
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                <button
                                    onClick={() => {
                                        setShowProposalPrompt(false);
                                        handleCreateProposal();
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '14px 24px',
                                        background: colors.primary,
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '0.9375rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    TẠO NGAY
                                </button>
                                <button
                                    onClick={() => setShowProposalPrompt(false)}
                                    style={{
                                        flex: 1,
                                        padding: '14px 24px',
                                        background: colors.bgAlt,
                                        color: colors.text,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: '8px',
                                        fontSize: '0.9375rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    Xem chi tiết
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
