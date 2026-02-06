/**
 * ===================================================================
 * REQUEST ROUTER
 * ===================================================================
 * Routes incoming requests to appropriate handlers
 * 
 * Supported actions:
 * - ghiDeXuat
 * - layDanhSachDeXuat
 * - capNhatDeXuat
 * - ghiQuanSat
 * - layQuanSatTheoDeXuat
 * - ghiMauHoc
 * - layDanhSachMauHoc
 * ===================================================================
 */

/**
 * Main request handler
 */
function handleRequest(e) {
  try {
    // Parse parameters
    const params = e.parameter || {};
    
    // Parse POST body if exists
    let body = {};
    if (e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseError) {
        return jsonResponse({ 
          success: false, 
          error: 'Invalid JSON in request body' 
        }, 400);
      }
    }
    
    // Get action from URL params OR body (fallback)
    const action = params.action || body.action;
    
    // Validate secret
    const secret = body.secret;
    if (secret !== CONFIG.API_SECRET) {
      return jsonResponse({ 
        success: false, 
        error: 'Invalid API secret' 
      }, 401);
    }
    
    // Log request (for debugging)
    Logger.log(`Action: ${action}`);
    Logger.log(`Params:`, params);
    Logger.log(`Body:`, body);
    
    // Route to handlers
    switch(action) {
      // Proposals (DE_XUAT)
      case 'ghiDeXuat':
        return ghiDeXuat(body);
      case 'layDanhSachDeXuat':
        return layDanhSachDeXuat(params);
      case 'capNhatDeXuat':
        return capNhatDeXuat(body);
      
      // Observations (QUAN_SAT)
      case 'ghiQuanSat':
        return ghiQuanSat(body);
      case 'layQuanSatTheoDeXuat':
        return layQuanSatTheoDeXuat(params);
      
      // Patterns (MAU_HOC_DUOC)
      case 'ghiMauHoc':
        return ghiMauHoc(body);
      case 'layDanhSachMauHoc':
        return layDanhSachMauHoc(params);
      
      // Utility
      case 'ping':
        return jsonResponse({ 
          success: true, 
          message: 'Apps Script API is running',
          version: CONFIG.VERSION,
          timestamp: new Date().toISOString()
        });
      
      default:
        return jsonResponse({ 
          success: false, 
          error: `Invalid action: "${action}". Supported: ghiDeXuat, layDanhSachDeXuat, capNhatDeXuat, ghiQuanSat, layQuanSatTheoDeXuat, ghiMauHoc, layDanhSachMauHoc, ping` 
        }, 400);
    }
    
  } catch (error) {
    Logger.log('Fatal Error: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    
    return jsonResponse({ 
      success: false, 
      error: error.toString(),
      stack: error.stack
    }, 500);
  }
}

/**
 * Create JSON response
 */
function jsonResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  
  // Note: Apps Script Web Apps don't support custom status codes
  // We return 200 but include success flag in body
  
  return output;
}

/**
 * Generate UUID (for IDs)
 */
function generateUUID() {
  return Utilities.getUuid();
}

/**
 * Get current timestamp (ISO format)
 */
function getCurrentTimestamp() {
  return new Date().toISOString();
}
