/**
 * ===================================================================
 * PAGE: MONITORING (GIÁM SÁT)
 * ===================================================================
 * Route: /dashboard/monitoring
 * 
 * Mô tả:
 * Page để theo dõi proposals đang được giám sát.
 * Hiển thị timeline D+1 → D+3 → D+7 và metrics comparison.
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import BangGiamSat from '@/components/BangGiamSat';

// ===================================================================
// CEX TRADING COLORS
// ===================================================================

const colors = {
    primary: '#F0B90B',
    bg: '#0B0E11',
    bgCard: '#181A20',
    text: '#EAECEF',
    textMuted: '#848E9C',
    border: '#2B3139',
};

// ===================================================================
// STYLES
// ===================================================================

const styles = {
    container: {
        minHeight: '100vh',
        background: colors.bg,
        fontFamily: 'Inter, -apple-system, sans-serif',
        color: colors.text,
    },
    header: {
        background: colors.bgCard,
        borderBottom: `1px solid ${colors.border}`,
        padding: '20px 32px',
    },
    backButton: {
        background: 'transparent',
        border: `1px solid ${colors.border}`,
        color: colors.text,
        padding: '10px 20px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: 600,
        transition: 'all 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
    },
};

// ===================================================================
// COMPONENT
// ===================================================================

export default function MonitoringPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    // ===================================================================
    // AUTHENTICATION
    // ===================================================================
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    if (status === 'loading' || status === 'unauthenticated') {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                background: colors.bg,
                color: colors.textMuted,
            }}>
                <p>Đang tải...</p>
            </div>
        );
    }

    // ===================================================================
    // RENDER
    // ===================================================================
    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <button
                    onClick={() => router.push('/dashboard')}
                    style={styles.backButton}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(240, 185, 11, 0.1)';
                        e.currentTarget.style.borderColor = colors.primary;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = colors.border;
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Quay lại Dashboard
                </button>
            </div>

            {/* Main Content */}
            <BangGiamSat userId={session?.user?.email || ''} />
        </div>
    );
}
