export default function PrivacyPage() {
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
                Chính Sách Quyền Riêng Tư
            </h1>
            <p><strong>Cập nhật lần cuối:</strong> 02/02/2026</p>

            <h2>1. Giới thiệu</h2>
            <p>
                QUÂN SƯ ADS ("chúng tôi", "của chúng tôi") cam kết bảo vệ quyền riêng tư của bạn.
                Chính sách này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ thông tin của bạn
                khi sử dụng ứng dụng quản lý quảng cáo Facebook của chúng tôi.
            </p>

            <h2>2. Thông tin chúng tôi thu thập</h2>
            <ul>
                <li><strong>Thông tin tài khoản Facebook:</strong> ID tài khoản, tên, quyền truy cập quảng cáo</li>
                <li><strong>Dữ liệu quảng cáo:</strong> Thống kê chiến dịch, chi phí, hiệu suất (thông qua Facebook Marketing API)</li>
                <li><strong>Token xác thực:</strong> Access token để truy cập dữ liệu quảng cáo của bạn</li>
            </ul>

            <h2>3. Cách chúng tôi sử dụng thông tin</h2>
            <ul>
                <li>Hiển thị báo cáo và phân tích quảng cáo</li>
                <li>Cung cấp gợi ý tối ưu hóa bằng AI</li>
                <li>Lưu trữ lịch sử dữ liệu để theo dõi xu hướng</li>
            </ul>

            <h2>4. Bảo mật dữ liệu</h2>
            <p>
                Chúng tôi sử dụng các biện pháp bảo mật tiêu chuẩn ngành để bảo vệ dữ liệu của bạn:
            </p>
            <ul>
                <li>Mã hóa SSL/TLS cho tất cả kết nối</li>
                <li>Token được lưu trữ an toàn và tự động làm mới</li>
                <li>Không chia sẻ dữ liệu với bên thứ ba</li>
            </ul>

            <h2>5. Quyền của bạn</h2>
            <ul>
                <li>Truy cập và xem dữ liệu của bạn</li>
                <li>Yêu cầu xóa dữ liệu</li>
                <li>Thu hồi quyền truy cập bất kỳ lúc nào</li>
            </ul>

            <h2>6. Xóa dữ liệu</h2>
            <p>
                Để yêu cầu xóa dữ liệu của bạn, vui lòng liên hệ: <br />
                <strong>Email:</strong> caotruongbaongu@gmail.com
            </p>

            <h2>7. Liên hệ</h2>
            <p>
                Nếu có thắc mắc về chính sách này, vui lòng liên hệ:<br />
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
