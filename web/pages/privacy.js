import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Privacy() {
  const router = useRouter();

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#fff', minHeight: '100vh', color: '#111' }}>
      {/* Top Navigation */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.5rem 3rem',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => router.push('/')}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>A</span>
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>AskMe AI</span>
        </div>
        <button
          style={{
            background: '#fff',
            color: '#2563eb',
            border: '2px solid #e5e7eb',
            borderRadius: 6,
            padding: '8px 24px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
          onClick={() => router.push('/')}
        >
          Back to Home
        </button>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: 32 }}>Privacy Policy</h1>
        <p style={{ fontSize: '1.1rem', color: '#666', lineHeight: 1.8, marginBottom: 24 }}>
          Your privacy is important to us. This page will contain our full privacy policy.
        </p>
        <p style={{ fontSize: '1rem', color: '#888', lineHeight: 1.8 }}>
          Coming soon...
        </p>
      </div>
    </div>
  );
}
