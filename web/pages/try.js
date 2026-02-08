import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function TryUrgeMode() {
  const router = useRouter();
  const [track, setTrack] = useState('');
  const [intensity, setIntensity] = useState(5);
  const [emotions, setEmotions] = useState([]);
  const [timeAvailable, setTimeAvailable] = useState(2);
  const [protocolStarted, setProtocolStarted] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [protocol, setProtocol] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completedSteps, setCompletedSteps] = useState({});

  const emotionOptions = ['Stressed', 'Lonely', 'Bored', 'Anxious', 'Restless', 'Ashamed'];

  const toggleEmotion = (emotion) => {
    if (emotions.includes(emotion)) {
      setEmotions(emotions.filter(e => e !== emotion));
    } else if (emotions.length < 2) {
      setEmotions([...emotions, emotion]);
    }
  };

  const startProtocol = async () => {
    setLoading(true);
    setError('');
    setProtocolStarted(false);
    setOutcome('');
    setCompletedSteps({});

    try {
      // Determine context based on time of day
      const hour = new Date().getHours();
      let context = 'unknown';
      if (hour >= 22 || hour < 6) {
        context = 'late_night';
      }

      // Map emotions to lowercase for API
      const emotionsLower = emotions.map(e => e.toLowerCase());

      const response = await fetch('/api/generate-protocol', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          track: track ? track.toLowerCase().replace(/ /g, '_') : 'prefer_not_to_say',
          intensity,
          emotions: emotionsLower,
          timeAvailable,
          context,
          constraints: []
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate protocol');
      }

      const data = await response.json();
      setProtocol(data.protocol);
      setProtocolStarted(true);
    } catch (err) {
      console.error('Error generating protocol:', err);
      setError('Failed to generate protocol. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOutcome = (result) => {
    setOutcome(result);
  };

  const toggleStep = (index) => {
    setCompletedSteps(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <>
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .grid-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 32px;
        }
        @media (min-width: 1024px) {
          .grid-container {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 32px;
          }
        }
        .card {
          background: #fff;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          min-width: 0;
          width: 100%;
        }
        @media (min-width: 640px) {
          .card {
            padding: 24px;
          }
        }
        @media (min-width: 1024px) {
          .card {
            padding: 32px;
          }
        }
        .time-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        @media (max-width: 639px) {
          .time-buttons {
            flex-direction: column;
          }
        }
      `}</style>
      <div style={{ fontFamily: 'Inter, sans-serif', background: '#f9fafb', minHeight: '100vh', color: '#111', overflowX: 'hidden' }}>
        {/* Top Navigation */}
        <nav style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'clamp(0.75rem, 2vw, 1rem) clamp(1rem, 3vw, 1.5rem)',
          maxWidth: '1400px',
          margin: '0 auto',
          background: '#fff',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', minWidth: 0 }} onClick={() => router.push('/')}>
            <div style={{
              width: 'clamp(28px, 6vw, 32px)',
              height: 'clamp(28px, 6vw, 32px)',
              borderRadius: '50%',
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span style={{ color: '#fff', fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', fontWeight: 700 }}>A</span>
            </div>
            <span style={{ fontSize: 'clamp(1rem, 4vw, 1.25rem)', fontWeight: 700 }}>AskMe AI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.5rem, 2vw, 1rem)', flexWrap: 'wrap' }}>
            <Link href="#privacy" style={{ color: '#666', textDecoration: 'none', fontWeight: 500, fontSize: 'clamp(0.85rem, 2vw, 0.95rem)' }}>Privacy</Link>
            <button
              style={{
                background: '#fff',
                color: '#2563eb',
                border: '2px solid #e5e7eb',
                borderRadius: 6,
                padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 20px)',
                fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: '40px'
              }}
              onClick={() => router.push('/')}
            >
              Exit
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(16px, 3vw, 24px) clamp(16px, 4vw, 40px)' }}>
          {/* Title Section */}
          <div style={{ textAlign: 'center', marginBottom: 'clamp(24px, 5vw, 48px)' }}>
            <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 700, marginBottom: 12 }}>Try Urge Mode</h1>
            <p style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)', color: '#666' }}>
              3 taps → a calm plan. Nothing is saved.
            </p>
          </div>

          {/* Two Column Layout */}
          <div className="grid-container">
            {/* Left Card: Inputs */}
            <div className="card">
            <h2 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.3rem)', fontWeight: 700, marginBottom: 'clamp(16px, 3vw, 24px)' }}>What&apos;s happening right now?</h2>
              
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 'clamp(0.85rem, 2vw, 0.95rem)' }}>
                  Track (optional)
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['Porn', 'Sex', 'Food', 'Prefer not to say'].map((option) => (
                    <button
                      key={option}
                      onClick={() => setTrack(track === option ? '' : option)}
                      style={{
                        background: track === option ? '#2563eb' : '#fff',
                        color: track === option ? '#fff' : '#444',
                        border: '2px solid ' + (track === option ? '#2563eb' : '#e5e7eb'),
                        borderRadius: 6,
                        padding: '8px 16px',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Intensity Slider */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 'clamp(0.85rem, 2vw, 0.95rem)' }}>
                  Intensity
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={intensity}
                  onChange={(e) => setIntensity(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: '#2563eb'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666', marginTop: 4 }}>
                  <span>1</span>
                  <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '1.1rem' }}>{intensity}</span>
                  <span>10</span>
                </div>
              </div>

              {/* Emotion Chips */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 'clamp(0.85rem, 2vw, 0.95rem)' }}>
                  Emotion (pick up to 2)
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                  {emotionOptions.map((emotion) => (
                    <button
                      key={emotion}
                      onClick={() => toggleEmotion(emotion)}
                      disabled={!emotions.includes(emotion) && emotions.length >= 2}
                      style={{
                        background: emotions.includes(emotion) ? '#2563eb' : '#fff',
                        color: emotions.includes(emotion) ? '#fff' : '#444',
                        border: '2px solid ' + (emotions.includes(emotion) ? '#2563eb' : '#e5e7eb'),
                        borderRadius: 6,
                        padding: '8px 16px',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        cursor: (!emotions.includes(emotion) && emotions.length >= 2) ? 'not-allowed' : 'pointer',
                        opacity: (!emotions.includes(emotion) && emotions.length >= 2) ? 0.5 : 1
                      }}
                    >
                      {emotion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Available */}
              <div style={{ marginBottom: 32 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 'clamp(0.85rem, 2vw, 0.95rem)' }}>
                  Time available
                </label>
                <div className="time-buttons">
                  {[{ label: '2 min', value: 2 }, { label: '10 min', value: 10 }, { label: '20 min', value: 20 }].map((time) => (
                    <button
                      key={time.value}
                      onClick={() => setTimeAvailable(time.value)}
                      style={{
                        background: timeAvailable === time.value ? '#2563eb' : '#fff',
                        color: timeAvailable === time.value ? '#fff' : '#444',
                        border: '2px solid ' + (timeAvailable === time.value ? '#2563eb' : '#e5e7eb'),
                        borderRadius: 6,
                        padding: '10px 20px',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        flex: 1
                      }}
                    >
                      {time.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={startProtocol}
                disabled={loading}
                style={{
                  width: '100%',
                  background: loading ? '#94a3b8' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: 'clamp(12px, 2.5vw, 14px)',
                  fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                  minHeight: '44px'
                }}
              >
                {loading ? 'Generating...' : `Start ${timeAvailable}-Min Protocol`}
              </button>
              <p style={{ textAlign: 'center', marginTop: 12, fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', color: '#888' }}>
                Nothing you enter here is saved.
              </p>
              {error && (
                <p style={{ textAlign: 'center', marginTop: 8, fontSize: '0.9rem', color: '#dc2626' }}>
                  {error}
                </p>
              )}
            </div>

            {/* Right Card: Protocol */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'clamp(16px, 3vw, 24px)', flexWrap: 'wrap', gap: '12px', minWidth: 0 }}>
                <h2 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.3rem)', fontWeight: 700, minWidth: 0, flex: 1, wordBreak: 'break-word' }}>
                  {protocol ? protocol.title : `${timeAvailable}-Minute Reset`}
                </h2>
                <div style={{
                  background: '#dbeafe',
                  color: '#2563eb',
                  padding: '6px 16px',
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}>
                  {protocol ? `${protocol.duration_minutes}:00` : `${timeAvailable}:00`}
                </div>
              </div>

              {!protocolStarted ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                  <p style={{ fontSize: '1.1rem' }}>Fill out the form and click &quot;Start Protocol&quot; to begin.</p>
                </div>
              ) : loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid #e5e7eb',
                    borderTop: '4px solid #2563eb',
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <p style={{ fontSize: '1.1rem' }}>Generating your personalized protocol...</p>
                </div>
              ) : (
                <>
                  {/* Objective */}
                  {protocol?.objective && (
                    <div style={{
                      background: '#f0f9ff',
                      padding: 16,
                      borderRadius: 8,
                      marginBottom: 24,
                      borderLeft: '4px solid #2563eb'
                    }}>
                      <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>Objective:</p>
                      <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: '#1e3a8a' }}>{protocol.objective}</p>
                    </div>
                  )}

                  {/* Protocol Steps */}
                  <div style={{ marginBottom: 32 }}>
                    {protocol?.steps?.map((step, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          gap: 12,
                          marginBottom: 16,
                          padding: 12,
                          background: completedSteps[index] ? '#f0fdf4' : '#f9fafb',
                          borderRadius: 8,
                          alignItems: 'flex-start',
                          border: completedSteps[index] ? '1px solid #86efac' : '1px solid transparent'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={completedSteps[index] || false}
                          onChange={() => toggleStep(index)}
                          style={{
                            width: 18,
                            height: 18,
                            marginTop: 2,
                            cursor: 'pointer',
                            accentColor: '#2563eb'
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4, flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#2563eb',
                              background: '#dbeafe',
                              padding: '2px 8px',
                              borderRadius: 4,
                              flexShrink: 0
                            }}>
                              {typeof step.minute === 'number' ? `${step.minute} min` : step.minute}
                            </span>
                            <span style={{ fontSize: 'clamp(0.85rem, 2vw, 0.95rem)', fontWeight: 600, lineHeight: 1.6, wordBreak: 'break-word' }}>{step.action}</span>
                          </div>
                          {step.why && (
                            <p style={{ fontSize: 'clamp(0.75rem, 1.8vw, 0.85rem)', color: '#666', marginLeft: 0, fontStyle: 'italic', wordBreak: 'break-word' }}>
                              {step.why}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Safety Note */}
                  {protocol?.safety_and_privacy_note && (
                    <div style={{
                      background: '#fef3c7',
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 24,
                      borderLeft: '4px solid #f59e0b'
                    }}>
                      <p style={{ fontSize: '0.85rem', color: '#92400e', lineHeight: 1.5 }}>
                        ℹ️ {protocol.safety_and_privacy_note}
                      </p>
                    </div>
                  )}

                  {/* Outcome Buttons */}
                  {!outcome && (
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: 12, fontSize: 'clamp(0.85rem, 2vw, 0.95rem)' }}>How are you feeling?</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minWidth: 0 }}>
                        {['Urge passed', 'Reduced', 'Still strong', 'I slipped'].map((option) => (
                          <button
                            key={option}
                            onClick={() => handleOutcome(option)}
                            style={{
                              background: '#fff',
                              color: '#444',
                              border: '2px solid #e5e7eb',
                              borderRadius: 6,
                              padding: '10px 16px',
                              fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              minWidth: 0,
                              wordBreak: 'break-word'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.borderColor = '#2563eb';
                              e.target.style.background = '#f0f9ff';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.borderColor = '#e5e7eb';
                              e.target.style.background = '#fff';
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {outcome && (
                    <div>
                      <div style={{
                        background: '#f0fdf4',
                        border: '2px solid #86efac',
                        borderRadius: 8,
                        padding: 16,
                        textAlign: 'center',
                        marginBottom: 16
                      }}>
                        <p style={{ fontWeight: 600, color: '#15803d', marginBottom: 8 }}>
                          Response recorded: {outcome}
                        </p>
                        <p style={{ fontSize: '0.9rem', color: '#166534' }}>
                          Great job completing the protocol.
                        </p>
                      </div>

                      {/* Show escalation info if intensity is still high */}
                      {protocol?.escalation_if_still_strong && outcome === 'Still strong' && (
                        <div style={{
                          background: '#fef2f2',
                          border: '2px solid #fca5a5',
                          borderRadius: 8,
                          padding: 16,
                          marginBottom: 16
                        }}>
                          <p style={{ fontWeight: 600, color: '#991b1b', marginBottom: 8 }}>
                            {protocol.escalation_if_still_strong.trigger}
                          </p>
                          <p style={{ fontSize: '0.9rem', color: '#7f1d1d', marginBottom: 8 }}>
                            Next step: {protocol.escalation_if_still_strong.next_step}
                          </p>
                          {protocol.escalation_if_still_strong.upgrade_protocol && (
                            <button
                              onClick={() => {
                                const minutes = protocol.escalation_if_still_strong.upgrade_protocol === '10_min' ? 10 : 20;
                                setTimeAvailable(minutes);
                                setProtocolStarted(false);
                                setOutcome('');
                                setProtocol(null);
                              }}
                              style={{
                                background: '#dc2626',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '8px 16px',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                marginTop: 8
                              }}
                            >
                              Upgrade to {protocol.escalation_if_still_strong.upgrade_protocol === '10_min' ? '10' : '20'} min protocol
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Bottom Card: Conversion */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 'clamp(24px, 5vw, 40px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            textAlign: 'center'
          }}>
            <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 1.8rem)', fontWeight: 700, marginBottom: 16 }}>
              Want this to get smarter for you?
            </h2>
            <p style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.05rem)', color: '#666', marginBottom: 'clamp(24px, 4vw, 32px)', maxWidth: 700, margin: '0 auto', marginBottom: 'clamp(24px, 4vw, 32px)' }}>
              Create a private account to save your playbook and see weekly patterns. You can use No-Save Mode anytime.
            </p>
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push('/login')}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: 'clamp(10px, 2vw, 12px) clamp(24px, 5vw, 32px)',
                  fontSize: 'clamp(0.95rem, 2.5vw, 1.05rem)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                  minHeight: '44px',
                  minWidth: 'clamp(140px, 40vw, 180px)'
                }}
              >
                Create account
              </button>
              <button
                onClick={() => router.push('/')}
                style={{
                  background: '#fff',
                  color: '#444',
                  border: '2px solid #e5e7eb',
                  borderRadius: 6,
                  padding: 'clamp(10px, 2vw, 12px) clamp(24px, 5vw, 32px)',
                  fontSize: 'clamp(0.95rem, 2.5vw, 1.05rem)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '44px',
                  minWidth: 'clamp(140px, 40vw, 180px)'
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
