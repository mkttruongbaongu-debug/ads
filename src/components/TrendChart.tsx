'use client';

import React, { useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

interface TrendData {
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
}

interface TrendChartProps {
    campaignId: string;
    campaignName: string;
    campaignData: TrendData[];  // Data đã load từ Dashboard, không cần fetch lại
    onClose: () => void;
}

const METRICS = [
    { key: 'spend', name: 'Chi tiêu', color: '#8884d8', format: (v: number) => `${v.toLocaleString('vi-VN')}đ` },
    { key: 'impressions', name: 'Hiển thị', color: '#82ca9d', format: (v: number) => v.toLocaleString('vi-VN') },
    { key: 'clicks', name: 'Clicks', color: '#ffc658', format: (v: number) => v.toLocaleString('vi-VN') },
    { key: 'ctr', name: 'CTR (%)', color: '#ff7300', format: (v: number) => `${v.toFixed(2)}%` },
    { key: 'cpc', name: 'CPC', color: '#0088fe', format: (v: number) => `${v.toLocaleString('vi-VN')}đ` },
    { key: 'cpm', name: 'CPM', color: '#00C49F', format: (v: number) => `${v.toLocaleString('vi-VN')}đ` },
];

export default function TrendChart({
    campaignId,
    campaignName,
    campaignData,
    onClose,
}: TrendChartProps) {
    // Dùng trực tiếp data từ props - không cần fetch!
    const data = campaignData;
    const loading = false;  // Data đã có sẵn
    const error: string | null = campaignData.length === 0 ? 'Không có dữ liệu cho campaign này' : null;
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['spend', 'clicks']);

    const toggleMetric = (key: string) => {
        setSelectedMetrics(prev =>
            prev.includes(key)
                ? prev.filter(m => m !== key)
                : [...prev, key]
        );
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';

        // Try parsing as ISO date (YYYY-MM-DD)
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const day = parseInt(parts[2], 10);
            const month = parseInt(parts[1], 10);
            if (!isNaN(day) && !isNaN(month)) {
                return `${day}/${month}`;
            }
        }

        // Fallback to Date parser
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return `${date.getDate()}/${date.getMonth() + 1}`;
        }

        // Last fallback - return original
        return dateStr.substring(0, 10);
    };

    return (
        <div className="trend-chart-overlay" onClick={onClose}>
            <div className="trend-chart-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="trend-chart-header">
                    <div>
                        <h3>📈 Diễn biến theo ngày</h3>
                        <p className="trend-chart-subtitle">{campaignName}</p>
                    </div>
                    <button className="close-button" onClick={onClose}>✕</button>
                </div>

                {/* Metric Toggles */}
                <div className="metric-toggles">
                    {METRICS.map(metric => (
                        <button
                            key={metric.key}
                            className={`metric-toggle ${selectedMetrics.includes(metric.key) ? 'active' : ''}`}
                            style={{
                                borderColor: selectedMetrics.includes(metric.key) ? metric.color : 'transparent',
                                backgroundColor: selectedMetrics.includes(metric.key) ? `${metric.color}20` : 'transparent',
                            }}
                            onClick={() => toggleMetric(metric.key)}
                        >
                            <span className="metric-dot" style={{ backgroundColor: metric.color }} />
                            {metric.name}
                        </button>
                    ))}
                </div>

                {/* Chart */}
                <div className="trend-chart-content">
                    {loading ? (
                        <div className="chart-loading">⏳ Đang tải dữ liệu...</div>
                    ) : error ? (
                        <div className="chart-error">
                            <p>❌ {error}</p>
                            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.5rem' }}>
                                Chưa có dữ liệu lịch sử. Hãy sync data vào Google Sheets trước!
                            </p>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="chart-empty">
                            <p>📊 Chưa có dữ liệu lịch sử</p>
                            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.5rem' }}>
                                Click nút &quot;Sync to Sheets&quot; để bắt đầu lưu data!
                            </p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={formatDate}
                                    stroke="#888"
                                    fontSize={12}
                                />
                                <YAxis stroke="#888" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1a1a2e',
                                        border: '1px solid #333',
                                        borderRadius: '8px',
                                    }}
                                    labelFormatter={(label) => `Ngày: ${label}`}
                                    formatter={(value, name) => {
                                        const numValue = typeof value === 'number' ? value : 0;
                                        const strName = String(name);
                                        const metric = METRICS.find(m => m.key === strName);
                                        return [metric?.format(numValue) || numValue, metric?.name || strName];
                                    }}
                                />
                                <Legend />
                                {METRICS.filter(m => selectedMetrics.includes(m.key)).map(metric => (
                                    <Line
                                        key={metric.key}
                                        type="monotone"
                                        dataKey={metric.key}
                                        stroke={metric.color}
                                        strokeWidth={2}
                                        dot={{ r: 4 }}
                                        activeDot={{ r: 6 }}
                                        name={metric.name}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Summary Stats */}
                {data.length > 0 && (
                    <div className="trend-summary">
                        <div className="summary-item">
                            <span className="summary-label">Tổng chi tiêu</span>
                            <span className="summary-value">
                                {data.reduce((sum, d) => sum + d.spend, 0).toLocaleString('vi-VN')}đ
                            </span>
                        </div>
                        <div className="summary-item">
                            <span className="summary-label">Tổng clicks</span>
                            <span className="summary-value">
                                {data.reduce((sum, d) => sum + d.clicks, 0).toLocaleString('vi-VN')}
                            </span>
                        </div>
                        <div className="summary-item">
                            <span className="summary-label">CTR trung bình</span>
                            <span className="summary-value">
                                {(data.reduce((sum, d) => sum + d.ctr, 0) / data.length).toFixed(2)}%
                            </span>
                        </div>
                        <div className="summary-item">
                            <span className="summary-label">Số ngày</span>
                            <span className="summary-value">{data.length}</span>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .trend-chart-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 1rem;
                }

                .trend-chart-modal {
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    width: 100%;
                    max-width: 900px;
                    max-height: 90vh;
                    overflow-y: auto;
                    padding: 1.5rem;
                }

                .trend-chart-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1.5rem;
                }

                .trend-chart-header h3 {
                    margin: 0;
                    font-size: 1.25rem;
                    color: #fff;
                }

                .trend-chart-subtitle {
                    margin: 0.25rem 0 0;
                    font-size: 0.9rem;
                    color: #888;
                }

                .close-button {
                    background: rgba(255, 255, 255, 0.1);
                    border: none;
                    color: #fff;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: background 0.2s;
                }

                .close-button:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                .metric-toggles {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-bottom: 1.5rem;
                }

                .metric-toggle {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    border: 2px solid transparent;
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    color: #ccc;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.85rem;
                }

                .metric-toggle:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .metric-toggle.active {
                    color: #fff;
                }

                .metric-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                }

                .trend-chart-content {
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 12px;
                    padding: 1rem;
                    min-height: 350px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .chart-loading,
                .chart-error,
                .chart-empty {
                    text-align: center;
                    color: #888;
                }

                .chart-error {
                    color: #ff6b6b;
                }

                .trend-summary {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 1rem;
                    margin-top: 1.5rem;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                }

                .summary-item {
                    text-align: center;
                }

                .summary-label {
                    display: block;
                    font-size: 0.75rem;
                    color: #888;
                    text-transform: uppercase;
                    margin-bottom: 0.25rem;
                }

                .summary-value {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #fff;
                }
            `}</style>
        </div>
    );
}
