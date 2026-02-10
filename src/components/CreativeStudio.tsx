/**
 * ===================================================================
 * COMPONENT: CREATIVE STUDIO
 * ===================================================================
 * Panel overlay mở từ BảngThựcThi khi bước loại CREATIVE.
 * 2 tabs:
 *   1. CONTENT WIN — Top/bottom ads với metrics + thumbnail
 *   2. CREATIVE BRIEF — Winning patterns + brief từ AI
 * ===================================================================
 */

'use client';

import { useState, useCallback, useEffect } from 'react';

// ===================================================================
// TYPES
// ===================================================================

interface AdItem {
    ad_id: string;
    ad_name: string;
    caption: string;
    title?: string;
    cta?: string;
    content_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'UNKNOWN';
    image_url?: string;
    image_urls?: string[];
    metrics: {
        spend: number;
        purchases: number;
        revenue: number;
        cpp: number;
        roas: number;
        ctr: number;
        impressions: number;
        clicks: number;
    };
}

interface WinningPattern {
    category: string;
    pattern: string;
    evidence: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface CreativeBrief {
    summary: string;
    targetAudience: string;
    contentFormat: string;
    captionGuideline: string;
    captionExamples: string[];
    visualDirection: string;
    ctaRecommendation: string;
    doList: string[];
    dontList: string[];
    estimatedImpact: string;
}

interface IntelResult {
    winningPatterns: WinningPattern[];
    losingPatterns: WinningPattern[];
    creativeBrief: CreativeBrief;
    topAds: Array<{ name: string; cpp: number; roas: number; whyItWorks: string }>;
    bottomAds: Array<{ name: string; cpp: number; roas: number; whyItFails: string }>;
    overallHealth: string;
    refreshUrgency: string;
}

interface Props {
    campaignId: string;
    campaignName: string;
    startDate: string;
    endDate: string;
    onClose: () => void;
}

// ===================================================================
// COLORS
// ===================================================================

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

const formatMoney = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return Math.round(n).toLocaleString();
};

// ===================================================================
// COMPONENT
// ===================================================================

export default function CreativeStudio({ campaignId, campaignName, startDate, endDate, onClose }: Props) {
    const [activeTab, setActiveTab] = useState<'content_win' | 'brief'>('content_win');

    // Content Win data
    const [ads, setAds] = useState<AdItem[]>([]);
    const [loadingAds, setLoadingAds] = useState(false);
    const [adsError, setAdsError] = useState('');

    // Creative Brief data
    const [intel, setIntel] = useState<IntelResult | null>(null);
    const [loadingIntel, setLoadingIntel] = useState(false);
    const [intelError, setIntelError] = useState('');

    // ===== FETCH ADS DATA =====
    const fetchAds = useCallback(async () => {
        setLoadingAds(true);
        setAdsError('');
        try {
            const res = await fetch(
                `/api/analysis/campaign/${campaignId}/ads?startDate=${startDate}&endDate=${endDate}`
            );
            const json = await res.json();
            if (json.success && json.data) {
                // Sort by ROAS desc
                const sorted = [...json.data].sort((a: AdItem, b: AdItem) => b.metrics.roas - a.metrics.roas);
                setAds(sorted);
            } else {
                setAdsError(json.error || 'Không thể tải dữ liệu ads');
            }
        } catch (err) {
            setAdsError(err instanceof Error ? err.message : 'Lỗi kết nối');
        } finally {
            setLoadingAds(false);
        }
    }, [campaignId, startDate, endDate]);

    // ===== FETCH CREATIVE INTELLIGENCE =====
    const fetchIntel = useCallback(async () => {
        setLoadingIntel(true);
        setIntelError('');
        try {
            const res = await fetch(
                `/api/analysis/campaign/${campaignId}/creative-intel?startDate=${startDate}&endDate=${endDate}`
            );
            const json = await res.json();
            if (json.success && json.data) {
                setIntel(json.data);
                setActiveTab('brief');
            } else {
                setIntelError(json.error || 'Không thể phân tích creative');
            }
        } catch (err) {
            setIntelError(err instanceof Error ? err.message : 'Lỗi kết nối');
        } finally {
            setLoadingIntel(false);
        }
    }, [campaignId, startDate, endDate]);

    // Auto-fetch ads on mount
    useEffect(() => {
        fetchAds();
    }, [fetchAds]);

    // ===== RENDER HELPERS =====

    const renderAdCard = (ad: AdItem, rank: number, isTop: boolean) => (
        <div key={ad.ad_id} style={{
            display: 'flex', gap: '12px', padding: '12px',
            background: colors.bg, borderRadius: '6px',
            border: `1px solid ${isTop ? `${colors.accent}30` : `${colors.error}20`}`,
            marginBottom: '8px',
        }}>
            {/* Thumbnail */}
            {ad.image_url && (
                <div style={{
                    width: '64px', height: '64px', borderRadius: '4px', overflow: 'hidden',
                    flexShrink: 0, background: colors.bgAlt,
                }}>
                    <img
                        src={ad.image_url}
                        alt={ad.ad_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                </div>
            )}

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <p style={{
                        margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: colors.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: '200px',
                    }}>
                        #{rank} {ad.ad_name}
                    </p>
                    <span style={{
                        fontSize: '0.625rem', padding: '2px 5px', borderRadius: '3px',
                        background: `${isTop ? colors.accent : colors.error}15`,
                        color: isTop ? colors.accent : colors.error,
                        fontWeight: 700, flexShrink: 0,
                    }}>
                        {ad.content_type}
                    </span>
                </div>

                {/* Metrics row */}
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.6875rem', color: colors.textMuted }}>
                    <span>ROAS <b style={{ color: ad.metrics.roas >= 5 ? colors.accent : ad.metrics.roas >= 2 ? colors.text : colors.error }}>
                        {ad.metrics.roas.toFixed(1)}x
                    </b></span>
                    <span>CPP <b style={{ color: colors.text }}>{formatMoney(ad.metrics.cpp)}đ</b></span>
                    <span>CTR <b style={{ color: colors.text }}>{ad.metrics.ctr.toFixed(1)}%</b></span>
                    <span>{ad.metrics.purchases} đơn</span>
                </div>

                {/* Caption preview */}
                {ad.caption && (
                    <p style={{
                        margin: '4px 0 0', fontSize: '0.6875rem', color: colors.textSubtle,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        "{ad.caption.slice(0, 80)}..."
                    </p>
                )}
            </div>
        </div>
    );

    const renderPattern = (p: WinningPattern, idx: number, isWin: boolean) => (
        <div key={idx} style={{
            padding: '10px 12px', marginBottom: '6px', borderRadius: '4px',
            background: `${isWin ? colors.accent : colors.error}08`,
            borderLeft: `3px solid ${isWin ? colors.accent : colors.error}`,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.text }}>
                    {p.category}
                </span>
                <span style={{
                    fontSize: '0.5625rem', padding: '1px 5px', borderRadius: '2px',
                    background: p.impact === 'HIGH' ? `${colors.error}20` : p.impact === 'MEDIUM' ? `${colors.warning}20` : `${colors.textMuted}20`,
                    color: p.impact === 'HIGH' ? colors.error : p.impact === 'MEDIUM' ? colors.warning : colors.textMuted,
                    fontWeight: 700,
                }}>
                    {p.impact}
                </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: colors.text, lineHeight: 1.4 }}>{p.pattern}</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: colors.textMuted }}>{p.evidence}</p>
        </div>
    );

    // ===== MAIN RENDER =====
    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', top: 0, left: 0,
                    width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.4)', zIndex: 1100,
                }}
            />

            {/* Panel */}
            <div style={{
                position: 'fixed', top: 0, right: 0,
                width: '480px', height: '100vh',
                background: colors.bgCard, borderLeft: `1px solid ${colors.border}`,
                boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
                zIndex: 1101,
                display: 'flex', flexDirection: 'column' as const,
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div>
                        <h2 style={{
                            margin: '0 0 2px', fontSize: '0.875rem', fontWeight: 700,
                            color: colors.primary, letterSpacing: '0.05em',
                        }}>
                            CREATIVE STUDIO
                        </h2>
                        <p style={{ margin: 0, fontSize: '0.6875rem', color: colors.textMuted }}>
                            {campaignName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent', border: 'none',
                            color: colors.textMuted, cursor: 'pointer',
                            fontSize: '1.25rem', padding: '4px 8px',
                        }}
                    >×</button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex', borderBottom: `1px solid ${colors.border}`,
                }}>
                    {[
                        { id: 'content_win' as const, label: 'CONTENT WIN' },
                        { id: 'brief' as const, label: 'CREATIVE BRIEF' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: 1, padding: '10px', border: 'none',
                                background: 'transparent', cursor: 'pointer',
                                color: activeTab === tab.id ? colors.primary : colors.textMuted,
                                fontWeight: 700, fontSize: '0.6875rem',
                                borderBottom: activeTab === tab.id ? `2px solid ${colors.primary}` : '2px solid transparent',
                                letterSpacing: '0.05em',
                                transition: 'all 0.2s',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto' as const, padding: '16px 20px' }}>

                    {/* TAB 1: CONTENT WIN */}
                    {activeTab === 'content_win' && (
                        <div>
                            {loadingAds && (
                                <div style={{ textAlign: 'center', padding: '40px', color: colors.textMuted }}>
                                    <p style={{ fontSize: '0.8125rem' }}>Đang tải dữ liệu ads...</p>
                                </div>
                            )}

                            {adsError && (
                                <div style={{
                                    padding: '12px', borderRadius: '6px',
                                    background: `${colors.error}10`, border: `1px solid ${colors.error}30`,
                                    color: colors.error, fontSize: '0.8125rem',
                                }}>
                                    {adsError}
                                </div>
                            )}

                            {!loadingAds && ads.length > 0 && (
                                <>
                                    {/* Top ads */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <h3 style={{
                                            fontSize: '0.6875rem', fontWeight: 700, color: colors.accent,
                                            letterSpacing: '0.1em', margin: '0 0 10px',
                                        }}>
                                            ▲ TOP PERFORMER ({Math.min(5, ads.filter(a => a.metrics.purchases > 0).length)})
                                        </h3>
                                        {ads
                                            .filter(a => a.metrics.purchases > 0)
                                            .slice(0, 5)
                                            .map((ad, i) => renderAdCard(ad, i + 1, true))
                                        }
                                    </div>

                                    {/* Bottom ads */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <h3 style={{
                                            fontSize: '0.6875rem', fontWeight: 700, color: colors.error,
                                            letterSpacing: '0.1em', margin: '0 0 10px',
                                        }}>
                                            ▼ UNDER PERFORMER
                                        </h3>
                                        {ads
                                            .filter(a => a.metrics.spend > 50000)
                                            .slice(-3)
                                            .reverse()
                                            .map((ad, i) => renderAdCard(ad, i + 1, false))
                                        }
                                    </div>

                                    {/* Analyze button */}
                                    <button
                                        onClick={fetchIntel}
                                        disabled={loadingIntel}
                                        style={{
                                            width: '100%', padding: '12px', marginTop: '8px',
                                            background: loadingIntel ? colors.bgAlt : colors.primary,
                                            border: 'none', borderRadius: '6px',
                                            color: loadingIntel ? colors.textMuted : '#000',
                                            fontSize: '0.8125rem', fontWeight: 700,
                                            cursor: loadingIntel ? 'not-allowed' : 'pointer',
                                            letterSpacing: '0.05em',
                                        }}
                                    >
                                        {loadingIntel ? 'ĐANG PHÂN TÍCH...' : 'PHÂN TÍCH SÂU → TẠO BRIEF'}
                                    </button>
                                    {intelError && (
                                        <p style={{ color: colors.error, fontSize: '0.75rem', marginTop: '8px' }}>
                                            {intelError}
                                        </p>
                                    )}
                                </>
                            )}

                            {!loadingAds && ads.length === 0 && !adsError && (
                                <div style={{ textAlign: 'center', padding: '40px', color: colors.textMuted }}>
                                    <p style={{ fontSize: '0.8125rem' }}>Không tìm thấy ads cho campaign này</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: CREATIVE BRIEF */}
                    {activeTab === 'brief' && (
                        <div>
                            {!intel && !loadingIntel && (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <p style={{ color: colors.textMuted, fontSize: '0.8125rem', marginBottom: '16px' }}>
                                        Chưa có dữ liệu. Hãy phân tích trước.
                                    </p>
                                    <button
                                        onClick={() => { setActiveTab('content_win'); fetchIntel(); }}
                                        style={{
                                            padding: '10px 24px', background: colors.primary,
                                            border: 'none', borderRadius: '6px',
                                            color: '#000', fontWeight: 700, fontSize: '0.8125rem',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        PHÂN TÍCH NGAY
                                    </button>
                                </div>
                            )}

                            {loadingIntel && (
                                <div style={{ textAlign: 'center', padding: '40px', color: colors.textMuted }}>
                                    <p style={{ fontSize: '0.8125rem' }}>AI đang phân tích creative...</p>
                                    <p style={{ fontSize: '0.6875rem' }}>Có thể mất 15-30 giây</p>
                                </div>
                            )}

                            {intel && (
                                <div>
                                    {/* Overall Health */}
                                    <div style={{
                                        padding: '12px 16px', marginBottom: '16px', borderRadius: '6px',
                                        background: intel.overallHealth === 'EXCELLENT' ? `${colors.accent}10` :
                                            intel.overallHealth === 'GOOD' ? `${colors.accent}08` :
                                                intel.overallHealth === 'NEEDS_REFRESH' ? `${colors.warning}10` : `${colors.error}10`,
                                        border: `1px solid ${intel.overallHealth === 'EXCELLENT' || intel.overallHealth === 'GOOD' ? colors.accent : intel.overallHealth === 'NEEDS_REFRESH' ? colors.warning : colors.error}30`,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: colors.textMuted, letterSpacing: '0.1em' }}>
                                                CREATIVE HEALTH
                                            </span>
                                            <span style={{
                                                fontSize: '0.75rem', fontWeight: 700,
                                                color: intel.overallHealth === 'EXCELLENT' || intel.overallHealth === 'GOOD' ? colors.accent :
                                                    intel.overallHealth === 'NEEDS_REFRESH' ? colors.warning : colors.error,
                                            }}>
                                                {intel.overallHealth}
                                            </span>
                                        </div>
                                        <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: colors.text }}>
                                            {intel.refreshUrgency}
                                        </p>
                                    </div>

                                    {/* Winning Patterns */}
                                    {intel.winningPatterns.length > 0 && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <h3 style={{ fontSize: '0.6875rem', fontWeight: 700, color: colors.accent, letterSpacing: '0.1em', margin: '0 0 8px' }}>
                                                ✓ WINNING PATTERNS
                                            </h3>
                                            {intel.winningPatterns.map((p, i) => renderPattern(p, i, true))}
                                        </div>
                                    )}

                                    {/* Losing Patterns */}
                                    {intel.losingPatterns.length > 0 && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <h3 style={{ fontSize: '0.6875rem', fontWeight: 700, color: colors.error, letterSpacing: '0.1em', margin: '0 0 8px' }}>
                                                ✕ LOSING PATTERNS
                                            </h3>
                                            {intel.losingPatterns.map((p, i) => renderPattern(p, i, false))}
                                        </div>
                                    )}

                                    {/* Creative Brief */}
                                    <div style={{
                                        padding: '16px', borderRadius: '6px',
                                        background: colors.bg, border: `1px solid ${colors.primary}30`,
                                        marginBottom: '16px',
                                    }}>
                                        <h3 style={{
                                            fontSize: '0.6875rem', fontWeight: 700, color: colors.primary,
                                            letterSpacing: '0.1em', margin: '0 0 12px',
                                        }}>
                                            CREATIVE BRIEF
                                        </h3>

                                        <p style={{ fontSize: '0.8125rem', color: colors.text, lineHeight: 1.5, margin: '0 0 12px' }}>
                                            {intel.creativeBrief.summary}
                                        </p>

                                        {/* Format + Audience */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                                            <div style={{ padding: '8px', background: colors.bgAlt, borderRadius: '4px' }}>
                                                <span style={{ fontSize: '0.5625rem', color: colors.textMuted, fontWeight: 700 }}>FORMAT</span>
                                                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: colors.text }}>{intel.creativeBrief.contentFormat}</p>
                                            </div>
                                            <div style={{ padding: '8px', background: colors.bgAlt, borderRadius: '4px' }}>
                                                <span style={{ fontSize: '0.5625rem', color: colors.textMuted, fontWeight: 700 }}>CTA</span>
                                                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: colors.text }}>{intel.creativeBrief.ctaRecommendation}</p>
                                            </div>
                                        </div>

                                        {/* Caption Guideline */}
                                        <div style={{ marginBottom: '12px' }}>
                                            <span style={{ fontSize: '0.5625rem', color: colors.textMuted, fontWeight: 700, letterSpacing: '0.1em' }}>CAPTION GUIDELINE</span>
                                            <p style={{ margin: '4px 0', fontSize: '0.75rem', color: colors.text, lineHeight: 1.5 }}>
                                                {intel.creativeBrief.captionGuideline}
                                            </p>
                                        </div>

                                        {/* Caption Examples */}
                                        {intel.creativeBrief.captionExamples.length > 0 && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <span style={{ fontSize: '0.5625rem', color: colors.textMuted, fontWeight: 700, letterSpacing: '0.1em' }}>CAPTION MẪU</span>
                                                {intel.creativeBrief.captionExamples.map((ex, i) => (
                                                    <div key={i} style={{
                                                        padding: '8px 10px', marginTop: '6px',
                                                        background: colors.bgAlt, borderRadius: '4px',
                                                        fontSize: '0.75rem', color: colors.text,
                                                        borderLeft: `2px solid ${colors.primary}`,
                                                        lineHeight: 1.4,
                                                    }}>
                                                        {ex}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Visual Direction */}
                                        <div style={{ marginBottom: '12px' }}>
                                            <span style={{ fontSize: '0.5625rem', color: colors.textMuted, fontWeight: 700, letterSpacing: '0.1em' }}>VISUAL DIRECTION</span>
                                            <p style={{ margin: '4px 0', fontSize: '0.75rem', color: colors.text, lineHeight: 1.5 }}>
                                                {intel.creativeBrief.visualDirection}
                                            </p>
                                        </div>

                                        {/* Do / Don't */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <div>
                                                <span style={{ fontSize: '0.5625rem', color: colors.accent, fontWeight: 700 }}>NÊN LÀM</span>
                                                {intel.creativeBrief.doList.map((item, i) => (
                                                    <p key={i} style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: colors.text }}>✓ {item}</p>
                                                ))}
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '0.5625rem', color: colors.error, fontWeight: 700 }}>KHÔNG NÊN</span>
                                                {intel.creativeBrief.dontList.map((item, i) => (
                                                    <p key={i} style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: colors.text }}>✕ {item}</p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Top Ad Analysis */}
                                    {intel.topAds.length > 0 && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <h3 style={{ fontSize: '0.6875rem', fontWeight: 700, color: colors.accent, letterSpacing: '0.1em', margin: '0 0 8px' }}>
                                                TẠI SAO ADS NÀY WIN?
                                            </h3>
                                            {intel.topAds.map((ad, i) => (
                                                <div key={i} style={{
                                                    padding: '10px 12px', marginBottom: '6px',
                                                    background: `${colors.accent}08`, borderRadius: '4px',
                                                    borderLeft: `3px solid ${colors.accent}`,
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.text }}>{ad.name}</span>
                                                        <span style={{ fontSize: '0.6875rem', color: colors.accent }}>ROAS {ad.roas.toFixed(1)}x</span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: '0.6875rem', color: colors.textMuted }}>{ad.whyItWorks}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Estimated Impact */}
                                    <div style={{
                                        padding: '12px 16px', borderRadius: '6px',
                                        background: `${colors.accent}08`, border: `1px solid ${colors.accent}20`,
                                    }}>
                                        <span style={{ fontSize: '0.5625rem', color: colors.accent, fontWeight: 700, letterSpacing: '0.1em' }}>
                                            KẾT QUẢ KỲ VỌNG
                                        </span>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: colors.text, lineHeight: 1.4 }}>
                                            {intel.creativeBrief.estimatedImpact}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
