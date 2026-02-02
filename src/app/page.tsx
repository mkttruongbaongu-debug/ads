import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="app-container">
      {/* Header Bar */}
      <header style={{
        background: 'var(--color-bg-header)',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          color: 'white',
          fontWeight: 700,
          fontSize: '1rem',
          letterSpacing: '0.5px',
        }}>
          QUÂN SƯ ADS
        </div>
        <Link
          href="/dashboard"
          style={{
            color: 'white',
            fontSize: '0.875rem',
            textDecoration: 'none',
            padding: '6px 16px',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '4px',
          }}
        >
          Đăng nhập
        </Link>
      </header>

      {/* Hero Section - Light Background */}
      <div style={{
        background: 'linear-gradient(180deg, #f8f9fa 0%, #e8eaed 100%)',
        padding: '80px 24px',
        textAlign: 'center',
      }}>
        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
          fontWeight: 700,
          color: '#202124',
          marginBottom: '16px',
          letterSpacing: '-0.5px',
        }}>
          Phần mềm Quản lý Quảng cáo Chuyên nghiệp
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '1rem',
          color: '#5f6368',
          maxWidth: '540px',
          margin: '0 auto 32px',
          lineHeight: 1.6,
        }}>
          Theo dõi chi tiêu, phân tích hiệu suất và tối ưu chiến dịch Facebook Ads
          với dữ liệu real-time và báo cáo chuyên sâu.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '48px' }}>
          <Link
            href="/dashboard"
            className="btn btn-primary"
            style={{
              padding: '12px 32px',
              fontSize: '0.9375rem',
              fontWeight: 600,
            }}
          >
            Vào Dashboard
          </Link>
          <Link
            href="/privacy"
            className="btn btn-secondary"
            style={{
              padding: '12px 24px',
              fontSize: '0.9375rem',
            }}
          >
            Tìm hiểu thêm
          </Link>
        </div>

        {/* Stats Preview */}
        <div style={{
          display: 'flex',
          gap: '24px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: '48px',
        }}>
          <StatCard label="Tổng Chi tiêu" value="₫ 15,420,000" change="+12.5%" positive />
          <StatCard label="ROAS" value="3.24x" change="+0.42" positive />
          <StatCard label="CPA" value="₫ 45,200" change="-8.3%" positive />
          <StatCard label="CTR" value="2.85%" change="-0.15%" positive={false} />
        </div>
      </div>

      {/* Features Section */}
      <div style={{
        padding: '64px 24px',
        background: '#ffffff',
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-primary)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            textAlign: 'center',
            marginBottom: '8px',
          }}>
            Tính năng
          </h2>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#202124',
            textAlign: 'center',
            marginBottom: '40px',
          }}>
            Công cụ dành cho Performance Marketer
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}>
            <FeatureCard
              title="Báo cáo Chi tiết"
              description="Xem đầy đủ metrics: Spend, CTR, CPC, CPM, ROAS, CAC, Purchases, Messages..."
              icon="📊"
            />
            <FeatureCard
              title="Phân tích Xu hướng"
              description="Biểu đồ diễn biến theo ngày, so sánh các giai đoạn, phát hiện anomaly."
              icon="📈"
            />
            <FeatureCard
              title="Đồng bộ Google Sheets"
              description="Tự động lưu lịch sử dữ liệu, theo dõi performance qua thời gian."
              icon="📋"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        background: 'var(--color-bg-header)',
        padding: '24px',
        textAlign: 'center',
        color: '#9aa0a6',
        fontSize: '0.8125rem',
      }}>
        <div>
          Powered by <span style={{ color: '#8ab4f8' }}>Nguyen Xuan Truong</span> |
          Call & Zalo: <a href="tel:0768536874" style={{ color: '#8ab4f8', textDecoration: 'none' }}>076 85 36874</a>
        </div>
        <div style={{ marginTop: '8px', fontSize: '0.75rem' }}>
          © 2026 QUÂN SƯ ADS. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value, change, positive }: {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #dadce0',
      borderRadius: '8px',
      padding: '16px 24px',
      minWidth: '160px',
      textAlign: 'left',
      boxShadow: '0 1px 3px rgba(60,64,67,0.12)',
    }}>
      <div style={{
        fontSize: '0.6875rem',
        fontWeight: 500,
        color: '#80868b',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '4px',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '1.25rem',
        fontWeight: 700,
        fontFamily: "'IBM Plex Mono', monospace",
        color: '#202124',
        marginBottom: '2px',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 500,
        color: positive ? '#137333' : '#c5221f',
      }}>
        {change}
      </div>
    </div>
  );
}

function FeatureCard({ title, description, icon }: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div style={{
      background: '#f8f9fa',
      border: '1px solid #dadce0',
      borderRadius: '8px',
      padding: '24px',
    }}>
      <div style={{
        fontSize: '1.5rem',
        marginBottom: '12px',
      }}>
        {icon}
      </div>
      <h4 style={{
        fontSize: '1rem',
        fontWeight: 600,
        color: '#202124',
        marginBottom: '8px',
      }}>
        {title}
      </h4>
      <p style={{
        fontSize: '0.875rem',
        color: '#5f6368',
        lineHeight: 1.5,
      }}>
        {description}
      </p>
    </div>
  );
}
