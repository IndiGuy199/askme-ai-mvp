import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();

  return (
    <>
      <style jsx>{`
        @media (max-width: 767px) {
          .nav-links { display: none !important; }
          .hero-buttons { flex-direction: column !important; }
          .feature-cards { flex-direction: column !important; }
          .testimonial-cards { flex-direction: column !important; }
        }
      `}</style>
      <div style={{ fontFamily: 'Inter, sans-serif', background: '#fff', minHeight: '100vh', color: '#111' }}>
        {/* Wrapper div to contain all sections */}
        {/* Top Navigation */}
        <nav style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'clamp(1rem, 3vw, 1.5rem) clamp(1.5rem, 5vw, 3rem)',
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
          <span style={{ fontSize: 'clamp(1rem, 4vw, 1.25rem)', fontWeight: 700 }}>AskMe AI</span>
        </div>
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(1rem, 3vw, 2rem)', flexWrap: 'wrap' }}>
          <a href="#how-it-works" style={{ color: '#444', textDecoration: 'none', fontWeight: 500, fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>How it works</a>
          <a href="#privacy" style={{ color: '#444', textDecoration: 'none', fontWeight: 500, fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>Privacy</a>
          <a href="#pricing" style={{ color: '#444', textDecoration: 'none', fontWeight: 500, fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>Pricing</a>
          <a href="/faq" style={{ color: '#444', textDecoration: 'none', fontWeight: 500, fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>FAQ</a>
          <button
            style={{
              background: '#fff',
              color: '#2563eb',
              border: '2px solid #e5e7eb',
              borderRadius: 6,
              padding: 'clamp(6px, 1.5vw, 8px) clamp(16px, 4vw, 24px)',
              fontSize: 'clamp(0.85rem, 2vw, 1rem)',
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: '40px'
            }}
            onClick={() => router.push('/login')}
          >
            Sign in
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(40px, 8vw, 80px) clamp(16px, 4vw, 16px) 0 clamp(16px, 4vw, 16px)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 700, marginBottom: 'clamp(16px, 3vw, 24px)', lineHeight: 1.2 }}>
          Private 2-minute urge support<br />
          that doesn't ask for explicit details.
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 3vw, 1.3rem)', marginBottom: 'clamp(24px, 4vw, 40px)', color: '#666' }}>
          Use Urge Mode instantly. No account needed. Save only what you choose.
        </p>
        <div className="hero-buttons" style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: 'clamp(12px, 2.5vw, 14px) clamp(24px, 5vw, 40px)',
              fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              minHeight: '44px',
              minWidth: 'clamp(140px, 40vw, 180px)'
            }}
            onClick={() => router.push('/support-now')}
          >
            Support Now
          </button>
          <button
            style={{
              background: '#fff',
              color: '#2563eb',
              border: '2px solid #e5e7eb',
              borderRadius: 6,
              padding: 'clamp(12px, 2.5vw, 14px) clamp(24px, 5vw, 40px)',
              fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)',
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: '44px',
              minWidth: 'clamp(140px, 40vw, 180px)'
            }}
            onClick={() => alert('Demo video coming soon!')}
          >
            Watch Demo
          </button>
        </div>
        <p style={{ fontSize: 'clamp(0.8rem, 2vw, 0.9rem)', color: '#888', marginBottom: 'clamp(40px, 8vw, 80px)' }}>
          No explicit logs • Stealth mode • Delete anytime
        </p>

        {/* Three Feature Cards */}
        <div className="feature-cards" style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(16px, 4vw, 32px)', marginBottom: 'clamp(50px, 10vw, 100px)', flexWrap: 'wrap' }}>
          <div style={{
            background: '#f9fafb',
            borderRadius: 12,
            padding: 'clamp(20px, 4vw, 32px)',
            minWidth: 'clamp(240px, 80vw, 260px)',
            flex: 1,
            maxWidth: 340,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            textAlign: 'left'
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              fontSize: '1.5rem'
            }}>🔵</div>
            <h3 style={{ fontWeight: 700, fontSize: 'clamp(1.05rem, 2.5vw, 1.2rem)', marginBottom: 12 }}>In-the-moment protocols</h3>
            <p style={{ color: '#666', fontSize: 'clamp(0.9rem, 2vw, 1rem)', lineHeight: 1.6 }}>
              3 taps → a calm 2-minute plan that interrupts the loop.
            </p>
          </div>

          <div style={{
            background: '#f9fafb',
            borderRadius: 12,
            padding: 'clamp(20px, 4vw, 32px)',
            minWidth: 'clamp(240px, 80vw, 260px)',
            flex: 1,
            maxWidth: 340,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            textAlign: 'left'
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              fontSize: '1.5rem'
            }}>📊</div>
            <h3 style={{ fontWeight: 700, fontSize: 'clamp(1.05rem, 2.5vw, 1.2rem)', marginBottom: 12 }}>Weekly pattern report</h3>
            <p style={{ color: '#666', fontSize: 'clamp(0.9rem, 2vw, 1rem)', lineHeight: 1.6 }}>
              See risk windows, triggers, and what actually works for you.
            </p>
          </div>

          <div style={{
            background: '#f9fafb',
            borderRadius: 12,
            padding: 'clamp(20px, 4vw, 32px)',
            minWidth: 'clamp(240px, 80vw, 260px)',
            flex: 1,
            maxWidth: 340,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            textAlign: 'left'
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              fontSize: '1.5rem'
            }}>🔒</div>
            <h3 style={{ fontWeight: 700, fontSize: 'clamp(1.05rem, 2.5vw, 1.2rem)', marginBottom: 12 }}>Privacy controls</h3>
            <p style={{ color: '#666', fontSize: 'clamp(0.9rem, 2vw, 1rem)', lineHeight: 1.6 }}>
              No-save mode, auto-delete, stealth notifications, and one-click delete.
            </p>
          </div>
        </div>

        {/* Social Proof / Testimonials */}
        <h2 style={{ fontWeight: 700, fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: 'clamp(24px, 5vw, 48px)' }}>
          Trusted by privacy-conscious users
        </h2>
        <div className="testimonial-cards" style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(16px, 3vw, 24px)', marginBottom: 'clamp(40px, 8vw, 80px)', flexWrap: 'wrap' }}>
          <div style={{
            background: '#f9fafb',
            borderRadius: 12,
            padding: 'clamp(20px, 4vw, 32px)',
            minWidth: 'clamp(240px, 80vw, 260px)',
            flex: 1,
            maxWidth: 340,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            textAlign: 'left'
          }}>
            <p style={{ fontStyle: 'italic', marginBottom: 16, fontSize: 'clamp(0.95rem, 2.5vw, 1.05rem)', lineHeight: 1.6 }}>
              "I used the 2-minute reset instead of spiraling. It's practical."
            </p>
            <div style={{ fontWeight: 600, color: '#222', fontSize: 'clamp(0.85rem, 2vw, 0.95rem)' }}>— David R., Atlanta</div>
          </div>
          <div style={{
            background: '#f9fafb',
            borderRadius: 12,
            padding: 'clamp(20px, 4vw, 32px)',
            minWidth: 'clamp(240px, 80vw, 260px)',
            flex: 1,
            maxWidth: 340,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            textAlign: 'left'
          }}>
            <p style={{ fontStyle: 'italic', marginBottom: 16, fontSize: 'clamp(0.95rem, 2.5vw, 1.05rem)', lineHeight: 1.6 }}>
              "The weekly report showed my late-night window. That changed everything."
            </p>
            <div style={{ fontWeight: 600, color: '#222', fontSize: 'clamp(0.85rem, 2vw, 0.95rem)' }}>— James S., New York</div>
          </div>
          <div style={{
            background: '#f9fafb',
            borderRadius: 12,
            padding: 'clamp(20px, 4vw, 32px)',
            minWidth: 'clamp(240px, 80vw, 260px)',
            flex: 1,
            maxWidth: 340,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            textAlign: 'left'
          }}>
            <p style={{ fontStyle: 'italic', marginBottom: 16, fontSize: 'clamp(0.95rem, 2.5vw, 1.05rem)', lineHeight: 1.6 }}>
              "No-save mode made me comfortable trying it. The controls feel real."
            </p>
            <div style={{ fontWeight: 600, color: '#222', fontSize: 'clamp(0.85rem, 2vw, 0.95rem)' }}>— Robert W., Dallas</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: 'clamp(20px, 4vw, 32px)',
          paddingBottom: 'clamp(20px, 4vw, 32px)',
          marginTop: 'clamp(40px, 8vw, 80px)',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(16px, 3vw, 24px)', fontSize: 'clamp(0.85rem, 2vw, 0.95rem)', flexWrap: 'wrap' }}>
            <Link href="/privacy" style={{ color: '#666', textDecoration: 'none' }}>Privacy</Link>
            <span style={{ color: '#ddd' }}>•</span>
            <Link href="/terms" style={{ color: '#666', textDecoration: 'none' }}>Terms</Link>
            <span style={{ color: '#ddd' }}>•</span>
            <Link href="/contact" style={{ color: '#666', textDecoration: 'none' }}>Contact</Link>
          </div>
        </div>
      </div>
      {/* Close outer wrapper div */}
      </div>
    </>
  );
}
