"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Flame,
  Facebook,
  Frown,
  Wallet,
  BarChart3,
  Rocket,
  LayoutDashboard,
  Brain,
  TrendingUp,
  Clock,
  Shield,
  Zap
} from "lucide-react";

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
          fontSize: '0.875rem',
          color: '#dc2626',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '16px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          <Flame size={18} strokeWidth={2.5} />
          Dành cho người chạy Ads chán đau đầu
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
          <Facebook size={20} style={{ marginRight: '8px' }} />
          Đăng nhập bằng Facebook
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
              icon={Frown}
              title="Check ads như tra tấn"
              description="Mở Facebook Ads Manager, loading 10 phút. Nhìn đống số liệu mà không biết campaign nào đang chết, campaign nào đang ngon."
            />
            <PainCard
              icon={Wallet}
              title="Đốt tiền mà không biết"
              description="Để CPC 50k chạy cả tuần vì 'quên check'. Tới lúc phát hiện thì mất 5 triệu rồi. Lại đổ xăng cho ông Zuck."
            />
            <PainCard
              icon={BarChart3}
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
              icon={LayoutDashboard}
              title="Dashboard 1 cái nhìn"
              description="Tất cả campaigns, chi tiêu, ROAS, CPA, CTR... hiện một màn hình. Xanh là tốt, đỏ là chết. Đơn giản vậy thôi."
            />
            <FeatureCard
              icon={Brain}
              title="AI phân tích tự động"
              description="AI đọc data, phát hiện bất thường, gợi ý: 'Campaign này CPC cao bất thường, nên tắt'. Như có chuyên gia ngồi cạnh."
            />
            <FeatureCard
              icon={TrendingUp}
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
          <Rocket size={20} style={{ marginRight: '8px' }} />
          Dùng thử miễn phí
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

function PainCard({ icon: Icon, title, description }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; description: string }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #fef2f2 0%, #fff5f5 100%)',
      border: '1px solid #fecaca',
      borderRadius: '12px',
      padding: '28px',
      transition: 'all 0.3s ease',
      cursor: 'default',
    }}
      className="pain-card"
    >
      <div style={{
        width: '48px',
        height: '48px',
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
      }}>
        <Icon size={24} className="text-white" />
      </div>
      <h4 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#991b1b', marginBottom: '10px' }}>{title}</h4>
      <p style={{ fontSize: '0.9rem', color: '#7f1d1d', lineHeight: 1.7 }}>{description}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon?: React.ComponentType<{ size?: number; className?: string }>; title: string; description: string }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '28px',
      transition: 'all 0.3s ease',
      cursor: 'default',
    }}
      className="feature-card"
    >
      {Icon && (
        <div style={{
          width: '48px',
          height: '48px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
        }}>
          <Icon size={24} className="text-white" />
        </div>
      )}
      <h4 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#1e293b', marginBottom: '10px' }}>{title}</h4>
      <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.7 }}>{description}</p>
    </div>
  );
}

function StatItem({ value, label, icon: Icon }: { value: string; label: string; icon?: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div style={{ transition: 'transform 0.3s ease' }} className="stat-item">
      {Icon && <Icon size={28} className="stat-icon" />}
      <div style={{ fontSize: '2.25rem', fontWeight: 700, marginTop: '8px' }}>{value}</div>
      <div style={{ fontSize: '0.9rem', opacity: 0.85, marginTop: '4px' }}>{label}</div>
    </div>
  );
}
