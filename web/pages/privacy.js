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
          <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>AI assisted recovery coach</span>
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
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: 16 }}>Privacy Policy</h1>
        <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: 40 }}>Last updated: February 18, 2026</p>

        {[{
          title: '1. What we collect',
          body: 'We collect the email address you sign up with, the profile information you provide (first name, age, goals), and the activity logs you create within the app (urge ratings, action completions). We do not collect sensitive financial details beyond what Stripe handles directly.'
        }, {
          title: '2. How we use your data',
          body: 'Your data is used solely to personalize your wellness coaching experience — generating goal suggestions, insights reports, and AI support sessions. We never sell your personal data to third parties.'
        }, {
          title: '3. Data storage & security',
          body: 'Your data is stored in Supabase, a SOC 2-compliant cloud database, with encryption in transit (TLS) and at rest (AES-256). Access is restricted to your account.'
        }, {
          title: '4. AI & third-party processors',
          body: 'We use OpenAI to generate coaching suggestions. Data sent to OpenAI is anonymized where possible and governed by OpenAI\'s data processing agreement. We do not use your data to train public models.'
        }, {
          title: '5. Your rights',
          body: 'You can request a copy of your data or ask us to delete everything at any time by emailing support@askmeai.app. We will process requests within 30 days.'
        }, {
          title: '6. Cookies',
          body: 'We use only essential cookies required for authentication (Supabase session). We do not use tracking or advertising cookies.'
        }, {
          title: '7. Changes to this policy',
          body: 'We may update this policy periodically. Material changes will be communicated via email or in-app notice before taking effect.'
        }, {
          title: '8. Contact',
          body: 'Questions about privacy? Email us at privacy@askmeai.app.'
        }].map(section => (
          <div key={section.title} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>{section.title}</h2>
            <p style={{ fontSize: '1rem', color: '#4b5563', lineHeight: 1.8 }}>{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
