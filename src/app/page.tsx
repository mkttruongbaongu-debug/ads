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
} from "lucide-react";

// Glassmorphism Design System
const colors = {
  bgPrimary: '#0f172a',
  bgSecondary: '#1e1b4b',
  glassBg: 'rgba(255,255,255,0.05)',
  glassBorder: 'rgba(255,255,255,0.1)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.5)',
  accentPrimary: '#6366f1',
  accentSecondary: '#a855f7',
  accentPink: '#f472b6',
  accentCyan: '#22d3ee',
  accentGreen: '#4ade80',
  accentRed: '#f87171',
  gradientPrimary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
  gradientLogo: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)',
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isAuthenticated = status === "authenticated";

  const handleLogin = () => {
    signIn("facebook", { callbackUrl: "/dashboard" });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${colors.bgPrimary} 0%, ${colors.bgSecondary} 50%, ${colors.bgPrimary} 100%)`,
      fontFamily: 'Inter, -apple-system, sans-serif',
      color: colors.textPrimary,
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(20px)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            background: colors.gradientLogo,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>⚡ QUÂN SƯ ADS</span>
        </div>
        {isAuthenticated && (
          <Link
            href="/dashboard"
            style={{
              background: colors.gradientPrimary,
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              padding: '10px 24px',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
            }}
          >
            Vào Dashboard →
          </Link>
        )}
      </header>

      {/* Hero Section */}
      <div style={{
        padding: '80px 24px 100px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative blurs */}
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '20%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '20%',
          right: '15%',
          width: '250px',
          height: '250px',
          background: 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }} />

        {/* Pain Point Hook */}
        <p style={{
          fontSize: '0.875rem',
          color: colors.accentRed,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '24px',
          textTransform: 'uppercase',
          letterSpacing: '2px',
        }}>
          <Flame size={18} strokeWidth={2.5} />
          Dành cho người chạy Ads chán đau đầu
        </p>

        {/* Main Headline */}
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 800,
          marginBottom: '28px',
          lineHeight: 1.2,
          maxWidth: '900px',
          margin: '0 auto 28px',
          letterSpacing: '-0.03em',
        }}>
          Thôi đi học khoá 10 triệu.<br />
          Thôi tuyển nhân viên media.<br />
          <span style={{
            background: colors.gradientPrimary,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Để AI làm hết.</span>
        </h1>

        {/* Subheadline */}
        <p style={{
          fontSize: '1.125rem',
          color: colors.textSecondary,
          maxWidth: '650px',
          margin: '0 auto 48px',
          lineHeight: 1.8,
        }}>
          Bạn bỏ 20 triệu/tháng thuê 1 đứa ngồi check ads, nó check 30 phút rồi lướt Facebook.
          <strong style={{ color: colors.textPrimary }}> QUÂN SƯ ADS check 24/7, không nghỉ trưa, không xin tăng lương.</strong>
        </p>

        {/* CTA Button */}
        <button
          onClick={handleLogin}
          style={{
            background: colors.gradientPrimary,
            color: 'white',
            fontSize: '1.125rem',
            fontWeight: 600,
            padding: '18px 56px',
            border: 'none',
            borderRadius: '14px',
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
            marginBottom: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'all 0.3s ease',
          }}
        >
          <Facebook size={22} />
          Đăng nhập bằng Facebook
        </button>
        <p style={{ fontSize: '0.875rem', color: colors.textMuted }}>
          Miễn phí. Không cần thẻ. Vào là dùng luôn.
        </p>
      </div>

      {/* Pain Points Section */}
      <div style={{
        padding: '80px 24px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: '48px',
          }}>
            Bạn có đang gặp mấy vấn đề này không?
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
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
        padding: '80px 24px',
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <p style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: colors.accentCyan,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            textAlign: 'center',
            marginBottom: '12px',
          }}>
            GIẢI PHÁP
          </p>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: '48px',
          }}>
            QUÂN SƯ ADS làm được gì?
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}>
            <FeatureCard
              icon={LayoutDashboard}
              title="Dashboard 1 cái nhìn"
              description="Tất cả campaigns, chi tiêu, ROAS, CPA, CTR... hiện một màn hình. Xanh là tốt, đỏ là chết. Đơn giản vậy thôi."
              color={colors.accentPrimary}
            />
            <FeatureCard
              icon={Brain}
              title="AI phân tích tự động"
              description="AI đọc data, phát hiện bất thường, gợi ý: 'Campaign này CPC cao bất thường, nên tắt'. Như có chuyên gia ngồi cạnh."
              color={colors.accentSecondary}
            />
            <FeatureCard
              icon={TrendingUp}
              title="Theo dõi diễn biến"
              description="Biểu đồ xu hướng theo ngày, so sánh hiệu suất qua thời gian. Phát hiện sớm campaign đang tuột dốc để xử lý kịp."
              color={colors.accentGreen}
            />
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div style={{
        padding: '60px 24px',
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-around',
          flexWrap: 'wrap',
          gap: '40px',
          textAlign: 'center',
        }}>
          <StatItem value="5 phút" label="Setup xong" />
          <StatItem value="24/7" label="Giám sát tự động" />
          <StatItem value="0đ" label="Chi phí nhân sự" />
        </div>
      </div>

      {/* Final CTA */}
      <div style={{
        padding: '80px 24px',
        textAlign: 'center',
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 700,
          marginBottom: '20px',
        }}>
          Sẵn sàng để bớt đau đầu chưa?
        </h2>
        <p style={{
          fontSize: '1.125rem',
          color: colors.textSecondary,
          marginBottom: '40px',
          maxWidth: '550px',
          margin: '0 auto 40px',
        }}>
          Đăng nhập bằng Facebook là dùng được ngay. Không cần setup phức tạp, không cần IT.
        </p>
        <button
          onClick={handleLogin}
          style={{
            background: colors.gradientPrimary,
            color: 'white',
            fontSize: '1.125rem',
            fontWeight: 600,
            padding: '18px 56px',
            border: 'none',
            borderRadius: '14px',
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <Rocket size={22} />
          Dùng thử miễn phí
        </button>
      </div>

      {/* Footer */}
      <footer style={{
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(12px)',
        padding: '32px 24px',
        textAlign: 'center',
        color: colors.textMuted,
        fontSize: '0.875rem',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div>
          Powered by <span style={{ color: colors.accentCyan }}>Nguyen Xuan Truong</span> |
          Call & Zalo: <a href="tel:0768536874" style={{ color: colors.accentCyan, textDecoration: 'none' }}>076 85 36874</a>
        </div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '24px', justifyContent: 'center' }}>
          <a href="/privacy" style={{ color: colors.textMuted, textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms" style={{ color: colors.textMuted, textDecoration: 'none' }}>Terms of Service</a>
        </div>
        <div style={{ marginTop: '12px', fontSize: '0.75rem' }}>
          © 2026 QUÂN SƯ ADS. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function PainCard({ icon: Icon, title, description }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; description: string }) {
  return (
    <div style={{
      background: 'rgba(248,113,113,0.1)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(248,113,113,0.2)',
      borderRadius: '16px',
      padding: '28px',
      transition: 'all 0.3s ease',
    }}>
      <div style={{
        width: '52px',
        height: '52px',
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
        boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
      }}>
        <Icon size={26} className="text-white" />
      </div>
      <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#fca5a5', marginBottom: '12px' }}>{title}</h4>
      <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>{description}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color }: { icon?: React.ComponentType<{ size?: number; className?: string }>; title: string; description: string; color: string }) {
  return (
    <div style={{
      background: colors.glassBg,
      backdropFilter: 'blur(12px)',
      border: `1px solid ${colors.glassBorder}`,
      borderRadius: '16px',
      padding: '28px',
      transition: 'all 0.3s ease',
    }}>
      {Icon && (
        <div style={{
          width: '52px',
          height: '52px',
          background: `linear-gradient(135deg, ${color} 0%, ${colors.accentSecondary} 100%)`,
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          boxShadow: `0 8px 24px ${color}40`,
        }}>
          <Icon size={26} className="text-white" />
        </div>
      )}
      <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: colors.textPrimary, marginBottom: '12px' }}>{title}</h4>
      <p style={{ fontSize: '0.9rem', color: colors.textSecondary, lineHeight: 1.7 }}>{description}</p>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div style={{
      background: colors.glassBg,
      backdropFilter: 'blur(12px)',
      border: `1px solid ${colors.glassBorder}`,
      borderRadius: '16px',
      padding: '32px 48px',
    }}>
      <div style={{
        fontSize: '2.5rem',
        fontWeight: 800,
        background: colors.gradientPrimary,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>{value}</div>
      <div style={{ fontSize: '0.95rem', color: colors.textSecondary, marginTop: '8px' }}>{label}</div>
    </div>
  );
}
