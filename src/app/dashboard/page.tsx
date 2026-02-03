'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    if (status === 'loading') {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fafafa',
            }}>
                <p style={{ color: '#666' }}>Đang tải...</p>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return null;
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#fafafa',
        }}>
            {/* Header */}
            <header style={{
                background: '#18181b',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>
                        QUÂN SƯ ADS
                    </span>
                    <span style={{
                        background: '#22c55e',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        color: 'white',
                    }}>
                        v2.0 - Rebuilding
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {session?.user && (
                        <span style={{ color: 'white', fontSize: '0.875rem' }}>
                            👤 {session.user.name}
                        </span>
                    )}
                    <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                        }}
                    >
                        Đăng xuất
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main style={{
                maxWidth: '1200px',
                margin: '0 auto',
                padding: '48px 24px',
            }}>
                <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '48px',
                    textAlign: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}>
                    <h1 style={{
                        fontSize: '2rem',
                        fontWeight: 700,
                        color: '#18181b',
                        marginBottom: '16px',
                    }}>
                        🚧 Dashboard đang được xây dựng lại
                    </h1>

                    <p style={{
                        color: '#71717a',
                        fontSize: '1.125rem',
                        maxWidth: '500px',
                        margin: '0 auto 32px',
                        lineHeight: 1.6,
                    }}>
                        Chúng tôi đang thiết kế lại giao diện để mang đến trải nghiệm tốt hơn.
                    </p>

                    <div style={{
                        background: '#f4f4f5',
                        borderRadius: '12px',
                        padding: '24px',
                        maxWidth: '400px',
                        margin: '0 auto',
                    }}>
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#18181b',
                            marginBottom: '12px',
                        }}>
                            ✅ Đã hoàn thành:
                        </h3>
                        <ul style={{
                            listStyle: 'none',
                            padding: 0,
                            margin: 0,
                            textAlign: 'left',
                            color: '#52525b',
                        }}>
                            <li style={{ padding: '4px 0' }}>• Đăng nhập Facebook OAuth</li>
                            <li style={{ padding: '4px 0' }}>• Kết nối Facebook Ads API</li>
                            <li style={{ padding: '4px 0' }}>• Token management</li>
                        </ul>
                    </div>

                    <div style={{
                        marginTop: '32px',
                        padding: '16px',
                        background: '#fffbeb',
                        borderRadius: '8px',
                        border: '1px solid #fde68a',
                    }}>
                        <p style={{ color: '#92400e', margin: 0 }}>
                            💬 Bác hãy cho biết yêu cầu về giao diện và chức năng mới!
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
