/**
 * THỢ ADS AI + AI CAMPAIGN GUARDIAN - Google Apps Script
 * Full quyền tạo/sửa/xóa/update toàn bộ sheet
 * 
 * MERGED VERSION:
 * - Giữ nguyên: TAI_KHOAN, Campaigns, AiUsage, DuLieuQuangCao
 * - Thêm mới: DE_XUAT, QUAN_SAT, MAU_HOC_DUOC (AI Campaign Guardian)
 * 
 * CÁCH DEPLOY:
 * 1. Tạo Google Sheet mới
 * 2. Vào Extensions > Apps Script
 * 3. Replace Code.gs bằng file này
 * 4. Deploy > New deployment > Web app
 * 5. Execute as: Me, Who has access: Anyone
 * 6. Copy URL và thêm vào .env.local
 * 
 * Version: 2.0 (Merged)
 * Date: 2026-02-05
 */

// ==================== CONFIG ====================
const CONFIG = {
    // Sheet names - ORIGINAL
    CAMPAIGNS_SHEET: 'Campaigns',
    ACCOUNTS_SHEET: 'Accounts',
    LOGS_SHEET: 'Logs',
    TAI_KHOAN_SHEET: 'TAI_KHOAN',
    AI_USAGE_SHEET: 'AiUsage',
    DU_LIEU_QUANG_CAO_SHEET: 'DuLieuQuangCao',
    
    // ✨ NEW: AI Campaign Guardian sheets
    DE_XUAT_SHEET: 'DE_XUAT',
    QUAN_SAT_SHEET: 'QUAN_SAT',
    MAU_HOC_DUOC_SHEET: 'MAU_HOC_DUOC',

    // API Secret (để bảo vệ endpoint)
    API_SECRET: 'tho-ads-ai-2026'
};

// ==================== HEADERS - COMPREHENSIVE METRICS ====================
const HEADERS = {
    // ORIGINAL HEADERS (GIỮ NGUYÊN)
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
    
    TAI_KHOAN: [
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
    ],
    
    DuLieuQuangCao: [
        // Identity - dùng làm unique key
        'fb_user_id', 'ad_account_id', 'campaign_id', 'date',
        // Campaign Info
        'campaign_name', 'status', 'objective',
        // Spend & Reach
        'spend', 'impressions', 'reach', 'frequency',
        // Clicks & CTR
        'clicks', 'link_clicks', 'ctr', 'cpc', 'cpm',
        // Conversions
        'purchases', 'revenue', 'cpp', 'roas',
        // Landing Page
        'landing_page_views',
        // Content Quality - Video
        'video_views_3s', 'video_thruplay', 'video_completion_rate',
        // Content Quality - Engagement
        'post_reactions', 'post_comments', 'post_shares', 'post_engagement',
        // Ad Relevance Diagnostics
        'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
        // Timestamps
        'created_at', 'updated_at'
    ],
    
    // ✨ NEW: AI Campaign Guardian headers
    DE_XUAT: [
        'id', 'thoiGian_Tao', 'campaignId', 'tenCampaign', 'userId',
        'uuTien', 'trangThai',
        'hanhDong_Loai', 'hanhDong_GiaTri',
        'phanTich_ChuyenGia', 'metrics_TruocKhi',
        'nguoiDuyet', 'thoiGian_Duyet', 'ghiChu_NguoiDung',
        'thoiGian_ThucThi', 'ketQua_ThucThi',
        'giamSat_DenNgay', 'ketQua_CuoiCung'
    ],
    
    QUAN_SAT: [
        'id', 'deXuatId', 'checkpoint_Ngay', 'thoiGian_QuanSat', 'campaignId',
        'metrics_HienTai', 'metrics_TruocKhi',
        'cpp_ThayDoi_Percent', 'roas_ThayDoi_Percent',
        'danhGia', 'phanTich_AI', 'baiHoc'
    ],
    
    MAU_HOC_DUOC: [
        'id', 'tenMau', 'dieuKien', 'hanhDong_KhuyenNghi',
        'soLan_ApDung', 'soLan_ThanhCong', 'tyLe_ThanhCong',
        'cpp_CaiThien_TB_Percent', 'roas_CaiThien_TB_Percent',
        'doTinCay', 'capNhat_LanCuoi'
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
        needHeaders = true;
    } else {
        const firstCell = sheet.getRange(1, 1).getValue();
        if (firstCell !== headers[0]) {
            needHeaders = true;
        }
    }

    if (needHeaders) {
        if (lastRow > 0) {
            sheet.insertRowBefore(1);
        }

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#1a73e8');
        headerRange.setFontColor('#ffffff');
        sheet.setFrozenRows(1);

        return true;
    }

    return false;
}

// ==================== MAIN FUNCTIONS ====================

/**
 * Web App entry point - xử lý POST requests
 */
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);

        if (data.secret !== CONFIG.API_SECRET) {
            return createResponse({ success: false, error: 'Invalid API secret' }, 401);
        }

        const action = data.action;

        switch (action) {
            // ORIGINAL ACTIONS (GIỮ NGUYÊN)
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
            case 'saveTAI_KHOAN':
                return saveTAI_KHOAN(data);
            case 'saveAdAccounts':
                return saveAdAccounts(data);
            case 'fixHeaders':
                return fixHeaders(data);
            case 'logAiUsage':
                return logAiUsage(data);
            case 'saveDuLieuQuangCao':
                return saveDuLieuQuangCao(data);
            case 'getDuLieuQuangCao':
                return getDuLieuQuangCao(data);
            
            // ✨ NEW: AI Campaign Guardian actions
            case 'ghiDeXuat':
                return ghiDeXuat(data);
            case 'capNhatDeXuat':
                return capNhatDeXuat(data);
            case 'ghiQuanSat':
                return ghiQuanSat(data);
            case 'ghiMauHoc':
                return ghiMauHoc(data);
            case 'capNhatMauHoc':
                return capNhatMauHoc(data);
                
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
            // ORIGINAL ACTIONS (GIỮ NGUYÊN)
            case 'read':
                return readData(params);
            case 'history':
                return getCampaignHistory(params);
            case 'status':
                return getStatus();
            case 'getTAI_KHOAN':
                return getTAI_KHOAN(params);
            case 'getAiUsage':
                return getAiUsage(params);
            case 'getDuLieuQuangCao':
                return getDuLieuQuangCao(params);
            
            // ✨ NEW: AI Campaign Guardian GET actions
            case 'layDanhSachDeXuat':
                return layDanhSachDeXuat(params);
            case 'layQuanSatTheoDeXuat':
                return layQuanSatTheoDeXuat(params);
            case 'layDanhSachMauHoc':
                return layDanhSachMauHoc(params);
                
            default:
                return createResponse({ success: false, error: 'Unknown action: ' + action });
        }
    } catch (error) {
        return createResponse({ success: false, error: error.toString() }, 500);
    }
}

// ==================== CRUD OPERATIONS (ORIGINAL) ====================

function syncData(data) {
    const { sheetName, rows, accountId, date } = data;
    const sheet = getOrCreateSheet(sheetName || CONFIG.CAMPAIGNS_SHEET);

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

function appendData(data) {
    const { sheetName, rows } = data;
    const sheet = getOrCreateSheet(sheetName);
    let headersAdded = false;

    if (rows && rows.length > 0) {
        const headers = HEADERS[sheetName];
        const lastRow = sheet.getLastRow();

        if (headers && headers.length > 0) {
            let needHeaders = false;

            if (lastRow === 0) {
                needHeaders = true;
            } else {
                const firstCell = sheet.getRange(1, 1).getValue();
                const expectedFirstHeader = headers[0];

                if (firstCell !== expectedFirstHeader) {
                    needHeaders = true;
                }
            }

            if (needHeaders) {
                if (lastRow > 0) {
                    sheet.insertRowBefore(1);
                }

                sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

                const headerRange = sheet.getRange(1, 1, 1, headers.length);
                headerRange.setFontWeight('bold');
                headerRange.setBackground('#1a73e8');
                headerRange.setFontColor('#ffffff');
                sheet.setFrozenRows(1);
                headersAdded = true;
            }
        }

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

function deleteData(data) {
    const { sheetName, matchColumn, matchValue } = data;
    const sheet = getOrCreateSheet(sheetName);
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];

    const matchIdx = headers.indexOf(matchColumn);
    if (matchIdx === -1) {
        return createResponse({ success: false, error: 'Column not found' });
    }

    let deletedCount = 0;
    for (let i = allData.length - 1; i >= 1; i--) {
        if (allData[i][matchIdx] === matchValue) {
            sheet.deleteRow(i + 1);
            deletedCount++;
        }
    }

    return createResponse({ success: true, rowsDeleted: deletedCount });
}

function clearSheet(data) {
    const { sheetName } = data;
    const sheet = getOrCreateSheet(sheetName);

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
    }

    return createResponse({ success: true, message: 'Sheet cleared' });
}

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

    const response = JSON.parse(result.getContent());
    if (response.success && response.data) {
        response.data.sort((a, b) => a.date.localeCompare(b.date));
    }

    return createResponse(response);
}

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

function initializeSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const created = [];

    Object.keys(HEADERS).forEach(sheetName => {
        let sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
            sheet = ss.insertSheet(sheetName);
            created.push(sheetName);
        }

        if (sheet.getLastRow() === 0) {
            sheet.getRange(1, 1, 1, HEADERS[sheetName].length)
                .setValues([HEADERS[sheetName]]);

            sheet.getRange(1, 1, 1, HEADERS[sheetName].length)
                .setBackground('#4285f4')
                .setFontColor('white')
                .setFontWeight('bold');

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

function getOrCreateSheet(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
        sheet = ss.insertSheet(sheetName);

        if (HEADERS[sheetName]) {
            const headers = HEADERS[sheetName];
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

            sheet.getRange(1, 1, 1, headers.length)
                .setBackground('#1a73e8')
                .setFontColor('white')
                .setFontWeight('bold');
            sheet.setFrozenRows(1);
        }
    }

    return sheet;
}

// ✨ Alias for AI Campaign Guardian compatibility
function getSheet(sheetName) {
    return getOrCreateSheet(sheetName);
}

function logAction(action, accountId, date, rowsCount, status, message) {
    try {
        const sheet = getOrCreateSheet(CONFIG.LOGS_SHEET);
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

function createResponse(data, statusCode = 200) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

// ✨ Utilities for AI Campaign Guardian
function generateUUID() {
    return Utilities.getUuid();
}

function getCurrentTimestamp() {
    return new Date().toISOString();
}

function jsonResponse(data, statusCode = 200) {
    return createResponse(data, statusCode);
}

// ==================== MENU & TRIGGERS ====================

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('🔧 Thợ ADS AI')
        .addItem('📊 Khởi tạo Sheets', 'initializeSheets')
        .addItem('🗑️ Xóa dữ liệu Campaigns', 'clearCampaignsSheet')
        .addItem('📋 Xem trạng thái', 'showStatus')
        .addToUi();
}

function clearCampaignsSheet() {
    clearSheet({ sheetName: CONFIG.CAMPAIGNS_SHEET });
    SpreadsheetApp.getUi().alert('Đã xóa dữ liệu Campaigns!');
}

function showStatus() {
    const status = JSON.parse(getStatus().getContent());
    const msg = status.sheets.map(s => `${s.name}: ${s.rows} rows`).join('\n');
    SpreadsheetApp.getUi().alert('Trạng thái:\n\n' + msg);
}

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

        sheet.insertRowBefore(1);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

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

function logAiUsage(data) {
    try {
        const sheet = getOrCreateSheet(CONFIG.AI_USAGE_SHEET);
        ensureHeaders(sheet, CONFIG.AI_USAGE_SHEET);

        const row = [
            data.requestId || `req_${Date.now()}`,
            data.timestamp || new Date().toISOString(),
            data.userId || 'anonymous',
            data.actionType || 'analyze_campaign',
            data.model || 'gpt-5-mini',
            data.inputTokens || 0,
            data.inputUncached || 0,
            data.cachedTokens || 0,
            data.outputTokens || 0,
            data.totalTokens || 0,
            data.costInputUsd || 0,
            data.costCachedUsd || 0,
            data.costOutputUsd || 0,
            data.costTotalUsd || 0,
            data.costInputVnd || 0,
            data.costCachedVnd || 0,
            data.costOutputVnd || 0,
            data.costTotalVnd || 0,
        ];

        sheet.appendRow(row);

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

        const userIdIdx = headers.indexOf('user_id');
        const inputIdx = headers.indexOf('input_tokens');
        const cachedIdx = headers.indexOf('cached_tokens');
        const outputIdx = headers.indexOf('output_tokens');
        const costUsdIdx = headers.indexOf('cost_total_usd');
        const costVndIdx = headers.indexOf('cost_total_vnd');
        const timestampIdx = headers.indexOf('timestamp');
        const actionIdx = headers.indexOf('action_type');

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
                history: history.reverse()
            }
        });
    } catch (error) {
        return createResponse({ success: false, error: error.message });
    }
}

// ==================== TAI KHOAN MANAGEMENT ====================

function saveTAI_KHOAN(data) {
    try {
        const sheet = getOrCreateSheet(CONFIG.TAI_KHOAN_SHEET);
        ensureHeaders(sheet, 'TAI_KHOAN');

        const fbUserId = data.fb_user_id;
        if (!fbUserId) {
            return createResponse({ success: false, error: 'Missing fb_user_id' });
        }

        const now = new Date().toISOString();
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0] || HEADERS.TAI_KHOAN;

        const userIdIdx = headers.indexOf('fb_user_id');
        const fbUserIdStr = String(fbUserId);
        let existingRowIndex = -1;
        let existingRow = null;

        for (let i = 1; i < allData.length; i++) {
            if (String(allData[i][userIdIdx]) === fbUserIdStr) {
                existingRowIndex = i + 1;
                existingRow = allData[i];
                break;
            }
        }

        const rowData = HEADERS.TAI_KHOAN.map((h, idx) => {
            switch (h) {
                case 'fb_user_id': return fbUserId;
                case 'name': return data.name || (existingRow ? existingRow[idx] : '');
                case 'email': return data.email || (existingRow ? existingRow[idx] : '');
                case 'avatar': return data.avatar || (existingRow ? existingRow[idx] : '');
                case 'access_token': return data.access_token || (existingRow ? existingRow[idx] : '');
                case 'token_type': return data.token_type || 'bearer';
                case 'token_expires_at': return data.token_expires_at || (existingRow ? existingRow[idx] : '');
                case 'ad_accounts':
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
            sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
            logAction('saveTAI_KHOAN', fbUserId, '', 1, 'updated', 'TAI_KHOAN updated');
        } else {
            sheet.appendRow(rowData);
            logAction('saveTAI_KHOAN', fbUserId, '', 1, 'created', 'TAI_KHOAN created');
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

function getTAI_KHOAN(params) {
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

        const targetRowIdx = (fbUserId === 'first' && allData.length > 1) ? 1 : null;
        const fbUserIdStr = String(fbUserId);

        for (let i = 1; i < allData.length; i++) {
            if (String(allData[i][userIdIdx]) === fbUserIdStr || (targetRowIdx !== null && i === targetRowIdx)) {
                const row = allData[i];
                const obj = {};
                headers.forEach((h, idx) => obj[h] = row[idx]);

                let adAccounts = [];
                try {
                    adAccounts = obj.ad_accounts ? JSON.parse(obj.ad_accounts) : [];
                } catch (e) {
                    adAccounts = [];
                }

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

function saveAdAccounts(data) {
    try {
        const fbUserId = data.fb_user_id;
        const adAccounts = data.ad_accounts;

        if (!fbUserId || !adAccounts) {
            return createResponse({ success: false, error: 'Missing fb_user_id or ad_accounts' });
        }

        const sheet = getOrCreateSheet(CONFIG.TAI_KHOAN_SHEET);
        ensureHeaders(sheet, 'TAI_KHOAN');

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

        return createResponse({ success: false, error: 'User not found, please saveTAI_KHOAN first' });
    } catch (error) {
        return createResponse({ success: false, error: error.message });
    }
}

// ==================== DU LIEU QUANG CAO MANAGEMENT ====================

function saveDuLieuQuangCao(data) {
    try {
        const { fb_user_id, rows } = data;
        if (!fb_user_id || !rows || !Array.isArray(rows)) {
            return createResponse({ success: false, error: 'Missing fb_user_id or rows array' });
        }

        const sheet = getOrCreateSheet(CONFIG.DU_LIEU_QUANG_CAO_SHEET);
        ensureHeaders(sheet, 'DuLieuQuangCao');

        const headers = HEADERS.DuLieuQuangCao;
        const allData = sheet.getDataRange().getValues();
        const now = new Date().toISOString();

        const existingIndex = {};
        const adAccountIdx = headers.indexOf('ad_account_id');
        const campaignIdx = headers.indexOf('campaign_id');
        const dateIdx = headers.indexOf('date');

        for (let i = 1; i < allData.length; i++) {
            const key = `${allData[i][adAccountIdx]}|${allData[i][campaignIdx]}|${allData[i][dateIdx]}`;
            existingIndex[key] = i + 1;
        }

        let inserted = 0;
        let updated = 0;

        for (const row of rows) {
            const key = `${row.ad_account_id}|${row.campaign_id}|${row.date}`;

            const rowData = headers.map(h => {
                switch (h) {
                    case 'fb_user_id': return fb_user_id;
                    case 'created_at': return existingIndex[key] ? allData[existingIndex[key] - 1][headers.indexOf('created_at')] : now;
                    case 'updated_at': return now;
                    default: return row[h] !== undefined ? row[h] : '';
                }
            });

            if (existingIndex[key]) {
                sheet.getRange(existingIndex[key], 1, 1, rowData.length).setValues([rowData]);
                updated++;
            } else {
                sheet.appendRow(rowData);
                inserted++;
            }
        }

        logAction('saveDuLieuQuangCao', fb_user_id, '', rows.length, 'success',
            `Inserted: ${inserted}, Updated: ${updated}`);

        return createResponse({
            success: true,
            inserted,
            updated,
            total: rows.length
        });
    } catch (error) {
        return createResponse({ success: false, error: error.message });
    }
}

function getDuLieuQuangCao(params) {
    try {
        const { fb_user_id, ad_account_id, campaign_id, start_date, end_date } = params;

        if (!fb_user_id) {
            return createResponse({ success: false, error: 'Missing fb_user_id' });
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.DU_LIEU_QUANG_CAO_SHEET);
        if (!sheet) {
            return createResponse({ success: true, data: [], message: 'Sheet not found' });
        }

        const allData = sheet.getDataRange().getValues();
        if (allData.length <= 1) {
            return createResponse({ success: true, data: [], message: 'No data' });
        }

        const headers = allData[0];
        const fbUserIdIdx = headers.indexOf('fb_user_id');
        const adAccountIdIdx = headers.indexOf('ad_account_id');
        const campaignIdIdx = headers.indexOf('campaign_id');
        const dateIdx = headers.indexOf('date');

        const results = [];
        for (let i = 1; i < allData.length; i++) {
            const row = allData[i];

            if (String(row[fbUserIdIdx]) !== String(fb_user_id)) continue;

            if (ad_account_id && String(row[adAccountIdIdx]) !== String(ad_account_id)) continue;

            if (campaign_id && String(row[campaignIdIdx]) !== String(campaign_id)) continue;

            const rowDate = row[dateIdx];
            if (start_date && rowDate < start_date) continue;
            if (end_date && rowDate > end_date) continue;

            const obj = {};
            headers.forEach((h, idx) => obj[h] = row[idx]);
            results.push(obj);
        }

        return createResponse({
            success: true,
            data: results,
            count: results.length
        });
    } catch (error) {
        return createResponse({ success: false, error: error.message });
    }
}

// ===================================================================
// ✨ AI CAMPAIGN GUARDIAN - DE_XUAT HANDLERS
// ===================================================================

function ghiDeXuat(data) {
    try {
        const sheet = getSheet(CONFIG.DE_XUAT_SHEET);

        const row = [
            data.id || generateUUID(),
            data.thoiGian_Tao || getCurrentTimestamp(),
            data.campaignId || '',
            data.tenCampaign || '',
            data.userId || '',
            data.uuTien || 'TRUNG_BINH',
            data.trangThai || 'CHO_DUYET',
            data.hanhDong?.loai || '',
            JSON.stringify(data.hanhDong || {}),
            JSON.stringify(data.phanTich_ChuyenGia || []),
            JSON.stringify(data.metrics_TruocKhi || {}),
            data.nguoiDuyet || '',
            data.thoiGian_Duyet || '',
            data.ghiChu_NguoiDung || '',
            data.thoiGian_ThucThi || '',
            JSON.stringify(data.ketQua_ThucThi || {}),
            data.giamSat_DenNgay || '',
            data.ketQua_CuoiCung || ''
        ];

        sheet.appendRow(row);

        Logger.log(`Proposal created: ${row[0]}`);

        return jsonResponse({
            success: true,
            id: row[0],
            message: 'Proposal saved successfully'
        });

    } catch (error) {
        Logger.log('Error in ghiDeXuat: ' + error.toString());
        return jsonResponse({
            success: false,
            error: error.toString()
        });
    }
}

function layDanhSachDeXuat(params) {
    try {
        const sheet = getSheet(CONFIG.DE_XUAT_SHEET);
        const data = sheet.getDataRange().getValues();

        if (data.length === 0) {
            return jsonResponse({ success: true, data: [] });
        }

        const headers = data[0];
        const rows = data.slice(1);

        let results = rows.map(row => {
            let obj = {};
            headers.forEach((header, i) => {
                let value = row[i];

                const jsonFields = ['hanhDong_GiaTri', 'phanTich_ChuyenGia', 'metrics_TruocKhi', 'ketQua_ThucThi'];
                if (jsonFields.includes(header)) {
                    try {
                        value = value ? JSON.parse(value) : {};
                    } catch (e) {
                        value = {};
                    }
                }

                if (header === 'hanhDong_Loai') {
                    obj.hanhDong = obj.hanhDong || {};
                    obj.hanhDong.loai = value;
                } else if (header === 'hanhDong_GiaTri') {
                    obj.hanhDong = obj.hanhDong || {};
                    Object.assign(obj.hanhDong, value);
                } else {
                    obj[header] = value;
                }
            });
            return obj;
        });

        if (params.status && params.status !== 'ALL') {
            results = results.filter(r => r.trangThai === params.status);
        }

        if (params.priority) {
            results = results.filter(r => r.uuTien === params.priority);
        }

        if (params.userId) {
            results = results.filter(r => r.userId === params.userId);
        }

        const priorityOrder = { 'NGUY_CAP': 0, 'CAO': 1, 'TRUNG_BINH': 2, 'THAP': 3 };
        results.sort((a, b) => {
            const aOrder = priorityOrder[a.uuTien] ?? 999;
            const bOrder = priorityOrder[b.uuTien] ?? 999;
            return aOrder - bOrder;
        });

        Logger.log(`Found ${results.length} proposals`);

        return jsonResponse({
            success: true,
            data: results,
            count: results.length
        });

    } catch (error) {
        Logger.log('Error in layDanhSachDeXuat: ' + error.toString());
        return jsonResponse({
            success: false,
            error: error.toString()
        });
    }
}

function capNhatDeXuat(data) {
    try {
        if (!data.id) {
            return jsonResponse({
                success: false,
                error: 'Missing proposal ID'
            });
        }

        const sheet = getSheet(CONFIG.DE_XUAT_SHEET);
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();
        const headers = values[0];

        const idCol = 0;
        let rowIndex = -1;

        for (let i = 1; i < values.length; i++) {
            if (values[i][idCol] === data.id) {
                rowIndex = i;
                break;
            }
        }

        if (rowIndex === -1) {
            return jsonResponse({
                success: false,
                error: 'Proposal not found'
            });
        }

        const updates = {};

        const fieldMap = {
            'trangThai': 6,
            'nguoiDuyet': 11,
            'thoiGian_Duyet': 12,
            'ghiChu_NguoiDung': 13,
            'thoiGian_ThucThi': 14,
            'ketQua_ThucThi': 15,
            'giamSat_DenNgay': 16,
            'ketQua_CuoiCung': 17
        };

        Object.keys(data).forEach(field => {
            if (field !== 'id' && fieldMap[field] !== undefined) {
                const colIndex = fieldMap[field];
                let value = data[field];

                if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(value);
                }

                sheet.getRange(rowIndex + 1, colIndex + 1).setValue(value);
                updates[field] = value;
            }
        });

        Logger.log(`Proposal updated: ${data.id}`);
        Logger.log('Updated fields:', updates);

        return jsonResponse({
            success: true,
            message: 'Proposal updated successfully',
            updates: updates
        });

    } catch (error) {
        Logger.log('Error in capNhatDeXuat: ' + error.toString());
        return jsonResponse({
            success: false,
            error: error.toString()
        });
    }
}

// ===================================================================
// ✨ AI CAMPAIGN GUARDIAN - QUAN_SAT HANDLERS
// ===================================================================

function ghiQuanSat(data) {
    try {
        const sheet = getSheet(CONFIG.QUAN_SAT_SHEET);

        const row = [
            data.id || generateUUID(),
            data.deXuatId || '',
            data.checkpoint_Ngay || 1,
            data.thoiGian_QuanSat || getCurrentTimestamp(),
            data.campaignId || '',
            JSON.stringify(data.metrics_HienTai || {}),
            JSON.stringify(data.metrics_TruocKhi || {}),
            data.cpp_ThayDoi_Percent || 0,
            data.roas_ThayDoi_Percent || 0,
            data.danhGia || '',
            JSON.stringify(data.phanTich_AI || {}),
            data.baiHoc || ''
        ];

        sheet.appendRow(row);

        Logger.log(`Observation created: ${row[0]} for proposal ${data.deXuatId} at D+${data.checkpoint_Ngay}`);

        return jsonResponse({
            success: true,
            id: row[0],
            message: 'Observation saved successfully'
        });

    } catch (error) {
        Logger.log('Error in ghiQuanSat: ' + error.toString());
        return jsonResponse({
            success: false,
            error: error.toString()
        });
    }
}

function layQuanSatTheoDeXuat(params) {
    try {
        if (!params.deXuatId) {
            return jsonResponse({
                success: false,
                error: 'Missing deXuatId parameter'
            });
        }

        const sheet = getSheet(CONFIG.QUAN_SAT_SHEET);
        const data = sheet.getDataRange().getValues();

        if (data.length === 0) {
            return jsonResponse({ success: true, data: [] });
        }

        const headers = data[0];
        const rows = data.slice(1);

        const deXuatIdCol = headers.indexOf('deXuatId');
        if (deXuatIdCol === -1) {
            return jsonResponse({
                success: false,
                error: 'deXuatId column not found in QUAN_SAT sheet'
            });
        }

        const filteredRows = rows.filter(row => row[deXuatIdCol] === params.deXuatId);

        const results = filteredRows.map(row => {
            let obj = {};
            headers.forEach((header, i) => {
                let value = row[i];

                const jsonFields = ['metrics_HienTai', 'metrics_TruocKhi', 'phanTich_AI'];
                if (jsonFields.includes(header)) {
                    try {
                        value = value ? JSON.parse(value) : {};
                    } catch (e) {
                        value = {};
                    }
                }

                obj[header] = value;
            });
            return obj;
        });

        results.sort((a, b) => a.checkpoint_Ngay - b.checkpoint_Ngay);

        Logger.log(`Found ${results.length} observations for proposal ${params.deXuatId}`);

        return jsonResponse({
            success: true,
            data: results,
            count: results.length
        });

    } catch (error) {
        Logger.log('Error in layQuanSatTheoDeXuat: ' + error.toString());
        return jsonResponse({
            success: false,
            error: error.toString()
        });
    }
}

// ===================================================================
// ✨ AI CAMPAIGN GUARDIAN - MAU_HOC_DUOC HANDLERS
// ===================================================================

function ghiMauHoc(data) {
    try {
        const sheet = getSheet(CONFIG.MAU_HOC_DUOC_SHEET);

        const soLan_ApDung = data.soLan_ApDung || 1;
        const soLan_ThanhCong = data.soLan_ThanhCong || 0;
        const tyLe_ThanhCong = soLan_ApDung > 0 ? soLan_ThanhCong / soLan_ApDung : 0;

        const row = [
            data.id || generateUUID(),
            data.tenMau || '',
            JSON.stringify(data.dieuKien || {}),
            JSON.stringify(data.hanhDong_KhuyenNghi || {}),
            soLan_ApDung,
            soLan_ThanhCong,
            tyLe_ThanhCong,
            data.cpp_CaiThien_TB_Percent || 0,
            data.roas_CaiThien_TB_Percent || 0,
            data.doTinCay || tyLe_ThanhCong,
            getCurrentTimestamp()
        ];

        sheet.appendRow(row);

        Logger.log(`Pattern created: ${row[0]} - ${data.tenMau}`);

        return jsonResponse({
            success: true,
            id: row[0],
            message: 'Pattern saved successfully'
        });

    } catch (error) {
        Logger.log('Error in ghiMauHoc: ' + error.toString());
        return jsonResponse({
            success: false,
            error: error.toString()
        });
    }
}

function layDanhSachMauHoc(params) {
    try {
        const sheet = getSheet(CONFIG.MAU_HOC_DUOC_SHEET);
        const data = sheet.getDataRange().getValues();

        if (data.length === 0) {
            return jsonResponse({ success: true, data: [] });
        }

        const headers = data[0];
        const rows = data.slice(1);

        let results = rows.map(row => {
            let obj = {};
            headers.forEach((header, i) => {
                let value = row[i];

                const jsonFields = ['dieuKien', 'hanhDong_KhuyenNghi'];
                if (jsonFields.includes(header)) {
                    try {
                        value = value ? JSON.parse(value) : {};
                    } catch (e) {
                        value = {};
                    }
                }

                obj[header] = value;
            });
            return obj;
        });

        if (params.minConfidence) {
            const minConf = parseFloat(params.minConfidence);
            results = results.filter(r => r.doTinCay >= minConf);
        }

        results.sort((a, b) => (b.doTinCay || 0) - (a.doTinCay || 0));

        Logger.log(`Found ${results.length} patterns`);

        return jsonResponse({
            success: true,
            data: results,
            count: results.length
        });

    } catch (error) {
        Logger.log('Error in layDanhSachMauHoc: ' + error.toString());
        return jsonResponse({
            success: false,
            error: error.toString()
        });
    }
}

function capNhatMauHoc(data) {
    try {
        if (!data.id) {
            return jsonResponse({
                success: false,
                error: 'Missing pattern ID'
            });
        }

        const sheet = getSheet(CONFIG.MAU_HOC_DUOC_SHEET);
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();
        const headers = values[0];

        const idCol = 0;
        let rowIndex = -1;

        for (let i = 1; i < values.length; i++) {
            if (values[i][idCol] === data.id) {
                rowIndex = i;
                break;
            }
        }

        if (rowIndex === -1) {
            return jsonResponse({
                success: false,
                error: 'Pattern not found'
            });
        }

        const currentRow = values[rowIndex];
        const soLan_ApDung = currentRow[4] + 1;
        const soLan_ThanhCong = currentRow[5] + (data.wasSuccessful ? 1 : 0);
        const tyLe_ThanhCong = soLan_ApDung > 0 ? soLan_ThanhCong / soLan_ApDung : 0;

        const oldApDung = currentRow[4];
        const oldCppImprovement = currentRow[7];
        const oldRoasImprovement = currentRow[8];

        const newCppImprovement = oldApDung > 0
            ? (oldCppImprovement * oldApDung + (data.cpp_change || 0)) / soLan_ApDung
            : (data.cpp_change || 0);

        const newRoasImprovement = oldApDung > 0
            ? (oldRoasImprovement * oldApDung + (data.roas_change || 0)) / soLan_ApDung
            : (data.roas_change || 0);

        const newConfidence = tyLe_ThanhCong;

        sheet.getRange(rowIndex + 1, 5).setValue(soLan_ApDung);
        sheet.getRange(rowIndex + 1, 6).setValue(soLan_ThanhCong);
        sheet.getRange(rowIndex + 1, 7).setValue(tyLe_ThanhCong);
        sheet.getRange(rowIndex + 1, 8).setValue(newCppImprovement);
        sheet.getRange(rowIndex + 1, 9).setValue(newRoasImprovement);
        sheet.getRange(rowIndex + 1, 10).setValue(newConfidence);
        sheet.getRange(rowIndex + 1, 11).setValue(getCurrentTimestamp());

        Logger.log(`Pattern updated: ${data.id}`);

        return jsonResponse({
            success: true,
            message: 'Pattern stats updated',
            stats: {
                soLan_ApDung,
                soLan_ThanhCong,
                tyLe_ThanhCong,
                doTinCay: newConfidence
            }
        });

    } catch (error) {
        Logger.log('Error in capNhatMauHoc: ' + error.toString());
        return jsonResponse({
            success: false,
            error: error.toString()
        });
    }
}
