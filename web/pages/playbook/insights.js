/**
 * /playbook/insights - Detailed Insights Report
 * Time-filtered insights with comparison and heatmap visualization
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';
import { 
  mapCategoryToLabel, 
  mapCategoryToDescription, 
  mapRiskConfidence,
  shouldRenderHeatmap,
  shouldRenderStrategies
} from '../../lib/coach-ai/completeness';

const MIN_EVENTS_FOR_HEATMAP = 10;
const MIN_EVENTS_FOR_TOOLS = 5;

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
      } else if (event === 'SIGNED_IN') {
        // Only set user on actual sign-in, not token refreshes.
        // TOKEN_REFRESHED fires on every scroll/focus restoration and would
        // create a new object reference, triggering a full insights re-fetch.
        setUser(session.user);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // Fetch insights when filters change — depend on user ID not the object reference
  // to avoid re-fetching on TOKEN_REFRESHED which creates a new user object each time.
  useEffect(() => {
    if (user) {
      fetchInsights();
    }
  }, [user?.id, rangeKey, compareMode]);  // eslint-disable-line react-hooks/exhaustive-deps

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
      'previous_period': 'Compare period',
      'baseline': 'Baseline',
      'none': 'None'
    };
    return labels[mode] || mode;
  }

  const currentMetrics = data?.snapshot?.metrics;
  const currentInsights = data?.snapshot?.insights;
  const compareMetrics = data?.compare_snapshot?.metrics;
  const delta = data?.delta;
  const completeness = data?.report_completeness || { percent_complete: 0, missing_metrics: [], improvement_items: [], coverage: {} };
  // Top 2 items to improve (hard-missing first, then soft improvements)
  const allActionItems = [...(completeness.missing_metrics || []), ...(completeness.improvement_items || [])];
  const topImprovements = allActionItems.slice(0, 2);
  const nextSteps = allActionItems.slice(0, 3);

  /**
   * Canonical recovery insights renderer.
   * Handles all three schema versions:
   *   v1 OLD: { insights: string[], risk_window, best_tool, best_lever, next_experiment }
   *   v2 MID: { summary, what_is_working[], where_you_are_vulnerable[], patterns_and_triggers[], next_experiment, slips_section?, compare_summary? }
   *   v3 NEW: { summary_paragraph, whats_working[], where_vulnerable[], patterns_triggers[], slip_analysis, one_experiment, compare_section }
   *
   * INVARIANT (dev): if insightBullets.length > 0 at least one subsection must render.
   */
  function renderRecoveryInsights(ins) {
    if (!ins) return null;

    // ── Detect schema version ──────────────────────────────────────────────
    const isV3 = Array.isArray(ins.whats_working);
    const isV2 = !isV3 && Array.isArray(ins.what_is_working);
    // Flat old-schema bullets (v1 only)
    const insightBullets = !isV3 && !isV2 && Array.isArray(ins.insights) ? ins.insights : [];

    // ── Derive subsection arrays ───────────────────────────────────────────
    let workingBullets = [];
    let vulnerableBullets = [];
    let patternBullets = [];
    let summaryText = '';
    let slipAnalysis = null;   // { pattern, anti_binge_rule, repair_step } | null
    let experiment = null;     // { title, why, steps[] }

    if (isV3) {
      // v3 stable schema
      summaryText      = ins.summary_paragraph || '';
      workingBullets   = ins.whats_working || [];
      vulnerableBullets = ins.where_vulnerable || [];
      patternBullets   = ins.patterns_triggers || [];
      slipAnalysis     = ins.slip_analysis || null;
      experiment       = ins.one_experiment || null;
    } else if (isV2) {
      // v2 intermediate schema
      summaryText       = ins.summary || '';
      workingBullets    = ins.what_is_working || [];
      vulnerableBullets = ins.where_you_are_vulnerable || [];
      patternBullets    = ins.patterns_and_triggers || [];
      slipAnalysis      = ins.slips_section || null;
      experiment        = ins.next_experiment || null;
    } else if (insightBullets.length > 0) {
      // v1 old flat schema — partition by keywords
      const positiveKw = ['great', 'good', 'excellent', 'strong', 'working', 'helpful', 'success', 'progress', 'consistent', 'high completion', 'completion rate'];
      const adjustKw   = ['risk', 'vulnerable', 'urge', 'spike', 'low', 'consider', 'try', 'increase', 'add', 'reduce', 'avoid'];

      workingBullets    = insightBullets.filter(b => positiveKw.some(k => b.toLowerCase().includes(k)));
      patternBullets    = insightBullets.filter(b => adjustKw.some(k => b.toLowerCase().includes(k)) && !workingBullets.includes(b));
      vulnerableBullets = insightBullets.filter(b => !workingBullets.includes(b) && !patternBullets.includes(b));

      if (workingBullets.length === 0 && insightBullets.length > 0) workingBullets = [insightBullets[0]];
      if (patternBullets.length === 0 && insightBullets.length > 1) patternBullets = [insightBullets[insightBullets.length - 1]];
      experiment = ins.next_experiment || null;

      if (ins.best_tool && ins.best_tool !== 'still learning') {
        summaryText = `Top tool: ${ins.best_tool}${ins.best_lever ? ' · lever: ' + ins.best_lever : ''}${ins.risk_window && ins.risk_window !== 'not enough data' ? ' · risk window: ' + ins.risk_window : ''}.`;
      }
    } else {
      // Empty / unknown schema — use next_experiment if available
      experiment = ins.next_experiment || ins.one_experiment || null;
    }

    // Dev-only invariant
    if (process.env.NODE_ENV !== 'production' && insightBullets.length > 0) {
      const totalRendered = workingBullets.length + vulnerableBullets.length + patternBullets.length;
      if (totalRendered === 0) {
        console.warn('[insights] INVARIANT VIOLATION: insightBullets.length=' + insightBullets.length + ' but all subsections are empty. Check partition logic.');
      }
    }

    const noDataMsg = (
      <p style={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>
        Not enough data yet — log 3 more actions with urge ratings to unlock this section.
      </p>
    );

    const BulletList = ({ bullets, color }) => (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#374151', lineHeight: '1.8' }}>
        {bullets.map((bullet, idx) => (
          <li key={idx} style={{ marginBottom: '0.5rem', paddingLeft: '1.5rem', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, color }}>{'\u2022'}</span>
            {bullet}
          </li>
        ))}
      </ul>
    );

    return (
      <>
        {/* Summary paragraph */}
        {summaryText ? (
          <p style={{ fontSize: '1rem', color: '#374151', lineHeight: '1.7', margin: '0 0 1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
            {summaryText}
          </p>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* What's working */}
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>{'\u2713'}</span> What&apos;s working
            </h4>
            {workingBullets.length > 0 ? <BulletList bullets={workingBullets} color="#10b981" /> : noDataMsg}
          </div>

          {/* Where you're vulnerable */}
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>{'⚠'}</span> Where you&apos;re vulnerable
            </h4>
            {vulnerableBullets.length > 0 ? <BulletList bullets={vulnerableBullets} color="#f59e0b" /> : noDataMsg}
          </div>

          {/* Patterns & triggers */}
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#4338ca', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>{'\uD83D\uDD0D'}</span> Patterns &amp; triggers
            </h4>
            {patternBullets.length > 0 ? <BulletList bullets={patternBullets} color="#6366f1" /> : noDataMsg}
          </div>

          {/* Slip analysis — only when present */}
          {slipAnalysis && (
            <div style={{ padding: '1rem', background: '#fef2f2', borderLeft: '4px solid #dc2626', borderRadius: '8px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>{'💙'}</span> Slip analysis
              </h4>
              <p style={{ margin: '0 0 0.5rem', color: '#374151', lineHeight: '1.7' }}><strong>Pattern:</strong> {slipAnalysis.pattern}</p>
              <p style={{ margin: '0 0 0.5rem', color: '#374151', lineHeight: '1.7' }}><strong>Anti-binge rule:</strong> {slipAnalysis.anti_binge_rule}</p>
              <p style={{ margin: 0, color: '#374151', lineHeight: '1.7' }}><strong>Repair step:</strong> {slipAnalysis.repair_step}</p>
            </div>
          )}
        </div>

        {/* One experiment */}
        {experiment && (
          <div style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: '#f0fdf4', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🧪</span> One experiment for next week
            </h4>
            <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>
              {experiment.title}
            </div>
            {experiment.why && (
              <p style={{ color: '#374151', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                {experiment.why}
              </p>
            )}
            {Array.isArray(experiment.steps) && experiment.steps.length > 0 && (
              <>
                <div style={{ fontSize: '0.875rem', color: '#065f46', fontWeight: '500', marginBottom: '0.5rem' }}>Steps:</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#374151', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  {experiment.steps.map((step, idx) => (
                    <li key={idx} style={{ marginBottom: '0.25rem', paddingLeft: '1.5rem', position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: '#10b981', fontWeight: '600' }}>{idx + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </>
    );
  }

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
                <option value="previous_period">Compare period</option>
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
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: '#374151' }}>
                  Report completeness
                </h3>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: completeness.percent_complete >= 80 ? '#10b981' : completeness.percent_complete >= 50 ? '#f59e0b' : '#ef4444' }}>
                  {completeness.percent_complete}%
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height: '8px', backgroundColor: '#e5e7eb', borderRadius: '6px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                <div style={{
                  height: '100%',
                  width: `${completeness.percent_complete}%`,
                  background: completeness.percent_complete >= 80 ? 'linear-gradient(90deg, #10b981, #34d399)' : completeness.percent_complete >= 50 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ef4444, #f87171)',
                  transition: 'width 0.3s'
                }} />
              </div>

              {/* Inline quick tips */}
              {completeness.percent_complete < 100 && topImprovements.length > 0 && (
                <div style={{ marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', margin: '0 0 0.4rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    To improve this report:
                  </p>
                  {completeness.missing_metrics?.length === 0 && completeness.improvement_items?.length > 0 && (
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.5rem 0', fontStyle: 'italic' }}>
                      No blockers — adding more data will increase the accuracy of these insights.
                    </p>
                  )}
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {topImprovements.map((item, idx) => (
                      <li key={`tip-${idx}`} style={{ fontSize: '0.875rem', color: '#374151', marginBottom: idx < topImprovements.length - 1 ? '0.25rem' : 0, paddingLeft: '1.25rem', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, color: '#6366f1' }}>→</span>
                        {item.how_to_fix}
                        {item.threshold_text && <span style={{ color: '#9ca3af', marginLeft: '0.5rem', fontSize: '0.75rem' }}>({item.threshold_text})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Collapsible full panel */}
              {allActionItems.length > 0 && (
                <button
                  onClick={() => setShowMissing(!showMissing)}
                  style={{ background: 'none', border: 'none', color: '#6366f1', fontWeight: '600', cursor: 'pointer', padding: '0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'space-between' }}
                >
                  <span>How to improve ({allActionItems.length})</span>
                  <span style={{ transform: showMissing ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
                </button>
              )}

              {showMissing && allActionItems.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Hard-missing (amber) */}
                  {(completeness.missing_metrics || []).map((item, idx) => (
                    <div key={`missing-${idx}`} style={{ padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', margin: '0 0 0.4rem 0', color: '#92400e' }}>{item.label}</h4>
                      <p style={{ fontSize: '0.875rem', margin: '0 0 0.4rem 0', color: '#78350f' }}><strong>Why it matters:</strong> {item.why_it_matters}</p>
                      <p style={{ fontSize: '0.875rem', margin: '0 0 0.6rem 0', color: '#78350f' }}><strong>How to fix:</strong> {item.how_to_fix}</p>
                      {item.cta && (
                        <a href={item.cta.href} style={{ display: 'inline-block', padding: '0.4rem 0.9rem', backgroundColor: '#f59e0b', color: 'white', borderRadius: '6px', textDecoration: 'none', fontWeight: '600', fontSize: '0.875rem' }}>
                          {item.cta.label} →
                        </a>
                      )}
                    </div>
                  ))}
                  {/* Soft improvements (indigo) */}
                  {(completeness.improvement_items || []).map((item, idx) => (
                    <div key={`improve-${idx}`} style={{ padding: '1rem', backgroundColor: '#eef2ff', borderRadius: '8px', borderLeft: '4px solid #6366f1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', margin: 0, color: '#3730a3' }}>{item.label}</h4>
                        {item.threshold_text && <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: '500', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>{item.threshold_text}</span>}
                      </div>
                      <p style={{ fontSize: '0.875rem', margin: '0 0 0.6rem 0', color: '#4338ca' }}>{item.how_to_fix}</p>
                      {item.cta && (
                        <a href={item.cta.href} style={{ display: 'inline-block', padding: '0.4rem 0.9rem', backgroundColor: '#6366f1', color: 'white', borderRadius: '6px', textDecoration: 'none', fontWeight: '600', fontSize: '0.875rem' }}>
                          {item.cta.label} →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {completeness.percent_complete === 100 && (
                <div style={{ padding: '1rem', backgroundColor: '#d1fae5', borderRadius: '8px', textAlign: 'center', color: '#065f46', marginTop: '0.5rem' }}>
                  ✓ Your report has complete data for this selected period.
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
          <div style={{ maxWidth: '1200px', margin: '0 auto 3rem', padding: '0 1rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              
              {/* Snapshot: Selected Period */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                borderLeft: '4px solid #6366f1'
              }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
                  Selected period
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                  Data from actions active during this time range
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#374151' }}>
                  <li style={{ marginBottom: '0.5rem' }}>
                    • Actions completed: {currentMetrics.activity.done_count} done{currentMetrics.activity.partial_count > 0 ? `, ${currentMetrics.activity.partial_count} partial` : ''}
                  </li>
                  {currentMetrics.urge?.avg_drop !== null && currentMetrics.urge?.avg_drop !== undefined && (
                    <li style={{ marginBottom: '0.5rem' }}>
                      • Urge change: {currentMetrics.urge.avg_drop.toFixed(1)} points lower on average ({currentMetrics.urge.avg_before?.toFixed(1)} → {currentMetrics.urge.avg_after?.toFixed(1)})
                    </li>
                  )}
                  {shouldRenderHeatmap(completeness?.meta?.total_events_in_range || 0, MIN_EVENTS_FOR_HEATMAP) && currentMetrics.risk_window?.top_hours?.length > 0 && (
                    <li style={{ marginBottom: '0.5rem' }}>
                      • High-risk time: {currentMetrics.risk_window.top_hours[0].hour}:00
                    </li>
                  )}
                  {currentMetrics.tools?.best_categories?.[0] && (
                    <li style={{ marginBottom: '0.5rem' }}>
                      • Top helper: {mapCategoryToLabel(currentMetrics.tools.best_categories[0].category)}
                    </li>
                  )}
                </ul>
              </div>

              {/* Snapshot: Compare Period (if compare enabled) */}
              {compareMode !== 'none' && compareMetrics && (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  borderLeft: '4px solid #d97706'
                }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
                    Compare period
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                      {compareMode === 'baseline' ? 'Your initial baseline data' : 'Selected compare period for side-by-side progress'}
                  </p>
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
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#1f2937' }}>
                    What changed
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                    Compared to {compareMode === 'baseline' ? 'your initial baseline' : 'the compare period'}
                  </p>
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
                  {/* compare_section — v3 schema: always has label; bullets may be [] */}
                  {currentInsights?.compare_section && (
                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {currentInsights.compare_section.label}
                      </p>
                      {Array.isArray(currentInsights.compare_section.bullets) && currentInsights.compare_section.bullets.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#374151', fontSize: '0.9rem', lineHeight: '1.7' }}>
                          {currentInsights.compare_section.bullets.map((b, i) => (
                            <li key={i} style={{ marginBottom: '0.25rem', paddingLeft: '1rem', position: 'relative' }}>
                              <span style={{ position: 'absolute', left: 0, color: '#10b981' }}>•</span>
                              {b}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>
                          Log more data in both periods to see detailed comparisons.
                        </p>
                      )}
                    </div>
                  )}
                  {/* Fallback for v2 schema: compare_summary plain string */}
                  {!currentInsights?.compare_section && currentInsights?.compare_summary && (
                    <p style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.9rem' }}>
                      {currentInsights.compare_summary}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Support Sessions Card */}
            {currentMetrics.support_sessions && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                marginBottom: '1.5rem',
                borderLeft: '4px solid #8b5cf6'
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#1f2937' }}>
                  Support Now sessions
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 1rem 0' }}>
                  Quick urge-relief sessions completed in this period
                </p>
                {currentMetrics.support_sessions.count === 0 ? (
                  <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.9rem' }}>
                    No sessions logged yet. Use <strong>Support Now</strong> next time you feel an urge — data appears here automatically.
                  </p>
                ) : (
                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                        {currentMetrics.support_sessions.count}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>sessions</div>
                    </div>
                    {currentMetrics.support_sessions.avg_pre_urge !== null && (
                      <div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                          {currentMetrics.support_sessions.avg_pre_urge?.toFixed(1)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>avg urge before</div>
                      </div>
                    )}
                    {currentMetrics.support_sessions.avg_post_urge !== null && (
                      <div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
                          {currentMetrics.support_sessions.avg_post_urge?.toFixed(1)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>avg urge after</div>
                      </div>
                    )}
                    {currentMetrics.support_sessions.avg_urge_drop !== null && (
                      <div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: currentMetrics.support_sessions.avg_urge_drop >= 0 ? '#10b981' : '#ef4444' }}>
                          {currentMetrics.support_sessions.avg_urge_drop >= 0 ? '↓' : '↑'}{Math.abs(currentMetrics.support_sessions.avg_urge_drop).toFixed(1)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>avg urge drop</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Slips card */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginBottom: '1.5rem',
              borderLeft: '4px solid #dc2626'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 0.25rem 0', color: '#1f2937' }}>
                Slips
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 1rem 0' }}>
                Slips recorded via "Log a slip" in this period
              </p>
              {!currentMetrics?.slips || currentMetrics.slips.slip_count === 0 ? (
                <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.9rem' }}>
                  No slips recorded in this period.
                </p>
              ) : (
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>
                      {currentMetrics.slips.slip_count}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>total slips</div>
                  </div>
                  {currentMetrics.slips.days_with_slips > 0 && (
                    <div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f97316' }}>
                        {currentMetrics.slips.days_with_slips}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>days affected</div>
                    </div>
                  )}
                  {currentMetrics.slips.last_slip_at && (
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#374151' }}>
                        {new Date(currentMetrics.slips.last_slip_at).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>most recent slip</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Next steps card */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginBottom: '1.5rem',
              borderLeft: '4px solid #6366f1'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#1f2937' }}>
                Next steps to improve this report
              </h3>
              {nextSteps.length === 0 ? (
                <p style={{ color: '#6b7280', margin: 0 }}>You have enough data right now. Keep logging to maintain clarity.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#374151' }}>
                  {nextSteps.map((item, idx) => (
                    <li key={`${item.key}-${idx}`} style={{ marginBottom: '0.5rem' }}>
                      • {item.how_to_fix}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* High-risk times + What helps most — 2-col grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* High-risk times */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              minWidth: 0
            }}>
              {(() => {
                const totalLogsWithTimestamps = completeness?.meta?.total_events_in_range || 0;
                const riskConfidence = mapRiskConfidence(totalLogsWithTimestamps);
                const confidenceColors = {
                  high: { bg: '#d1fae5', text: '#065f46' },
                  medium: { bg: '#fef3c7', text: '#92400e' },
                  low: { bg: '#f3f4f6', text: '#6b7280' }
                };

                return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>
                  High-risk times
                </h3>
                <span style={{ 
                  fontSize: '0.75rem', 
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                  backgroundColor: confidenceColors[riskConfidence].bg,
                  color: confidenceColors[riskConfidence].text
                }}>
                  confidence: {riskConfidence}
                </span>
              </div>
                );
              })()}
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                Based on when urges/completions were logged. More logs = clearer pattern.
              </p>
              {(() => {
                const totalEvents = completeness?.meta?.total_events_in_range || 0;
                const hasEnoughData = shouldRenderHeatmap(totalEvents, MIN_EVENTS_FOR_HEATMAP) && currentMetrics.risk_window?.top_hours?.length > 0;
                
                return hasEnoughData ? (
                  <>
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
                      Darker = more activity at that hour.
                    </p>
                  </>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🕐</div>
                    <p style={{ color: '#1f2937', fontWeight: '600', marginBottom: '0.5rem' }}>Not enough data yet to spot high-risk times.</p>
                    <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>
                      To unlock: log 10+ actions with timestamps (and urge ratings if possible).
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
                );
              })()}
            </div>

            {/* What helps most */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              minWidth: 0
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>
                  What helps most
                </h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                Measured by average urge drop after logging an action.
              </p>
              
              {(() => {
                const totalUrgeRatings = completeness?.meta?.total_urge_ratings_in_range || 0;
                const hasEnoughData = shouldRenderStrategies(totalUrgeRatings, MIN_EVENTS_FOR_TOOLS) && completeness.coverage?.tools?.available && currentMetrics.tools.best_categories.length > 0;
                
                return hasEnoughData ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {currentMetrics.tools.best_categories.map((tool, idx) => {
                        // Determine confidence from sample_size (new) or count (legacy)
                        const sampleSize = tool.sample_size || tool.count || 0;
                        const friendlyLabel = mapCategoryToLabel(tool.category);
                        const description = mapCategoryToDescription(tool.category);
                        const confidence = sampleSize >= 10 ? 'high' : sampleSize >= 5 ? 'medium' : 'low';
                        const confidenceColor = confidence === 'high' ? '#10b981' : confidence === 'medium' ? '#f59e0b' : '#6b7280';
                        
                        return (
                          <div key={idx} style={{ 
                            padding: '1rem', 
                            backgroundColor: '#f9fafb', 
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                              <div style={{ flex: '1' }}>
                                <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                                  {friendlyLabel}
                                </div>
                                {description && (
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                    {description}
                                  </div>
                                )}
                              </div>
                              <div style={{ flex: '0 0 100px', textAlign: 'right' }}>
                                <div style={{ fontWeight: 'bold', color: '#6366f1', fontSize: '1.25rem' }}>
                                  {Math.round(tool.score * 100)}%
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                  urge drop
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flex: '1', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${tool.score * 100}%`,
                                    backgroundColor: '#6366f1',
                                    transition: 'width 0.3s'
                                  }}
                                ></div>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: confidenceColor, fontWeight: '500', minWidth: '180px', textAlign: 'right' }}>
                                confidence: {confidence} • {sampleSize} log{sampleSize !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔧</div>
                    <p style={{ color: '#1f2937', fontWeight: '600', marginBottom: '0.5rem' }}>Not enough urge data yet.</p>
                    <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>
                      {totalUrgeRatings === 0
                        ? `To unlock: log ${MIN_EVENTS_FOR_TOOLS} actions with urge before and after ratings.`
                        : `To unlock: log ${MIN_EVENTS_FOR_TOOLS - totalUrgeRatings} more action logs with urge ratings.`
                      }
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
                );
              })()}
            </div>
            </div>{/* end 2-col grid */}

            {/* Recovery Coaching Insights — rendered first via order: -1 */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginBottom: '1.5rem',
              order: -1,
              overflow: 'visible',
              minHeight: 0
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#1f2937' }}>
                Your Recovery Summary
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.25rem' }}>
                A coaching-style summary of what to keep, what to adjust, and your next small experiment.
              </p>
              {renderRecoveryInsights(currentInsights)}
            </div>

            {/* Cached Indicator */}
            {data.cached && (
              <div style={{ textAlign: 'center', padding: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                ✓ Cached report (refreshes automatically every 4 hours or when new actions logged)
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
