// API Route: Get Facebook Ad Accounts

import { NextRequest, NextResponse } from 'next/server';
import { getDynamicFacebookClient } from '@/lib/facebook/client';

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const APPS_SCRIPT_SECRET = process.env.GOOGLE_APPS_SCRIPT_SECRET;

export async function GET(request: NextRequest) {
    try {
        console.log('[ACCOUNTS API] Starting to fetch ad accounts...');

        // Use dynamic client to get token from Sheets/OAuth
        const client = await getDynamicFacebookClient();
        console.log('[ACCOUNTS API] Got Facebook client, fetching accounts...');

        const rawAccounts = await client.getAdAccounts();
        console.log('[ACCOUNTS API] Got', rawAccounts.length, 'accounts');

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

        // Save accounts to TaiKhoan sheet for caching
        try {
            // First get fb_user_id from the first account (or from token)
            const getTaiKhoanUrl = new URL(APPS_SCRIPT_URL!);
            getTaiKhoanUrl.searchParams.set('secret', APPS_SCRIPT_SECRET!);
            getTaiKhoanUrl.searchParams.set('action', 'getTaiKhoan');
            getTaiKhoanUrl.searchParams.set('fb_user_id', 'first');

            const taiKhoanRes = await fetch(getTaiKhoanUrl.toString());
            const taiKhoanData = await taiKhoanRes.json();

            if (taiKhoanData.success && taiKhoanData.found && taiKhoanData.data?.fb_user_id) {
                // Use POST to save ad_accounts (avoids URL length limits)
                const saveRes = await fetch(APPS_SCRIPT_URL!, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        secret: APPS_SCRIPT_SECRET,
                        action: 'saveTaiKhoan',
                        fb_user_id: taiKhoanData.data.fb_user_id,
                        ad_accounts: accounts,
                    }),
                });
                const saveData = await saveRes.json();
                console.log('[ACCOUNTS API] Saved to Sheet:', saveData.success ? 'OK' : saveData.error);
            }
        } catch (saveErr) {
            console.error('[ACCOUNTS API] Failed to save accounts to Sheet:', saveErr);
            // Don't fail the request, just log the error
        }

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
