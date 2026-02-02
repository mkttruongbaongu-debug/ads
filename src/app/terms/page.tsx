export default function TermsPage() {
    return (
        <div style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '2rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: 1.6,
            color: '#333'
        }}>
            <h1 style={{ color: '#1a73e8', borderBottom: '2px solid #1a73e8', paddingBottom: '0.5rem' }}>
                Điều Khoản Sử Dụng
            </h1>
            <p><strong>Cập nhật lần cuối:</strong> 02/02/2026</p>

            <h2>1. Chấp nhận điều khoản</h2>
            <p>
                Bằng việc sử dụng QUÂN SƯ ADS, bạn đồng ý tuân thủ các điều khoản này.
                Nếu không đồng ý, vui lòng không sử dụng dịch vụ.
            </p>

            <h2>2. Mô tả dịch vụ</h2>
            <p>
                QUÂN SƯ ADS là công cụ quản lý và phân tích quảng cáo Facebook, cung cấp:
            </p>
            <ul>
                <li>Dashboard theo dõi hiệu suất quảng cáo</li>
                <li>Phân tích AI và gợi ý tối ưu</li>
                <li>Lưu trữ lịch sử dữ liệu</li>
                <li>Báo cáo xu hướng</li>
            </ul>

            <h2>3. Quyền và trách nhiệm của người dùng</h2>
            <ul>
                <li>Bạn chịu trách nhiệm bảo mật thông tin đăng nhập</li>
                <li>Bạn phải có quyền quản lý các tài khoản quảng cáo được kết nối</li>
                <li>Không sử dụng dịch vụ cho mục đích vi phạm pháp luật</li>
            </ul>

            <h2>4. Giới hạn trách nhiệm</h2>
            <p>
                Chúng tôi không chịu trách nhiệm về:
            </p>
            <ul>
                <li>Thiệt hại từ việc sử dụng hoặc không thể sử dụng dịch vụ</li>
                <li>Độ chính xác của dữ liệu từ Facebook API</li>
                <li>Quyết định quảng cáo dựa trên phân tích AI</li>
            </ul>

            <h2>5. Thay đổi điều khoản</h2>
            <p>
                Chúng tôi có thể cập nhật điều khoản này. Việc tiếp tục sử dụng dịch vụ
                sau khi thay đổi đồng nghĩa với việc bạn chấp nhận điều khoản mới.
            </p>

            <h2>6. Liên hệ</h2>
            <p>
                <strong>Email:</strong> caotruongbaongu@gmail.com<br />
                <strong>Website:</strong> https://ads.supbaongu.vn
            </p>

            <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: '#f5f5f5',
                borderRadius: '8px',
                textAlign: 'center'
            }}>
                <a href="/dashboard" style={{ color: '#1a73e8', textDecoration: 'none', fontWeight: 600 }}>
                    ← Quay lại Dashboard
                </a>
            </div>
        </div>
    );
}
