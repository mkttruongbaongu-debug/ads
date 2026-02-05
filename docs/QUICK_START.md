# Quick Start Guide - AI Campaign Guardian

**Get started in 15 minutes** ⚡

---

## 🚀 Quick Setup (Development)

### 1. Clone & Install
```bash
cd tho-ads-ai
npm install
```

### 2. Environment Variables
Create `.env.local`:
```bash
GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/YOUR_ID/exec
GEMINI_API_KEY=your_gemini_key
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
```

### 3. Google Sheets
1. Create spreadsheet: `QUAN_SU_ADS_DATABASE`
2. Add 4 sheets: `DE_XUAT`, `QUAN_SAT`, `MAU_HOC_DUOC`, `TAI_KHOAN`
3. Deploy Apps Script (see [SETUP_GUIDE.md](./SETUP_GUIDE.md))
4. Copy Web App URL → `GOOGLE_SHEETS_API_URL`

### 4. Run Development Server
```bash
npm run dev
```

Visit: http://localhost:3000

---

## 📝 Usage Flow

### Step 1: Create Proposal
1. Login to dashboard
2. Click any campaign card
3. Click **🤖 Tạo đề xuất AI** button
4. Wait 30-60s for AI analysis
5. Success! ✅

### Step 2: Review Proposal
1. Click **📋 Đề xuất** (badge shows count)
2. View proposals sorted by priority
3. Click to expand → See 4 AI agents insights
4. Decision:
   - **Duyệt** → Approve
   - **Từ chối** → Reject

### Step 3: Execute Action
1. Approved proposal → Click **Thực thi**
2. Confirm → Facebook API called
3. Campaign paused/budget changed
4. Status → DANG_GIAM_SAT

### Step 4: Monitor Results
1. Click **👁️ Giám sát**
2. View timeline: D+1 → D+3 → D+7
3. Daily cron auto-collects observations
4. D+7: AI evaluates success/fail
5. Learn from patterns

---

## 🎯 Key Features

### AI Multi-Agent System
- **5 Specialists** analyze independently
- **Strategist**: Long-term trends
- **Performance**: Deep metrics
- **Creative**: Ad fatigue detection
- **Execution**: Actionable plans
- **QA Auditor**: Post-execution evaluation

### Priority Queue
Auto-prioritize by urgency:
- 🚨 **NGUY_CẤP**: Immediate (burning money)
- 🟠 **CAO**: Within 24 hours
- 🟡 **TRUNG_BÌNH**: Within a week
- 🟢 **THẤP**: Nice to have

### Auto-Monitoring
- **D+1**: First checkpoint
- **D+3**: Mid-point check
- **D+7**: Final evaluation + learning

### Learning Loop
- Success patterns extracted
- Future proposals reference history
- AI confidence ↑ over time

---

## 📊 Dashboard Navigation

```
/dashboard
├─ Main: Campaign overview
├─ /proposals: Manage proposals (filter, approve, execute)
└─ /monitoring: Track results (D+1/D+3/D+7 timeline)
```

---

## 🔧 Common Tasks

### Create Proposal Manually
```bash
curl -X POST http://localhost:3000/api/de-xuat/tao-moi \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "123456789",
    "startDate": "2026-02-01",
    "endDate": "2026-02-05",
    "accountId": "act_123"
  }'
```

### List Pending Proposals
```bash
curl http://localhost:3000/api/de-xuat/danh-sach?status=CHO_DUYET
```

### Trigger Monitoring
```bash
curl -X POST http://localhost:3000/api/giam-sat/kiem-tra
```

---

## 📚 Documentation

- **[Full Documentation](./AI_CAMPAIGN_GUARDIAN.md)**: Complete system guide
- **[Setup Guide](./SETUP_GUIDE.md)**: Production deployment
- **[Testing Guide](./TESTING_GUIDE.md)**: Unit & E2E tests

---

## ❓ Troubleshooting

### "Proposal creation failed"
→ Check Gemini API key & Google Sheets URL

### "Facebook execution failed"
→ Verify access token in TAI_KHOAN sheet

### "No observations created"
→ Check Vercel Cron is enabled

### "AI analysis slow (>2 min)"
→ Normal for first request (cold start). Subsequent: 30-45s

---

## 🎉 You're Ready!

Your AI Campaign Guardian is now running.

**Next Steps:**
1. Test with a real campaign
2. Review first proposal
3. Execute and monitor
4. Check results after D+7

For production deployment: [SETUP_GUIDE.md](./SETUP_GUIDE.md)

---

**Happy Optimizing!** 🚀💰
