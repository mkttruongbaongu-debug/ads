"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function FacebookLoginButton({ style }: { style?: React.CSSProperties }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        setLoading(true);
        setError(null);

        try {
            console.log("[FacebookLogin] Starting OAuth flow...");

            const result = await signIn("facebook", {
                callbackUrl: "/dashboard",
                redirect: true,
            });

            console.log("[FacebookLogin] Result:", result);

            if (result?.error) {
                setError(result.error);
                console.error("[FacebookLogin] Error:", result.error);
            }
        } catch (err) {
            console.error("[FacebookLogin] Exception:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

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
            {loading ? "Đang kết nối..." : "Đăng nhập"}
            {error && <span style={{ color: 'red', fontSize: '12px' }}> ({error})</span>}
        </button>
    );
}
