/**
 * ===================================================================
 * OBSERVATION (QUAN_SAT) HANDLERS
 * ===================================================================
 * CRUD operations for monitoring observations
 * 
 * Sheet columns:
 * id | deXuatId | checkpoint_Ngay | thoiGian_QuanSat | campaignId |
 * metrics_HienTai | metrics_TruocKhi | cpp_ThayDoi_Percent | 
 * roas_ThayDoi_Percent | danhGia | phanTich_AI | baiHoc
 * ===================================================================
 */

/**
 * Write new observation to sheet
 * POST body: Full QuanSat object
 */
function ghiQuanSat(data) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.QUAN_SAT);
    
    // Prepare row data
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
    
    // Append row
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

/**
 * Get observations for a specific proposal
 * Query params: deXuatId (required)
 */
function layQuanSatTheoDeXuat(params) {
  try {
    if (!params.deXuatId) {
      return jsonResponse({ 
        success: false, 
        error: 'Missing deXuatId parameter' 
      });
    }
    
    const sheet = getSheet(CONFIG.SHEETS.QUAN_SAT);
    const data = sheet.getDataRange().getValues();
    
    if (data.length === 0) {
      return jsonResponse({ success: true, data: [] });
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // Find deXuatId column index
    const deXuatIdCol = headers.indexOf('deXuatId');
    if (deXuatIdCol === -1) {
      return jsonResponse({ 
        success: false, 
        error: 'deXuatId column not found in QUAN_SAT sheet' 
      });
    }
    
    // Filter rows by deXuatId
    const filteredRows = rows.filter(row => row[deXuatIdCol] === params.deXuatId);
    
    // Convert to objects
    const results = filteredRows.map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        let value = row[i];
        
        // Parse JSON fields
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
    
    // Sort by checkpoint (D+1, D+3, D+7)
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
