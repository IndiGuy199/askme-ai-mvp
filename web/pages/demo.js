import Link from 'next/link'
import Layout from '../components/Layout'

const BRAND = 'AI assisted recovery coach'

const features = [
  {
    icon: '🎯',
    heading: 'Personalized Playbook',
    body: 'Set up to 2 active recovery goals at a time. Each goal gets its own action plan — concrete daily tools tailored to your challenge.'
  },
  {
    icon: '⚡',
    heading: 'Instant Urge Support',
    body: 'When a craving or urge hits, open Urge Mode for 2-minute AI-guided support. Private. No stored chat unless you choose.'
  },
  {
    icon: '📊',
    heading: 'Weekly Insights Report',
    body: 'Track your urge patterns, action completions, and progress over time. AI generates a plain-English summary each week.'
  },
  {
    icon: '🤖',
    heading: 'AI-Suggested Goals & Actions',
    body: 'Not sure where to start? AI suggests goals and actions based on your challenge. Pick what fits, discard the rest.'
  },
  {
    icon: '🔒',
    heading: 'Private by Design',
    body: 'No social features. No public profiles. Your data is used only to personalize your coaching — never sold.'
  },
  {
    icon: '🔄',
    heading: 'Swap & Rotate Goals',
    body: 'Completed a goal or want to try a new approach? Swap goals in and out of your active plan without losing history.'
  }
]

const steps = [
  { number: '1', label: 'Sign up', detail: 'Enter your email — receive a magic link. No password needed.' },
  { number: '2', label: 'Set your challenges', detail: 'Pick what you\'re working on. We assign a specialized AI coach.' },
  { number: '3', label: 'Build your Playbook', detail: 'Choose goals and actions. Your coach suggests options; you decide.' },
  { number: '4', label: 'Use it daily', detail: 'Log urges, mark actions done, and get support in real time.' },
]

export default function Demo() {
  return (
    <Layout title={`Demo — ${BRAND}`}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'clamp(24px, 5vw, 60px) clamp(16px, 4vw, 24px)' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 6vw, 64px)' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            marginBottom: '24px'
          }}>
            <span style={{ fontSize: '2rem' }}>🧠</span>
          </div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>
            How {BRAND} works
          </h1>
          <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#64748b', maxWidth: '600px', margin: '0 auto 32px' }}>
            A private, AI-powered companion for building recovery habits — one goal, one action at a time.
          </p>
          <Link href="/login" style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white', fontWeight: 600, textDecoration: 'none',
            padding: '14px 36px', borderRadius: '999px', fontSize: '1rem'
          }}>
            Get started free →
          </Link>
          <div style={{ marginTop: '14px' }}>
            <a href="#insights-section" style={{ color: '#6366f1', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 500 }}>
              See what an insights report looks like ↓
            </a>
          </div>
        </div>

        {/* How it works steps */}
        <section style={{ marginBottom: 'clamp(48px, 7vw, 80px)' }}>
          <h2 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: 700, color: '#1e293b', marginBottom: '32px', textAlign: 'center' }}>
            Getting started in 4 steps
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px'
          }}>
            {steps.map(step => (
              <div key={step.number} style={{
                background: 'white', borderRadius: '16px', padding: '24px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.07)', textAlign: 'center'
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', color: 'white', fontWeight: 700, fontSize: '1.2rem'
                }}>{step.number}</div>
                <h3 style={{ fontWeight: 600, color: '#1e293b', marginBottom: '8px', fontSize: '1rem' }}>{step.label}</h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What you do daily */}
        <section style={{ marginBottom: 'clamp(48px, 7vw, 80px)' }}>
          <h2 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: 700, color: '#1e293b', marginBottom: '12px', textAlign: 'center' }}>
            What you do daily
          </h2>
          <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '32px', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 32px' }}>
            The whole system boils down to three repeating actions:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '560px', margin: '0 auto' }}>
            {[
              { n: '1', title: 'Pick a goal', detail: 'Choose from AI-suggested goals or search the library. You control what you work on.' },
              { n: '2', title: 'Pick 3 daily actions', detail: 'AI generates concrete options based on your goal. Pick what fits your life — discard the rest.' },
              { n: '3', title: 'Log urge before & after', detail: 'Rate your urge before and after completing an action. This single habit powers your entire insights report automatically.' },
            ].map(({ n, title, detail }) => (
              <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', background: 'white', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1rem' }}>{n}</div>
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>{title}</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Screenshot placeholder — Playbook view */}
        <section style={{ marginBottom: 'clamp(48px, 7vw, 80px)' }}>
          <h2 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: 700, color: '#1e293b', marginBottom: '16px', textAlign: 'center' }}>
            Your Playbook at a glance
          </h2>
          <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '24px', fontSize: '0.95rem' }}>
            Goals + actions in one focused view. No noise.
          </p>
          {/* Playbook UI mockup */}
          <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 4px 24px rgba(99,102,241,0.10)', padding: '28px 24px', border: '1px solid #e0e7ff' }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b', marginBottom: '18px' }}>📋 My Playbook</div>
            {/* Goal 1 */}
            <div style={{ background: '#f0f4ff', borderRadius: '12px', padding: '16px 18px', marginBottom: '12px', borderLeft: '4px solid #6366f1' }}>
              <div style={{ fontWeight: 600, color: '#4338ca', marginBottom: '10px', fontSize: '0.95rem' }}>Goal 1 — Reduce pornography use</div>
              {[['✅', 'Cold shower (5 min)', '#047857'], ['✅', 'Journaling — urge & trigger log', '#047857'], ['⬜', 'Evening accountability check-in', '#6b7280']].map(([icon, label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span>{icon}</span>
                  <span style={{ fontSize: '0.875rem', color }}>{label}</span>
                </div>
              ))}
            </div>
            {/* Goal 2 */}
            <div style={{ background: '#fdf4ff', borderRadius: '12px', padding: '16px 18px', borderLeft: '4px solid #a855f7' }}>
              <div style={{ fontWeight: 600, color: '#7e22ce', marginBottom: '10px', fontSize: '0.95rem' }}>Goal 2 — Build healthier habits</div>
              {[['✅', '20-min walk', '#047857'], ['⬜', 'Read 10 pages', '#6b7280']].map(([icon, label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span>{icon}</span>
                  <span style={{ fontSize: '0.875rem', color }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, background: '#f3f4f6', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', color: '#6b7280', textAlign: 'center' }}>🔥 4-day streak</div>
              <div style={{ flex: 1, background: '#eef2ff', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', color: '#4338ca', textAlign: 'center', fontWeight: 600 }}>📊 View insights report →</div>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section style={{ marginBottom: 'clamp(48px, 7vw, 80px)' }}>
          <h2 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: 700, color: '#1e293b', marginBottom: '32px', textAlign: 'center' }}>
            Built for real recovery work
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px'
          }}>
            {features.map(f => (
              <div key={f.heading} style={{
                background: 'white', borderRadius: '16px', padding: '24px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.07)'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{f.icon}</div>
                <h3 style={{ fontWeight: 600, color: '#1e293b', marginBottom: '8px', fontSize: '1rem' }}>{f.heading}</h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, lineHeight: 1.6 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Screenshot placeholder — insights */}
        <section style={{ marginBottom: 'clamp(48px, 7vw, 80px)' }} id="insights-section">
          <h2 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: 700, color: '#1e293b', marginBottom: '16px', textAlign: 'center' }}>
            Weekly insights, plain English
          </h2>
          <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '24px', fontSize: '0.95rem' }}>
            Track patterns, spot risks, get clear next steps.
          </p>
          {/* Insights report mockup */}
          <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 4px 24px rgba(99,102,241,0.10)', padding: '28px 24px', border: '1px solid #e0e7ff' }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b', marginBottom: '6px' }}>📊 Insights Report — Last 7 days</div>
            {/* Completeness bar */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px' }}>
                <span>Report completeness</span><span style={{ fontWeight: 700, color: '#10b981' }}>84%</span>
              </div>
              <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ width: '84%', height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '18px' }}>
              <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #10b981' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', marginBottom: '6px', textTransform: 'uppercase' }}>What's working</div>
                <div style={{ fontSize: '0.875rem', color: '#374151' }}>• Cold showers: 71% urge drop</div>
                <div style={{ fontSize: '0.875rem', color: '#374151' }}>• Journaling: strong consistency</div>
              </div>
              <div style={{ background: '#fef9ee', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', marginBottom: '6px', textTransform: 'uppercase' }}>High-risk times</div>
                <div style={{ fontSize: '0.875rem', color: '#374151' }}>• 9pm – 11pm most days</div>
                <div style={{ fontSize: '0.875rem', color: '#374151' }}>• Weekend mornings</div>
              </div>
            </div>
            <div style={{ background: '#eef2ff', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #6366f1' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3730a3', marginBottom: '6px', textTransform: 'uppercase' }}>Next experiment</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>Add a 9pm wind-down action to your plan</div>
              <div style={{ fontSize: '0.875rem', color: '#4338ca' }}>Your urge spikes at 9pm. A structured buffer activity reduces urge carry-over by an average of 40%.</div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '24px', padding: 'clamp(32px, 5vw, 56px) clamp(24px, 5vw, 48px)',
          textAlign: 'center', color: 'white'
        }}>
          <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 700, margin: '0 0 12px' }}>
            Ready to start?
          </h2>
          <p style={{ fontSize: '1rem', opacity: 0.85, margin: '0 0 28px', lineHeight: 1.6 }}>
            Create your account in under 60 seconds. No credit card required.
          </p>
          <Link href="/login" style={{
            display: 'inline-block',
            background: 'white', color: '#6d28d9', fontWeight: 700, textDecoration: 'none',
            padding: '14px 40px', borderRadius: '999px', fontSize: '1rem'
          }}>
            Sign in with your email →
          </Link>
        </div>
      </div>
    </Layout>
  )
}
