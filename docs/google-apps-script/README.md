# Google Apps Script - Database API

**Complete backend API for AI Campaign Guardian using Google Sheets**

---

## 📦 Files Overview

| File | Purpose | Lines |
|------|---------|-------|
| `Code.gs` | Entry point (doPost/doGet) | 35 |
| `Config.gs` | Configuration & helpers | 65 |
| `Router.gs` | Request routing | 95 |
| `DeXuatHandlers.gs` | Proposals CRUD | 180 |
| `QuanSatHandlers.gs` | Observations CRUD | 115 |
| `MauHocHandlers.gs` | Patterns CRUD + Stats | 180 |

**Total:** ~670 lines of production-ready code

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Google Sheets

1. Go to [Google Sheets](https://sheets.google.com)
2. Create new spreadsheet: **QUAN_SU_ADS_DATABASE**
3. Create 4 sheets (tabs):
   - `DE_XUAT`
   - `QUAN_SAT`
   - `MAU_HOC_DUOC`
   - `TAI_KHOAN`

### Step 2: Add Headers

Copy headers from `SHEET_HEADERS.txt` vào row 1 của mỗi sheet.

### Step 3: Deploy Apps Script

1. In Google Sheets: **Extensions** → **Apps Script**
2. Delete default `Code.gs` content
3. Create 6 files và copy code:
   - `Code.gs`
   - `Config.gs`
   - `Router.gs`
   - `DeXuatHandlers.gs`
   - `QuanSatHandlers.gs`
   - `MauHocHandlers.gs`

4. **Edit `Config.gs`:**
   ```javascript
   SPREADSHEET_ID: 'YOUR_ACTUAL_SPREADSHEET_ID_HERE'
   ```
   Get from URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

5. **Deploy:**
   - Click **Deploy** → **New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**

6. **Copy Web App URL:**
   ```
   https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
   ```

7. **Add to .env.local:**
   ```bash
   GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
   ```

---

## 🧪 Testing

### Test 1: Ping
```bash
curl "https://script.google.com/.../exec?action=ping"
```

Expected response:
```json
{
  "success": true,
  "message": "Apps Script API is running",
  "version": "1.0.0",
  "timestamp": "2026-02-05T14:00:00.000Z"
}
```

### Test 2: Write Proposal
```bash
curl -X POST "https://script.google.com/.../exec?action=ghiDeXuat" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "123",
    "tenCampaign": "Test Campaign",
    "userId": "test@example.com",
    "uuTien": "CAO",
    "trangThai": "CHO_DUYET"
  }'
```

### Test 3: Read Proposals
```bash
curl "https://script.google.com/.../exec?action=layDanhSachDeXuat&status=CHO_DUYET"
```

---

## 📊 API Reference

### Proposals (DE_XUAT)

#### Write Proposal
```
POST ?action=ghiDeXuat
Body: DeXuat object (JSON)
Returns: { success, id }
```

#### List Proposals
```
GET ?action=layDanhSachDeXuat&status=CHO_DUYET&priority=NGUY_CAP
Returns: { success, data: DeXuat[], count }
```

#### Update Proposal
```
POST ?action=capNhatDeXuat
Body: { id, ...fieldsToUpdate }
Returns: { success, updates }
```

### Observations (QUAN_SAT)

#### Write Observation
```
POST ?action=ghiQuanSat
Body: QuanSat object (JSON)
Returns: { success, id }
```

#### Get Observations
```
GET ?action=layQuanSatTheoDeXuat&deXuatId=uuid-123
Returns: { success, data: QuanSat[], count }
```

### Patterns (MAU_HOC_DUOC)

#### Write Pattern
```
POST ?action=ghiMauHoc
Body: MauHoc object (JSON)
Returns: { success, id }
```

#### List Patterns
```
GET ?action=layDanhSachMauHoc&minConfidence=0.7
Returns: { success, data: MauHoc[], count }
```

#### Update Pattern Stats
```
POST ?action=capNhatMauHoc
Body: { id, wasSuccessful, cpp_change, roas_change }
Returns: { success, stats }
```

---

## 🔧 Features

### ✅ Smart JSON Handling
- Auto-parse JSON fields (hanhDong, metrics, phanTich)
- Auto-stringify when writing
- Error-safe parsing (fallback to {})

### ✅ Auto-Sorting
- Proposals: By priority (NGUY_CAP → THAP)
- Observations: By checkpoint (D+1 → D+7)
- Patterns: By confidence (high → low)

### ✅ Filtering
- Status filter (CHO_DUYET, DA_DUYET, etc.)
- Priority filter (NGUY_CAP, CAO, etc.)
- User filter (by email)
- Confidence threshold (for patterns)

### ✅ Pattern Stats
- Auto-calculate success rate
- Weighted average improvements
- Confidence scoring
- Last updated timestamp

### ✅ UUID Generation
- Auto-generate IDs if not provided
- Uses Apps Script built-in `Utilities.getUuid()`

### ✅ Error Handling
- Try-catch on all handlers
- Detailed error messages
- Stack traces in logs
- Validation checks

---

## 📝 Sheet Headers

### DE_XUAT (18 columns)
```
id | thoiGian_Tao | campaignId | tenCampaign | userId | uuTien | trangThai | hanhDong_Loai | hanhDong_GiaTri | phanTich_ChuyenGia | metrics_TruocKhi | nguoiDuyet | thoiGian_Duyet | ghiChu_NguoiDung | thoiGian_ThucThi | ketQua_ThucThi | giamSat_DenNgay | ketQua_CuoiCung
```

### QUAN_SAT (12 columns)
```
id | deXuatId | checkpoint_Ngay | thoiGian_QuanSat | campaignId | metrics_HienTai | metrics_TruocKhi | cpp_ThayDoi_Percent | roas_ThayDoi_Percent | danhGia | phanTich_AI | baiHoc
```

### MAU_HOC_DUOC (11 columns)
```
id | tenMau | dieuKien | hanhDong_KhuyenNghi | soLan_ApDung | soLan_ThanhCong | tyLe_ThanhCong | cpp_CaiThien_TB_Percent | roas_CaiThien_TB_Percent | doTinCay | capNhat_LanCuoi
```

### TAI_KHOAN (8 columns)
```
email | name | avatar | plan | facebook_accessToken | facebook_adAccountId | created_at | last_login
```

---

## 🐛 Troubleshooting

### "Failed to open spreadsheet"
→ Check `SPREADSHEET_ID` in `Config.gs`

### "Sheet not found"
→ Verify sheet names match exactly (case-sensitive)

### "Invalid action"
→ Check `action` query parameter spelling

### "Proposal not found"
→ Verify ID exists in sheet (column A)

### No data returned
→ Check if sheet has headers in row 1

---

## 🔐 Security Notes

- Deploy as **Me** (your account)
- Access: **Anyone** (authenticated via Next.js)
- Consider adding API key validation if needed
- Apps Script runs as you → has full sheet access

---

## 📊 Performance

- **Write**: ~500ms per row
- **Read**: ~1s for 100 rows
- **Update**: ~300ms per row
- **Limits**: 
  - 6 min/execution max
  - 90 min/day quota (free)

---

## 🎉 Complete!

Your Google Sheets database API is ready to use.

**Next:** Configure environment variables in your Next.js app:
```bash
GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/{YOUR_ID}/exec
```

Test from Next.js:
```typescript
const response = await fetch(
  `${process.env.GOOGLE_SHEETS_API_URL}?action=ping`
);
```
