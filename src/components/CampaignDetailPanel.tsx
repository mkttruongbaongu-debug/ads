'use client';

import { useState, useEffect, useRef } from 'react';

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
    thumbnails?: string[];
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
        daily_budget?: number;
        daily_budget_estimated?: number;
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
    metricKey: 'cpp' | 'ctr' | 'roas' | 'spend';
    label: string;
    formatValue: (v: number) => string;
    ma?: number;
    sigma?: number;
    windowDays?: number;
}) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    if (!data || data.length === 0) return null;

    // CPP is inverse: lower = better. CTR/ROAS: higher = better
    const isInverse = metricKey === 'cpp';
    // Semantic colors: which band line means "good" vs "bad"
    const upperColor = isInverse ? colors.error : colors.success;   // CPP high=bad, CTR/ROAS high=good
    const lowerColor = isInverse ? colors.success : colors.error;   // CPP low=good, CTR/ROAS low=bad

    // CPP/ROAS: giá trị 0 = không có đơn → null (chart đứt đoạn)
    // CTR/Spend: 0 vẫn là giá trị hợp lệ
    const skipZero = metricKey === 'cpp' || metricKey === 'roas';
    const values: (number | null)[] = data.map(d => {
        const v = typeof d[metricKey] === 'number' ? d[metricKey] as number : 0;
        return (skipZero && v === 0) ? null : v;
    });
    const validValues = values.filter((v): v is number => v !== null && v > 0);
    const maxValue = validValues.length > 0 ? Math.max(...validValues) : 0;
    const minValue = validValues.length > 0 ? Math.min(...validValues) : 0;

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

    // Build line segments — skip null values (create gaps)
    const lineSegments: string[] = [];
    let currentSegment: string[] = [];
    values.forEach((v, i) => {
        if (v !== null) {
            currentSegment.push(`${toX(i).toFixed(1)},${toY(v).toFixed(1)}`);
        } else {
            if (currentSegment.length > 0) {
                lineSegments.push(`M ${currentSegment.join(' L ')}`);
                currentSegment = [];
            }
        }
    });
    if (currentSegment.length > 0) {
        lineSegments.push(`M ${currentSegment.join(' L ')}`);
    }
    const linePath = lineSegments.join(' ');

    // Build area fill segments (under line, skip nulls)
    const areaSegments: string[] = [];
    let areaCurrentPts: { x: number; y: number }[] = [];
    values.forEach((v, i) => {
        if (v !== null) {
            areaCurrentPts.push({ x: toX(i), y: toY(v) });
        } else {
            if (areaCurrentPts.length > 0) {
                const first = areaCurrentPts[0];
                const last = areaCurrentPts[areaCurrentPts.length - 1];
                const pts = areaCurrentPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ');
                areaSegments.push(`M ${first.x.toFixed(1)},${(H - PAD_B).toFixed(1)} L ${pts} L ${last.x.toFixed(1)},${(H - PAD_B).toFixed(1)} Z`);
                areaCurrentPts = [];
            }
        }
    });
    if (areaCurrentPts.length > 0) {
        const first = areaCurrentPts[0];
        const last = areaCurrentPts[areaCurrentPts.length - 1];
        const pts = areaCurrentPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ');
        areaSegments.push(`M ${first.x.toFixed(1)},${(H - PAD_B).toFixed(1)} L ${pts} L ${last.x.toFixed(1)},${(H - PAD_B).toFixed(1)} Z`);
    }
    const areaPath = areaSegments.join(' ');

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

    // Current (last) value — tìm giá trị hợp lệ cuối cùng
    const lastValidIdx = (() => { for (let i = values.length - 1; i >= 0; i--) { if (values[i] !== null) return i; } return values.length - 1; })();
    const lastVal = values[lastValidIdx];
    const lastX = toX(lastValidIdx);
    const lastY = lastVal !== null ? toY(lastVal) : H - PAD_B;

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
                }}>{label} — {data.length} NGÀY</span>
                <span style={{
                    fontSize: '0.75rem', fontWeight: 700,
                    color: lastVal === null ? colors.textMuted
                        : lastVal > (ma || 0) ? (metricKey === 'cpp' ? colors.error : colors.success)
                            : (metricKey === 'cpp' ? colors.success : colors.error),
                    fontFamily: '"JetBrains Mono", monospace',
                }}>{lastVal !== null ? formatValue(lastVal) : '—'}</span>
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
                        stroke={`${upperColor}50`} strokeWidth="0.8" strokeDasharray="4,3"
                    />
                )}

                {/* Lower band line (-2σ) */}
                {ma && sigma && (
                    <line
                        x1={PAD_L} y1={toY(Math.max(0, ma - 2 * sigma))}
                        x2={W - PAD_R} y2={toY(Math.max(0, ma - 2 * sigma))}
                        stroke={`${lowerColor}50`} strokeWidth="0.8" strokeDasharray="4,3"
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
                    if (i < historyCount || v === null) return null;
                    const isAboveUpper = ma && sigma && v > ma + 2 * sigma;
                    const isBelowLower = ma && sigma && v < ma - 2 * sigma;
                    const dotColor = isAboveUpper ? upperColor
                        : isBelowLower ? lowerColor
                            : colors.primary;
                    return (
                        <circle
                            key={i}
                            cx={toX(i)} cy={toY(v)} r="2.5"
                            fill={dotColor}
                            stroke={colors.bg} strokeWidth="1"
                        />
                    );
                })}

                {/* Current value dot — only if valid */}
                {lastVal !== null && (
                    <circle cx={lastX} cy={lastY} r="4" fill={colors.primary} stroke={colors.bg} strokeWidth="1.5" />
                )}

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
                            textAnchor="end" fill={`${upperColor}90`} fontSize="7"
                            fontFamily='"JetBrains Mono", monospace'
                        >+2σ</text>
                        <text
                            x={W - PAD_R - 2} y={toY(Math.max(0, ma - 2 * sigma)) + 10}
                            textAnchor="end" fill={`${lowerColor}90`} fontSize="7"
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
                {hoveredIdx !== null && (
                    <g>
                        {/* Vertical crosshair */}
                        <line
                            x1={hoverX} y1={PAD_T} x2={hoverX} y2={H - PAD_B}
                            stroke={`${colors.text}40`} strokeWidth="0.8" strokeDasharray="3,2"
                        />
                        {hoverVal !== null ? (
                            <>
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
                            </>
                        ) : (
                            <>
                                {/* Null value tooltip — "Không có đơn" */}
                                <rect
                                    x={tooltipRight ? hoverX - 110 : hoverX + 6}
                                    y={H - PAD_B - 24}
                                    width={104} height={20} rx={3}
                                    fill={colors.bgAlt} stroke={`${colors.textMuted}50`} strokeWidth="0.8"
                                />
                                <text
                                    x={tooltipRight ? hoverX - 106 : hoverX + 10}
                                    y={H - PAD_B - 24 + 13}
                                    fill={colors.textMuted} fontSize="7.5"
                                    fontFamily='"JetBrains Mono", monospace'
                                >{(hoverDate || '').slice(5)}</text>
                                <text
                                    x={tooltipRight ? hoverX - 10 : hoverX + 106}
                                    y={H - PAD_B - 24 + 13}
                                    textAnchor="end"
                                    fill={colors.textMuted} fontSize="7.5" fontStyle="italic"
                                    fontFamily='"JetBrains Mono", monospace'
                                >Không có đơn</text>
                            </>
                        )}
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

    // Guard: prevent duplicate concurrent AI analysis calls
    const aiInFlightRef = useRef(false);
    const [dailyTrend, setDailyTrend] = useState<Array<{
        date: string;
        spend: number;
        purchases: number;
        cpp: number;
        ctr: number;
        roas: number;
    }>>([]);
    const [isLoadingTrend, setIsLoadingTrend] = useState(false);

    // Ads data
    const [ads, setAds] = useState<Ad[]>([]);
    const [isLoadingAds, setIsLoadingAds] = useState(false);
    const [adsError, setAdsError] = useState<string | null>(null);

    // Create proposal state
    const [isCreatingProposal, setIsCreatingProposal] = useState(false);
    const [proposalSuccess, setProposalSuccess] = useState<string | null>(null);

    // Auto-prompt modal state
    const [showProposalPrompt, setShowProposalPrompt] = useState(false);

    // FAST: Fetch trend data for charts — separate from AI to render instantly
    const fetchTrend = async () => {
        setIsLoadingTrend(true);
        try {
            console.log('[TREND] ⚡ Fetching chart data (fast path)...');
            const res = await fetch(
                `/api/analysis/campaign/${campaign.id}/trend?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
            );
            const json = await res.json();
            if (json.success && json.data?.dailyTrend) {
                setDailyTrend(json.data.dailyTrend);
                console.log(`[TREND] ✅ Chart data ready! ${json.data.dailyTrend.length} days`);
            }
        } catch (error) {
            console.warn('[TREND] ⚠️ Failed to fetch trend:', error);
        } finally {
            setIsLoadingTrend(false);
        }
    };

    // Auto-trigger when campaign is selected — 3 PARALLEL streams
    useEffect(() => {
        // CRITICAL: Reset ALL campaign-specific state when campaign changes
        console.log(`[CAMPAIGN_DETAIL] 🔄 Campaign changed to: ${campaign.id} (${campaign.name})`);
        console.log('[CAMPAIGN_DETAIL] 🧹 Resetting all campaign-specific state...');

        // Reset AI analysis state
        setAiAnalysis(null);
        setAiError(null);
        setIsLoadingAI(false);

        // Reset trend data  
        setDailyTrend([]);
        setIsLoadingTrend(false);

        // Reset ads data
        setAds([]);
        setAdsError(null);

        // Reset proposal state
        setProposalSuccess(null);
        setIsCreatingProposal(false);
        setShowProposalPrompt(false);

        // Reset tab to overview
        setActiveTab('overview');

        console.log('[CAMPAIGN_DETAIL] ✅ State reset complete. Phase 1: Load data, Phase 2: AI analysis...');

        // 🚀 2-PHASE approach:
        // Phase 1: Load data in parallel (trend + ads) — FAST
        // Phase 2: AI analysis — CHỈ CHẠY KHI DATA ĐÃ LOAD XONG
        const loadData = async () => {
            await Promise.all([fetchTrend(), fetchAds()]);
            console.log('[CAMPAIGN_DETAIL] ✅ Phase 1 complete — data loaded. Starting AI analysis...');
            handleAnalyzeAI();
        };
        loadData();
    }, [campaign.id]); // Trigger when campaign changes

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

    const handleAnalyzeAI = async (retryCount = 0) => {
        // Guard: skip if already in-flight (prevent duplicate calls from React strict mode / rapid triggers)
        if (retryCount === 0 && aiInFlightRef.current) {
            console.log('[AI_ANALYSIS] ⏭️ Already in-flight, skipping duplicate call');
            return;
        }
        aiInFlightRef.current = true;
        setIsLoadingAI(true);
        setAiError(null);

        try {
            console.log(`[AI_ANALYSIS] 🧠 Calling AI analysis (attempt ${retryCount + 1})...`);
            const res = await fetch(`/api/analysis/campaign/${campaign.id}/ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                }),
            });

            // Response is a stream (heartbeat + JSON)
            // Read full stream, strip heartbeat newlines, parse JSON
            const reader = res.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fullText += decoder.decode(value, { stream: true });
            }

            // Strip heartbeat newlines, find JSON
            const jsonText = fullText.trim();
            if (!jsonText) {
                if (retryCount < 3) {
                    const delay = (retryCount + 1) * 2;
                    console.warn(`[AI_ANALYSIS] ⚠️ Empty response, auto-retrying in ${delay}s... (attempt ${retryCount + 1}/3)`);
                    await new Promise(r => setTimeout(r, delay * 1000));
                    return handleAnalyzeAI(retryCount + 1);
                }
                throw new Error('Server trả về response rỗng sau 3 lần thử');
            }

            const json = JSON.parse(jsonText);

            if (!json.success) {
                throw new Error(json.error);
            }

            // Get the FRESH AI analysis from the response
            const freshAiAnalysis = json.data.aiAnalysis;

            setAiAnalysis(freshAiAnalysis);
            // NOTE: dailyTrend is now fetched via the fast /trend endpoint
            // No longer waiting for AI to get chart data

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
            aiInFlightRef.current = false;
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
                    daily_budget_estimated: campaign.daily_budget_estimated || campaign.daily_budget || 0,
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
    // ===================================================================
    // CONTENT SCORE /10
    // ===================================================================
    // Điểm = ROAS×confidence (3đ) + CPP absolute (3đ) + CPP trend (2đ) + CTR trend (1đ) + FB Trust (1đ)
    const getContentScore = (ad: Ad, totalCampaignSpend: number, campaignAvgCpp: number) => {
        const daily = ad.dailyMetrics || [];
        const spendShare = totalCampaignSpend > 0 ? (ad.totals.spend / totalCampaignSpend) * 100 : 0;
        const totalROAS = ad.totals.spend > 0 ? ad.totals.revenue / ad.totals.spend : 0;

        // --- Ít data: < 5 đơn hoặc < 5 ngày ---
        if (ad.totals.purchases < 5 || daily.length < 5) {
            return {
                score: -1, // -1 = chưa đủ data
                color: colors.textMuted,
                spendShare,
                tip: `Chưa đủ dữ liệu (${ad.totals.purchases} đơn, ${daily.length} ngày)`,
                tags: [] as string[],
            };
        }

        // --- Split history vs recent 7d ---
        const windowSize = Math.min(7, Math.floor(daily.length / 2));
        const windowDays = daily.slice(-windowSize);
        const historyDays = daily.slice(0, -windowSize);

        if (historyDays.length < 3) {
            // Content mới — chấm dựa trên ROAS + CPP absolute only
            let earlyScore = 0;
            const confidence = Math.min(1, Math.max(0.4, ad.totals.purchases / 30));
            // ROAS (3đ) × confidence
            let rawRoas = 0;
            if (totalROAS >= 15) rawRoas = 3;
            else if (totalROAS >= 10) rawRoas = 2.5 + (totalROAS - 10) / 10;
            else if (totalROAS >= 5) rawRoas = 1.5 + (totalROAS - 5) / 5;
            else if (totalROAS >= 2) rawRoas = 0.5 + (totalROAS - 2) / 3;
            else rawRoas = Math.max(0, totalROAS / 4);
            earlyScore += rawRoas * confidence;
            // CPP absolute (3đ) — simplified
            const overallCpp = ad.totals.purchases > 0 ? ad.totals.spend / ad.totals.purchases : 0;
            if (campaignAvgCpp > 0 && overallCpp > 0) {
                const ratio = overallCpp / campaignAvgCpp;
                if (ratio < 0.7) earlyScore += 3;
                else if (ratio < 1.0) earlyScore += 2;
                else if (ratio < 1.5) earlyScore += 1;
            }
            // Trend unknown → give neutral 2.5/4 (CPP trend 1/2 + CTR 0.5/1 + FB Trust 1/1)
            earlyScore += 2.5;
            const tags: string[] = [];
            if (spendShare < 3 && totalROAS > 10) tags.push('CHERRY-PICKED');
            return {
                score: Math.min(10, Math.round(earlyScore * 10) / 10),
                color: getScoreColor(earlyScore),
                spendShare,
                tip: `Content mới (${daily.length} ngày). ROAS: ${totalROAS.toFixed(1)}x`,
                tags,
            };
        }

        // --- CPP z-score ---
        const histCPP = historyDays.map(d => d.purchases > 0 ? d.spend / d.purchases : 0).filter(v => v > 0);
        const winCPP = windowDays.map(d => d.purchases > 0 ? d.spend / d.purchases : 0).filter(v => v > 0);

        let cppZRaw = 0, cppMA = 0, cppWindowAvg = 0;
        if (histCPP.length >= 3 && winCPP.length > 0) {
            cppMA = histCPP.reduce((s, v) => s + v, 0) / histCPP.length;
            const cppVariance = histCPP.reduce((s, v) => s + Math.pow(v - cppMA, 2), 0) / histCPP.length;
            const cppSigma = Math.sqrt(cppVariance);
            cppWindowAvg = winCPP.reduce((s, v) => s + v, 0) / winCPP.length;
            cppZRaw = cppSigma > 0 ? (cppWindowAvg - cppMA) / cppSigma : 0;
        }
        // CAP z-score ±3σ — tránh giá trị cực đoan phá hoại điểm
        const cppZ = Math.max(-3, Math.min(3, cppZRaw));

        // --- CTR z-score ---
        const histCTR = historyDays.map(d => d.ctr).filter(v => v > 0);
        const winCTR = windowDays.map(d => d.ctr).filter(v => v > 0);

        let ctrZRaw = 0, ctrMA = 0, ctrWindowAvg = 0;
        if (histCTR.length >= 3 && winCTR.length > 0) {
            ctrMA = histCTR.reduce((s, v) => s + v, 0) / histCTR.length;
            const ctrVariance = histCTR.reduce((s, v) => s + Math.pow(v - ctrMA, 2), 0) / histCTR.length;
            const ctrSigma = Math.sqrt(ctrVariance);
            ctrWindowAvg = winCTR.reduce((s, v) => s + v, 0) / winCTR.length;
            ctrZRaw = ctrSigma > 0 ? (ctrWindowAvg - ctrMA) / ctrSigma : 0;
        }
        // CAP z-score ±3σ
        const ctrZ = Math.max(-3, Math.min(3, ctrZRaw));

        // =====================================================
        // SCORING (tổng 10 điểm)
        // =====================================================

        // === 1. ROAS Score (0-3 điểm) × confidence ===
        // Confidence: ít đơn = metrics không đáng tin (anti cherry-pick)
        const confidence = Math.min(1, Math.max(0.4, ad.totals.purchases / 30));
        let rawRoasScore = 0;
        if (totalROAS >= 15) rawRoasScore = 3;
        else if (totalROAS >= 10) rawRoasScore = 2.5 + (totalROAS - 10) / 10;  // 2.5 → 3.0
        else if (totalROAS >= 5) rawRoasScore = 1.5 + (totalROAS - 5) / 5;     // 1.5 → 2.5
        else if (totalROAS >= 2) rawRoasScore = 0.5 + (totalROAS - 2) / 3;     // 0.5 → 1.5
        else rawRoasScore = Math.max(0, totalROAS / 4);                          // 0.0 → 0.5
        const roasScore = Math.round(rawRoasScore * confidence * 10) / 10;

        // === 2. CPP Absolute Score (0-3 điểm) — CPP 7d vs TB campaign ===
        let cppAbsScore = 1.5; // default neutral
        if (campaignAvgCpp > 0 && cppWindowAvg > 0) {
            const ratio = cppWindowAvg / campaignAvgCpp;
            if (ratio < 0.5) cppAbsScore = 3;
            else if (ratio < 0.7) cppAbsScore = 2.5 + (0.7 - ratio) / 0.2 * 0.5;
            else if (ratio < 1.0) cppAbsScore = 2 + (1.0 - ratio) / 0.3 * 0.5;
            else if (ratio < 1.5) cppAbsScore = 1 + (1.5 - ratio) / 0.5;
            else if (ratio < 2.0) cppAbsScore = (2.0 - ratio) / 0.5;
            else cppAbsScore = 0;
        }

        // === 3. CPP Trend Score (0-2 điểm) — z-score (âm = tốt, dương = xấu) ===
        let cppTrendScore = 1; // neutral
        if (cppZ <= -2) cppTrendScore = 2;
        else if (cppZ <= -1) cppTrendScore = 1.5 + (-1 - cppZ) / 2 * 0.5;
        else if (cppZ <= 0.5) cppTrendScore = 1 + (0.5 - cppZ) / 1.5 * 0.5;
        else if (cppZ <= 2) cppTrendScore = Math.max(0, 1 - (cppZ - 0.5) / 1.5);
        else cppTrendScore = 0;

        // === 4. CTR Trend Score (0-1 điểm) — z-score (dương = tốt, âm = xấu) ===
        let ctrTrendScore = 0.5; // neutral
        if (ctrZ >= 1) ctrTrendScore = 1;
        else if (ctrZ >= 0) ctrTrendScore = 0.5 + ctrZ / 2;
        else if (ctrZ >= -1) ctrTrendScore = 0.5 + ctrZ / 2;
        else ctrTrendScore = 0;

        // === 5. FB Trust Score (0-1 điểm) — CÓ ĐIỀU KIỆN ===
        // FB phân bổ chi tiêu = FB "bỏ phiếu" content scale tốt
        // NHƯNG: chỉ tin khi trend lành mạnh (tránh FB momentum bias)
        const trendHealth = (cppTrendScore / 2 + ctrTrendScore / 1) / 2; // 0-1 normalized
        let fbTrustScore = 0;
        if (trendHealth >= 0.4) {
            // Trend OK → FB Trust applies
            if (spendShare >= 25) fbTrustScore = 1.0;
            else if (spendShare >= 15) fbTrustScore = 0.6 + (spendShare - 15) / 10 * 0.4;
            else if (spendShare >= 5) fbTrustScore = 0.2 + (spendShare - 5) / 10 * 0.4;
            else if (spendShare >= 2) fbTrustScore = (spendShare - 2) / 3 * 0.2;
            else fbTrustScore = 0;
        }
        // else: trend xấu → FB Trust = 0 (FB đang đổ tiền mù)

        const totalScore = Math.min(10, Math.round((roasScore + cppAbsScore + cppTrendScore + ctrTrendScore + fbTrustScore) * 10) / 10);

        // === WARNING TAGS ===
        const tags: string[] = [];
        // FB ĐỔ TIỀN MÙ: content chiếm >15% budget nhưng trend xấu
        if (spendShare > 15 && trendHealth < 0.4) {
            tags.push('FB ĐỔ TIỀN MÙ');
        }
        // CHERRY-PICKED: content <3% budget, metrics đẹp nhưng chưa chứng minh scale
        if (spendShare < 3 && totalROAS > 8 && ad.totals.purchases < 15) {
            tags.push('CHERRY-PICKED');
        }

        // --- Tooltip ---
        const fmtZ = (z: number, raw: number) => {
            const display = `${z > 0 ? '+' : ''}${z.toFixed(1)}σ`;
            return Math.abs(raw) > 3 ? `${display} [raw: ${raw > 0 ? '+' : ''}${raw.toFixed(1)}σ]` : display;
        };
        const tipLines = [
            `📊 Điểm: ${totalScore}/10`,
            `   ROAS: ${roasScore.toFixed(1)}/3 (${totalROAS.toFixed(1)}x × conf ${(confidence * 100).toFixed(0)}%)`,
            `   CPP vs TB: ${cppAbsScore.toFixed(1)}/3 (7d: ${cppWindowAvg > 0 ? formatMoney(cppWindowAvg) : 'N/A'} vs TB: ${formatMoney(campaignAvgCpp)})`,
            `   CPP trend: ${cppTrendScore.toFixed(1)}/2 (${fmtZ(cppZ, cppZRaw)})`,
            `   CTR trend: ${ctrTrendScore.toFixed(1)}/1 (${fmtZ(ctrZ, ctrZRaw)})`,
            `   FB Trust: ${fbTrustScore.toFixed(1)}/1 (share: ${spendShare.toFixed(1)}%${trendHealth < 0.4 && spendShare > 5 ? ' ⚠️ trend xấu' : ''})`,
            ``,
            `Lịch sử (${historyDays.length}d): CPP MA=${cppMA > 0 ? formatMoney(cppMA) : 'N/A'} · CTR MA=${ctrMA.toFixed(2)}%`,
            `7 ngày gần đây: CPP=${cppWindowAvg > 0 ? formatMoney(cppWindowAvg) : 'N/A'} · CTR=${ctrWindowAvg.toFixed(2)}%`,
        ];
        if (tags.length > 0) {
            tipLines.push(``, `⚠️ ${tags.join(' | ')}`);
        }

        return {
            score: totalScore,
            color: getScoreColor(totalScore),
            spendShare,
            tip: tipLines.join('\n'),
            tags,
        };
    };

    // Color gradient: đỏ → cam → vàng → xanh
    function getScoreColor(score: number): string {
        if (score >= 9) return '#22C55E';   // xanh đậm
        if (score >= 7) return '#4ADE80';   // xanh lá
        if (score >= 5) return '#EAB308';   // vàng
        if (score >= 3) return '#F97316';   // cam
        return '#EF4444';                    // đỏ
    }

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
                                            return <span style={{ fontSize: '0.5625rem', color: colors.textMuted, marginLeft: '2px' }}>({ageDays} ngày)</span>;
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


                            {/* ═══ ISSUES — chỉ hiện absolute checks (không trùng với bands) ═══ */}
                            {(() => {
                                const bandIssueTypes = ['content_worn', 'cpp_rising'];
                                const absoluteIssues = campaign.issues.filter(i => !bandIssueTypes.includes(i.type));
                                if (absoluteIssues.length === 0) return null;
                                return (
                                    <div style={{ marginBottom: '20px' }}>
                                        {absoluteIssues.map((issue, idx) => (
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
                                );
                            })()}

                            {/* ═══ BANDS CHARTS ═══ */}
                            {isLoadingTrend && dailyTrend.length === 0 && (
                                <div style={{
                                    background: colors.bgAlt,
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '8px',
                                    padding: '16px',
                                    marginBottom: '20px',
                                }}>
                                    {/* Chart skeleton — pulsing placeholder */}
                                    {[0, 1].map(i => (
                                        <div key={i} style={{
                                            height: '140px',
                                            marginBottom: i === 0 ? '16px' : '0',
                                            background: `linear-gradient(90deg, ${colors.border}40 25%, ${colors.border}80 50%, ${colors.border}40 75%)`,
                                            backgroundSize: '200% 100%',
                                            borderRadius: '6px',
                                            animation: 'shimmer 1.5s infinite',
                                        }} />
                                    ))}
                                    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
                                </div>
                            )}
                            {dailyTrend.length > 0 && (() => {
                                const bands = campaign.actionRecommendation?.debugData?.processing?.bands;
                                const windowDays = campaign.actionRecommendation?.debugData?.processing?.historySplit?.windowDays || 7;

                                // Fallback: compute ma/sigma locally when AI bands not yet available
                                const computeLocalBand = (key: 'cpp' | 'ctr' | 'roas' | 'spend') => {
                                    if (bands?.[key]?.ma) return bands[key];
                                    const vals = dailyTrend
                                        .map((d: any) => typeof d[key] === 'number' ? d[key] as number : 0)
                                        .filter((v: number) => v > 0);
                                    if (vals.length < 3) return { ma: undefined, sigma: undefined };
                                    const ma = vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
                                    const variance = vals.reduce((s: number, v: number) => s + (v - ma) ** 2, 0) / vals.length;
                                    const sigma = Math.sqrt(variance);
                                    return { ma, sigma };
                                };

                                const cppBand = computeLocalBand('cpp');
                                const ctrBand = computeLocalBand('ctr');
                                const roasBand = computeLocalBand('roas');
                                const spendBand = computeLocalBand('spend');

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
                                            metricKey="spend"
                                            label="CHI TIÊU (Ngân sách/ngày)"
                                            formatValue={(v) => formatMoney(v)}
                                            ma={spendBand.ma}
                                            sigma={spendBand.sigma}
                                            windowDays={windowDays}
                                        />
                                        <BandsChart
                                            data={dailyTrend}
                                            metricKey="cpp"
                                            label="CPP (Chi phí/đơn)"
                                            formatValue={(v) => formatMoney(v)}
                                            ma={cppBand.ma}
                                            sigma={cppBand.sigma}
                                            windowDays={windowDays}
                                        />
                                        <BandsChart
                                            data={dailyTrend}
                                            metricKey="ctr"
                                            label="CTR (Click rate)"
                                            formatValue={(v) => v.toFixed(2) + '%'}
                                            ma={ctrBand.ma}
                                            sigma={ctrBand.sigma}
                                            windowDays={windowDays}
                                        />
                                        <BandsChart
                                            data={dailyTrend}
                                            metricKey="roas"
                                            label="ROAS (Return on Ad Spend)"
                                            formatValue={(v) => v.toFixed(2) + 'x'}
                                            ma={roasBand.ma}
                                            sigma={roasBand.sigma}
                                            windowDays={windowDays}
                                        />
                                    </div>
                                );
                            })()}

                            {/* ═══ PHÂN TÍCH CHỈ SỐ — Redesigned ═══ */}
                            {(() => {
                                const rec = campaign.actionRecommendation;
                                const aiBands = rec?.debugData?.processing?.bands;
                                const tags = rec?.metricTags || [];

                                // Fallback: compute bands locally from dailyTrend when AI hasn't run yet
                                const computeLocalBandFull = (key: 'cpp' | 'ctr' | 'roas') => {
                                    const vals = dailyTrend
                                        .map((d: any) => typeof d[key] === 'number' ? d[key] as number : 0)
                                        .filter((v: number) => v > 0);
                                    if (vals.length < 3) return null;
                                    const ma = vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
                                    const variance = vals.reduce((s: number, v: number) => s + (v - ma) ** 2, 0) / vals.length;
                                    const sigma = Math.sqrt(variance);
                                    // Window avg = last 7 days
                                    const windowVals = vals.slice(-7);
                                    const windowAvg = windowVals.length > 0
                                        ? windowVals.reduce((s: number, v: number) => s + v, 0) / windowVals.length
                                        : ma;
                                    const zScore = sigma > 0 ? (windowAvg - ma) / sigma : 0;
                                    return { ma, sigma, windowAvg, zScore };
                                };

                                const bands: Record<string, any> = {};
                                for (const key of ['ctr', 'cpp', 'roas'] as const) {
                                    bands[key] = aiBands?.[key] || computeLocalBandFull(key);
                                }

                                const hasBandData = bands.ctr || bands.cpp || bands.roas;
                                if (!hasBandData && tags.length === 0) return null;

                                // Status label logic (Vietnamese, human-readable)
                                const getStatus = (zScore: number | undefined, isInverse: boolean) => {
                                    if (zScore === undefined) return { label: '—', color: colors.textMuted, bg: `${colors.textMuted}15` };
                                    // For inverse metrics (CPP): positive z = cost UP = bad → negate
                                    // For normal metrics (CTR, ROAS): positive z = value UP = good → keep as-is
                                    const effectiveZ = isInverse ? -zScore : zScore;
                                    if (effectiveZ <= -2.0) return { label: 'NGUY HIỂM', color: '#EF4444', bg: '#EF444418' };
                                    if (effectiveZ <= -1.0) return { label: 'YẾU', color: '#F97316', bg: '#F9731618' };
                                    if (effectiveZ <= -0.5) return { label: 'CẦN THEO DÕI', color: colors.warning, bg: `${colors.warning}18` };
                                    if (effectiveZ < 0.5) return { label: 'ỔN ĐỊNH', color: '#3B82F6', bg: '#3B82F618' };
                                    if (effectiveZ < 1.0) return { label: 'TỐT', color: '#22C55E', bg: '#22C55E18' };
                                    return { label: 'XUẤT SẮC', color: '#10B981', bg: '#10B98118' };
                                };

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
                                            marginBottom: '16px', paddingBottom: '10px',
                                            borderBottom: `1px solid ${colors.border}`,
                                        }}>
                                            <span style={{
                                                fontSize: '0.6875rem', fontWeight: 700, color: colors.textMuted,
                                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                            }}>PHÂN TÍCH CHỈ SỐ</span>
                                            <p style={{
                                                margin: '4px 0 0', fontSize: '0.625rem', color: colors.textSubtle,
                                                lineHeight: 1.4,
                                            }}>Trung bình 7 ngày gần nhất so với trung bình lịch sử (khác với biểu đồ theo ngày ở trên)</p>
                                        </div>

                                        {/* Metric Cards */}
                                        {(['CTR', 'CPP', 'ROAS'] as const).map(metric => {
                                            const band = bands[metric.toLowerCase()];
                                            const tag = tags.find(t => t.metric === metric);
                                            if (!band && !tag) return null;

                                            const windowAvg = band?.windowAvg;
                                            const ma = band?.ma;
                                            const zScore = band?.zScore ?? tag?.zScore;
                                            const isInverse = metric === 'CPP';

                                            // Format values
                                            const fmtVal = (v: number) => metric === 'CTR' ? `${v.toFixed(2)}%`
                                                : metric === 'ROAS' ? `${v.toFixed(2)}x`
                                                    : formatMoney(v);
                                            const fmtWindow = fmtVal(windowAvg || 0);
                                            const fmtMA = fmtVal(ma || 0);

                                            // Percentage change from MA
                                            const pctChange = ma && windowAvg && ma > 0
                                                ? ((windowAvg - ma) / ma) * 100
                                                : 0;
                                            // For display: is this change good or bad?
                                            const changeIsGood = isInverse ? pctChange < 0 : pctChange > 0;

                                            // Status
                                            const status = getStatus(zScore, isInverse);

                                            // Gauge bar: position of current value relative to band range
                                            const sigma = band?.sigma || 0;
                                            const lowerBound = Math.max(0, (ma || 0) - 2 * sigma);
                                            const upperBound = (ma || 0) + 2 * sigma;
                                            const bandRange = upperBound - lowerBound || 1;
                                            const gaugePercent = Math.min(Math.max(((windowAvg || 0) - lowerBound) / bandRange * 100, 2), 98);

                                            // Gauge colors
                                            const gaugeColor = status.color;

                                            // Action from issue
                                            const metricIssueTypes: Record<string, string[]> = {
                                                'CTR': ['content_worn'],
                                                'CPP': ['cpp_rising'],
                                                'ROAS': ['losing_money'],
                                            };
                                            const matchingIssue = campaign.issues.find(i => metricIssueTypes[metric]?.includes(i.type));

                                            return (
                                                <div key={metric} style={{
                                                    padding: '14px 0',
                                                    borderBottom: metric !== 'ROAS' ? `1px solid ${colors.border}40` : 'none',
                                                }}>
                                                    {/* Row 1: Metric name + Status badge + Action */}
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        marginBottom: '8px',
                                                    }}>
                                                        <span style={{
                                                            fontSize: '0.6875rem', fontWeight: 700, color: colors.textMuted,
                                                            fontFamily: '"JetBrains Mono", monospace',
                                                            width: '38px', letterSpacing: '0.03em',
                                                        }}>{metric}</span>
                                                        <span style={{
                                                            fontSize: '0.625rem', fontWeight: 700,
                                                            padding: '3px 8px', borderRadius: '3px',
                                                            background: status.bg, color: status.color,
                                                            letterSpacing: '0.05em',
                                                        }}>{status.label}</span>
                                                        {matchingIssue && (
                                                            <span style={{
                                                                fontSize: '0.625rem', color: colors.success,
                                                                fontWeight: 600, marginLeft: 'auto', whiteSpace: 'nowrap',
                                                            }}>→ {matchingIssue.action}</span>
                                                        )}
                                                    </div>

                                                    {/* Row 2: Big value + change indicator + MA comparison */}
                                                    <div style={{
                                                        display: 'flex', alignItems: 'baseline', gap: '10px',
                                                        marginBottom: '10px',
                                                    }}>
                                                        <span style={{
                                                            fontSize: '1.25rem', fontWeight: 700,
                                                            color: status.color,
                                                            fontFamily: '"JetBrains Mono", monospace',
                                                        }}>{fmtWindow}</span>
                                                        {pctChange !== 0 && (
                                                            <span style={{
                                                                fontSize: '0.75rem', fontWeight: 700,
                                                                color: changeIsGood ? colors.success : colors.error,
                                                                fontFamily: '"JetBrains Mono", monospace',
                                                                display: 'flex', alignItems: 'center', gap: '2px',
                                                            }}>
                                                                <span style={{ fontSize: '0.625rem' }}>
                                                                    {pctChange > 0 ? '▲' : '▼'}
                                                                </span>
                                                                {Math.abs(pctChange).toFixed(0)}%
                                                            </span>
                                                        )}
                                                        {ma && (
                                                            <span style={{
                                                                fontSize: '0.6875rem', color: colors.textSubtle,
                                                                fontFamily: '"JetBrains Mono", monospace',
                                                            }}>
                                                                vs TB {fmtMA}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Row 3: Gauge bar with position indicator */}
                                                    {sigma > 0 && (
                                                        <div style={{ position: 'relative' }}>
                                                            {/* Labels */}
                                                            <div style={{
                                                                display: 'flex', justifyContent: 'space-between',
                                                                marginBottom: '4px',
                                                            }}>
                                                                <span style={{
                                                                    fontSize: '0.5625rem', color: isInverse ? colors.success : colors.error,
                                                                    fontFamily: '"JetBrains Mono", monospace', opacity: 0.7,
                                                                }}>-2σ</span>
                                                                <span style={{
                                                                    fontSize: '0.5625rem', color: colors.textSubtle,
                                                                    fontFamily: '"JetBrains Mono", monospace',
                                                                }}>TB</span>
                                                                <span style={{
                                                                    fontSize: '0.5625rem', color: isInverse ? colors.error : colors.success,
                                                                    fontFamily: '"JetBrains Mono", monospace', opacity: 0.7,
                                                                }}>+2σ</span>
                                                            </div>
                                                            {/* Track */}
                                                            <div style={{
                                                                height: '6px', borderRadius: '3px',
                                                                background: `linear-gradient(90deg, ${isInverse ? colors.success : colors.error}30, ${colors.textSubtle}20 45%, ${colors.textSubtle}20 55%, ${isInverse ? colors.error : colors.success}30)`,
                                                                position: 'relative',
                                                            }}>
                                                                {/* MA center mark */}
                                                                <div style={{
                                                                    position: 'absolute', left: '50%', top: '-1px',
                                                                    width: '1px', height: '8px',
                                                                    background: colors.textSubtle, opacity: 0.5,
                                                                }} />
                                                                {/* Current value dot */}
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    left: `${gaugePercent}%`,
                                                                    top: '50%', transform: 'translate(-50%, -50%)',
                                                                    width: '10px', height: '10px',
                                                                    borderRadius: '50%',
                                                                    background: gaugeColor,
                                                                    border: `2px solid ${colors.bg}`,
                                                                    boxShadow: `0 0 6px ${gaugeColor}60`,
                                                                }} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </>
                    )}

                    {/* ═══ KẾT LUẬN TAB ═══ */}
                    {activeTab === 'conclusion' && (
                        <div style={styles.section}>
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
                                            guardrail: (aiAnalysis as any)?._guardrail || null,
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
                                    onClick={() => handleAnalyzeAI()}
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
                                        onClick={() => handleAnalyzeAI()}
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

                                    {/* Guard Rail Override Warning */}
                                    {(aiAnalysis as any)?._guardrail?.wasOverridden && (
                                        <div style={{
                                            padding: '8px 12px',
                                            marginBottom: '12px',
                                            background: '#dc262610',
                                            border: '1px solid #dc262640',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '8px',
                                        }}>
                                            <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, flexShrink: 0 }}>GUARD RAIL</span>
                                            <div style={{ fontSize: '0.6875rem', color: colors.textMuted, lineHeight: 1.5 }}>
                                                <div>
                                                    AI gốc: <span style={{ fontWeight: 700, color: '#dc2626' }}>{(aiAnalysis as any)._guardrail.originalVerdict}</span>
                                                    {' → '}
                                                    Sửa thành: <span style={{ fontWeight: 700, color: colors.success }}>{(aiAnalysis as any)._guardrail.finalVerdict}</span>
                                                </div>
                                                <div style={{ marginTop: '2px', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.625rem', color: colors.textSubtle }}>
                                                    {(aiAnalysis as any)._guardrail.overrideReason}
                                                </div>
                                                <div style={{ marginTop: '2px', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.5625rem', color: colors.textSubtle }}>
                                                    {(aiAnalysis as any)._guardrail.trendDetail}
                                                </div>
                                            </div>
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
                            {/* ═══ TỔNG HỢP CONTENT ═══ */}
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
                                                const avgCpp = campaign.totals.purchases > 0 ? totalSpend / campaign.totals.purchases : 0;
                                                const debugLines = ads.map((ad, i) => {
                                                    const ev = getContentScore(ad, totalSpend, avgCpp);
                                                    return [
                                                        `--- Content ${i + 1}: ${ad.name} ---`,
                                                        `Điểm: ${ev.score === -1 ? 'Ít data' : ev.score + '/10'} | FB chi: ${ev.spendShare.toFixed(1)}%`,
                                                        `Chi: ${formatMoney(ad.totals.spend)} | Thu: ${formatMoney(ad.totals.revenue)} | Đơn: ${ad.totals.purchases}`,
                                                        `CPP: ${formatMoney(ad.totals.cpp)} | CTR: ${ad.totals.ctr.toFixed(2)}%`,
                                                        `ROAS: ${ad.totals.revenue > 0 && ad.totals.spend > 0 ? (ad.totals.revenue / ad.totals.spend).toFixed(2) + 'x' : 'N/A'}`,
                                                        `Chi tiết: ${ev.tip}`,
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
                                            const avgCpp2 = campaign.totals.purchases > 0 ? campaign.totals.spend / campaign.totals.purchases : 0;
                                            const ev = getContentScore(ad, campaign.totals.spend, avgCpp2);
                                            return (
                                                <div key={ad.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    fontSize: '0.6875rem', color: colors.textMuted, lineHeight: 1.6,
                                                }}>
                                                    <span style={{ color: colors.textSubtle, width: '16px', textAlign: 'right' as const }}>{i + 1}</span>
                                                    <span style={{
                                                        fontSize: '0.5625rem', fontWeight: 700,
                                                        padding: '1px 5px', borderRadius: '3px',
                                                        background: `${ev.color}20`, color: ev.color,
                                                        minWidth: '36px', textAlign: 'center' as const,
                                                    }}>{ev.score === -1 ? '—' : ev.score}</span>
                                                    <span style={{ color: colors.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{ad.name}</span>
                                                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.625rem', color: colors.textSubtle }}>
                                                        FB:{ev.spendShare.toFixed(0)}% · CPP:{formatMoney(ad.totals.cpp)} · CTR:{ad.totals.ctr.toFixed(1)}%
                                                    </span>
                                                    {ev.tags?.includes('FB ĐỔ TIỀN MÙ') && (
                                                        <span style={{ fontSize: '0.5rem', fontWeight: 700, color: colors.error }}>⚠️ĐỔ MÙ</span>
                                                    )}
                                                    {ev.tags?.includes('CHERRY-PICKED') && (
                                                        <span style={{ fontSize: '0.5rem', fontWeight: 700, color: colors.warning }}>🍒CP</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

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
                                            const avgCpp = campaign.totals.purchases > 0 ? totalSpend / campaign.totals.purchases : 0;
                                            const debugLines = ads.map((ad, i) => {
                                                const ev = getContentScore(ad, totalSpend, avgCpp);
                                                return [
                                                    `--- Content ${i + 1}: ${ad.name} ---`,
                                                    `ID: ${ad.id} | Status: ${ad.status}`,
                                                    `Điểm: ${ev.score === -1 ? 'Ít data' : ev.score + '/10'} | FB chi: ${ev.spendShare.toFixed(1)}%`,
                                                    `Chi: ${formatMoney(ad.totals.spend)} | Thu: ${formatMoney(ad.totals.revenue)} | Đơn: ${ad.totals.purchases}`,
                                                    `CPP: ${formatMoney(ad.totals.cpp)} | CTR: ${ad.totals.ctr.toFixed(2)}%`,
                                                    `ROAS: ${ad.totals.revenue > 0 && ad.totals.spend > 0 ? (ad.totals.revenue / ad.totals.spend).toFixed(2) + 'x' : 'N/A'}`,
                                                    `Chi tiết: ${ev.tip}`,
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
                                const campaignAvgCpp = campaign.totals.purchases > 0 ? campaign.totals.spend / campaign.totals.purchases : 0;
                                const evaluation = getContentScore(ad, campaign.totals.spend, campaignAvgCpp);
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
                                            {/* Carousel: show all images */}
                                            {ad.thumbnails && ad.thumbnails.length > 1 ? (
                                                <div style={{
                                                    width: '160px',
                                                    height: '160px',
                                                    flexShrink: 0,
                                                    display: 'flex',
                                                    overflowX: 'auto',
                                                    scrollSnapType: 'x mandatory',
                                                    scrollbarWidth: 'none',
                                                    position: 'relative',
                                                }}>
                                                    {ad.thumbnails.map((img, i) => (
                                                        <img
                                                            key={i}
                                                            src={img}
                                                            alt={`${ad.name} - ${i + 1}`}
                                                            style={{
                                                                width: '160px',
                                                                height: '160px',
                                                                objectFit: 'cover',
                                                                flexShrink: 0,
                                                                scrollSnapAlign: 'start',
                                                                display: 'block',
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            ) : ad.thumbnail ? (
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
                                                    {/* Score + spend share + status */}
                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                                                        <span title={evaluation.tip} style={{
                                                            fontSize: '0.75rem', fontWeight: 800,
                                                            padding: '2px 8px', borderRadius: '4px',
                                                            background: `${evaluation.color}15`,
                                                            color: evaluation.color,
                                                            cursor: 'help',
                                                            fontFamily: '"JetBrains Mono", monospace',
                                                            letterSpacing: '-0.02em',
                                                        }}>
                                                            {evaluation.score === -1 ? '—' : evaluation.score + '/10'}
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
                                                        {evaluation.tags?.includes('FB ĐỔ TIỀN MÙ') && (
                                                            <span style={{
                                                                fontSize: '0.5625rem', fontWeight: 700,
                                                                padding: '1px 6px', borderRadius: '3px',
                                                                background: `${colors.error}20`,
                                                                color: colors.error,
                                                                letterSpacing: '0.03em',
                                                            }}>
                                                                FB ĐỔ TIỀN MÙ
                                                            </span>
                                                        )}
                                                        {evaluation.tags?.includes('CHERRY-PICKED') && (
                                                            <span style={{
                                                                fontSize: '0.5625rem', fontWeight: 700,
                                                                padding: '1px 6px', borderRadius: '3px',
                                                                background: `${colors.warning}20`,
                                                                color: colors.warning,
                                                                letterSpacing: '0.03em',
                                                            }}>
                                                                CHERRY-PICKED
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
