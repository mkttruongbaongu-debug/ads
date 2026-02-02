// Sync Facebook Ads data to Google Sheets

import { getSheetsClient, SHEET_SCHEMAS } from './client';
import { getFacebookClient } from '@/lib/facebook';
import { DateRange } from '@/lib/facebook/types';

export interface SyncResult {
    success: boolean;
    accountId: string;
    date: string;
    rowsAdded: number;
    error?: string;
}

// Sync một ngày data cho một account
export async function syncDailyData(
    accountId: string,
    accountName: string,
    date: string // YYYY-MM-DD
): Promise<SyncResult> {
    try {
        const sheets = getSheetsClient();
        const fbClient = getFacebookClient();

        const dateRange: DateRange = {
            startDate: date,
            endDate: date,
        };

        // Kiểm tra xem đã sync ngày này chưa
        const existingData = await sheets.readSheet('Campaigns', 'A:D');
        const alreadySynced = existingData.some(
            row => row[0] === date && row[1] === accountId
        );

        if (alreadySynced) {
            return {
                success: true,
                accountId,
                date,
                rowsAdded: 0,
                error: 'Data already synced for this date',
            };
        }

        // Fetch campaigns
        const campaigns = await fbClient.getCampaigns(accountId);

        // Fetch insights
        const insights = await fbClient.getInsightsSummary(accountId, dateRange, 'campaign');

        // Map và tạo rows
        const rows: (string | number)[][] = campaigns.map(campaign => {
            const insight = insights.find(i => i.campaign_id === campaign.id);

            return [
                date,
                accountId,
                accountName,
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.objective || '',
                parseFloat(insight?.spend || '0'),
                parseInt(insight?.impressions || '0'),
                parseInt(insight?.reach || '0'),
                parseInt(insight?.clicks || '0'),
                parseFloat(insight?.ctr || '0'),
                parseFloat(insight?.cpc || '0'),
                parseFloat(insight?.cpm || '0'),
                parseFloat(insight?.frequency || '0'),
                0, // results - cần parse từ actions
                0, // cost_per_result
            ];
        });

        // Filter out campaigns with no spend (optional - có thể bỏ nếu muốn lưu all)
        const rowsWithData = rows.filter(row => (row[7] as number) > 0 || (row[8] as number) > 0);

        if (rowsWithData.length === 0) {
            return {
                success: true,
                accountId,
                date,
                rowsAdded: 0,
                error: 'No data to sync (all campaigns have 0 spend/impressions)',
            };
        }

        // Append to sheet
        const addedRows = await sheets.appendRows('Campaigns', rowsWithData);

        return {
            success: true,
            accountId,
            date,
            rowsAdded: addedRows,
        };
    } catch (error) {
        return {
            success: false,
            accountId,
            date,
            rowsAdded: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// Sync nhiều ngày cho một account
export async function syncDateRange(
    accountId: string,
    accountName: string,
    startDate: string,
    endDate: string
): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const dates = getDatesBetween(startDate, endDate);

    for (const date of dates) {
        const result = await syncDailyData(accountId, accountName, date);
        results.push(result);
    }

    return results;
}

// Helper: Lấy danh sách ngày giữa 2 ngày
function getDatesBetween(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    const current = new Date(start);
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

// Initialize sheet với headers nếu chưa có
export async function initializeCampaignsSheet(): Promise<void> {
    const sheets = getSheetsClient();

    // Tạo sheet nếu chưa có
    await sheets.createSheetIfNotExists('Campaigns');

    // Kiểm tra xem đã có headers chưa
    const existingData = await sheets.readSheet('Campaigns', 'A1:A1');

    if (existingData.length === 0) {
        // Add headers - spread to convert readonly to mutable array
        await sheets.appendRows('Campaigns', [[...SHEET_SCHEMAS.Campaigns]]);
        console.log('Campaigns sheet initialized with headers');
    }
}
