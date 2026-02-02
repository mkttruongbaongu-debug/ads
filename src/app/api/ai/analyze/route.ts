// API Route: AI Analysis

import { NextRequest, NextResponse } from 'next/server';
import { analyzePerformance, getOptimizationRecommendations, chatWithAI } from '@/lib/ai';
import { FBMetricsRow } from '@/lib/facebook';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, metrics, dateRange, question } = body;

        if (!metrics || !Array.isArray(metrics)) {
            return NextResponse.json(
                { success: false, error: 'Missing metrics data' },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case 'analyze':
                if (!dateRange) {
                    return NextResponse.json(
                        { success: false, error: 'Missing dateRange for analysis' },
                        { status: 400 }
                    );
                }
                result = await analyzePerformance(metrics as FBMetricsRow[], dateRange);
                break;

            case 'optimize':
                result = await getOptimizationRecommendations(metrics as FBMetricsRow[]);
                break;

            case 'chat':
                if (!question) {
                    return NextResponse.json(
                        { success: false, error: 'Missing question for chat' },
                        { status: 400 }
                    );
                }
                result = await chatWithAI(question, metrics as FBMetricsRow[]);
                break;

            default:
                return NextResponse.json(
                    { success: false, error: 'Invalid action. Use: analyze, optimize, or chat' },
                    { status: 400 }
                );
        }

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error('Error in AI analysis:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
