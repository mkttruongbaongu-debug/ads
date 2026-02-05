/**
 * ===================================================================
 * AUTO-SETUP SCRIPT - ONE-CLICK SHEET CREATION
 * ===================================================================
 * Tự động tạo 3 sheets mới (DE_XUAT, QUAN_SAT, MAU_HOC_DUOC)
 * và thêm headers vào mỗi sheet.
 * 
 * CẬN THẬN:
 * - Script này sẽ XÓA sheets cũ nếu đã tồn tại!
 * - Chỉ chạy 1 lần duy nhất khi setup
 * - Sheet TAI_KHOAN sẽ KHÔNG bị ảnh hưởng
 * 
 * CÁCH SỬ DỤNG:
 * 1. Mở Google Sheets của bạn
 * 2. Extensions → Apps Script
 * 3. Paste code này vào
 * 4. Click biểu tượng ▶️ (Run) ở toolbar
 * 5. Authorize khi được hỏi
 * 6. Chờ 5-10 giây
 * 7. DONE! Quay lại Sheets để xem kết quả
 * 
 * Created: 2026-02-05
 * ===================================================================
 */

function autoSetupSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  Logger.log('🚀 Bắt đầu auto-setup...');
  
  // ===================================================================
  // SHEET 1: DE_XUAT (Proposals)
  // ===================================================================
  Logger.log('📝 Creating DE_XUAT sheet...');
  
  // Delete if exists
  let existingSheet = spreadsheet.getSheetByName('DE_XUAT');
  if (existingSheet) {
    spreadsheet.deleteSheet(existingSheet);
    Logger.log('   ⚠️  Deleted existing DE_XUAT sheet');
  }
  
  // Create new sheet
  const deXuatSheet = spreadsheet.insertSheet('DE_XUAT');
  
  // Add headers
  const deXuatHeaders = [
    'id',
    'thoiGian_Tao',
    'campaignId',
    'tenCampaign',
    'userId',
    'uuTien',
    'trangThai',
    'hanhDong_Loai',
    'hanhDong_GiaTri',
    'phanTich_ChuyenGia',
    'metrics_TruocKhi',
    'nguoiDuyet',
    'thoiGian_Duyet',
    'ghiChu_NguoiDung',
    'thoiGian_ThucThi',
    'ketQua_ThucThi',
    'giamSat_DenNgay',
    'ketQua_CuoiCung'
  ];
  
  deXuatSheet.getRange(1, 1, 1, deXuatHeaders.length).setValues([deXuatHeaders]);
  
  // Format headers
  deXuatSheet.getRange(1, 1, 1, deXuatHeaders.length)
    .setFontWeight('bold')
    .setBackground('#f3f3f3')
    .setFontColor('#333333');
  
  // Freeze header row
  deXuatSheet.setFrozenRows(1);
  
  // Auto-resize columns
  deXuatSheet.autoResizeColumns(1, deXuatHeaders.length);
  
  Logger.log('   ✅ DE_XUAT created with ' + deXuatHeaders.length + ' columns');
  
  // ===================================================================
  // SHEET 2: QUAN_SAT (Observations)
  // ===================================================================
  Logger.log('📊 Creating QUAN_SAT sheet...');
  
  // Delete if exists
  existingSheet = spreadsheet.getSheetByName('QUAN_SAT');
  if (existingSheet) {
    spreadsheet.deleteSheet(existingSheet);
    Logger.log('   ⚠️  Deleted existing QUAN_SAT sheet');
  }
  
  // Create new sheet
  const quanSatSheet = spreadsheet.insertSheet('QUAN_SAT');
  
  // Add headers
  const quanSatHeaders = [
    'id',
    'deXuatId',
    'checkpoint_Ngay',
    'thoiGian_QuanSat',
    'campaignId',
    'metrics_HienTai',
    'metrics_TruocKhi',
    'cpp_ThayDoi_Percent',
    'roas_ThayDoi_Percent',
    'danhGia',
    'phanTich_AI',
    'baiHoc'
  ];
  
  quanSatSheet.getRange(1, 1, 1, quanSatHeaders.length).setValues([quanSatHeaders]);
  
  // Format headers
  quanSatSheet.getRange(1, 1, 1, quanSatHeaders.length)
    .setFontWeight('bold')
    .setBackground('#f3f3f3')
    .setFontColor('#333333');
  
  // Freeze header row
  quanSatSheet.setFrozenRows(1);
  
  // Auto-resize columns
  quanSatSheet.autoResizeColumns(1, quanSatHeaders.length);
  
  Logger.log('   ✅ QUAN_SAT created with ' + quanSatHeaders.length + ' columns');
  
  // ===================================================================
  // SHEET 3: MAU_HOC_DUOC (Learned Patterns)
  // ===================================================================
  Logger.log('🧠 Creating MAU_HOC_DUOC sheet...');
  
  // Delete if exists
  existingSheet = spreadsheet.getSheetByName('MAU_HOC_DUOC');
  if (existingSheet) {
    spreadsheet.deleteSheet(existingSheet);
    Logger.log('   ⚠️  Deleted existing MAU_HOC_DUOC sheet');
  }
  
  // Create new sheet
  const mauHocSheet = spreadsheet.insertSheet('MAU_HOC_DUOC');
  
  // Add headers
  const mauHocHeaders = [
    'id',
    'tenMau',
    'dieuKien',
    'hanhDong_KhuyenNghi',
    'soLan_ApDung',
    'soLan_ThanhCong',
    'tyLe_ThanhCong',
    'cpp_CaiThien_TB_Percent',
    'roas_CaiThien_TB_Percent',
    'doTinCay',
    'capNhat_LanCuoi'
  ];
  
  mauHocSheet.getRange(1, 1, 1, mauHocHeaders.length).setValues([mauHocHeaders]);
  
  // Format headers
  mauHocSheet.getRange(1, 1, 1, mauHocHeaders.length)
    .setFontWeight('bold')
    .setBackground('#f3f3f3')
    .setFontColor('#333333');
  
  // Freeze header row
  mauHocSheet.setFrozenRows(1);
  
  // Auto-resize columns
  mauHocSheet.autoResizeColumns(1, mauHocHeaders.length);
  
  Logger.log('   ✅ MAU_HOC_DUOC created with ' + mauHocHeaders.length + ' columns');
  
  // ===================================================================
  // FINAL TOUCHES
  // ===================================================================
  
  // Reorder sheets: TAI_KHOAN, DE_XUAT, QUAN_SAT, MAU_HOC_DUOC
  const taiKhoanSheet = spreadsheet.getSheetByName('TAI_KHOAN');
  if (taiKhoanSheet) {
    spreadsheet.setActiveSheet(taiKhoanSheet);
    spreadsheet.moveActiveSheet(1);
  }
  
  spreadsheet.setActiveSheet(deXuatSheet);
  spreadsheet.moveActiveSheet(2);
  
  spreadsheet.setActiveSheet(quanSatSheet);
  spreadsheet.moveActiveSheet(3);
  
  spreadsheet.setActiveSheet(mauHocSheet);
  spreadsheet.moveActiveSheet(4);
  
  // Set active to first sheet
  if (taiKhoanSheet) {
    spreadsheet.setActiveSheet(taiKhoanSheet);
  } else {
    spreadsheet.setActiveSheet(deXuatSheet);
  }
  
  // ===================================================================
  // DONE!
  // ===================================================================
  Logger.log('');
  Logger.log('🎉 AUTO-SETUP HOÀN THÀNH!');
  Logger.log('');
  Logger.log('✅ Đã tạo 3 sheets:');
  Logger.log('   1. DE_XUAT (18 columns)');
  Logger.log('   2. QUAN_SAT (12 columns)');
  Logger.log('   3. MAU_HOC_DUOC (11 columns)');
  Logger.log('');
  Logger.log('📋 Sheet TAI_KHOAN giữ nguyên (không bị ảnh hưởng)');
  Logger.log('');
  Logger.log('🚀 Bước tiếp theo:');
  Logger.log('   1. Quay lại Google Sheets');
  Logger.log('   2. Verify 4 sheets đã có đủ');
  Logger.log('   3. Deploy Apps Script API (Code.gs, Config.gs, etc.)');
  Logger.log('');
  
  // Show success message
  SpreadsheetApp.getUi().alert(
    '🎉 Setup thành công!\n\n' +
    '✅ Đã tạo 3 sheets mới:\n' +
    '   • DE_XUAT (18 columns)\n' +
    '   • QUAN_SAT (12 columns)\n' +
    '   • MAU_HOC_DUOC (11 columns)\n\n' +
    '📋 Sheet TAI_KHOAN không bị thay đổi\n\n' +
    'Bước tiếp theo: Deploy Apps Script API code'
  );
}

/**
 * Create custom menu on open
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🤖 AI Campaign Guardian')
    .addItem('⚙️ Auto-Setup Sheets', 'autoSetupSheets')
    .addSeparator()
    .addItem('📊 Verify Setup', 'verifySetup')
    .addToUi();
}

/**
 * Verify setup is correct
 */
function verifySetup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = ['TAI_KHOAN', 'DE_XUAT', 'QUAN_SAT', 'MAU_HOC_DUOC'];
  
  Logger.log('🔍 Verifying setup...');
  
  let message = '📊 VERIFICATION REPORT\n\n';
  let allGood = true;
  
  requiredSheets.forEach(sheetName => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet) {
      const numCols = sheet.getLastColumn();
      message += `✅ ${sheetName}: ${numCols} columns\n`;
      Logger.log(`✅ ${sheetName} exists with ${numCols} columns`);
    } else {
      message += `❌ ${sheetName}: NOT FOUND\n`;
      Logger.log(`❌ ${sheetName} NOT FOUND`);
      allGood = false;
    }
  });
  
  message += '\n';
  
  if (allGood) {
    message += '🎉 All sheets are ready!\n\n';
    message += 'Next step: Deploy Apps Script API';
  } else {
    message += '⚠️ Some sheets are missing.\n\n';
    message += 'Run: 🤖 AI Campaign Guardian → ⚙️ Auto-Setup Sheets';
  }
  
  SpreadsheetApp.getUi().alert(message);
  Logger.log(message);
}
