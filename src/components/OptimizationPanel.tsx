'use client';

import { useState } from 'react';
import styles from './OptimizationPanel.module.css';

interface ActionStep {
    action: string;
    detail: string;
    expectedResult: string;
    timeframe: string;
}

interface Playbook {
    issue: string;
    severity: 'critical' | 'warning' | 'info';
    diagnosis: string;
    immediateAction: ActionStep;
    followUpActions: ActionStep[];
    dontDo: string[];
    successMetric: string;
}

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
    frequency?: number;
}

interface Props {
    branch: BranchData | null;
    playbooks: Playbook[];
    averages: { cpp: number; ctr: number; cpm: number };
    onClose: () => void;
    onAnalyzeWithAI: () => void;
    aiAnalysis?: string;
    isLoadingAI?: boolean;
}

export default function OptimizationPanel({
    branch,
    playbooks,
    averages,
    onClose,
    onAnalyzeWithAI,
    aiAnalysis,
    isLoadingAI
}: Props) {
    const [activeTab, setActiveTab] = useState<'overview' | 'playbook' | 'ai'>('overview');
    const [expandedPlaybook, setExpandedPlaybook] = useState<number | null>(0);

    if (!branch) return null;

    const formatCurrency = (value: number) => {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${Math.round(value / 1000)}K`;
        return value.toLocaleString('vi-VN');
    };

    const cppDiff = averages.cpp > 0 ? ((branch.cpp - averages.cpp) / averages.cpp * 100) : 0;
    const ctrDiff = averages.ctr > 0 ? ((branch.ctr - averages.ctr) / averages.ctr * 100) : 0;
    const cpmDiff = averages.cpm > 0 ? ((branch.cpm - averages.cpm) / averages.cpm * 100) : 0;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.panel} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>{branch.name}</h2>
                        <p className={styles.subtitle}>Phân tích chi tiết & Kế hoạch tối ưu</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        📊 Tổng quan
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'playbook' ? styles.active : ''}`}
                        onClick={() => setActiveTab('playbook')}
                    >
                        📋 Playbook ({playbooks.length})
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'ai' ? styles.active : ''}`}
                        onClick={() => setActiveTab('ai')}
                    >
                        🤖 AI Analysis
                    </button>
                </div>

                {/* Content */}
                <div className={styles.content}>
                    {activeTab === 'overview' && (
                        <div className={styles.overview}>
                            {/* Metrics Grid */}
                            <div className={styles.metricsGrid}>
                                <MetricCard
                                    label="Chi tiêu"
                                    value={`${formatCurrency(branch.spend)}đ`}
                                />
                                <MetricCard
                                    label="Lượt mua"
                                    value={branch.purchases.toString()}
                                />
                                <MetricCard
                                    label="Chi phí/mua (CPP)"
                                    value={`${formatCurrency(branch.cpp)}đ`}
                                    diff={cppDiff}
                                    diffLabel="vs TB"
                                    isNegativeBetter
                                />
                                <MetricCard
                                    label="Doanh thu"
                                    value={`${formatCurrency(branch.revenue)}đ`}
                                />
                                <MetricCard
                                    label="ROAS"
                                    value={`${branch.roas.toFixed(2)}x`}
                                    status={branch.roas >= 1.5 ? 'good' : branch.roas >= 1 ? 'warning' : 'critical'}
                                />
                                <MetricCard
                                    label="CTR"
                                    value={`${branch.ctr.toFixed(2)}%`}
                                    diff={ctrDiff}
                                    diffLabel="vs TB"
                                />
                                <MetricCard
                                    label="CPM"
                                    value={`${formatCurrency(branch.cpm)}đ`}
                                    diff={cpmDiff}
                                    diffLabel="vs TB"
                                    isNegativeBetter
                                />
                                {branch.frequency && (
                                    <MetricCard
                                        label="Frequency"
                                        value={branch.frequency.toFixed(1)}
                                        status={branch.frequency > 3 ? 'warning' : 'good'}
                                    />
                                )}
                            </div>

                            {/* Quick Status */}
                            <div className={styles.statusBox}>
                                <h4>Tình trạng nhanh</h4>
                                {playbooks.length === 0 ? (
                                    <p className={styles.statusGood}>✅ Không có vấn đề nghiêm trọng. Tiếp tục theo dõi.</p>
                                ) : (
                                    <ul className={styles.statusList}>
                                        {playbooks.map((pb, i) => (
                                            <li key={i} className={styles[pb.severity]}>
                                                {pb.severity === 'critical' ? '🔴' : pb.severity === 'warning' ? '🟡' : '🔵'}
                                                {' '}{pb.diagnosis}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'playbook' && (
                        <div className={styles.playbookList}>
                            {playbooks.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <p>✅ Không có vấn đề cần xử lý</p>
                                    <p className={styles.muted}>Campaign đang hoạt động tốt</p>
                                </div>
                            ) : (
                                playbooks.map((pb, index) => (
                                    <div key={index} className={`${styles.playbookCard} ${styles[pb.severity]}`}>
                                        <div
                                            className={styles.playbookHeader}
                                            onClick={() => setExpandedPlaybook(expandedPlaybook === index ? null : index)}
                                        >
                                            <span className={styles.playbookTitle}>
                                                {pb.severity === 'critical' ? '🔴' : '🟡'} {pb.diagnosis}
                                            </span>
                                            <span className={styles.expandIcon}>
                                                {expandedPlaybook === index ? '▼' : '▶'}
                                            </span>
                                        </div>

                                        {expandedPlaybook === index && (
                                            <div className={styles.playbookContent}>
                                                {/* Immediate Action */}
                                                <div className={styles.immediateAction}>
                                                    <h5>⚡ Hành động ngay:</h5>
                                                    <div className={styles.actionBox}>
                                                        <strong>{pb.immediateAction.action}</strong>
                                                        <p>{pb.immediateAction.detail}</p>
                                                        <span className={styles.timeframe}>⏱️ {pb.immediateAction.timeframe}</span>
                                                    </div>
                                                </div>

                                                {/* Follow-up Actions */}
                                                <div className={styles.followUp}>
                                                    <h5>📋 Các bước tiếp theo:</h5>
                                                    {pb.followUpActions.map((action, i) => (
                                                        <div key={i} className={styles.stepCard}>
                                                            <div className={styles.stepNumber}>{i + 1}</div>
                                                            <div className={styles.stepContent}>
                                                                <strong>{action.action}</strong>
                                                                <p>{action.detail}</p>
                                                                <span className={styles.expected}>→ {action.expectedResult}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Don't Do */}
                                                <div className={styles.dontDo}>
                                                    <h5>❌ KHÔNG làm:</h5>
                                                    <ul>
                                                        {pb.dontDo.map((item, i) => (
                                                            <li key={i}>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {/* Success Metric */}
                                                <div className={styles.successMetric}>
                                                    <h5>🎯 Mục tiêu:</h5>
                                                    <p>{pb.successMetric}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className={styles.aiSection}>
                            {!aiAnalysis && !isLoadingAI && (
                                <div className={styles.aiPrompt}>
                                    <p>Để AI phân tích chi tiết và đưa ra kế hoạch tối ưu tùy chỉnh cho "{branch.name}"</p>
                                    <button
                                        className={styles.aiButton}
                                        onClick={onAnalyzeWithAI}
                                    >
                                        🤖 Phân tích với AI
                                    </button>
                                </div>
                            )}

                            {isLoadingAI && (
                                <div className={styles.aiLoading}>
                                    <div className={styles.spinner}></div>
                                    <p>AI đang phân tích...</p>
                                </div>
                            )}

                            {aiAnalysis && (
                                <div className={styles.aiResult}>
                                    <h4>🤖 AI Analysis</h4>
                                    <div className={styles.aiContent}>
                                        {aiAnalysis.split('\n').map((line, i) => (
                                            <p key={i}>{line}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Metric Card Component
function MetricCard({
    label,
    value,
    diff,
    diffLabel,
    status,
    isNegativeBetter
}: {
    label: string;
    value: string;
    diff?: number;
    diffLabel?: string;
    status?: 'good' | 'warning' | 'critical';
    isNegativeBetter?: boolean;
}) {
    const getDiffColor = () => {
        if (!diff) return '';
        const isPositive = diff > 0;
        if (isNegativeBetter) {
            return isPositive ? styles.diffBad : styles.diffGood;
        }
        return isPositive ? styles.diffGood : styles.diffBad;
    };

    return (
        <div className={`${styles.metricCard} ${status ? styles[status] : ''}`}>
            <span className={styles.metricLabel}>{label}</span>
            <span className={styles.metricValue}>{value}</span>
            {diff !== undefined && (
                <span className={`${styles.metricDiff} ${getDiffColor()}`}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(0)}% {diffLabel}
                </span>
            )}
        </div>
    );
}
