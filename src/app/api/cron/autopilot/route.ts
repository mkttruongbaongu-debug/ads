/**
 * ===================================================================
 * API ENDPOINT: AUTOPILOT (FULL AUTOMATION PIPELINE) — STREAMING
 * ===================================================================
 * Route: POST /api/cron/autopilot
 *
 * Chạy toàn bộ pipeline tự động:
 * 1. Scan tất cả campaigns đang ACTIVE
 * 2. Chạy AI phân tích cho mỗi campaign
 * 3. Check pending proposals
 * 4. Auto-execute approved proposals
 * 5. Chạy monitoring check
 *
 * Uses STREAMING response to prevent 504 Gateway Timeout.
 * Sends progress lines + heartbeat while o4-mini processes.
 *
 * Protocol:
 *   STEP:N:message   → progress update
 *   RESULT:{json}    → final pipeline result
 *   \n               → heartbeat (ignored by client)
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDynamicFacebookClient } from '@/lib/facebook/client';
import { analyzeWithAI } from '@/lib/analysis/ai-analyzer';
import { preprocessCampaignData } from '@/lib/analysis/data-preprocessor';

// Apps Script helper
async function layDanhSachDeXuatViaAppsScript(filter: { trangThai?: any }): Promise<any[]> {
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET || 'tho-ads-ai-2026';
    if (!scriptUrl) throw new Error('GOOGLE_APPS_SCRIPT_URL not configured');

    const url = new URL(scriptUrl);
    url.searchParams.set('secret', secret);
    url.searchParams.set('action', 'layDanhSachDeXuat');
    if (filter.trangThai) {
        const statuses = Array.isArray(filter.trangThai) ? filter.trangThai : [filter.trangThai];
        url.searchParams.set('status', statuses.join(','));
    }

    const res = await fetch(url.toString());
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Apps Script error');
    return data.data || [];
}

// ===================================================================
// TYPES
// ===================================================================

interface AutopilotResult {
    timestamp: string;
    duration_ms: number;
    pipeline: {
        step1_scan: {
            accounts_scanned: number;
            campaigns_found: number;
            active_campaigns: number;
        };
        step2_analyze: {
            campaigns_analyzed: number;
            issues_found: number;
            verdicts: Record<string, number>;
        };
        step3_proposals: {
            proposals_created: number;
            auto_approved: number;
        };
        step4_execute: {
            proposals_executed: number;
            success: number;
            failed: number;
        };
        step5_monitor: {
            proposals_checked: number;
            observations_created: number;
            completed: number;
        };
    };
    errors: string[];
    summary: string;
}

// ===================================================================
// HANDLERS
// ===================================================================

export const maxDuration = 300; // Allow up to 5 min for full pipeline

export async function GET(request: NextRequest) {
    return runStreamingPipeline(request, {});
}

export async function POST(request: NextRequest) {
    let body = {};
    try { body = await request.json().catch(() => ({})); } catch { }
    return runStreamingPipeline(request, body);
}

// ===================================================================
// STREAMING PIPELINE
// ===================================================================

function runStreamingPipeline(request: NextRequest, body: any): Response {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (msg: string) => {
                try { controller.enqueue(encoder.encode(msg + '\n')); } catch { }
            };

            // Heartbeat: gửi \n mỗi 5s để giữ connection sống
            const heartbeat = setInterval(() => {
                try { controller.enqueue(encoder.encode('\n')); } catch { clearInterval(heartbeat); }
            }, 5000);

            const startTime = Date.now();
            const errors: string[] = [];

            const result: AutopilotResult = {
                timestamp: new Date().toISOString(),
                duration_ms: 0,
                pipeline: {
                    step1_scan: { accounts_scanned: 0, campaigns_found: 0, active_campaigns: 0 },
                    step2_analyze: { campaigns_analyzed: 0, issues_found: 0, verdicts: {} },
                    step3_proposals: { proposals_created: 0, auto_approved: 0 },
                    step4_execute: { proposals_executed: 0, success: 0, failed: 0 },
                    step5_monitor: { proposals_checked: 0, observations_created: 0, completed: 0 },
                },
                errors: [],
                summary: '',
            };

            try {
                // Auth
                const session = await getServerSession(authOptions).catch(() => null);
                if (session?.user) {
                    console.log(`[AUTOPILOT] 🔐 Triggered by: ${session.user.email}`);
                }

                const options = {
                    autoExecute: false,
                    maxCampaigns: 20,
                    skipAnalysis: false,
                    dryRun: false,
                    ...body,
                };

                // ===============================================================
                // STEP 1: SCAN CAMPAIGNS
                // ===============================================================
                send('STEP:1:Đang scan ad accounts...');

                let fb;
                try {
                    fb = await getDynamicFacebookClient();
                } catch (err) {
                    errors.push(`FB connection failed: ${err instanceof Error ? err.message : String(err)}`);
                    send(`STEP:1:❌ Không thể kết nối Facebook`);
                    throw new Error('FB connection failed');
                }

                const accounts = await fb.getAdAccounts();
                result.pipeline.step1_scan.accounts_scanned = accounts.length;

                if (accounts.length === 0) {
                    errors.push('No ad accounts found');
                    throw new Error('No ad accounts found');
                }

                const primaryAccount = accounts[0];
                const campaigns = await fb.getCampaigns(primaryAccount.id);
                result.pipeline.step1_scan.campaigns_found = campaigns.length;

                const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE');
                result.pipeline.step1_scan.active_campaigns = activeCampaigns.length;

                send(`STEP:1:✅ ${activeCampaigns.length} campaigns active / ${campaigns.length} total`);

                // ===============================================================
                // STEP 2: AI ANALYSIS
                // ===============================================================
                if (!options.skipAnalysis && activeCampaigns.length > 0) {
                    const campaignsToAnalyze = activeCampaigns.slice(0, options.maxCampaigns);
                    send(`STEP:2:Bắt đầu AI analysis cho ${campaignsToAnalyze.length} campaigns...`);

                    for (let i = 0; i < campaignsToAnalyze.length; i++) {
                        const campaign = campaignsToAnalyze[i];
                        try {
                            send(`STEP:2:Analyzing ${i + 1}/${campaignsToAnalyze.length}: ${campaign.name}`);

                            const endDate = new Date().toISOString().split('T')[0];
                            const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                            const insights = await fb.getInsights(
                                campaign.id,
                                { startDate, endDate },
                                'campaign'
                            );

                            if (!insights || insights.length < 3) {
                                send(`STEP:2:⏭️ ${campaign.name}: Chưa đủ data (${insights?.length || 0} ngày)`);
                                continue;
                            }

                            const dailyMetrics = insights.map((day: any) => {
                                const spend = parseFloat(day.spend || '0');
                                const impressions = parseInt(day.impressions || '0');
                                const clicks = parseInt(day.clicks || '0');
                                const purchaseAction = (day.actions || []).find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase');
                                const revenueAction = (day.action_values || []).find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase');
                                const purchases = purchaseAction ? parseInt(purchaseAction.value) : 0;
                                const revenue = revenueAction ? parseFloat(revenueAction.value) : 0;
                                return {
                                    date: day.date_start,
                                    spend, impressions, clicks, purchases, revenue,
                                    cpp: purchases > 0 ? spend / purchases : 0,
                                    roas: spend > 0 ? revenue / spend : 0,
                                    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                                    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
                                };
                            });

                            const preprocessed = preprocessCampaignData(dailyMetrics);

                            // Budget: lấy từ campaign object (đã có từ getCampaigns)
                            const campaignBudget = (campaign as any).dailyBudget || 0;
                            const numberOfDays = dailyMetrics.length || 1;
                            const estimatedBudget = Math.round(preprocessed.basics.totalSpend / numberOfDays);

                            const context = {
                                campaign: { id: campaign.id, name: campaign.name, status: campaign.status },
                                metrics: {
                                    spend: preprocessed.basics.totalSpend,
                                    purchases: preprocessed.basics.totalPurchases,
                                    revenue: preprocessed.basics.totalSpend * preprocessed.basics.avgRoas,
                                    cpp: preprocessed.basics.avgCpp,
                                    ctr: preprocessed.basics.avgCtr,
                                    roas: preprocessed.basics.avgRoas,
                                    cpm: 0,
                                },
                                dailyTrend: dailyMetrics.map(d => ({
                                    date: d.date, spend: d.spend, purchases: d.purchases,
                                    cpp: d.cpp, ctr: d.ctr, revenue: d.revenue,
                                })),
                                issues: [] as Array<{ type: string; severity: string; message: string; detail: string }>,
                                dailyBudget: campaignBudget > 0 ? campaignBudget : undefined,
                                dailyBudgetEstimated: campaignBudget > 0 ? campaignBudget : estimatedBudget,
                            };

                            const aiResult = await analyzeWithAI(context);
                            result.pipeline.step2_analyze.campaigns_analyzed++;

                            const verdict = aiResult.verdict?.action || 'UNKNOWN';
                            result.pipeline.step2_analyze.verdicts[verdict] =
                                (result.pipeline.step2_analyze.verdicts[verdict] || 0) + 1;

                            if (verdict === 'REDUCE' || verdict === 'STOP') {
                                result.pipeline.step2_analyze.issues_found++;
                                send(`STEP:2:⚠️ ${campaign.name}: ${verdict} - ${aiResult.verdict?.headline}`);
                            } else {
                                send(`STEP:2:✅ ${campaign.name}: ${verdict}`);
                            }

                        } catch (err) {
                            const msg = `Analysis error for ${campaign.name}: ${err instanceof Error ? err.message : String(err)}`;
                            errors.push(msg);
                            send(`STEP:2:❌ ${campaign.name}: Error`);
                        }
                    }

                    send(`STEP:2:✅ Analyzed ${result.pipeline.step2_analyze.campaigns_analyzed}, Issues: ${result.pipeline.step2_analyze.issues_found}`);
                }

                // ===============================================================
                // STEP 3: CHECK PENDING PROPOSALS
                // ===============================================================
                send('STEP:3:Checking pending proposals...');

                let pendingProposals: any[] = [];
                let approvedProposals: any[] = [];
                try {
                    pendingProposals = await layDanhSachDeXuatViaAppsScript({ trangThai: 'CHO_DUYET' });
                    send(`STEP:3:✅ ${pendingProposals.length} proposals pending`);
                } catch (err) {
                    errors.push(`Sheets error (step3): ${err instanceof Error ? err.message : String(err)}`);
                    send('STEP:3:⚠️ Could not fetch proposals');
                }

                // ===============================================================
                // STEP 4: AUTO-EXECUTE APPROVED PROPOSALS
                // ===============================================================
                send('STEP:4:Checking approved proposals...');

                try {
                    approvedProposals = await layDanhSachDeXuatViaAppsScript({ trangThai: 'DA_DUYET' });
                } catch (err) {
                    errors.push(`Sheets error (step4): ${err instanceof Error ? err.message : String(err)}`);
                }

                for (const deXuat of approvedProposals) {
                    try {
                        send(`STEP:4:🚀 Executing: ${deXuat.tenCampaign}`);

                        const baseUrl = request.nextUrl.origin;
                        const res = await fetch(`${baseUrl}/api/de-xuat/thuc-thi`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Cookie': request.headers.get('cookie') || '',
                            },
                            body: JSON.stringify({ deXuatId: deXuat.id }),
                        });

                        const json = await res.json();
                        result.pipeline.step4_execute.proposals_executed++;

                        if (json.success) {
                            result.pipeline.step4_execute.success++;
                            send(`STEP:4:✅ Executed: ${deXuat.tenCampaign}`);
                        } else {
                            result.pipeline.step4_execute.failed++;
                            errors.push(`Execute failed: ${deXuat.tenCampaign} - ${json.error}`);
                        }
                    } catch (err) {
                        result.pipeline.step4_execute.failed++;
                        errors.push(`Execute error: ${deXuat.tenCampaign} - ${err instanceof Error ? err.message : String(err)}`);
                    }
                }

                send(`STEP:4:✅ ${result.pipeline.step4_execute.success}/${result.pipeline.step4_execute.proposals_executed} executed`);

                // ===============================================================
                // STEP 5: MONITORING CHECK
                // ===============================================================
                send('STEP:5:Running monitoring check...');

                try {
                    const baseUrl = request.nextUrl.origin;
                    const monitorRes = await fetch(`${baseUrl}/api/giam-sat/kiem-tra`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': request.headers.get('cookie') || '',
                        },
                    });

                    const monitorJson = await monitorRes.json();
                    if (monitorJson.success && monitorJson.data) {
                        result.pipeline.step5_monitor = {
                            proposals_checked: monitorJson.data.processed,
                            observations_created: monitorJson.data.observations_created,
                            completed: 0,
                        };
                    }
                    send(`STEP:5:✅ ${monitorJson.data?.processed || 0} monitored`);
                } catch (err) {
                    errors.push(`Monitor check error: ${err instanceof Error ? err.message : String(err)}`);
                    send('STEP:5:⚠️ Monitor check failed');
                }

            } catch (fatalError) {
                console.error('[AUTOPILOT] ❌ Fatal error:', fatalError);
                if (fatalError instanceof Error && !errors.includes(fatalError.message)) {
                    errors.push(`Fatal: ${fatalError.message}`);
                }
            }

            // Final result
            result.duration_ms = Date.now() - startTime;
            result.errors = errors;
            result.summary = buildSummary(result);

            console.log(`[AUTOPILOT] ✅ Pipeline Complete in ${result.duration_ms}ms`);

            send(`RESULT:${JSON.stringify({
                success: errors.length === 0 || result.pipeline.step2_analyze.campaigns_analyzed > 0,
                data: result,
            })}`);

            clearInterval(heartbeat);
            controller.close();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Transfer-Encoding': 'chunked',
        },
    });
}

// ===================================================================
// HELPERS
// ===================================================================

function buildSummary(result: AutopilotResult): string {
    const { step1_scan, step2_analyze, step4_execute, step5_monitor } = result.pipeline;
    const parts: string[] = [];

    if (step1_scan.active_campaigns > 0) {
        parts.push(`${step1_scan.active_campaigns} campaigns active`);
    }
    if (step2_analyze.campaigns_analyzed > 0) {
        parts.push(`${step2_analyze.campaigns_analyzed} analyzed`);
        if (step2_analyze.issues_found > 0) {
            parts.push(`${step2_analyze.issues_found} issues found`);
        }
    }
    if (step4_execute.proposals_executed > 0) {
        parts.push(`${step4_execute.success}/${step4_execute.proposals_executed} executed`);
    }
    if (step5_monitor.observations_created > 0) {
        parts.push(`${step5_monitor.observations_created} observations`);
    }
    if (result.errors.length > 0) {
        parts.push(`${result.errors.length} errors`);
    }

    return parts.join(' | ');
}
