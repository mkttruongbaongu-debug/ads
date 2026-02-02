import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="app-container">
      {/* Hero Section */}
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-xl)',
        textAlign: 'center',
        background: 'radial-gradient(ellipse at top, rgba(99, 102, 241, 0.15) 0%, transparent 50%)',
      }}>
        {/* Logo */}
        <div style={{
          fontSize: '4rem',
          marginBottom: 'var(--space-lg)',
        }}>
          🔧
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 700,
          marginBottom: 'var(--space-md)',
          background: 'var(--color-accent-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          QUÂN SƯ ADS
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '1.25rem',
          color: 'var(--color-text-secondary)',
          maxWidth: '600px',
          marginBottom: 'var(--space-2xl)',
          lineHeight: 1.6,
        }}>
          Trợ lý AI thông minh giúp bạn phân tích, tối ưu và quản lý quảng cáo Facebook như một chuyên gia
        </p>

        {/* Features */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--space-lg)',
          maxWidth: '900px',
          width: '100%',
          marginBottom: 'var(--space-2xl)',
        }}>
          <FeatureCard
            icon="📊"
            title="Full Metrics Report"
            description="Xem đầy đủ chỉ số: Spend, CTR, CPC, CPM, ROAS, Conversions..."
          />
          <FeatureCard
            icon="🤖"
            title="AI Analysis"
            description="GPT-4o phân tích xu hướng, phát hiện bất thường, đề xuất tối ưu"
          />
          <FeatureCard
            icon="⚡"
            title="Auto Optimize"
            description="Tự động đề xuất tắt/bật adsets dựa trên hiệu suất thực tế"
          />
        </div>

        {/* CTA Button */}
        <Link
          href="/dashboard"
          className="btn btn-primary"
          style={{
            padding: 'var(--space-md) var(--space-2xl)',
            fontSize: '1.125rem',
          }}
        >
          🚀 Bắt đầu ngay
        </Link>

        {/* Footer */}
        <div style={{
          marginTop: 'var(--space-2xl)',
          color: 'var(--color-text-muted)',
          fontSize: '0.875rem',
        }}>
          Powered by <strong style={{ color: 'var(--color-primary)' }}>Nguyen Xuan Truong</strong> | Call & Zalo: <a href="tel:0768536874" style={{ color: 'var(--color-accent)' }}>076 85 36874</a>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="card" style={{ textAlign: 'left' }}>
      <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>{icon}</div>
      <h3 style={{
        fontSize: '1.125rem',
        fontWeight: 600,
        marginBottom: 'var(--space-xs)',
        color: 'var(--color-text-primary)',
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: '0.875rem',
        color: 'var(--color-text-secondary)',
        lineHeight: 1.5,
      }}>
        {description}
      </p>
    </div>
  );
}
