// API Route: Get Facebook Ad Accounts

import { NextRequest, NextResponse } from 'next/server';
import { getDynamicFacebookClient } from '@/lib/facebook/client';

export async function GET(request: NextRequest) {
    try {
        // Use dynamic client to get token from Sheets/OAuth
        const client = await getDynamicFacebookClient();
        const accounts = await client.getAdAccounts();

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
