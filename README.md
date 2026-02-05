# 🤖 AI Campaign Guardian

**Hệ thống tự động phân tích, đề xuất và giám sát Facebook Ads campaigns với AI Multi-Agent**

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-orange)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green)]()

---

## ✨ Tính năng

### 🧠 AI Multi-Agent System
- **5 chuyên gia AI** phân tích độc lập:
  - Chiến Lược (Strategist)
  - Hiệu Suất (Performance Analyst)
  - Nội Dung (Creative Analyst)
  - Thực Thi (Execution Manager)
  - Kiểm Định (QA Auditor)

### 📊 Auto-Monitoring
- Theo dõi kết quả tại **D+1, D+3, D+7**
- So sánh metrics before/after
- Đánh giá thành công/thất bại
- Timeline visualization

### 🎯 Priority Queue
- **NGUY_CẤP**: Cần xử lý ngay (đang burn tiền)
- **CAO**: Xử lý trong 24h
- **TRUNG_BÌNH**: Xử lý trong tuần
- **THẤP**: Tham khảo, không cấp thiết

### 🔄 Learning Loop
- Tự động học từ successes
- Extract patterns
- Reference history cho proposals mới
- AI confidence tăng theo thời gian

### ⚡ Facebook API Integration
- Pause/Unpause campaigns
- Budget adjustments
- Safe execution với validation
- Real-time metrics fetch

---

## 🏗️ Kiến trúc

```
┌─────────────────────────────────────────────────────┐
│                  DASHBOARD UI                        │
│     Overview | Proposals Inbox | Monitoring          │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│              NEXT.JS API ROUTES                      │
│   /tao-moi | /duyet | /thuc-thi | /kiem-tra        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│         AI MULTI-AGENT ORCHESTRATOR                  │
│    5 Agents → Parallel Analysis → Consensus          │
└─────────────────────────────────────────────────────┘
        ↓                              ↓
┌──────────────────┐      ┌───────────────────────┐
│  GOOGLE SHEETS   │      │   FACEBOOK GRAPH API  │
│  (Database)      │      │   (Execution)         │
└──────────────────┘      └───────────────────────┘
```

---

## 🚀 Quick Start

### Requirements
- Node.js 18+
- Google Account (Sheets + Gemini AI)
- Facebook Developer Account
- Vercel Account (for deployment)

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd tho-ads-ai

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
```

Visit: http://localhost:3000

### Configuration

See: [Quick Start Guide](./docs/QUICK_START.md)

---

## 📚 Documentation

- **[Quick Start](./docs/QUICK_START.md)** - Get running in 15 minutes
- **[Complete Documentation](./docs/AI_CAMPAIGN_GUARDIAN.md)** - Full system guide
- **[Setup & Deployment](./docs/SETUP_GUIDE.md)** - Production setup
- **[Testing Guide](./docs/TESTING_GUIDE.md)** - Unit & E2E tests

---

## 🎯 Workflow

```
1. USER → Click "Tạo đề xuất AI" on campaign
         ↓
2. 5 AI Agents analyze (30-60s)
         ↓
3. Proposal created → Status: CHO_DUYET
         ↓
4. USER → Review → Approve/Reject
         ↓
5. Execute → Facebook API → Campaign paused/budget changed
         ↓
6. Daily Cron → Monitor D+1, D+3, D+7
         ↓
7. QA Auditor → Evaluate → Extract patterns
         ↓
8. Learn → Reference for future proposals
```

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, React
- **Backend**: Next.js API Routes
- **Database**: Google Sheets (via Apps Script)
- **AI**: Google Gemini 1.5 Pro
- **Integration**: Facebook Graph API v18.0
- **Deployment**: Vercel
- **Cron**: Vercel Cron Jobs

---

## 📊 Key Metrics

### Performance
- **Proposal Creation**: 30-60s (5 AI agents parallel)
- **API Response**: <3s average
- **Monitoring Cron**: Daily at 00:00 UTC

### Success Metrics
- **Pattern Extraction**: From D+7 successful proposals
- **Learning Rate**: Continuous improvement
- **AI Confidence**: Increases with more data

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# Coverage
npm run test:coverage

# E2E tests (Playwright)
npx playwright test

# Watch mode
npm run test:watch
```

See: [Testing Guide](./docs/TESTING_GUIDE.md)

---

## 📁 Project Structure

```
tho-ads-ai/
├── src/
│   ├── app/
│   │   ├── dashboard/          # Main dashboard
│   │   │   ├── page.tsx
│   │   │   ├── proposals/page.tsx
│   │   │   └── monitoring/page.tsx
│   │   └── api/
│   │       ├── de-xuat/        # Proposals APIs
│   │       └── giam-sat/       # Monitoring APIs
│   ├── components/
│   │   ├── HopThuDeXuat.tsx    # Proposals inbox
│   │   ├── TheDeXuat.tsx       # Proposal card
│   │   ├── BangGiamSat.tsx     # Monitoring dashboard
│   │   └── ...
│   └── lib/
│       ├── ai/                 # 5 AI agents
│       ├── sheets/             # Google Sheets helpers
│       ├── facebook/           # Facebook API client
│       ├── monitoring/         # Monitoring helpers
│       └── de-xuat/            # Proposal types & utils
├── docs/                       # Documentation
├── e2e/                        # E2E tests
└── __tests__/                  # Unit tests
```

---

## 🔐 Security

- ✅ Environment variables for secrets
- ✅ NextAuth.js for authentication
- ✅ Server-side validation
- ✅ HTTPS only in production
- ✅ Rate limiting on APIs
- ✅ Access token rotation (60 days)

---

## 🐛 Troubleshooting

### Common Issues

**Proposal creation fails**
- Check Gemini API key validity
- Verify Google Sheets URL correct
- Review Vercel logs: `vercel logs`

**Facebook execution fails**
- Verify access token in TAI_KHOAN sheet
- Check campaign permissions
- Ensure campaign is ACTIVE

**Monitoring not running**
- Check Vercel Cron enabled
- Manually trigger: `POST /api/giam-sat/kiem-tra`
- Review cron logs in Vercel dashboard

See: [Full Troubleshooting Guide](./docs/AI_CAMPAIGN_GUARDIAN.md#troubleshooting)

---

## 🗺️ Roadmap

### V1.0 (Current) ✅
- ✅ AI Multi-Agent analysis
- ✅ Proposal management
- ✅ Facebook API execution
- ✅ D+1/D+3/D+7 monitoring
- ✅ Learning loop
- ✅ Full UI dashboard

### V1.1 (Planned)
- [ ] Email notifications
- [ ] Slack integration
- [ ] Advanced pattern matching
- [ ] Multi-account support
- [ ] Custom AI prompts
- [ ] Export reports (PDF/Excel)

### V2.0 (Future)
- [ ] A/B testing automation
- [ ] Creative optimization
- [ ] Budget optimization ML
- [ ] Mobile app
- [ ] White-label solution

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details

---

## 👥 Authors

**Quân Sư ADS Development Team**
- AI Architecture: Campaign Guardian System
- Built with ❤️ for Facebook Ads optimization

---

## 📞 Support

- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Email**: support@quan-su-ads.com

---

## 🙏 Acknowledgments

- **Google Gemini AI** - Powering multi-agent analysis
- **Facebook Graph API** - Campaign automation
- **Vercel** - Hosting & deployment
- **Next.js** - Framework excellence

---

<div align="center">

**Made with 🤖 AI + ❤️ Human Intelligence**

[Documentation](./docs/AI_CAMPAIGN_GUARDIAN.md) • [Quick Start](./docs/QUICK_START.md) • [API Reference](./docs/AI_CAMPAIGN_GUARDIAN.md#api-endpoints)

</div>
