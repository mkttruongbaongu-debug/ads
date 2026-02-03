'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
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

// Glassmorphism Design System
const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        fontFamily: 'Inter, -apple-system, sans-serif',
        color: '#ffffff',
    },
    header: {
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        position: 'sticky' as const,
        top: 0,
        zIndex: 100,
    },
    headerTop: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    logo: {
        fontSize: '1.75rem',
        fontWeight: 800,
        background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
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
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.1em',
        fontWeight: 600,
    },
    selectInput: {
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '12px',
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
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(8px)',
        padding: '10px 16px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)',
    },
    dateInput: {
        background: 'transparent',
        border: 'none',
        color: 'white',
        fontSize: '0.875rem',
        cursor: 'pointer',
        outline: 'none',
    },
    searchBtn: {
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
        color: 'white',
        border: 'none',
        padding: '14px 32px',
        borderRadius: '12px',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: 600,
        boxShadow: '0 8px 32px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    logoutBtn: {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: 'rgba(255,255,255,0.7)',
        padding: '10px 20px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '0.85rem',
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(8px)',
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
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(16px)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        transition: 'all 0.3s ease',
    },
    summaryLabel: {
        fontSize: '0.75rem',
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        margin: '0 0 8px',
        fontWeight: 500,
    },
    summaryValue: {
        fontSize: '1.75rem',
        fontWeight: 700,
        color: '#ffffff',
        margin: 0,
        letterSpacing: '-0.02em',
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
        fontWeight: 600,
        color: 'rgba(255,255,255,0.9)',
        margin: 0,
    },
    badge: {
        fontSize: '0.75rem',
        padding: '4px 12px',
        borderRadius: '20px',
        fontWeight: 600,
        backdropFilter: 'blur(4px)',
    },
    campaignCard: {
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '16px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        borderLeft: '4px solid',
    },
    campaignName: {
        fontSize: '1.05rem',
        fontWeight: 600,
        color: '#ffffff',
        margin: '0 0 12px',
    },
    issueBox: {
        background: 'rgba(239, 68, 68, 0.1)',
        backdropFilter: 'blur(8px)',
        borderRadius: '12px',
        padding: '14px',
        marginBottom: '12px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
    },
    issueMessage: {
        fontSize: '0.9rem',
        fontWeight: 600,
        color: '#fca5a5',
        margin: '0 0 6px',
    },
    issueDetail: {
        fontSize: '0.8rem',
        color: 'rgba(255,255,255,0.6)',
        margin: '0 0 10px',
    },
    issueAction: {
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#34d399',
        margin: 0,
    },
    metricsRow: {
        display: 'flex',
        gap: '24px',
        fontSize: '0.85rem',
        color: 'rgba(255,255,255,0.6)',
    },
    loader: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '100px 0',
        color: 'rgba(255,255,255,0.5)',
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

    // Fetch ad accounts
    const fetchAccounts = useCallback(async () => {
        setIsLoadingAccounts(true);
        try {
            const res = await fetch('/api/facebook/accounts');
            const json = await res.json();
            if (json.success && json.data) {
                setAccounts(json.data);
                // Auto-select first active account
                const firstActive = json.data.find((a: AdAccount) => a.isActive);
                if (firstActive && !selectedAccountId) {
                    setSelectedAccountId(firstActive.id);
                }
            }
        } catch (err) {
            console.error('Failed to fetch accounts:', err);
        } finally {
            setIsLoadingAccounts(false);
        }
    }, [selectedAccountId]);

    const fetchData = useCallback(async () => {
        if (!selectedAccountId) return;

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(
                `/api/analysis/daily?startDate=${startDate}&endDate=${endDate}&accountId=${selectedAccountId}`
            );
            const json = await res.json();

            if (!json.success) {
                if (json.needsLogin) {
                    router.push('/');
                    return;
                }
                throw new Error(json.error);
            }

            setData(json.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate, selectedAccountId, router]);

    // Track if user has searched
    const [hasSearched, setHasSearched] = useState(false);

    // Handle search button click
    const handleSearch = useCallback(() => {
        setHasSearched(true);
        fetchData();
    }, [fetchData]);

    // Load accounts on mount
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        } else if (status === 'authenticated') {
            fetchAccounts();
        }
    }, [status, router, fetchAccounts]);

    // NO auto-fetch - user must click "Tra cứu" button

    if (status === 'loading' || status === 'unauthenticated') {
        return (
            <div style={styles.loader}>
                <p>Đang tải...</p>
            </div>
        );
    }

    const formatMoney = (amount: number) => {
        if (amount >= 1000000) {
            return (amount / 1000000).toFixed(1) + 'tr';
        }
        return amount.toLocaleString('vi-VN') + 'đ';
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <header style={styles.header}>
                {/* Top Row: Logo + Logout */}
                <div style={styles.headerTop}>
                    <span style={styles.logo}>⚡ QUÂN SƯ ADS</span>
                    <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        style={styles.logoutBtn}
                    >
                        Đăng xuất
                    </button>
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
                                accounts.map(acc => (
                                    <option key={acc.id} value={acc.id} style={{ color: '#18181b' }}>
                                        {acc.name} {!acc.isActive ? '(Inactive)' : ''}
                                    </option>
                                ))
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
                            {isLoading ? '⏳ Đang tải...' : '🔍 Tra cứu'}
                        </button>
                    </div>
                </div>
            </header>

            {/* Filter Bar */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                padding: '16px 32px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
                <input
                    type="text"
                    placeholder="🔍 Lọc campaigns theo tên..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    style={{
                        width: '100%',
                        maxWidth: '400px',
                        padding: '12px 18px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'white',
                        outline: 'none',
                    }}
                />
            </div>

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

                    return (
                        <>
                            {/* Summary Row */}
                            <div style={styles.summaryRow}>
                                <div style={styles.summaryCard}>
                                    <p style={styles.summaryLabel}>Tổng chi tiêu</p>
                                    <p style={styles.summaryValue}>{formatMoney(data.summary.totalSpend)}</p>
                                </div>
                                <div style={styles.summaryCard}>
                                    <p style={styles.summaryLabel}>Doanh thu</p>
                                    <p style={styles.summaryValue}>{formatMoney(data.summary.totalRevenue)}</p>
                                </div>
                                <div style={{ ...styles.summaryCard, borderLeft: '4px solid #f87171' }}>
                                    <p style={styles.summaryLabel}>Cần xử lý</p>
                                    <p style={{ ...styles.summaryValue, color: '#f87171' }}>
                                        {data.summary.critical}
                                    </p>
                                </div>
                                <div style={{ ...styles.summaryCard, borderLeft: '4px solid #4ade80' }}>
                                    <p style={styles.summaryLabel}>Đang tốt</p>
                                    <p style={{ ...styles.summaryValue, color: '#4ade80' }}>
                                        {data.summary.good}
                                    </p>
                                </div>
                            </div>

                            {/* Critical Section */}
                            {filteredCritical.length > 0 && (
                                <div style={styles.section}>
                                    <div style={styles.sectionHeader}>
                                        <span style={{ fontSize: '1.25rem' }}>🔴</span>
                                        <h2 style={styles.sectionTitle}>Cần xử lý ngay</h2>
                                        <span style={{ ...styles.badge, background: 'rgba(248,113,113,0.2)', color: '#fca5a5' }}>
                                            {filteredCritical.length}
                                        </span>
                                    </div>

                                    {filteredCritical.map(campaign => (
                                        <CampaignCard
                                            key={campaign.id}
                                            campaign={campaign}
                                            borderColor="#dc2626"
                                            formatMoney={formatMoney}
                                            onSelect={() => setSelectedCampaign(campaign)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Warning Section */}
                            {filteredWarning.length > 0 && (
                                <div style={styles.section}>
                                    <div style={styles.sectionHeader}>
                                        <span style={{ fontSize: '1.25rem' }}>🟡</span>
                                        <h2 style={styles.sectionTitle}>Theo dõi</h2>
                                        <span style={{ ...styles.badge, background: 'rgba(251,191,36,0.2)', color: '#fcd34d' }}>
                                            {filteredWarning.length}
                                        </span>
                                    </div>

                                    {filteredWarning.map(campaign => (
                                        <CampaignCard
                                            key={campaign.id}
                                            campaign={campaign}
                                            borderColor="#f59e0b"
                                            formatMoney={formatMoney}
                                            onSelect={() => setSelectedCampaign(campaign)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Good Section */}
                            {filteredGood.length > 0 && (
                                <div style={styles.section}>
                                    <div style={styles.sectionHeader}>
                                        <span style={{ fontSize: '1.25rem' }}>🟢</span>
                                        <h2 style={styles.sectionTitle}>Đang tốt</h2>
                                        <span style={{ ...styles.badge, background: 'rgba(74,222,128,0.2)', color: '#4ade80' }}>
                                            {filteredGood.length}
                                        </span>
                                    </div>

                                    <div style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        backdropFilter: 'blur(12px)',
                                        borderRadius: '16px',
                                        padding: '20px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                    }}>
                                        <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                                            {filteredGood.map(c => c.name).join(', ')}
                                        </p>
                                    </div>
                                </div>
                            )}

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
}: {
    campaign: CampaignWithIssues;
    borderColor: string;
    formatMoney: (n: number) => string;
    onSelect: () => void;
}) {
    return (
        <div
            style={{ ...styles.campaignCard, borderLeftColor: borderColor }}
            onClick={onSelect}
        >
            <h3 style={styles.campaignName}>{campaign.name}</h3>

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
