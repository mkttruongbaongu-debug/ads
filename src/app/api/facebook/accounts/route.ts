// API Route: Get Facebook Ad Accounts
// Priority: 1. Cache (Sheet) -> 2. Facebook API (then save to cache)

import { NextRequest, NextResponse } from 'next/server';
import { getDynamicFacebookClient } from '@/lib/facebook/client';

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const APPS_SCRIPT_SECRET = process.env.GOOGLE_APPS_SCRIPT_SECRET;

export async function GET(request: NextRequest) {
    // Check if force refresh is requested
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    try {
        console.log('[ACCOUNTS API] Starting...', forceRefresh ? '(force refresh)' : '');

        // STEP 1: Try to get from cache (Sheet) first
        if (!forceRefresh) {
            try {
                const getTaiKhoanUrl = new URL(APPS_SCRIPT_URL!);
                getTaiKhoanUrl.searchParams.set('secret', APPS_SCRIPT_SECRET!);
                getTaiKhoanUrl.searchParams.set('action', 'getTaiKhoan');
                getTaiKhoanUrl.searchParams.set('fb_user_id', 'first');

                const cacheRes = await fetch(getTaiKhoanUrl.toString());
                const cacheData = await cacheRes.json();

                // If cache has ad_accounts, return immediately
                if (cacheData.success && cacheData.found && cacheData.data?.ad_accounts?.length > 0) {
                    console.log('[ACCOUNTS API] Loaded', cacheData.data.ad_accounts.length, 'accounts from cache');
                    return NextResponse.json({
                        success: true,
                        data: cacheData.data.ad_accounts,
                        source: 'cache'
                    });
                }
                console.log('[ACCOUNTS API] Cache empty or not found, fetching from Facebook...');
            } catch (cacheErr) {
                console.error('[ACCOUNTS API] Cache read error:', cacheErr);
                // Continue to fetch from Facebook
            }
        }

        // STEP 2: Fetch from Facebook API
        const client = await getDynamicFacebookClient();
        console.log('[ACCOUNTS API] Got Facebook client, fetching accounts...');

        const rawAccounts = await client.getAdAccounts();
        console.log('[ACCOUNTS API] Got', rawAccounts.length, 'accounts from Facebook');

        // Transform data: map account_status to isActive
        const accounts = rawAccounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            isActive: acc.account_status === 1, // 1 = ACTIVE
            currency: acc.currency,
            timezone: acc.timezone_name,
            account_status: acc.account_status,
        }));

        // STEP 3: Save to cache (Sheet)
        try {
            const getTaiKhoanUrl = new URL(APPS_SCRIPT_URL!);
            getTaiKhoanUrl.searchParams.set('secret', APPS_SCRIPT_SECRET!);
            getTaiKhoanUrl.searchParams.set('action', 'getTaiKhoan');
            getTaiKhoanUrl.searchParams.set('fb_user_id', 'first');

            const taiKhoanRes = await fetch(getTaiKhoanUrl.toString());
            const taiKhoanData = await taiKhoanRes.json();

            if (taiKhoanData.success && taiKhoanData.found && taiKhoanData.data?.fb_user_id) {
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
                console.log('[ACCOUNTS API] Saved to cache:', saveData.success ? 'OK' : saveData.error);
            }
        } catch (saveErr) {
            console.error('[ACCOUNTS API] Failed to save to cache:', saveErr);
        }

        return NextResponse.json({
            success: true,
            data: accounts,
            source: 'facebook'
        });
    } catch (error) {
        console.error('Error fetching ad accounts:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
