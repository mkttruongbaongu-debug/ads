import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/facebook/token';
import { analyzeWithAI, CampaignContext } from '@/lib/analysis/ai-analyzer';
import { detectIssues, CampaignData, DailyMetric } from '@/lib/analysis/pattern-engine';

const FB_API_VERSION = 'v21.0';
const FB_API_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: campaignId } = await params;
        const body = await request.json();
        const { startDate, endDate, comparison } = body;

        if (!startDate || !endDate) {
            return NextResponse.json(
                { success: false, error: 'startDate and endDate are required' },
                { status: 400 }
            );
        }

        const tokenResult = await getValidAccessToken();
        if (!tokenResult.accessToken) {
            return NextResponse.json(
                { success: false, error: tokenResult.error || 'No valid Facebook access token', needsLogin: true },
                { status: 401 }
            );
        }
        const accessToken = tokenResult.accessToken;

        // Fetch campaign with daily insights
        const campaignRes = await fetch(
            `${FB_API_BASE}/${campaignId}?` +
            `fields=id,name,status,insights.time_range({'since':'${startDate}','until':'${endDate}'}).time_increment(1){` +
            `date_start,spend,impressions,clicks,actions,action_values,ctr,cpc,cpm,frequency` +
            `}&access_token=${accessToken}`
        );

        const campaignData = await campaignRes.json();

        if (campaignData.error) {
            return NextResponse.json(
                { success: false, error: campaignData.error.message },
                { status: 400 }
            );
        }

        // Transform data
        const insightsData = campaignData.insights?.data || [];

        const dailyMetrics: DailyMetric[] = insightsData.map((day: {
            date_start: string;
            spend: string;
            impressions: string;
            clicks: string;
            ctr: string;
            cpc: string;
            cpm: string;
            frequency?: string;
            actions?: Array<{ action_type: string; value: string }>;
            action_values?: Array<{ action_type: string; value: string }>;
        }) => {
            const spend = parseFloat(day.spend || '0');
            const purchases = day.actions?.find(a =>
                a.action_type === 'purchase' || a.action_type === 'omni_purchase'
            );
            const revenue = day.action_values?.find(a =>
                a.action_type === 'purchase' || a.action_type === 'omni_purchase'
            );
            const purchaseCount = purchases ? parseInt(purchases.value) : 0;
            const revenueAmount = revenue ? parseFloat(revenue.value) : 0;

            return {
                date: day.date_start,
                spend,
                impressions: parseInt(day.impressions || '0'),
                clicks: parseInt(day.clicks || '0'),
                purchases: purchaseCount,
                revenue: revenueAmount,
                ctr: parseFloat(day.ctr || '0'),
                cpc: parseFloat(day.cpc || '0'),
                cpp: purchaseCount > 0 ? spend / purchaseCount : 0,
                roas: spend > 0 ? revenueAmount / spend : 0,
                frequency: day.frequency ? parseFloat(day.frequency) : undefined,
                cpm: parseFloat(day.cpm || '0'),
            };
        });

        // Calculate totals
        const totals = dailyMetrics.reduce((acc, day) => ({
            spend: acc.spend + day.spend,
            purchases: acc.purchases + day.purchases,
            revenue: acc.revenue + day.revenue,
            clicks: acc.clicks + day.clicks,
            impressions: acc.impressions + day.impressions,
        }), { spend: 0, purchases: 0, revenue: 0, clicks: 0, impressions: 0 });

        const campaign: CampaignData = {
            id: campaignData.id,
            name: campaignData.name,
            status: campaignData.status,
            dailyMetrics,
            totals: {
                spend: totals.spend,
                purchases: totals.purchases,
                revenue: totals.revenue,
                cpp: totals.purchases > 0 ? totals.spend / totals.purchases : 0,
                roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
                ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
            },
        };

        // Detect issues using pattern engine
        const issues = detectIssues(campaign);

        // Calculate average frequency and CPM
        const avgFrequency = dailyMetrics.filter(d => d.frequency).reduce((sum, d) => sum + (d.frequency || 0), 0) /
            (dailyMetrics.filter(d => d.frequency).length || 1);
        const avgCpm = dailyMetrics.reduce((sum, d) => sum + d.cpm, 0) / (dailyMetrics.length || 1);

        // Build context for AI
        const context: CampaignContext = {
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
            },
            metrics: {
                spend: campaign.totals.spend,
                purchases: campaign.totals.purchases,
                revenue: campaign.totals.revenue,
                cpp: campaign.totals.cpp,
                roas: campaign.totals.roas,
                ctr: campaign.totals.ctr,
                cpm: avgCpm,
                frequency: avgFrequency || undefined,
            },
            dailyTrend: dailyMetrics.map(d => ({
                date: d.date,
                spend: d.spend,
                purchases: d.purchases,
                cpp: d.cpp,
                ctr: d.ctr,
            })),
            issues: issues.map(i => ({
                type: i.type,
                severity: i.severity || 'info',
                message: i.message,
                detail: i.detail,
            })),
            comparison,
        };

        // Run AI analysis
        const aiResult = await analyzeWithAI(context);

        return NextResponse.json({
            success: true,
            data: {
                campaign: {
                    id: campaign.id,
                    name: campaign.name,
                    status: campaign.status,
                },
                metrics: context.metrics,
                dailyTrend: context.dailyTrend,
                issues,
                aiAnalysis: aiResult,
            },
        });

    } catch (error) {
        console.error('AI Analysis error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
