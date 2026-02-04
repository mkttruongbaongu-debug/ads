// API Route: Get user profile from TaiKhoan sheet

import { NextResponse } from 'next/server';

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const APPS_SCRIPT_SECRET = process.env.GOOGLE_APPS_SCRIPT_SECRET;

export async function GET() {
    console.log('[USER/PROFILE] 🔍 Starting...');
    try {
        if (!APPS_SCRIPT_URL || !APPS_SCRIPT_SECRET) {
            console.warn('[USER/PROFILE] ⚠️ Apps Script not configured');
            return NextResponse.json({
                success: false,
                error: 'Apps Script not configured'
            });
        }

        // Get user from TaiKhoan sheet
        const getTaiKhoanUrl = new URL(APPS_SCRIPT_URL);
        getTaiKhoanUrl.searchParams.set('secret', APPS_SCRIPT_SECRET);
        getTaiKhoanUrl.searchParams.set('action', 'getTaiKhoan');
        getTaiKhoanUrl.searchParams.set('fb_user_id', 'first');

        console.log('[USER/PROFILE] 📡 Calling Apps Script...');
        const res = await fetch(getTaiKhoanUrl.toString());
        const data = await res.json();
        console.log('[USER/PROFILE] 📦 Apps Script response:', data.success ? 'OK' : 'FAIL', data.found ? 'Found' : 'Not found');

        if (data.success && data.found && data.data) {
            console.log('[USER/PROFILE] ✅ User found:', data.data.name);
            return NextResponse.json({
                success: true,
                data: {
                    name: data.data.name || 'User',
                    email: data.data.email || '',
                    avatar: data.data.avatar || '',
                    plan: data.data.plan || 'Free',
                    fb_user_id: data.data.fb_user_id,
                }
            });
        }

        // Fallback if no TaiKhoan data
        console.log('[USER/PROFILE] ⚠️ No TaiKhoan data, using fallback');
        return NextResponse.json({
            success: true,
            data: {
                name: 'User',
                email: '',
                avatar: '',
                plan: 'Free',
            }
        });
    } catch (error) {
        console.error('[USER/PROFILE] ❌ Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
