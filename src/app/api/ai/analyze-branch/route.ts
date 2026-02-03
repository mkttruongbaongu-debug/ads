// API Route: Analyze branch and get optimization playbooks

import { NextRequest, NextResponse } from 'next/server';
import { analyzeWithAI } from '@/lib/ai/cpp-analyzer';
import { detectIssues, getPlaybooks, PLAYBOOKS } from '@/lib/ai/optimization-playbook';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { branch, averages, mode } = body;

        if (!branch) {
            return NextResponse.json({ success: false, error: 'Branch data required' }, { status: 400 });
        }

        // Mode: 'quick' for rule-based, 'ai' for GPT analysis
        if (mode === 'ai') {
            // Full AI analysis
            const aiInsight = await analyzeWithAI(branch, averages);
            return NextResponse.json({
                success: true,
                aiInsight
            });
        }

        // Quick rule-based analysis
        const cppTarget = averages.cpp || 100000; // Default 100K
        const issues = detectIssues({
            cpp: branch.cpp,
            cppTarget,
            roas: branch.roas,
            ctr: branch.ctr,
            ctrPrevious: averages.ctr,
            frequency: branch.frequency || 1,
            cpm: branch.cpm,
            cpmAverage: averages.cpm,
            purchases: branch.purchases,
            spend: branch.spend,
            isLearning: branch.isLearning || false
        });

        const playbooks = getPlaybooks(issues);

        return NextResponse.json({
            success: true,
            issues,
            playbooks,
            summary: {
                criticalCount: playbooks.filter(p => p.severity === 'critical').length,
                warningCount: playbooks.filter(p => p.severity === 'warning').length,
                hasIssues: issues.length > 0
            }
        });

    } catch (error) {
        console.error('Analyze branch error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
