/**
 * /playbook/insights - Detailed Insights Report
 * Time-filtered insights with comparison and heatmap visualization
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';

export default function InsightsReport() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [rangeKey, setRangeKey] = useState('last_7_days');
  const [compareMode, setCompareMode] = useState('previous_period');
  const [error, setError] = useState(null);
  const [showMissing, setShowMissing] = useState(false);

  // Auth check
  useEffect(() => {
    let mounted = true;

    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!session) {
          router.push('/login');
          return;
        }

        setUser(session.user);
        setLoading(false);
      } catch (error) {
        console.error('Error in getSession:', error);
        if (mounted) {
          setLoading(false);
          router.push('/login');
        }
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      if (!session) {
        router.push('/login');
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session.user);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // Fetch insights when filters change
  useEffect(() => {
    if (user) {
      fetchInsights();
    }
  }, [user, rangeKey, compareMode]);

  async function fetchInsights() {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/coach/insights-detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          range_key: rangeKey,
          compare_mode: compareMode,
          track_id: 'porn_recovery'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch insights');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching insights:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatRangeLabel(key) {
    const labels = {
      'last_7_days': 'Last 7 days',
      'last_30_days': 'Last 30 days',
      'last_90_days': 'Last 90 days',
      'since_beginning': 'Since beginning'
    };
    return labels[key] || key;
  }

  function formatCompareModeLabel(mode) {
    const labels = {
      'previous_period': 'Previous period',
      'baseline': 'Baseline',
      'none': 'None'
    };
    return labels[mode] || mode;
  }

  const currentMetrics = data?.snapshot?.metrics;
  const currentInsights = data?.snapshot?.insights;
  const compareMetrics = data?.compare_snapshot?.metrics;
  const delta = data?.delta;
  const completeness = data?.report_completeness || { percent_complete: 0, missing_metrics: [], coverage: {} };

  // Show loading during auth check
  if (loading && !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Loading...</div>
          <div style={{ color: '#6b7280' }}>Checking authentication</div>
        </div>
      </div>
    );
  }

  // Don't render if no user (will redirect)
  if (!user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Insights Report - AskMe AI</title>
      </Head>

      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          padding: '2rem',
          color: 'white'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <Link href="/playbook" style={{ color: 'white', opacity: 0.8, textDecoration: 'none' }}>
                ← Back to Playbook
              </Link>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>
              Insights Report
            </h1>
            <p style={{ opacity: 0.9, margin: 0 }}>
              Your recovery patterns over time • Compare snapshots • Find what works
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                Time Range
              </label>
              <select
                value={rangeKey}
                onChange={(e) => setRangeKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '1rem'
                }}
              >
                <option value="last_7_days">Last 7 days</option>
                <option value="last_30_days">Last 30 days</option>
                <option value="last_90_days">Last 90 days</option>
                <option value="since_beginning">Since beginning</option>
              </select>
            </div>

            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                Compare to
              </label>
              <select
                value={compareMode}
                onChange={(e) => setCompareMode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '1rem'
                }}
              >
                <option value="previous_period">Previous period</option>
                <option value="baseline">Baseline</option>
                <option value="none">None</option>
              </select>
            </div>

            <button
              onClick={fetchInsights}
              disabled={loading}
              style={{
                backgroundColor: '#6366f1',
                color: 'white',
                padding: '0.5rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                alignSelf: 'flex-end'
              }}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Report Completeness Indicator */}
        {!loading && data && (
          <div style={{ maxWidth: '1200px', margin: '0 auto 2rem', padding: '0 1rem' }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: '#374151' }}>
                  Report Completeness
                </h3>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: completeness.percent_complete >= 80 ? '#10b981' : completeness.percent_complete >= 50 ? '#f59e0b' : '#ef4444' }}>
                  {completeness.percent_complete}%
                </span>
              </div>
              
              {/* Progress bar */}
              <div style={{ height: '12px', backgroundColor: '#e5e7eb', borderRadius: '6px', overflow: 'hidden', marginBottom: '1rem' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${completeness.percent_complete}%`,
                    background: completeness.percent_complete >= 80 ? 'linear-gradient(90deg, #10b981, #34d399)' : completeness.percent_complete >= 50 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ef4444, #f87171)',
                    transition: 'width 0.3s'
                  }}
                ></div>
              </div>

              {/* Missing metrics */}
              {completeness.missing_metrics.length > 0 && (
                <>
                  <button
                    onClick={() => setShowMissing(!showMissing)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6366f1',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: '0.5rem 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>What's missing ({completeness.missing_metrics.length})</span>
                    <span style={{ transform: showMissing ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
                  </button>

                  {showMissing && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {completeness.missing_metrics.map((missing, idx) => (
                        <div key={idx} style={{
                          padding: '1rem',
                          backgroundColor: '#fef3c7',
                          borderRadius: '8px',
                          borderLeft: '4px solid #f59e0b'
                        }}>
                          <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#92400e' }}>
                            {missing.label}
                          </h4>
                          <p style={{ fontSize: '0.875rem', margin: '0 0 0.5rem 0', color: '#78350f' }}>
                            <strong>Why:</strong> {missing.why_it_matters}
                          </p>
                          <p style={{ fontSize: '0.875rem', margin: '0 0 0.75rem 0', color: '#78350f' }}>
                            <strong>Fix:</strong> {missing.how_to_fix}
                          </p>
                          <a
                            href={missing.cta.href}
                            style={{
                              display: 'inline-block',
                              padding: '0.5rem 1rem',
                              backgroundColor: '#f59e0b',
                              color: 'white',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              fontWeight: '600',
                              fontSize: '0.875rem'
                            }}
                          >
                            {missing.cta.label} →
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {completeness.percent_complete === 100 && (
                <div style={{ padding: '1rem', backgroundColor: '#d1fae5', borderRadius: '8px', textAlign: 'center', color: '#065f46' }}>
                  ✓ Your report has complete data coverage!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{ maxWidth: '1200px', margin: '0 auto 2rem', padding: '0 1rem' }}>
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '1rem',
              color: '#991b1b'
            }}>
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !data && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            <div style={{ fontSize: '1.5rem' }}>Loading insights...</div>
          </div>
        )}

        {/* Main Content */}
        {!loading && data && currentMetrics && currentInsights && (
          <div style={{ maxWidth: '1200px', margin: '0 auto 3rem', padding: '0 1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              
              {/* Snapshot: This Period */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                borderLeft: '4px solid #6366f1'
              }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
                  This period
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#374151' }}>
                  <li style={{ marginBottom: '0.5rem' }}>
                    • Completions: {currentMetrics.activity.done_count} / {currentMetrics.activity.actions_planned} ({Math.round(currentMetrics.activity.completion_rate * 100)}%)
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    • Strongest risk window: {currentInsights.risk_window}
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    • Best tools: {currentInsights.best_tool}
                  </li>
                  <li>
                    • Slip/Binge: {currentMetrics.slips.slip_count} slip{currentMetrics.slips.slip_count !== 1 ? 's' : ''}, {currentMetrics.slips.second_session_rate !== null ? `${currentMetrics.slips.second_session_rate}%` : 'N/A'} second session rate
                  </li>
                </ul>
              </div>

              {/* Snapshot: Previous Period (if compare enabled) */}
              {compareMode !== 'none' && compareMetrics && (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  borderLeft: '4px solid #d97706'
                }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
                    {compareMode === 'baseline' ? 'Baseline' : 'Previous period'}
                  </h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#374151' }}>
                    <li style={{ marginBottom: '0.5rem' }}>
                      • Completions: {compareMetrics.activity?.done_count || 0} / {compareMetrics.activity?.actions_planned || 0} ({Math.round((compareMetrics.activity?.completion_rate || 0) * 100)}%)
                    </li>
                    <li style={{ marginBottom: '0.5rem' }}>
                      • Avg urge drop: {compareMetrics.urge?.avg_drop !== null ? compareMetrics.urge.avg_drop.toFixed(1) : 'N/A'}
                    </li>
                    <li>
                      • Slips: {compareMetrics.slips?.slip_count || 0}
                    </li>
                  </ul>
                </div>
              )}

              {/* What Changed (Delta) */}
              {delta && (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  borderLeft: '4px solid #10b981',
                  gridColumn: compareMode === 'none' ? '1 / -1' : 'auto'
                }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
                    What changed (delta)
                  </h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#374151' }}>
                    <li style={{ marginBottom: '0.5rem' }}>
                      {delta.completion_rate_change >= 0 ? '▲' : '▼'} Completion rate {delta.completion_rate_change >= 0 ? '+' : ''}{Math.round(delta.completion_rate_change * 100)}pts
                    </li>
                    {delta.avg_drop_change !== null && (
                      <li style={{ marginBottom: '0.5rem' }}>
                        {delta.avg_drop_change >= 0 ? '▲' : '▼'} Urge drop {delta.avg_drop_change >= 0 ? '+' : ''}{delta.avg_drop_change.toFixed(1)}
                      </li>
                    )}
                    <li>
                      {delta.slip_count_change <= 0 ? '▼' : '▲'} Slips {delta.slip_count_change > 0 ? '+' : ''}{delta.slip_count_change}
                    </li>
                  </ul>
                  {currentInsights.compare_summary && (
                    <p style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.9rem' }}>
                      {currentInsights.compare_summary}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Risk Window Heatmap */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
                Risk Window Heatmap (hourly)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.5rem' }}>
                {Array.from({ length: 24 }, (_, hour) => {
                  const hourData = currentMetrics.risk_window.top_hours.find(h => h.hour === hour);
                  const intensity = hourData ? Math.min(hourData.count / 5, 1) : 0;
                  const bgColor = hourData?.signal === 'urge_spike' 
                    ? `rgba(239, 68, 68, ${0.3 + intensity * 0.7})` // red
                    : `rgba(99, 102, 241, ${0.2 + intensity * 0.6})`; // purple

                  return (
                    <div
                      key={hour}
                      style={{
                        backgroundColor: intensity > 0 ? bgColor : '#f3f4f6',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        textAlign: 'center',
                        fontSize: '0.75rem',
                        fontWeight: intensity > 0 ? 'bold' : 'normal',
                        color: intensity > 0.5 ? 'white' : '#6b7280'
                      }}
                      title={hourData ? `${hourData.count} events at ${hour}:00 (${hourData.signal})` : `${hour}:00`}
                    >
                      {hour}
                    </div>
                  );
                })}
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                Tap an hour block to see triggers + recommended pre-steps. Darker = more activity.
              </p>
            </div>

            {/* Tools That Worked */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>
                  Tools that worked (by urge drop)
                </h3>
                {completeness.coverage?.tools && (
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    Coverage: {completeness.coverage.tools.pct}%
                  </span>
                )}
              </div>
              
              {completeness.coverage?.tools?.available && currentMetrics.tools.best_categories.length > 0 ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {currentMetrics.tools.best_categories.map((tool, idx) => {
                      // Determine confidence
                      const confidence = tool.count >= 10 ? 'high' : tool.count >= 5 ? 'medium' : 'low';
                      const confidenceColor = confidence === 'high' ? '#10b981' : confidence === 'medium' ? '#f59e0b' : '#6b7280';
                      
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ flex: '0 0 180px', fontWeight: '600', color: '#374151' }}>
                            {tool.category.replace(/_/g, ' ')}
                          </div>
                          <div style={{ flex: '1', height: '24px', backgroundColor: '#e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${tool.score * 100}%`,
                                backgroundColor: '#6366f1',
                                transition: 'width 0.3s'
                              }}
                            ></div>
                          </div>
                          <div style={{ flex: '0 0 60px', textAlign: 'right', fontWeight: 'bold', color: '#6366f1' }}>
                            {Math.round(tool.score * 100)}%
                          </div>
                          <div style={{ flex: '0 0 240px', fontSize: '0.875rem', color: '#6b7280' }}>
                            {tool.why}
                            <div style={{ fontSize: '0.75rem', color: confidenceColor, marginTop: '0.25rem' }}>
                              Confidence: {confidence} • {tool.count} samples
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {completeness.coverage.tools.pct < 100 && completeness.coverage.tools.reasons.length > 0 && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fef3c7', borderRadius: '6px', fontSize: '0.875rem', color: '#78350f' }}>
                      ⚠ {completeness.coverage.tools.reasons.join(', ')}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔧</div>
                  <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Not enough tool usage data yet</p>
                  <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1rem' }}>
                    To unlock: Complete actions with urge ratings in different categories
                  </p>
                  <a
                    href="/playbook"
                    style={{
                      display: 'inline-block',
                      padding: '0.5rem 1rem',
                      backgroundColor: '#6366f1',
                      color: 'white',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontWeight: '600',
                      fontSize: '0.875rem'
                    }}
                  >
                    Go to Playbook →
                  </a>
                </div>
              )}
            </div>

            {/* Detailed Insights */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
                Detailed Insights
              </h3>
              <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', margin: 0, color: '#374151', lineHeight: '1.8' }}>
                {currentInsights.insights.map((insight, idx) => (
                  <li key={idx}>{insight}</li>
                ))}
              </ul>

              {currentInsights.next_experiment && (
                <div style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '8px',
                  borderLeft: '4px solid #10b981'
                }}>
                  <h4 style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#047857' }}>
                    🧪 Next experiment: {currentInsights.next_experiment.title}
                  </h4>
                  <p style={{ color: '#374151', marginBottom: '0.75rem' }}>
                    {currentInsights.next_experiment.why}
                  </p>
                  <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', margin: 0, color: '#374151' }}>
                    {currentInsights.next_experiment.steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Cached Indicator */}
            {data.cached && (
              <div style={{ textAlign: 'center', padding: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                ✓ Cached report (refreshes automatically every 6 hours or when new actions logged)
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
