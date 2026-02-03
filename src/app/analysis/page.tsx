'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import BranchAnalysis from '@/components/BranchAnalysis';
import OptimizationPanel from '@/components/OptimizationPanel';
import styles from './page.module.css';

interface BranchData {
    name: string;
    campaignId: string;
    spend: number;
    purchases: number;
    cpp: number;
    revenue: number;
    roas: number;
    ctr: number;
    cpm: number;
    cppVsAverage: number;
    status: 'critical' | 'warning' | 'good';
    frequency?: number;
}

interface Playbook {
    issue: string;
    severity: 'critical' | 'warning' | 'info';
    diagnosis: string;
    immediateAction: {
        action: string;
        detail: string;
        expectedResult: string;
        timeframe: string;
    };
    followUpActions: {
        action: string;
        detail: string;
        expectedResult: string;
        timeframe: string;
    }[];
    dontDo: string[];
    successMetric: string;
}

export default function AnalysisPage() {
    const { status } = useSession();
    const router = useRouter();

    const [branches, setBranches] = useState<BranchData[]>([]);
    const [averages, setAverages] = useState({ cpp: 0, ctr: 0, cpm: 0, roas: 0 });
    const [summary, setSummary] = useState({
        totalSpend: 0,
        totalRevenue: 0,
        totalPurchases: 0,
        criticalCount: 0,
        warningCount: 0,
        potentialSaving: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selected branch for detail panel
    const [selectedBranch, setSelectedBranch] = useState<BranchData | null>(null);
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [aiAnalysis, setAiAnalysis] = useState<string>('');
    const [isLoadingAI, setIsLoadingAI] = useState(false);

    // Date range (default: last 7 days)
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });

    // Auth check
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        }
    }, [status, router]);

    // Fetch data
    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            // First get accounts
            const accountsRes = await fetch('/api/facebook/accounts');
            const accountsJson = await accountsRes.json();

            if (!accountsJson.success || !accountsJson.data?.length) {
                setError('Không tìm thấy tài khoản quảng cáo');
                return;
            }

            const accountId = accountsJson.data[0].id.replace('act_', '');

            // Fetch campaigns
            const campaignsRes = await fetch(
                `/api/facebook/campaigns?accountId=${accountId}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
            );
            const campaignsJson = await campaignsRes.json();

            if (!campaignsJson.success) {
                setError(campaignsJson.error || 'Không thể tải dữ liệu campaigns');
                return;
            }

            const metricsData = campaignsJson.data.metrics || campaignsJson.data;

            // Calculate averages
            let totalSpend = 0;
            let totalPurchases = 0;
            let totalRevenue = 0;
            let totalCtr = 0;
            let totalCpm = 0;

            metricsData.forEach((row: {
                spend?: number | string;
                purchases?: number | string;
                purchase_value?: number | string;
                ctr?: number | string;
                cpm?: number | string;
            }) => {
                totalSpend += parseFloat(String(row.spend || 0));
                totalPurchases += parseInt(String(row.purchases || 0), 10);
                totalRevenue += parseFloat(String(row.purchase_value || 0));
                totalCtr += parseFloat(String(row.ctr || 0));
                totalCpm += parseFloat(String(row.cpm || 0));
            });

            const avgCpp = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
            const avgCtr = metricsData.length > 0 ? totalCtr / metricsData.length : 0;
            const avgCpm = metricsData.length > 0 ? totalCpm / metricsData.length : 0;
            const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

            setAverages({ cpp: avgCpp, ctr: avgCtr, cpm: avgCpm, roas: avgRoas });

            // Transform to branch data
            let criticalCount = 0;
            let warningCount = 0;
            let potentialSaving = 0;

            const branchData: BranchData[] = metricsData.map((row: {
                campaign_id?: string;
                campaignId?: string;
                campaign_name?: string;
                campaignName?: string;
                spend?: number | string;
                purchases?: number | string;
                purchase_value?: number | string;
                ctr?: number | string;
                cpm?: number | string;
            }) => {
                const spend = parseFloat(String(row.spend || 0));
                const purchases = parseInt(String(row.purchases || 0), 10);
                const revenue = parseFloat(String(row.purchase_value || 0));
                const cpp = purchases > 0 ? spend / purchases : 0;
                const cppVsAverage = avgCpp > 0 ? ((cpp - avgCpp) / avgCpp) * 100 : 0;

                let status: 'critical' | 'warning' | 'good' = 'good';
                if (cppVsAverage >= 50) {
                    status = 'critical';
                    criticalCount++;
                    potentialSaving += Math.round(spend * 0.3);
                } else if (cppVsAverage >= 20) {
                    status = 'warning';
                    warningCount++;
                    potentialSaving += Math.round(spend * 0.15);
                }

                return {
                    name: row.campaign_name || row.campaignName || 'Unknown',
                    campaignId: row.campaign_id || row.campaignId || '',
                    spend,
                    purchases,
                    cpp,
                    revenue,
                    roas: spend > 0 ? revenue / spend : 0,
                    ctr: parseFloat(String(row.ctr || 0)),
                    cpm: parseFloat(String(row.cpm || 0)),
                    cppVsAverage: Math.round(cppVsAverage),
                    status
                };
            });

            // Sort by CPP descending (worst first)
            branchData.sort((a, b) => b.cpp - a.cpp);

            setBranches(branchData);
            setSummary({
                totalSpend,
                totalRevenue,
                totalPurchases,
                criticalCount,
                warningCount,
                potentialSaving
            });

        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Lỗi kết nối API');
        } finally {
            setIsLoading(false);
        }
    }, [dateRange]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchData();
        }
    }, [status, fetchData]);

    // Handle branch selection
    const handleSelectBranch = async (branch: BranchData) => {
        setSelectedBranch(branch);
        setAiAnalysis('');
        setPlaybooks([]);

        // Fetch playbooks
        try {
            const res = await fetch('/api/ai/analyze-branch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    branch: {
                        ...branch,
                        name: branch.name,
                    },
                    averages,
                    mode: 'quick'
                })
            });
            const json = await res.json();
            if (json.success && json.playbooks) {
                setPlaybooks(json.playbooks);
            }
        } catch (err) {
            console.error('Error fetching playbooks:', err);
        }
    };

    // AI Analysis
    const handleAnalyzeWithAI = async () => {
        if (!selectedBranch) return;

        setIsLoadingAI(true);
        try {
            const res = await fetch('/api/ai/analyze-branch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    branch: selectedBranch,
                    averages,
                    mode: 'ai'
                })
            });
            const json = await res.json();
            if (json.success && json.aiInsight) {
                setAiAnalysis(json.aiInsight);
            }
        } catch (err) {
            console.error('Error analyzing with AI:', err);
            setAiAnalysis('Lỗi khi phân tích với AI. Vui lòng thử lại.');
        } finally {
            setIsLoadingAI(false);
        }
    };

    if (status === "loading") {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <span>Đang tải...</span>
            </div>
        );
    }

    if (status === "unauthenticated") {
        return null;
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <button
                        className={styles.backButton}
                        onClick={() => router.push('/dashboard')}
                    >
                        ← Dashboard
                    </button>
                    <h1>CPP Analysis</h1>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.dateRange}>
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                        />
                        <span>→</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                        />
                    </div>
                    <button
                        className={styles.refreshButton}
                        onClick={fetchData}
                        disabled={isLoading}
                    >
                        {isLoading ? '⏳' : '🔄'} Refresh
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className={styles.main}>
                {error ? (
                    <div className={styles.error}>
                        <p>❌ {error}</p>
                        <button onClick={fetchData}>Thử lại</button>
                    </div>
                ) : isLoading ? (
                    <div className={styles.loadingContainer}>
                        <div className={styles.spinner}></div>
                        <span>Đang phân tích dữ liệu...</span>
                    </div>
                ) : (
                    <BranchAnalysis
                        branches={branches}
                        averages={averages}
                        summary={summary}
                        onSelectBranch={handleSelectBranch}
                    />
                )}
            </main>

            {/* Optimization Panel */}
            {selectedBranch && (
                <OptimizationPanel
                    branch={selectedBranch}
                    playbooks={playbooks}
                    averages={averages}
                    onClose={() => setSelectedBranch(null)}
                    onAnalyzeWithAI={handleAnalyzeWithAI}
                    aiAnalysis={aiAnalysis}
                    isLoadingAI={isLoadingAI}
                />
            )}
        </div>
    );
}
