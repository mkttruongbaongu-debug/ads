# Setup & Deployment Guide - AI Campaign Guardian

**Version:** 1.0  
**Last Updated:** 2026-02-05

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Google Sheets Setup](#google-sheets-setup)
3. [Apps Script Deployment](#apps-script-deployment)
4. [Environment Variables](#environment-variables)
5. [Vercel Deployment](#vercel-deployment)
6. [Vercel Cron Configuration](#vercel-cron-configuration)
7. [Facebook App Setup](#facebook-app-setup)
8. [Testing](#testing)
9. [Production Checklist](#production-checklist)

---

## ✅ Prerequisites

Before starting, ensure you have:

- [ ] Google Account với access to Google Sheets
- [ ] Vercel account
- [ ] Facebook Developer account
- [ ] Node.js 18+ installed locally
- [ ] Git repository với Next.js project

---

## 📊 Google Sheets Setup

### Step 1: Create New Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Click **Blank** to create new spreadsheet
3. Rename to: `QUAN_SU_ADS_DATABASE`

### Step 2: Create Sheets

Create 4 sheets (tabs) với exact names:

#### Sheet 1: **DE_XUAT**

Headers (Row 1):
```
id | thoiGian_Tao | campaignId | tenCampaign | userId | uuTien | trangThai | hanhDong_Loai | hanhDong_GiaTri | phanTich_ChuyenGia | metrics_TruocKhi | nguoiDuyet | thoiGian_Duyet | ghiChu_NguoiDung | thoiGian_ThucThi | ketQua_ThucThi | giamSat_DenNgay | ketQua_CuoiCung
```

#### Sheet 2: **QUAN_SAT**

Headers (Row 1):
```
id | deXuatId | checkpoint_Ngay | thoiGian_QuanSat | campaignId | metrics_HienTai | metrics_TruocKhi | cpp_ThayDoi_Percent | roas_ThayDoi_Percent | danhGia | phanTich_AI | baiHoc
```

#### Sheet 3: **MAU_HOC_DUOC**

Headers (Row 1):
```
id | tenMau | dieuKien | hanhDong_KhuyenNghi | soLan_ApDung | soLan_ThanhCong | tyLe_ThanhCong | cpp_CaiThien_TB_Percent | roas_CaiThien_TB_Percent | doTinCay | capNhat_LanCuoi
```

#### Sheet 4: **TAI_KHOAN**

(This should already exist from previous setup)

Headers (Row 1):
```
email | name | avatar | plan | facebook_accessToken | facebook_adAccountId | created_at | last_login
```

### Step 3: Get Spreadsheet ID

From URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

Copy `SPREADSHEET_ID` - you'll need this for Apps Script.

---

## 🔧 Apps Script Deployment

### Step 1: Open Apps Script Editor

1. In Google Sheets, click **Extensions** → **Apps Script**
2. Delete default `Code.gs` content

### Step 2: Create API Files

Create following files in Apps Script:

#### File: `Code.gs`

```javascript
// Main entry point - DO NOT MODIFY
function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}
```

#### File: `Config.gs`

```javascript
// Configuration
const CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE', // Replace with your actual ID
  SHEETS: {
    DE_XUAT: 'DE_XUAT',
    QUAN_SAT: 'QUAN_SAT',
    MAU_HOC_DUOC: 'MAU_HOC_DUOC',
    TAI_KHOAN: 'TAI_KHOAN'
  }
};

function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}
```

#### File: `Router.gs`

```javascript
function handleRequest(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;
    
    // Parse body if POST
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    
    // Route to handlers
    switch(action) {
      case 'ghiDeXuat':
        return ghiDeXuat(body);
      case 'layDanhSachDeXuat':
        return layDanhSachDeXuat(params);
      case 'capNhatDeXuat':
        return capNhatDeXuat(body);
      case 'ghiQuanSat':
        return ghiQuanSat(body);
      case 'layQuanSatTheoDeXuat':
        return layQuanSatTheoDeXuat(params);
      case 'ghiMauHoc':
        return ghiMauHoc(body);
      case 'layDanhSachMauHoc':
        return layDanhSachMauHoc();
      default:
        return jsonResponse({ success: false, error: 'Invalid action' }, 400);
    }
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return jsonResponse({ success: false, error: error.toString() }, 500);
  }
}

function jsonResponse(data, statusCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

#### File: `DeXuatHandlers.gs`

```javascript
function ghiDeXuat(data) {
  const sheet = getSheet(CONFIG.SHEETS.DE_XUAT);
  
  const row = [
    data.id,
    data.thoiGian_Tao,
    data.campaignId,
    data.tenCampaign,
    data.userId,
    data.uuTien,
    data.trangThai,
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
  
  sheet.appendRow(row);
  
  return jsonResponse({ success: true, id: data.id });
}

function layDanhSachDeXuat(params) {
  const sheet = getSheet(CONFIG.SHEETS.DE_XUAT);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  let results = rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      let value = row[i];
      // Parse JSON fields
      if (header === 'hanhDong_GiaTri' || header === 'phanTich_ChuyenGia' || 
          header === 'metrics_TruocKhi' || header === 'ketQua_ThucThi') {
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
  
  // Filter by status if provided
  if (params.status && params.status !== 'ALL') {
    results = results.filter(r => r.trangThai === params.status);
  }
  
  return jsonResponse({ success: true, data: results });
}

function capNhatDeXuat(data) {
  const sheet = getSheet(CONFIG.SHEETS.DE_XUAT);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  // Find row by ID
  const idCol = 0; // Column A
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] === data.id) {
      // Update fields
      if (data.trangThai !== undefined) {
        sheet.getRange(i + 1, 7).setValue(data.trangThai);
      }
      if (data.nguoiDuyet) {
        sheet.getRange(i + 1, 12).setValue(data.nguoiDuyet);
      }
      if (data.thoiGian_Duyet) {
        sheet.getRange(i + 1, 13).setValue(data.thoiGian_Duyet);
      }
      if (data.ghiChu_NguoiDung) {
        sheet.getRange(i + 1, 14).setValue(data.ghiChu_NguoiDung);
      }
      if (data.thoiGian_ThucThi) {
        sheet.getRange(i + 1, 15).setValue(data.thoiGian_ThucThi);
      }
      if (data.ketQua_ThucThi) {
        sheet.getRange(i + 1, 16).setValue(JSON.stringify(data.ketQua_ThucThi));
      }
      if (data.giamSat_DenNgay) {
        sheet.getRange(i + 1, 17).setValue(data.giamSat_DenNgay);
      }
      if (data.ketQua_CuoiCung) {
        sheet.getRange(i + 1, 18).setValue(data.ketQua_CuoiCung);
      }
      
      return jsonResponse({ success: true });
    }
  }
  
  return jsonResponse({ success: false, error: 'Proposal not found' }, 404);
}
```

#### File: `QuanSatHandlers.gs`

```javascript
function ghiQuanSat(data) {
  const sheet = getSheet(CONFIG.SHEETS.QUAN_SAT);
  
  const row = [
    data.id || Utilities.getUuid(),
    data.deXuatId,
    data.checkpoint_Ngay,
    data.thoiGian_QuanSat,
    data.campaignId,
    JSON.stringify(data.metrics_HienTai || {}),
    JSON.stringify(data.metrics_TruocKhi || {}),
    data.cpp_ThayDoi_Percent || 0,
    data.roas_ThayDoi_Percent || 0,
    data.danhGia || '',
    JSON.stringify(data.phanTich_AI || {}),
    data.baiHoc || ''
  ];
  
  sheet.appendRow(row);
  
  return jsonResponse({ success: true, id: row[0] });
}

function layQuanSatTheoDeXuat(params) {
  const sheet = getSheet(CONFIG.SHEETS.QUAN_SAT);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const deXuatId = params.deXuatId;
  
  const results = rows
    .filter(row => row[1] === deXuatId) // Column B (deXuatId)
    .map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        let value = row[i];
        if (header === 'metrics_HienTai' || header === 'metrics_TruocKhi' || header === 'phanTich_AI') {
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
  
  return jsonResponse({ success: true, data: results });
}
```

#### File: `MauHocHandlers.gs`

```javascript
function ghiMauHoc(data) {
  const sheet = getSheet(CONFIG.SHEETS.MAU_HOC_DUOC);
  
  const row = [
    data.id || Utilities.getUuid(),
    data.tenMau || '',
    JSON.stringify(data.dieuKien || {}),
    JSON.stringify(data.hanhDong_KhuyenNghi || {}),
    data.soLan_ApDung || 1,
    data.soLan_ThanhCong || 0,
    data.tyLe_ThanhCong || 0,
    data.cpp_CaiThien_TB_Percent || 0,
    data.roas_CaiThien_TB_Percent || 0,
    data.doTinCay || 0,
    new Date().toISOString()
  ];
  
  sheet.appendRow(row);
  
  return jsonResponse({ success: true, id: row[0] });
}

function layDanhSachMauHoc() {
  const sheet = getSheet(CONFIG.SHEETS.MAU_HOC_DUOC);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const results = rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      let value = row[i];
      if (header === 'dieuKien' || header === 'hanhDong_KhuyenNghi') {
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
  
  return jsonResponse({ success: true, data: results });
}
```

### Step 3: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click gear icon ⚙️ → Select **Web app**
3. Settings:
   - **Description:** "Campaign Guardian API"
   - **Execute as:** Me (your email)
   - **Who has access:** Anyone
4. Click **Deploy**
5. **Copy the Web App URL** - you'll need this for `.env`

Format: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

---

## 🔐 Environment Variables

Create `.env.local` in project root:

```bash
# Google Sheets Apps Script
GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/{YOUR_DEPLOYMENT_ID}/exec

# Facebook API
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_API_VERSION=v18.0

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# NextAuth
NEXTAUTH_SECRET=your_random_secret_here # Generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000 # Change to production URL when deploying

# Environment
NODE_ENV=development
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

---

## 🚀 Vercel Deployment

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Add AI Campaign Guardian system"
git push origin main
```

### Step 2: Import to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./`
   - **Build Command:** `next build`
   - **Output Directory:** `.next`

### Step 3: Add Environment Variables

In Vercel project settings:

1. Go to **Settings** → **Environment Variables**
2. Add all variables from `.env.local`:
   - `GOOGLE_SHEETS_API_URL`
   - `FACEBOOK_APP_ID`
   - `FACEBOOK_APP_SECRET`
   - `GEMINI_API_KEY`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (set to your production URL)

3. Select environments: **Production**, **Preview**, **Development**

### Step 4: Deploy

1. Click **Deploy**
2. Wait for build to complete
3. Access your production URL: `https://your-app.vercel.app`

---

## ⏰ Vercel Cron Configuration

### Step 1: Create `vercel.json`

In project root:

```json
{
  "crons": [
    {
      "path": "/api/giam-sat/kiem-tra",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Schedule Format:** Cron expression
- `0 0 * * *` = Daily at 00:00 UTC
- `0 */6 * * *` = Every 6 hours
- `0 0 * * 1` = Every Monday at 00:00

### Step 2: Deploy

```bash
git add vercel.json
git commit -m "Add cron job for monitoring"
git push origin main
```

Vercel will auto-deploy and enable cron.

### Step 3: Verify Cron

1. Go to Vercel Dashboard → Your Project
2. Click **Settings** → **Cron Jobs**
3. Verify job is listed and enabled

### Step 4: Test Manually

```bash
curl -X POST https://your-app.vercel.app/api/giam-sat/kiem-tra
```

---

## 📱 Facebook App Setup

### Step 1: Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com)
2. Click **My Apps** → **Create App**
3. Choose **Business** type
4. Fill details:
   - **App Name:** Quân Sư ADS
   - **Contact Email:** your@email.com

### Step 2: Add Marketing API

1. In app dashboard, click **Add Product**
2. Find **Marketing API** → Click **Set Up**
3. Follow setup wizard

### Step 3: Get Access Token

For testing:
1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer)
2. Select your app
3. Request permissions:
   - `ads_management`
   - `ads_read`
   - `business_management`
4. **Generate Access Token**
5. Click **Get User Access Token**
6. Copy token

**Production:** Implement OAuth flow for users to connect their accounts.

### Step 4: Store in TAI_KHOAN Sheet

Add row:
```
email | name | avatar | plan | facebook_accessToken | facebook_adAccountId | created_at | last_login
user@example.com | John | url | free | YOUR_ACCESS_TOKEN | act_123456789 | 2026-02-05 | 2026-02-05
```

---

## 🧪 Testing

### Test 1: Create Proposal

```bash
curl -X POST https://your-app.vercel.app/api/de-xuat/tao-moi \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "123456789",
    "startDate": "2026-02-01",
    "endDate": "2026-02-05",
    "accountId": "act_123"
  }'
```

Expected: `{ success: true, data: { deXuatId: "..." } }`

### Test 2: List Proposals

```bash
curl https://your-app.vercel.app/api/de-xuat/danh-sach?status=CHO_DUYET
```

### Test 3: Monitoring

```bash
curl -X POST https://your-app.vercel.app/api/giam-sat/kiem-tra
```

---

## ✅ Production Checklist

Before going live:

- [ ] Google Sheets with 4 sheets created
- [ ] Apps Script deployed as Web App
- [ ] All environment variables set in Vercel
- [ ] Vercel cron job configured and enabled
- [ ] Facebook App created + Access tokens stored
- [ ] Test all API endpoints
- [ ] Verify cron job runs successfully
- [ ] Set up error monitoring (Sentry/LogRocket)
- [ ] Review security: CORS, auth, rate limiting
- [ ] Backup Google Sheets data regularly

---

## 🔒 Security Notes

1. **Never commit `.env.local`** to Git
2. **Rotate access tokens** regularly (every 60 days)
3. **Use long-lived tokens** for production (not Graph Explorer tokens)
4. **Implement rate limiting** on API endpoints
5. **Validate all inputs** server-side
6. **Use HTTPS only** in production

---

## 📞 Support

If you encounter issues:
- Check Vercel logs: `vercel logs`
- Check Apps Script logs: Apps Script Editor → **Executions**
- Review Facebook API errors in response
- Test APIs independently

---

**Setup Complete!** 🎉

Your AI Campaign Guardian system is ready to use.

Next: [Testing Guide](./TESTING_GUIDE.md)
