# 🔧 HƯỚNG DẪN MERGE CODE - CHI TIẾT

**Mục tiêu:** Thêm AI Campaign Guardian handlers vào Apps Script gốc của bác

---

## ✅ **ĐÁNH GIÁ FILE GỐC:**

**File gốc của bác RẤT TỐT, bao gồm:**
- ✅ TAI_KHOAN management (user + token + ad accounts)
- ✅ API_SECRET authentication
- ✅ Helper functions: `ensureHeaders()`, `getOrCreateSheet()`, `logAction()`
- ✅ AI Usage tracking với cost breakdown VND
- ✅ DuLieuQuangCao để lưu metrics

**Chỉ cần THÊM:**
- ➕ 3 sheets configs: DE_XUAT, QUAN_SAT, MAU_HOC_DUOC
- ➕ 8 handler functions

---

## 📝 **CÁCH MERGE (4 BƯỚC):**

### **BƯỚC 1: Thêm vào CONFIG (dòng ~15)**

Tìm dòng `DU_LIEU_QUANG_CAO_SHEET: 'DuLieuQuangCao',`

Thêm ngay sau đó:

```javascript
    DU_LIEU_QUANG_CAO_SHEET: 'DuLieuQuangCao',  // ← Dòng cũ
    
    // ✨ NEW: AI Campaign Guardian sheets
    DE_XUAT_SHEET: 'DE_XUAT',
    QUAN_SAT_SHEET: 'QUAN_SAT',
    MAU_HOC_DUOC_SHEET: 'MAU_HOC_DUOC',
```

---

### **BƯỚC 2: Thêm vào HEADERS (dòng ~140)**

Tìm phần cuối của `HEADERS.DuLieuQuangCao` (sau `'updated_at'`)

Thêm ngay sau đó:

```javascript
        'updated_at'
    ],  // ← Dòng cũ (kết thúc DuLieuQuangCao)
    
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
};  // ← Kết thúc HEADERS
```

---

### **BƯỚC 3: Thêm cases vào doPost() (dòng ~220)**

Tìm dòng `case 'getDuLieuQuangCao':` trong function `doPost()`

Thêm ngay trước dòng `default:`:

```javascript
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
                
            default:  // ← Dòng cũ
```

---

### **BƯỚC 4: Thêm cases vào doGet() (dòng ~260)**

Tìm dòng `case 'getDuLieuQuangCao':` trong function `doGet()`

Thêm ngay trước dòng `default:`:

```javascript
            case 'getDuLieuQuangCao':
                return getDuLieuQuangCao(params);
            
            // ✨ NEW: AI Campaign Guardian GET actions
            case 'layDanhSachDeXuat':
                return layDanhSachDeXuat(params);
            case 'layQuanSatTheoDeXuat':
                return layQuanSatTheoDeXuat(params);
            case 'layDanhSachMauHoc':
                return layDanhSachMauHoc(params);
                
            default:  // ← Dòng cũ
```

---

### **BƯỚC 5: Thêm Helper Functions (cuối file, dòng ~1200)**

**SỬA NHẸ 2 FUNCTIONS CŨ** (vì code mới cần `getSheet` thay vì `getOrCreateSheet`):

#### 5.1. Tìm function `getOrCreateSheet` (dòng ~500)

Thêm alias ngay sau function đó:

```javascript
/**
 * Lấy hoặc tạo sheet
 */
function getOrCreateSheet(sheetName) {
    // ... (GIỮ NGUYÊN CODE CŨ)
}

// ✨ NEW: Alias for AI Campaign Guardian compatibility
function getSheet(sheetName) {
    return getOrCreateSheet(sheetName);
}
```

#### 5.2. Tìm function `logAction` (dòng ~550)

Thêm helper ngay sau function đó:

```javascript
/**
 * Ghi log hành động
 */
function logAction(action, accountId, date, rowsCount, status, message) {
    // ... (GIỮ NGUYÊN CODE CŨ)
}

// ✨ NEW: Utilities for AI Campaign Guardian
function generateUUID() {
    return Utilities.getUuid();
}

function getCurrentTimestamp() {
    return new Date().toISOString();
}

function jsonResponse(data, statusCode = 200) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}
```

**LƯU Ý:** Function `jsonResponse` đã có sẵn trong file gốc tên `createResponse()` → Chỉ cần thêm alias:

```javascript
// Alias for compatibility
function jsonResponse(data, statusCode = 200) {
    return createResponse(data, statusCode);
}
```

---

### **BƯỚC 6: Copy 8 Handler Functions (cuối file)**

Copy toàn bộ functions sau từ 3 files em tạo ở đầu, paste vào **CUỐI FILE** (sau function `getDuLieuQuangCao`):

**Từ DeXuatHandlers.gs:**
```javascript
// ===================================================================
// AI CAMPAIGN GUARDIAN - DE_XUAT HANDLERS
// ===================================================================

function ghiDeXuat(data) { /* ... */ }
function layDanhSachDeXuat(params) { /* ... */ }
function capNhatDeXuat(data) { /* ... */ }
```

**Từ QuanSatHandlers.gs:**
```javascript
// ===================================================================
// AI CAMPAIGN GUARDIAN - QUAN_SAT HANDLERS
// ===================================================================

function ghiQuanSat(data) { /* ... */ }
function layQuanSatTheoDeXuat(params) { /* ... */ }
```

**Từ MauHocHandlers.gs:**
```javascript
// ===================================================================
// AI CAMPAIGN GUARDIAN - MAU_HOC_DUOC HANDLERS
// ===================================================================

function ghiMauHoc(data) { /* ... */ }
function layDanhSachMauHoc(params) { /* ... */ }
function capNhatMauHoc(data) { /* ... */ }
```

**SỬA NHỎ:** Trong các functions trên, replace:
- `CONFIG.SHEETS.DE_XUAT` → `CONFIG.DE_XUAT_SHEET`
- `CONFIG.SHEETS.QUAN_SAT` → `CONFIG.QUAN_SAT_SHEET`
- `CONFIG.SHEETS.MAU_HOC_DUOC` → `CONFIG.MAU_HOC_DUOC_SHEET`

---

## ✅ **SAU KHI MERGE:**

File Apps Script của bác sẽ có:

**SHEETS:**
- ✅ Campaigns, Accounts, Logs (cũ - giữ nguyên)
- ✅ TAI_KHOAN, AiUsage, DuLieuQuangCao (cũ - giữ nguyên)
- ✨ DE_XUAT, QUAN_SAT, MAU_HOC_DUOC (mới)

**API ACTIONS:**
```
POST actions (15 total):
- sync, append, update, delete, clear, init (cũ)
- saveTAI_KHOAN, saveAdAccounts, fixHeaders (cũ)
- logAiUsage, saveDuLieuQuangCao (cũ)
- ghiDeXuat, capNhatDeXuat (mới ✨ )
- ghiQuanSat (mới ✨)
- ghiMauHoc, capNhatMauHoc (mới ✨)

GET actions (9 total):
- read, history, status (cũ)
- getTAI_KHOAN, getAiUsage, getDuLieuQuangCao (cũ)
- layDanhSachDeXuat, layQuanSatTheoDeXuat, layDanhSachMauHoc (mới ✨)
```

---

## 🧪 **TEST SAU KHI MERGE:**

```bash
# Test mới (ping vẫn hoạt động)
curl "https://script.google.com/.../exec?action=status&secret=tho-ads-ai-2026"

# Test AI Campaign Guardian
curl -X POST "https://script.google.com/.../exec" \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "tho-ads-ai-2026",
    "action": "ghiDeXuat",
    "campaignId": "test123",
    "uuTien": "CAO"
  }'
```

---

## 🚨 **LƯU Ý QUAN TRỌNG:**

1. **Backup trước khi merge:** Copy toàn bộ code cũ ra file backup
2. **Test từng bước:** Sau mỗi bước, chạy script test để đảm bảo không lỗi syntax
3. **API_SECRET giữ nguyên:** Không thay đổi `'tho-ads-ai-2026'`
4. **Sheets cũ không ảnh hưởng:** TAI_KHOAN, Campaigns, etc. vẫn hoạt động bình thường

---

**BÁC MUỐN EM TẠO COMPLETE MERGED FILE LUÔN KHÔNG?** 

Em có thể paste cả file hoàn chỉnh để bác chỉ cần copy-replace thay vì merge từng phần! 🚀
