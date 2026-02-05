# Testing Guide - AI Campaign Guardian

**Version:** 1.0  
**Last Updated:** 2026-02-05

---

## 📋 Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Unit Tests](#unit-tests)
3. [Integration Tests](#integration-tests)
4. [E2E Tests](#e2e-tests)
5. [Manual Testing Checklist](#manual-testing-checklist)
6. [Running Tests](#running-tests)

---

## 🎯 Testing Strategy

### Test Pyramid

```
        ╱────╲
       ╱  E2E  ╲
      ╱──────────╲
     ╱ Integration ╲
    ╱────────────────╲
   ╱   Unit Tests      ╲
  ╱──────────────────────╲
```

- **Unit Tests (70%)**: Functions, utilities, helpers
- **Integration Tests (20%)**: API routes, database interactions
- **E2E Tests (10%)**: Critical user flows

---

## 🧪 Unit Tests

### Setup

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
npm install --save-dev @testing-library/user-event
```

**jest.config.js:**
```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

module.exports = createJestConfig(customJestConfig)
```

**jest.setup.js:**
```javascript
import '@testing-library/jest-dom'
```

### Test 1: Checkpoint Calculator

**File:** `src/lib/monitoring/__tests__/checkpoint-calculator.test.ts`

```typescript
import {
  calculateCheckpoint,
  hasReachedCheckpoint,
  getAllPassedCheckpoints,
  getNextCheckpoint,
  daysUntilNextCheckpoint,
} from '../checkpoint-calculator';

describe('Checkpoint Calculator', () => {
  describe('calculateCheckpoint', () => {
    it('should return null if less than 1 day passed', () => {
      const executedDate = new Date();
      executedDate.setHours(executedDate.getHours() - 12);
      
      const result = calculateCheckpoint(executedDate.toISOString());
      expect(result).toBeNull();
    });

    it('should return D1 if 1 day passed', () => {
      const executedDate = new Date();
      executedDate.setDate(executedDate.getDate() - 1);
      
      const result = calculateCheckpoint(executedDate.toISOString());
      expect(result).toBe('D1');
    });

    it('should return D3 if 3 days passed', () => {
      const executedDate = new Date();
      executedDate.setDate(executedDate.getDate() - 3);
      
      const result = calculateCheckpoint(executedDate.toISOString());
      expect(result).toBe('D3');
    });

    it('should return D7 if 7+ days passed', () => {
      const executedDate = new Date();
      executedDate.setDate(executedDate.getDate() - 10);
      
      const result = calculateCheckpoint(executedDate.toISOString());
      expect(result).toBe('D7');
    });
  });

  describe('hasReachedCheckpoint', () => {
    it('should return true for D1 after 1 day', () => {
      const executedDate = new Date();
      executedDate.setDate(executedDate.getDate() - 2);
      
      const result = hasReachedCheckpoint(executedDate.toISOString(), 'D1');
      expect(result).toBe(true);
    });

    it('should return false for D3 after only 2 days', () => {
      const executedDate = new Date();
      executedDate.setDate(executedDate.getDate() - 2);
      
      const result = hasReachedCheckpoint(executedDate.toISOString(), 'D3');
      expect(result).toBe(false);
    });
  });

  describe('getAllPassedCheckpoints', () => {
    it('should return [D1, D3] after 5 days', () => {
      const executedDate = new Date();
      executedDate.setDate(executedDate.getDate() - 5);
      
      const result = getAllPassedCheckpoints(executedDate.toISOString());
      expect(result).toEqual(['D1', 'D3']);
    });

    it('should return all checkpoints after 7+ days', () => {
      const executedDate = new Date();
      executedDate.setDate(executedDate.getDate() - 10);
      
      const result = getAllPassedCheckpoints(executedDate.toISOString());
      expect(result).toEqual(['D1', 'D3', 'D7']);
    });
  });

  describe('getNextCheckpoint', () => {
    it('should return D1 if no checkpoints recorded', () => {
      const executedDate = new Date();
      executedDate.setDate(executedDate.getDate() - 2);
      
      const result = getNextCheckpoint(executedDate.toISOString(), []);
      expect(result).toBe('D1');
    });

    it('should return D3 if D1 already recorded', () => {
      const executedDate = new Date();
      executedDate.setDate(executedDate.getDate() - 4);
      
      const result = getNextCheckpoint(executedDate.toISOString(), ['D1']);
      expect(result).toBe('D3');
    });

    it('should return null if all recorded', () => {
      const executedDate = new Date();
      executedDate.setDate(executedDate.getDate() - 10);
      
      const result = getNextCheckpoint(executedDate.toISOString(), ['D1', 'D3', 'D7']);
      expect(result).toBeNull();
    });
  });

  describe('daysUntilNextCheckpoint', () => {
    it('should return correct days until D1', () => {
      const executedDate = new Date();
      // Executed today
      
      const result = daysUntilNextCheckpoint(executedDate.toISOString(), null);
      expect(result).toBe(1);
    });

    it('should return 0 if checkpoint already passed', () => {
      const executedDate = new Date();
      executedDate.setDate(executedDate.getDate() - 5);
      
      const result = daysUntilNextCheckpoint(executedDate.toISOString(), 'D1');
      expect(result).toBe(0); // D3 already passed
    });
  });
});
```

### Test 2: Metrics Comparison

**File:** `src/lib/monitoring/__tests__/metrics-comparison.test.ts`

```typescript
import {
  compareMetrics,
  formatPercentChange,
  evaluateChange,
  summarizeComparison,
} from '../metrics-comparison';

describe('Metrics Comparison', () => {
  describe('compareMetrics', () => {
    it('should calculate correct percent changes', () => {
      const before = {
        cpp: 200000,
        roas: 2.0,
        chiTieu: 1000000,
      };

      const after = {
        cpp: 150000,
        roas: 2.5,
        chiTieu: 800000,
      };

      const result = compareMetrics(before, after);

      expect(result.changes.cpp_change).toBeCloseTo(-25);
      expect(result.changes.roas_change).toBeCloseTo(25);
      expect(result.changes.chiTieu_change).toBeCloseTo(-20);
    });

    it('should mark CPP as improved when decreased >5%', () => {
      const before = { cpp: 300000, roas: 2.0, chiTieu: 1000000 };
      const after = { cpp: 250000, roas: 2.0, chiTieu: 1000000 };

      const result = compareMetrics(before, after);

      expect(result.improvement.cpp_improved).toBe(true);
    });

    it('should mark ROAS as improved when increased >5%', () => {
      const before = { cpp: 200000, roas: 2.0, chiTieu: 1000000 };
      const after = { cpp: 200000, roas: 2.2, chiTieu: 1000000 };

      const result = compareMetrics(before, after);

      expect(result.improvement.roas_improved).toBe(true);
    });

    it('should mark overall as improved when both metrics good', () => {
      const before = { cpp: 300000, roas: 2.0, chiTieu: 1000000 };
      const after = { cpp: 250000, roas: 2.5, chiTieu: 1000000 };

      const result = compareMetrics(before, after);

      expect(result.improvement.overall_improved).toBe(true);
    });
  });

  describe('formatPercentChange', () => {
    it('should format positive change with + sign', () => {
      expect(formatPercentChange(15.5)).toBe('+15.5%');
    });

    it('should format negative change with - sign', () => {
      expect(formatPercentChange(-8.3)).toBe('-8.3%');
    });

    it('should handle zero', () => {
      expect(formatPercentChange(0)).toBe('+0.0%');
    });
  });

  describe('evaluateChange', () => {
    it('should return excellent for >20% improvement', () => {
      expect(evaluateChange(25, false)).toBe('excellent');
    });

    it('should return good for 10-20% improvement', () => {
      expect(evaluateChange(15, false)).toBe('good');
    });

    it('should return bad for >5% degradation', () => {
      expect(evaluateChange(-10, false)).toBe('bad');
    });

    it('should handle lowerIsBetter correctly', () => {
      // For CPP, -25% is excellent (lower is better)
      expect(evaluateChange(-25, true)).toBe('excellent');
    });
  });

  describe('summarizeComparison', () => {
    it('should generate summary for improvements', () => {
      const comparison = {
        before: { cpp: 300000, roas: 2.0, chiTieu: 1000000 },
        after: { cpp: 200000, roas: 2.5, chiTieu: 1000000 },
        changes: {
          cpp_change: -33.3,
          roas_change: 25,
          chiTieu_change: 0,
        },
        improvement: {
          cpp_improved: true,
          roas_improved: true,
          overall_improved: true,
        },
      };

      const summary = summarizeComparison(comparison);

      expect(summary).toContain('CPP giảm');
      expect(summary).toContain('ROAS tăng');
    });

    it('should return neutral message for no changes', () => {
      const comparison = {
        before: { cpp: 200000, roas: 2.0, chiTieu: 1000000 },
        after: { cpp: 200000, roas: 2.0, chiTieu: 1000000 },
        changes: {
          cpp_change: 0,
          roas_change: 0,
          chiTieu_change: 0,
        },
        improvement: {
          cpp_improved: false,
          roas_improved: false,
          overall_improved: false,
        },
      };

      const summary = summarizeComparison(comparison);

      expect(summary).toContain('ổn định');
    });
  });
});
```

### Test 3: Proposal Creation

**File:** `src/lib/de-xuat/__tests__/tao-de-xuat.test.ts`

```typescript
import { taoDeXuat } from '../tao-de-xuat';

// Mock dependencies
jest.mock('@/lib/facebook/client');
jest.mock('@/lib/ai/he-thong-da-agent');
jest.mock('@/lib/sheets/de-xuat-sheet');

describe('Proposal Creation', () => {
  it('should create proposal with correct priority', async () => {
    // Mock Facebook data
    const mockFacebookData = {
      metrics: {
        cpp: 350000, // High CPP
        roas: 1.5,
        ctr: 2.0,
      },
    };

    // Mock AI analysis
    const mockAIResult = {
      cacPhanTich: [],
      khuyenNghi_HanhDong: {
        loai: 'TAM_DUNG',
        lyDo: 'CPP quá cao',
        ketQua_KyVong: 'Giảm burn',
      },
      uuTien: 'NGUY_CAP',
    };

    const result = await taoDeXuat({
      campaignId: '123',
      startDate: '2026-02-01',
      endDate: '2026-02-05',
      accountId: 'act_123',
    });

    expect(result.uuTien).toBe('NGUY_CAP');
    expect(result.hanhDong.loai).toBe('TAM_DUNG');
  });
});
```

---

## 🔗 Integration Tests

### Test 1: Create Proposal API

**File:** `src/app/api/de-xuat/tao-moi/__tests__/route.test.ts`

```typescript
import { POST } from '../route';
import { NextRequest } from 'next/server';

describe('POST /api/de-xuat/tao-moi', () => {
  it('should return 401 if not authenticated', async () => {
    const req = new NextRequest('http://localhost:3000/api/de-xuat/tao-moi', {
      method: 'POST',
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('should create proposal successfully', async () => {
    // Mock session
    jest.mock('next-auth/react', () => ({
      useSession: () => ({
        data: { user: { email: 'test@example.com' } },
        status: 'authenticated',
      }),
    }));

    const req = new NextRequest('http://localhost:3000/api/de-xuat/tao-moi', {
      method: 'POST',
      body: JSON.stringify({
        campaignId: '123',
        startDate: '2026-02-01',
        endDate: '2026-02-05',
        accountId: 'act_123',
      }),
    });

    const response = await POST(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.deXuatId).toBeDefined();
  });
});
```

---

## 🎭 E2E Tests (Playwright)

### Setup

```bash
npm install --save-dev @playwright/test
npx playwright install
```

### Test: Complete Proposal Flow

**File:** `e2e/proposal-flow.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Proposal Creation Flow', () => {
  test('should create and approve proposal', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    // Navigate to dashboard
    await expect(page).toHaveURL(/.*dashboard/);

    // Click campaign to open detail panel
    await page.click('[data-testid="campaign-card"]');

    // Click "Tạo đề xuất AI"
    await page.click('button:has-text("Tạo đề xuất AI")');

    // Wait for success message
    await expect(page.locator('text=Đề xuất đã được tạo')).toBeVisible();

    // Navigate to proposals
    await page.click('a:has-text("Đề xuất")');

    // Verify proposal appears
    await expect(page.locator('[data-testid="proposal-card"]')).toBeVisible();

    // Click to expand
    await page.click('[data-testid="proposal-card"]');

    // Click "Duyệt"
    await page.click('button:has-text("Duyệt")');

    // Confirm
    await page.click('button:has-text("Xác nhận")');

    // Verify status changed
    await expect(page.locator('text=DA_DUYET')).toBeVisible();
  });
});
```

---

## ✅ Manual Testing Checklist

### Pre-Deployment

- [ ] **Create Proposal**
  - [ ] Click "Tạo đề xuất AI" from campaign panel
  - [ ] Verify 5 AI agents run (check logs)
  - [ ] Proposal saved to Google Sheets
  - [ ] Success message shows
  - [ ] Badge count updates

- [ ] **View Proposals**
  - [ ] Navigate to /dashboard/proposals
  - [ ] Filter by CHO_DUYET
  - [ ] Proposals sorted by priority
  - [ ] Expand shows 4 agents insights
  - [ ] Metrics displayed correctly

- [ ] **Approve Proposal**
  - [ ] Click "Duyệt"
  - [ ] Add note
  - [ ] Confirm
  - [ ] Status → DA_DUYET
  - [ ] Timestamp updated

- [ ] **Reject Proposal**
  - [ ] Click "Từ chối"
  - [ ] Enter reason
  - [ ] Confirm
  - [ ] Status → BI_TU_CHOI

- [ ] **Execute Action**
  - [ ] Approved proposal
  - [ ] Click "Thực thi"
  - [ ] Confirm
  - [ ] Facebook API called
  - [ ] Status → DANG_GIAM_SAT
  - [ ] giamSat_DenNgay set

- [ ] **Monitoring**
  - [ ] Navigate to /dashboard/monitoring
  - [ ] Proposals with DANG_GIAM_SAT visible
  - [ ] Timeline D+1/D+3/D+7 shown
  - [ ] Metrics comparison displayed
  - [ ] Manual trigger: POST /api/giam-sat/kiem-tra
  - [ ] Observation saved to QUAN_SAT

- [ ] **Learning Loop**
  - [ ] D+7 checkpoint reached
  - [ ] QA Auditor evaluation
  - [ ] Pattern extracted if success
  - [ ] MAU_HOC_DUOC updated
  - [ ] Status → HOAN_THANH

### Post-Deployment

- [ ] Vercel Cron running daily
- [ ] Observations being created automatically
- [ ] No errors in Vercel logs
- [ ] Google Sheets updating correctly
- [ ] Facebook API calls successful
- [ ] Performance acceptable (<3s response)

---

## 🏃 Running Tests

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test checkpoint-calculator.test.ts

# Watch mode
npm run test:watch
```

### E2E Tests

```bash
# Run all E2E tests
npx playwright test

# Run headed (see browser)
npx playwright test --headed

# Run specific test
npx playwright test proposal-flow.spec.ts

# Debug mode
npx playwright test --debug
```

### Integration Tests

```bash
# Start development server
npm run dev

# In another terminal
npm run test:integration
```

---

## 📊 Coverage Goals

Target coverage:

- **Unit Tests:** >80%
- **Integration Tests:** >60%
- **E2E Tests:** Critical flows only

---

## 🐛 Common Test Issues

### Issue: Tests timeout
**Solution:** Increase timeout in jest.config.js:
```javascript
testTimeout: 30000
```

### Issue: Mock not working
**Solution:** Clear mocks between tests:
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Issue: E2E tests flaky
**Solution:** Add explicit waits:
```typescript
await page.waitForSelector('[data-testid="element"]');
```

---

## ✅ CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test:coverage
      - run: npx playwright install
      - run: npx playwright test
```

---

**Testing Complete!** 🎉

Your AI Campaign Guardian system is fully tested and ready for production.

Next: [Deployment](./SETUP_GUIDE.md#vercel-deployment)
