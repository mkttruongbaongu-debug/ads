'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import CampaignDetailPanel from '@/components/CampaignDetailPanel';

interface Issue {
    type: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    detail: string;
    action: string;
}

interface CampaignWithIssues {
    id: string;
    name: string;
    status: string;
    totals: {
        spend: number;
        purchases: number;
        revenue: number;
        cpp: number;
        roas: number;
        ctr: number;
    };
    issues: Issue[];
    actionRecommendation?: {
        action: 'STOP' | 'WATCH' | 'SCALE';
        reason: string;
        emoji: string;
        color: string;
    };
}

interface AnalysisData {
    critical: CampaignWithIssues[];
    warning: CampaignWithIssues[];
    good: CampaignWithIssues[];
    summary: {
        total: number;
        critical: number;
        warning: number;
        good: number;
        totalSpend: number;
        totalRevenue: number;
    };
}

interface AdAccount {
    id: string;
    name: string;
    isActive: boolean;
    currency: string;
    timezone: string;
}

// CEX Trading Design System - Exact Colors
const colors = {
    primary: '#F0B90B',
    primaryHover: '#FCD535',
    secondary: '#1E2329',
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
    container: {
        minHeight: '100vh',
        background: colors.bg,
        fontFamily: 'Inter, -apple-system, sans-serif',
        color: colors.text,
    },
    header: {
        background: colors.bgCard,
        borderBottom: `1px solid ${colors.border}`,
        position: 'sticky' as const,
        top: 0,
        zIndex: 100,
    },
    headerTop: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 32px',
        borderBottom: `1px solid ${colors.border}`,
    },
    logo: {
        fontSize: '1.75rem',
        fontWeight: 700,
        color: colors.text,
        letterSpacing: '-0.03em',
    },
    headerControls: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: '20px',
        padding: '16px 32px',
    },
    controlGroup: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
    },
    controlLabel: {
        fontSize: '0.7rem',
        color: colors.textMuted,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.1em',
        fontWeight: 600,
    },
    selectInput: {
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        padding: '12px 16px',
        borderRadius: '4px',
        fontSize: '0.875rem',
        cursor: 'pointer',
        minWidth: '200px',
        outline: 'none',
        transition: 'all 0.2s ease',
    },
    dateInputsGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: colors.bg,
        padding: '10px 16px',
        borderRadius: '4px',
        border: `1px solid ${colors.border}`,
    },
    dateInput: {
        background: 'transparent',
        border: 'none',
        color: colors.text,
        fontSize: '0.875rem',
        cursor: 'pointer',
        outline: 'none',
    },
    searchBtn: {
        background: colors.primary,
        color: colors.bg,
        border: 'none',
        padding: '12px 24px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: 600,
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    logoutBtn: {
        background: 'transparent',
        border: `1px solid ${colors.border}`,
        color: colors.textMuted,
        padding: '10px 20px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.85rem',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    main: {
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '32px',
    },
    summaryRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '32px',
    },
    summaryCard: {
        background: colors.bgCard,
        borderRadius: '8px',
        padding: '24px',
        border: `1px solid ${colors.border}`,
        transition: 'all 0.2s ease',
    },
    summaryLabel: {
        fontSize: '0.75rem',
        color: colors.textMuted,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        margin: '0 0 8px',
        fontWeight: 500,
    },
    summaryValue: {
        fontSize: '1.75rem',
        fontWeight: 700,
        color: colors.text,
        margin: 0,
        fontFamily: '"JetBrains Mono", monospace',
    },
    section: {
        marginBottom: '28px',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
    },
    sectionTitle: {
        fontSize: '1.1rem',
        fontWeight: 700,
        color: colors.text,
        margin: 0,
    },
    badge: {
        fontSize: '0.75rem',
        padding: '4px 12px',
        borderRadius: '4px',
        fontWeight: 600,
    },
    campaignCard: {
        background: colors.bgCard,
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '16px',
        border: `1px solid ${colors.border}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        borderLeft: '4px solid',
    },
    campaignName: {
        fontSize: '1.05rem',
        fontWeight: 600,
        color: colors.text,
        margin: '0 0 12px',
    },
    issueBox: {
        background: `rgba(246, 70, 93, 0.1)`,
        borderRadius: '8px',
        padding: '14px',
        marginBottom: '12px',
        border: `1px solid rgba(246, 70, 93, 0.2)`,
    },
    issueMessage: {
        fontSize: '0.9rem',
        fontWeight: 600,
        color: colors.error,
        margin: '0 0 6px',
    },
    issueDetail: {
        fontSize: '0.8rem',
        color: colors.textMuted,
        margin: '0 0 10px',
    },
    issueAction: {
        fontSize: '0.8rem',
        fontWeight: 600,
        color: colors.success,
        margin: 0,
    },
    metricsRow: {
        display: 'flex',
        gap: '24px',
        fontSize: '0.85rem',
        color: colors.textMuted,
    },
    loader: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '100px 0',
        color: colors.textMuted,
        fontSize: '1rem',
    },
    error: {
        textAlign: 'center' as const,
        padding: '48px',
        color: '#fca5a5',
        background: 'rgba(239, 68, 68, 0.1)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '80px 32px',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.6)',
    },
};

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [data, setData] = useState<AnalysisData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedCampaign, setSelectedCampaign] = useState<CampaignWithIssues | null>(null);

    // Account selector
    const [accounts, setAccounts] = useState<AdAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

    // User profile from TaiKhoan
    const [userProfile, setUserProfile] = useState<{
        name: string;
        avatar: string;
        plan: string;
    } | null>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);

    // Pending proposals count for badge
    const [pendingCount, setPendingCount] = useState(0);

    // Track which campaigns have been analyzed
    const [analyzedCampaigns, setAnalyzedCampaigns] = useState<Record<string, boolean>>({});

    // Campaign filter
    const [filterText, setFilterText] = useState('');

    // Date range - last 7 days
    const [endDate, setEndDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return date.toISOString().split('T')[0];
    });

    // Fetch user profile from TaiKhoan
    const fetchUserProfile = useCallback(async () => {
        console.log('[DASHBOARD/PROFILE] 🔍 Fetching user profile...');
        try {
            const res = await fetch('/api/user/profile');
            const json = await res.json();
            console.log('[DASHBOARD/PROFILE] 📦 API Response:', json);
            if (json.success && json.data) {
                console.log('[DASHBOARD/PROFILE] ✅ Setting profile:', json.data.name, json.data.plan);
                setUserProfile({
                    name: json.data.name || 'User',
                    avatar: json.data.avatar || '',
                    plan: json.data.plan || 'Free',
                });
            } else {
                console.warn('[DASHBOARD/PROFILE] ⚠️ No profile data:', json);
            }
        } catch (err) {
            console.error('[DASHBOARD/PROFILE] ❌ Failed to fetch user profile:', err);
        }
    }, []);

    // Track if accounts already fetched
    const accountsFetchedRef = useRef(false);

    // Fetch ad accounts - ONLY ONCE
    const fetchAccounts = useCallback(async () => {
        if (accountsFetchedRef.current) {
            console.log('[DASHBOARD] ⏭️ Accounts already fetched, skip');
            return;
        }
        accountsFetchedRef.current = true;
        console.log('[DASHBOARD] 🔍 Fetching accounts...');
        setIsLoadingAccounts(true);
        try {
            const res = await fetch('/api/facebook/accounts');
            const json = await res.json();
            console.log('[DASHBOARD] 📦 Accounts response:', json);
            if (json.success && json.data) {
                setAccounts(json.data);
                console.log('[DASHBOARD] ✅ Loaded', json.data.length, 'accounts, source:', json.source);
                // Auto-select first active account
                const firstActive = json.data.find((a: AdAccount) => a.isActive);
                if (firstActive) {
                    setSelectedAccountId(firstActive.id);
                    console.log('[DASHBOARD] 🎯 Auto-selected account:', firstActive.name);
                }
            } else {
                console.warn('[DASHBOARD] ⚠️ No accounts data:', json);
            }
        } catch (err) {
            console.error('[DASHBOARD] ❌ Failed to fetch accounts:', err);
            accountsFetchedRef.current = false; // Allow retry on error
        } finally {
            setIsLoadingAccounts(false);
        }
    }, []);

    const fetchData = useCallback(async () => {
        if (!selectedAccountId) return;

        setIsLoading(true);
        setError(null);

        try {
            console.log('[DASHBOARD] 🚀 Fetching analysis...', { startDate, endDate, selectedAccountId });
            const res = await fetch(
                `/api/analysis/daily?startDate=${startDate}&endDate=${endDate}&accountId=${selectedAccountId}`
            );

            // Safe JSON parsing
            const text = await res.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch (parseErr) {
                console.error('[DASHBOARD] ❌ JSON parse error, raw response:', text.slice(0, 500));
                throw new Error('Server response invalid');
            }

            console.log('[DASHBOARD] 📊 Analysis response:', json.success ? `${json.data?.summary?.total || 0} campaigns` : json.error);

            if (!json.success) {
                if (json.needsLogin) {
                    router.push('/');
                    return;
                }
                throw new Error(json.error);
            }

            setData(json.data);
            console.log('[DASHBOARD] ✅ Analysis loaded:', json.data?.summary);
        } catch (err) {
            console.error('[DASHBOARD] ❌ Analysis error:', err);
            setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate, selectedAccountId, router]);

    // Track if user has searched
    const [hasSearched, setHasSearched] = useState(false);

    // Handle search button click
    const handleSearch = useCallback(() => {
        console.log('[DASHBOARD] 🔘 Tra cứu clicked');
        setHasSearched(true);
        fetchData();
    }, [fetchData]);

    // Fetch pending proposals count
    const fetchPendingCount = useCallback(async () => {
        try {
            const res = await fetch('/api/de-xuat/danh-sach?status=CHO_DUYET');
            const json = await res.json();
            if (json.success) {
                setPendingCount((json.data || []).length);
            }
        } catch (error) {
            console.error('Error fetching pending count:', error);
        }
    }, []);

    // Track initialization to prevent re-fetch
    const initRef = useRef(false);

    // Load accounts and user profile on mount
    useEffect(() => {
        // Only log and act on status change, ignore session object changes
        if (initRef.current) {
            return; // Already initialized, skip
        }

        console.log('[DASHBOARD/MOUNT] 🔄 Status:', status, 'Has session:', !!session);

        if (status === 'unauthenticated') {
            console.log('[DASHBOARD/MOUNT] ❌ Not authenticated, redirecting...');
            router.push('/');
        } else if (status === 'authenticated' && session) {
            console.log('[DASHBOARD/MOUNT] ✅ Authenticated, fetching data...');
            initRef.current = true;
            fetchAccounts();
            fetchUserProfile();
            fetchPendingCount();
        } else if (status === 'loading') {
            console.log('[DASHBOARD/MOUNT] ⏳ Loading auth...');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]); // ONLY depend on status, NOT session!

    // Load analyzed campaigns from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('analyzedCampaigns');
        if (stored) {
            try {
                setAnalyzedCampaigns(JSON.parse(stored));
            } catch (e) {
                console.error('[DASHBOARD] Failed to parse analyzedCampaigns:', e);
            }
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = () => setShowUserMenu(false);
        if (showUserMenu) {
            document.addEventListener('click', handleClickOutside);
        } else {
            document.removeEventListener('click', handleClickOutside);
        }
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showUserMenu]);

    // NO auto-fetch - user must click "Tra cứu" button

    if (status === 'loading' || status === 'unauthenticated') {
        return (
            <div style={styles.loader}>
                <p>Đang tải...</p>
            </div>
        );
    }

    const formatMoney = (amount: number) => {
        // Làm tròn số và hiển thị với dấu chấm phân cách: 3.400.000 ₫
        const rounded = Math.round(amount);
        return rounded.toLocaleString('de-DE') + ' ₫';
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <header style={styles.header}>
                {/* Top Row: Logo + Logout */}
                <div style={styles.headerTop}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                        {/* Logo */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Image src="/logo.png" alt="QUÂN SƯ ADS" width={36} height={36} style={{ borderRadius: '8px' }} />
                            <span style={styles.logo}>QUÂN SƯ ADS</span>
                        </div>

                        {/* Navigation Links */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                onClick={() => router.push('/dashboard/proposals')}
                                style={{
                                    padding: '8px 16px',
                                    background: 'transparent',
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '6px',
                                    color: colors.text,
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    position: 'relative' as const,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(240, 185, 11, 0.1)';
                                    e.currentTarget.style.borderColor = colors.primary;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.borderColor = colors.border;
                                }}
                            >
                                ĐỀ XUẤT
                                {pendingCount > 0 && (
                                    <span style={{
                                        background: colors.primary,
                                        color: colors.bg,
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: '10px',
                                        minWidth: '18px',
                                        textAlign: 'center',
                                    }}>
                                        {pendingCount}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => router.push('/dashboard/monitoring')}
                                style={{
                                    padding: '8px 16px',
                                    background: 'transparent',
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '6px',
                                    color: colors.text,
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(240, 185, 11, 0.1)';
                                    e.currentTarget.style.borderColor = colors.primary;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.borderColor = colors.border;
                                }}
                            >
                                GIÁM SÁT
                            </button>
                        </div>
                    </div>
                    {/* User Profile Dropdown - CEX Style */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                background: 'transparent',
                                border: `1px solid ${colors.border}`,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = colors.bgAlt}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            {/* Avatar */}
                            {userProfile?.avatar ? (
                                <img
                                    src={userProfile.avatar}
                                    alt=""
                                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                                />
                            ) : (
                                <div style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#000',
                                }}>
                                    {userProfile?.name?.charAt(0) || 'U'}
                                </div>
                            )}
                            {/* Name + Plan */}
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>
                                    {userProfile?.name || 'Loading...'}
                                </div>
                                <div style={{
                                    fontSize: '11px',
                                    color: userProfile?.plan === 'Pro' ? colors.primary : colors.textMuted,
                                    fontWeight: 500,
                                }}>
                                    {userProfile?.plan || 'Free'}
                                </div>
                            </div>
                            {/* Arrow */}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2">
                                <polyline points="6,9 12,15 18,9" />
                            </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {showUserMenu && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '8px',
                                background: colors.bgCard,
                                border: `1px solid ${colors.border}`,
                                borderRadius: '8px',
                                minWidth: '180px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                                zIndex: 1000,
                                overflow: 'hidden',
                            }}>
                                {/* VIP Upgrade Button */}
                                <button
                                    onClick={() => alert('Tính năng nâng cấp VIP sẽ sớm ra mắt!')}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: colors.primary,
                                        fontSize: '13px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        borderBottom: `1px solid ${colors.border}`,
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(246,190,79,0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                                    </svg>
                                    Nâng cấp VIP
                                </button>
                                {/* Logout */}
                                <button
                                    onClick={() => signOut({ callbackUrl: '/' })}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: colors.error,
                                        fontSize: '13px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(246,70,93,0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16,17 21,12 16,7" />
                                        <line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                    Đăng xuất
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Controls Row */}
                <div style={styles.headerControls}>
                    {/* Account Selector */}
                    <div style={styles.controlGroup}>
                        <span style={styles.controlLabel}>Tài khoản</span>
                        <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            disabled={isLoadingAccounts}
                            style={styles.selectInput}
                        >
                            {isLoadingAccounts ? (
                                <option>Đang tải...</option>
                            ) : accounts.length === 0 ? (
                                <option>Không có tài khoản</option>
                            ) : (
                                accounts.map(acc => {
                                    // Map Facebook account_status to Vietnamese labels
                                    const statusLabels: Record<number, string> = {
                                        1: '', // ACTIVE - không cần hiển thị
                                        2: '🚫 Đã vô hiệu',
                                        3: '💳 Nợ tiền',
                                        7: '⏳ Đang xét duyệt',
                                        8: '💰 Chờ thanh toán',
                                        9: '⚠️ Gia hạn',
                                        100: '🔒 Sắp đóng',
                                        101: '❌ Đã đóng',
                                    };
                                    const statusLabel = (acc as any).account_status ? statusLabels[(acc as any).account_status] || '' : '';

                                    return (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} {statusLabel}
                                        </option>
                                    );
                                })
                            )}
                        </select>
                    </div>

                    {/* Date Range */}
                    <div style={styles.controlGroup}>
                        <span style={styles.controlLabel}>Khoảng thời gian</span>
                        <div style={styles.dateInputsGroup}>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={styles.dateInput}
                            />
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>→</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={styles.dateInput}
                            />
                        </div>
                    </div>

                    {/* Search Button */}
                    <div style={{ ...styles.controlGroup, justifyContent: 'flex-end' }}>
                        <span style={styles.controlLabel}>&nbsp;</span>
                        <button
                            onClick={handleSearch}
                            disabled={isLoading || !selectedAccountId}
                            style={{
                                ...styles.searchBtn,
                                opacity: (isLoading || !selectedAccountId) ? 0.6 : 1,
                                cursor: (isLoading || !selectedAccountId) ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                                        <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                                        <path d="M12 2a10 10 0 0 1 10 10" />
                                    </svg>
                                    Đang tải...
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                    Tra cứu
                                </>
                            )}
                        </button>
                    </div>

                    {/* Campaign Filter - inline with other controls */}
                    <div style={styles.controlGroup}>
                        <span style={styles.controlLabel}>Lọc chiến dịch</span>
                        <input
                            type="text"
                            placeholder="Tìm theo tên..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            style={{
                                padding: '10px 14px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                fontSize: '0.875rem',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                outline: 'none',
                                minWidth: '180px',
                            }}
                        />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main style={styles.main}>
                {/* Error State */}
                {error && (
                    <div style={styles.error}>
                        <p>❌ {error}</p>
                        <button
                            onClick={handleSearch}
                            style={{ ...styles.searchBtn, marginTop: '16px' }}
                        >
                            Thử lại
                        </button>
                    </div>
                )}

                {/* Pre-search Empty State */}
                {!hasSearched && !isLoading && !error && (
                    <div style={styles.emptyState}>
                        <p style={{ fontSize: '3rem', marginBottom: '16px' }}>📊</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 500, color: '#374151' }}>Chọn tài khoản và khoảng thời gian</p>
                        <p style={{ color: '#6b7280', marginTop: '8px' }}>Sau đó bấm <strong>🔍 Tra cứu</strong> để phân tích campaigns</p>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && !error && (
                    <div style={styles.loader}>
                        <p>⏳ Đang phân tích campaigns...</p>
                    </div>
                )}

                {/* Data */}
                {hasSearched && data && !isLoading && (() => {
                    // Filter campaigns by name
                    const filterLower = filterText.toLowerCase();
                    const filteredCritical = filterText
                        ? data.critical.filter(c => c.name.toLowerCase().includes(filterLower))
                        : data.critical;
                    const filteredWarning = filterText
                        ? data.warning.filter(c => c.name.toLowerCase().includes(filterLower))
                        : data.warning;
                    const filteredGood = filterText
                        ? data.good.filter(c => c.name.toLowerCase().includes(filterLower))
                        : data.good;

                    // Calculate aggregate metrics
                    const allCampaigns = [...data.critical, ...data.warning, ...data.good];
                    const totalPurchases = allCampaigns.reduce((sum, c) => sum + c.totals.purchases, 0);
                    const totalClicks = allCampaigns.reduce((sum, c) => sum + (c.totals.ctr > 0 ? c.totals.purchases / (c.totals.ctr / 100) : 0), 0);
                    const avgRoas = data.summary.totalSpend > 0
                        ? data.summary.totalRevenue / data.summary.totalSpend
                        : 0;
                    const avgAov = totalPurchases > 0
                        ? data.summary.totalRevenue / totalPurchases
                        : 0;
                    const avgCvr = totalClicks > 0
                        ? (totalPurchases / totalClicks) * 100
                        : 0;

                    return (
                        <>
                            {/* CEX Trading Stats Panel */}
                            <div style={{ marginBottom: '24px' }}>
                                {/* Primary Row: Financial Metrics */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '16px',
                                    marginBottom: '12px',
                                }}>
                                    {/* Spend Card */}
                                    <div style={{
                                        background: colors.bgCard,
                                        borderRadius: '8px',
                                        padding: '20px 24px',
                                        border: `1px solid ${colors.border}`,
                                    }}>
                                        <p style={{ fontSize: '0.75rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                                            Tổng chi tiêu
                                        </p>
                                        <p style={{ fontSize: '1.75rem', fontWeight: 700, color: colors.text, margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                                            {formatMoney(data.summary.totalSpend)}
                                        </p>
                                    </div>

                                    {/* Revenue Card */}
                                    <div style={{
                                        background: colors.bgCard,
                                        borderRadius: '8px',
                                        padding: '20px 24px',
                                        border: `1px solid ${colors.border}`,
                                    }}>
                                        <p style={{ fontSize: '0.75rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                                            Doanh thu
                                        </p>
                                        <p style={{ fontSize: '1.75rem', fontWeight: 700, color: colors.success, margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                                            {formatMoney(data.summary.totalRevenue)}
                                        </p>
                                    </div>

                                    {/* ROAS Card - Highlighted */}
                                    <div style={{
                                        background: `linear-gradient(135deg, ${colors.bgCard} 0%, rgba(240,185,11,0.1) 100%)`,
                                        borderRadius: '8px',
                                        padding: '20px 24px',
                                        border: `1px solid ${colors.primary}40`,
                                    }}>
                                        <p style={{ fontSize: '0.75rem', color: colors.primary, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', fontWeight: 600 }}>
                                            ROAS
                                        </p>
                                        <p style={{ fontSize: '1.75rem', fontWeight: 700, color: colors.primary, margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                                            {avgRoas.toFixed(2)}x
                                        </p>
                                    </div>
                                </div>

                                {/* Secondary Row: Performance + Campaign Counts */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(5, 1fr)',
                                    gap: '12px',
                                }}>
                                    {/* CVR */}
                                    <div style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: '8px',
                                        padding: '14px 18px',
                                        border: `1px solid ${colors.border}`,
                                    }}>
                                        <p style={{ fontSize: '0.65rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                                            Tỷ lệ chốt
                                        </p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.text, margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                                            {avgCvr.toFixed(2)}%
                                        </p>
                                    </div>

                                    {/* AOV */}
                                    <div style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: '8px',
                                        padding: '14px 18px',
                                        border: `1px solid ${colors.border}`,
                                    }}>
                                        <p style={{ fontSize: '0.65rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                                            AOV
                                        </p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.text, margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                                            {formatMoney(avgAov)}
                                        </p>
                                    </div>

                                    {/* Critical Count */}
                                    <div style={{
                                        background: 'rgba(248,113,113,0.08)',
                                        borderRadius: '8px',
                                        padding: '14px 18px',
                                        border: `1px solid rgba(248,113,113,0.3)`,
                                    }}>
                                        <p style={{ fontSize: '0.65rem', color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                                            Cần xử lý
                                        </p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f87171', margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                                            {data.summary.critical}
                                        </p>
                                    </div>

                                    {/* Warning Count */}
                                    <div style={{
                                        background: `rgba(240,185,11,0.08)`,
                                        borderRadius: '8px',
                                        padding: '14px 18px',
                                        border: `1px solid rgba(240,185,11,0.3)`,
                                    }}>
                                        <p style={{ fontSize: '0.65rem', color: '#FCD535', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                                            Theo dõi
                                        </p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.warning, margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                                            {data.summary.warning}
                                        </p>
                                    </div>

                                    {/* Good Count */}
                                    <div style={{
                                        background: 'rgba(14,203,129,0.08)',
                                        borderRadius: '8px',
                                        padding: '14px 18px',
                                        border: `1px solid rgba(14,203,129,0.3)`,
                                    }}>
                                        <p style={{ fontSize: '0.65rem', color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                                            Đang tốt
                                        </p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.success, margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                                            {data.summary.good}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Campaign Table View (like landing demo) */}
                            <div style={{
                                background: colors.bgCard,
                                borderRadius: '8px',
                                border: `1px solid ${colors.border}`,
                                marginBottom: '28px',
                                overflow: 'hidden',
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ borderBottom: `1px solid ${colors.border}` }}>
                                        <tr>
                                            <th style={{ padding: '14px 20px', fontSize: '0.8rem', color: colors.textMuted, fontWeight: 500, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Chiến dịch
                                            </th>
                                            <th style={{ padding: '14px 20px', fontSize: '0.8rem', color: colors.textMuted, fontWeight: 500, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Chi tiêu
                                            </th>
                                            <th style={{ padding: '14px 20px', fontSize: '0.8rem', color: colors.textMuted, fontWeight: 500, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                ROAS
                                            </th>
                                            <th style={{ padding: '14px 20px', fontSize: '0.8rem', color: colors.textMuted, fontWeight: 500, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                CTR
                                            </th>
                                            <th style={{ padding: '14px 20px', fontSize: '0.8rem', color: colors.textMuted, fontWeight: 500, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Đề xuất AI
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...filteredCritical, ...filteredWarning, ...filteredGood].map((campaign) => {
                                            const action = campaign.actionRecommendation?.action || 'WATCH';
                                            const actionLabel = action === 'STOP' ? 'Dừng' : action === 'WATCH' ? 'Tối ưu' : 'Scale';
                                            const actionColor = action === 'STOP' ? colors.error : action === 'WATCH' ? colors.warning : colors.success;
                                            const statusIcon = action === 'SCALE' ? '✓' : action === 'WATCH' ? '!' : '✕';
                                            const roasValue = campaign.totals.roas;
                                            const roasColor = roasValue >= 2 ? colors.success : roasValue >= 1 ? colors.warning : colors.error;

                                            return (
                                                <tr
                                                    key={campaign.id}
                                                    onClick={() => setSelectedCampaign(campaign)}
                                                    style={{
                                                        borderBottom: `1px solid ${colors.border}`,
                                                        cursor: 'pointer',
                                                        transition: 'background 0.15s',
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <td style={{ padding: '16px 20px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '50%',
                                                                background: actionColor,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '0.85rem',
                                                                fontWeight: 700,
                                                                color: colors.bg,
                                                            }}>
                                                                {statusIcon}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 600, color: colors.text, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <span>{campaign.name.length > 35 ? campaign.name.slice(0, 35) + '...' : campaign.name}</span>
                                                                    {analyzedCampaigns[campaign.id] && (
                                                                        <span
                                                                            style={{
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '4px',
                                                                                padding: '2px 8px',
                                                                                borderRadius: '4px',
                                                                                fontSize: '0.65rem',
                                                                                fontWeight: 600,
                                                                                background: colors.primary + '20',
                                                                                color: colors.primary,
                                                                                border: `1px solid ${colors.primary}40`,
                                                                                whiteSpace: 'nowrap' as const,
                                                                            }}
                                                                            title="Campaign đã được AI phân tích"
                                                                        >
                                                                            🤖
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                                                                    {campaign.id}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 500, color: colors.text }}>
                                                            {formatMoney(campaign.totals.spend)}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: roasColor }}>
                                                            {roasValue.toFixed(1)}x
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                        <span style={{ fontFamily: '"JetBrains Mono", monospace', color: colors.textMuted }}>
                                                            {campaign.totals.ctr.toFixed(2)}%
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                        <button style={{
                                                            background: actionColor,
                                                            color: action === 'WATCH' ? colors.bg : '#fff',
                                                            border: 'none',
                                                            padding: '6px 16px',
                                                            borderRadius: '4px',
                                                            fontWeight: 600,
                                                            fontSize: '0.8rem',
                                                            cursor: 'pointer',
                                                            transition: 'opacity 0.15s',
                                                        }}>
                                                            {actionLabel}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Campaign sections removed - Table View above shows all info */}

                            {/* Empty State */}
                            {data.summary.total === 0 && (
                                <div style={styles.emptyState}>
                                    <p style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</p>
                                    <p>Không có campaign nào đang chạy trong khoảng thời gian này</p>
                                </div>
                            )}
                        </>
                    );
                })()}
            </main>

            {/* Campaign Detail Panel */}
            {selectedCampaign && (
                <CampaignDetailPanel
                    campaign={selectedCampaign}
                    dateRange={{ startDate, endDate }}
                    onClose={() => setSelectedCampaign(null)}
                    formatMoney={formatMoney}
                />
            )}
        </div>
    );
}

function CampaignCard({
    campaign,
    borderColor,
    formatMoney,
    onSelect,
    hasAIAnalysis,
}: {
    campaign: CampaignWithIssues;
    borderColor: string;
    formatMoney: (n: number) => string;
    onSelect: () => void;
    hasAIAnalysis?: boolean;
}) {
    return (
        <div
            style={{ ...styles.campaignCard, borderLeftColor: borderColor }}
            onClick={onSelect}
        >
            {/* Header with name and action badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '8px' }}>
                <h3 style={{ ...styles.campaignName, marginBottom: 0, flex: 1 }}>{campaign.name}</h3>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {hasAIAnalysis && (
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                background: colors.primary + '20',
                                color: colors.primary,
                                border: `1px solid ${colors.primary}40`,
                                whiteSpace: 'nowrap',
                            }}
                            title="Campaign đã được AI phân tích"
                        >
                            🤖 Đã phân tích
                        </span>
                    )}
                    {campaign.actionRecommendation && (
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                background: campaign.actionRecommendation.color + '20',
                                color: campaign.actionRecommendation.color,
                                border: `1px solid ${campaign.actionRecommendation.color}40`,
                                whiteSpace: 'nowrap',
                            }}
                            title={campaign.actionRecommendation.reason}
                        >
                            {campaign.actionRecommendation.emoji} {campaign.actionRecommendation.action === 'STOP' ? 'TẮT NGAY' : campaign.actionRecommendation.action === 'SCALE' ? 'SCALE UP' : 'THEO DÕI'}
                        </span>
                    )}
                </div>
            </div>

            {/* Issues */}
            {campaign.issues.slice(0, 2).map((issue, idx) => (
                <div
                    key={idx}
                    style={{
                        ...styles.issueBox,
                        background: issue.severity === 'critical' ? '#fef2f2' : '#fffbeb',
                    }}
                >
                    <p style={{
                        ...styles.issueMessage,
                        color: issue.severity === 'critical' ? '#dc2626' : '#d97706',
                    }}>
                        {issue.message}
                    </p>
                    <p style={styles.issueDetail}>{issue.detail}</p>
                    <p style={styles.issueAction}>→ {issue.action}</p>
                </div>
            ))}

            {/* Metrics + AI Button Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <div style={styles.metricsRow}>
                    <span>Chi tiêu: <strong>{formatMoney(campaign.totals.spend)}</strong></span>
                    <span>Đơn: <strong>{campaign.totals.purchases}</strong></span>
                    <span>CPP: <strong>{formatMoney(campaign.totals.cpp)}</strong></span>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onSelect(); }}
                    style={{
                        background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}
                >
                    🧠 Phân tích
                </button>
            </div>
        </div>
    );
}
