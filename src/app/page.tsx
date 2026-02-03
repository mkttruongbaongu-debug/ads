'use client';

import Link from 'next/link';
import {
  TrendingUp, Shield, Zap, BarChart3, Target, Clock,
  ChevronRight, CheckCircle, ArrowRight, LineChart,
  Lock, Eye, Activity
} from 'lucide-react';

// CEX Trading Design System
const colors = {
  bgPrimary: '#0B0B10',
  bgSecondary: '#0F172A',
  bgCard: 'rgba(15,23,42,0.8)',
  accentGold: '#F59E0B',
  accentPurple: '#8B5CF6',
  accentCyan: '#06B6D4',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#FBBF24',
  textPrimary: '#F8FAFC',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.5)',
  border: 'rgba(255,255,255,0.1)',
  borderGlow: 'rgba(245,158,11,0.3)',
};

const styles = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${colors.bgPrimary} 0%, ${colors.bgSecondary} 50%, ${colors.bgPrimary} 100%)`,
    fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
    color: colors.textPrimary,
    overflow: 'hidden',
  },
  // Header
  header: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    background: 'rgba(11,11,16,0.9)',
    backdropFilter: 'blur(20px)',
    borderBottom: `1px solid ${colors.border}`,
  },
  headerInner: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: '24px',
    fontWeight: 800,
    background: `linear-gradient(135deg, ${colors.accentGold} 0%, ${colors.accentPurple} 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.02em',
  },
  navLinks: {
    display: 'flex',
    gap: '32px',
    alignItems: 'center',
  },
  navLink: {
    color: colors.textSecondary,
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'color 0.2s',
  },
  ctaButton: {
    background: `linear-gradient(135deg, ${colors.accentGold} 0%, #D97706 100%)`,
    color: colors.bgPrimary,
    padding: '12px 24px',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '14px',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    boxShadow: `0 0 20px ${colors.borderGlow}`,
    border: 'none',
    cursor: 'pointer',
  },
  // Hero
  hero: {
    paddingTop: '140px',
    paddingBottom: '80px',
    textAlign: 'center' as const,
    position: 'relative' as const,
  },
  heroGrid: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `
      linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px)
    `,
    backgroundSize: '60px 60px',
    pointerEvents: 'none' as const,
  },
  heroGlow1: {
    position: 'absolute' as const,
    top: '10%',
    left: '20%',
    width: '400px',
    height: '400px',
    background: `radial-gradient(circle, ${colors.accentGold}20 0%, transparent 70%)`,
    borderRadius: '50%',
    filter: 'blur(80px)',
    pointerEvents: 'none' as const,
  },
  heroGlow2: {
    position: 'absolute' as const,
    top: '30%',
    right: '15%',
    width: '350px',
    height: '350px',
    background: `radial-gradient(circle, ${colors.accentPurple}15 0%, transparent 70%)`,
    borderRadius: '50%',
    filter: 'blur(80px)',
    pointerEvents: 'none' as const,
  },
  heroContent: {
    position: 'relative' as const,
    zIndex: 10,
    maxWidth: '900px',
    margin: '0 auto',
    padding: '0 24px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: colors.bgCard,
    border: `1px solid ${colors.border}`,
    borderRadius: '100px',
    padding: '8px 16px',
    fontSize: '13px',
    color: colors.accentGold,
    marginBottom: '32px',
    backdropFilter: 'blur(10px)',
  },
  heroTitle: {
    fontSize: 'clamp(40px, 6vw, 72px)',
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: '24px',
    letterSpacing: '-0.03em',
  },
  heroTitleGradient: {
    background: `linear-gradient(135deg, ${colors.textPrimary} 0%, ${colors.accentGold} 50%, ${colors.accentPurple} 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSubtitle: {
    fontSize: '18px',
    color: colors.textSecondary,
    lineHeight: 1.7,
    maxWidth: '600px',
    margin: '0 auto 40px',
  },
  heroButtons: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
  },
  secondaryButton: {
    background: 'transparent',
    border: `1px solid ${colors.border}`,
    color: colors.textPrimary,
    padding: '12px 24px',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '14px',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  // Stats Ticker
  statsTicker: {
    display: 'flex',
    justifyContent: 'center',
    gap: '48px',
    marginTop: '64px',
    flexWrap: 'wrap' as const,
    padding: '0 24px',
  },
  statItem: {
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: '36px',
    fontWeight: 700,
    color: colors.accentGold,
    fontFamily: 'monospace',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '13px',
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  // Trading Preview
  tradingPreview: {
    maxWidth: '1000px',
    margin: '80px auto 0',
    padding: '0 24px',
    position: 'relative' as const,
  },
  tradingCard: {
    background: colors.bgCard,
    borderRadius: '16px',
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
    backdropFilter: 'blur(20px)',
    boxShadow: `0 0 60px ${colors.borderGlow}, 0 20px 60px rgba(0,0,0,0.5)`,
  },
  tradingHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: `1px solid ${colors.border}`,
    background: 'rgba(0,0,0,0.3)',
  },
  tradingTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
    fontWeight: 600,
  },
  tradingStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: colors.success,
  },
  tradingBody: {
    padding: '24px',
  },
  tradingMetrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
  },
  metricCard: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '12px',
    padding: '16px',
    border: `1px solid ${colors.border}`,
  },
  metricLabel: {
    fontSize: '12px',
    color: colors.textMuted,
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  metricValue: {
    fontSize: '24px',
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  // Features Section
  features: {
    padding: '120px 24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  sectionTitle: {
    fontSize: '42px',
    fontWeight: 700,
    textAlign: 'center' as const,
    marginBottom: '16px',
    letterSpacing: '-0.02em',
  },
  sectionSubtitle: {
    fontSize: '16px',
    color: colors.textSecondary,
    textAlign: 'center' as const,
    maxWidth: '600px',
    margin: '0 auto 64px',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '24px',
  },
  featureCard: {
    background: colors.bgCard,
    borderRadius: '16px',
    padding: '32px',
    border: `1px solid ${colors.border}`,
    backdropFilter: 'blur(20px)',
    transition: 'all 0.3s',
  },
  featureIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    background: `linear-gradient(135deg, ${colors.accentGold}20 0%, ${colors.accentPurple}20 100%)`,
    border: `1px solid ${colors.accentGold}30`,
  },
  featureTitle: {
    fontSize: '20px',
    fontWeight: 600,
    marginBottom: '12px',
  },
  featureDesc: {
    fontSize: '14px',
    color: colors.textSecondary,
    lineHeight: 1.7,
  },
  // Security Section
  security: {
    padding: '80px 24px',
    background: `linear-gradient(180deg, transparent 0%, ${colors.bgSecondary}50 50%, transparent 100%)`,
  },
  securityInner: {
    maxWidth: '1000px',
    margin: '0 auto',
    textAlign: 'center' as const,
  },
  securityBadges: {
    display: 'flex',
    justifyContent: 'center',
    gap: '32px',
    marginTop: '48px',
    flexWrap: 'wrap' as const,
  },
  securityBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: colors.bgCard,
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    padding: '16px 24px',
    backdropFilter: 'blur(10px)',
  },
  securityBadgeText: {
    fontSize: '14px',
    fontWeight: 500,
  },
  // CTA Section
  cta: {
    padding: '120px 24px',
    textAlign: 'center' as const,
  },
  ctaInner: {
    maxWidth: '800px',
    margin: '0 auto',
    background: colors.bgCard,
    borderRadius: '24px',
    padding: '64px',
    border: `1px solid ${colors.border}`,
    backdropFilter: 'blur(20px)',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  ctaGlow: {
    position: 'absolute' as const,
    top: '-50%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '600px',
    height: '600px',
    background: `radial-gradient(circle, ${colors.accentGold}15 0%, transparent 70%)`,
    borderRadius: '50%',
    pointerEvents: 'none' as const,
  },
  ctaTitle: {
    fontSize: '36px',
    fontWeight: 700,
    marginBottom: '16px',
    position: 'relative' as const,
  },
  ctaSubtitle: {
    fontSize: '16px',
    color: colors.textSecondary,
    marginBottom: '32px',
    position: 'relative' as const,
  },
  // Footer
  footer: {
    padding: '40px 24px',
    borderTop: `1px solid ${colors.border}`,
    background: 'rgba(0,0,0,0.3)',
  },
  footerInner: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '16px',
  },
  footerText: {
    fontSize: '14px',
    color: colors.textMuted,
  },
  footerLinks: {
    display: 'flex',
    gap: '24px',
  },
  footerLink: {
    fontSize: '14px',
    color: colors.textSecondary,
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
};

const features = [
  {
    icon: <BarChart3 size={24} color={colors.accentGold} />,
    title: 'Phân tích real-time',
    desc: 'Theo dõi hiệu suất chiến dịch quảng cáo theo thời gian thực với dữ liệu được cập nhật liên tục.',
  },
  {
    icon: <Zap size={24} color={colors.accentPurple} />,
    title: 'AI-Powered Insights',
    desc: 'Trí tuệ nhân tạo phân tích dữ liệu và đưa ra đề xuất tối ưu hóa chiến dịch tự động.',
  },
  {
    icon: <Target size={24} color={colors.accentCyan} />,
    title: 'Tracking ROAS chính xác',
    desc: 'Đo lường Return on Ad Spend với độ chính xác cao, giúp tối ưu ngân sách quảng cáo.',
  },
  {
    icon: <Clock size={24} color={colors.success} />,
    title: 'Tiết kiệm thời gian',
    desc: 'Tự động hóa việc thu thập và phân tích dữ liệu, tiết kiệm hàng giờ làm việc mỗi ngày.',
  },
  {
    icon: <LineChart size={24} color={colors.warning} />,
    title: 'Báo cáo chi tiết',
    desc: 'Xuất báo cáo chuyên nghiệp với biểu đồ và insights cho stakeholders.',
  },
  {
    icon: <Shield size={24} color={colors.error} />,
    title: 'Cảnh báo thông minh',
    desc: 'Nhận thông báo ngay khi chiến dịch có vấn đề cần can thiệp khẩn cấp.',
  },
];

export default function LandingPage() {
  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>QUÂN SƯ ADS</div>
          <nav style={styles.navLinks}>
            <a href="#features" style={styles.navLink}>Tính năng</a>
            <a href="#security" style={styles.navLink}>Bảo mật</a>
            <Link href="/dashboard" style={styles.ctaButton}>
              Bắt đầu miễn phí <ChevronRight size={16} />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroGrid} />
        <div style={styles.heroGlow1} />
        <div style={styles.heroGlow2} />

        <div style={styles.heroContent}>
          <div style={styles.badge}>
            <Activity size={14} />
            Nền tảng phân tích quảng cáo Facebook #1 Việt Nam
          </div>

          <h1 style={styles.heroTitle}>
            <span style={styles.heroTitleGradient}>
              Tối ưu quảng cáo Facebook với AI
            </span>
          </h1>

          <p style={styles.heroSubtitle}>
            QUÂN SƯ ADS giúp bạn theo dõi, phân tích và tối ưu hóa chiến dịch quảng cáo Facebook
            với công nghệ AI tiên tiến. Tiết kiệm thời gian, tăng hiệu quả, giảm chi phí.
          </p>

          <div style={styles.heroButtons}>
            <Link href="/dashboard" style={styles.ctaButton}>
              Bắt đầu miễn phí <ArrowRight size={16} />
            </Link>
            <a href="#features" style={styles.secondaryButton}>
              Tìm hiểu thêm <ChevronRight size={16} />
            </a>
          </div>

          <div style={styles.statsTicker}>
            <div style={styles.statItem}>
              <div style={styles.statValue}>10,000+</div>
              <div style={styles.statLabel}>Chiến dịch đã phân tích</div>
            </div>
            <div style={styles.statItem}>
              <div style={styles.statValue}>500+</div>
              <div style={styles.statLabel}>Người dùng tin tưởng</div>
            </div>
            <div style={styles.statItem}>
              <div style={styles.statValue}>35%</div>
              <div style={styles.statLabel}>Tiết kiệm chi phí TB</div>
            </div>
          </div>
        </div>

        {/* Trading Preview Card */}
        <div style={styles.tradingPreview}>
          <div style={styles.tradingCard}>
            <div style={styles.tradingHeader}>
              <div style={styles.tradingTitle}>
                <TrendingUp size={18} color={colors.accentGold} />
                Dashboard Preview
              </div>
              <div style={styles.tradingStatus}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.success }} />
                Live
              </div>
            </div>
            <div style={styles.tradingBody}>
              <div style={styles.tradingMetrics}>
                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>Chi tiêu hôm nay</div>
                  <div style={{ ...styles.metricValue, color: colors.textPrimary }}>12,450,000₫</div>
                </div>
                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>ROAS trung bình</div>
                  <div style={{ ...styles.metricValue, color: colors.success }}>3.2x</div>
                </div>
                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>Chiến dịch active</div>
                  <div style={{ ...styles.metricValue, color: colors.accentGold }}>24</div>
                </div>
                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>Cần xử lý</div>
                  <div style={{ ...styles.metricValue, color: colors.error }}>3</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={styles.features}>
        <h2 style={styles.sectionTitle}>Tính năng mạnh mẽ</h2>
        <p style={styles.sectionSubtitle}>
          Công cụ phân tích quảng cáo chuyên nghiệp với AI, giúp bạn đưa ra quyết định dựa trên dữ liệu.
        </p>

        <div style={styles.featureGrid}>
          {features.map((feature, index) => (
            <div key={index} style={styles.featureCard}>
              <div style={styles.featureIcon}>{feature.icon}</div>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDesc}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security Section */}
      <section id="security" style={styles.security}>
        <div style={styles.securityInner}>
          <h2 style={styles.sectionTitle}>Bảo mật tối đa</h2>
          <p style={styles.sectionSubtitle}>
            Dữ liệu của bạn được bảo vệ với các tiêu chuẩn bảo mật cao nhất.
          </p>

          <div style={styles.securityBadges}>
            <div style={styles.securityBadge}>
              <Lock size={20} color={colors.success} />
              <span style={styles.securityBadgeText}>SSL Encrypted</span>
            </div>
            <div style={styles.securityBadge}>
              <Shield size={20} color={colors.accentGold} />
              <span style={styles.securityBadgeText}>Meta Verified</span>
            </div>
            <div style={styles.securityBadge}>
              <Eye size={20} color={colors.accentPurple} />
              <span style={styles.securityBadgeText}>Privacy Protected</span>
            </div>
            <div style={styles.securityBadge}>
              <CheckCircle size={20} color={colors.accentCyan} />
              <span style={styles.securityBadgeText}>GDPR Compliant</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={styles.cta}>
        <div style={styles.ctaInner}>
          <div style={styles.ctaGlow} />
          <h2 style={styles.ctaTitle}>Sẵn sàng tối ưu quảng cáo?</h2>
          <p style={styles.ctaSubtitle}>
            Bắt đầu miễn phí ngay hôm nay và trải nghiệm sức mạnh của AI trong quảng cáo.
          </p>
          <Link href="/dashboard" style={styles.ctaButton}>
            Đăng nhập với Facebook <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <div style={styles.footerText}>
            © 2026 QUÂN SƯ ADS. Công ty TNHH Đế Vương Ký.
          </div>
          <div style={styles.footerLinks}>
            <Link href="/privacy" style={styles.footerLink}>Chính sách bảo mật</Link>
            <Link href="/terms" style={styles.footerLink}>Điều khoản sử dụng</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
