# 🚀 HƯỚNG DẪN AUTO-SETUP (1 PHÚT)

**Tự động tạo 3 sheets mới chỉ với 1 click!**

---

## 📋 CHUẨN BỊ

Bác đã có:
- ✅ Google Sheets với sheet **TAI_KHOAN**
- ✅ File `Setup_AutoCreate.gs` (script tự động)

---

## ⚡ CÁCH THỰC HIỆN (4 BƯỚC)

### Bước 1: Mở Apps Script

1. Mở Google Sheets của bác (sheet có TAI_KHOAN)
2. Click menu: **Extensions** (Tiện ích mở rộng)
3. Click: **Apps Script**
4. Cửa sổ mới mở ra

### Bước 2: Paste Script

1. Xóa hết code mặc định trong `Code.gs`
2. Copy toàn bộ file `Setup_AutoCreate.gs`
3. Paste vào Apps Script editor
4. **Ctrl+S** để save

### Bước 3: Chạy Script

1. Click vào dropdown function (hiện đang là `myFunction`)
2. Chọn: **`autoSetupSheets`**
3. Click nút **▶️ Run** (Chạy)
4. Lần đầu sẽ yêu cầu authorize:
   - Click **Review permissions**
   - Chọn tài khoản Google
   - Click **Advanced** → **Go to ... (unsafe)**
   - Click **Allow**

### Bước 4: Chờ & Xác Nhận

1. Chờ 5-10 giây
2. Sẽ hiện popup: **"🎉 Setup thành công!"**
3. Click **OK**
4. **Quay lại Google Sheets** để xem kết quả

---

## ✅ KẾT QUẢ MONG ĐỢI

Sau khi chạy xong, Google Sheets của bác sẽ có **4 sheets**:

```
Tabs at bottom:
├─ TAI_KHOAN       (giữ nguyên)
├─ DE_XUAT         ✨ MỚI (18 columns)
├─ QUAN_SAT        ✨ MỚI (12 columns)
└─ MAU_HOC_DUOC    ✨ MỚI (11 columns)
```

Mỗi sheet mới sẽ có:
- ✅ Headers ở row 1
- ✅ Bold + màu nền xám
- ✅ Freeze row 1
- ✅ Auto-resize columns

---

## 🎛️ BONUS: CUSTOM MENU

Script cũng tạo menu tùy chỉnh! Sau khi chạy:

**Reload Google Sheets** → Sẽ có menu mới: **🤖 AI Campaign Guardian**

Click vào sẽ thấy:
- ⚙️ **Auto-Setup Sheets** - Chạy lại setup nếu cần
- 📊 **Verify Setup** - Kiểm tra 4 sheets đã đủ chưa

---

## 🐛 TROUBLESHOOTING

### "Script không chạy / No function selected"
→ Đảm bảo đã chọn `autoSetupSheets` trong dropdown

### "Authorization required"
→ Lần đầu phải authorize. Follow bước 3.4 bên trên

### "Script đã chạy nhưng không thấy sheets mới"
→ F5 reload lại Google Sheets

### "Sheets bị duplicate"
→ Script sẽ tự xóa sheets cũ trước khi tạo mới

### "Sheet TAI_KHOAN bị mất"
→ KHÔNG BAO GIỜ xảy ra! Script không động vào TAI_KHOAN

---

## 📸 SCREENSHOT MINH HỌA

**Bước 1-2: Mở Apps Script & Paste Code**
```
Extensions → Apps Script → Paste code → Save
```

**Bước 3: Chọn function & Run**
```
Dropdown: autoSetupSheets
Click: ▶️ Run
Authorize nếu cần
```

**Bước 4: Success Popup**
```
┌─────────────────────────────────┐
│  🎉 Setup thành công!           │
│                                 │
│  ✅ Đã tạo 3 sheets mới:        │
│     • DE_XUAT (18 columns)      │
│     • QUAN_SAT (12 columns)     │
│     • MAU_HOC_DUOC (11 columns) │
│                                 │
│  📋 Sheet TAI_KHOAN không đổi   │
│                                 │
│  [ OK ]                         │
└─────────────────────────────────┘
```

**Kết quả: 4 Sheets**
```
┌─────────────────────────────────────────┐
│ QUAN_SU_ADS                             │
├─────────────────────────────────────────┤
│  TAI_KHOAN  DE_XUAT  QUAN_SAT  MAU_HOC  │
└─────────────────────────────────────────┘
      ↑          ↑        ↑         ↑
   Giữ nguyên   NEW     NEW       NEW
```

---

## 🚀 BƯỚC TIẾP THEO

Sau khi setup xong 4 sheets:

1. ✅ Verify sheets: Menu **🤖 AI Campaign Guardian** → **📊 Verify Setup**
2. 📝 Deploy API:
   - Delete `Setup_AutoCreate.gs` (không cần nữa)
   - Copy 6 files API code (Code.gs, Config.gs, Router.gs, etc.)
   - Edit `Config.gs` với SPREADSHEET_ID
   - Deploy as Web App

3. 🧪 Test API:
   ```bash
   curl "https://script.google.com/.../exec?action=ping"
   ```

---

## ⚠️ LƯU Ý QUAN TRỌNG

- ⚠️ Script sẽ **XÓA** sheets DE_XUAT/QUAN_SAT/MAU_HOC_DUOC nếu đã tồn tại
- ✅ Sheet **TAI_KHOAN** sẽ **KHÔNG BỊ ĐỘNG**
- 🔁 Có thể chạy lại script nhiều lần (sẽ recreate sheets)
- 💾 Nên backup spreadsheet trước khi chạy (File → Make a copy)

---

## 🎉 DONE!

**Tổng thời gian: < 1 phút**

Nếu gặp vấn đề, chạy function `verifySetup()` để kiểm tra!
