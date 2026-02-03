'use client';

import { useState } from 'react';
import { Brain, Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Zap, Target, DollarSign, RefreshCw } from 'lucide-react';

interface CampaignData {
    id: string;
    name: string;
    status: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm?: number;
    leads?: number;
    cpl?: number;
    purchases?: number;
    revenue?: number;
    cvr?: number;
    cac?: number;
    acos?: number;
}

interface DailyTrend {
    date: string;
    spend: number;
    leads: number;
    cpl: number;
}

interface AIInsight {
    type: 'success' | 'warning' | 'danger' | 'info';
    title: string;
    message: string;
    action?: string;
}

interface AIAdvisorProps {
    campaign: CampaignData;
    dailyTrends?: DailyTrend[];
    onClose?: () => void;
}

interface UsageData {
    input_tokens: number;
    cached_tokens: number;
    output_tokens: number;
    cost_usd: number;
    cost_vnd: number;
}

export default function AIAdvisor({ campaign, dailyTrends = [] }: AIAdvisorProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [insights, setInsights] = useState<AIInsight[]>([]);
    const [aiAdvice, setAiAdvice] = useState<string>('');
    const [usage, setUsage] = useState<UsageData | null>(null);

    const analyzeWithAI = async () => {
        setIsAnalyzing(true);
        setInsights([]);
        setAiAdvice('');

        try {
            // Local analysis first (instant)
            const localInsights = generateLocalInsights(campaign, dailyTrends);
            setInsights(localInsights);

            // Then call Gemini for deep analysis
            const response = await fetch('/api/ai/analyze-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaign,
                    dailyTrends,
                    insights: localInsights
                })
            });

            const json = await response.json();
            if (json.success && json.advice) {
                setAiAdvice(json.advice);

                // Set usage data
                if (json.usage) {
                    setUsage(json.usage);

                    // Log usage to backend (fire and forget)
                    fetch('/api/ai/usage', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: 'default', // TODO: Get from auth context
                            action: 'analyze_campaign',
                            inputTokens: json.usage.input_tokens,
                            cachedTokens: json.usage.cached_tokens,
                            outputTokens: json.usage.output_tokens,
                            costUsd: json.usage.cost_usd,
                            costVnd: json.usage.cost_vnd
                        })
                    }).catch(console.error);
                }
            }
        } catch (error) {
            console.error('AI analysis error:', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Generate insights locally (instant, no API call)
    const generateLocalInsights = (camp: CampaignData, trends: DailyTrend[]): AIInsight[] => {
        const results: AIInsight[] = [];

        // 1. CPL Analysis
        const cpl = camp.leads && camp.leads > 0 ? camp.spend / camp.leads : 0;
        if (cpl > 100000) {
            results.push({
                type: 'danger',
                title: '🔴 CPL quá cao',
                message: `Chi phí mỗi data đang ở mức ${(cpl / 1000).toFixed(0)}k - cao hơn benchmark 100k`,
                action: 'Xem xét tối ưu targeting hoặc thay đổi content'
            });
        } else if (cpl > 50000) {
            results.push({
                type: 'warning',
                title: '🟡 CPL cần theo dõi',
                message: `CPL ${(cpl / 1000).toFixed(0)}k - đang ở mức trung bình`,
                action: 'Test thêm các góc content mới để tối ưu'
            });
        } else if (cpl > 0) {
            results.push({
                type: 'success',
                title: '🟢 CPL tốt',
                message: `CPL ${(cpl / 1000).toFixed(0)}k - hiệu quả tốt, có thể scale`,
                action: 'Tăng ngân sách 20-30% để scale'
            });
        }

        // 2. CTR Analysis
        if (camp.ctr < 1) {
            results.push({
                type: 'danger',
                title: '⚠️ CTR quá thấp',
                message: `CTR ${camp.ctr.toFixed(2)}% - content không thu hút`,
                action: 'Thay thumbnail/headline mới theo style Alex Hormozi'
            });
        } else if (camp.ctr > 3) {
            results.push({
                type: 'success',
                title: '🎯 CTR xuất sắc',
                message: `CTR ${camp.ctr.toFixed(2)}% - content đang viral`,
                action: 'Duplicate ad này sang các adsets khác'
            });
        }

        // 3. Trend Analysis
        if (trends.length >= 3) {
            const recent = trends.slice(-3);
            const older = trends.slice(0, Math.min(3, trends.length - 3));

            if (older.length > 0) {
                const recentAvgCpl = recent.reduce((sum, t) => sum + t.cpl, 0) / recent.length;
                const olderAvgCpl = older.reduce((sum, t) => sum + t.cpl, 0) / older.length;

                if (recentAvgCpl > olderAvgCpl * 1.3) {
                    results.push({
                        type: 'warning',
                        title: '📉 CPL đang tăng',
                        message: `CPL tăng ${((recentAvgCpl / olderAvgCpl - 1) * 100).toFixed(0)}% trong 3 ngày gần đây`,
                        action: 'Content đang fatigue - chuẩn bị creative mới'
                    });
                }
            }
        }

        // 4. Budget Efficiency
        if (camp.spend > 1000000 && cpl === 0) {
            results.push({
                type: 'danger',
                title: '💸 Đốt tiền không có data',
                message: `Đã chi ${(camp.spend / 1000000).toFixed(1)}tr nhưng chưa có lead nào`,
                action: 'TẮT NGAY - Review lại targeting và offer'
            });
        }

        // 5. Status Check
        if (camp.status !== 'ACTIVE') {
            results.push({
                type: 'info',
                title: '⏸️ Campaign đang tắt',
                message: 'Campaign không đang chạy',
                action: 'Bật lại nếu muốn tiếp tục chạy'
            });
        }

        return results;
    };

    const getInsightIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
            case 'danger': return <AlertTriangle className="w-5 h-5 text-red-400" />;
            default: return <Zap className="w-5 h-5 text-blue-400" />;
        }
    };

    const getInsightBg = (type: string) => {
        switch (type) {
            case 'success': return 'bg-green-500/10 border-green-500/30';
            case 'warning': return 'bg-yellow-500/10 border-yellow-500/30';
            case 'danger': return 'bg-red-500/10 border-red-500/30';
            default: return 'bg-blue-500/10 border-blue-500/30';
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                    <h3 className="text-white font-medium">AI Advisor</h3>
                </div>
                <button
                    onClick={analyzeWithAI}
                    disabled={isAnalyzing}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    {isAnalyzing ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Đang phân tích...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="w-4 h-4" />
                            Phân tích ngay
                        </>
                    )}
                </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-3">
                <QuickStat
                    icon={<DollarSign className="w-4 h-4" />}
                    label="Chi tiêu"
                    value={`${(campaign.spend / 1000000).toFixed(1)}tr`}
                />
                <QuickStat
                    icon={<Target className="w-4 h-4" />}
                    label="Data"
                    value={campaign.leads?.toString() || '0'}
                />
                <QuickStat
                    icon={<TrendingUp className="w-4 h-4" />}
                    label="CPL"
                    value={campaign.leads && campaign.leads > 0
                        ? `${((campaign.spend / campaign.leads) / 1000).toFixed(0)}k`
                        : 'N/A'}
                />
                <QuickStat
                    icon={<TrendingDown className="w-4 h-4" />}
                    label="CTR"
                    value={`${campaign.ctr.toFixed(2)}%`}
                />
            </div>

            {/* Insights */}
            {insights.length > 0 && (
                <div className="space-y-3">
                    {insights.map((insight, idx) => (
                        <div
                            key={idx}
                            className={`p-4 rounded-lg border ${getInsightBg(insight.type)}`}
                        >
                            <div className="flex items-start gap-3">
                                {getInsightIcon(insight.type)}
                                <div className="flex-1">
                                    <p className="text-white font-medium">{insight.title}</p>
                                    <p className="text-gray-400 text-sm mt-1">{insight.message}</p>
                                    {insight.action && (
                                        <p className="text-sm mt-2 text-blue-400 font-medium">
                                            💡 {insight.action}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* AI Deep Analysis */}
            {aiAdvice && (
                <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30">
                    <div className="flex items-center gap-2 mb-3">
                        <Brain className="w-5 h-5 text-purple-400" />
                        <span className="text-purple-400 font-medium">GPT-5-mini Analysis</span>
                        {usage && (
                            <span className="ml-auto text-xs text-gray-500">
                                {usage.input_tokens + usage.output_tokens} tokens • {usage.cost_vnd.toLocaleString()}đ
                            </span>
                        )}
                    </div>
                    <div className="text-gray-300 text-sm whitespace-pre-line">
                        {aiAdvice}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {insights.length === 0 && !isAnalyzing && (
                <div className="text-center py-8 text-gray-400">
                    <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nhấn &quot;Phân tích ngay&quot; để AI đánh giá campaign</p>
                    <p className="text-sm mt-1">Sẽ đề xuất: scale/tắt/thay content/tối ưu targeting</p>
                </div>
            )}
        </div>
    );
}

function QuickStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center text-gray-400 mb-1">
                {icon}
            </div>
            <p className="text-white font-bold">{value}</p>
            <p className="text-gray-500 text-xs">{label}</p>
        </div>
    );
}
