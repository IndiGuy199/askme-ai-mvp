/**
 * Tests for deriveWeeklyBullets() — deterministic weekly pattern derivation.
 * Run with: node web/lib/coach-ai/__tests__/weekly-bullets.test.js
 */

let deriveWeeklyBullets;
try {
  ({ deriveWeeklyBullets } = require('../weekly-bullets'));
} catch {
  try {
    ({ deriveWeeklyBullets } = require('../prompts'));
  } catch {
    console.error('Could not load weekly-bullets or prompts module');
    process.exit(1);
  }
}

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

function runTests() {
  console.log('🧪 Testing deriveWeeklyBullets deterministic weekly summary...\n');

  // ---- Case 1: User with real data — should never say "still learning" ----
  console.log('Case 1: User with actions_planned=12, timestamped_logs=5, tools.best_categories exists');
  const metricsWithData = {
    activity: {
      actions_planned: 12,
      actions_logged: 8,
      done_count: 6,
      partial_count: 2,
      completion_rate: 0.55,
      action_days_available: 14
    },
    urge: {
      avg_before: 7.2,
      avg_after: 4.1,
      avg_drop: 3.1,
      drops_by_category: [{ category: 'ACCOUNTABILITY', avg_drop: 3.5, count: 4, completion_rate: 0.7 }],
      confidence: 'medium'
    },
    risk_window: {
      label: '9pm–11pm',
      top_hours: [{ hour: 22, count: 5, signal: 'urge_spike' }],
      confidence: 'medium'
    },
    tools: {
      best_categories: [{ category: 'DEVICE_FRICTION', score: 0.72, why: 'drops urge 3.2pt avg', sample_size: 6 }]
    },
    baselines: { track: null, goal: null },
    slips: { slip_count: 0, days_with_slips: 0, last_slip_at: null, second_session_rate: null },
    support_sessions: { count: 0, avg_pre_urge: null, avg_post_urge: null, avg_urge_drop: null },
    meta: {
      has_enough_data: true,
      sample_sizes: { actions: 12, completions: 8, urge_pairs: 6, timestamped_logs: 5, goals_active: 2, drops: 6 }
    }
  };

  const r1 = deriveWeeklyBullets(metricsWithData, 'porn_addiction');

  assert('challenge_id matches', r1.challenge_id === 'porn_addiction');
  assert('timeframe_days is 7', r1.timeframe_days === 7);
  assert('risk_window does NOT say "still learning"', !r1.insights.risk_window.includes('still learning'));
  assert('risk_window does NOT say "not enough data"', !r1.insights.risk_window.includes('not enough data'));
  assert('risk_window contains the label 9pm–11pm', r1.insights.risk_window.includes('9pm–11pm'));
  assert('best_tool does NOT say "still learning"', !r1.insights.best_tool.includes('still learning'));
  assert('best_tool does NOT say "not enough data"', !r1.insights.best_tool.includes('not enough data'));
  assert('best_tool contains friendly category name', r1.insights.best_tool.toLowerCase().includes('phone') || r1.insights.best_tool.toLowerCase().includes('device') || r1.insights.best_tool.toLowerCase().includes('friction'));
  assert('best_tool includes sample size n=6', r1.insights.best_tool.includes('6'));
  assert('best_lever is a real sentence (not a category enum)', !['DEVICE_FRICTION','ACCOUNTABILITY','ENVIRONMENT_SHIFT','TIME_PROTOCOL'].includes(r1.insights.best_lever));
  assert('best_lever is non-empty string', typeof r1.insights.best_lever === 'string' && r1.insights.best_lever.length > 0);
  assert('next_week_plan.keep has 2 items', r1.next_week_plan.keep.length === 2);
  assert('next_week_plan.change has 2 items', r1.next_week_plan.change.length === 2);
  assert('next_week_plan.try has 2 items', r1.next_week_plan.try.length === 2);
  assert('low_confidence reflects adequate data', r1.low_confidence === false);
  assert('insufficient_data is false when actionsPlanned>0', r1.insufficient_data === false);
  console.log(`  risk_window: "${r1.insights.risk_window}"`);
  console.log(`  best_tool: "${r1.insights.best_tool}"`);
  console.log(`  best_lever: "${r1.insights.best_lever}"`);
  console.log();

  // ---- Case 2: No logs at all — shows "not enough data" + instructional next step ----
  console.log('Case 2: No logs at all — insufficient_data=true, bullets explain what to do');
  const emptyMetrics = {
    activity: {
      actions_planned: 0,
      actions_logged: 0,
      done_count: 0,
      partial_count: 0,
      completion_rate: 0,
      action_days_available: 0
    },
    urge: {
      avg_before: null,
      avg_after: null,
      avg_drop: null,
      drops_by_category: [],
      confidence: 'none'
    },
    risk_window: {
      label: null,
      top_hours: [],
      confidence: 'none'
    },
    tools: { best_categories: [] },
    baselines: { track: null, goal: null },
    slips: { slip_count: 0, days_with_slips: 0, last_slip_at: null, second_session_rate: null },
    support_sessions: { count: 0, avg_pre_urge: null, avg_post_urge: null, avg_urge_drop: null },
    meta: {
      has_enough_data: false,
      sample_sizes: { actions: 0, completions: 0, urge_pairs: 0, timestamped_logs: 0, goals_active: 0, drops: 0 }
    }
  };

  const r2 = deriveWeeklyBullets(emptyMetrics, 'porn_addiction');

  assert('insufficient_data flag is true when no logs', r2.insufficient_data === true);
  assert('risk_window contains "not enough data"', r2.insights.risk_window.includes('not enough data'));
  assert('best_tool contains "not enough data"', r2.insights.best_tool.includes('not enough data'));
  assert('best_lever instructs user to start logging', r2.insights.best_lever.includes('log') || r2.insights.best_lever.includes('action') || r2.insights.best_lever.includes('Playbook'));
  assert('next_week_plan.keep[0] contains "log" or "Playbook"', r2.next_week_plan.keep[0].toLowerCase().includes('log') || r2.next_week_plan.keep[0].toLowerCase().includes('playbook'));
  assert('next_week_plan arrays all have 2 items', r2.next_week_plan.keep.length === 2 && r2.next_week_plan.change.length === 2 && r2.next_week_plan.try.length === 2);
  assert('all bullet strings are non-empty', [
    r2.insights.risk_window, r2.insights.best_tool, r2.insights.best_lever,
    ...r2.next_week_plan.keep, ...r2.next_week_plan.change, ...r2.next_week_plan.try
  ].every(s => typeof s === 'string' && s.length > 0));
  console.log(`  risk_window: "${r2.insights.risk_window}"`);
  console.log(`  best_tool: "${r2.insights.best_tool}"`);
  console.log(`  best_lever: "${r2.insights.best_lever}"`);
  console.log();

  // ---- Case 3: Partial data — urgePairs < 5 triggers urge logging next step ----
  console.log('Case 3: 2 urge pairs — next step should prompt logging urge ratings');
  const lowUrgeMetrics = {
    activity: { actions_planned: 5, actions_logged: 4, done_count: 3, partial_count: 1, completion_rate: 0.6, action_days_available: 7 },
    urge: { avg_before: 6, avg_after: 4, avg_drop: 2, drops_by_category: [], confidence: 'low' },
    risk_window: { label: null, top_hours: [], confidence: 'none' },
    tools: { best_categories: [] },
    baselines: { track: null, goal: null },
    slips: { slip_count: 0, days_with_slips: 0, last_slip_at: null, second_session_rate: null },
    support_sessions: { count: 0, avg_pre_urge: null, avg_post_urge: null, avg_urge_drop: null },
    meta: { has_enough_data: true, sample_sizes: { actions: 5, completions: 4, urge_pairs: 2, timestamped_logs: 3, goals_active: 1, drops: 2 } }
  };
  const r3 = deriveWeeklyBullets(lowUrgeMetrics, 'porn_addiction');
  assert('best_lever prompts urge pair logging when pairs < 5', r3.insights.best_lever.includes('urge') || r3.insights.best_lever.includes('log'));
  assert('low_confidence is true when few logs and no best tool', r3.low_confidence === true);
  assert('insufficient_data is false when actionsPlanned > 0', r3.insufficient_data === false);
  console.log(`  best_lever: "${r3.insights.best_lever}"`);
  console.log(`  low_confidence: ${r3.low_confidence}`);
  console.log();

  // ---- Summary ----
  console.log('===============================================');
  console.log(`Test Summary: ${passed} passed, ${failed} failed`);
  console.log('===============================================\n');
  if (failed > 0) process.exit(1);
}

if (typeof module !== 'undefined' && require.main === module) {
  runTests();
}

module.exports = { runTests };
