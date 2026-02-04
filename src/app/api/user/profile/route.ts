// API Route: Get user profile from TaiKhoan sheet

import { NextResponse } from 'next/server';

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const APPS_SCRIPT_SECRET = process.env.GOOGLE_APPS_SCRIPT_SECRET;

export async function GET() {
    try {
        if (!APPS_SCRIPT_URL || !APPS_SCRIPT_SECRET) {
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

        const res = await fetch(getTaiKhoanUrl.toString());
        const data = await res.json();

        if (data.success && data.found && data.data) {
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
        console.error('Get user profile error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
