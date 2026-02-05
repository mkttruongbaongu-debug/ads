/**
 * ===================================================================
 * AI CAMPAIGN GUARDIAN - GOOGLE APPS SCRIPT API
 * ===================================================================
 * Main entry point for Web App
 * 
 * Deployment:
 * 1. Extensions → Apps Script
 * 2. Copy all .gs files
 * 3. Deploy → New deployment → Web app
 * 4. Execute as: Me
 * 5. Who has access: Anyone
 * 6. Copy Web App URL → Use in GOOGLE_SHEETS_API_URL
 * 
 * Created: 2026-02-05
 * ===================================================================
 */

/**
 * Handle POST requests
 */
function doPost(e) {
  return handleRequest(e);
}

/**
 * Handle GET requests
 */
function doGet(e) {
  return handleRequest(e);
}

/**
 * Test function - can be run from Apps Script editor
 */
function testAPI() {
  Logger.log('Apps Script API is working!');
  return 'Success';
}
