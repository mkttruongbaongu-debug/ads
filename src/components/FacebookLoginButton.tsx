"use client";

import { useState, useCallback } from "react";

export default function FacebookLoginButton({ style }: { style?: React.CSSProperties }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            console.log("[FacebookLogin] Opening popup...");

            // Calculate popup position (center of screen)
            const width = 600;
            const height = 700;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;

            // Open popup window for Facebook OAuth
            const popup = window.open(
                `/api/auth/signin/facebook?callbackUrl=${encodeURIComponent(window.location.origin + '/dashboard')}`,
                'facebook-login',
                `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
            );

            if (!popup) {
                setError("Popup bị chặn! Vui lòng cho phép popup.");
                setLoading(false);
                return;
            }

            // Poll to check if popup closed
            const checkPopup = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkPopup);
                    setLoading(false);
                    // Refresh page to check session
                    window.location.reload();
                }
            }, 500);

        } catch (err) {
            console.error("[FacebookLogin] Exception:", err);
            setError(err instanceof Error ? err.message : "Lỗi không xác định");
            setLoading(false);
        }
    }, []);

    return (
        <button
            onClick={handleLogin}
            disabled={loading}
            style={{
                ...style,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
            }}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            {loading ? "Đang xác thực..." : "Đăng nhập"}
            {error && <span style={{ color: '#F6465D', fontSize: '11px', marginLeft: '4px' }}>⚠ {error}</span>}
        </button>
    );
}
