// Google Sheets Database Client

import { google, sheets_v4 } from 'googleapis';

export interface SheetConfig {
    spreadsheetId: string;
    sheetName: string;
}

export class GoogleSheetsClient {
    private sheets: sheets_v4.Sheets;
    private spreadsheetId: string;

    constructor(spreadsheetId: string) {
        this.spreadsheetId = spreadsheetId;

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        this.sheets = google.sheets({ version: 'v4', auth });
    }

    // Đọc data từ sheet
    async readSheet(sheetName: string, range?: string): Promise<string[][]> {
        const fullRange = range ? `${sheetName}!${range}` : sheetName;

        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: fullRange,
        });

        return response.data.values || [];
    }

    // Ghi data vào sheet (append)
    async appendRows(sheetName: string, rows: (string | number)[][]): Promise<number> {
        const response = await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range: sheetName,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: rows,
            },
        });

        return response.data.updates?.updatedRows || 0;
    }

    // Ghi đè toàn bộ sheet
    async writeSheet(sheetName: string, rows: (string | number)[][]): Promise<number> {
        // Clear existing data first
        await this.sheets.spreadsheets.values.clear({
            spreadsheetId: this.spreadsheetId,
            range: sheetName,
        });

        const response = await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: sheetName,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: rows,
            },
        });

        return response.data.updatedRows || 0;
    }

    // Tạo sheet mới nếu chưa có
    async createSheetIfNotExists(sheetName: string): Promise<void> {
        const spreadsheet = await this.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId,
        });

        const existingSheet = spreadsheet.data.sheets?.find(
            (s) => s.properties?.title === sheetName
        );

        if (!existingSheet) {
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: sheetName,
                                },
                            },
                        },
                    ],
                },
            });
        }
    }

    // Lấy danh sách sheets
    async getSheetNames(): Promise<string[]> {
        const spreadsheet = await this.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId,
        });

        return spreadsheet.data.sheets?.map((s) => s.properties?.title || '') || [];
    }
}

// Schema definitions cho các sheets
export const SHEET_SCHEMAS = {
    Accounts: [
        'account_id',
        'name',
        'status',
        'currency',
        'timezone',
        'last_sync',
    ],
    Campaigns: [
        'date',
        'account_id',
        'account_name',
        'campaign_id',
        'campaign_name',
        'status',
        'objective',
        'spend',
        'impressions',
        'reach',
        'clicks',
        'ctr',
        'cpc',
        'cpm',
        'frequency',
        'results',
        'cost_per_result',
    ],
    Adsets: [
        'date',
        'account_id',
        'campaign_id',
        'adset_id',
        'adset_name',
        'status',
        'spend',
        'impressions',
        'reach',
        'clicks',
        'ctr',
        'cpc',
        'cpm',
        'frequency',
        'results',
        'cost_per_result',
    ],
    Ads: [
        'date',
        'account_id',
        'adset_id',
        'ad_id',
        'ad_name',
        'status',
        'spend',
        'impressions',
        'clicks',
        'ctr',
        'cpc',
        'cpm',
        'results',
        'cost_per_result',
    ],
} as const;

// Singleton instance
let sheetsInstance: GoogleSheetsClient | null = null;

export function getSheetsClient(): GoogleSheetsClient {
    if (!sheetsInstance) {
        const spreadsheetId = process.env.SPREADSHEET_ID;

        if (!spreadsheetId) {
            throw new Error('SPREADSHEET_ID is not configured');
        }

        sheetsInstance = new GoogleSheetsClient(spreadsheetId);
    }

    return sheetsInstance;
}
