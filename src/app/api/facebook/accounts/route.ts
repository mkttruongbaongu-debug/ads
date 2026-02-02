// API Route: Get Facebook Ad Accounts

import { NextRequest, NextResponse } from 'next/server';
import { getFacebookClient } from '@/lib/facebook';

export async function GET(request: NextRequest) {
    try {
        const client = getFacebookClient();
        const accounts = await client.getAdAccounts();

        return NextResponse.json({
            success: true,
            data: accounts
        });
    } catch (error) {
        console.error('Error fetching ad accounts:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
