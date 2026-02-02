"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Không auto-redirect nữa - để user tự navigate
  const isAuthenticated = status === "authenticated";

  const handleLogin = () => {
    signIn("facebook", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header style={{
        background: 'var(--color-bg-header)',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="QUÂN SƯ ADS" style={{ width: '32px', height: '32px', borderRadius: '6px' }} />
          <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>QUÂN SƯ ADS</span>
        </div>
        {isAuthenticated && (
          <Link
            href="/dashboard"
            style={{
              background: 'white',
              color: 'var(--color-bg-header)',
              fontSize: '0.875rem',
              fontWeight: 600,
              padding: '8px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Vào Dashboard →
          </Link>
        )}
      </header>

      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%)',
        padding: '60px 24px 80px',
        textAlign: 'center',
      }}>
        {/* Pain Point Hook */}
        <p style={{
          fontSize: '1rem',
          color: '#c5221f',
          fontWeight: 500,
          marginBottom: '16px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          🔥 Dành cho người chạy Ads chán đau đầu
        </p>

        {/* Main Headline - Alex Hormozi Style */}
        <h1 style={{
          fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
          fontWeight: 700,
          color: '#202124',
          marginBottom: '24px',
          lineHeight: 1.3,
          maxWidth: '800px',
          margin: '0 auto 24px',
        }}>
          Thôi đi học khoá 10 triệu.<br />
          Thôi tuyển nhân viên media.<br />
          <span style={{ color: 'var(--color-primary)' }}>Để AI làm hết.</span>
        </h1>

        {/* Subheadline */}
        <p style={{
          fontSize: '1.125rem',
          color: '#5f6368',
          maxWidth: '600px',
          margin: '0 auto 40px',
          lineHeight: 1.7,
        }}>
          Bạn bỏ 20 triệu/tháng thuê 1 đứa ngồi check ads, nó check 30 phút rồi lướt Facebook.
          <strong style={{ color: '#202124' }}> QUÂN SƯ ADS check 24/7, không nghỉ trưa, không xin tăng lương.</strong>
        </p>

        {/* CTA Button */}
        <button
          onClick={handleLogin}
          style={{
            background: 'var(--color-primary)',
            color: 'white',
            fontSize: '1.125rem',
            fontWeight: 600,
            padding: '16px 48px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(13, 71, 161, 0.3)',
            marginBottom: '12px',
          }}
        >
          🔐 Đăng nhập bằng Facebook
        </button>
        <p style={{ fontSize: '0.8125rem', color: '#80868b' }}>
          Miễn phí. Không cần thẻ. Vào là dùng luôn.
        </p>
      </div>

      {/* Pain Points Section */}
      <div style={{
        background: '#ffffff',
        padding: '64px 24px',
        borderTop: '1px solid #e8eaed',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#202124',
            textAlign: 'center',
            marginBottom: '40px',
          }}>
            Bạn có đang gặp mấy vấn đề này không?
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '24px',
          }}>
            <PainCard
              emoji="😤"
              title="Check ads như tra tấn"
              description="Mở Facebook Ads Manager, loading 10 phút. Nhìn đống số liệu mà không biết campaign nào đang chết, campaign nào đang ngon."
            />
            <PainCard
              emoji="💸"
              title="Đốt tiền mà không biết"
              description="Để CPC 50k chạy cả tuần vì 'quên check'. Tới lúc phát hiện thì mất 5 triệu rồi. Lại đổ xăng cho ông Zuck."
            />
            <PainCard
              emoji="📊"
              title="Báo cáo thủ công muốn phát điên"
              description="Cuối tuần ngồi copy paste số liệu vào Excel. Tính tay ROAS, CAC. Làm xong thì hết ngày chủ nhật."
            />
          </div>
        </div>
      </div>

      {/* Solution Section */}
      <div style={{
        background: '#f8f9fa',
        padding: '64px 24px',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--color-primary)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            textAlign: 'center',
            marginBottom: '8px',
          }}>
            GIẢI PHÁP
          </h2>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#202124',
            textAlign: 'center',
            marginBottom: '40px',
          }}>
            QUÂN SƯ ADS làm được gì?
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}>
            <FeatureCard
              title="Dashboard 1 cái nhìn"
              description="Tất cả campaigns, chi tiêu, ROAS, CPA, CTR... hiện một màn hình. Xanh là tốt, đỏ là chết. Đơn giản vậy thôi."
            />
            <FeatureCard
              title="AI phân tích tự động"
              description="AI đọc data, phát hiện bất thường, gợi ý: 'Campaign này CPC cao bất thường, nên tắt'. Như có chuyên gia ngồi cạnh."
            />
            <FeatureCard
              title="Theo dõi diễn biến"
              description="Biểu đồ xu hướng theo ngày, so sánh hiệu suất qua thời gian. Phát hiện sớm campaign đang tuột dốc để xử lý kịp."
            />
          </div>
        </div>
      </div>

      {/* Social Proof / Numbers */}
      <div style={{
        background: 'var(--color-bg-header)',
        padding: '48px 24px',
        color: 'white',
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-around',
          flexWrap: 'wrap',
          gap: '32px',
          textAlign: 'center',
        }}>
          <StatItem value="5 phút" label="Setup xong" />
          <StatItem value="24/7" label="Giám sát tự động" />
          <StatItem value="0đ" label="Chi phí nhân sự" />
        </div>
      </div>

      {/* Final CTA */}
      <div style={{
        background: '#ffffff',
        padding: '64px 24px',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: '#202124',
          marginBottom: '16px',
        }}>
          Sẵn sàng để bớt đau đầu chưa?
        </h2>
        <p style={{
          fontSize: '1rem',
          color: '#5f6368',
          marginBottom: '32px',
          maxWidth: '500px',
          margin: '0 auto 32px',
        }}>
          Đăng nhập bằng Facebook là dùng được ngay. Không cần setup phức tạp, không cần IT.
        </p>
        <button
          onClick={handleLogin}
          style={{
            background: 'var(--color-primary)',
            color: 'white',
            fontSize: '1.125rem',
            fontWeight: 600,
            padding: '16px 48px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(13, 71, 161, 0.3)',
          }}
        >
          🚀 Dùng thử miễn phí
        </button>
      </div>

      {/* Footer */}
      <footer style={{
        background: '#1a1a2e',
        padding: '24px',
        textAlign: 'center',
        color: '#9aa0a6',
        fontSize: '0.8125rem',
      }}>
        <div>
          Powered by <span style={{ color: '#8ab4f8' }}>Nguyen Xuan Truong</span> |
          Call & Zalo: <a href="tel:0768536874" style={{ color: '#8ab4f8', textDecoration: 'none' }}>076 85 36874</a>
        </div>
        <div style={{ marginTop: '8px', display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <a href="/privacy" style={{ color: '#9aa0a6', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms" style={{ color: '#9aa0a6', textDecoration: 'none' }}>Terms of Service</a>
        </div>
        <div style={{ marginTop: '8px', fontSize: '0.75rem' }}>
          © 2026 QUÂN SƯ ADS. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function PainCard({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <div style={{
      background: '#fff5f5',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      padding: '24px',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{emoji}</div>
      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#991b1b', marginBottom: '8px' }}>{title}</h4>
      <p style={{ fontSize: '0.875rem', color: '#7f1d1d', lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #dadce0',
      borderRadius: '8px',
      padding: '24px',
    }}>
      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#202124', marginBottom: '8px' }}>{title}</h4>
      <p style={{ fontSize: '0.875rem', color: '#5f6368', lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: '2rem', fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>{label}</div>
    </div>
  );
}
