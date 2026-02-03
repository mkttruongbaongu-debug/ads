'use client';

import Link from 'next/link';
import Image from 'next/image';

// CEX Trading Design System - Exact Colors
const colors = {
  primary: '#F0B90B',
  primaryHover: '#FCD535',
  secondary: '#1E2329',
  accent: '#0ECB81',
  success: '#0ECB81',
  error: '#F6465D',
  warning: '#F0B90B',
  bg: '#0B0E11',
  bgAlt: '#1E2329',
  bgCard: '#181A20',
  text: '#EAECEF',
  textMuted: '#848E9C',
  textSubtle: '#5E6673',
  border: '#2B3139',
};

const styles = {
  page: {
    minHeight: '100vh',
    background: colors.bg,
    fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
    color: colors.text,
  },
  // Navbar
  navbar: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    background: colors.bgCard,
    borderBottom: `1px solid ${colors.border}`,
  },
  navInner: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '0 24px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '4px',
  },
  logoText: {
    fontSize: '20px',
    fontWeight: 700,
    color: colors.text,
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  navLink: {
    color: colors.textMuted,
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.2s',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  loginBtn: {
    color: colors.textMuted,
    background: 'transparent',
    border: 'none',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: colors.primary,
    color: colors.bg,
    fontWeight: 600,
    padding: '12px 24px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background 0.2s',
    textDecoration: 'none',
    display: 'inline-block',
  },
  btnSecondary: {
    background: 'transparent',
    color: colors.text,
    fontWeight: 600,
    padding: '12px 24px',
    borderRadius: '4px',
    border: `1px solid ${colors.border}`,
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
    textDecoration: 'none',
    display: 'inline-block',
  },
  // Hero
  hero: {
    paddingTop: '96px',
    paddingBottom: '64px',
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '96px 24px 64px',
  },
  heroGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '48px',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: '48px',
    fontWeight: 700,
    lineHeight: 1.2,
    marginBottom: '24px',
    color: colors.text,
  },
  gradientText: {
    background: `linear-gradient(135deg, ${colors.primary} 0%, #FCD535 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroDesc: {
    fontSize: '18px',
    color: colors.textMuted,
    marginBottom: '32px',
    lineHeight: 1.6,
  },
  // Card
  card: {
    background: colors.bgCard,
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    padding: '24px',
    marginBottom: '32px',
  },
  inputGroup: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    color: colors.text,
    fontSize: '14px',
    outline: 'none',
  },
  rewardText: {
    fontSize: '14px',
    color: colors.textMuted,
  },
  rewardHighlight: {
    color: colors.primary,
  },
  // Stats
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: colors.text,
    fontFamily: '"JetBrains Mono", monospace',
  },
  statLabel: {
    fontSize: '14px',
    color: colors.textMuted,
  },
  // Trading Widget
  tradingCard: {
    background: colors.bgCard,
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
  },
  tradingHeader: {
    padding: '16px',
    borderBottom: `1px solid ${colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tradingPair: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  pairName: {
    fontWeight: 700,
    color: colors.text,
  },
  pairPrice: {
    color: colors.success,
    fontFamily: '"JetBrains Mono", monospace',
  },
  pairChange: {
    color: colors.success,
    fontSize: '14px',
  },
  tradingTabs: {
    display: 'flex',
    gap: '8px',
  },
  tabActive: {
    padding: '4px 12px',
    fontSize: '14px',
    background: colors.bg,
    borderRadius: '4px',
    color: colors.text,
    border: 'none',
    cursor: 'pointer',
  },
  tabInactive: {
    padding: '4px 12px',
    fontSize: '14px',
    background: 'transparent',
    color: colors.textMuted,
    border: 'none',
    cursor: 'pointer',
  },
  chartArea: {
    height: '192px',
    background: colors.bg,
    padding: '16px',
    position: 'relative' as const,
  },
  orderBook: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    borderTop: `1px solid ${colors.border}`,
  },
  orderSide: {
    padding: '12px',
  },
  orderSideRight: {
    padding: '12px',
    borderLeft: `1px solid ${colors.border}`,
  },
  orderLabel: {
    fontSize: '12px',
    color: colors.textMuted,
    marginBottom: '8px',
  },
  orderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    padding: '4px 0',
    fontFamily: '"JetBrains Mono", monospace',
  },
  buyPrice: {
    color: colors.success,
  },
  sellPrice: {
    color: colors.error,
  },
  orderQty: {
    color: colors.textMuted,
  },
  tradingButtons: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    padding: '16px',
    borderTop: `1px solid ${colors.border}`,
  },
  btnSuccess: {
    background: colors.success,
    color: '#fff',
    fontWeight: 600,
    padding: '12px 24px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
  },
  btnError: {
    background: colors.error,
    color: '#fff',
    fontWeight: 600,
    padding: '12px 24px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
  },
  // Markets Section
  section: {
    padding: '64px 24px',
    maxWidth: '1280px',
    margin: '0 auto',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: colors.text,
    marginBottom: '8px',
  },
  sectionDesc: {
    color: colors.textMuted,
    fontSize: '14px',
  },
  // Table
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  tableHead: {
    borderBottom: `1px solid ${colors.border}`,
  },
  th: {
    padding: '12px 16px',
    fontSize: '14px',
    color: colors.textMuted,
    fontWeight: 400,
    textAlign: 'left' as const,
  },
  thRight: {
    padding: '12px 16px',
    fontSize: '14px',
    color: colors.textMuted,
    fontWeight: 400,
    textAlign: 'right' as const,
  },
  tr: {
    borderBottom: `1px solid ${colors.border}`,
    transition: 'background 0.2s',
    cursor: 'pointer',
  },
  td: {
    padding: '16px',
  },
  tdRight: {
    padding: '16px',
    textAlign: 'right' as const,
  },
  coinInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  coinIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: colors.bgAlt,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    color: colors.primary,
  },
  coinName: {
    fontWeight: 600,
    color: colors.text,
  },
  coinSymbol: {
    fontSize: '12px',
    color: colors.textMuted,
  },
  priceText: {
    fontFamily: '"JetBrains Mono", monospace',
    color: colors.text,
  },
  priceUp: {
    fontFamily: '"JetBrains Mono", monospace',
    color: colors.success,
  },
  priceDown: {
    fontFamily: '"JetBrains Mono", monospace',
    color: colors.error,
  },
  volumeText: {
    color: colors.textMuted,
  },
  tradeBtn: {
    padding: '6px 16px',
    background: colors.primary,
    color: colors.bg,
    fontSize: '14px',
    fontWeight: 500,
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
  },
  // Security Section
  securitySection: {
    padding: '64px 24px',
    background: colors.bgAlt,
  },
  securityInner: {
    maxWidth: '1280px',
    margin: '0 auto',
  },
  securityTitle: {
    fontSize: '30px',
    fontWeight: 700,
    textAlign: 'center' as const,
    marginBottom: '16px',
    color: colors.text,
  },
  securityDesc: {
    textAlign: 'center' as const,
    color: colors.textMuted,
    marginBottom: '48px',
    maxWidth: '600px',
    margin: '0 auto 48px',
  },
  securityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '24px',
    marginBottom: '48px',
  },
  securityCard: {
    background: colors.bgCard,
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    padding: '24px',
    textAlign: 'center' as const,
  },
  securityIcon: {
    fontSize: '40px',
    marginBottom: '16px',
  },
  securityCardTitle: {
    fontWeight: 700,
    color: colors.text,
    marginBottom: '8px',
  },
  securityCardDesc: {
    fontSize: '14px',
    color: colors.textMuted,
  },
  certGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '32px',
    textAlign: 'center' as const,
    background: colors.bgCard,
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    padding: '32px',
  },
  certValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: colors.primary,
  },
  certLabel: {
    fontSize: '14px',
    color: colors.textMuted,
  },
  // Footer
  footer: {
    borderTop: `1px solid ${colors.border}`,
    padding: '48px 24px',
    background: colors.bg,
  },
  footerInner: {
    maxWidth: '1280px',
    margin: '0 auto',
  },
  footerGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
    gap: '32px',
    marginBottom: '32px',
  },
  footerLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  footerDesc: {
    fontSize: '14px',
    color: colors.textMuted,
  },
  footerTitle: {
    fontWeight: 600,
    color: colors.text,
    fontSize: '14px',
    marginBottom: '12px',
  },
  footerLinks: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  footerLink: {
    fontSize: '14px',
    color: colors.textMuted,
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
  footerBottom: {
    paddingTop: '32px',
    borderTop: `1px solid ${colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copyright: {
    fontSize: '14px',
    color: colors.textMuted,
  },
  legalLinks: {
    display: 'flex',
    gap: '16px',
  },
};

const markets = [
  { symbol: 'BTC', name: 'Bitcoin', price: '$43,567.80', change: '+2.34%', up: true, volume: '$28.5B' },
  { symbol: 'ETH', name: 'Ethereum', price: '$2,345.60', change: '+3.12%', up: true, volume: '$15.2B' },
  { symbol: 'BNB', name: 'BNB', price: '$312.45', change: '-0.89%', up: false, volume: '$1.8B' },
  { symbol: 'SOL', name: 'Solana', price: '$98.72', change: '+5.67%', up: true, volume: '$2.4B' },
  { symbol: 'XRP', name: 'Ripple', price: '$0.62', change: '-1.23%', up: false, volume: '$1.2B' },
  { symbol: 'ADA', name: 'Cardano', price: '$0.58', change: '+1.45%', up: true, volume: '$890M' },
];

export default function LandingPage() {
  return (
    <div style={styles.page}>
      {/* Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navInner}>
          <div style={styles.logoWrap}>
            <Image src="/logo.png" alt="QUÂN SƯ ADS" width={32} height={32} style={styles.logoIcon} />
            <span style={styles.logoText}>QUÂN SƯ ADS</span>
          </div>
          <div style={styles.navLinks}>
            <a href="#markets" style={styles.navLink}>Tính năng</a>
            <a href="#security" style={styles.navLink}>Bảo mật</a>
          </div>
          <div style={styles.navRight}>
            <button style={styles.loginBtn}>Đăng nhập</button>
            <Link href="/dashboard" style={styles.btnPrimary}>Bắt đầu</Link>
          </div>
        </div>
      </nav>

      {/* Hero - Alex Hormozi Style */}
      <section style={styles.hero}>
        <div style={styles.heroGrid}>
          <div>
            <h1 style={styles.heroTitle}>
              Bạn đang <span style={styles.gradientText}>đốt tiền</span> vào quảng cáo<br />mà không biết tại sao?
            </h1>
            <p style={styles.heroDesc}>
              <strong>97% chủ shop</strong> chạy ads Facebook không biết chiến dịch nào đang lỗ. Họ tiếp tục đổ tiền vào "hố đen" mỗi ngày — cho đến khi tài khoản về 0.
            </p>
            <p style={{ ...styles.heroDesc, color: colors.primary, fontWeight: 600 }}>
              Đừng là một trong số họ.
            </p>
            <div style={styles.card}>
              <div style={styles.inputGroup}>
                <input type="email" placeholder="Email hoặc Số điện thoại" style={styles.input} />
                <Link href="/dashboard" style={styles.btnPrimary}>Xem chiến dịch lỗ</Link>
              </div>
              <p style={styles.rewardText}>
                Miễn phí. <span style={styles.rewardHighlight}>Không cần thẻ.</span> Biết ngay chiến dịch nào đang "ăn" tiền của bạn.
              </p>
            </div>
            <div style={styles.statsGrid}>
              <div>
                <div style={styles.statValue}>₫2.3B</div>
                <div style={styles.statLabel}>Tiền ads đã "cứu"</div>
              </div>
              <div>
                <div style={styles.statValue}>847</div>
                <div style={styles.statLabel}>Chiến dịch lỗ phát hiện</div>
              </div>
              <div>
                <div style={styles.statValue}>4.2x</div>
                <div style={styles.statLabel}>ROAS trung bình</div>
              </div>
            </div>
          </div>

          {/* Trading Widget Preview */}
          <div style={styles.tradingCard}>
            <div style={styles.tradingHeader}>
              <div style={styles.tradingPair}>
                <span style={styles.pairName}>CAMPAIGN/ROAS</span>
                <span style={styles.pairPrice}>3.2x</span>
                <span style={styles.pairChange}>+12.5%</span>
              </div>
              <div style={styles.tradingTabs}>
                <button style={styles.tabActive}>Live</button>
                <button style={styles.tabInactive}>History</button>
              </div>
            </div>
            <div style={styles.chartArea}>
              <svg width="100%" height="100%" viewBox="0 0 400 150">
                <defs>
                  <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#0ECB81" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#0ECB81" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,100 Q50,80 100,90 T200,60 T300,70 T400,30" fill="none" stroke="#0ECB81" strokeWidth="2" />
                <path d="M0,100 Q50,80 100,90 T200,60 T300,70 T400,30 V150 H0 Z" fill="url(#chartGrad)" />
              </svg>
            </div>
            <div style={styles.orderBook}>
              <div style={styles.orderSide}>
                <div style={styles.orderLabel}>Top Campaigns</div>
                <div style={styles.orderRow}><span style={styles.buyPrice}>Campaign A</span><span style={styles.orderQty}>ROAS 4.2</span></div>
                <div style={styles.orderRow}><span style={styles.buyPrice}>Campaign B</span><span style={styles.orderQty}>ROAS 3.8</span></div>
                <div style={styles.orderRow}><span style={styles.buyPrice}>Campaign C</span><span style={styles.orderQty}>ROAS 3.5</span></div>
              </div>
              <div style={styles.orderSideRight}>
                <div style={styles.orderLabel}>Cần tối ưu</div>
                <div style={styles.orderRow}><span style={styles.sellPrice}>Campaign X</span><span style={styles.orderQty}>ROAS 0.8</span></div>
                <div style={styles.orderRow}><span style={styles.sellPrice}>Campaign Y</span><span style={styles.orderQty}>ROAS 1.2</span></div>
                <div style={styles.orderRow}><span style={styles.sellPrice}>Campaign Z</span><span style={styles.orderQty}>ROAS 1.5</span></div>
              </div>
            </div>
            <div style={styles.tradingButtons}>
              <button style={styles.btnSuccess}>Scale Up</button>
              <button style={styles.btnError}>Pause Ads</button>
            </div>
          </div>
        </div>
      </section>

      {/* Markets Section */}
      <section id="markets" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Tính năng</h2>
            <p style={styles.sectionDesc}>Phân tích 100+ chiến dịch quảng cáo</p>
          </div>
          <button style={styles.btnSecondary}>Xem tất cả</button>
        </div>
        <div style={styles.card}>
          <table style={styles.table}>
            <thead style={styles.tableHead}>
              <tr>
                <th style={styles.th}>Tên</th>
                <th style={styles.thRight}>Giá</th>
                <th style={styles.thRight}>Thay đổi 24h</th>
                <th style={styles.thRight}>Volume 24h</th>
                <th style={styles.thRight}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m) => (
                <tr key={m.symbol} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.coinInfo}>
                      <div style={styles.coinIcon}>{m.symbol.slice(0, 2)}</div>
                      <div>
                        <div style={styles.coinName}>{m.symbol}</div>
                        <div style={styles.coinSymbol}>{m.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={styles.tdRight}><span style={styles.priceText}>{m.price}</span></td>
                  <td style={styles.tdRight}><span style={m.up ? styles.priceUp : styles.priceDown}>{m.change}</span></td>
                  <td style={styles.tdRight}><span style={styles.volumeText}>{m.volume}</span></td>
                  <td style={styles.tdRight}><button style={styles.tradeBtn}>Trade</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" style={styles.securitySection}>
        <div style={styles.securityInner}>
          <h2 style={styles.securityTitle}>
            Bảo mật <span style={styles.gradientText}>hàng đầu</span>
          </h2>
          <p style={styles.securityDesc}>
            Dữ liệu của bạn được bảo vệ với công nghệ bảo mật tiên tiến nhất.
          </p>
          <div style={styles.securityGrid}>
            <div style={styles.securityCard}>
              <div style={styles.securityIcon}>🔒</div>
              <h3 style={styles.securityCardTitle}>Mã hóa dữ liệu</h3>
              <p style={styles.securityCardDesc}>Dữ liệu được mã hóa end-to-end</p>
            </div>
            <div style={styles.securityCard}>
              <div style={styles.securityIcon}>🛡️</div>
              <h3 style={styles.securityCardTitle}>Meta Verified</h3>
              <p style={styles.securityCardDesc}>Đối tác chính thức của Meta</p>
            </div>
            <div style={styles.securityCard}>
              <div style={styles.securityIcon}>🔐</div>
              <h3 style={styles.securityCardTitle}>Xác thực 2 lớp</h3>
              <p style={styles.securityCardDesc}>Bảo vệ tài khoản an toàn</p>
            </div>
            <div style={styles.securityCard}>
              <div style={styles.securityIcon}>📊</div>
              <h3 style={styles.securityCardTitle}>Giám sát 24/7</h3>
              <p style={styles.securityCardDesc}>Theo dõi và phát hiện bất thường</p>
            </div>
          </div>
          <div style={styles.certGrid}>
            <div>
              <div style={styles.certValue}>SSL</div>
              <div style={styles.certLabel}>Encrypted</div>
            </div>
            <div>
              <div style={styles.certValue}>GDPR</div>
              <div style={styles.certLabel}>Compliant</div>
            </div>
            <div>
              <div style={styles.certValue}>99.9%</div>
              <div style={styles.certLabel}>Uptime</div>
            </div>
            <div>
              <div style={styles.certValue}>0</div>
              <div style={styles.certLabel}>Security Breaches</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <div style={styles.footerGrid}>
            <div>
              <div style={styles.footerLogo}>
                <Image src="/logo.png" alt="QUÂN SƯ ADS" width={32} height={32} style={styles.logoIcon} />
                <span style={styles.logoText}>QUÂN SƯ ADS</span>
              </div>
              <p style={styles.footerDesc}>Ngừng đốt tiền. Bắt đầu kiếm tiền.</p>
            </div>
            <div>
              <h4 style={styles.footerTitle}>Sản phẩm</h4>
              <div style={styles.footerLinks}>
                <a href="#" style={styles.footerLink}>Phân tích AI</a>
                <a href="#" style={styles.footerLink}>Dashboard</a>
                <a href="#" style={styles.footerLink}>Báo cáo</a>
              </div>
            </div>
            <div>
              <h4 style={styles.footerTitle}>Dịch vụ</h4>
              <div style={styles.footerLinks}>
                <a href="#" style={styles.footerLink}>API</a>
                <a href="#" style={styles.footerLink}>Tích hợp</a>
              </div>
            </div>
            <div>
              <h4 style={styles.footerTitle}>Hỗ trợ</h4>
              <div style={styles.footerLinks}>
                <a href="#" style={styles.footerLink}>Trung tâm hỗ trợ</a>
                <a href="#" style={styles.footerLink}>Liên hệ</a>
              </div>
            </div>
            <div>
              <h4 style={styles.footerTitle}>Công ty</h4>
              <div style={styles.footerLinks}>
                <a href="#" style={styles.footerLink}>Về chúng tôi</a>
                <a href="#" style={styles.footerLink}>Blog</a>
              </div>
            </div>
          </div>
          <div style={styles.footerBottom}>
            <p style={styles.copyright}>© 2026 QUÂN SƯ ADS. Đế Vương Ký.</p>
            <div style={styles.legalLinks}>
              <a href="#" style={styles.footerLink}>Điều khoản</a>
              <a href="#" style={styles.footerLink}>Bảo mật</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
