import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Terms() {
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
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: 16 }}>Terms of Service</h1>
        <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: 40 }}>Last updated: February 18, 2026</p>

        {[{
          title: '1. Who can use this service',
          body: 'You must be at least 18 years old to use AI assisted recovery coach. By creating an account you confirm that you meet this requirement.'
        }, {
          title: '2. What this service is',
          body: 'AI assisted recovery coach provides AI-powered wellness guidance to help you build healthier habits and break compulsive cycles. It is a wellness tool, not a licensed medical or mental health service. Nothing in this app constitutes clinical advice, diagnosis, or treatment.'
        }, {
          title: '3. Your account',
          body: 'You are responsible for maintaining the confidentiality of your account credentials. You may delete your account and all associated data at any time by contacting us.'
        }, {
          title: '4. Acceptable use',
          body: 'You agree not to use this service for any unlawful purpose, to attempt to reverse-engineer the AI systems, or to share your account with others.'
        }, {
          title: '5. Limitation of liability',
          body: 'This service is provided "as is". We are not liable for decisions you make based on wellness suggestions. Always consult a qualified professional for medical or mental health concerns.'
        }, {
          title: '6. Changes to these terms',
          body: 'We may update these terms from time to time. We will notify you of significant changes via email or an in-app notice.'
        }, {
          title: '7. Contact',
          body: 'Questions about these terms? Email us at support@askmeai.app.'
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
