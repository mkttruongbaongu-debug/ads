// API Route: Get Facebook Ad Accounts

import { NextRequest, NextResponse } from 'next/server';
import { getDynamicFacebookClient } from '@/lib/facebook/client';

export async function GET(request: NextRequest) {
    try {
        // Use dynamic client to get token from Sheets/OAuth
        const client = await getDynamicFacebookClient();
        const rawAccounts = await client.getAdAccounts();

        // Transform data: map account_status to isActive
        // Facebook account_status: 1 = ACTIVE, others = INACTIVE/DISABLED
        const accounts = rawAccounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            isActive: acc.account_status === 1, // 1 = ACTIVE
            currency: acc.currency,
            timezone: acc.timezone_name,
            account_status: acc.account_status, // Keep original for debugging
        }));

        return NextResponse.json({
            success: true,
            data: accounts
        });
    } catch (error) {
        console.error('Error fetching ad accounts:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Check if token-related error
        const isTokenError =
            errorMessage.toLowerCase().includes('token') ||
            errorMessage.toLowerCase().includes('expired') ||
            errorMessage.toLowerCase().includes('session') ||
            errorMessage.toLowerCase().includes('login');

        return NextResponse.json(
            {
                success: false,
                error: errorMessage,
                needsLogin: isTokenError
            },
            { status: isTokenError ? 401 : 500 }
        );
    }
}
