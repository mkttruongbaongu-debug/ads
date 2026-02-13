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
    const [activeTab, setActiveTab] = useState<'content_win' | 'brief' | 'output'>('content_win');

    // Content Win data
    const [ads, setAds] = useState<AdItem[]>([]);
    const [loadingAds, setLoadingAds] = useState(false);
    const [adsError, setAdsError] = useState('');

    // Creative Brief data
    const [intel, setIntel] = useState<IntelResult | null>(null);
    const [loadingIntel, setLoadingIntel] = useState(false);
    const [intelError, setIntelError] = useState('');

    // Generated Output data
    const [generatedCaption, setGeneratedCaption] = useState('');
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [generatedKeyMessage, setGeneratedKeyMessage] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState('');
    const [generateStep, setGenerateStep] = useState('');  // progress indicator
    const [copiedCaption, setCopiedCaption] = useState(false);
    const [generatedImagePrompts, setGeneratedImagePrompts] = useState<string[]>([]);
    const [generatedCaptionPrompt, setGeneratedCaptionPrompt] = useState('');
    const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
    const [showPromptTrace, setShowPromptTrace] = useState(false);

    // Publish to Facebook
    const [adSets, setAdSets] = useState<{ id: string; name: string; status: string }[]>([]);
    const [selectedAdSet, setSelectedAdSet] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishResult, setPublishResult] = useState<{ success: boolean; message: string; adId?: string } | null>(null);
    const [publishStep, setPublishStep] = useState('');
    const [adSetLoading, setAdSetLoading] = useState(false);
    const [adSetError, setAdSetError] = useState('');

    // Generation mode
    const [genMode, setGenMode] = useState<'clone' | 'inspired' | 'fresh'>('inspired');
    const [selectedRefAdIdx, setSelectedRefAdIdx] = useState(0); // Index of ad to use as reference

    // Product filter
    const [detectedProducts, setDetectedProducts] = useState<string[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<string>(''); // '' = all

    // Debug
    const [showDebug, setShowDebug] = useState(false);

    // ===== PRODUCT DETECTION =====
    // Detect products by finding distinctive multi-word phrases in captions
    const detectProducts = useCallback((adList: AdItem[]): string[] => {
        if (adList.length < 3) return [];

        // Build 2-4 word n-gram frequency from captions
        const phraseAdMap = new Map<string, Set<number>>();

        adList.forEach((ad, idx) => {
            const text = (ad.ad_name + ' ' + (ad.caption || '')).toLowerCase()
                .normalize('NFC')
                .replace(/[,.!?;:(){}\[\]"'—–\-\/\\@#$%^&*…\n\r]/g, ' ');
            const words = text.split(/\s+/).filter(w => w.length > 1);

            for (let len = 2; len <= 4; len++) {
                for (let j = 0; j <= words.length - len; j++) {
                    const phrase = words.slice(j, j + len).join(' ');
                    if (phrase.length < 5) continue; // skip very short
                    if (!phraseAdMap.has(phrase)) phraseAdMap.set(phrase, new Set());
                    phraseAdMap.get(phrase)!.add(idx);
                }
            }
        });

        // Find discriminative phrases: in 20-70% of ads (not too common, not too rare)
        const minAds = Math.max(2, Math.floor(adList.length * 0.15));
        const maxAds = Math.floor(adList.length * 0.75);

        const candidates = Array.from(phraseAdMap.entries())
            .filter(([phrase, adSet]) => {
                const count = adSet.size;
                if (count < minAds || count > maxAds) return false;
                // Filter out common Vietnamese stop-phrases
                const stopWords = ['của', 'và', 'cho', 'với', 'này', 'cái', 'một', 'nhà', 'thì', 'mà', 'là', 'có'];
                const phraseWords = phrase.split(' ');
                if (phraseWords.every(w => stopWords.includes(w) || w.length <= 2)) return false;
                return true;
            })
            .sort((a, b) => {
                // Prefer longer phrases (more specific)
                const lenDiff = b[0].split(' ').length - a[0].split(' ').length;
                if (lenDiff !== 0) return lenDiff;
                // Then by frequency
                return b[1].size - a[1].size;
            });

        // Greedy clustering: pick top phrases that cover non-overlapping ad sets
        const usedAds = new Set<number>();
        const products: string[] = [];

        for (const [phrase, adSet] of candidates) {
            // Skip if most ads in this phrase are already covered
            const newAds = Array.from(adSet).filter(i => !usedAds.has(i));
            if (newAds.length < minAds) continue;

            // Capitalize first letter of each word
            const name = phrase.replace(/\b\w/g, c => c.toUpperCase());
            products.push(name);
            adSet.forEach(i => usedAds.add(i));

            if (products.length >= 5) break; // max 5 products
        }

        return products;
    }, []);

    // Compute filtered ads based on selected product
    const filteredAds = selectedProduct
        ? ads.filter(a => {
            const text = (a.ad_name + ' ' + (a.caption || '')).toLowerCase();
            return text.includes(selectedProduct.toLowerCase());
        })
        : ads;

    // ===== FETCH ADS DATA =====
    const fetchAds = useCallback(async () => {
        setLoadingAds(true);
        setAdsError('');
        try {
            const res = await fetch(
                `/api/analysis/campaign/${campaignId}/ads?startDate=${startDate}&endDate=${endDate}`
            );
            const json = await res.json();
            if (json.success && json.data?.ads) {
                // Map API response fields to AdItem interface
                const mapped: AdItem[] = json.data.ads.map((ad: any) => ({
                    ad_id: ad.id,
                    ad_name: ad.name,
                    caption: ad.message || '',
                    content_type: ad.thumbnails?.length > 1 ? 'CAROUSEL' : (ad.videoUrl ? 'VIDEO' : (ad.thumbnail ? 'IMAGE' : 'UNKNOWN')),
                    image_url: ad.thumbnail || '',
                    image_urls: ad.thumbnails?.length > 0 ? ad.thumbnails : (ad.thumbnail ? [ad.thumbnail] : []),
                    metrics: {
                        spend: ad.totals?.spend || 0,
                        purchases: ad.totals?.purchases || 0,
                        revenue: ad.totals?.revenue || 0,
                        cpp: ad.totals?.cpp || 0,
                        roas: ad.totals?.roas || 0,
                        ctr: ad.totals?.ctr || 0,
                        impressions: ad.totals?.impressions || 0,
                        clicks: ad.totals?.clicks || 0,
                    },
                }));
                // Sort by ROAS desc
                mapped.sort((a, b) => b.metrics.roas - a.metrics.roas);
                setAds(mapped);
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
            const productParam = selectedProduct ? `&product=${encodeURIComponent(selectedProduct)}` : '';
            const res = await fetch(
                `/api/analysis/campaign/${campaignId}/creative-intel?startDate=${startDate}&endDate=${endDate}${productParam}`
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
    }, [campaignId, startDate, endDate, selectedProduct]);

    // Auto-fetch ads on mount + detect products when ads change
    useEffect(() => {
        fetchAds();
    }, [fetchAds]);

    useEffect(() => {
        if (ads.length > 0) {
            const products = detectProducts(ads);
            setDetectedProducts(products);
        }
    }, [ads, detectProducts]);

    // ===== FETCH AD SETS =====
    const fetchAdSets = useCallback(async () => {
        if (!campaignId) return;
        setAdSetLoading(true);
        setAdSetError('');
        try {
            const today = new Date();
            const ed = today.toISOString().split('T')[0];
            const sd = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            console.log(`[CREATIVE_STUDIO] Fetching adsets for campaign ${campaignId}...`);
            const res = await fetch(`/api/facebook/campaign/${campaignId}/adsets?startDate=${sd}&endDate=${ed}`);
            const json = await res.json();
            console.log('[CREATIVE_STUDIO] Adsets response:', json);
            if (json.success && json.data) {
                setAdSets(json.data.map((a: any) => ({ id: a.id, name: a.name, status: a.status })));
                if (json.data.length > 0) {
                    const active = json.data.find((a: any) => a.status === 'ACTIVE');
                    if (active) setSelectedAdSet(active.id);
                    else setSelectedAdSet(json.data[0].id);
                } else {
                    setAdSetError('Campaign không có ad set nào');
                }
            } else {
                setAdSetError(json.error || 'Không tải được ad sets');
            }
        } catch (err) {
            console.error('Failed to fetch adsets:', err);
            setAdSetError(err instanceof Error ? err.message : 'Lỗi kết nối');
        } finally {
            setAdSetLoading(false);
        }
    }, [campaignId]);

    // Auto-fetch adsets when creative is generated
    useEffect(() => {
        if (generatedCaption && adSets.length === 0) {
            fetchAdSets();
        }
    }, [generatedCaption, fetchAdSets]); // eslint-disable-line react-hooks/exhaustive-deps
    // ===== GENERATE CREATIVE (Caption + Images) — STREAMING =====
    const generateCreative = useCallback(async () => {
        if (!intel) return;
        setIsGenerating(true);
        setGenerateError('');
        setGenerateStep('Đang kết nối...');
        setGeneratedCaption('');
        setGeneratedImages([]);
        setGeneratedKeyMessage('');
        setGeneratedImagePrompts([]);
        setGeneratedCaptionPrompt('');
        setReferenceImageUrls([]);

        try {
            // Build reference URLs based on generation mode
            let topAdImageUrls: string[] = [];
            if (genMode === 'clone') {
                const topAdsWithPurchases = filteredAds.filter(a => a.metrics.purchases > 0);
                const refAd = topAdsWithPurchases[selectedRefAdIdx] || topAdsWithPurchases[0];
                topAdImageUrls = refAd?.image_urls?.length
                    ? refAd.image_urls
                    : [refAd?.image_url].filter(Boolean) as string[];
            } else if (genMode === 'inspired') {
                const top3 = filteredAds.filter(a => a.metrics.purchases > 0).slice(0, 3);
                topAdImageUrls = top3.flatMap(a => a.image_urls?.length ? a.image_urls.slice(0, 2) : [a.image_url]).filter(Boolean) as string[];
            }

            let winnerCaption = '';
            if (genMode === 'clone') {
                const topAdsWithPurchases = filteredAds.filter(a => a.metrics.purchases > 0);
                const refAd = topAdsWithPurchases[selectedRefAdIdx] || topAdsWithPurchases[0];
                winnerCaption = refAd?.caption || '';
            }

            console.log('[CREATIVE_STUDIO] Sending request:', {
                genMode,
                topAdImageUrls: topAdImageUrls.map((u: string) => u.substring(0, 80) + '...'),
                winnerCaptionLen: winnerCaption.length,
            });

            const res = await fetch(
                `/api/analysis/campaign/${campaignId}/generate-creative`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        genMode,
                        winnerCaption,
                        creativeBrief: intel.creativeBrief,
                        winningPatterns: intel.winningPatterns,
                        topAds: intel.topAds,
                        campaignName,
                        topAdImageUrls,
                    }),
                }
            );

            if (!res.ok || !res.body) {
                // Fallback: try reading as JSON error
                try {
                    const errorJson = await res.json();
                    setGenerateError(errorJson.error || `HTTP ${res.status}`);
                } catch {
                    setGenerateError(`Lỗi server: HTTP ${res.status}`);
                }
                return;
            }

            // Read NDJSON stream
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            const collectedImages: string[] = [];
            let switchedToOutput = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // keep incomplete line in buffer

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);

                        if (event.type === 'step') {
                            setGenerateStep(event.message || '');
                        } else if (event.type === 'caption') {
                            console.log('[CREATIVE_STUDIO] Caption received:', {
                                captionLen: event.data.caption?.length,
                                imageCount: event.data.imageCount,
                                promptCount: event.data.imagePrompts?.length,
                                refUrls: event.data.referenceImageUrls,
                            });
                            setGeneratedCaption(event.data.caption || '');
                            setGeneratedKeyMessage(event.data.keyMessage || '');
                            setGeneratedImagePrompts(event.data.imagePrompts || []);
                            setGeneratedCaptionPrompt(event.data.captionPrompt || '');
                            setReferenceImageUrls(event.data.referenceImageUrls || []);
                            // Switch to OUTPUT tab immediately when caption arrives
                            if (!switchedToOutput) {
                                setActiveTab('output');
                                switchedToOutput = true;
                            }
                        } else if (event.type === 'image') {
                            console.log(`[CREATIVE_STUDIO] Image ${event.index + 1}/${event.total}:`, event.data ? `OK (${event.data.substring(0, 50)}...)` : 'FAILED (null)');
                            if (event.data) {
                                collectedImages.push(event.data);
                                setGeneratedImages([...collectedImages]);
                            }
                        } else if (event.type === 'debug') {
                            console.log('[CREATIVE_STUDIO] 🔍 DEBUG:', event.message);
                        } else if (event.type === 'error') {
                            console.error('[CREATIVE_STUDIO] ❌ Error:', event.error);
                            setGenerateError(event.error || 'Lỗi không xác định');
                        }
                    } catch {
                        // Skip malformed JSON lines
                    }
                }
            }

        } catch (err) {
            setGenerateError(err instanceof Error ? err.message : 'Lỗi kết nối');
        } finally {
            setIsGenerating(false);
            setGenerateStep('');
        }
    }, [intel, filteredAds, campaignId, campaignName, genMode, selectedRefAdIdx]);

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
                        { id: 'output' as const, label: 'OUTPUT' },
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
                                    {/* Product Filter */}
                                    {detectedProducts.length > 0 && (
                                        <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: `1px solid ${colors.border}` }}>
                                            <span style={{
                                                fontSize: '0.5625rem', fontWeight: 700, color: colors.textMuted,
                                                letterSpacing: '0.1em', display: 'block', marginBottom: '8px',
                                            }}>
                                                LỌC THEO SẢN PHẨM
                                            </span>
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                                                <button
                                                    onClick={() => { setSelectedProduct(''); setSelectedRefAdIdx(0); }}
                                                    style={{
                                                        padding: '5px 10px', fontSize: '0.6875rem', fontWeight: 600,
                                                        background: !selectedProduct ? `${colors.primary}20` : 'transparent',
                                                        border: `1px solid ${!selectedProduct ? colors.primary : colors.border}`,
                                                        borderRadius: '4px', cursor: 'pointer',
                                                        color: !selectedProduct ? colors.primary : colors.textMuted,
                                                    }}
                                                >
                                                    TẤT CẢ ({ads.length})
                                                </button>
                                                {detectedProducts.map(product => {
                                                    const count = ads.filter(a => (a.ad_name + ' ' + (a.caption || '')).toLowerCase().includes(product.toLowerCase())).length;
                                                    const isActive = selectedProduct.toLowerCase() === product.toLowerCase();
                                                    return (
                                                        <button
                                                            key={product}
                                                            onClick={() => { setSelectedProduct(isActive ? '' : product); setSelectedRefAdIdx(0); }}
                                                            style={{
                                                                padding: '5px 10px', fontSize: '0.6875rem', fontWeight: 600,
                                                                background: isActive ? `${colors.accent}20` : 'transparent',
                                                                border: `1px solid ${isActive ? colors.accent : colors.border}`,
                                                                borderRadius: '4px', cursor: 'pointer',
                                                                color: isActive ? colors.accent : colors.textMuted,
                                                            }}
                                                        >
                                                            {product} ({count})
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {/* Manual input */}
                                            <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <input
                                                    type="text"
                                                    placeholder="Hoặc nhập tên sản phẩm..."
                                                    value={detectedProducts.some(p => p.toLowerCase() === selectedProduct.toLowerCase()) ? '' : selectedProduct}
                                                    onChange={(e) => { setSelectedProduct(e.target.value); setSelectedRefAdIdx(0); }}
                                                    style={{
                                                        flex: 1, padding: '5px 8px', fontSize: '0.6875rem',
                                                        background: colors.bg, border: `1px solid ${colors.border}`,
                                                        borderRadius: '4px', color: colors.text, outline: 'none',
                                                    }}
                                                />
                                                {selectedProduct && (
                                                    <span style={{ fontSize: '0.625rem', color: colors.textMuted }}>
                                                        {filteredAds.length} ads
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Top ads */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <h3 style={{
                                            fontSize: '0.6875rem', fontWeight: 700, color: colors.accent,
                                            letterSpacing: '0.1em', margin: '0 0 10px',
                                        }}>
                                            ▲ TOP PERFORMER ({Math.min(5, filteredAds.filter(a => a.metrics.purchases > 0).length)})
                                        </h3>
                                        {filteredAds
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
                                        {filteredAds
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

                                    {/* Debug button */}
                                    <button
                                        onClick={() => setShowDebug(!showDebug)}
                                        style={{
                                            width: '100%', padding: '8px', marginTop: '10px',
                                            background: 'transparent',
                                            border: `1px dashed ${colors.border}`,
                                            borderRadius: '4px',
                                            color: colors.textSubtle, fontSize: '0.625rem',
                                            fontWeight: 600, cursor: 'pointer',
                                            letterSpacing: '0.05em',
                                        }}
                                    >
                                        {showDebug ? '▲ ẨN DEBUG' : '▼ DEBUG: XEM RAW DATA'}
                                    </button>

                                    {showDebug && (
                                        <div style={{
                                            marginTop: '10px', padding: '12px',
                                            background: '#0a0c0f',
                                            border: `1px solid ${colors.border}`,
                                            borderRadius: '6px',
                                            fontSize: '0.625rem', fontFamily: '"JetBrains Mono", monospace',
                                            color: colors.textMuted, lineHeight: 1.5,
                                            maxHeight: '400px', overflowY: 'auto' as const,
                                        }}>
                                            <div style={{ marginBottom: '10px' }}>
                                                <span style={{ color: colors.accent, fontWeight: 700 }}>LOGIC PHÂN LOẠI:</span>
                                                <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap' as const, color: colors.text }}>
                                                    {`Sắp xếp: ROAS giảm dần
TOP PERFORMER: purchases > 0, lấy 5 đầu
UNDER PERFORMER: spend > 50.000đ, lấy 3 cuối, đảo ngược
Tổng ads: ${ads.length}`}
                                                </pre>
                                            </div>

                                            <div style={{ marginBottom: '10px' }}>
                                                <span style={{ color: colors.accent, fontWeight: 700 }}>▲ TOP PERFORMER ({ads.filter(a => a.metrics.purchases > 0).slice(0, 5).length}):</span>
                                                <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap' as const, color: '#4ade80' }}>
                                                    {JSON.stringify(
                                                        ads.filter(a => a.metrics.purchases > 0).slice(0, 5).map((a, i) => ({
                                                            [`#${i + 1}`]: a.ad_name,
                                                            roas: `${a.metrics.roas.toFixed(1)}x`,
                                                            cpp: `${formatMoney(a.metrics.cpp)}`,
                                                            ctr: `${a.metrics.ctr.toFixed(1)}%`,
                                                            purchases: a.metrics.purchases,
                                                            spend: formatMoney(a.metrics.spend),
                                                            caption: a.caption?.substring(0, 60) + '...',
                                                            image: a.image_url ? 'YES' : 'NO',
                                                        })),
                                                        null, 2
                                                    )}
                                                </pre>
                                            </div>

                                            <div style={{ marginBottom: '10px' }}>
                                                <span style={{ color: colors.error, fontWeight: 700 }}>▼ UNDER PERFORMER ({ads.filter(a => a.metrics.spend > 50000).slice(-3).length}):</span>
                                                <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap' as const, color: '#f87171' }}>
                                                    {JSON.stringify(
                                                        ads.filter(a => a.metrics.spend > 50000).slice(-3).reverse().map((a, i) => ({
                                                            [`#${i + 1}`]: a.ad_name,
                                                            roas: `${a.metrics.roas.toFixed(1)}x`,
                                                            cpp: `${formatMoney(a.metrics.cpp)}`,
                                                            ctr: `${a.metrics.ctr.toFixed(1)}%`,
                                                            purchases: a.metrics.purchases,
                                                            spend: formatMoney(a.metrics.spend),
                                                            caption: a.caption?.substring(0, 60) + '...',
                                                        })),
                                                        null, 2
                                                    )}
                                                </pre>
                                            </div>

                                            <div>
                                                <span style={{ color: colors.warning, fontWeight: 700 }}>ALL ADS (sorted by ROAS):</span>
                                                <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap' as const, color: colors.text }}>
                                                    {JSON.stringify(
                                                        ads.map((a, i) => ({
                                                            i: i + 1,
                                                            name: a.ad_name,
                                                            roas: a.metrics.roas.toFixed(1),
                                                            cpp: Math.round(a.metrics.cpp),
                                                            ctr: a.metrics.ctr.toFixed(1),
                                                            purchases: a.metrics.purchases,
                                                            spend: Math.round(a.metrics.spend),
                                                        })),
                                                        null, 2
                                                    )}
                                                </pre>
                                            </div>
                                        </div>
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

                                    {/* Debug toggle for CREATIVE BRIEF */}
                                    <button
                                        onClick={() => setShowDebug(!showDebug)}
                                        style={{
                                            width: '100%', padding: '8px', marginTop: '12px', marginBottom: '4px',
                                            background: 'transparent',
                                            border: `1px dashed ${colors.border}`,
                                            borderRadius: '4px',
                                            color: colors.textSubtle, fontSize: '0.625rem',
                                            fontWeight: 600, cursor: 'pointer',
                                            letterSpacing: '0.05em',
                                        }}
                                    >
                                        {showDebug ? '▲ ẨN DEBUG' : '▼ DEBUG: XEM RAW INTEL DATA'}
                                    </button>

                                    {showDebug && (
                                        <div style={{
                                            marginTop: '8px', padding: '12px',
                                            background: '#0a0c0f',
                                            border: `1px solid ${colors.border}`,
                                            borderRadius: '6px',
                                            fontSize: '0.625rem', fontFamily: '"JetBrains Mono", monospace',
                                            color: colors.textMuted, lineHeight: 1.5,
                                            maxHeight: '500px', overflowY: 'auto' as const,
                                        }}>
                                            <div style={{ marginBottom: '10px' }}>
                                                <span style={{ color: colors.accent, fontWeight: 700 }}>WINNING PATTERNS ({intel.winningPatterns.length}):</span>
                                                <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap' as const, color: '#4ade80' }}>
                                                    {JSON.stringify(intel.winningPatterns, null, 2)}
                                                </pre>
                                            </div>
                                            <div style={{ marginBottom: '10px' }}>
                                                <span style={{ color: colors.error, fontWeight: 700 }}>LOSING PATTERNS ({intel.losingPatterns.length}):</span>
                                                <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap' as const, color: '#f87171' }}>
                                                    {JSON.stringify(intel.losingPatterns, null, 2)}
                                                </pre>
                                            </div>
                                            <div style={{ marginBottom: '10px' }}>
                                                <span style={{ color: colors.accent, fontWeight: 700 }}>TOP ADS:</span>
                                                <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap' as const, color: '#4ade80' }}>
                                                    {JSON.stringify(intel.topAds, null, 2)}
                                                </pre>
                                            </div>
                                            <div style={{ marginBottom: '10px' }}>
                                                <span style={{ color: colors.error, fontWeight: 700 }}>BOTTOM ADS:</span>
                                                <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap' as const, color: '#f87171' }}>
                                                    {JSON.stringify(intel.bottomAds, null, 2)}
                                                </pre>
                                            </div>
                                            <div style={{ marginBottom: '10px' }}>
                                                <span style={{ color: colors.warning, fontWeight: 700 }}>CREATIVE BRIEF:</span>
                                                <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap' as const, color: colors.text }}>
                                                    {JSON.stringify(intel.creativeBrief, null, 2)}
                                                </pre>
                                            </div>
                                            <div>
                                                <span style={{ color: colors.primary, fontWeight: 700 }}>HEALTH + URGENCY:</span>
                                                <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap' as const, color: colors.text }}>
                                                    {JSON.stringify({ overallHealth: intel.overallHealth, refreshUrgency: intel.refreshUrgency }, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}

                                    {/* ═══ GENERATION MODE ═══ */}
                                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: `1px solid ${colors.border}` }}>
                                        <span style={{ fontSize: '0.5625rem', color: colors.textMuted, fontWeight: 700, letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>
                                            CHẾ ĐỘ TẠO ẢNH
                                        </span>
                                        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                                            {([
                                                { id: 'clone' as const, label: 'NHÂN BẢN', desc: 'Clone 1:1 từ ad mẫu' },
                                                { id: 'inspired' as const, label: 'CẢM HỨNG', desc: 'Mix từ top 3 ads' },
                                                { id: 'fresh' as const, label: 'MỚI HOÀN TOÀN', desc: 'Chỉ dùng brief' },
                                            ]).map(mode => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => setGenMode(mode.id)}
                                                    style={{
                                                        flex: 1, padding: '8px 6px',
                                                        background: genMode === mode.id ? `${colors.primary}15` : colors.bg,
                                                        border: `1px solid ${genMode === mode.id ? colors.primary : colors.border}`,
                                                        borderRadius: '6px', cursor: 'pointer',
                                                        textAlign: 'center' as const,
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    <div style={{
                                                        fontSize: '0.5625rem', fontWeight: 700,
                                                        color: genMode === mode.id ? colors.primary : colors.text,
                                                        letterSpacing: '0.05em',
                                                    }}>{mode.label}</div>
                                                    <div style={{ fontSize: '0.5rem', color: colors.textMuted, marginTop: '1px' }}>
                                                        {mode.desc}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Ad selector — only for clone mode */}
                                        {genMode === 'clone' && filteredAds.filter(a => a.metrics.purchases > 0).length > 1 && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <span style={{ fontSize: '0.5625rem', color: colors.textMuted, fontWeight: 700, letterSpacing: '0.05em' }}>
                                                    CHỌN AD LÀM MẪU{selectedProduct ? ` (${selectedProduct})` : ''}
                                                </span>
                                                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', overflowX: 'auto' as const, paddingBottom: '4px' }}>
                                                    {filteredAds.filter(a => a.metrics.purchases > 0).slice(0, 5).map((ad, i) => (
                                                        <button
                                                            key={ad.ad_id}
                                                            onClick={() => setSelectedRefAdIdx(i)}
                                                            style={{
                                                                minWidth: '80px', padding: '6px',
                                                                background: selectedRefAdIdx === i ? `${colors.accent}15` : colors.bg,
                                                                border: `1px solid ${selectedRefAdIdx === i ? colors.accent : colors.border}`,
                                                                borderRadius: '6px', cursor: 'pointer',
                                                                textAlign: 'center' as const,
                                                            }}
                                                        >
                                                            {ad.image_url && (
                                                                <img
                                                                    src={ad.image_url}
                                                                    alt=""
                                                                    style={{ width: '48px', height: '48px', objectFit: 'cover' as const, borderRadius: '3px', marginBottom: '3px' }}
                                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                />
                                                            )}
                                                            <div style={{
                                                                fontSize: '0.5rem', fontWeight: 600,
                                                                color: selectedRefAdIdx === i ? colors.accent : colors.textMuted,
                                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                                                                maxWidth: '72px',
                                                            }}>
                                                                {ad.ad_name.slice(0, 15)}
                                                            </div>
                                                            <div style={{ fontSize: '0.5rem', color: colors.accent }}>
                                                                ROAS {ad.metrics.roas.toFixed(1)}x
                                                            </div>
                                                            {ad.image_urls && ad.image_urls.length > 1 && (
                                                                <div style={{ fontSize: '0.4375rem', color: colors.textMuted }}>
                                                                    {ad.image_urls.length} ảnh
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* ═══ TẠO CREATIVE BUTTON ═══ */}
                                    <div style={{ marginTop: '8px' }}>
                                        <button
                                            onClick={generateCreative}
                                            disabled={isGenerating}
                                            style={{
                                                width: '100%', padding: '14px',
                                                background: isGenerating ? colors.bgAlt : colors.primary,
                                                border: 'none', borderRadius: '8px',
                                                color: isGenerating ? colors.textMuted : '#000',
                                                fontSize: '0.8125rem', fontWeight: 700,
                                                letterSpacing: '0.05em',
                                                cursor: isGenerating ? 'not-allowed' : 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            }}
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <span style={{
                                                        display: 'inline-block', width: 14, height: 14,
                                                        border: `2px solid ${colors.textMuted}`,
                                                        borderTopColor: colors.primary,
                                                        borderRadius: '50%',
                                                        animation: 'spin 0.8s linear infinite',
                                                    }} />
                                                    {generateStep || 'Đang tạo...'}
                                                </>
                                            ) : (
                                                <>TẠO CREATIVE (CAPTION + ẢNH)</>
                                            )}
                                        </button>
                                        {generateError && (
                                            <p style={{ margin: '8px 0 0', fontSize: '0.6875rem', color: colors.error }}>
                                                {generateError}
                                            </p>
                                        )}
                                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══════════════ TAB: OUTPUT ═══════════════ */}
                    {activeTab === 'output' && (
                        <div style={{ padding: '16px 20px' }}>
                            {/* Empty state */}
                            {!generatedCaption && !isGenerating && (
                                <div style={{
                                    textAlign: 'center' as const, padding: '40px 20px',
                                    color: colors.textMuted,
                                }}>
                                    <p style={{ fontSize: '2rem', margin: '0 0 8px' }}>🎨</p>
                                    <p style={{ fontSize: '0.8125rem', margin: '0 0 16px' }}>
                                        Chưa có creative nào được tạo
                                    </p>
                                    <button
                                        onClick={() => {
                                            if (intel) generateCreative();
                                            else setActiveTab('brief');
                                        }}
                                        style={{
                                            padding: '10px 24px',
                                            background: intel ? colors.primary : colors.bgAlt,
                                            border: intel ? 'none' : `1px solid ${colors.border}`,
                                            borderRadius: '6px',
                                            color: intel ? '#000' : colors.text,
                                            fontSize: '0.75rem', fontWeight: 700,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {intel ? 'TẠO CREATIVE NGAY' : 'CHẠY CREATIVE BRIEF TRƯỚC'}
                                    </button>
                                </div>
                            )}

                            {/* Generating state */}
                            {isGenerating && (
                                <div style={{
                                    textAlign: 'center' as const, padding: '60px 20px',
                                }}>
                                    <div style={{
                                        width: 48, height: 48, margin: '0 auto 16px',
                                        border: `3px solid ${colors.border}`,
                                        borderTopColor: colors.primary,
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite',
                                    }} />
                                    <p style={{ fontSize: '0.8125rem', color: colors.primary, fontWeight: 700, margin: '0 0 4px' }}>
                                        ĐANG TẠO CREATIVE
                                    </p>
                                    <p style={{ fontSize: '0.6875rem', color: colors.textMuted, margin: 0 }}>
                                        {generateStep || 'Đang xử lý...'}
                                    </p>
                                </div>
                            )}

                            {/* Generated result */}
                            {generatedCaption && !isGenerating && (
                                <div>
                                    {/* Key Message */}
                                    {generatedKeyMessage && (
                                        <div style={{
                                            padding: '10px 14px', marginBottom: '16px',
                                            background: `${colors.primary}10`, borderRadius: '6px',
                                            border: `1px solid ${colors.primary}30`,
                                        }}>
                                            <span style={{ fontSize: '0.5625rem', color: colors.primary, fontWeight: 700, letterSpacing: '0.1em' }}>
                                                KEY MESSAGE
                                            </span>
                                            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: colors.text }}>
                                                {generatedKeyMessage}
                                            </p>
                                        </div>
                                    )}

                                    {/* Caption */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            marginBottom: '8px',
                                        }}>
                                            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: colors.accent, letterSpacing: '0.1em' }}>
                                                CAPTION
                                            </span>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(generatedCaption);
                                                    setCopiedCaption(true);
                                                    setTimeout(() => setCopiedCaption(false), 2000);
                                                }}
                                                style={{
                                                    padding: '4px 10px', borderRadius: '4px',
                                                    background: copiedCaption ? `${colors.accent}20` : colors.bgAlt,
                                                    border: `1px solid ${copiedCaption ? colors.accent : colors.border}`,
                                                    color: copiedCaption ? colors.accent : colors.textMuted,
                                                    fontSize: '0.625rem', fontWeight: 700,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {copiedCaption ? '✓ ĐÃ COPY' : 'COPY'}
                                            </button>
                                        </div>
                                        <div style={{
                                            padding: '14px 16px', borderRadius: '6px',
                                            background: colors.bg, border: `1px solid ${colors.border}`,
                                            fontSize: '0.8125rem', color: colors.text,
                                            lineHeight: 1.6, whiteSpace: 'pre-wrap' as const,
                                        }}>
                                            {generatedCaption}
                                        </div>
                                    </div>

                                    {/* Generated Images */}
                                    {generatedImages.length > 0 && (
                                        <div style={{ marginBottom: '20px' }}>
                                            <span style={{
                                                fontSize: '0.6875rem', fontWeight: 700, color: colors.accent,
                                                letterSpacing: '0.1em', display: 'block', marginBottom: '8px',
                                            }}>
                                                MEDIA ({generatedImages.length} ẢNH)
                                            </span>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: generatedImages.length === 1 ? '1fr'
                                                    : generatedImages.length === 2 ? '1fr 1fr'
                                                        : '1fr 1fr',
                                                gap: '8px',
                                            }}>
                                                {generatedImages.map((img, i) => (
                                                    <div key={i} style={{ position: 'relative' }}>
                                                        <img
                                                            src={img}
                                                            alt={`Generated ${i + 1}`}
                                                            style={{
                                                                width: '100%', borderRadius: '6px',
                                                                border: `1px solid ${colors.border}`,
                                                                display: 'block',
                                                            }}
                                                        />
                                                        <a
                                                            href={img}
                                                            download={`creative-${campaignId}-${i + 1}.png`}
                                                            style={{
                                                                position: 'absolute', bottom: '6px', right: '6px',
                                                                padding: '4px 8px', borderRadius: '4px',
                                                                background: 'rgba(0,0,0,0.7)',
                                                                color: '#fff', fontSize: '0.5625rem',
                                                                fontWeight: 700, textDecoration: 'none',
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            ↓ TẢI
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {generatedImages.length === 0 && (
                                        <div style={{
                                            padding: '16px', borderRadius: '6px',
                                            background: `${colors.warning}08`, border: `1px solid ${colors.warning}20`,
                                            marginBottom: '16px',
                                        }}>
                                            <p style={{ margin: 0, fontSize: '0.75rem', color: colors.warning }}>
                                                Ảnh chưa tạo được. Bấm TẠO LẠI để thử lại.
                                            </p>
                                        </div>
                                    )}

                                    {/* ═══ PROMPT TRACEABILITY ═══ */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <button
                                            onClick={() => setShowPromptTrace(!showPromptTrace)}
                                            style={{
                                                width: '100%', padding: '10px 14px',
                                                background: colors.bg, border: `1px solid ${colors.border}`,
                                                borderRadius: '6px', cursor: 'pointer',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            }}
                                        >
                                            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: colors.primary, letterSpacing: '0.1em' }}>
                                                {showPromptTrace ? '▲ ẨN PROMPT DEBUG' : '▼ XEM PROMPT ĐÃ DÙNG'}
                                            </span>
                                            <span style={{ fontSize: '0.5625rem', color: colors.textMuted }}>
                                                {generatedImagePrompts.length} image prompt • {referenceImageUrls.length} ref images
                                            </span>
                                        </button>

                                        {showPromptTrace && (
                                            <div style={{
                                                marginTop: '8px', padding: '14px',
                                                background: colors.bg, border: `1px solid ${colors.border}`,
                                                borderRadius: '6px', maxHeight: '500px', overflow: 'auto',
                                            }}>
                                                {/* Reference Images Used */}
                                                {referenceImageUrls.length > 0 && (
                                                    <div style={{ marginBottom: '16px' }}>
                                                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: colors.accent, letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>
                                                            ẢNH THAM KHẢO ĐÃ DÙNG ({referenceImageUrls.length})
                                                        </span>
                                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                                                            {referenceImageUrls.map((url, i) => (
                                                                <img
                                                                    key={i} src={url} alt={`Ref ${i + 1}`}
                                                                    style={{
                                                                        width: '60px', height: '60px', objectFit: 'cover' as const,
                                                                        borderRadius: '4px', border: `1px solid ${colors.border}`,
                                                                    }}
                                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Image Prompts */}
                                                {generatedImagePrompts.map((prompt, i) => (
                                                    <div key={i} style={{ marginBottom: '12px' }}>
                                                        <span style={{
                                                            fontSize: '0.625rem', fontWeight: 700, color: colors.warning,
                                                            letterSpacing: '0.1em', display: 'block', marginBottom: '4px',
                                                        }}>
                                                            IMAGE PROMPT #{i + 1}
                                                        </span>
                                                        <div style={{
                                                            padding: '10px 12px', borderRadius: '4px',
                                                            background: colors.bgAlt, border: `1px solid ${colors.border}`,
                                                            fontSize: '0.6875rem', color: colors.text,
                                                            lineHeight: 1.5, whiteSpace: 'pre-wrap' as const,
                                                        }}>
                                                            {prompt}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Full Caption Prompt (collapsed by default) */}
                                                {generatedCaptionPrompt && (
                                                    <details style={{ marginTop: '8px' }}>
                                                        <summary style={{
                                                            fontSize: '0.625rem', fontWeight: 700, color: colors.textMuted,
                                                            letterSpacing: '0.1em', cursor: 'pointer', marginBottom: '4px',
                                                        }}>
                                                            FULL CAPTION PROMPT (click để xem)
                                                        </summary>
                                                        <div style={{
                                                            padding: '10px 12px', borderRadius: '4px',
                                                            background: colors.bgAlt, border: `1px solid ${colors.border}`,
                                                            fontSize: '0.625rem', color: colors.textSubtle,
                                                            lineHeight: 1.5, whiteSpace: 'pre-wrap' as const,
                                                            maxHeight: '300px', overflow: 'auto',
                                                        }}>
                                                            {generatedCaptionPrompt}
                                                        </div>
                                                    </details>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* ═══ PUBLISH TO FACEBOOK ═══ */}
                                    {generatedImages.length > 0 && (
                                        <div style={{
                                            padding: '16px', borderRadius: '8px',
                                            background: colors.bgAlt,
                                            border: `1px solid ${colors.accent}30`,
                                            marginBottom: '16px',
                                        }}>
                                            <span style={{
                                                fontSize: '0.6875rem', fontWeight: 700, color: colors.accent,
                                                letterSpacing: '0.1em', display: 'block', marginBottom: '10px',
                                            }}>
                                                THÊM VÀO CHIẾN DỊCH
                                            </span>

                                            {/* Ad Set selector */}
                                            <div style={{ marginBottom: '10px' }}>
                                                <label style={{
                                                    fontSize: '0.625rem', color: colors.textMuted,
                                                    fontWeight: 600, display: 'block', marginBottom: '4px',
                                                }}>
                                                    CHỌN AD SET
                                                </label>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <select
                                                        value={selectedAdSet}
                                                        onChange={(e) => setSelectedAdSet(e.target.value)}
                                                        style={{
                                                            flex: 1, padding: '8px 10px',
                                                            background: colors.bg, color: colors.text,
                                                            border: `1px solid ${colors.border}`,
                                                            borderRadius: '4px', fontSize: '0.75rem',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        <option value="">
                                                            {adSets.length === 0 ? '— Bấm TẢI để lấy danh sách —' : '— Chọn Ad Set —'}
                                                        </option>
                                                        {adSets.map(as => (
                                                            <option key={as.id} value={as.id}>
                                                                {as.name} ({as.status})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={fetchAdSets}
                                                        style={{
                                                            padding: '8px 12px', borderRadius: '4px',
                                                            background: colors.bgAlt,
                                                            border: `1px solid ${colors.border}`,
                                                            color: colors.textMuted, fontSize: '0.625rem',
                                                            fontWeight: 700, cursor: adSetLoading ? 'wait' : 'pointer',
                                                            whiteSpace: 'nowrap' as const,
                                                            opacity: adSetLoading ? 0.6 : 1,
                                                        }}
                                                        disabled={adSetLoading}
                                                    >
                                                        {adSetLoading ? 'ĐANG TẢI...' : 'TẢI'}
                                                    </button>
                                                </div>
                                                {adSetError && (
                                                    <p style={{ margin: '4px 0 0', fontSize: '0.625rem', color: colors.error }}>
                                                        ✗ {adSetError}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Publish button */}
                                            <button
                                                onClick={async () => {
                                                    if (!selectedAdSet || !generatedImages[0]) return;
                                                    setIsPublishing(true);
                                                    setPublishResult(null);
                                                    setPublishStep('Đang upload ảnh + tạo ad...');
                                                    try {
                                                        const res = await fetch(`/api/analysis/campaign/${campaignId}/publish-creative`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                caption: generatedCaption,
                                                                image: generatedImages[0],
                                                                adSetId: selectedAdSet,
                                                                adName: `CS ${new Date().toLocaleDateString('vi-VN')}`,
                                                            }),
                                                        });
                                                        const json = await res.json();
                                                        if (json.success) {
                                                            setPublishResult({
                                                                success: true,
                                                                message: json.data.message,
                                                                adId: json.data.adId,
                                                            });
                                                        } else {
                                                            const fbDetail = json.fbError?.error_user_title || json.fbError?.error_subcode || '';
                                                            console.error('[PUBLISH] FB Error:', json.fbError);
                                                            setPublishResult({ success: false, message: `${json.error}${fbDetail ? ` — ${fbDetail}` : ''}` });
                                                        }
                                                    } catch (err) {
                                                        setPublishResult({ success: false, message: err instanceof Error ? err.message : 'Lỗi kết nối' });
                                                    } finally {
                                                        setIsPublishing(false);
                                                        setPublishStep('');
                                                    }
                                                }}
                                                disabled={!selectedAdSet || isPublishing}
                                                style={{
                                                    width: '100%', padding: '12px',
                                                    background: !selectedAdSet ? colors.bgAlt
                                                        : isPublishing ? colors.bgAlt
                                                            : colors.accent,
                                                    border: 'none', borderRadius: '6px',
                                                    color: !selectedAdSet ? colors.textMuted : '#000',
                                                    fontSize: '0.75rem', fontWeight: 700,
                                                    cursor: !selectedAdSet ? 'not-allowed' : 'pointer',
                                                    letterSpacing: '0.05em',
                                                    opacity: isPublishing ? 0.7 : 1,
                                                }}
                                            >
                                                {isPublishing ? (
                                                    <>{publishStep || 'Đang tạo...'}</>
                                                ) : (
                                                    <>THÊM VÀO CHIẾN DỊCH (TRẠNG THÁI: TẠM DỪNG)</>
                                                )}
                                            </button>

                                            {/* Result message */}
                                            {publishResult && (
                                                <div style={{
                                                    marginTop: '10px', padding: '10px 14px',
                                                    borderRadius: '6px',
                                                    background: publishResult.success ? `${colors.success}10` : `${colors.error}10`,
                                                    border: `1px solid ${publishResult.success ? colors.success : colors.error}30`,
                                                }}>
                                                    <p style={{
                                                        margin: 0, fontSize: '0.75rem',
                                                        color: publishResult.success ? colors.success : colors.error,
                                                        fontWeight: 600,
                                                    }}>
                                                        {publishResult.success ? '✓ ' : '✗ '}
                                                        {publishResult.message}
                                                    </p>
                                                    {publishResult.adId && (
                                                        <p style={{
                                                            margin: '4px 0 0', fontSize: '0.625rem',
                                                            color: colors.textMuted,
                                                        }}>
                                                            Ad ID: {publishResult.adId}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Regenerate button */}
                                    <button
                                        onClick={generateCreative}
                                        disabled={isGenerating}
                                        style={{
                                            width: '100%', padding: '12px',
                                            background: colors.bgAlt,
                                            border: `1px solid ${colors.border}`,
                                            borderRadius: '6px',
                                            color: colors.text,
                                            fontSize: '0.75rem', fontWeight: 700,
                                            cursor: 'pointer',
                                            letterSpacing: '0.05em',
                                        }}
                                    >
                                        TẠO LẠI
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div >
        </>
    );
}
