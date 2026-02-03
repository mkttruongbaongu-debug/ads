// API Route: Get daily insights for a specific campaign

import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const { id: campaignId } = await context.params;
        const searchParams = request.nextUrl.searchParams;
        const startDate = searchParams.get('startDate') || '';
        const endDate = searchParams.get('endDate') || '';

        const accessToken = process.env.FB_ACCESS_TOKEN;
        if (!accessToken) {
            return NextResponse.json({ success: false, error: 'FB_ACCESS_TOKEN not configured' }, { status: 500 });
        }

        // Fetch daily breakdown for this campaign
        const fields = [
            'date_start',
            'spend',
            'impressions',
            'clicks',
            'ctr',
            'cpc',
            'actions',
            'action_values'
        ].join(',');

        const url = `https://graph.facebook.com/v21.0/${campaignId}/insights?fields=${fields}&time_range={"since":"${startDate}","until":"${endDate}"}&time_increment=1&access_token=${accessToken}`;

        const response = await fetch(url);
        const json = await response.json();

        if (json.error) {
            console.error('Facebook API error:', json.error);
            return NextResponse.json({ success: false, error: json.error.message }, { status: 400 });
        }

        // Process data
        const data = (json.data || []).map((row: {
            date_start?: string;
            spend?: string;
            impressions?: string;
            clicks?: string;
            ctr?: string;
            cpc?: string;
            actions?: Array<{ action_type: string; value: string }>;
        }) => {
            // Extract action metrics
            const actions = row.actions || [];
            const messages = parseInt(actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value || '0');
            const comments = parseInt(actions.find(a => a.action_type === 'comment')?.value || '0');
            const leads = messages + comments;

            const spend = parseFloat(row.spend || '0');
            const cpl = leads > 0 ? spend / leads : 0;

            return {
                date: row.date_start || '',
                spend: spend,
                impressions: parseInt(row.impressions || '0'),
                clicks: parseInt(row.clicks || '0'),
                ctr: parseFloat(row.ctr || '0'),
                cpc: parseFloat(row.cpc || '0'),
                leads: leads,
                cpl: cpl
            };
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Campaign insights error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
