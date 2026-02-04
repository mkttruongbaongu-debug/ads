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
    TAI_KHOAN_SHEET: 'TaiKhoan',  // NEW: Gộp token + user + ad accounts cache
    AI_USAGE_SHEET: 'AiUsage',

    // API Secret (để bảo vệ endpoint)
    API_SECRET: 'tho-ads-ai-2026'
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
    TaiKhoan: [
        // User Identity
        'fb_user_id', 'name', 'email', 'avatar',
        // OAuth Token
        'access_token', 'token_type', 'token_expires_at',
        // Ad Accounts Cache (JSON array)
        'ad_accounts',
        // Subscription
        'plan',
        // Timestamps
        'created_at', 'last_login'
    ],
    AiUsage: [
        // Request info
        'request_id', 'timestamp', 'user_id', 'action_type', 'model',
        // Token breakdown
        'input_tokens', 'input_uncached', 'cached_tokens', 'output_tokens', 'total_tokens',
        // Cost USD breakdown
        'cost_input_usd', 'cost_cached_usd', 'cost_output_usd', 'cost_total_usd',
        // Cost VND breakdown (để tính tiền)
        'cost_input_vnd', 'cost_cached_vnd', 'cost_output_vnd', 'cost_total_vnd'
    ]
};

/**
 * Helper: Đảm bảo sheet có headers đúng
 * Nếu sheet trống hoặc row 1 không phải headers -> insert headers
 */
function ensureHeaders(sheet, sheetName) {
    const headers = HEADERS[sheetName];
    if (!headers || headers.length === 0) return false;

    const lastRow = sheet.getLastRow();
    let needHeaders = false;

    if (lastRow === 0) {
        // Sheet trống hoàn toàn
        needHeaders = true;
    } else {
        // Check cell A1 có phải header không
        const firstCell = sheet.getRange(1, 1).getValue();
        if (firstCell !== headers[0]) {
            needHeaders = true;
        }
    }

    if (needHeaders) {
        // Insert row ở đầu nếu có data
        if (lastRow > 0) {
            sheet.insertRowBefore(1);
        }

        // Thêm headers
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        // Format: Bold, Blue background, White text, Frozen
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#1a73e8');
        headerRange.setFontColor('#ffffff');
        sheet.setFrozenRows(1);

        return true; // Headers đã được thêm
    }

    return false; // Headers đã có sẵn
}

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
            // NEW: TaiKhoan management
            case 'saveTaiKhoan':
                return saveTaiKhoan(data);
            case 'saveAdAccounts':
                return saveAdAccounts(data);
            case 'fixHeaders':
                return fixHeaders(data);
            case 'logAiUsage':
                return logAiUsage(data);
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
            // NEW: TaiKhoan
            case 'getTaiKhoan':
                return getTaiKhoan(params);
            case 'getAiUsage':
                return getAiUsage(params);
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
 * Tự động thêm headers nếu sheet trống HOẶC nếu row 1 không phải headers
 */
function appendData(data) {
    const { sheetName, rows } = data;
    const sheet = getOrCreateSheet(sheetName);
    let headersAdded = false;

    if (rows && rows.length > 0) {
        const headers = HEADERS[sheetName];
        const lastRow = sheet.getLastRow();

        // Check if headers are missing or incorrect
        if (headers && headers.length > 0) {
            let needHeaders = false;

            if (lastRow === 0) {
                // Sheet is completely empty
                needHeaders = true;
            } else {
                // Sheet has data - check if row 1 is actually headers
                const firstCell = sheet.getRange(1, 1).getValue();
                const expectedFirstHeader = headers[0];

                // If first cell doesn't match expected header, we need to insert headers
                if (firstCell !== expectedFirstHeader) {
                    needHeaders = true;
                }
            }

            if (needHeaders) {
                // Insert a new row at top for headers
                if (lastRow > 0) {
                    sheet.insertRowBefore(1);
                }

                // Add headers
                sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

                // Format header row - bold, freeze, blue background
                const headerRange = sheet.getRange(1, 1, 1, headers.length);
                headerRange.setFontWeight('bold');
                headerRange.setBackground('#1a73e8');
                headerRange.setFontColor('#ffffff');
                sheet.setFrozenRows(1);
                headersAdded = true;
            }
        }

        // Append data rows
        const startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);

        return createResponse({
            success: true,
            rowsAdded: rows.length,
            headersAdded: headersAdded
        });
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
            const headers = HEADERS[sheetName];
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

            // Auto-format header: màu xanh, chữ trắng bold, freeze row
            sheet.getRange(1, 1, 1, headers.length)
                .setBackground('#1a73e8')
                .setFontColor('white')
                .setFontWeight('bold');
            sheet.setFrozenRows(1);
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

        // ĐẢM BẢO HEADERS
        ensureHeaders(sheet, CONFIG.LOGS_SHEET);

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
    // Support both camelCase and snake_case
    const userId = data.userId || data.user_id;
    const accessToken = data.accessToken || data.access_token;
    const tokenType = data.tokenType || data.token_type || 'bearer';
    const expiresAt = data.expiresAt || data.expires_at || '';

    if (!userId || !accessToken) {
        return createResponse({ success: false, error: 'Missing userId or accessToken' });
    }

    const sheet = getOrCreateSheet(CONFIG.TOKENS_SHEET);

    // ĐẢM BẢO HEADERS TRƯỚC KHI XỬ LÝ DATA
    ensureHeaders(sheet, CONFIG.TOKENS_SHEET);

    const allData = sheet.getDataRange().getValues();
    const headers = allData[0] || HEADERS[CONFIG.TOKENS_SHEET];
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

    // ĐẢM BẢO HEADERS TRƯỚC KHI ĐỌC DATA
    ensureHeaders(sheet, CONFIG.TOKENS_SHEET);

    const allData = sheet.getDataRange().getValues();
    const headers = allData[0] || HEADERS[CONFIG.TOKENS_SHEET];

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

// ==================== USER MANAGEMENT ====================

/**
 * Lưu hoặc cập nhật thông tin user
 * Nếu user đã tồn tại (theo fb_user_id), chỉ update last_login
 * Nếu chưa, tạo mới với plan = 'free'
 */
function saveUser(data) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName(CONFIG.USERS_SHEET);
        const expectedHeaders = HEADERS.Users;

        // Tạo sheet nếu chưa có
        if (!sheet) {
            sheet = ss.insertSheet(CONFIG.USERS_SHEET);
            sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
            sheet.getRange(1, 1, 1, expectedHeaders.length)
                .setBackground('#1a73e8')
                .setFontColor('white')
                .setFontWeight('bold');
            sheet.setFrozenRows(1);
        } else {
            // Sheet đã tồn tại - CHECK và AUTO-FIX headers
            const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
            const headersMatch = expectedHeaders.length === currentHeaders.length &&
                expectedHeaders.every((h, i) => h === currentHeaders[i]);

            if (!headersMatch) {
                // Ghi đè headers mới
                sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
                sheet.getRange(1, 1, 1, expectedHeaders.length)
                    .setBackground('#1a73e8')
                    .setFontColor('white')
                    .setFontWeight('bold');
                sheet.setFrozenRows(1);
                console.log('[saveUser] Auto-fixed headers for Users sheet');
            }
        }

        const user = data.user;
        if (!user || !user.fb_user_id) {
            return createResponse({ success: false, error: 'Missing user data or fb_user_id' });
        }

        const now = new Date().toISOString();
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];

        // Tìm xem user đã tồn tại chưa
        let existingRowIndex = -1;
        for (let i = 1; i < allData.length; i++) {
            const row = allData[i];
            const obj = {};
            headers.forEach((h, idx) => obj[h] = row[idx]);

            if (obj.fb_user_id === user.fb_user_id) {
                existingRowIndex = i + 1; // Sheet row index (1-based)
                break;
            }
        }

        if (existingRowIndex > 0) {
            // User đã tồn tại, chỉ update last_login
            const lastLoginColIndex = headers.indexOf('last_login') + 1;
            sheet.getRange(existingRowIndex, lastLoginColIndex).setValue(now);

            return createResponse({
                success: true,
                action: 'updated',
                message: 'Updated last_login for existing user',
                fb_user_id: user.fb_user_id
            });
        } else {
            // User mới, tạo record mới với plan = 'free'
            const newRow = HEADERS.Users.map(h => {
                switch (h) {
                    case 'fb_user_id': return user.fb_user_id;
                    case 'name': return user.name || '';
                    case 'email': return user.email || '';
                    case 'avatar': return user.avatar || '';
                    case 'plan': return 'free';
                    case 'created_at': return now;
                    case 'last_login': return now;
                    default: return '';
                }
            });

            sheet.appendRow(newRow);

            // Log
            logAction('saveUser', 'new_user', user.fb_user_id, 1, 'success', 'New user registered: ' + user.name);

            return createResponse({
                success: true,
                action: 'created',
                message: 'New user registered with plan: free',
                fb_user_id: user.fb_user_id,
                plan: 'free'
            });
        }

    } catch (error) {
        return createResponse({ success: false, error: error.message });
    }
}

/**
 * Lấy thông tin user từ sheet Users
 * @param {Object} data - { fb_user_id }
 */
function getUser(data) {
    try {
        const fbUserId = data.fb_user_id || data.fbUserId;

        if (!fbUserId) {
            return createResponse({ success: false, error: 'Missing fb_user_id' });
        }

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(CONFIG.USERS_SHEET);

        if (!sheet) {
            return createResponse({ success: false, error: 'Users sheet not found' });
        }

        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];

        // Tìm user
        for (let i = 1; i < allData.length; i++) {
            const row = allData[i];
            const obj = {};
            headers.forEach((h, idx) => obj[h] = row[idx]);

            if (obj.fb_user_id === fbUserId) {
                return createResponse({
                    success: true,
                    user: {
                        fb_user_id: obj.fb_user_id,
                        name: obj.name,
                        email: obj.email,
                        avatar: obj.avatar,
                        plan: obj.plan || 'free',
                        created_at: obj.created_at,
                        last_login: obj.last_login
                    }
                });
            }
        }

        return createResponse({
            success: false,
            error: 'User not found',
            fb_user_id: fbUserId
        });

    } catch (error) {
        return createResponse({ success: false, error: error.message });
    }
}

/**
 * Fix headers cho sheet đã có data nhưng thiếu headers
 * @param {Object} data - { sheetName }
 */
function fixHeaders(data) {
    try {
        const sheetName = data.sheetName || 'Campaigns';
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

        if (!sheet) {
            return createResponse({ success: false, error: 'Sheet not found: ' + sheetName });
        }

        const headers = HEADERS[sheetName];
        if (!headers || headers.length === 0) {
            return createResponse({ success: false, error: 'No headers defined for: ' + sheetName });
        }

        // Insert a new row at the top for headers
        sheet.insertRowBefore(1);

        // Set header values
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        // Format header row
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#1a73e8');
        headerRange.setFontColor('#ffffff');
        sheet.setFrozenRows(1);

        return createResponse({
            success: true,
            message: 'Headers added for ' + sheetName,
            columnCount: headers.length
        });

    } catch (error) {
        return createResponse({ success: false, error: error.message });
    }
}

// ==================== AI USAGE TRACKING ====================

/**
 * Log AI usage to AiUsage sheet - CHI TIẾT ĐẦY ĐỦ ĐỂ TÍNH TIỀN
 */
function logAiUsage(data) {
    try {
        const sheet = getOrCreateSheet(CONFIG.AI_USAGE_SHEET);
        ensureHeaders(sheet, CONFIG.AI_USAGE_SHEET);

        // Row theo thứ tự headers:
        // request_id, timestamp, user_id, action_type, model,
        // input_tokens, input_uncached, cached_tokens, output_tokens, total_tokens,
        // cost_input_usd, cost_cached_usd, cost_output_usd, cost_total_usd,
        // cost_input_vnd, cost_cached_vnd, cost_output_vnd, cost_total_vnd
        const row = [
            data.requestId || `req_${Date.now()}`,
            data.timestamp || new Date().toISOString(),
            data.userId || 'anonymous',
            data.actionType || 'analyze_campaign',
            data.model || 'gpt-5-mini',
            // Token breakdown
            data.inputTokens || 0,
            data.inputUncached || 0,
            data.cachedTokens || 0,
            data.outputTokens || 0,
            data.totalTokens || 0,
            // Cost USD breakdown
            data.costInputUsd || 0,
            data.costCachedUsd || 0,
            data.costOutputUsd || 0,
            data.costTotalUsd || 0,
            // Cost VND breakdown
            data.costInputVnd || 0,
            data.costCachedVnd || 0,
            data.costOutputVnd || 0,
            data.costTotalVnd || 0,
        ];

        sheet.appendRow(row);

        // Log ngắn gọn
        logAction('logAiUsage', data.userId, '', 1, 'success',
            `${data.totalTokens || 0} tokens, ${data.costTotalVnd || 0}đ`);

        return createResponse({
            success: true,
            message: 'AI usage logged successfully',
            requestId: data.requestId
        });
    } catch (error) {
        return createResponse({ success: false, error: error.message });
    }
}

/**
 * Get AI usage summary for a user
 */
function getAiUsage(params) {
    try {
        const userId = params.userId || 'anonymous';
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.AI_USAGE_SHEET);

        if (!sheet || sheet.getLastRow() <= 1) {
            return createResponse({
                success: true,
                data: {
                    userId: userId,
                    totalInputTokens: 0,
                    totalCachedTokens: 0,
                    totalOutputTokens: 0,
                    totalCostUsd: 0,
                    totalCostVnd: 0,
                    requestCount: 0,
                    history: []
                }
            });
        }

        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];

        // Find column indices
        const userIdIdx = headers.indexOf('user_id');
        const inputIdx = headers.indexOf('input_tokens');
        const cachedIdx = headers.indexOf('cached_tokens');
        const outputIdx = headers.indexOf('output_tokens');
        const costUsdIdx = headers.indexOf('cost_usd');
        const costVndIdx = headers.indexOf('cost_vnd');
        const timestampIdx = headers.indexOf('timestamp');
        const actionIdx = headers.indexOf('action_type');

        // Filter and aggregate
        let totalInput = 0, totalCached = 0, totalOutput = 0, totalUsd = 0, totalVnd = 0;
        const history = [];

        for (let i = 1; i < allData.length; i++) {
            const row = allData[i];
            if (row[userIdIdx] === userId) {
                totalInput += Number(row[inputIdx]) || 0;
                totalCached += Number(row[cachedIdx]) || 0;
                totalOutput += Number(row[outputIdx]) || 0;
                totalUsd += Number(row[costUsdIdx]) || 0;
                totalVnd += Number(row[costVndIdx]) || 0;

                // Keep last 10 entries for history
                if (history.length < 10) {
                    history.push({
                        timestamp: row[timestampIdx],
                        action: row[actionIdx],
                        tokens: (Number(row[inputIdx]) || 0) + (Number(row[outputIdx]) || 0),
                        costVnd: Number(row[costVndIdx]) || 0
                    });
                }
            }
        }

        return createResponse({
            success: true,
            data: {
                userId: userId,
                totalInputTokens: totalInput,
                totalCachedTokens: totalCached,
                totalOutputTokens: totalOutput,
                totalCostUsd: totalUsd.toFixed(6),
                totalCostVnd: Math.round(totalVnd),
                requestCount: history.length,
                history: history.reverse() // Most recent first
            }
        });
    } catch (error) {
        return createResponse({ success: false, error: error.message });
    }
}

// ==================== TAI KHOAN MANAGEMENT (NEW) ====================

/**
 * Lưu hoặc cập nhật thông tin TaiKhoan
 * Gộp user info + token + ad accounts cache
 * @param {Object} data - {
 *   fb_user_id, name, email, avatar,
 *   access_token, token_type, token_expires_at,
 *   ad_accounts (optional - JSON array),
 *   plan (optional - defaults to 'free')
 * }
 */
function saveTaiKhoan(data) {
    try {
        const sheet = getOrCreateSheet(CONFIG.TAI_KHOAN_SHEET);
        ensureHeaders(sheet, 'TaiKhoan');

        const fbUserId = data.fb_user_id;
        if (!fbUserId) {
            return createResponse({ success: false, error: 'Missing fb_user_id' });
        }

        const now = new Date().toISOString();
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0] || HEADERS.TaiKhoan;

        // Find existing row
        const userIdIdx = headers.indexOf('fb_user_id');
        let existingRowIndex = -1;
        let existingRow = null;

        for (let i = 1; i < allData.length; i++) {
            if (allData[i][userIdIdx] === fbUserId) {
                existingRowIndex = i + 1;
                existingRow = allData[i];
                break;
            }
        }

        // Build row data
        const rowData = HEADERS.TaiKhoan.map((h, idx) => {
            switch (h) {
                case 'fb_user_id': return fbUserId;
                case 'name': return data.name || (existingRow ? existingRow[idx] : '');
                case 'email': return data.email || (existingRow ? existingRow[idx] : '');
                case 'avatar': return data.avatar || (existingRow ? existingRow[idx] : '');
                case 'access_token': return data.access_token || (existingRow ? existingRow[idx] : '');
                case 'token_type': return data.token_type || 'bearer';
                case 'token_expires_at': return data.token_expires_at || (existingRow ? existingRow[idx] : '');
                case 'ad_accounts':
                    // Keep existing if not provided
                    if (data.ad_accounts) {
                        return typeof data.ad_accounts === 'string'
                            ? data.ad_accounts
                            : JSON.stringify(data.ad_accounts);
                    }
                    return existingRow ? existingRow[idx] : '[]';
                case 'plan': return data.plan || (existingRow ? existingRow[idx] : 'free');
                case 'created_at': return existingRow ? existingRow[idx] : now;
                case 'last_login': return now;
                default: return '';
            }
        });

        if (existingRowIndex > 0) {
            // Update existing
            sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
            logAction('saveTaiKhoan', fbUserId, '', 1, 'updated', 'TaiKhoan updated');
        } else {
            // Create new
            sheet.appendRow(rowData);
            logAction('saveTaiKhoan', fbUserId, '', 1, 'created', 'TaiKhoan created');
        }

        return createResponse({
            success: true,
            action: existingRowIndex > 0 ? 'updated' : 'created',
            fb_user_id: fbUserId
        });
    } catch (error) {
        return createResponse({ success: false, error: error.message });
    }
}

/**
 * Lấy thông tin TaiKhoan theo fb_user_id
 * Trả về user info + token + ad accounts cache
 */
function getTaiKhoan(params) {
    try {
        const fbUserId = params.fb_user_id || params.userId;
        if (!fbUserId) {
            return createResponse({ success: false, error: 'Missing fb_user_id' });
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TAI_KHOAN_SHEET);
        if (!sheet) {
            return createResponse({ success: true, found: false, message: 'Sheet not found' });
        }

        const allData = sheet.getDataRange().getValues();
        if (allData.length <= 1) {
            return createResponse({ success: true, found: false, message: 'No data' });
        }

        const headers = allData[0];
        const userIdIdx = headers.indexOf('fb_user_id');

        // If fbUserId is 'first', get first available user (row 2)
        const targetRowIdx = (fbUserId === 'first' && allData.length > 1) ? 1 : null;

        for (let i = 1; i < allData.length; i++) {
            // Match specific user OR return first if 'first' requested
            if (allData[i][userIdIdx] === fbUserId || (targetRowIdx !== null && i === targetRowIdx)) {
                const row = allData[i];
                const obj = {};
                headers.forEach((h, idx) => obj[h] = row[idx]);

                // Parse ad_accounts JSON
                let adAccounts = [];
                try {
                    adAccounts = obj.ad_accounts ? JSON.parse(obj.ad_accounts) : [];
                } catch (e) {
                    adAccounts = [];
                }

                // Check token expiry
                const tokenExpiresAt = obj.token_expires_at ? new Date(obj.token_expires_at) : null;
                const isTokenExpired = tokenExpiresAt && tokenExpiresAt < new Date();

                return createResponse({
                    success: true,
                    found: true,
                    data: {
                        fb_user_id: obj.fb_user_id,
                        name: obj.name,
                        email: obj.email,
                        avatar: obj.avatar,
                        access_token: isTokenExpired ? null : obj.access_token,
                        token_type: obj.token_type,
                        token_expires_at: obj.token_expires_at,
                        is_token_expired: isTokenExpired,
                        ad_accounts: adAccounts,
                        plan: obj.plan,
                        created_at: obj.created_at,
                        last_login: obj.last_login
                    }
                });
            }
        }

        return createResponse({ success: true, found: false, message: 'User not found' });
    } catch (error) {
        return createResponse({ success: false, error: error.message });
    }
}

/**
 * Cập nhật ad_accounts cache cho user
 * Dashboard gọi sau khi fetch từ Facebook để cache lại
 */
function saveAdAccounts(data) {
    try {
        const fbUserId = data.fb_user_id;
        const adAccounts = data.ad_accounts;

        if (!fbUserId || !adAccounts) {
            return createResponse({ success: false, error: 'Missing fb_user_id or ad_accounts' });
        }

        const sheet = getOrCreateSheet(CONFIG.TAI_KHOAN_SHEET);
        ensureHeaders(sheet, 'TaiKhoan');

        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const userIdIdx = headers.indexOf('fb_user_id');
        const adAccountsIdx = headers.indexOf('ad_accounts');

        for (let i = 1; i < allData.length; i++) {
            if (allData[i][userIdIdx] === fbUserId) {
                const adAccountsJson = typeof adAccounts === 'string'
                    ? adAccounts
                    : JSON.stringify(adAccounts);
                sheet.getRange(i + 1, adAccountsIdx + 1).setValue(adAccountsJson);

                logAction('saveAdAccounts', fbUserId, '', adAccounts.length || 0, 'success', 'Ad accounts cached');
                return createResponse({
                    success: true,
                    message: 'Ad accounts cached',
                    count: Array.isArray(adAccounts) ? adAccounts.length : 0
                });
            }
        }

        return createResponse({ success: false, error: 'User not found, please saveTaiKhoan first' });
    } catch (error) {
        return createResponse({ success: false, error: error.message });
    }
}
