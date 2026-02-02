export default function DeleteDataPage() {
    return (
        <div style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '2rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: 1.6,
            color: '#333'
        }}>
            <h1 style={{ color: '#d93025', borderBottom: '2px solid #d93025', paddingBottom: '0.5rem' }}>
                🗑️ Yêu Cầu Xóa Dữ Liệu
            </h1>
            <p><strong>Cập nhật lần cuối:</strong> 02/02/2026</p>

            <div style={{
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem'
            }}>
                <strong>⚠️ Lưu ý:</strong> Việc xóa dữ liệu là không thể hoàn tác.
                Tất cả thông tin liên quan đến tài khoản của bạn sẽ bị xóa vĩnh viễn.
            </div>

            <h2>Dữ liệu chúng tôi lưu trữ</h2>
            <ul>
                <li>Token xác thực Facebook</li>
                <li>Lịch sử dữ liệu quảng cáo (campaigns, insights)</li>
                <li>Cấu hình tài khoản</li>
            </ul>

            <h2>Cách yêu cầu xóa dữ liệu</h2>

            <h3>Phương pháp 1: Email</h3>
            <p>
                Gửi email đến <a href="mailto:caotruongbaongu@gmail.com" style={{ color: '#1a73e8' }}>
                    caotruongbaongu@gmail.com</a> với tiêu đề: <strong>"Yêu cầu xóa dữ liệu - [Tên/ID của bạn]"</strong>
            </p>
            <p>Nội dung email cần bao gồm:</p>
            <ul>
                <li>Facebook User ID hoặc Email đăng nhập</li>
                <li>Tên tài khoản quảng cáo (nếu có)</li>
                <li>Lý do xóa (tùy chọn)</li>
            </ul>

            <h3>Phương pháp 2: Thu hồi quyền trực tiếp</h3>
            <ol>
                <li>Truy cập <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" style={{ color: '#1a73e8' }}>
                    Cài đặt Facebook → Business Integrations
                </a></li>
                <li>Tìm ứng dụng "QUÂN SƯ ADS"</li>
                <li>Click "Xóa" hoặc "Remove"</li>
            </ol>

            <h2>Thời gian xử lý</h2>
            <p>
                Chúng tôi sẽ xử lý yêu cầu xóa dữ liệu trong vòng <strong>7 ngày làm việc</strong>.
                Bạn sẽ nhận được email xác nhận khi hoàn tất.
            </p>

            <h2>Liên hệ</h2>
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
