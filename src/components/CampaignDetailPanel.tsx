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
    message?: string | null;
    link?: string | null;
    postUrl?: string | null;
    totals: {
        spend: number;
        purchases: number;
        revenue: number;
        cpp: number;
        ctr: number;
    };
    dailyMetrics?: Array<{
        date: string;
        spend: number;
        clicks: number;
        purchases: number;
        cpp: number;
        ctr: number;
    }>;
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

// SVG Line Chart — Stock Terminal Style with Bollinger Bands
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
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    if (!data || data.length === 0) return null;

    const values = data.map(d => typeof d[metricKey] === 'number' ? d[metricKey] as number : 0);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values.filter(v => v > 0));

    // Include bands in range
    const upperBand = ma && sigma ? ma + 2 * sigma : maxValue;
    const lowerBand = ma && sigma ? Math.max(0, ma - 2 * sigma) : minValue;
    const chartMax = Math.max(maxValue, upperBand) * 1.08;
    const chartMin = Math.max(0, Math.min(minValue, lowerBand) * 0.92);
    const chartRange = chartMax - chartMin || 1;

    // SVG dimensions
    const W = 600;
    const H = 140;
    const PAD_L = 52; // left padding for Y axis
    const PAD_R = 8;
    const PAD_T = 12;
    const PAD_B = 22;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;

    // Convert value to SVG Y (top = high value)
    const toY = (v: number) => PAD_T + plotH - ((v - chartMin) / chartRange) * plotH;
    const toX = (i: number) => PAD_L + (i / Math.max(data.length - 1, 1)) * plotW;

    const historyCount = Math.max(0, data.length - windowDays);

    // Build price line path
    const linePts = values.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`);
    const linePath = `M ${linePts.join(' L ')}`;

    // Build area fill (under line)
    const areaPath = `M ${toX(0).toFixed(1)},${toY(0) > H - PAD_B ? (H - PAD_B).toFixed(1) : toY(values[0]).toFixed(1)} L ${linePts.join(' L ')} L ${toX(data.length - 1).toFixed(1)},${(H - PAD_B).toFixed(1)} Z`;

    // Band area polygon (shaded ±2σ zone)
    let bandAreaPath = '';
    if (ma && sigma) {
        const upper = Math.min(toY(ma + 2 * sigma), H - PAD_B);
        const lower = Math.max(toY(Math.max(0, ma - 2 * sigma)), PAD_T);
        bandAreaPath = `M ${PAD_L},${upper} L ${W - PAD_R},${upper} L ${W - PAD_R},${lower} L ${PAD_L},${lower} Z`;
    }

    // Y-axis ticks (4 ticks)
    const yTicks = [0, 0.33, 0.66, 1].map(pct => chartMin + pct * chartRange);

    // Window region
    const windowStartX = historyCount > 0 ? toX(historyCount) : PAD_L;

    // Current (last) value
    const lastVal = values[values.length - 1];
    const lastX = toX(data.length - 1);
    const lastY = toY(lastVal);

    // Hover helpers
    const hoverVal = hoveredIdx !== null ? values[hoveredIdx] : null;
    const hoverDate = hoveredIdx !== null ? data[hoveredIdx]?.date : null;
    const hoverX = hoveredIdx !== null ? toX(hoveredIdx) : 0;
    const hoverY = hoveredIdx !== null && hoverVal !== null ? toY(hoverVal) : 0;
    // Tooltip position: flip to left if near right edge
    const tooltipRight = hoveredIdx !== null && hoveredIdx > data.length * 0.75;

    return (
        <div style={{ marginBottom: '16px' }}>
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '6px',
            }}>
                <span style={{
                    fontSize: '0.6875rem', fontWeight: 600, color: colors.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{label} — {data.length}D</span>
                <span style={{
                    fontSize: '0.75rem', fontWeight: 700,
                    color: lastVal > (ma || 0) ? (metricKey === 'cpp' ? colors.error : colors.success) : (metricKey === 'cpp' ? colors.success : colors.error),
                    fontFamily: '"JetBrains Mono", monospace',
                }}>{formatValue(lastVal)}</span>
            </div>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                style={{ width: '100%', height: 'auto', display: 'block' }}
                preserveAspectRatio="none"
                onMouseLeave={() => setHoveredIdx(null)}
            >
                {/* Grid lines */}
                {yTicks.map((tick, i) => (
                    <g key={i}>
                        <line
                            x1={PAD_L} y1={toY(tick)} x2={W - PAD_R} y2={toY(tick)}
                            stroke={`${colors.border}40`} strokeWidth="0.5"
                        />
                        <text
                            x={PAD_L - 4} y={toY(tick) + 3}
                            textAnchor="end"
                            fill={colors.textSubtle}
                            fontSize="8"
                            fontFamily='"JetBrains Mono", monospace'
                        >{formatValue(tick)}</text>
                    </g>
                ))}

                {/* Window background highlight */}
                <rect
                    x={windowStartX} y={PAD_T}
                    width={W - PAD_R - windowStartX} height={plotH}
                    fill={`${colors.primary}08`}
                />
                {/* Window separator line */}
                {historyCount > 0 && (
                    <line
                        x1={windowStartX} y1={PAD_T} x2={windowStartX} y2={H - PAD_B}
                        stroke={`${colors.primary}30`} strokeWidth="1" strokeDasharray="4,3"
                    />
                )}

                {/* ±2σ Band area */}
                {bandAreaPath && (
                    <path d={bandAreaPath} fill={`${colors.primary}10`} />
                )}

                {/* Upper band line (+2σ) */}
                {ma && sigma && (
                    <line
                        x1={PAD_L} y1={toY(ma + 2 * sigma)}
                        x2={W - PAD_R} y2={toY(ma + 2 * sigma)}
                        stroke={`${colors.error}50`} strokeWidth="0.8" strokeDasharray="4,3"
                    />
                )}

                {/* Lower band line (-2σ) */}
                {ma && sigma && (
                    <line
                        x1={PAD_L} y1={toY(Math.max(0, ma - 2 * sigma))}
                        x2={W - PAD_R} y2={toY(Math.max(0, ma - 2 * sigma))}
                        stroke={`${colors.success}50`} strokeWidth="0.8" strokeDasharray="4,3"
                    />
                )}

                {/* MA line */}
                {ma && (
                    <line
                        x1={PAD_L} y1={toY(ma)} x2={W - PAD_R} y2={toY(ma)}
                        stroke={colors.primary} strokeWidth="1.2" strokeDasharray="6,3"
                    />
                )}

                {/* Area fill gradient */}
                <defs>
                    <linearGradient id={`area-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={colors.primary} stopOpacity="0.15" />
                        <stop offset="100%" stopColor={colors.primary} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                <path d={areaPath} fill={`url(#area-${metricKey})`} />

                {/* Price line */}
                <path
                    d={linePath}
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />

                {/* Data dots for window days */}
                {values.map((v, i) => {
                    if (i < historyCount) return null;
                    const isOutBand = ma && sigma && (v > ma + 2 * sigma || v < ma - 2 * sigma);
                    return (
                        <circle
                            key={i}
                            cx={toX(i)} cy={toY(v)} r="2.5"
                            fill={isOutBand ? colors.error : colors.primary}
                            stroke={colors.bg} strokeWidth="1"
                        />
                    );
                })}

                {/* Current value label */}
                <circle cx={lastX} cy={lastY} r="4" fill={colors.primary} stroke={colors.bg} strokeWidth="1.5" />

                {/* MA label */}
                {ma && (
                    <text
                        x={W - PAD_R - 2} y={toY(ma) - 4}
                        textAnchor="end" fill={colors.primary} fontSize="7.5"
                        fontFamily='"JetBrains Mono", monospace' fontWeight="600"
                    >MA {formatValue(ma)}</text>
                )}

                {/* Band labels */}
                {ma && sigma && (
                    <>
                        <text
                            x={W - PAD_R - 2} y={toY(ma + 2 * sigma) - 3}
                            textAnchor="end" fill={`${colors.error}90`} fontSize="7"
                            fontFamily='"JetBrains Mono", monospace'
                        >+2σ</text>
                        <text
                            x={W - PAD_R - 2} y={toY(Math.max(0, ma - 2 * sigma)) + 10}
                            textAnchor="end" fill={`${colors.success}90`} fontSize="7"
                            fontFamily='"JetBrains Mono", monospace'
                        >-2σ</text>
                    </>
                )}

                {/* X-axis labels (first, middle, last) */}
                {[0, Math.floor(data.length / 2), data.length - 1].map((idx, i) => (
                    <text
                        key={i}
                        x={toX(idx)} y={H - 4}
                        textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
                        fill={colors.textSubtle} fontSize="7.5"
                        fontFamily='"JetBrains Mono", monospace'
                    >{(data[idx]?.date || '').slice(5)}</text>
                ))}

                {/* === HOVER INTERACTION === */}
                {/* Invisible hit zones for each data point */}
                {values.map((_v, i) => {
                    const slotW = plotW / Math.max(data.length - 1, 1);
                    return (
                        <rect
                            key={`hit-${i}`}
                            x={toX(i) - slotW / 2}
                            y={PAD_T}
                            width={slotW}
                            height={plotH}
                            fill="transparent"
                            onMouseEnter={() => setHoveredIdx(i)}
                            style={{ cursor: 'crosshair' }}
                        />
                    );
                })}

                {/* Hover crosshair + tooltip */}
                {hoveredIdx !== null && hoverVal !== null && (
                    <g>
                        {/* Vertical crosshair */}
                        <line
                            x1={hoverX} y1={PAD_T} x2={hoverX} y2={H - PAD_B}
                            stroke={`${colors.text}40`} strokeWidth="0.8" strokeDasharray="3,2"
                        />
                        {/* Horizontal crosshair */}
                        <line
                            x1={PAD_L} y1={hoverY} x2={W - PAD_R} y2={hoverY}
                            stroke={`${colors.text}25`} strokeWidth="0.5" strokeDasharray="3,2"
                        />
                        {/* Highlight dot */}
                        <circle
                            cx={hoverX} cy={hoverY} r="4.5"
                            fill={colors.primary} stroke={colors.text} strokeWidth="1.5"
                        />
                        {/* Tooltip background */}
                        <rect
                            x={tooltipRight ? hoverX - 90 : hoverX + 6}
                            y={Math.max(PAD_T, hoverY - 22)}
                            width={84} height={20} rx={3}
                            fill={colors.bgAlt} stroke={colors.border} strokeWidth="0.8"
                        />
                        {/* Tooltip text - date */}
                        <text
                            x={tooltipRight ? hoverX - 86 : hoverX + 10}
                            y={Math.max(PAD_T, hoverY - 22) + 13}
                            fill={colors.textMuted} fontSize="7.5"
                            fontFamily='"JetBrains Mono", monospace'
                        >{(hoverDate || '').slice(5)}</text>
                        {/* Tooltip text - value */}
                        <text
                            x={tooltipRight ? hoverX - 10 : hoverX + 86}
                            y={Math.max(PAD_T, hoverY - 22) + 13}
                            textAnchor="end"
                            fill={colors.text} fontSize="8" fontWeight="700"
                            fontFamily='"JetBrains Mono", monospace'
                        >{formatValue(hoverVal)}</text>
                    </g>
                )}
            </svg>
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
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    panel: {
        width: '95%',
        maxWidth: '900px',
        maxHeight: '90vh',
        background: colors.bgCard,
        overflowY: 'auto' as const,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
    },
    header: {
        background: colors.bgCard,
        position: 'sticky' as const,
        top: 0,
        zIndex: 10,
        borderBottom: `2px solid ${colors.border}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        borderRadius: '12px 12px 0 0',
    },
    headerRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px 8px',
    },
    title: {
        fontSize: '1.125rem',
        fontWeight: 700,
        color: colors.text,
        margin: '0 0 4px',
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        fontSize: '1.25rem',
        cursor: 'pointer',
        color: colors.textMuted,
        padding: '4px 8px',
        flexShrink: 0,
    },
    tabs: {
        display: 'flex',
        gap: '0',
    },
    tab: {
        padding: '8px 16px',
        border: 'none',
        background: 'transparent',
        fontSize: '0.8125rem',
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
    const [activeTab, setActiveTab] = useState<'overview' | 'ads' | 'conclusion'>('overview');
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

            if (!res.ok) {
                if (res.status === 504 || res.status === 502 || res.status === 503) {
                    throw new Error('Server quá tải, vui lòng thử lại sau ít phút');
                }
                throw new Error(`Lỗi server (${res.status}). Vui lòng thử lại`);
            }

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

    // Content evaluation: Bollinger Bands approach (same as campaign-level)
    // Uses MA + σ from history, compares window avg via z-score
    const getContentBadge = (ad: Ad, totalCampaignSpend: number) => {
        const daily = ad.dailyMetrics || [];
        const totalSpend = ad.totals.spend;
        const spendShare = totalCampaignSpend > 0 ? (totalSpend / totalCampaignSpend) * 100 : 0;

        // --- Not enough data ---
        if (daily.length < 5 || totalSpend < totalCampaignSpend * 0.02 || ad.totals.purchases < 2) {
            return {
                badge: { text: 'Ít data', bg: `${colors.textSubtle}20`, color: colors.textMuted },
                spendShare,
                tip: 'Chưa đủ dữ liệu để đánh giá',
            };
        }

        // --- Split history vs window (last 7 days) ---
        const windowSize = Math.min(7, Math.floor(daily.length / 2));
        const windowDays = daily.slice(-windowSize);
        const historyDays = daily.slice(0, -windowSize);

        if (historyDays.length < 3) {
            return {
                badge: { text: 'Tiềm năng', bg: '#3B82F620', color: '#3B82F6' },
                spendShare,
                tip: `Content mới (${daily.length} ngày). Chưa đủ lịch sử để so sánh.`,
            };
        }

        // --- Calculate bands for CPP ---
        const histCPP = historyDays.map(d => d.purchases > 0 ? d.spend / d.purchases : 0).filter(v => v > 0);
        const winCPP = windowDays.map(d => d.purchases > 0 ? d.spend / d.purchases : 0).filter(v => v > 0);

        let cppZ = 0;
        let cppMA = 0;
        let cppSigma = 0;
        let cppWindowAvg = 0;
        if (histCPP.length >= 3 && winCPP.length > 0) {
            cppMA = histCPP.reduce((s, v) => s + v, 0) / histCPP.length;
            const cppVariance = histCPP.reduce((s, v) => s + Math.pow(v - cppMA, 2), 0) / histCPP.length;
            cppSigma = Math.sqrt(cppVariance);
            cppWindowAvg = winCPP.reduce((s, v) => s + v, 0) / winCPP.length;
            // CPP: z > 0 = xấu (tăng), z < 0 = tốt (giảm)
            cppZ = cppSigma > 0 ? (cppWindowAvg - cppMA) / cppSigma : 0;
        }

        // --- Calculate bands for CTR ---
        const histCTR = historyDays.map(d => d.ctr).filter(v => v > 0);
        const winCTR = windowDays.map(d => d.ctr).filter(v => v > 0);

        let ctrZ = 0;
        let ctrMA = 0;
        let ctrSigma = 0;
        let ctrWindowAvg = 0;
        if (histCTR.length >= 3 && winCTR.length > 0) {
            ctrMA = histCTR.reduce((s, v) => s + v, 0) / histCTR.length;
            const ctrVariance = histCTR.reduce((s, v) => s + Math.pow(v - ctrMA, 2), 0) / histCTR.length;
            ctrSigma = Math.sqrt(ctrVariance);
            ctrWindowAvg = winCTR.reduce((s, v) => s + v, 0) / winCTR.length;
            // CTR: z > 0 = tốt (tăng), z < 0 = xấu (giảm) → invert for severity
            ctrZ = ctrSigma > 0 ? (ctrWindowAvg - ctrMA) / ctrSigma : 0;
        }

        // --- Build tooltip ---
        const fmtZ = (z: number) => `${z > 0 ? '+' : ''}${z.toFixed(1)}σ`;
        const tipParts = [
            `Lịch sử (${historyDays.length}d): CPP MA=${cppMA > 0 ? formatMoney(cppMA) : 'N/A'} · CTR MA=${ctrMA.toFixed(2)}%`,
            `Gần đây (${windowDays.length}d): CPP=${cppWindowAvg > 0 ? formatMoney(cppWindowAvg) : 'N/A'} · CTR=${ctrWindowAvg.toFixed(2)}%`,
            `Z-Score: CPP ${fmtZ(cppZ)} · CTR ${fmtZ(ctrZ)}`,
        ];

        // --- Badge logic based on z-scores ---
        // Check for no recent purchases but still spending
        const recentSpend = windowDays.reduce((s, d) => s + d.spend, 0);
        const recentPurchases = windowDays.reduce((s, d) => s + d.purchases, 0);
        if (recentPurchases === 0 && recentSpend > totalCampaignSpend * 0.03) {
            return {
                badge: { text: 'Kém', bg: '#EF444420', color: '#EF4444' },
                spendShare,
                tip: tipParts.join('\n') + '\n🔴 Gần đây chi tiền nhưng không có đơn',
            };
        }

        // BÃO HOÀ: CPP vượt +1.5σ VÀ CTR dưới -1σ
        if (cppZ >= 1.5 && ctrZ <= -1.0) {
            return {
                badge: { text: 'Bão hoà', bg: '#F9731620', color: '#F97316' },
                spendShare,
                tip: tipParts.join('\n') + `\n⚠️ CPP vượt ${fmtZ(cppZ)} + CTR sụt ${fmtZ(ctrZ)} → Content đang bão hoà`,
            };
        }

        // CPP tăng mạnh bất thường (vượt +2σ)
        if (cppZ >= 2.0) {
            return {
                badge: { text: 'Bão hoà', bg: '#F9731620', color: '#F97316' },
                spendShare,
                tip: tipParts.join('\n') + `\n⚠️ CPP vượt ${fmtZ(cppZ)} → Chi phí leo thang bất thường`,
            };
        }

        // YẾU: CPP tăng >1σ hoặc CTR giảm >1.5σ
        if (cppZ >= 1.0 || ctrZ <= -1.5) {
            return {
                badge: { text: 'Yếu', bg: '#F9731620', color: '#F97316' },
                spendShare,
                tip: tipParts.join('\n') + '\n⚠️ Hiệu suất suy giảm đáng kể so với lịch sử',
            };
        }

        // ĐANG TỐT: CPP ổn định hoặc giảm (z ≤ 0.5), CTR không sụt (z ≥ -0.5)
        if (cppZ <= 0.5 && ctrZ >= -0.5) {
            return {
                badge: { text: 'Đang tốt', bg: '#22C55E20', color: '#22C55E' },
                spendShare,
                tip: tipParts.join('\n') + '\n✅ Hiệu suất ổn định trong vùng cho phép',
            };
        }

        // ỔN: Trung bình
        return {
            badge: { text: 'Ổn', bg: '#3B82F620', color: '#3B82F6' },
            spendShare,
            tip: tipParts.join('\n'),
        };
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.panel} onClick={e => e.stopPropagation()}>
                {/* Header — 2-row sticky */}
                <div style={styles.header}>
                    {/* Row 1: Name + meta + close */}
                    <div style={styles.headerRow}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h2 style={styles.title}>{campaign.name}</h2>
                            <p style={{
                                fontSize: '0.6875rem', color: colors.textMuted, margin: 0,
                                fontFamily: '"JetBrains Mono", monospace',
                            }}>
                                {dateRange.startDate} → {dateRange.endDate}
                            </p>
                            {/* Badge rows: Life Stage + Action */}
                            {campaign.actionRecommendation && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                                    {/* Life Stage row */}
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.5625rem', color: colors.textSubtle, width: '56px', flexShrink: 0 }}>Tuổi đời:</span>
                                        {[
                                            { key: 'LEARNING', label: 'Đang học', tip: '0-7 ngày: Facebook đang tối ưu, data chưa ổn định' },
                                            { key: 'EARLY', label: 'Mới chạy', tip: '8-14 ngày: Bắt đầu có data nhưng chưa đủ tin cậy' },
                                            { key: 'MATURE', label: 'Ổn định', tip: '15-21 ngày: Data đáng tin, bắt đầu đánh giá được' },
                                            { key: 'VETERAN', label: 'Lão luyện', tip: '22+ ngày: Data rất tin cậy, đánh giá nghiêm ngặt nhất' },
                                        ].map(s => {
                                            const isActive = campaign.actionRecommendation!.lifeStage === s.key;
                                            return (
                                                <span key={s.key} title={s.tip} style={{
                                                    fontSize: '0.5625rem', fontWeight: isActive ? 700 : 500,
                                                    padding: '1px 6px', borderRadius: '3px',
                                                    background: isActive ? `${colors.primary}25` : 'transparent',
                                                    color: isActive ? colors.primary : colors.textSubtle,
                                                    border: `1px solid ${isActive ? colors.primary + '50' : colors.border}`,
                                                    opacity: isActive ? 1 : 0.35,
                                                    cursor: 'default',
                                                    transition: 'all 0.2s',
                                                }}>{s.label}</span>
                                            );
                                        })}
                                        {campaign.created_time && (() => {
                                            const ageDays = Math.floor((Date.now() - new Date(campaign.created_time).getTime()) / 86400000);
                                            return <span style={{ fontSize: '0.5625rem', color: colors.textMuted, marginLeft: '2px' }}>({ageDays}D)</span>;
                                        })()}
                                    </div>
                                    {/* Action row */}
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.5625rem', color: colors.textSubtle, width: '56px', flexShrink: 0 }}>Khuyến nghị:</span>
                                        {[
                                            { key: 'STOP', label: 'Dừng', color: '#ef4444', tip: 'Health < 20: Lỗ nặng, khuyến nghị tắt campaign' },
                                            { key: 'WATCH', label: 'Theo dõi', color: '#f97316', tip: 'Health 20-34: Chưa tệ nhưng cần canh chừng' },
                                            { key: 'ADJUST', label: 'Điều chỉnh', color: '#eab308', tip: 'Health 35-59: Metrics tổng OK nhưng gần đây suy giảm, cần can thiệp' },
                                            { key: 'GOOD', label: 'Tốt', color: '#22c55e', tip: 'Health 60-74: Ổn định, giữ nguyên chiến lược' },
                                            { key: 'SCALE', label: 'Tăng NS', color: '#06b6d4', tip: 'Health ≥ 75: Xuất sắc cả tổng lẫn gần đây, tăng ngân sách' },
                                        ].map(a => {
                                            const isActive = campaign.actionRecommendation!.action === a.key;
                                            return (
                                                <span key={a.key} title={a.tip} style={{
                                                    fontSize: '0.5625rem', fontWeight: isActive ? 700 : 500,
                                                    padding: '1px 6px', borderRadius: '3px',
                                                    background: isActive ? a.color + '25' : 'transparent',
                                                    color: isActive ? a.color : colors.textSubtle,
                                                    border: `1px solid ${isActive ? a.color + '50' : colors.border}`,
                                                    opacity: isActive ? 1 : 0.35,
                                                    cursor: 'default',
                                                    transition: 'all 0.2s',
                                                }}>{a.label}</span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button style={styles.closeBtn} onClick={onClose}>×</button>
                    </div>

                    {/* Row 2: Tabs + proposal button */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 20px',
                        borderTop: `1px solid ${colors.border}`,
                        borderBottom: `1px solid ${colors.border}`,
                    }}>
                        <div style={styles.tabs}>
                            <button
                                style={{
                                    ...styles.tab,
                                    ...(activeTab === 'overview' ? styles.tabActive : {})
                                }}
                                onClick={() => setActiveTab('overview')}
                            >Tổng quan</button>
                            <button
                                style={{
                                    ...styles.tab,
                                    ...(activeTab === 'ads' ? styles.tabActive : {})
                                }}
                                onClick={() => setActiveTab('ads')}
                            >Content ({ads.length || '...'})</button>
                            <button
                                style={{
                                    ...styles.tab,
                                    ...(activeTab === 'conclusion' ? styles.tabActive : {})
                                }}
                                onClick={() => setActiveTab('conclusion')}
                            >Kết luận</button>
                        </div>

                    </div>
                </div>

                {/* Success Message */}
                {proposalSuccess && (
                    <div style={{
                        margin: '8px 20px 0',
                        padding: '8px 12px',
                        background: 'rgba(14, 203, 129, 0.1)',
                        border: `1px solid ${colors.success}`,
                        borderRadius: '4px',
                        color: colors.success,
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                    }}>
                        {proposalSuccess}
                    </div>
                )}

                <div style={styles.content}>
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <>
                            {/* ═══ TICKER BAR ═══ */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                                borderBottom: `1px solid ${colors.border}`,
                                marginBottom: '16px',
                            }}>
                                {[
                                    { label: 'CHI TIÊU', value: formatMoney(campaign.totals.spend) },
                                    { label: 'ĐƠN', value: String(campaign.totals.purchases) },
                                    { label: 'CPP', value: formatMoney(campaign.totals.cpp) },
                                    { label: 'ROAS', value: `${campaign.totals.roas.toFixed(2)}x` },
                                    { label: 'CTR', value: `${campaign.totals.ctr.toFixed(2)}%` },
                                    { label: 'DOANH THU', value: formatMoney(campaign.totals.revenue) },
                                ].map((item, idx) => (
                                    <div key={idx} style={{
                                        padding: '8px 12px',
                                        borderRight: (idx % 3 !== 2) ? `1px solid ${colors.border}` : 'none',
                                        borderBottom: idx < 3 ? `1px solid ${colors.border}` : 'none',
                                    }}>
                                        <p style={{
                                            fontSize: '0.75rem', fontWeight: 600, color: colors.textMuted,
                                            margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em',
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
                                            }}>CHỈ SỐ PHÂN TÍCH</span>
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
                                                        }}>TB 7 ngày: {fmtMA}</span>
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
                        </>
                    )}

                    {/* ═══ KẾT LUẬN TAB ═══ */}
                    {activeTab === 'conclusion' && (
                        <div style={styles.section}>
                            {/* Content Summary for AI */}
                            {ads.length > 0 && (
                                <div style={{
                                    padding: '12px 16px', marginBottom: '16px',
                                    background: colors.bgAlt, border: `1px solid ${colors.border}`,
                                    borderRadius: '6px',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: colors.text, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
                                            Tổng hợp Content ({ads.length})
                                        </h4>
                                        <button
                                            onClick={() => {
                                                const totalSpend = campaign.totals.spend;
                                                const debugLines = ads.map((ad, i) => {
                                                    const ev = getContentBadge(ad, totalSpend);
                                                    return [
                                                        `--- Content ${i + 1}: ${ad.name} ---`,
                                                        `Badge: [${ev.badge.text}] | FB chi: ${ev.spendShare.toFixed(1)}%`,
                                                        `Chi: ${formatMoney(ad.totals.spend)} | Thu: ${formatMoney(ad.totals.revenue)} | Đơn: ${ad.totals.purchases}`,
                                                        `CPP: ${formatMoney(ad.totals.cpp)} | CTR: ${ad.totals.ctr.toFixed(2)}%`,
                                                        `ROAS: ${ad.totals.revenue > 0 && ad.totals.spend > 0 ? (ad.totals.revenue / ad.totals.spend).toFixed(2) + 'x' : 'N/A'}`,
                                                        `Z-Score detail: ${ev.tip}`,
                                                    ].join('\n');
                                                });

                                                const summary = [
                                                    `===== CONTENT DEBUG - ${campaign.name} =====`,
                                                    `Ngày: ${dateRange.startDate} → ${dateRange.endDate}`,
                                                    `Tổng: ${ads.length} content | Chi: ${formatMoney(totalSpend)}`,
                                                    ``,
                                                    ...debugLines,
                                                ].join('\n\n');

                                                navigator.clipboard.writeText(summary);
                                            }}
                                            style={{
                                                background: 'transparent', border: `1px solid ${colors.border}`,
                                                color: colors.textMuted, fontSize: '0.625rem', fontWeight: 700,
                                                padding: '3px 8px', borderRadius: '3px', cursor: 'pointer',
                                                fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.05em',
                                            }}
                                        >COPY DEBUG</button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
                                        {ads.slice(0, 10).map((ad, i) => {
                                            const ev = getContentBadge(ad, campaign.totals.spend);
                                            return (
                                                <div key={ad.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    fontSize: '0.6875rem', color: colors.textMuted, lineHeight: 1.6,
                                                }}>
                                                    <span style={{ color: colors.textSubtle, width: '16px', textAlign: 'right' as const }}>{i + 1}</span>
                                                    <span style={{
                                                        fontSize: '0.5625rem', fontWeight: 700,
                                                        padding: '1px 5px', borderRadius: '3px',
                                                        background: ev.badge.bg, color: ev.badge.color,
                                                        minWidth: '50px', textAlign: 'center' as const,
                                                    }}>{ev.badge.text}</span>
                                                    <span style={{ color: colors.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{ad.name}</span>
                                                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.625rem', color: colors.textSubtle }}>
                                                        FB:{ev.spendShare.toFixed(0)}% · CPP:{formatMoney(ad.totals.cpp)} · CTR:{ad.totals.ctr.toFixed(1)}%
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* AI Analysis */}
                            <h3 style={{ ...styles.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Phân tích AI
                                <button
                                    onClick={() => {
                                        const debugData = {
                                            campaign: {
                                                id: campaign.id,
                                                name: campaign.name,
                                                created_time: campaign.created_time,
                                                totals: campaign.totals,
                                            },
                                            actionRecommendation: campaign.actionRecommendation,
                                            issues: campaign.issues,
                                            dailyTrend: campaign.dailyMetrics?.slice(-14),
                                            aiAnalysis: aiAnalysis || null,
                                        };
                                        navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
                                    }}
                                    style={{
                                        padding: '3px 8px', fontSize: '0.625rem', fontWeight: 600,
                                        background: 'transparent', border: `1px solid ${colors.border}`,
                                        borderRadius: '4px', color: colors.textSubtle, cursor: 'pointer',
                                        fontFamily: '"JetBrains Mono", monospace',
                                    }}
                                    title="Copy full debug data to clipboard"
                                >COPY DEBUG</button>
                            </h3>

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
                    )}

                    {/* Content Tab */}
                    {activeTab === 'ads' && (
                        <div style={styles.section}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={styles.sectionTitle}>
                                    Danh sách Content
                                    <span style={{ fontWeight: 400, color: colors.textMuted, marginLeft: '8px' }}>
                                        (sắp theo chi tiêu cao nhất)
                                    </span>
                                </h3>
                                {ads.length > 0 && (
                                    <button
                                        onClick={() => {
                                            const totalSpend = campaign.totals.spend;
                                            const debugLines = ads.map((ad, i) => {
                                                const ev = getContentBadge(ad, totalSpend);
                                                return [
                                                    `--- Content ${i + 1}: ${ad.name} ---`,
                                                    `ID: ${ad.id} | Status: ${ad.status}`,
                                                    `Badge: [${ev.badge.text}] | FB chi: ${ev.spendShare.toFixed(1)}%`,
                                                    `Chi: ${formatMoney(ad.totals.spend)} | Thu: ${formatMoney(ad.totals.revenue)} | Đơn: ${ad.totals.purchases}`,
                                                    `CPP: ${formatMoney(ad.totals.cpp)} | CTR: ${ad.totals.ctr.toFixed(2)}%`,
                                                    `ROAS: ${ad.totals.revenue > 0 && ad.totals.spend > 0 ? (ad.totals.revenue / ad.totals.spend).toFixed(2) + 'x' : 'N/A'}`,
                                                    `Tooltip: ${ev.tip}`,
                                                    `Daily data points: ${ad.dailyMetrics?.length || 0}`,
                                                ].join('\n');
                                            });

                                            const summary = [
                                                `===== CONTENT DEBUG - ${campaign.name} =====`,
                                                `Ngày: ${dateRange.startDate} → ${dateRange.endDate}`,
                                                `Tổng content: ${ads.length}`,
                                                `Tổng chi tiêu campaign: ${formatMoney(totalSpend)}`,
                                                ``,
                                                ...debugLines,
                                            ].join('\n\n');

                                            navigator.clipboard.writeText(summary);
                                        }}
                                        style={{
                                            background: 'transparent', border: `1px solid ${colors.border}`,
                                            color: colors.textMuted, fontSize: '0.625rem', fontWeight: 700,
                                            padding: '3px 8px', borderRadius: '3px', cursor: 'pointer',
                                            fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.05em',
                                        }}
                                    >
                                        COPY DEBUG
                                    </button>
                                )}
                            </div>

                            {isLoadingAds && (
                                <div style={styles.loader}>
                                    <p>Đang tải danh sách content...</p>
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
                                <div style={{ textAlign: 'center', padding: '40px', color: colors.textMuted }}>
                                    <p>Không có content nào trong khoảng thời gian này</p>
                                </div>
                            )}

                            {ads.map((ad) => {
                                const evaluation = getContentBadge(ad, campaign.totals.spend);
                                return (
                                    <div key={ad.id} style={{
                                        background: colors.bgCard,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: '8px',
                                        marginBottom: '12px',
                                        overflow: 'hidden',
                                    }}>
                                        {/* Top: Image + Info side by side */}
                                        <div style={{ display: 'flex', gap: '0' }}>
                                            {/* Image - larger */}
                                            {ad.thumbnail ? (
                                                <img
                                                    src={ad.thumbnail}
                                                    alt={ad.name}
                                                    style={{
                                                        width: '160px',
                                                        height: '160px',
                                                        objectFit: 'cover',
                                                        flexShrink: 0,
                                                        display: 'block',
                                                    }}
                                                />
                                            ) : (
                                                <div style={{
                                                    width: '160px',
                                                    height: '160px',
                                                    background: colors.bgAlt,
                                                    display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.textMuted }}>NO IMG</span>
                                                </div>
                                            )}

                                            {/* Info column */}
                                            <div style={{ flex: 1, padding: '12px 16px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                                {/* Ad name + badges */}
                                                <div>
                                                    {/* Badge row: evaluation badge + spend share + status */}
                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                                                        <span title={evaluation.tip} style={{
                                                            fontSize: '0.6875rem', fontWeight: 700,
                                                            padding: '2px 8px', borderRadius: '3px',
                                                            background: evaluation.badge.bg,
                                                            color: evaluation.badge.color,
                                                            cursor: 'help',
                                                        }}>
                                                            {evaluation.badge.text}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.625rem', fontWeight: 600, color: colors.textSubtle,
                                                            fontFamily: '"JetBrains Mono", monospace',
                                                        }}>
                                                            FB chi: {evaluation.spendShare.toFixed(1)}%
                                                        </span>
                                                        {ad.status !== 'ACTIVE' && (
                                                            <span style={{
                                                                ...styles.adBadge,
                                                                background: `${colors.textSubtle}20`,
                                                                color: colors.textMuted,
                                                            }}>
                                                                {ad.status}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p style={{
                                                        fontSize: '0.8125rem', fontWeight: 600, color: colors.text,
                                                        margin: '0 0 6px', lineHeight: 1.3,
                                                        overflow: 'hidden', textOverflow: 'ellipsis',
                                                        display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const,
                                                    }}>
                                                        {ad.name}
                                                    </p>

                                                    {/* Caption / Message */}
                                                    {ad.message && (
                                                        <p style={{
                                                            fontSize: '0.75rem', color: colors.textMuted,
                                                            margin: '0 0 8px', lineHeight: 1.5,
                                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                                            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const,
                                                            whiteSpace: 'pre-line',
                                                        }}>
                                                            {ad.message}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Metrics row */}
                                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                                                        Chi: <strong style={{ color: colors.text }}>{formatMoney(ad.totals.spend)}</strong>
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                                                        Thu: <strong style={{ color: '#22C55E' }}>{formatMoney(ad.totals.revenue)}</strong>
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                                                        Đơn: <strong style={{ color: colors.text }}>{ad.totals.purchases}</strong>
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                                                        CPP: <strong style={{ color: colors.text }}>{formatMoney(ad.totals.cpp)}</strong>
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                                                        CTR: <strong style={{ color: colors.text }}>{ad.totals.ctr.toFixed(2)}%</strong>
                                                    </span>
                                                    {/* Link to post */}
                                                    {ad.postUrl && (
                                                        <a
                                                            href={ad.postUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{
                                                                fontSize: '0.6875rem', color: colors.primary,
                                                                textDecoration: 'none', fontWeight: 600,
                                                                marginLeft: 'auto',
                                                            }}
                                                        >
                                                            Xem bài viết →
                                                        </a>
                                                    )}
                                                </div>
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
            {
                showProposalPrompt && (
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
                )
            }
        </div >
    );
}
