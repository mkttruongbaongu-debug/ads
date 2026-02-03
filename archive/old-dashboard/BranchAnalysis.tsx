'use client';

import { useState } from 'react';
import styles from './BranchAnalysis.module.css';

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
}

interface AnalysisData {
    causes: string[];
    recommendations: string[];
    aiInsight?: string;
}

interface Props {
    branches: BranchData[];
    averages: {
        cpp: number;
        ctr: number;
        cpm: number;
        roas: number;
    };
    summary: {
        totalSpend: number;
        totalRevenue: number;
        totalPurchases: number;
        criticalCount: number;
        warningCount: number;
        potentialSaving: number;
    };
    onSelectBranch: (branch: BranchData) => void;
}

export default function BranchAnalysis({ branches, averages, summary, onSelectBranch }: Props) {
    const [selectedStatus, setSelectedStatus] = useState<'all' | 'critical' | 'warning' | 'good'>('all');

    const criticalBranches = branches.filter(b => b.status === 'critical');
    const warningBranches = branches.filter(b => b.status === 'warning');
    const goodBranches = branches.filter(b => b.status === 'good');

    const filteredBranches = selectedStatus === 'all'
        ? branches
        : branches.filter(b => b.status === selectedStatus);

    const formatCurrency = (value: number) => {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${Math.round(value / 1000)}K`;
        return value.toLocaleString('vi-VN');
    };

    return (
        <div className={styles.container}>
            {/* Summary Cards */}
            <div className={styles.summaryRow}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Tổng chi tiêu</span>
                    <span className={styles.summaryValue}>{formatCurrency(summary.totalSpend)}đ</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Lượt mua</span>
                    <span className={styles.summaryValue}>{summary.totalPurchases}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>CPP Trung bình</span>
                    <span className={styles.summaryValue}>{formatCurrency(averages.cpp)}đ</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>ROAS</span>
                    <span className={styles.summaryValue}>{averages.roas.toFixed(2)}x</span>
                </div>
            </div>

            {/* Alert Banner */}
            {(summary.criticalCount > 0 || summary.warningCount > 0) && (
                <div className={styles.alertBanner}>
                    <div className={styles.alertContent}>
                        <span className={styles.alertIcon}>⚠️</span>
                        <span>
                            <strong>{summary.criticalCount + summary.warningCount} chi nhánh</strong> cần chú ý
                            {summary.potentialSaving > 0 && (
                                <> • Tiềm năng tiết kiệm <strong>{formatCurrency(summary.potentialSaving)}đ</strong></>
                            )}
                        </span>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className={styles.filterTabs}>
                <button
                    className={`${styles.filterTab} ${selectedStatus === 'all' ? styles.active : ''}`}
                    onClick={() => setSelectedStatus('all')}
                >
                    Tất cả ({branches.length})
                </button>
                <button
                    className={`${styles.filterTab} ${styles.critical} ${selectedStatus === 'critical' ? styles.active : ''}`}
                    onClick={() => setSelectedStatus('critical')}
                >
                    🔴 Cần xử lý ({criticalBranches.length})
                </button>
                <button
                    className={`${styles.filterTab} ${styles.warning} ${selectedStatus === 'warning' ? styles.active : ''}`}
                    onClick={() => setSelectedStatus('warning')}
                >
                    🟡 Theo dõi ({warningBranches.length})
                </button>
                <button
                    className={`${styles.filterTab} ${styles.good} ${selectedStatus === 'good' ? styles.active : ''}`}
                    onClick={() => setSelectedStatus('good')}
                >
                    🟢 Hiệu quả ({goodBranches.length})
                </button>
            </div>

            {/* Branch List */}
            <div className={styles.branchList}>
                {filteredBranches.map((branch) => (
                    <div
                        key={branch.campaignId}
                        className={`${styles.branchCard} ${styles[branch.status]}`}
                        onClick={() => onSelectBranch(branch)}
                    >
                        <div className={styles.branchHeader}>
                            <span className={styles.branchName}>{branch.name}</span>
                            <span className={`${styles.cppBadge} ${styles[branch.status]}`}>
                                {branch.cppVsAverage > 0 ? '+' : ''}{branch.cppVsAverage}%
                            </span>
                        </div>
                        <div className={styles.branchMetrics}>
                            <div className={styles.metric}>
                                <span className={styles.metricLabel}>CPP</span>
                                <span className={styles.metricValue}>{formatCurrency(branch.cpp)}đ</span>
                            </div>
                            <div className={styles.metric}>
                                <span className={styles.metricLabel}>Chi tiêu</span>
                                <span className={styles.metricValue}>{formatCurrency(branch.spend)}đ</span>
                            </div>
                            <div className={styles.metric}>
                                <span className={styles.metricLabel}>Mua</span>
                                <span className={styles.metricValue}>{branch.purchases}</span>
                            </div>
                            <div className={styles.metric}>
                                <span className={styles.metricLabel}>ROAS</span>
                                <span className={styles.metricValue}>{branch.roas.toFixed(2)}x</span>
                            </div>
                        </div>
                        <div className={styles.branchAction}>
                            <span>Xem phân tích →</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
