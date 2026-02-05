/**
 * ===================================================================
 * PATTERN (MAU_HOC_DUOC) HANDLERS
 * ===================================================================
 * CRUD operations for learned patterns
 * 
 * Sheet columns:
 * id | tenMau | dieuKien | hanhDong_KhuyenNghi | soLan_ApDung | 
 * soLan_ThanhCong | tyLe_ThanhCong | cpp_CaiThien_TB_Percent | 
 * roas_CaiThien_TB_Percent | doTinCay | capNhat_LanCuoi
 * ===================================================================
 */

/**
 * Write new pattern to sheet
 * POST body: Full MauHoc object
 */
function ghiMauHoc(data) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.MAU_HOC_DUOC);
    
    // Calculate success rate
    const soLan_ApDung = data.soLan_ApDung || 1;
    const soLan_ThanhCong = data.soLan_ThanhCong || 0;
    const tyLe_ThanhCong = soLan_ApDung > 0 ? soLan_ThanhCong / soLan_ApDung : 0;
    
    // Prepare row data
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
      data.doTinCay || tyLe_ThanhCong, // Default confidence = success rate
      getCurrentTimestamp()
    ];
    
    // Append row
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

/**
 * Get all learned patterns
 * Query params: minConfidence (optional)
 */
function layDanhSachMauHoc(params) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.MAU_HOC_DUOC);
    const data = sheet.getDataRange().getValues();
    
    if (data.length === 0) {
      return jsonResponse({ success: true, data: [] });
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // Convert rows to objects
    let results = rows.map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        let value = row[i];
        
        // Parse JSON fields
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
    
    // Filter by minimum confidence
    if (params.minConfidence) {
      const minConf = parseFloat(params.minConfidence);
      results = results.filter(r => r.doTinCay >= minConf);
    }
    
    // Sort by confidence (highest first)
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

/**
 * Update pattern stats (when reusing a pattern)
 * POST body: { id, wasSuccessful, cpp_change, roas_change }
 */
function capNhatMauHoc(data) {
  try {
    if (!data.id) {
      return jsonResponse({ 
        success: false, 
        error: 'Missing pattern ID' 
      });
    }
    
    const sheet = getSheet(CONFIG.SHEETS.MAU_HOC_DUOC);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    // Find row by ID
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
    
    // Get current values
    const currentRow = values[rowIndex];
    const soLan_ApDung = currentRow[4] + 1; // Increment applications
    const soLan_ThanhCong = currentRow[5] + (data.wasSuccessful ? 1 : 0);
    const tyLe_ThanhCong = soLan_ApDung > 0 ? soLan_ThanhCong / soLan_ApDung : 0;
    
    // Update average improvements (weighted average)
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
    
    // Update sheet
    sheet.getRange(rowIndex + 1, 5).setValue(soLan_ApDung); // soLan_ApDung
    sheet.getRange(rowIndex + 1, 6).setValue(soLan_ThanhCong); // soLan_ThanhCong
    sheet.getRange(rowIndex + 1, 7).setValue(tyLe_ThanhCong); // tyLe_ThanhCong
    sheet.getRange(rowIndex + 1, 8).setValue(newCppImprovement); // cpp_CaiThien_TB_Percent
    sheet.getRange(rowIndex + 1, 9).setValue(newRoasImprovement); // roas_CaiThien_TB_Percent
    sheet.getRange(rowIndex + 1, 10).setValue(newConfidence); // doTinCay
    sheet.getRange(rowIndex + 1, 11).setValue(getCurrentTimestamp()); // capNhat_LanCuoi
    
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
