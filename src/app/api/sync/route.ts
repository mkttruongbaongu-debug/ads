// API Route: Sync Facebook data to Google Sheets

import { NextRequest, NextResponse } from 'next/server';
import { syncDailyData, syncDateRange, initializeCampaignsSheet } from '@/lib/sheets/sync';
import { getFacebookClient } from '@/lib/facebook';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { accountId, accountName, startDate, endDate, date } = body;

        if (!accountId || !accountName) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters: accountId, accountName' },
                { status: 400 }
            );
        }

        // Initialize sheet if needed
        await initializeCampaignsSheet();

        // Sync single day or date range
        if (date) {
            const result = await syncDailyData(accountId, accountName, date);
            return NextResponse.json({
                success: result.success,
                data: result,
            });
        } else if (startDate && endDate) {
            const results = await syncDateRange(accountId, accountName, startDate, endDate);
            return NextResponse.json({
                success: true,
                data: {
                    results,
                    totalSynced: results.filter(r => r.rowsAdded > 0).length,
                    totalRows: results.reduce((sum, r) => sum + r.rowsAdded, 0),
                },
            });
        } else {
            // Default: sync yesterday
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            const result = await syncDailyData(accountId, accountName, yesterdayStr);
            return NextResponse.json({
                success: result.success,
                data: result,
            });
        }
    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

// GET: Sync all accounts for a specific date
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

        // Get all accounts
        const fbClient = getFacebookClient();
        const accounts = await fbClient.getAdAccounts();

        // Initialize sheet
        await initializeCampaignsSheet();

        // Sync each account
        const results = await Promise.all(
            accounts.map(acc =>
                syncDailyData(
                    acc.id.replace('act_', ''),
                    acc.name,
                    date
                )
            )
        );

        return NextResponse.json({
            success: true,
            data: {
                date,
                accounts: results.length,
                totalRows: results.reduce((sum, r) => sum + r.rowsAdded, 0),
                results,
            },
        });
    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
