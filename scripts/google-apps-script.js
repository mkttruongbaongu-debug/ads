/**
 * THỢ ADS AI - Google Apps Script
 * Full quyền tạo/sửa/xóa/update toàn bộ sheet
 * 
 * CÁCH DEPLOY:
 * 1. Tạo Google Sheet mới
 * 2. Vào Extensions > Apps Script
 * 3. Copy toàn bộ code này vào Code.gs
 * 4. Deploy > New deployment > Web app
 * 5. Execute as: Me, Who has access: Anyone
 * 6. Copy URL và thêm vào .env.local
 */

// ==================== CONFIG ====================
const CONFIG = {
    // Sheet names
    CAMPAIGNS_SHEET: 'Campaigns',
    ACCOUNTS_SHEET: 'Accounts',
    LOGS_SHEET: 'Logs',
    TOKENS_SHEET: 'Tokens',  // Lưu Facebook OAuth tokens

    // API Secret (để bảo vệ endpoint)
    API_SECRET: 'tho-ads-ai-2026' // Thay đổi secret này
};

// ==================== HEADERS - COMPREHENSIVE METRICS ====================
const HEADERS = {
    Campaigns: [
        // Identification (7 cols)
        'date', 'account_id', 'account_name', 'campaign_id', 'campaign_name', 'status', 'objective',
        // Spend & Reach (4 cols)
        'spend', 'impressions', 'reach', 'frequency',
        // Clicks & CTR (6 cols)
        'clicks', 'unique_clicks', 'link_clicks', 'unique_link_clicks', 'ctr', 'link_ctr',
        // Cost Metrics (4 cols)
        'cpc', 'cost_per_unique_click', 'cost_per_link_click', 'cpm',
        // Landing Page (2 cols)
        'landing_page_views', 'cost_per_landing_page_view',
        // E-commerce Funnel (10 cols)
        'view_content', 'cost_per_view_content', 'add_to_cart', 'add_to_cart_value', 'cost_per_add_to_cart',
        'initiate_checkout', 'cost_per_checkout', 'purchases', 'purchase_value', 'cost_per_purchase',
        // Derived KPIs (6 cols)
        'aov', 'cac', 'cvr', 'roas', 'gross_profit', 'profit_margin',
        // Funnel Rates (3 cols)
        'add_to_cart_rate', 'checkout_rate', 'purchase_rate',
        // Engagement (6 cols)
        'post_engagement', 'engagement_rate', 'cost_per_engagement', 'reactions', 'comments', 'saves',
        // Messaging (2 cols)
        'messages', 'cost_per_message',
        // Video (8 cols)
        'video_plays', 'video_thruplay', 'video_p25', 'video_p50', 'video_p75', 'video_p100', 'video_completion_rate', 'video_hook_rate',
        // Lead Gen (4 cols)
        'leads', 'cost_per_lead', 'registrations', 'cost_per_registration',
        // Timestamp
        'synced_at'
    ],
    Accounts: [
        'account_id', 'account_name', 'currency', 'timezone', 'status', 'last_sync'
    ],
    Logs: [
        'timestamp', 'action', 'account_id', 'date', 'rows_count', 'status', 'message'
    ],
    Tokens: [
        'user_id', 'access_token', 'token_type', 'expires_at', 'created_at', 'updated_at'
    ]
};

// ==================== MAIN FUNCTIONS ====================

/**
 * Web App entry point - xử lý POST requests
 */
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);

        // Verify API secret
        if (data.secret !== CONFIG.API_SECRET) {
            return createResponse({ success: false, error: 'Invalid API secret' }, 401);
        }

        const action = data.action;

        switch (action) {
            case 'sync':
                return syncData(data);
            case 'append':
                return appendData(data);
            case 'update':
                return updateData(data);
            case 'delete':
                return deleteData(data);
            case 'clear':
                return clearSheet(data);
            case 'init':
                return initializeSheets();
            case 'saveToken':
                return saveToken(data);
            default:
                return createResponse({ success: false, error: 'Unknown action: ' + action });
        }
    } catch (error) {
        return createResponse({ success: false, error: error.toString() }, 500);
    }
}

/**
 * Web App entry point - xử lý GET requests (đọc data)
 */
function doGet(e) {
    try {
        const params = e.parameter;
        const secret = params.secret;

        if (secret !== CONFIG.API_SECRET) {
            return createResponse({ success: false, error: 'Invalid API secret' }, 401);
        }

        const action = params.action;

        switch (action) {
            case 'read':
                return readData(params);
            case 'history':
                return getCampaignHistory(params);
            case 'status':
                return getStatus();
            case 'getToken':
                return getToken(params);
            default:
                return createResponse({ success: false, error: 'Unknown action: ' + action });
        }
    } catch (error) {
        return createResponse({ success: false, error: error.toString() }, 500);
    }
}

// ==================== CRUD OPERATIONS ====================

/**
 * Sync data - append nếu chưa có, skip nếu đã sync
 */
function syncData(data) {
    const { sheetName, rows, accountId, date } = data;
    const sheet = getOrCreateSheet(sheetName || CONFIG.CAMPAIGNS_SHEET);

    // Kiểm tra đã sync chưa
    const existingData = sheet.getDataRange().getValues();
    const alreadySynced = existingData.some(row =>
        row[0] === date && row[1] === accountId
    );

    if (alreadySynced) {
        logAction('sync', accountId, date, 0, 'skipped', 'Already synced');
        return createResponse({
            success: true,
            message: 'Already synced',
            rowsAdded: 0
        });
    }

    // Append new rows
    if (rows && rows.length > 0) {
        const timestamp = new Date().toISOString();
        const rowsWithTimestamp = rows.map(row => [...row, timestamp]);
        sheet.getRange(sheet.getLastRow() + 1, 1, rowsWithTimestamp.length, rowsWithTimestamp[0].length)
            .setValues(rowsWithTimestamp);

        logAction('sync', accountId, date, rows.length, 'success', '');
        return createResponse({
            success: true,
            message: 'Data synced',
            rowsAdded: rows.length
        });
    }

    return createResponse({ success: true, message: 'No data to sync', rowsAdded: 0 });
}

/**
 * Append data - thêm dữ liệu mới
 */
function appendData(data) {
    const { sheetName, rows } = data;
    const sheet = getOrCreateSheet(sheetName);

    if (rows && rows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length)
            .setValues(rows);
        return createResponse({ success: true, rowsAdded: rows.length });
    }

    return createResponse({ success: false, error: 'No rows provided' });
}

/**
 * Update data - cập nhật dữ liệu theo điều kiện
 */
function updateData(data) {
    const { sheetName, matchColumn, matchValue, updateColumn, updateValue } = data;
    const sheet = getOrCreateSheet(sheetName);
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];

    const matchIdx = headers.indexOf(matchColumn);
    const updateIdx = headers.indexOf(updateColumn);

    if (matchIdx === -1 || updateIdx === -1) {
        return createResponse({ success: false, error: 'Column not found' });
    }

    let updatedCount = 0;
    for (let i = 1; i < allData.length; i++) {
        if (allData[i][matchIdx] === matchValue) {
            sheet.getRange(i + 1, updateIdx + 1).setValue(updateValue);
            updatedCount++;
        }
    }

    return createResponse({ success: true, rowsUpdated: updatedCount });
}

/**
 * Delete data - xóa dữ liệu theo điều kiện
 */
function deleteData(data) {
    const { sheetName, matchColumn, matchValue } = data;
    const sheet = getOrCreateSheet(sheetName);
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];

    const matchIdx = headers.indexOf(matchColumn);
    if (matchIdx === -1) {
        return createResponse({ success: false, error: 'Column not found' });
    }

    // Xóa từ dưới lên để không bị lệch index
    let deletedCount = 0;
    for (let i = allData.length - 1; i >= 1; i--) {
        if (allData[i][matchIdx] === matchValue) {
            sheet.deleteRow(i + 1);
            deletedCount++;
        }
    }

    return createResponse({ success: true, rowsDeleted: deletedCount });
}

/**
 * Clear toàn bộ sheet (giữ lại headers)
 */
function clearSheet(data) {
    const { sheetName } = data;
    const sheet = getOrCreateSheet(sheetName);

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
    }

    return createResponse({ success: true, message: 'Sheet cleared' });
}

/**
 * Đọc data từ sheet
 */
function readData(params) {
    const sheetName = params.sheet || CONFIG.CAMPAIGNS_SHEET;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

    if (!sheet) {
        return createResponse({ success: false, error: 'Sheet not found' });
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
    });

    // Filter nếu có params
    let filtered = rows;
    if (params.campaignId) {
        filtered = filtered.filter(r => r.campaign_id === params.campaignId);
    }
    if (params.accountId) {
        filtered = filtered.filter(r => r.account_id === params.accountId);
    }
    if (params.startDate) {
        filtered = filtered.filter(r => r.date >= params.startDate);
    }
    if (params.endDate) {
        filtered = filtered.filter(r => r.date <= params.endDate);
    }

    return createResponse({
        success: true,
        data: filtered,
        count: filtered.length
    });
}

/**
 * Lấy lịch sử campaign cho trend chart
 */
function getCampaignHistory(params) {
    const campaignId = params.campaignId;
    const startDate = params.startDate;
    const endDate = params.endDate;

    const result = readData({
        sheet: CONFIG.CAMPAIGNS_SHEET,
        campaignId: campaignId,
        startDate: startDate,
        endDate: endDate
    });

    // Parse response và sort by date
    const response = JSON.parse(result.getContent());
    if (response.success && response.data) {
        response.data.sort((a, b) => a.date.localeCompare(b.date));
    }

    return createResponse(response);
}

/**
 * Lấy trạng thái hệ thống
 */
function getStatus() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets().map(s => ({
        name: s.getName(),
        rows: s.getLastRow(),
        cols: s.getLastColumn()
    }));

    return createResponse({
        success: true,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        sheets: sheets,
        timestamp: new Date().toISOString()
    });
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Khởi tạo các sheets với headers
 */
function initializeSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const created = [];

    // Tạo từng sheet
    Object.keys(HEADERS).forEach(sheetName => {
        let sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
            sheet = ss.insertSheet(sheetName);
            created.push(sheetName);
        }

        // Check nếu chưa có headers
        if (sheet.getLastRow() === 0) {
            sheet.getRange(1, 1, 1, HEADERS[sheetName].length)
                .setValues([HEADERS[sheetName]]);

            // Format header row
            sheet.getRange(1, 1, 1, HEADERS[sheetName].length)
                .setBackground('#4285f4')
                .setFontColor('white')
                .setFontWeight('bold');

            // Freeze header row
            sheet.setFrozenRows(1);
        }
    });

    logAction('init', '', '', 0, 'success', 'Sheets initialized: ' + created.join(', '));

    return createResponse({
        success: true,
        message: 'Sheets initialized',
        created: created
    });
}

/**
 * Lấy hoặc tạo sheet
 */
function getOrCreateSheet(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
        sheet = ss.insertSheet(sheetName);

        // Add headers if defined
        if (HEADERS[sheetName]) {
            sheet.getRange(1, 1, 1, HEADERS[sheetName].length)
                .setValues([HEADERS[sheetName]]);
        }
    }

    return sheet;
}

/**
 * Ghi log hành động
 */
function logAction(action, accountId, date, rowsCount, status, message) {
    try {
        const sheet = getOrCreateSheet(CONFIG.LOGS_SHEET);
        sheet.appendRow([
            new Date().toISOString(),
            action,
            accountId,
            date,
            rowsCount,
            status,
            message
        ]);
    } catch (e) {
        console.error('Log error:', e);
    }
}

/**
 * Tạo JSON response
 */
function createResponse(data, statusCode = 200) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

// ==================== MENU & TRIGGERS ====================

/**
 * Thêm custom menu khi mở spreadsheet
 */
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('🔧 Thợ ADS AI')
        .addItem('📊 Khởi tạo Sheets', 'initializeSheets')
        .addItem('🗑️ Xóa dữ liệu Campaigns', 'clearCampaignsSheet')
        .addItem('📋 Xem trạng thái', 'showStatus')
        .addToUi();
}

/**
 * Xóa dữ liệu Campaigns (giữ headers)
 */
function clearCampaignsSheet() {
    clearSheet({ sheetName: CONFIG.CAMPAIGNS_SHEET });
    SpreadsheetApp.getUi().alert('Đã xóa dữ liệu Campaigns!');
}

/**
 * Hiển thị trạng thái
 */
function showStatus() {
    const status = JSON.parse(getStatus().getContent());
    const msg = status.sheets.map(s => `${s.name}: ${s.rows} rows`).join('\n');
    SpreadsheetApp.getUi().alert('Trạng thái:\n\n' + msg);
}

// ==================== TOKEN MANAGEMENT ====================

/**
 * Lưu Facebook OAuth token
 * @param {Object} data - { userId, accessToken, tokenType, expiresAt }
 */
function saveToken(data) {
    const { userId, accessToken, tokenType, expiresAt } = data;

    if (!userId || !accessToken) {
        return createResponse({ success: false, error: 'Missing userId or accessToken' });
    }

    const sheet = getOrCreateSheet(CONFIG.TOKENS_SHEET);
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const now = new Date().toISOString();

    // Tìm row có userId này
    const userIdIdx = headers.indexOf('user_id');
    let rowIndex = -1;

    for (let i = 1; i < allData.length; i++) {
        if (allData[i][userIdIdx] === userId) {
            rowIndex = i + 1; // 1-indexed
            break;
        }
    }

    const tokenData = [userId, accessToken, tokenType || 'bearer', expiresAt || '', now, now];

    if (rowIndex > 0) {
        // Update existing row
        sheet.getRange(rowIndex, 1, 1, tokenData.length).setValues([tokenData]);
        logAction('saveToken', userId, '', 1, 'updated', 'Token updated');
    } else {
        // Append new row
        sheet.appendRow(tokenData);
        logAction('saveToken', userId, '', 1, 'created', 'Token created');
    }

    return createResponse({
        success: true,
        message: rowIndex > 0 ? 'Token updated' : 'Token created',
        userId: userId
    });
}

/**
 * Lấy Facebook OAuth token cho userId
 * @param {Object} params - { userId }
 */
function getToken(params) {
    const userId = params.userId || 'default';

    // Tự động tạo sheet nếu chưa có
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TOKENS_SHEET);
    if (!sheet) {
        sheet = getOrCreateSheet(CONFIG.TOKENS_SHEET);
    }

    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];

    // Nếu sheet trống hoặc chỉ có headers → chưa có token
    if (allData.length <= 1) {
        return createResponse({
            success: true,
            hasToken: false,
            message: 'No token found for userId: ' + userId
        });
    }

    // Tìm token cho userId
    for (let i = 1; i < allData.length; i++) {
        const row = allData[i];
        const obj = {};
        headers.forEach((h, idx) => obj[h] = row[idx]);

        if (obj.user_id === userId) {
            // Check expiry
            const expiresAt = obj.expires_at ? new Date(obj.expires_at) : null;
            const isExpired = expiresAt && expiresAt < new Date();

            return createResponse({
                success: true,
                hasToken: true,
                isExpired: isExpired,
                token: {
                    user_id: obj.user_id,
                    access_token: isExpired ? null : obj.access_token,
                    token_type: obj.token_type,
                    expires_at: obj.expires_at,
                    created_at: obj.created_at,
                    updated_at: obj.updated_at
                }
            });
        }
    }

    return createResponse({
        success: true,
        hasToken: false,
        message: 'No token found for userId: ' + userId
    });
}
