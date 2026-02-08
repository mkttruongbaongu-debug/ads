/**
 * ===================================================================
 * API INIT - One call to rule them all
 * ===================================================================
 * Replaces 3 separate API calls:
 *   /api/user/profile    → getTaiKhoan → name, avatar, plan
 *   /api/facebook/accounts → getTaiKhoan → ad_accounts
 *   /api/de-xuat/danh-sach?status=CHO_DUYET → pending count
 * 
 * Now: 1 call to Apps Script → returns everything
 * Saves ~2-3 seconds on dashboard load
 * ===================================================================
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const APPS_SCRIPT_SECRET = process.env.GOOGLE_APPS_SCRIPT_SECRET;

export async function GET() {
    const startTime = Date.now();
    console.log('[API/INIT] 🚀 Starting unified init...');

    try {
        if (!APPS_SCRIPT_URL || !APPS_SCRIPT_SECRET) {
            return NextResponse.json({
                success: false,
                error: 'Apps Script not configured'
            });
        }

        // ONE call to Apps Script for TaiKhoan (has profile + accounts)
        const getTaiKhoanUrl = new URL(APPS_SCRIPT_URL);
        getTaiKhoanUrl.searchParams.set('secret', APPS_SCRIPT_SECRET);
        getTaiKhoanUrl.searchParams.set('action', 'getTaiKhoan');
        getTaiKhoanUrl.searchParams.set('fb_user_id', 'first');

        // Get userId from session for filtering proposals
        let userId = '';
        try {
            const session = await getServerSession(authOptions);
            userId = session?.user?.name || session?.user?.email || '';
        } catch { /* ignore auth errors for init */ }

        // Fetch TaiKhoan + pending proposals in parallel
        const pendingUrl = new URL(APPS_SCRIPT_URL);
        pendingUrl.searchParams.set('secret', APPS_SCRIPT_SECRET);
        pendingUrl.searchParams.set('action', 'layDanhSachDeXuat');
        pendingUrl.searchParams.set('status', 'CHO_DUYET');
        if (userId) pendingUrl.searchParams.set('userId', userId);

        const [taiKhoanRes, pendingRes] = await Promise.allSettled([
            fetch(getTaiKhoanUrl.toString()),
            fetch(pendingUrl.toString()),
        ]);

        // Parse TaiKhoan
        let profile = { name: 'User', avatar: '', plan: 'Free', email: '' };
        let accounts: Array<{
            id: string;
            name: string;
            isActive: boolean;
            currency: string;
            timezone: string;
        }> = [];

        if (taiKhoanRes.status === 'fulfilled') {
            const taiKhoanData = await taiKhoanRes.value.json();
            if (taiKhoanData.success && taiKhoanData.found && taiKhoanData.data) {
                profile = {
                    name: taiKhoanData.data.name || 'User',
                    avatar: taiKhoanData.data.avatar || '',
                    plan: taiKhoanData.data.plan || 'Free',
                    email: taiKhoanData.data.email || '',
                };
                accounts = taiKhoanData.data.ad_accounts || [];
                console.log('[API/INIT] ✅ TaiKhoan loaded:', profile.name, accounts.length, 'accounts');
            }
        } else {
            console.error('[API/INIT] ❌ TaiKhoan failed:', taiKhoanRes.reason);
        }

        // Parse pending proposals count
        let pendingCount = 0;
        if (pendingRes.status === 'fulfilled') {
            try {
                const pendingData = await pendingRes.value.json();
                if (pendingData.success && Array.isArray(pendingData.data)) {
                    pendingCount = pendingData.data.length;
                }
            } catch {
                // Ignore parse errors
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`[API/INIT] ✅ Complete in ${elapsed}ms - Profile: ${profile.name}, Accounts: ${accounts.length}, Pending: ${pendingCount}`);

        return NextResponse.json({
            success: true,
            data: {
                profile,
                accounts,
                pendingCount,
            },
            elapsed,
        });

    } catch (error) {
        console.error('[API/INIT] ❌ Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
