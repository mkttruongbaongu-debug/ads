/**
 * ===================================================================
 * PROPOSAL (DE_XUAT) HANDLERS
 * ===================================================================
 * CRUD operations for proposals
 * 
 * Sheet columns:
 * id | thoiGian_Tao | campaignId | tenCampaign | userId | uuTien | 
 * trangThai | hanhDong_Loai | hanhDong_GiaTri | phanTich_ChuyenGia |
 * metrics_TruocKhi | nguoiDuyet | thoiGian_Duyet | ghiChu_NguoiDung |
 * thoiGian_ThucThi | ketQua_ThucThi | giamSat_DenNgay | ketQua_CuoiCung
 * ===================================================================
 */

/**
 * Write new proposal to sheet
 * POST body: Full DeXuat object
 */
function ghiDeXuat(data) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.DE_XUAT);
    
    // Prepare row data
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
    
    // Append row
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

/**
 * Get list of proposals
 * Query params: status, priority, userId
 */
function layDanhSachDeXuat(params) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.DE_XUAT);
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
        const jsonFields = ['hanhDong_GiaTri', 'phanTich_ChuyenGia', 'metrics_TruocKhi', 'ketQua_ThucThi'];
        if (jsonFields.includes(header)) {
          try {
            value = value ? JSON.parse(value) : {};
          } catch (e) {
            value = {};
          }
        }
        
        // Combine hanhDong fields
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
    
    // Filter by status
    if (params.status && params.status !== 'ALL') {
      results = results.filter(r => r.trangThai === params.status);
    }
    
    // Filter by priority
    if (params.priority) {
      results = results.filter(r => r.uuTien === params.priority);
    }
    
    // Filter by userId
    if (params.userId) {
      results = results.filter(r => r.userId === params.userId);
    }
    
    // Sort by priority (NGUY_CAP first)
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

/**
 * Update existing proposal
 * POST body: { id, ...fieldsToUpdate }
 */
function capNhatDeXuat(data) {
  try {
    if (!data.id) {
      return jsonResponse({ 
        success: false, 
        error: 'Missing proposal ID' 
      });
    }
    
    const sheet = getSheet(CONFIG.SHEETS.DE_XUAT);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    // Find row by ID (column A)
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
    
    // Update fields
    const updates = {};
    
    // Map field names to column indices
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
    
    // Apply updates
    Object.keys(data).forEach(field => {
      if (field !== 'id' && fieldMap[field] !== undefined) {
        const colIndex = fieldMap[field];
        let value = data[field];
        
        // Stringify objects
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
