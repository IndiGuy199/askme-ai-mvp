import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#fff', minHeight: '100vh', color: '#111' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 16px 0 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: 16 }}>
          Over 45 and feeling stuck? Get support and guidance with <br />
          <span style={{ color: '#111' }}>AskMe AI.</span>
        </h1>
        <p style={{ fontSize: '1.25rem', marginBottom: 32, color: '#444' }}>
          Your AI wellness companion, ready to help you tackle life’s challenges and achieve your goals.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 40 }}>
          <button
            style={{
              background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 32px', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer',
            }}
            onClick={() => router.push('/login')}
          >
            Coach Me
          </button>
          <button
            style={{
              background: '#fff', color: '#2563eb', border: '2px solid #2563eb', borderRadius: 6, padding: '12px 32px', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Watch Demo
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 48, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h3 style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: 8 }}>Feeling overwhelmed?</h3>
            <p style={{ color: '#444', fontSize: '1rem' }}>
              Personal challenges and setbacks can leave you feeling lost and isolated. It’s hard to <i>face</i> someone who understands.
            </p>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h3 style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: 8 }}>Daily struggles</h3>
            <p style={{ color: '#444', fontSize: '1rem' }}>
              Managing stress, anger or setting goals is tough without support. You don’t have to do it alone.
            </p>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h3 style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: 8 }}>You need a plan</h3>
            <p style={{ color: '#444', fontSize: '1rem' }}>
              Without direction, it’s easy to lose track and feel discouraged. A clear plan can make all the difference.
            </p>
          </div>
        </div>
        <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 16 }}>
          Find a path forward with AskMe AI
        </h2>
        <p style={{ color: '#444', fontSize: '1.1rem', marginBottom: 40 }}>
          Talk through your issues, set achievable goals, and get personalized action steps – all from an AI coach that’s available anytime you need to chat.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ background: '#f9fafb', borderRadius: 12, padding: 24, minWidth: 220, flex: 1, marginBottom: 16, boxShadow: '0 2px 8px #0001' }}>
            <p style={{ fontStyle: 'italic', marginBottom: 12 }}>
              “AskMe AI has: been a incredible support. It’s like having a coach in my pocket. always ready to help.”
            </p>
            <div style={{ fontWeight: 600, color: '#222' }}>David R., Atianta, GA</div>
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 12, padding: 24, minWidth: 220, flex: 1, marginBottom: 16, boxShadow: '0 2px 8px #0001' }}>
            <p style={{ fontStyle: 'italic', marginBottom: 12 }}>
              “Working with AskMe AI gave me the perspective and tools I needed to tackle my challenges.”
            </p>
            <div style={{ fontWeight: 600, color: '#222' }}>James S., New York, NY</div>
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 12, padding: 24, minWidth: 220, flex: 1, marginBottom: 16, boxShadow: '0 2px 8px #0001' }}>
            <p style={{ fontStyle: 'italic', marginBottom: 12 }}>
              “A lifeline during tough times. I feel heard and guided towards positive change.”
            </p>
            <div style={{ fontWeight: 600, color: '#222' }}>Robert W., Dallas, TX</div>
          </div>
        </div>
      </div>
    </div>
  );
}