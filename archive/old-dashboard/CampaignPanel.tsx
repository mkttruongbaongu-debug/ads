'use client';

import { useState, useEffect, ReactNode } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import AIAdvisor from './AIAdvisor';

interface CampaignPanelProps {
    campaign: {
        id: string;
        name: string;
        status: string;
        spend: number;
        impressions: number;
        clicks: number;
        ctr: number;
        cpc: number;
        leads?: number;
        purchases?: number;
        revenue?: number;
    } | null;
    dateRange: { startDate: string; endDate: string };
    onClose: () => void;
}

interface DailyData {
    date: string;
    spend: number;
    clicks: number;
    impressions: number;
    ctr: number;
    leads: number;
    cpl: number;
}

interface AdsetData {
    id: string;
    name: string;
    status: string;
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
    cpl: number;
    cvr: number;
}

// Inline styles
const styles = {
    backdrop: {
        position: 'fixed' as const,
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 40,
    },
    panel: {
        position: 'fixed' as const,
        right: 0,
        top: 0,
        height: '100%',
        width: '100%',
        maxWidth: '650px',
        background: '#1a1a2e',
        zIndex: 50,
        overflowY: 'auto' as const,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        animation: 'slideIn 0.3s ease-out',
    },
    header: {
        position: 'sticky' as const,
        top: 0,
        background: '#1a1a2e',
        borderBottom: '1px solid #374151',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
    },
    title: {
        fontSize: '1.25rem',
        fontWeight: 700,
        color: 'white',
        margin: 0,
    },
    statusBadge: {
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 500,
    },
    closeBtn: {
        padding: '8px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        borderRadius: '8px',
        color: '#9ca3af',
        fontSize: '1.25rem',
        transition: 'background 0.2s',
    },
    tabsContainer: {
        display: 'flex',
        borderBottom: '1px solid #374151',
        gap: '0',
    },
    tab: {
        padding: '12px 24px',
        fontSize: '0.875rem',
        fontWeight: 500,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderBottom: '2px solid transparent',
    },
    content: {
        padding: '16px',
    },
    loader: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px 0',
        color: '#60a5fa',
    },
    trendBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        borderRadius: '12px',
        background: 'rgba(55, 65, 81, 0.5)',
        marginBottom: '24px',
    },
    metricsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px',
    },
    metricCard: {
        background: 'rgba(55, 65, 81, 0.5)',
        borderRadius: '12px',
        padding: '16px',
    },
    metricIconBox: {
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '8px',
        fontSize: '1.25rem',
    },
    metricLabel: {
        color: '#9ca3af',
        fontSize: '0.875rem',
        margin: '0 0 4px 0',
    },
    metricValue: {
        color: 'white',
        fontWeight: 700,
        fontSize: '1.125rem',
        margin: 0,
    },
    chartContainer: {
        background: 'rgba(55, 65, 81, 0.5)',
        borderRadius: '12px',
        padding: '16px',
    },
    chartTitle: {
        color: 'white',
        fontWeight: 500,
        marginBottom: '16px',
        margin: '0 0 16px 0',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse' as const,
        fontSize: '0.875rem',
    },
    tableHeader: {
        textAlign: 'left' as const,
        padding: '12px 8px',
        color: '#9ca3af',
        fontWeight: 500,
        borderBottom: '1px solid #374151',
    },
    tableCell: {
        padding: '12px 8px',
        color: 'white',
        borderBottom: '1px solid #374151',
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '40px 0',
        color: '#9ca3af',
    },
};

export default function CampaignPanel({ campaign, dateRange, onClose }: CampaignPanelProps) {
    const [dailyData, setDailyData] = useState<DailyData[]>([]);
    const [adsets, setAdsets] = useState<AdsetData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'ai' | 'adsets' | 'ads'>('overview');

    useEffect(() => {
        if (campaign) {
            fetchCampaignDetails();
        }
    }, [campaign, dateRange]);

    const fetchCampaignDetails = async () => {
        if (!campaign) return;
        setIsLoading(true);

        try {
            const [insightsRes, adsetsRes] = await Promise.all([
                fetch(`/api/facebook/campaign/${campaign.id}/insights?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
                fetch(`/api/facebook/campaign/${campaign.id}/adsets?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`)
            ]);

            const insightsJson = await insightsRes.json();
            const adsetsJson = await adsetsRes.json();

            if (insightsJson.success && insightsJson.data) {
                setDailyData(insightsJson.data);
            }

            if (adsetsJson.success && adsetsJson.data) {
                setAdsets(adsetsJson.data);
            }
        } catch (error) {
            console.error('Error fetching campaign details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateTrend = () => {
        if (dailyData.length < 3) return 'stable';
        const recent = dailyData.slice(-3);
        const older = dailyData.slice(0, 3);
        const recentAvg = recent.reduce((sum, d) => sum + d.spend, 0) / recent.length;
        const olderAvg = older.reduce((sum, d) => sum + d.spend, 0) / older.length;
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;

        if (change > 10) return 'up';
        if (change < -10) return 'down';
        return 'stable';
    };

    const trend = calculateTrend();

    if (!campaign) return null;

    const tabs = [
        { key: 'overview', label: 'Tổng quan', color: '#60a5fa' },
        { key: 'ai', label: '🧠 AI Advisor', color: '#a78bfa' },
        { key: 'adsets', label: 'Adsets', color: '#60a5fa' },
        { key: 'ads', label: 'Quảng cáo', color: '#60a5fa' },
    ];

    return (
        <>
            {/* Backdrop */}
            <div style={styles.backdrop} onClick={onClose} />

            {/* Panel */}
            <div style={styles.panel}>
                {/* Header */}
                <div style={styles.header}>
                    <div>
                        <h2 style={styles.title}>{campaign.name}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span style={{
                                ...styles.statusBadge,
                                background: campaign.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                                color: campaign.status === 'ACTIVE' ? '#4ade80' : '#9ca3af',
                            }}>
                                {campaign.status}
                            </span>
                            <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                                {dateRange.startDate} → {dateRange.endDate}
                            </span>
                        </div>
                    </div>
                    <button
                        style={styles.closeBtn}
                        onClick={onClose}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#374151'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div style={styles.tabsContainer}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as typeof activeTab)}
                            style={{
                                ...styles.tab,
                                color: activeTab === tab.key ? tab.color : '#9ca3af',
                                borderBottomColor: activeTab === tab.key ? tab.color : 'transparent',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={styles.content}>
                    {isLoading ? (
                        <div style={styles.loader}>
                            <span style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }}>⏳</span>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'overview' && (
                                <div>
                                    {/* Trend Indicator */}
                                    <div style={styles.trendBox}>
                                        <span style={{ fontSize: '2rem' }}>
                                            {trend === 'up' && '📈'}
                                            {trend === 'down' && '📉'}
                                            {trend === 'stable' && '➡️'}
                                        </span>
                                        <div>
                                            <p style={{ color: 'white', fontWeight: 500, margin: 0 }}>
                                                {trend === 'up' && 'Chi tiêu đang tăng'}
                                                {trend === 'down' && 'Chi tiêu đang giảm'}
                                                {trend === 'stable' && 'Chi tiêu ổn định'}
                                            </p>
                                            <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '4px 0 0' }}>
                                                Dựa trên {dailyData.length} ngày dữ liệu
                                            </p>
                                        </div>
                                    </div>

                                    {/* Key Metrics */}
                                    <div style={styles.metricsGrid}>
                                        <MetricCard
                                            icon="💰"
                                            label="Chi tiêu"
                                            value={`${campaign.spend.toLocaleString('vi-VN')}đ`}
                                            color="#3b82f6"
                                        />
                                        <MetricCard
                                            icon="👆"
                                            label="Clicks"
                                            value={campaign.clicks.toLocaleString()}
                                            color="#22c55e"
                                        />
                                        <MetricCard
                                            icon="🎯"
                                            label="CTR"
                                            value={`${campaign.ctr.toFixed(2)}%`}
                                            color="#a855f7"
                                        />
                                        <MetricCard
                                            icon="🛒"
                                            label="CPC"
                                            value={`${campaign.cpc.toLocaleString('vi-VN')}đ`}
                                            color="#f97316"
                                        />
                                    </div>

                                    {/* Daily Chart */}
                                    {dailyData.length > 0 && (
                                        <div style={styles.chartContainer}>
                                            <h3 style={styles.chartTitle}>Chi tiêu theo ngày</h3>
                                            <div style={{ height: '256px' }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={dailyData}>
                                                        <XAxis
                                                            dataKey="date"
                                                            stroke="#6b7280"
                                                            tick={{ fontSize: 12 }}
                                                            tickFormatter={(val) => val.slice(5)}
                                                        />
                                                        <YAxis
                                                            stroke="#6b7280"
                                                            tick={{ fontSize: 12 }}
                                                            tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                                                        />
                                                        <Tooltip
                                                            contentStyle={{
                                                                backgroundColor: '#1f2937',
                                                                border: 'none',
                                                                borderRadius: '8px'
                                                            }}
                                                            formatter={(value) => [`${Number(value || 0).toLocaleString('vi-VN')}đ`, 'Chi tiêu']}
                                                        />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="spend"
                                                            stroke="#3b82f6"
                                                            strokeWidth={2}
                                                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'ai' && (
                                <AIAdvisor
                                    campaignId={campaign.id}
                                    campaignName={campaign.name}
                                    spend={campaign.spend}
                                    clicks={campaign.clicks}
                                    ctr={campaign.ctr}
                                    cpc={campaign.cpc}
                                    leads={campaign.leads}
                                    purchases={campaign.purchases}
                                    revenue={campaign.revenue}
                                />
                            )}

                            {activeTab === 'adsets' && (
                                <div>
                                    {adsets.length > 0 ? (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={styles.table}>
                                                <thead>
                                                    <tr>
                                                        <th style={styles.tableHeader}>Adset</th>
                                                        <th style={styles.tableHeader}>Status</th>
                                                        <th style={{ ...styles.tableHeader, textAlign: 'right' }}>Chi tiêu</th>
                                                        <th style={{ ...styles.tableHeader, textAlign: 'right' }}>Clicks</th>
                                                        <th style={{ ...styles.tableHeader, textAlign: 'right' }}>CPL</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {adsets.map((adset) => (
                                                        <tr key={adset.id}>
                                                            <td style={styles.tableCell}>{adset.name}</td>
                                                            <td style={styles.tableCell}>
                                                                <span style={{
                                                                    ...styles.statusBadge,
                                                                    background: adset.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                                                                    color: adset.status === 'ACTIVE' ? '#4ade80' : '#9ca3af',
                                                                }}>
                                                                    {adset.status}
                                                                </span>
                                                            </td>
                                                            <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                                                                {adset.spend.toLocaleString('vi-VN')}đ
                                                            </td>
                                                            <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                                                                {adset.clicks.toLocaleString()}
                                                            </td>
                                                            <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                                                                {adset.cpl.toLocaleString('vi-VN')}đ
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div style={styles.emptyState}>
                                            <p>Không có dữ liệu adsets</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'ads' && (
                                <div style={styles.emptyState}>
                                    <p>🚧 Tính năng đang phát triển</p>
                                    <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>
                                        Sẽ hiển thị chi tiết từng bài quảng cáo
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Keyframes - cần thêm vào style tag */}
            <style jsx global>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
}

function MetricCard({ icon, label, value, color }: {
    icon: string;
    label: string;
    value: string;
    color: string;
}) {
    return (
        <div style={styles.metricCard}>
            <div style={{
                ...styles.metricIconBox,
                background: `${color}33`,
                color: color,
            }}>
                {icon}
            </div>
            <p style={styles.metricLabel}>{label}</p>
            <p style={styles.metricValue}>{value}</p>
        </div>
    );
}
