# AI CAMPAIGN GUARDIAN - Complete Documentation

**Version:** 1.0  
**Created:** 2026-02-05  
**Author:** Quân Sư ADS Development Team

---

## 📋 Mục lục

1. [Tổng quan](#tổng-quan)
2. [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
3. [AI Multi-Agent System](#ai-multi-agent-system)
4. [Workflow](#workflow)
5. [API Endpoints](#api-endpoints)
6. [Database Schema](#database-schema)
7. [UI Components](#ui-components)
8. [Setup & Deployment](#setup--deployment)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Tổng quan

### Mục đích
AI Campaign Guardian là hệ thống tự động phân tích, đề xuất và giám sát chiến dịch Facebook Ads. Hệ thống sử dụng 5 AI agents chuyên biệt để đưa ra khuyến nghị chính xác, thực thi qua Facebook API, và học hỏi từ kết quả.

### Đặc điểm chính
- ✅ **AI Multi-Agent Analysis**: 5 chuyên gia AI phân tích độc lập
- ✅ **Auto-Execution**: Thực thi hành động qua Facebook API
- ✅ **Monitoring Loop**: Theo dõi D+1, D+3, D+7
- ✅ **Learning System**: Học từ successes, tạo patterns
- ✅ **Priority Queue**: Xử lý theo mức độ khẩn cấp

### Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, React
- **Backend**: Next.js API Routes
- **Database**: Google Sheets (via Apps Script API)
- **AI**: Google Gemini 1.5 Pro
- **Integration**: Facebook Graph API
- **Deployment**: Vercel

---

## 🏗️ Kiến trúc hệ thống

### High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                  USER DASHBOARD                      │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐     │
│  │ Overview │  │ Proposals │  │  Monitoring  │     │
│  └──────────┘  └───────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│              NEXT.JS API ROUTES                      │
│  ┌─────────────┐  ┌──────────┐  ┌─────────────┐   │
│  │ /tao-moi    │  │ /duyet   │  │ /thuc-thi  │   │
│  │ /danh-sach  │  │ /tu-choi │  │ /kiem-tra  │   │
│  └─────────────┘  └──────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│           AI MULTI-AGENT SYSTEM                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │Strategist│  │Performance│ │ Creative │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│  ┌──────────┐  ┌──────────┐                        │
│  │Execution │  │QA Auditor│                        │
│  └──────────┘  └──────────┘                        │
└─────────────────────────────────────────────────────┘
          ↓                            ↓
┌──────────────────┐      ┌───────────────────────┐
│  GOOGLE SHEETS   │      │   FACEBOOK GRAPH API  │
│  - DE_XUAT       │      │   - Campaign Actions  │
│  - QUAN_SAT      │      │   - Metrics Fetch     │
│  - MAU_HOC_DUOC  │      │   - Status Updates    │
│  - TAI_KHOAN     │      └───────────────────────┘
└──────────────────┘
```

### Data Flow

```
1. CREATE PROPOSAL
   User → Dashboard → Click "Tạo đề xuất AI"
   → API /tao-moi
   → Multi-Agent Analysis (5 agents parallel)
   → Save to DE_XUAT sheet
   → Return proposal ID

2. REVIEW & APPROVE
   User → /dashboard/proposals
   → View proposals (priority queue)
   → Click "Duyệt" or "Từ chối"
   → API /duyet or /tu-choi
   → Update status in sheet

3. EXECUTE ACTION
   User → Click "Thực thi"
   → API /thuc-thi
   → Validate + Call Facebook API
   → Update campaign (pause/budget change)
   → Status → DANG_GIAM_SAT

4. MONITORING LOOP (Daily Cron)
   Vercel Cron → API /kiem-tra
   → Find DANG_GIAM_SAT proposals
   → Check checkpoint (D+1/D+3/D+7)
   → Fetch current metrics
   → Compare before/after
   → Call QA Auditor
   → Save observation to QUAN_SAT
   → If D+7: Extract pattern → MAU_HOC_DUOC

5. LEARNING
   Future proposals → Reference patterns
   → AI confidence ↑ when match
   → Continuous improvement
```

---

## 🤖 AI Multi-Agent System

### 1. Chiến Lược (Strategist)
**Role:** Long-term strategic analysis  
**Input:** Campaign metrics, historical data  
**Output:**
```typescript
{
  tenChuyenGia: 'CHIEN_LUOC',
  nhanDinh: 'Campaign đang trong giai đoạn suy giảm hiệu suất...',
  duLieuHoTro: {
    xuHuong: 'SUY_GIAM',
    soNgay_ChayLienTuc: 45,
    doiBacKhachHang: 'MATURE'
  },
  doTinCay: 0.85
}
```

### 2. Hiệu Suất (Performance Analyst)
**Role:** Deep metrics analysis  
**Input:** CPP, ROAS, CTR trends  
**Output:**
```typescript
{
  tenChuyenGia: 'HIEU_SUAT',
  nhanDinh: 'CPP tăng 40% trong 7 ngày, vượt ngưỡng cảnh báo',
  duLieuHoTro: {
    cpp_Average: 285000,
    cpp_Threshold: 200000,
    phanTram_ThayDoi: 42.5,
    mucDoCanhBao: 'NGUY_CAP'
  },
  doTinCay: 0.95
}
```

### 3. Nội Dung (Creative Analyst)
**Role:** Ad creative evaluation  
**Input:** Frequency, engagement, creative age  
**Output:**
```typescript
{
  tenChuyenGia: 'NOI_DUNG',
  nhanDinh: 'Creative đã chạy 30 ngày, có dấu hiệu ad fatigue',
  duLieuHoTro: {
    tanSuat_Average: 3.2,
    ngayChay: 30,
    ctr_GiamDan: true
  },
  doTinCay: 0.78
}
```

### 4. Thực Thi (Execution Manager)
**Role:** Actionable recommendations  
**Input:** All agents' insights  
**Output:**
```typescript
{
  tenChuyenGia: 'THUC_THI',
  nhanDinh: 'Khuyến nghị TẠM DỪNG campaign để tránh burn tiền',
  duLieuHoTro: {
    hanhDong: {
      loai: 'TAM_DUNG',
      lyDo: 'CPP cao + creative fatigue + ROAS thấp',
      ketQua_KyVong: 'Dừng burn, đợi creative mới'
    },
    uuTien: 'NGUY_CAP'
  },
  doTinCay: 0.90
}
```

### 5. Kiểm Định (QA Auditor)
**Role:** Post-execution evaluation  
**Input:** Metrics before/after, days passed  
**Output:**
```typescript
{
  danhGia: 'THANH_CONG',
  phanTich: 'CPP giảm 25%, ROAS tăng 15% sau khi pause',
  baiHocRutRa: {
    moTa: 'Pause campaign khi CPP > 250k + Ad fatigue',
    dieuKien: 'CPP > 250k, Frequency > 3, CTR giảm',
    ketQua: 'Cải thiện 20-30% khi restart với creative mới'
  }
}
```

---

## 🔄 Workflow

### Phase 1: Proposal Creation

```typescript
// User clicks "Tạo đề xuất AI"
POST /api/de-xuat/tao-moi
{
  campaignId: "123456789",
  startDate: "2026-02-01",
  endDate: "2026-02-05",
  accountId: "act_123"
}

// Backend workflow:
1. Fetch campaign metrics từ Facebook
2. Spawn 5 AI agents (parallel)
3. Each agent analyzes independently
4. Orchestrator combines insights
5. Execution Manager creates action plan
6. Save proposal to DE_XUAT sheet
   - Status: CHO_DUYET
   - Priority: NGUY_CAP/CAO/TRUNG_BINH/THAP
7. Return proposal ID

// Response:
{
  success: true,
  data: {
    deXuatId: "uuid-123",
    uuTien: "NGUY_CAP",
    tomTat: "Campaign cần TẠM DỪNG ngay"
  }
}
```

### Phase 2: Review & Approval

```typescript
// User navigates to /dashboard/proposals
GET /api/de-xuat/danh-sach?status=CHO_DUYET

// View proposals sorted by priority
// Click "Duyệt" or "Từ chối"

// APPROVE:
POST /api/de-xuat/duyet
{
  deXuatId: "uuid-123",
  ghiChu: "Đồng ý, CPP quá cao"
}
// → Status: DA_DUYET

// REJECT:
POST /api/de-xuat/tu-choi
{
  deXuatId: "uuid-123",
  lyDo: "Cần thêm thời gian quan sát"
}
// → Status: BI_TU_CHOI
```

### Phase 3: Execution

```typescript
// User clicks "Thực thi"
POST /api/de-xuat/thuc-thi
{
  deXuatId: "uuid-123"
}

// Backend workflow:
1. Validate proposal (must be DA_DUYET)
2. Get action details
3. Call Facebook Graph API:
   - TAM_DUNG → Update campaign status: PAUSED
   - THAY_DOI_NGAN_SACH → Update daily_budget
4. Save execution result
5. Update status → DANG_GIAM_SAT
6. Set giamSat_DenNgay = today + 7 days

// Response:
{
  success: true,
  data: {
    thanhCong: true,
    thongDiep: "Campaign đã được pause",
    thoiGian_ThucThi: "2026-02-05T10:00:00Z"
  }
}
```

### Phase 4: Monitoring (Daily Cron)

```typescript
// Vercel Cron triggers daily at 00:00 UTC
POST /api/giam-sat/kiem-tra

// Backend workflow:
For each DANG_GIAM_SAT proposal:
  1. Check if reached checkpoint (D+1/D+3/D+7)
  2. If yes:
     - Fetch current metrics from Facebook
     - Compare with metrics_TruocKhi
     - Calculate % changes
     - Call QA Auditor for evaluation
     - Save observation to QUAN_SAT
  3. If D+7:
     - Extract pattern if THANH_CONG
     - Save to MAU_HOC_DUOC
     - Update status → HOAN_THANH

// Response:
{
  success: true,
  data: {
    processed: 12,
    observations_created: 8,
    patterns_extracted: 3,
    errors: []
  }
}
```

---

## 🔌 API Endpoints

### 1. POST /api/de-xuat/tao-moi
**Purpose:** Tạo đề xuất AI mới  
**Auth:** Required (session)  
**Body:**
```typescript
{
  campaignId: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;
  accountId: string;
}
```
**Response:**
```typescript
{
  success: boolean;
  data?: {
    deXuatId: string;
    uuTien: MucDoUuTien;
    tomTat: string;
  };
  error?: string;
}
```

### 2. GET /api/de-xuat/danh-sach
**Purpose:** Lấy danh sách đề xuất  
**Query Params:**
- `status`: CHO_DUYET | DA_DUYET | BI_TU_CHOI | DANG_GIAM_SAT | HOAN_THANH | ALL
- `priority`: NGUY_CAP | CAO | TRUNG_BINH | THAP
- `limit`: number (default 50)

**Response:**
```typescript
{
  success: boolean;
  data?: DeXuat[];
  error?: string;
}
```

### 3. POST /api/de-xuat/duyet
**Purpose:** Duyệt đề xuất  
**Body:**
```typescript
{
  deXuatId: string;
  ghiChu?: string;
}
```

### 4. POST /api/de-xuat/tu-choi
**Purpose:** Từ chối đề xuất  
**Body:**
```typescript
{
  deXuatId: string;
  lyDo: string;
}
```

### 5. POST /api/de-xuat/thuc-thi
**Purpose:** Thực thi hành động qua Facebook API  
**Body:**
```typescript
{
  deXuatId: string;
}
```

### 6. POST /api/giam-sat/kiem-tra
**Purpose:** Monitoring cron job (daily)  
**Auth:** None (called by Vercel Cron)  
**Body:** None  
**Response:**
```typescript
{
  success: boolean;
  data: {
    processed: number;
    observations_created: number;
    patterns_extracted: number;
    errors: string[];
  };
}
```

---

## 📊 Database Schema (Google Sheets)

### Sheet 1: DE_XUAT

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Unique proposal ID |
| thoiGian_Tao | ISO DateTime | Creation time |
| campaignId | String | Facebook Campaign ID |
| tenCampaign | String | Campaign name |
| userId | String | User email |
| uuTien | Enum | NGUY_CAP/CAO/TRUNG_BINH/THAP |
| trangThai | Enum | CHO_DUYET/DA_DUYET/BI_TU_CHOI/DA_THUC_THI/DANG_GIAM_SAT/HOAN_THANH |
| hanhDong_Loai | Enum | TAM_DUNG/THAY_DOI_NGAN_SACH/LAM_MOI_CREATIVE/... |
| hanhDong_GiaTri | JSON | Action details |
| phanTich_ChuyenGia | JSON | 5 agents insights |
| metrics_TruocKhi | JSON | Metrics snapshot |
| nguoiDuyet | String | Approver email |
| thoiGian_Duyet | ISO DateTime | Approval time |
| ghiChu_NguoiDung | String | User notes |
| thoiGian_ThucThi | ISO DateTime | Execution time |
| ketQua_ThucThi | JSON | Facebook API response |
| giamSat_DenNgay | Date | D+7 date |
| ketQua_CuoiCung | Enum | CAI_THIEN/TRUNG_TINH/XAU_DI |

### Sheet 2: QUAN_SAT

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Observation ID |
| deXuatId | UUID | Foreign key to DE_XUAT |
| checkpoint_Ngay | Enum | 1/3/7 |
| thoiGian_QuanSat | ISO DateTime | Observation time |
| campaignId | String | Facebook Campaign ID |
| metrics_HienTai | JSON | Current metrics |
| metrics_TruocKhi | JSON | Before metrics |
| cpp_ThayDoi_Percent | Number | % change |
| roas_ThayDoi_Percent | Number | % change |
| danhGia | Enum | CAI_THIEN/TRUNG_TINH/XAU_DI |
| phanTich_AI | JSON | QA Auditor analysis |
| baiHoc | String | Learnings |

### Sheet 3: MAU_HOC_DUOC

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Pattern ID |
| tenMau | String | Pattern name |
| dieuKien | JSON | Match conditions |
| hanhDong_KhuyenNghi | JSON | Recommended action |
| soLan_ApDung | Number | Times applied |
| soLan_ThanhCong | Number | Success count |
| tyLe_ThanhCong | Number | Success rate (0-1) |
| cpp_CaiThien_TB_Percent | Number | Avg CPP improvement |
| roas_CaiThien_TB_Percent | Number | Avg ROAS improvement |
| doTinCay | Number | Confidence (0-1) |
| capNhat_LanCuoi | ISO DateTime | Last updated |

### Sheet 4: TAI_KHOAN
(Existing - no changes needed)

---

## 🎨 UI Components

### 1. HopThuDeXuat (Proposals Inbox)
**Path:** `/components/HopThuDeXuat.tsx`  
**Props:**
```typescript
{ userId: string }
```
**Features:**
- Fetch proposals by status
- Priority queue display
- Expandable cards với 4 agents insights
- Actions: Duyệt, Từ chối, Thực thi

### 2. TheDeXuat (Proposal Card)
**Path:** `/components/TheDeXuat.tsx`  
**Props:**
```typescript
{
  deXuat: DeXuat;
  onApprove: () => void;
  onReject: () => void;
  onExecute: () => void;
}
```
**Features:**
- Compact + Expanded view
- 4 AI agents tabs
- Action buttons
- Status badges

### 3. BangGiamSat (Monitoring Dashboard)
**Path:** `/components/BangGiamSat.tsx`  
**Props:**
```typescript
{ userId: string }
```
**Features:**
- Timeline D+1 → D+3 → D+7
- Progress indicators
- Metrics comparison
- Status tracking

### 4. CampaignDetailPanel
**Modified:** Added "🤖 Tạo đề xuất AI" button  
**Features:**
- Create proposal from panel
- Success message toast
- Loading state

---

## ⚙️ Setup & Deployment

See: [SETUP_GUIDE.md](./SETUP_GUIDE.md)

---

## 🧪 Testing

See: [TESTING_GUIDE.md](./TESTING_GUIDE.md)

---

## 🐛 Troubleshooting

### Issue: Proposals không được tạo
**Symptoms:** API returns error  
**Solutions:**
1. Check Google Sheets credentials
2. Verify DE_XUAT sheet exists với correct headers
3. Check Gemini AI API key
4. Review logs: `vercel logs`

### Issue: Facebook API execution fails
**Symptoms:** "Thực thi thất bại"  
**Solutions:**
1. Verify Facebook access token (trong TAI_KHOAN sheet)
2. Check campaign permissions
3. Ensure campaign status is ACTIVE before pause
4. Review Facebook API error in logs

### Issue: Monitoring cron không chạy
**Symptoms:** Observations không được tạo  
**Solutions:**
1. Check Vercel Cron config in `vercel.json`
2. Verify cron is enabled in Vercel dashboard
3. Manually trigger: `POST /api/giam-sat/kiem-tra`
4. Check logs for errors

### Issue: AI analysis quá chậm
**Symptoms:** >60s để tạo proposal  
**Solutions:**
1. Agents chạy parallel (should be 30-45s)
2. Check Gemini API rate limits
3. Consider caching Facebook metrics

---

## 📚 Additional Resources

- [Facebook Graph API Docs](https://developers.facebook.com/docs/graph-api)
- [Google Gemini API](https://ai.google.dev/docs)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

---

## 📞 Support

For issues or questions:
- GitHub: [Repository Issues]
- Email: support@quan-su-ads.com
- Slack: #campaign-guardian

---

**Last Updated:** 2026-02-05  
**Version:** 1.0.0  
**Status:** Production Ready ✅
