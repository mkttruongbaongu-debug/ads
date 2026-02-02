'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import TrendChart from '@/components/TrendChart';

interface MetricData {
    campaignId: string;
    campaignName: string;
    status: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    // New metrics
    budget?: number;           // Ngân sách
    messages?: number;         // Số tin nhắn
    comments?: number;         // Số bình luận
    totalData?: number;        // Tổng Data (tin nhắn + bình luận)
    costPerData?: number;      // Chi phí mỗi data
    purchases?: number;        // Lượt mua
    costPerPurchase?: number;  // Chi phí mỗi lượt mua
    revenue?: number;          // Doanh thu
    adsPercent?: number;       // % ADS trên doanh thu
    conversionRate?: number;   // Tỷ lệ chốt (%)
}

interface AccountOption {
    id: string;
    name: string;
}

interface FBInsight {
    campaign_id?: string;
    campaign_name?: string;
    adset_id?: string;
    adset_name?: string;
    spend?: string;
    impressions?: string;
    clicks?: string;
    ctr?: string;
    cpc?: string;
    cpm?: string;
}

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [accounts, setAccounts] = useState<AccountOption[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>('');
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });
    const [metrics, setMetrics] = useState<MetricData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [authStatus, setAuthStatus] = useState<{
        authenticated: boolean;
        needsLogin: boolean;
        reason?: string;
    }>({ authenticated: true, needsLogin: false });
    const [aiInsights, setAiInsights] = useState<string[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<{ id: string, name: string } | null>(null);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    // Daily insights data for TrendChart (cached from API)
    const [dailyInsights, setDailyInsights] = useState<{
        date: string;
        campaign_id: string;
        spend: number;
        impressions: number;
        clicks: number;
        ctr: number;
        cpc: number;
        cpm: number;
    }[]>([]);

    // Creative preview state
    const [showCreatives, setShowCreatives] = useState(false);
    const [creatives, setCreatives] = useState<{
        ad_id: string;
        ad_name: string;
        campaign_name: string;
        caption: string;
        title: string;
        image_url: string;
        video_id: string;
        content_type: string;
        cta: string;
    }[]>([]);
    const [loadingCreatives, setLoadingCreatives] = useState(false);

    // User profile state
    const [userProfile, setUserProfile] = useState<{
        name: string;
        avatar: string;
        plan: string;
    } | null>(null);

    // Auth check - redirect nếu chưa đăng nhập
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        }
    }, [status, router]);

    // Auth loading/unauthenticated will be handled at the end of render

    // Fetch accounts on mount
    useEffect(() => {
        async function fetchAccounts() {
            try {
                setIsLoadingAccounts(true);
                const res = await fetch('/api/facebook/accounts');
                const json = await res.json();

                if (json.success && json.data) {
                    const accountList: AccountOption[] = json.data.map((acc: { id: string; name: string }) => ({
                        id: acc.id.replace('act_', ''),
                        name: acc.name || `Account ${acc.id}`,
                    }));
                    setAccounts(accountList);

                    // Auto-select first account
                    if (accountList.length > 0) {
                        setSelectedAccount(accountList[0].id);
                    }
                } else {
                    // Check if error is token-related
                    const errorMsg = json.error || 'Không thể tải danh sách tài khoản';
                    setError(errorMsg);

                    // If token error or needsLogin flag from API
                    if (json.needsLogin ||
                        errorMsg.toLowerCase().includes('token') ||
                        errorMsg.toLowerCase().includes('expired') ||
                        errorMsg.toLowerCase().includes('login')) {
                        setAuthStatus({ authenticated: false, needsLogin: true, reason: errorMsg });
                        // Auto signOut để xóa session cũ invalid, user sẽ phải đăng nhập lại
                        // signOut({ callbackUrl: '/' }); // Uncomment nếu muốn tự động logout
                    }
                }
            } catch (err) {
                console.error('Error fetching accounts:', err);
                setError('Lỗi kết nối API. Vui lòng kiểm tra .env.local');
            } finally {
                setIsLoadingAccounts(false);
            }
        }

        fetchAccounts();
    }, []);

    // Fetch user profile on mount
    useEffect(() => {
        async function fetchUserProfile() {
            try {
                const res = await fetch('/api/user');
                const json = await res.json();

                if (json.success && json.user) {
                    setUserProfile({
                        name: json.user.name || 'User',
                        avatar: json.user.avatar || '',
                        plan: json.user.plan || 'free',
                    });
                } else if (session?.user) {
                    // Fallback to session
                    setUserProfile({
                        name: session.user.name || 'User',
                        avatar: session.user.image || '',
                        plan: 'free',
                    });
                }
            } catch (err) {
                console.error('Error fetching user profile:', err);
                // Fallback to session on error
                if (session?.user) {
                    setUserProfile({
                        name: session.user.name || 'User',
                        avatar: session.user.image || '',
                        plan: 'free',
                    });
                }
            }
        }

        if (status === 'authenticated') {
            fetchUserProfile();
        }
    }, [status, session]);

    // Fetch campaign data
    const fetchData = useCallback(async () => {
        if (!selectedAccount) return;

        try {
            setIsLoading(true);
            setError(null);

            const res = await fetch(
                `/api/facebook/campaigns?accountId=${selectedAccount}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
            );
            const json = await res.json();

            if (json.success && json.data) {
                // API returns { campaigns, metrics, dateRange }
                const metricsData = json.data.metrics || json.data;
                const campaignData: MetricData[] = metricsData.map((row: {
                    campaignId?: string;
                    campaign_id?: string;
                    campaignName?: string;
                    campaign_name?: string;
                    status?: string;
                    spend?: number | string;
                    impressions?: number | string;
                    clicks?: number | string;
                    ctr?: number | string;
                    cpc?: number | string;
                    cpm?: number | string;
                    // New fields
                    daily_budget?: number | string;
                    messages?: number | string;
                    comments?: number | string;
                    purchases?: number | string;
                    purchase_value?: number | string;
                }) => {
                    const spend = typeof row.spend === 'number' ? row.spend : parseFloat(String(row.spend) || '0');
                    const messages = typeof row.messages === 'number' ? row.messages : parseInt(String(row.messages) || '0', 10);
                    const comments = typeof row.comments === 'number' ? row.comments : parseInt(String(row.comments) || '0', 10);
                    const totalData = messages + comments;
                    const costPerData = totalData > 0 ? spend / totalData : 0;
                    const purchases = typeof row.purchases === 'number' ? row.purchases : parseInt(String(row.purchases) || '0', 10);
                    const revenue = typeof row.purchase_value === 'number' ? row.purchase_value : parseFloat(String(row.purchase_value) || '0');
                    const costPerPurchase = purchases > 0 ? spend / purchases : 0;
                    const adsPercent = revenue > 0 ? (spend / revenue) * 100 : 0;

                    return {
                        campaignId: row.campaignId || row.campaign_id || '',
                        campaignName: row.campaignName || row.campaign_name || 'Unknown',
                        status: row.status || 'ACTIVE',
                        spend,
                        impressions: typeof row.impressions === 'number' ? row.impressions : parseInt(String(row.impressions) || '0', 10),
                        clicks: typeof row.clicks === 'number' ? row.clicks : parseInt(String(row.clicks) || '0', 10),
                        ctr: typeof row.ctr === 'number' ? row.ctr : parseFloat(String(row.ctr) || '0'),
                        cpc: typeof row.cpc === 'number' ? row.cpc : parseFloat(String(row.cpc) || '0'),
                        cpm: typeof row.cpm === 'number' ? row.cpm : parseFloat(String(row.cpm) || '0'),
                        // New metrics
                        budget: typeof row.daily_budget === 'number' ? row.daily_budget : parseFloat(String(row.daily_budget) || '0'),
                        messages,
                        comments,
                        totalData,
                        costPerData,
                        purchases,
                        costPerPurchase,
                        revenue,
                        adsPercent,
                        conversionRate: totalData > 0 ? (purchases / totalData) * 100 : 0,
                    };
                });
                setMetrics(campaignData);

                // Generate simple AI insights based on data
                generateInsights(campaignData);

                // Auto-sync to Google Sheets
                syncToSheets(campaignData);

                // Fetch daily insights for TrendChart (song song)
                fetchDailyInsights();
            } else {
                setError(json.error || 'Không thể tải dữ liệu campaigns');
            }
        } catch (err) {
            console.error('Error fetching campaigns:', err);
            setError('Lỗi khi tải dữ liệu campaigns');
        } finally {
            setIsLoading(false);
        }
    }, [selectedAccount, dateRange]);

    // Fetch daily insights for TrendChart - gọi 1 lần và cache
    const fetchDailyInsights = useCallback(async () => {
        if (!selectedAccount) return;

        try {
            const res = await fetch(
                `/api/facebook/insights?accountId=${selectedAccount}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
            );
            const json = await res.json();

            if (json.success && json.data) {
                const insights = json.data.map((row: {
                    date_start?: string;
                    campaign_id?: string;
                    spend?: number;
                    impressions?: number;
                    clicks?: number;
                    ctr?: number;
                    cpc?: number;
                    cpm?: number;
                }) => ({
                    date: row.date_start || '',
                    campaign_id: row.campaign_id || '',
                    spend: row.spend || 0,
                    impressions: row.impressions || 0,
                    clicks: row.clicks || 0,
                    ctr: row.ctr || 0,
                    cpc: row.cpc || 0,
                    cpm: row.cpm || 0,
                }));
                setDailyInsights(insights);
                console.log(`📊 Daily insights loaded: ${insights.length} records`);
            }
        } catch (err) {
            console.error('Error fetching daily insights:', err);
        }
    }, [selectedAccount, dateRange]);

    // Sync to Google Sheets via Apps Script - DAILY DATA
    const syncToSheets = async (_data: MetricData[]) => {
        if (!selectedAccount) return;

        try {
            setSyncStatus('syncing');

            const accountName = accounts.find(a => a.id === selectedAccount)?.name || 'Unknown';

            // Fetch DAILY insights data (with time_increment=1)
            const dailyRes = await fetch(
                `/api/facebook/insights?accountId=${selectedAccount}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
            );
            const dailyJson = await dailyRes.json();

            if (!dailyJson.success || !dailyJson.data || dailyJson.data.length === 0) {
                console.warn('No daily insights data available');
                setSyncStatus('error');
                return;
            }

            // Prepare rows - COMPREHENSIVE METRICS (50+ fields)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rows = dailyJson.data.map((row: any) => [
                // Identification (7 cols)
                row.date,
                selectedAccount.replace('act_', ''),
                accountName,
                row.campaign_id,
                row.campaign_name,
                row.status,
                row.objective || '',

                // Spend & Reach (4 cols)
                row.spend || 0,
                row.impressions || 0,
                row.reach || 0,
                row.frequency || 0,

                // Clicks & CTR (6 cols)
                row.clicks || 0,
                row.unique_clicks || 0,
                row.link_clicks || 0,
                row.unique_link_clicks || 0,
                row.ctr || 0,
                row.link_ctr || 0,

                // Cost Metrics (4 cols)
                row.cpc || 0,
                row.cost_per_unique_click || 0,
                row.cost_per_link_click || 0,
                row.cpm || 0,

                // Landing Page (2 cols)
                row.landing_page_views || 0,
                row.cost_per_landing_page_view || 0,

                // E-commerce Funnel (11 cols)
                row.view_content || 0,
                row.cost_per_view_content || 0,
                row.add_to_cart || 0,
                row.add_to_cart_value || 0,
                row.cost_per_add_to_cart || 0,
                row.initiate_checkout || 0,
                row.cost_per_checkout || 0,
                row.purchases || 0,
                row.purchase_value || 0,
                row.cost_per_purchase || 0,

                // Derived E-commerce KPIs (6 cols)
                row.aov || 0,                    // Average Order Value
                row.cac || 0,                    // Customer Acquisition Cost
                row.cvr || 0,                    // Conversion Rate (%)
                row.roas || 0,                   // Return on Ad Spend
                row.gross_profit || 0,           // Revenue - Spend
                row.profit_margin || 0,          // (%)

                // Funnel Rates (3 cols)
                row.add_to_cart_rate || 0,       // ATC / View Content (%)
                row.checkout_rate || 0,          // IC / ATC (%)
                row.purchase_rate || 0,          // Purchase / IC (%)

                // Engagement (6 cols)
                row.post_engagement || 0,
                row.engagement_rate || 0,
                row.cost_per_engagement || 0,
                row.reactions || 0,
                row.comments || 0,
                row.saves || 0,

                // Messaging (2 cols)
                row.messages || 0,
                row.cost_per_message || 0,

                // Video (8 cols)
                row.video_plays || 0,
                row.video_thruplay || 0,
                row.video_p25 || 0,
                row.video_p50 || 0,
                row.video_p75 || 0,
                row.video_p100 || 0,
                row.video_completion_rate || 0,
                row.video_hook_rate || 0,

                // Lead Gen (4 cols)
                row.leads || 0,
                row.cost_per_lead || 0,
                row.registrations || 0,
                row.cost_per_registration || 0,
            ]);

            // Call our API proxy - will sync all daily rows
            const response = await fetch('/api/sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'append', // Use append to add all rows without duplicate check
                    sheetName: 'Campaigns',
                    rows,
                }),
            });

            const result = await response.json();

            if (result.success) {
                setSyncStatus('success');
                setLastSyncTime(new Date().toLocaleTimeString('vi-VN'));
                console.log('✅ Synced to Sheets:', result);
            } else {
                console.error('Sync error:', result.error);
                setSyncStatus('error');
            }
        } catch (err) {
            console.error('Sync failed:', err);
            setSyncStatus('error');
        }
    };

    // Generate basic AI insights
    const generateInsights = (data: MetricData[]) => {
        const insights: string[] = [];

        if (data.length === 0) {
            insights.push('📊 Chưa có dữ liệu campaign trong khoảng thời gian này');
            setAiInsights(insights);
            return;
        }

        const totalSpend = data.reduce((sum, m) => sum + m.spend, 0);
        const totalClicks = data.reduce((sum, m) => sum + m.clicks, 0);
        const totalImpressions = data.reduce((sum, m) => sum + m.impressions, 0);
        const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

        if (avgCTR > 1.5) {
            insights.push(`📈 CTR trung bình đang ở mức tốt (${avgCTR.toFixed(2)}%), cao hơn benchmark ngành (1.5%)`);
        } else {
            insights.push(`⚠️ CTR trung bình (${avgCTR.toFixed(2)}%) thấp hơn benchmark ngành (1.5%)`);
        }

        const lowestCPC = data.filter(m => m.cpc > 0).sort((a, b) => a.cpc - b.cpc)[0];
        if (lowestCPC) {
            insights.push(`💡 Campaign "${lowestCPC.campaignName}" có CPC thấp nhất, cân nhắc tăng budget`);
        }

        const pausedCampaigns = data.filter(m => m.status === 'PAUSED');
        if (pausedCampaigns.length > 0) {
            insights.push(`⏸️ ${pausedCampaigns.length} campaigns đang tạm dừng, nên review lại`);
        }

        setAiInsights(insights);
    };

    // Fetch creatives from API
    const fetchCreatives = async () => {
        if (!selectedAccount) return;

        setLoadingCreatives(true);
        try {
            const res = await fetch(`/api/facebook/creatives?accountId=${selectedAccount}`);
            const json = await res.json();
            if (json.success) {
                setCreatives(json.data);
                setShowCreatives(true);
            } else {
                alert('Lỗi: ' + json.error);
            }
        } catch (e) {
            console.error(e);
            alert('Không thể tải creative data');
        } finally {
            setLoadingCreatives(false);
        }
    };

    // Calculate summary metrics
    const totalSpend = metrics.reduce((sum, m) => sum + m.spend, 0);
    const totalClicks = metrics.reduce((sum, m) => sum + m.clicks, 0);
    const totalImpressions = metrics.reduce((sum, m) => sum + m.impressions, 0);
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat('vi-VN').format(value);
    };

    // Handle auth states in render
    if (status === "loading") {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-bg-primary)',
            }}>
                <div className="spinner"></div>
                <span style={{ marginLeft: '12px', color: 'var(--color-text-secondary)' }}>Đang kiểm tra đăng nhập...</span>
            </div>
        );
    }

    if (status === "unauthenticated") {
        return null;
    }

    return (
        <div className="app-container">
            {/* Header */}
            <header className="header">
                <div className="header-content">
                    <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
                        <span>QUÂN SƯ ADS</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {isLoadingAccounts ? (
                            <span className="badge" style={{ background: '#666' }}>● Loading...</span>
                        ) : accounts.length > 0 ? (
                            <span className="badge badge-active">● Connected ({accounts.length} accounts)</span>
                        ) : (
                            <span className="badge" style={{ background: '#ff4444' }}>● Disconnected</span>
                        )}

                        {/* Login Button - khi cần đăng nhập lại */}
                        {authStatus.needsLogin && (
                            <a
                                href="/api/auth/facebook"
                                className="btn btn-primary"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: '#1877f2',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    color: 'white',
                                    fontWeight: 600,
                                }}
                            >
                                🔐 Đăng nhập Facebook
                            </a>
                        )}

                        {/* Sync Status */}
                        {syncStatus === 'syncing' && (
                            <span className="badge" style={{ background: '#f39c12' }}>⏳ Syncing...</span>
                        )}
                        {syncStatus === 'success' && (
                            <span className="badge" style={{ background: '#27ae60' }}>
                                ✅ Synced {lastSyncTime && `@ ${lastSyncTime}`}
                            </span>
                        )}
                        {syncStatus === 'error' && (
                            <span className="badge" style={{ background: '#e74c3c' }}>❌ Sync Failed</span>
                        )}

                        {/* User Profile */}
                        {userProfile && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.25rem 0.75rem',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '20px',
                            }}>
                                {userProfile.avatar ? (
                                    <img
                                        src={userProfile.avatar}
                                        alt={userProfile.name}
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            border: '2px solid rgba(255,255,255,0.3)'
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: '#1877f2',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        color: 'white'
                                    }}>
                                        {userProfile.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                    <span style={{
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        color: 'white'
                                    }}>
                                        {userProfile.name}
                                    </span>
                                    <span style={{
                                        fontSize: '0.65rem',
                                        padding: '1px 6px',
                                        borderRadius: '8px',
                                        background: userProfile.plan === 'pro' ? '#f39c12' :
                                            userProfile.plan === 'premium' ? '#9b59b6' : '#27ae60',
                                        color: 'white',
                                        fontWeight: 500,
                                        textTransform: 'uppercase',
                                        width: 'fit-content'
                                    }}>
                                        {userProfile.plan}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Nút Đăng xuất */}
                        <button
                            onClick={() => signOut({ callbackUrl: '/' })}
                            style={{
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.3)',
                                color: 'white',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                            }}
                        >
                            Đăng xuất
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="main-content">
                {/* Auth Status Alert */}
                {authStatus.needsLogin ? (
                    <div style={{
                        background: 'rgba(255,193,7,0.15)',
                        border: '1px solid #ffc107',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1rem',
                        color: '#ffc107',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem'
                    }}>
                        <span>🔑 Vui lòng đăng nhập Facebook để xem dữ liệu quảng cáo</span>
                        <a
                            href="/api/auth/facebook"
                            style={{
                                background: '#1877f2',
                                color: 'white',
                                padding: '0.5rem 1rem',
                                borderRadius: '6px',
                                textDecoration: 'none',
                                fontWeight: 600,
                                fontSize: '0.9rem'
                            }}
                        >
                            🔐 Đăng nhập ngay
                        </a>
                    </div>
                ) : error && !authStatus.needsLogin ? (
                    <div style={{
                        background: 'rgba(255,68,68,0.1)',
                        border: '1px solid #ff4444',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1rem',
                        color: '#ff4444'
                    }}>
                        ⚠️ {error}
                    </div>
                ) : null}

                {/* Filters */}
                <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label className="metric-label" style={{ marginBottom: 'var(--space-xs)', display: 'block' }}>
                                Tài khoản quảng cáo
                            </label>
                            <select
                                className="select"
                                value={selectedAccount}
                                onChange={(e) => setSelectedAccount(e.target.value)}
                                disabled={isLoadingAccounts}
                            >
                                <option value="">Chọn tài khoản...</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ minWidth: '150px' }}>
                            <label className="metric-label" style={{ marginBottom: 'var(--space-xs)', display: 'block' }}>
                                Từ ngày
                            </label>
                            <input
                                type="date"
                                className="input"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                            />
                        </div>
                        <div style={{ minWidth: '150px' }}>
                            <label className="metric-label" style={{ marginBottom: 'var(--space-xs)', display: 'block' }}>
                                Đến ngày
                            </label>
                            <input
                                type="date"
                                className="input"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                            <button
                                className="btn btn-primary"
                                onClick={fetchData}
                                disabled={isLoading || !selectedAccount}
                            >
                                {isLoading ? <div className="spinner" style={{ width: '16px', height: '16px' }}></div> : '🔄 Tải dữ liệu'}
                            </button>
                            <button
                                className="btn"
                                onClick={fetchCreatives}
                                disabled={loadingCreatives || !selectedAccount}
                                style={{
                                    background: 'linear-gradient(135deg, #9b59b6, #8e44ad)',
                                    border: 'none'
                                }}
                            >
                                {loadingCreatives ? <div className="spinner" style={{ width: '16px', height: '16px' }}></div> : '🎨 Xem Creative'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Metric Cards */}
                <div className="grid grid-4" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div className="metric-card">
                        <span className="metric-label">Tổng chi tiêu</span>
                        <span className="metric-value">{formatCurrency(totalSpend)}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">Tổng Impressions</span>
                        <span className="metric-value">{formatNumber(totalImpressions)}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">Tổng Clicks</span>
                        <span className="metric-value">{formatNumber(totalClicks)}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">CTR Trung bình</span>
                        <span className="metric-value">{avgCTR.toFixed(2)}%</span>
                    </div>
                </div>

                {/* AI Insights Panel */}
                {aiInsights.length > 0 && (
                    <div className="ai-panel" style={{ marginBottom: 'var(--space-xl)' }}>
                        <div className="ai-panel-header">
                            <div className="ai-icon">🤖</div>
                            <span className="card-title">AI Insights</span>
                        </div>
                        <ul className="ai-insights">
                            {aiInsights.map((insight, index) => (
                                <li key={index} className="ai-insight-item">{insight}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Data Table */}
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h2 className="card-title">Campaigns</h2>
                            <p className="card-subtitle">
                                {metrics.length} campaigns {selectedAccount ? '' : '- Chọn tài khoản và nhấn "Tải dữ liệu"'}
                            </p>
                        </div>
                        <button className="btn btn-secondary" disabled={metrics.length === 0}>📥 Export CSV</button>
                    </div>
                    <div className="table-container" style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Campaign</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Chi tiêu</th>
                                    <th style={{ textAlign: 'right' }}>CPM</th>
                                    <th style={{ textAlign: 'right' }}>CPC</th>
                                    <th style={{ textAlign: 'right' }}>CTR</th>
                                    <th style={{ textAlign: 'right' }} title="Tổng số Data (tin nhắn + bình luận)">Leads</th>
                                    <th style={{ textAlign: 'right' }} title="Cost Per Lead - Chi phí mỗi data">CPL</th>
                                    <th style={{ textAlign: 'right' }} title="Số lượt mua hàng">Sales</th>
                                    <th style={{ textAlign: 'right' }} title="Conversion Rate - Tỷ lệ chốt (Sales/Leads)">CVR</th>
                                    <th style={{ textAlign: 'right' }} title="Customer Acquisition Cost - Chi phí có 1 khách">CAC</th>
                                    <th style={{ textAlign: 'right' }} title="Doanh thu từ mua hàng">Revenue</th>
                                    <th style={{ textAlign: 'right' }} title="Advertising Cost of Sales - % Chi phí QC/Doanh thu">ACoS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metrics.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                                            {isLoading ? 'Đang tải...' : 'Chọn tài khoản và nhấn "Tải dữ liệu" để xem campaigns'}
                                        </td>
                                    </tr>
                                ) : (
                                    metrics.map((row) => (
                                        <tr
                                            key={row.campaignId}
                                            onClick={() => setSelectedCampaign({ id: row.campaignId, name: row.campaignName })}
                                            style={{ cursor: 'pointer' }}
                                            title="Click để xem diễn biến"
                                        >
                                            <td style={{ fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                📊 {row.campaignName}
                                            </td>
                                            <td>
                                                <span className={`badge badge-${row.status.toLowerCase()}`}>
                                                    {row.status === 'ACTIVE' ? '●' : '○'} {row.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                                {formatCurrency(row.spend)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                                {formatCurrency(row.cpm)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                                {formatCurrency(row.cpc)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                                {row.ctr.toFixed(2)}%
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: (row.totalData || 0) > 0 ? '#2ecc71' : '#888' }}>
                                                {formatNumber(row.totalData || 0)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                                {formatCurrency(row.costPerData || 0)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: (row.purchases || 0) > 0 ? '#2ecc71' : '#888' }}>
                                                {formatNumber(row.purchases || 0)}
                                            </td>
                                            <td style={{
                                                textAlign: 'right',
                                                fontFamily: 'var(--font-mono)',
                                                fontWeight: 600,
                                                color: (row.conversionRate || 0) > 5 ? '#2ecc71' : (row.conversionRate || 0) > 2 ? '#f39c12' : '#888'
                                            }}>
                                                {(row.conversionRate || 0).toFixed(2)}%
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                                {formatCurrency(row.costPerPurchase || 0)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: (row.revenue || 0) > 0 ? '#27ae60' : '#888' }}>
                                                {formatCurrency(row.revenue || 0)}
                                            </td>
                                            <td style={{
                                                textAlign: 'right',
                                                fontFamily: 'var(--font-mono)',
                                                color: (row.adsPercent || 0) > 30 ? '#e74c3c' : (row.adsPercent || 0) > 15 ? '#f39c12' : '#2ecc71'
                                            }}>
                                                {(row.adsPercent || 0).toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Trend Chart Modal */}
                {selectedCampaign && (
                    <TrendChart
                        campaignId={selectedCampaign.id}
                        campaignName={selectedCampaign.name}
                        campaignData={dailyInsights
                            .filter(row => row.campaign_id === selectedCampaign.id)
                            .sort((a, b) => a.date.localeCompare(b.date))
                        }
                        onClose={() => setSelectedCampaign(null)}
                    />
                )}

                {/* Creative Gallery Modal */}
                {showCreatives && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.85)',
                        zIndex: 1000,
                        overflowY: 'auto',
                        padding: 'var(--space-xl)',
                    }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 'var(--space-lg)',
                            }}>
                                <h2 style={{
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    🎨 Creative Gallery ({creatives.length} ads)
                                </h2>
                                <button
                                    onClick={() => setShowCreatives(false)}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        color: 'white',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    ✕ Đóng
                                </button>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                                gap: 'var(--space-md)',
                            }}>
                                {creatives.map((creative, idx) => (
                                    <div key={idx} style={{
                                        background: 'var(--card-bg)',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                    }}>
                                        {/* Image/Video Preview */}
                                        {creative.image_url ? (
                                            <div style={{ position: 'relative' }}>
                                                <img
                                                    src={creative.image_url}
                                                    alt={creative.ad_name}
                                                    style={{
                                                        width: '100%',
                                                        height: '200px',
                                                        objectFit: 'cover'
                                                    }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                                {creative.content_type === 'VIDEO' && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        left: '50%',
                                                        transform: 'translate(-50%, -50%)',
                                                        background: 'rgba(0,0,0,0.7)',
                                                        borderRadius: '50%',
                                                        width: '50px',
                                                        height: '50px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '24px',
                                                    }}>
                                                        ▶️
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{
                                                height: '200px',
                                                background: 'linear-gradient(135deg, #2c3e50, #1a252f)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '48px',
                                            }}>
                                                {creative.content_type === 'VIDEO' ? '🎬' : '🖼️'}
                                            </div>
                                        )}

                                        {/* Content */}
                                        <div style={{ padding: 'var(--space-md)' }}>
                                            {/* Campaign / Ad Name */}
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--text-secondary)',
                                                marginBottom: '0.25rem',
                                            }}>
                                                📁 {creative.campaign_name}
                                            </div>
                                            <div style={{
                                                fontWeight: '600',
                                                marginBottom: 'var(--space-sm)',
                                                color: 'var(--text-primary)',
                                            }}>
                                                {creative.ad_name}
                                            </div>

                                            {/* Title */}
                                            {creative.title && (
                                                <div style={{
                                                    fontWeight: '500',
                                                    color: 'var(--primary)',
                                                    marginBottom: '0.25rem',
                                                }}>
                                                    📌 {creative.title}
                                                </div>
                                            )}

                                            {/* Caption */}
                                            {creative.caption && (
                                                <div style={{
                                                    fontSize: '0.9rem',
                                                    color: 'var(--text-secondary)',
                                                    marginBottom: 'var(--space-sm)',
                                                    maxHeight: '100px',
                                                    overflow: 'auto',
                                                    whiteSpace: 'pre-wrap',
                                                }}>
                                                    📝 {creative.caption}
                                                </div>
                                            )}

                                            {/* CTA Badge */}
                                            {creative.cta && (
                                                <span style={{
                                                    display: 'inline-block',
                                                    background: 'var(--primary)',
                                                    color: 'white',
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '500',
                                                }}>
                                                    🔗 {creative.cta}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {creatives.length === 0 && (
                                <div style={{
                                    textAlign: 'center',
                                    color: 'var(--text-secondary)',
                                    padding: 'var(--space-xl)',
                                }}>
                                    Không tìm thấy creative nào
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
