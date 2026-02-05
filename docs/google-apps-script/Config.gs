/**
 * ===================================================================
 * CONFIGURATION
 * ===================================================================
 * Central configuration for Google Sheets database
 * 
 * IMPORTANT: Replace SPREADSHEET_ID with your actual ID!
 * ===================================================================
 */

const CONFIG = {
  // TODO: Replace with your Google Sheets ID
  // Get from URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
  
  // Sheet names (must match exactly)
  SHEETS: {
    DE_XUAT: 'DE_XUAT',
    QUAN_SAT: 'QUAN_SAT',
    MAU_HOC_DUOC: 'MAU_HOC_DUOC',
    TAI_KHOAN: 'TAI_KHOAN'
  },
  
  // API version
  VERSION: '1.0.0'
};

/**
 * Get spreadsheet instance
 */
function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  } catch (error) {
    throw new Error('Failed to open spreadsheet. Check SPREADSHEET_ID in Config.gs');
  }
}

/**
 * Get specific sheet by name
 */
function getSheet(sheetName) {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found. Please create it first.`);
  }
  
  return sheet;
}

/**
 * Validate required sheets exist
 */
function validateSheets() {
  const spreadsheet = getSpreadsheet();
  const requiredSheets = Object.values(CONFIG.SHEETS);
  const existingSheets = spreadsheet.getSheets().map(s => s.getName());
  
  const missing = requiredSheets.filter(name => !existingSheets.includes(name));
  
  if (missing.length > 0) {
    throw new Error(`Missing sheets: ${missing.join(', ')}`);
  }
  
  return true;
}
