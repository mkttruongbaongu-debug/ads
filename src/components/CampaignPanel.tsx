'use client';

import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Minus, DollarSign, Users, Target, ShoppingCart, Loader2, Brain } from 'lucide-react';
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
            // Fetch daily insights for this campaign
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

    // Calculate trend
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

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-[#1a1a2e] z-50 overflow-y-auto shadow-2xl animate-slideIn">
                {/* Header */}
                <div className="sticky top-0 bg-[#1a1a2e] border-b border-gray-700 p-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white">{campaign.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${campaign.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                                }`}>
                                {campaign.status}
                            </span>
                            <span className="text-gray-400 text-sm">
                                {dateRange.startDate} → {dateRange.endDate}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-700">
                    {[
                        { key: 'overview', label: 'Tổng quan' },
                        { key: 'ai', label: '🧠 AI Advisor' },
                        { key: 'adsets', label: 'Adsets' },
                        { key: 'ads', label: 'Quảng cáo' }
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as typeof activeTab)}
                            className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === tab.key
                                ? tab.key === 'ai' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-blue-400 border-b-2 border-blue-400'
                                : tab.key === 'ai' ? 'text-purple-300 hover:text-purple-400' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                        </div>
                    ) : (
                        <>
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    {/* Trend Indicator */}
                                    <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-800/50">
                                        {trend === 'up' && <TrendingUp className="w-8 h-8 text-green-400" />}
                                        {trend === 'down' && <TrendingDown className="w-8 h-8 text-red-400" />}
                                        {trend === 'stable' && <Minus className="w-8 h-8 text-yellow-400" />}
                                        <div>
                                            <p className="text-white font-medium">
                                                {trend === 'up' && '📈 Chi tiêu đang tăng'}
                                                {trend === 'down' && '📉 Chi tiêu đang giảm'}
                                                {trend === 'stable' && '➡️ Chi tiêu ổn định'}
                                            </p>
                                            <p className="text-gray-400 text-sm">Dựa trên {dailyData.length} ngày dữ liệu</p>
                                        </div>
                                    </div>

                                    {/* Key Metrics */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <MetricCard
                                            icon={<DollarSign className="w-5 h-5" />}
                                            label="Chi tiêu"
                                            value={`${campaign.spend.toLocaleString('vi-VN')}đ`}
                                            color="blue"
                                        />
                                        <MetricCard
                                            icon={<Users className="w-5 h-5" />}
                                            label="Clicks"
                                            value={campaign.clicks.toLocaleString()}
                                            color="green"
                                        />
                                        <MetricCard
                                            icon={<Target className="w-5 h-5" />}
                                            label="CTR"
                                            value={`${campaign.ctr.toFixed(2)}%`}
                                            color="purple"
                                        />
                                        <MetricCard
                                            icon={<ShoppingCart className="w-5 h-5" />}
                                            label="CPC"
                                            value={`${campaign.cpc.toLocaleString('vi-VN')}đ`}
                                            color="orange"
                                        />
                                    </div>

                                    {/* Daily Chart */}
                                    {dailyData.length > 0 && (
                                        <div className="bg-gray-800/50 rounded-lg p-4">
                                            <h3 className="text-white font-medium mb-4">Chi tiêu theo ngày</h3>
                                            <div className="h-64">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={dailyData}>
                                                        <XAxis
                                                            dataKey="date"
                                                            stroke="#6b7280"
                                                            tick={{ fontSize: 12 }}
                                                            tickFormatter={(val) => val.slice(5)} // MM-DD
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
                                                            formatter={(value: number) => [`${value.toLocaleString('vi-VN')}đ`, 'Chi tiêu']}
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
                                    campaign={{
                                        id: campaign.id,
                                        name: campaign.name,
                                        status: campaign.status,
                                        spend: campaign.spend,
                                        impressions: campaign.impressions,
                                        clicks: campaign.clicks,
                                        ctr: campaign.ctr,
                                        cpc: campaign.cpc,
                                        leads: campaign.leads,
                                        purchases: campaign.purchases,
                                        revenue: campaign.revenue,
                                    }}
                                    dailyTrends={dailyData.map(d => ({
                                        date: d.date,
                                        spend: d.spend,
                                        leads: d.leads,
                                        cpl: d.cpl
                                    }))}
                                />
                            )}

                            {activeTab === 'adsets' && (
                                <div className="space-y-4">
                                    <h3 className="text-white font-medium">Adsets trong chiến dịch</h3>
                                    {adsets.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-gray-400 border-b border-gray-700">
                                                        <th className="text-left py-3 px-2">Adset</th>
                                                        <th className="text-right py-3 px-2">Spend</th>
                                                        <th className="text-right py-3 px-2">Leads</th>
                                                        <th className="text-right py-3 px-2">CPL</th>
                                                        <th className="text-right py-3 px-2">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {adsets.map((adset) => (
                                                        <tr key={adset.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                                            <td className="py-3 px-2 text-white">{adset.name}</td>
                                                            <td className="py-3 px-2 text-right text-gray-300">
                                                                {adset.spend.toLocaleString('vi-VN')}đ
                                                            </td>
                                                            <td className="py-3 px-2 text-right text-gray-300">{adset.leads}</td>
                                                            <td className="py-3 px-2 text-right">
                                                                <span className={adset.cpl > 100000 ? 'text-red-400' : 'text-green-400'}>
                                                                    {adset.cpl.toLocaleString('vi-VN')}đ
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-2 text-right">
                                                                <span className={`px-2 py-0.5 rounded text-xs ${adset.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                                                                    }`}>
                                                                    {adset.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 text-gray-400">
                                            <p>Không có dữ liệu adsets</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'ads' && (
                                <div className="text-center py-10 text-gray-400">
                                    <p>🚧 Tính năng đang phát triển</p>
                                    <p className="text-sm mt-2">Sẽ hiển thị chi tiết từng bài quảng cáo</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

function MetricCard({ icon, label, value, color }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: 'blue' | 'green' | 'purple' | 'orange'
}) {
    const colorClasses = {
        blue: 'bg-blue-500/20 text-blue-400',
        green: 'bg-green-500/20 text-green-400',
        purple: 'bg-purple-500/20 text-purple-400',
        orange: 'bg-orange-500/20 text-orange-400',
    };

    return (
        <div className="bg-gray-800/50 rounded-lg p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${colorClasses[color]}`}>
                {icon}
            </div>
            <p className="text-gray-400 text-sm">{label}</p>
            <p className="text-white font-bold text-lg">{value}</p>
        </div>
    );
}
