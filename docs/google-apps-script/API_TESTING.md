# 🧪 TEST GOOGLE SHEETS API (Apps Script)

**Sau khi deploy Web App, chạy các test này để verify:**

---

## ✅ **TEST 1: Ping API (Status Check)**

```bash
curl "YOUR_APPS_SCRIPT_URL?action=status&secret=tho-ads-ai-2026"
```

**Expected Response:**
```json
{
  "success": true,
  "spreadsheetId": "1abc...",
  "spreadsheetName": "Your Sheet Name",
  "sheets": [
    { "name": "TAI_KHOAN", "rows": 2, "cols": 11 },
    { "name": "DE_XUAT", "rows": 1, "cols": 18 },
    { "name": "QUAN_SAT", "rows": 1, "cols": 12 },
    { "name": "MAU_HOC_DUOC", "rows": 1, "cols": 11 }
  ],
  "timestamp": "2026-02-05T14:38:00.000Z"
}
```

---

## ✅ **TEST 2: Initialize Sheets (Tạo/Kiểm tra headers)**

```bash
curl -X POST "YOUR_APPS_SCRIPT_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "tho-ads-ai-2026",
    "action": "init"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Sheets initialized",
  "created": ["DE_XUAT", "QUAN_SAT", "MAU_HOC_DUOC"]
}
```

---

## ✅ **TEST 3: Tạo Đề Xuất Mới (AI Campaign Guardian)**

```bash
curl -X POST "YOUR_APPS_SCRIPT_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "tho-ads-ai-2026",
    "action": "ghiDeXuat",
    "campaignId": "test_campaign_123",
    "tenCampaign": "Test Campaign",
    "userId": "test_user",
    "uuTien": "CAO",
    "hanhDong": {
      "loai": "GIAM_NGAN_SACH",
      "giaTri": 50000
    },
    "phanTich_ChuyenGia": [
      {
        "expert": "Cost Optimizer",
        "ly_do": "CPP quá cao so với benchmark"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "id": "uuid-abc-123...",
  "message": "Proposal saved successfully"
}
```

---

## ✅ **TEST 4: Đọc Danh Sách Đề Xuất**

```bash
curl "YOUR_APPS_SCRIPT_URL?action=layDanhSachDeXuat&secret=tho-ads-ai-2026&status=CHO_DUYET"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-abc-123...",
      "thoiGian_Tao": "2026-02-05T14:38:00.000Z",
      "campaignId": "test_campaign_123",
      "tenCampaign": "Test Campaign",
      "uuTien": "CAO",
      "trangThai": "CHO_DUYET",
      "hanhDong": {
        "loai": "GIAM_NGAN_SACH",
        "giaTri": 50000
      }
    }
  ],
  "count": 1
}
```

---

## ✅ **TEST 5: Tạo Quan Sát (Monitoring)**

```bash
curl -X POST "YOUR_APPS_SCRIPT_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "tho-ads-ai-2026",
    "action": "ghiQuanSat",
    "deXuatId": "uuid-abc-123...",
    "checkpoint_Ngay": 1,
    "campaignId": "test_campaign_123",
    "metrics_HienTai": {
      "cpp": 45000,
      "roas": 2.8
    },
    "metrics_TruocKhi": {
      "cpp": 60000,
      "roas": 2.2
    },
    "cpp_ThayDoi_Percent": -25,
    "roas_ThayDoi_Percent": 27.3,
    "danhGia": "THANH_CONG"
  }'
```

---

## ✅ **TEST 6: Tạo Mẫu Học (Learning Pattern)**

```bash
curl -X POST "YOUR_APPS_SCRIPT_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "tho-ads-ai-2026",
    "action": "ghiMauHoc",
    "tenMau": "Giảm CPP bằng cách thu hẹp audience",
    "dieuKien": {
      "cpp_cao_hon": 50000,
      "audience_size_lon_hon": 100000
    },
    "hanhDong_KhuyenNghi": {
      "loai": "THU_HEP_TARGETING",
      "chi_tiet": "Giảm độ tuổi xuống 25-45"
    },
    "soLan_ApDung": 1,
    "soLan_ThanhCong": 1,
    "cpp_CaiThien_TB_Percent": -25,
    "roas_CaiThien_TB_Percent": 27
  }'
```

---

## 🚨 **TROUBLESHOOTING**

### **Lỗi 401: Invalid API secret**
```
→ Kiểm tra lại "secret": "tho-ads-ai-2026" trong request
```

### **Lỗi 403: Permission denied**
```
→ Kiểm tra lại "Who has access" phải là "Anyone"
→ Re-deploy nếu cần
```

### **Lỗi: Sheet not found**
```
→ Chạy action "init" để tạo sheets
```

### **Không có response**
```
→ Kiểm tra URL có đúng không (phải kết thúc bằng /exec)
→ Kiểm tra Apps Script có deploy chưa
```

---

## 📝 **PowerShell Version (Windows)**

```powershell
# Test Status
Invoke-RestMethod -Uri "YOUR_URL?action=status&secret=tho-ads-ai-2026"

# Test Init
Invoke-RestMethod -Uri "YOUR_URL" -Method POST `
  -ContentType "application/json" `
  -Body '{"secret":"tho-ads-ai-2026","action":"init"}'
```

---

**Sau khi test xong, cập nhật URL vào `.env.local` và restart Next.js dev server!**
