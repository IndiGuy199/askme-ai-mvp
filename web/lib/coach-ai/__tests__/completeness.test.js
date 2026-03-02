/**
 * Tests for report completeness computation (Phase 6 rewrite)
 * Run with: node web/lib/coach-ai/__tests__/completeness.test.js
 *
 * New scoring: Activity 35 | Completions 20 | Urge 20 | Risk Window 15 | Tools 10 + baseline bonus
 */

// Try TypeScript compiled output first, fall back to source
let computeReportCompleteness;
let mapCategoryToLabel;
let shouldRenderHeatmap;
let existsDuringRange;
try {
  ({ computeReportCompleteness, mapCategoryToLabel, shouldRenderHeatmap, existsDuringRange } = require('../completeness'));
} catch {
  ({ computeReportCompleteness, mapCategoryToLabel, shouldRenderHeatmap, existsDuringRange } = require('../completeness.ts'));
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

function testCompletenessScenarios() {
  console.log('🧪 Testing Phase 6 report completeness computation...\n');

  // ---- Scenario 1: Empty data (0%) ----
  console.log('Scenario 1: Empty data');
  const emptyMetrics = {
    activity: { actions_planned: 0, actions_logged: 0, done_count: 0, partial_count: 0, completion_rate: 0, action_days_available: 0, completion_quality_avg: null },
    urge: { avg_before: null, avg_after: null, avg_drop: null, drops_by_category: [], confidence: 'none' },
    risk_window: { top_hours: [], label: null, confidence: 'none' },
    tools: { best_categories: [] },
    baselines: { track: null, goal: null },
    slips: { slip_count: 0, second_session_rate: null },
    meta: { has_enough_data: false, sample_sizes: { completions: 0, actions: 0, slips: 0, urge_pairs: 0 } }
  };

  const r1 = computeReportCompleteness(emptyMetrics);
  console.log(`  Score: ${r1.percent_complete}%`);
  assert('Empty data → 0%', r1.percent_complete === 0);
  assert('Missing metrics >= 3', r1.missing_metrics.length >= 3);
  assert('Has action_logs missing', r1.missing_metrics.some(m => m.key === 'action_logs'));
  console.log();

  // ---- Scenario 2: Actions planned, no completions ----
  console.log('Scenario 2: Actions planned, no completions');
  const actionsOnlyMetrics = {
    activity: { actions_planned: 3, actions_logged: 0, done_count: 0, partial_count: 0, completion_rate: 0, action_days_available: 21, completion_quality_avg: null },
    urge: { avg_before: null, avg_after: null, avg_drop: null, drops_by_category: [], confidence: 'none' },
    risk_window: { top_hours: [], label: null, confidence: 'none' },
    tools: { best_categories: [] },
    baselines: { track: null, goal: null },
    slips: { slip_count: 0, second_session_rate: null },
    meta: { has_enough_data: false, sample_sizes: { completions: 0, actions: 3, slips: 0, urge_pairs: 0 } }
  };

  const r2 = computeReportCompleteness(actionsOnlyMetrics);
  console.log(`  Score: ${r2.percent_complete}%`);
  assert('Actions planned, 0 completions → 14 (40% of 35 weight)', r2.percent_complete === 14);
  assert('completions missing entry', r2.missing_metrics.some(m => m.key === 'completions'));
  console.log();

  // ---- Scenario 3: Actions + some completions + urge pairs ----
  console.log('Scenario 3: Partial data (3 completions, 2 urge pairs)');
  const partialMetrics = {
    activity: { actions_planned: 3, actions_logged: 3, done_count: 2, partial_count: 1, completion_rate: 0.5, action_days_available: 21, completion_quality_avg: 83 },
    urge: { avg_before: 7, avg_after: 4, avg_drop: 3, drops_by_category: [{ category: 'DEVICE_FRICTION', avg_drop: 3, count: 2, completion_rate: 0.5 }], confidence: 'low' },
    risk_window: { top_hours: [{ hour: 22, count: 2, signal: 'activity' }], label: '10pm–12am', confidence: 'low' },
    tools: { best_categories: [{ category: 'DEVICE_FRICTION', score: 0.5, why: 'modest results', sample_size: 2 }] },
    baselines: { track: null, goal: null },
    slips: { slip_count: 1, second_session_rate: null },
    meta: { has_enough_data: true, sample_sizes: { completions: 3, actions: 3, slips: 1, urge_pairs: 2 } }
  };

  const r3 = computeReportCompleteness(partialMetrics);
  console.log(`  Score: ${r3.percent_complete}%`);
  assert('Partial data → 55-75%', r3.percent_complete >= 55 && r3.percent_complete <= 75);
  console.log();

  // ---- Scenario 4: Good data with medium confidence ----
  console.log('Scenario 4: Good data (8 completions, 6 urge pairs, medium confidence)');
  const goodMetrics = {
    activity: { actions_planned: 5, actions_logged: 8, done_count: 6, partial_count: 2, completion_rate: 0.7, action_days_available: 35, completion_quality_avg: 88 },
    urge: { avg_before: 7.2, avg_after: 3.5, avg_drop: 3.7, drops_by_category: [
      { category: 'DEVICE_FRICTION', avg_drop: 4.5, count: 6, completion_rate: 0.8 }
    ], confidence: 'medium' },
    risk_window: { top_hours: [{ hour: 22, count: 5, signal: 'urge_spike' }, { hour: 23, count: 3, signal: 'activity' }], label: '10pm–12am', confidence: 'medium' },
    tools: { best_categories: [{ category: 'DEVICE_FRICTION', score: 0.8, why: 'drops urge by 4.5 points', sample_size: 6 }] },
    baselines: { track: { slip_frequency_30d: 4 }, goal: { goal_baseline_level: 'struggling' } },
    slips: { slip_count: 2, second_session_rate: 25 },
    meta: { has_enough_data: true, sample_sizes: { completions: 8, actions: 5, slips: 2, urge_pairs: 6 } }
  };

  const r4 = computeReportCompleteness(goodMetrics);
  console.log(`  Score: ${r4.percent_complete}%`);
  assert('Good data → 80-95%', r4.percent_complete >= 80 && r4.percent_complete <= 95);
  assert('Both baselines → bonus applied', r4.percent_complete > 65);
  console.log();

  // ---- Scenario 5: Complete data with high confidence ----
  console.log('Scenario 5: Complete data (15+ completions, 10+ urge pairs, high confidence)');
  const completeMetrics = {
    activity: { actions_planned: 6, actions_logged: 15, done_count: 12, partial_count: 3, completion_rate: 0.9, action_days_available: 42, completion_quality_avg: 92 },
    urge: { avg_before: 7.5, avg_after: 3.2, avg_drop: 4.3, drops_by_category: [
      { category: 'DEVICE_FRICTION', avg_drop: 5.1, count: 12, completion_rate: 0.95 },
      { category: 'ENVIRONMENT_SHIFT', avg_drop: 3.8, count: 8, completion_rate: 0.88 }
    ], confidence: 'high' },
    risk_window: { top_hours: [
      { hour: 22, count: 8, signal: 'urge_spike' },
      { hour: 23, count: 6, signal: 'activity' },
      { hour: 21, count: 4, signal: 'activity' }
    ], label: '10pm–12am', confidence: 'high' },
    tools: { best_categories: [
      { category: 'DEVICE_FRICTION', score: 0.85, why: 'drops urge by 5.1 points', sample_size: 12 },
      { category: 'ENVIRONMENT_SHIFT', score: 0.78, why: '88% completion rate', sample_size: 8 }
    ] },
    baselines: { track: { slip_frequency_30d: 4 }, goal: { goal_baseline_level: 'improving' } },
    slips: { slip_count: 1, second_session_rate: 0 },
    meta: { has_enough_data: true, sample_sizes: { completions: 15, actions: 6, goals_active: 2, slips: 1, urge_pairs: 12, timestamped_logs: 15 } }
  };

  const r5 = computeReportCompleteness(completeMetrics);
  console.log(`  Score: ${r5.percent_complete}%`);
  assert('Complete data → 95-100%', r5.percent_complete >= 95 && r5.percent_complete <= 100);
  assert('No missing metrics', r5.missing_metrics.length === 0);
  console.log();

  // ---- Scenario 6: Actions active but no category data → tools missing ----
  console.log('Scenario 6: Actions with completions but no urge data → urge + tools missing');
  const noUrgeMetrics = {
    activity: { actions_planned: 3, actions_logged: 5, done_count: 5, partial_count: 0, completion_rate: 0.8, action_days_available: 21, completion_quality_avg: 100 },
    urge: { avg_before: null, avg_after: null, avg_drop: null, drops_by_category: [], confidence: 'none' },
    risk_window: { top_hours: [{ hour: 9, count: 3, signal: 'activity' }], label: '9am–11am', confidence: 'low' },
    tools: { best_categories: [] },
    baselines: { track: null, goal: null },
    slips: { slip_count: 0, second_session_rate: null },
    meta: { has_enough_data: true, sample_sizes: { completions: 5, actions: 3, slips: 0, urge_pairs: 0 } }
  };

  const r6 = computeReportCompleteness(noUrgeMetrics);
  console.log(`  Score: ${r6.percent_complete}%`);
  assert('Has at least 1 missing metric when urge data absent', r6.missing_metrics.length >= 1);
  assert('No urge → urge_data missing', r6.missing_metrics.some(m => m.key === 'urge_data'));
  assert('No tools → tool_data missing', r6.missing_metrics.some(m => m.key === 'tool_data'));
  assert('Activity section high', r6.coverage.activity.pct >= 60);
  assert('Meta includes total_events_in_range', typeof r6.meta?.total_events_in_range === 'number');
  assert('Meta includes total_urge_ratings_in_range', typeof r6.meta?.total_urge_ratings_in_range === 'number');
  assert('Meta includes tool_samples_by_category array', Array.isArray(r6.meta?.tool_samples_by_category));
  console.log();

  // ---- Scenario 7: Heatmap rule + friendly category labels ----
  console.log('Scenario 7: Heatmap threshold + category labels');
  assert('Heatmap hidden when sample < 10', shouldRenderHeatmap(9) === false);
  assert('Heatmap shown when sample >= 10', shouldRenderHeatmap(10) === true);
  assert('DEVICE_FRICTION maps to Phone barriers', mapCategoryToLabel('DEVICE_FRICTION') === 'Phone barriers');
  assert('ACCOUNTABILITY maps to Reach out', mapCategoryToLabel('ACCOUNTABILITY') === 'Reach out');
  assert('ENVIRONMENT_SHIFT maps to Change location', mapCategoryToLabel('ENVIRONMENT_SHIFT') === 'Change location');
  assert('UNKNOWN maps to Uncategorized (add tags)', mapCategoryToLabel('UNKNOWN') === 'Uncategorized (add tags)');
  console.log();

  // ---- Scenario 8: Temporal overlap helper ----
  console.log('Scenario 8: Temporal overlap for active-in-window logic');
  const start = new Date('2026-01-01T00:00:00.000Z');
  const end = new Date('2026-01-31T23:59:59.999Z');

  assert(
    'Created before window and not removed counts as active',
    existsDuringRange('2025-12-15T10:00:00.000Z', null, start, end) === true
  );
  assert(
    'Created before window and removed within window counts as active',
    existsDuringRange('2025-12-15T10:00:00.000Z', '2026-01-10T10:00:00.000Z', start, end) === true
  );
  assert(
    'Removed before window does not count as active',
    existsDuringRange('2025-12-15T10:00:00.000Z', '2025-12-31T23:59:59.999Z', start, end) === false
  );
  assert(
    'Created after window does not count as active',
    existsDuringRange('2026-02-01T00:00:00.000Z', null, start, end) === false
  );
  console.log();

  // ---- Scenario 9: improvement_items — urge pairs 1-4 (soft missing) ----
  console.log('Scenario 9: urgePairs=3 → improvement_items.more_urge_pairs, NOT missing urge_data');
  const urgePartialMetrics = {
    activity: { actions_planned: 3, actions_logged: 6, done_count: 5, partial_count: 1, completion_rate: 0.8, action_days_available: 28, completion_quality_avg: 85 },
    urge: { avg_before: 7, avg_after: 4, avg_drop: 3, drops_by_category: [{ category: 'DEVICE_FRICTION', avg_drop: 3, count: 3, completion_rate: 0.7 }], confidence: 'low' },
    risk_window: { top_hours: [{ hour: 22, count: 3, signal: 'activity' }], label: '10pm', confidence: 'low' },
    tools: { best_categories: [{ category: 'DEVICE_FRICTION', score: 0.6, why: 'reduces urge', sample_size: 3 }] },
    baselines: { track: { slip_frequency_30d: 3 }, goal: null },
    slips: { slip_count: 0, second_session_rate: null },
    meta: { has_enough_data: true, sample_sizes: { completions: 5, actions: 3, slips: 0, urge_pairs: 3, timestamped_logs: 6 } }
  };
  const r9 = computeReportCompleteness(urgePartialMetrics);
  console.log(`  Score: ${r9.percent_complete}%, improvement_items: ${r9.improvement_items.map(i => i.key).join(', ')}`);
  assert('urge_data NOT in missing_metrics (pairs > 0)', !r9.missing_metrics.some(m => m.key === 'urge_data'));
  assert('more_urge_pairs in improvement_items', r9.improvement_items.some(i => i.key === 'more_urge_pairs'));
  assert('more_urge_pairs threshold_text shows count', r9.improvement_items.find(i => i.key === 'more_urge_pairs')?.threshold_text?.includes('3'));
  console.log();

  // ---- Scenario 10: improvement_items — actionsLogged 3 (< 5) ----
  console.log('Scenario 10: actionsLogged=3 → improvement_items.more_completions');
  const fewActionsMetrics = {
    activity: { actions_planned: 4, actions_logged: 3, done_count: 2, partial_count: 1, completion_rate: 0.5, action_days_available: 21, completion_quality_avg: 75 },
    urge: { avg_before: null, avg_after: null, avg_drop: null, drops_by_category: [], confidence: 'none' },
    risk_window: { top_hours: [], label: null, confidence: 'none' },
    tools: { best_categories: [] },
    baselines: { track: null, goal: null },
    slips: { slip_count: 0, second_session_rate: null },
    meta: { has_enough_data: false, sample_sizes: { completions: 3, actions: 4, slips: 0, urge_pairs: 0, timestamped_logs: 3 } }
  };
  const r10 = computeReportCompleteness(fewActionsMetrics);
  console.log(`  Score: ${r10.percent_complete}%, improvement_items: ${r10.improvement_items.map(i => i.key).join(', ')}`);
  assert('more_completions in improvement_items (3 logs < 5)', r10.improvement_items.some(i => i.key === 'more_completions'));
  assert('more_completions threshold_text shows count', r10.improvement_items.find(i => i.key === 'more_completions')?.threshold_text?.includes('3'));
  console.log();

  // ---- Scenario 11: improvement_items — risk window (6 timestamped logs < 10) ----
  console.log('Scenario 11: 6 timestamped logs → improvement_items.more_logs_for_risk_window');
  const lowRiskMetrics = {
    activity: { actions_planned: 3, actions_logged: 6, done_count: 5, partial_count: 1, completion_rate: 0.8, action_days_available: 21, completion_quality_avg: 88 },
    urge: { avg_before: 7, avg_after: 3, avg_drop: 4, drops_by_category: [{ category: 'DEVICE_FRICTION', avg_drop: 4, count: 5, completion_rate: 0.85 }], confidence: 'medium' },
    risk_window: { top_hours: [{ hour: 22, count: 3, signal: 'activity' }], label: '10pm', confidence: 'low' },
    tools: { best_categories: [{ category: 'DEVICE_FRICTION', score: 0.7, why: 'reduces urge', sample_size: 5 }] },
    baselines: { track: { slip_frequency_30d: 3 }, goal: null },
    slips: { slip_count: 0, second_session_rate: null },
    meta: { has_enough_data: true, sample_sizes: { completions: 6, actions: 3, slips: 0, urge_pairs: 5, timestamped_logs: 6 } }
  };
  const r11 = computeReportCompleteness(lowRiskMetrics);
  console.log(`  Score: ${r11.percent_complete}%, improvement_items: ${r11.improvement_items.map(i => i.key).join(', ')}`);
  assert('more_logs_for_risk_window in improvement_items', r11.improvement_items.some(i => i.key === 'more_logs_for_risk_window'));
  assert('risk window threshold_text shows 6/10', r11.improvement_items.find(i => i.key === 'more_logs_for_risk_window')?.threshold_text?.includes('6'));
  console.log();

  // ---- Scenario 12: improvement_items — no track baseline (bonus: not in missing_metrics) ----
  console.log('Scenario 12: No track baseline → improvement_items.set_track_baseline, NOT in missing_metrics');
  const noBaselineMetrics = {
    activity: { actions_planned: 3, actions_logged: 8, done_count: 7, partial_count: 1, completion_rate: 0.88, action_days_available: 35, completion_quality_avg: 90 },
    urge: { avg_before: 7, avg_after: 3, avg_drop: 4, drops_by_category: [{ category: 'DEVICE_FRICTION', avg_drop: 4, count: 8, completion_rate: 0.9 }], confidence: 'high' },
    risk_window: { top_hours: [{ hour: 22, count: 8, signal: 'urge_spike' }], label: '10pm', confidence: 'high' },
    tools: { best_categories: [{ category: 'DEVICE_FRICTION', score: 0.85, why: 'drops urge by 4', sample_size: 8 }] },
    baselines: { track: null, goal: null },
    slips: { slip_count: 1, second_session_rate: 0 },
    meta: { has_enough_data: true, sample_sizes: { completions: 8, actions: 3, slips: 1, urge_pairs: 8, timestamped_logs: 8 } }
  };
  const r12 = computeReportCompleteness(noBaselineMetrics);
  console.log(`  Score: ${r12.percent_complete}%, improvement_items: ${r12.improvement_items.map(i => i.key).join(', ')}`);
  assert('track_baseline NOT in missing_metrics', !r12.missing_metrics.some(m => m.key === 'track_baseline'));
  assert('set_track_baseline in improvement_items', r12.improvement_items.some(i => i.key === 'set_track_baseline'));
  console.log();

  // ---- Scenario 13: Invariant — percent_complete < 80 → at least one action item ----
  console.log('Scenario 13: Invariant — reports < 80% always explain the gap');
  const allResults = [
    { label: 'empty', r: r1 }, { label: 'actionsOnly', r: r2 }, { label: 'partial', r: r3 },
    { label: 'noUrge', r: r6 }, { label: 'urgePartial', r: r9 },
    { label: 'fewActions', r: r10 }, { label: 'lowRisk', r: r11 }
  ];
  let invariantOk = true;
  for (const { label, r } of allResults) {
    if (r.percent_complete < 80) {
      const totalItems = (r.missing_metrics?.length || 0) + (r.improvement_items?.length || 0);
      if (totalItems === 0) {
        console.log(`  ✗ Invariant broken for "${label}": score=${r.percent_complete}% but no action items`);
        invariantOk = false;
      }
    }
  }
  assert('Every report under 80% has at least one missing/improvement item', invariantOk);
  assert('improvement_items is always an array', allResults.every(({ r }) => Array.isArray(r.improvement_items)));
  console.log();

  // ---- Scenario 14: DetailedInsightDataSchema validates new structured shape ----
  console.log('Scenario 14: DetailedInsightDataSchema — valid new shape accepted, old flat shape rejected');
  let DetailedInsightDataSchema;
  try {
    ({ DetailedInsightDataSchema } = require('../schema'));
  } catch {
    try {
      ({ DetailedInsightDataSchema } = require('../schema.ts'));
    } catch { /* schema not loadable — skip */ }
  }
  if (DetailedInsightDataSchema) {
    const validShape = {
      summary: 'You completed 8 actions this week — strong consistency.',
      what_is_working: [
        'Your completion rate of 80% reflects reliable follow-through on planned actions.',
        'Bedtime actions show the highest urge drop, confirming they target your key risk window.'
      ],
      where_you_are_vulnerable: [
        'Evening hours between 9 pm and 11 pm remain your highest-risk window for urges.',
        'Actions logged without urge ratings cannot be scored for effectiveness yet.'
      ],
      patterns_and_triggers: [
        'Urge spikes correlate with unstructured evening time — adding a set routine reduces them.',
        'Device friction tools show the strongest urge drop across all categories logged so far.'
      ],
      next_experiment: {
        title: 'Add a 9 pm wind-down anchor',
        why: 'Your urge data peaks between 9 pm and 11 pm.',
        steps: [
          'Set a phone reminder at 8:50 pm to start your wind-down routine.',
          'Complete one device friction action before 9 pm daily.',
          'Log urge before and after for 7 days and revisit this report.'
        ]
      }
    };
    const validResult = DetailedInsightDataSchema.safeParse(validShape);
    assert('valid new schema shape is accepted', validResult.success);

    const oldFlatShape = {
      risk_window: 'late evening',
      best_tool: 'Cold shower',
      best_lever: 'Environment Shift',
      insights: ['Keep logging actions', 'Add urge ratings'],
      next_experiment: { title: 'Test', why: 'reason', steps: ['step 1'] }
    };
    const invalidResult = DetailedInsightDataSchema.safeParse(oldFlatShape);
    assert('old flat schema shape is rejected', !invalidResult.success);

    const missingSteps = { ...validShape, next_experiment: { title: 'T', why: 'reason', steps: ['only one'] } };
    const missingStepsResult = DetailedInsightDataSchema.safeParse(missingSteps);
    assert('next_experiment with fewer than 3 steps is rejected', !missingStepsResult.success);
  } else {
    console.log('  ⚠ Skipping schema validation (module not loadable in this context)');
  }
  console.log();

  // ---- Scenario 15: improvements non-empty, missing empty → score < 100 ----
  console.log('Scenario 15: good data with no baselines → missing_metrics empty, improvements non-empty, score < 100');
  // Re-use r12 from Scenario 12 (noBaselineMetrics)
  assert('missing_metrics empty when only soft gaps', r12.missing_metrics.length === 0);
  assert('improvement_items non-empty explains score gap', r12.improvement_items.length > 0);
  assert('score < 100 even without hard-missing items', r12.percent_complete < 100);
  assert('threshold_text has no "pairs" jargon', !r12.improvement_items.some(i => (i.threshold_text || '').includes('pairs')));
  console.log(`  Score: ${r12.percent_complete}%, improvements: ${r12.improvement_items.map(i => i.key).join(', ')}`);
  console.log();

  // ---- Summary ----
  console.log('===============================================');
  console.log(`Test Summary: ${passed} passed, ${failed} failed`);
  console.log('===============================================\n');

  if (failed > 0) process.exit(1);
}

// Run tests
if (typeof module !== 'undefined' && require.main === module) {
  testCompletenessScenarios();
}

module.exports = { testCompletenessScenarios };
