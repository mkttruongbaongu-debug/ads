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

// Styles
const styles = {
    container: {
        minHeight: '100vh',
        background: '#fafafa',
        fontFamily: 'Inter, -apple-system, sans-serif',
    },
    header: {
        background: '#18181b',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    logo: {
        fontSize: '1.125rem',
        fontWeight: 700,
        color: 'white',
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    dateInputs: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(255,255,255,0.1)',
        padding: '6px 12px',
        borderRadius: '8px',
    },
    dateInput: {
        background: 'transparent',
        border: 'none',
        color: 'white',
        fontSize: '0.875rem',
        cursor: 'pointer',
    },
    refreshBtn: {
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: 500,
    },
    logoutBtn: {
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.2)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.875rem',
    },
    main: {
        maxWidth: '900px',
        margin: '0 auto',
        padding: '24px',
    },
    summaryRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px',
    },
    summaryCard: {
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    },
    summaryLabel: {
        fontSize: '0.75rem',
        color: '#71717a',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        margin: '0 0 4px',
    },
    summaryValue: {
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#18181b',
        margin: 0,
    },
    section: {
        marginBottom: '24px',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
    },
    sectionTitle: {
        fontSize: '1rem',
        fontWeight: 600,
        color: '#18181b',
        margin: 0,
    },
    badge: {
        fontSize: '0.75rem',
        padding: '2px 8px',
        borderRadius: '10px',
        fontWeight: 500,
    },
    campaignCard: {
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        borderLeft: '4px solid',
    },
    campaignName: {
        fontSize: '1rem',
        fontWeight: 600,
        color: '#18181b',
        margin: '0 0 8px',
    },
    issueBox: {
        background: '#fef2f2',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '8px',
    },
    issueMessage: {
        fontSize: '0.875rem',
        fontWeight: 500,
        color: '#dc2626',
        margin: '0 0 4px',
    },
    issueDetail: {
        fontSize: '0.8125rem',
        color: '#71717a',
        margin: '0 0 8px',
    },
    issueAction: {
        fontSize: '0.8125rem',
        fontWeight: 500,
        color: '#059669',
        margin: 0,
    },
    metricsRow: {
        display: 'flex',
        gap: '24px',
        fontSize: '0.8125rem',
        color: '#52525b',
    },
    loader: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px 0',
        color: '#71717a',
    },
    error: {
        textAlign: 'center' as const,
        padding: '40px',
        color: '#dc2626',
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '60px 24px',
        background: 'white',
        borderRadius: '12px',
        color: '#71717a',
    },
};

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [data, setData] = useState<AnalysisData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCampaign, setSelectedCampaign] = useState<CampaignWithIssues | null>(null);

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

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(
                `/api/analysis/daily?startDate=${startDate}&endDate=${endDate}`
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
    }, [startDate, endDate, router]);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        } else if (status === 'authenticated') {
            fetchData();
        }
    }, [status, router, fetchData]);

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
                <span style={styles.logo}>QUÂN SƯ ADS</span>

                <div style={styles.headerRight}>
                    <div style={styles.dateInputs}>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={styles.dateInput}
                        />
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>→</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={styles.dateInput}
                        />
                    </div>

                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        style={{
                            ...styles.refreshBtn,
                            opacity: isLoading ? 0.6 : 1,
                        }}
                    >
                        {isLoading ? '⏳' : '🔄'} Refresh
                    </button>

                    <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        style={styles.logoutBtn}
                    >
                        Đăng xuất
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main style={styles.main}>
                {/* Error State */}
                {error && (
                    <div style={styles.error}>
                        <p>❌ {error}</p>
                        <button
                            onClick={fetchData}
                            style={{ ...styles.refreshBtn, marginTop: '16px' }}
                        >
                            Thử lại
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && !error && (
                    <div style={styles.loader}>
                        <p>⏳ Đang phân tích campaigns...</p>
                    </div>
                )}

                {/* Data */}
                {data && !isLoading && (
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
                            <div style={{ ...styles.summaryCard, borderLeft: '4px solid #dc2626' }}>
                                <p style={styles.summaryLabel}>Cần xử lý</p>
                                <p style={{ ...styles.summaryValue, color: '#dc2626' }}>
                                    {data.summary.critical}
                                </p>
                            </div>
                            <div style={{ ...styles.summaryCard, borderLeft: '4px solid #22c55e' }}>
                                <p style={styles.summaryLabel}>Đang tốt</p>
                                <p style={{ ...styles.summaryValue, color: '#22c55e' }}>
                                    {data.summary.good}
                                </p>
                            </div>
                        </div>

                        {/* Critical Section */}
                        {data.critical.length > 0 && (
                            <div style={styles.section}>
                                <div style={styles.sectionHeader}>
                                    <span style={{ fontSize: '1.25rem' }}>🔴</span>
                                    <h2 style={styles.sectionTitle}>Cần xử lý ngay</h2>
                                    <span style={{ ...styles.badge, background: '#fee2e2', color: '#dc2626' }}>
                                        {data.critical.length}
                                    </span>
                                </div>

                                {data.critical.map(campaign => (
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
                        {data.warning.length > 0 && (
                            <div style={styles.section}>
                                <div style={styles.sectionHeader}>
                                    <span style={{ fontSize: '1.25rem' }}>🟡</span>
                                    <h2 style={styles.sectionTitle}>Theo dõi</h2>
                                    <span style={{ ...styles.badge, background: '#fef3c7', color: '#d97706' }}>
                                        {data.warning.length}
                                    </span>
                                </div>

                                {data.warning.map(campaign => (
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
                        {data.good.length > 0 && (
                            <div style={styles.section}>
                                <div style={styles.sectionHeader}>
                                    <span style={{ fontSize: '1.25rem' }}>🟢</span>
                                    <h2 style={styles.sectionTitle}>Đang tốt</h2>
                                    <span style={{ ...styles.badge, background: '#dcfce7', color: '#16a34a' }}>
                                        {data.good.length}
                                    </span>
                                </div>

                                <div style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                }}>
                                    <p style={{ color: '#71717a', margin: 0 }}>
                                        {data.good.map(c => c.name).join(', ')}
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
                )}
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
