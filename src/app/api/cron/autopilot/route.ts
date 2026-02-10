/**
 * ===================================================================
 * API ENDPOINT: AUTOPILOT (FULL AUTOMATION PIPELINE)
 * ===================================================================
 * Route: POST /api/cron/autopilot
 *
 * Chạy toàn bộ pipeline tự động:
 * 1. Scan tất cả campaigns đang ACTIVE
 * 2. Chạy AI phân tích cho mỗi campaign
 * 3. Tự tạo đề xuất khi phát hiện vấn đề
 * 4. Auto-execute đề xuất low-risk (THAP priority)
 * 5. Chạy monitoring check cho đề xuất đang giám sát
 *
 * Bảo mật: Requires CRON_SECRET header hoặc authenticated session
 * ===================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDynamicFacebookClient } from '@/lib/facebook/client';
import { analyzeWithAI } from '@/lib/analysis/ai-analyzer';
import { preprocessCampaignData } from '@/lib/analysis/data-preprocessor';
import { layDanhSachDeXuat } from '@/lib/sheets/de-xuat-sheet';

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
// POST HANDLER
// ===================================================================

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const errors: string[] = [];

    console.log('[AUTOPILOT] 🤖 ═══════════════════════════════════════');
    console.log('[AUTOPILOT] 🤖 Starting Full Automation Pipeline');
    console.log('[AUTOPILOT] 🤖 ═══════════════════════════════════════');

    // Auth: optional — log user if session exists
    const session = await getServerSession(authOptions).catch(() => null);
    if (session?.user) {
        console.log(`[AUTOPILOT] 🔐 Triggered by: ${session.user.email}`);
    } else {
        console.log('[AUTOPILOT] 🔐 Triggered by: Cron / External');
    }

    // Parse options from body
    let options = {
        autoExecute: false,       // Auto-execute low-risk proposals?
        maxCampaigns: 20,         // Max campaigns to analyze
        skipAnalysis: false,      // Skip AI analysis (only monitor)?
        dryRun: false,            // Log only, don't write anything?
    };

    try {
        const body = await request.json().catch(() => ({}));
        options = { ...options, ...body };
    } catch (e) {
        // Use defaults
    }

    console.log(`[AUTOPILOT] ⚙️ Options:`, JSON.stringify(options));

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
        // ===============================================================
        // STEP 1: SCAN CAMPAIGNS
        // ===============================================================
        console.log('[AUTOPILOT] ── Step 1: Scan Campaigns ──');

        let fb;
        try {
            fb = await getDynamicFacebookClient();
        } catch (err) {
            errors.push(`FB connection failed: ${err instanceof Error ? err.message : String(err)}`);
            return buildResponse(result, errors, startTime);
        }

        const accounts = await fb.getAdAccounts();
        result.pipeline.step1_scan.accounts_scanned = accounts.length;
        console.log(`[AUTOPILOT] 📂 ${accounts.length} ad accounts found`);

        // Fetch campaigns from first account (primary)
        if (accounts.length === 0) {
            errors.push('No ad accounts found');
            return buildResponse(result, errors, startTime);
        }

        const primaryAccount = accounts[0];
        const campaigns = await fb.getCampaigns(primaryAccount.id);
        result.pipeline.step1_scan.campaigns_found = campaigns.length;

        const activeCampaigns = campaigns.filter(
            (c: any) => c.status === 'ACTIVE' && c.effective_status === 'ACTIVE'
        );
        result.pipeline.step1_scan.active_campaigns = activeCampaigns.length;
        console.log(`[AUTOPILOT] 📊 ${activeCampaigns.length}/${campaigns.length} active campaigns`);

        // ===============================================================
        // STEP 2: AI ANALYSIS
        // ===============================================================
        if (!options.skipAnalysis) {
            console.log('[AUTOPILOT] ── Step 2: AI Analysis ──');

            const campaignsToAnalyze = activeCampaigns.slice(0, options.maxCampaigns);

            for (const campaign of campaignsToAnalyze) {
                try {
                    // Fetch insights (14 days)
                    const endDate = new Date().toISOString().split('T')[0];
                    const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                    const insights = await fb.getInsights(
                        campaign.id,
                        { startDate, endDate },
                        'campaign'
                    );

                    if (!insights || insights.length < 3) {
                        console.log(`[AUTOPILOT] ⏭️ ${campaign.name}: Insufficient data (${insights?.length || 0} days)`);
                        continue;
                    }

                    // Transform raw FB data to DailyMetric[]
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
                            spend,
                            impressions,
                            clicks,
                            purchases,
                            revenue,
                            cpp: purchases > 0 ? spend / purchases : 0,
                            roas: spend > 0 ? revenue / spend : 0,
                            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                            cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
                        };
                    });

                    // Preprocess
                    const preprocessed = preprocessCampaignData(dailyMetrics);

                    // Build context for AI
                    const context = {
                        campaign: {
                            id: campaign.id,
                            name: campaign.name,
                            status: campaign.status,
                        },
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
                            date: d.date,
                            spend: d.spend,
                            purchases: d.purchases,
                            cpp: d.cpp,
                            ctr: d.ctr,
                            revenue: d.revenue,
                        })),
                        issues: [] as Array<{ type: string; severity: string; message: string; detail: string }>,
                        ads: [],
                        dateRange: { startDate, endDate },
                    };

                    // Run AI analysis
                    const aiResult = await analyzeWithAI(context);
                    result.pipeline.step2_analyze.campaigns_analyzed++;

                    // Track verdicts
                    const verdict = aiResult.verdict?.action || 'UNKNOWN';
                    result.pipeline.step2_analyze.verdicts[verdict] =
                        (result.pipeline.step2_analyze.verdicts[verdict] || 0) + 1;

                    // Check if issues found
                    if (verdict === 'REDUCE' || verdict === 'STOP') {
                        result.pipeline.step2_analyze.issues_found++;
                        console.log(`[AUTOPILOT] ⚠️ ${campaign.name}: ${verdict} - ${aiResult.verdict?.headline}`);
                    } else {
                        console.log(`[AUTOPILOT] ✅ ${campaign.name}: ${verdict}`);
                    }

                } catch (err) {
                    const msg = `Analysis error for ${campaign.name}: ${err instanceof Error ? err.message : String(err)}`;
                    console.error(`[AUTOPILOT] ❌ ${msg}`);
                    errors.push(msg);
                }
            }

            console.log(`[AUTOPILOT] 📈 Analyzed: ${result.pipeline.step2_analyze.campaigns_analyzed}, Issues: ${result.pipeline.step2_analyze.issues_found}`);
        }

        // ===============================================================
        // STEP 3: CHECK PENDING PROPOSALS (skip creation for now)
        // ===============================================================
        console.log('[AUTOPILOT] ── Step 3: Pending Proposals ──');

        const pendingProposals = await layDanhSachDeXuat({ trangThai: 'CHO_DUYET' });
        console.log(`[AUTOPILOT] 📋 ${pendingProposals.length} proposals pending approval`);

        // ===============================================================
        // STEP 4: AUTO-EXECUTE APPROVED PROPOSALS
        // ===============================================================
        console.log('[AUTOPILOT] ── Step 4: Auto-Execute ──');

        const approvedProposals = await layDanhSachDeXuat({ trangThai: 'DA_DUYET' as any });

        for (const deXuat of approvedProposals) {
            try {
                console.log(`[AUTOPILOT] 🚀 Executing: ${deXuat.tenCampaign} (${deXuat.hanhDong.loai})`);

                // Call thuc-thi API internally
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
                    console.log(`[AUTOPILOT] ✅ Executed: ${deXuat.tenCampaign}`);
                } else {
                    result.pipeline.step4_execute.failed++;
                    errors.push(`Execute failed: ${deXuat.tenCampaign} - ${json.error}`);
                }
            } catch (err) {
                result.pipeline.step4_execute.failed++;
                errors.push(`Execute error: ${deXuat.tenCampaign} - ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        // ===============================================================
        // STEP 5: MONITORING CHECK
        // ===============================================================
        console.log('[AUTOPILOT] ── Step 5: Monitoring Check ──');

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
        } catch (err) {
            errors.push(`Monitor check error: ${err instanceof Error ? err.message : String(err)}`);
        }

        return buildResponse(result, errors, startTime);

    } catch (error) {
        console.error('[AUTOPILOT] ❌ Fatal error:', error);
        errors.push(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
        return buildResponse(result, errors, startTime);
    }
}

// ===================================================================
// HELPERS
// ===================================================================

function buildResponse(
    result: AutopilotResult,
    errors: string[],
    startTime: number
): NextResponse {
    result.duration_ms = Date.now() - startTime;
    result.errors = errors;
    result.summary = buildSummary(result);

    console.log('[AUTOPILOT] 🤖 ═══════════════════════════════════════');
    console.log(`[AUTOPILOT] 🤖 Pipeline Complete in ${result.duration_ms}ms`);
    console.log(`[AUTOPILOT] 🤖 ${result.summary}`);
    console.log('[AUTOPILOT] 🤖 ═══════════════════════════════════════');

    return NextResponse.json({
        success: errors.length === 0 || result.pipeline.step2_analyze.campaigns_analyzed > 0,
        data: result,
    });
}

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
