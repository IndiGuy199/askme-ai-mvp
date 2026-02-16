/**
 * Tests for report completeness computation
 * Run with: node web/lib/coach-ai/__tests__/completeness.test.js
 */

const { computeReportCompleteness } = require('../completeness.js');

function testCompletenessScenarios() {
  console.log('🧪 Testing report completeness computation...\n');

  // Scenario 1: Empty data (20% expected)
  const emptyMetrics = {
    activity: { actions_planned: 0, actions_logged: 0, done_count: 0, completion_rate: 0 },
    urge: { avg_before: null, avg_after: null, avg_drop: null, drops_by_category: [] },
    risk_window: { top_hours: [], label: null },
    tools: { best_categories: [] },
    baselines: { track: null, goal: null },
    slips: { slip_count: 0, second_session_rate: null },
    meta: { has_enough_data: false, sample_sizes: { completions: 0, actions: 0, slips: 0 } }
  };

  const result1 = computeReportCompleteness(emptyMetrics);
  console.log('✓ Scenario 1: Empty data');
  console.log(`  Completeness: ${result1.percent_complete}%`);
  console.log(`  Missing metrics: ${result1.missing_metrics.length}`);
  console.log(`  Expected: ~20%, got ${result1.percent_complete >= 15 && result1.percent_complete <= 25 ? '✓' : '✗'}\n`);

  // Scenario 2: Some actions, no completions (50% expected)
  const someActionsMetrics = {
    activity: { actions_planned: 5, actions_logged: 0, done_count: 0, completion_rate: 0 },
    urge: { avg_before: null, avg_after: null, avg_drop: null, drops_by_category: [] },
    risk_window: { top_hours: [], label: null },
    tools: { best_categories: [] },
    baselines: { track: { slip_frequency_7d: 2 }, goal: null },
    slips: { slip_count: 0, second_session_rate: null },
    meta: { has_enough_data: false, sample_sizes: { completions: 0, actions: 5, slips: 0 } }
  };

  const result2 = computeReportCompleteness(someActionsMetrics);
  console.log('✓ Scenario 2: Actions planned, no completions');
  console.log(`  Completeness: ${result2.percent_complete}%`);
  console.log(`  Missing metrics: ${result2.missing_metrics.length}`);
  console.log(`  Expected: ~40-60%, got ${result2.percent_complete >= 35 && result2.percent_complete <= 65 ? '✓' : '✗'}\n`);

  // Scenario 2b: Actions planned + track baseline set (should be higher)
  const actionsWithBaselineMetrics = {
    activity: { actions_planned: 5, actions_logged: 0, done_count: 0, completion_rate: 0 },
    urge: { avg_before: null, avg_after: null, avg_drop: null, drops_by_category: [] },
    risk_window: { top_hours: [], label: null },
    tools: { best_categories: [] },
    baselines: { 
      track: { 
        slip_frequency_7d: 2, 
        longest_streak_90d: 7, 
        strongest_urge_time: '10pm-12am',
        biggest_trigger: 'loneliness',
        notes: 'Setting baseline'
      }, 
      goal: null 
    },
    slips: { slip_count: 0, second_session_rate: null },
    meta: { has_enough_data: false, sample_sizes: { completions: 0, actions: 5, slips: 0 } }
  };

  const result2b = computeReportCompleteness(actionsWithBaselineMetrics);
  console.log('✓ Scenario 2b: Actions + track baseline set');
  console.log(`  Completeness: ${result2b.percent_complete}%`);
  console.log(`  Missing metrics: ${result2b.missing_metrics.length}`);
  console.log(`  Coverage breakdown:`, result2b.coverage);
  console.log(`  Expected: ~55-65% (higher than 2), got ${result2b.percent_complete > result2.percent_complete ? '✓' : '✗'}\n`);

  // Scenario 3: Near-complete data (90% expected)
  const nearCompleteMetrics = {
    activity: { actions_planned: 10, actions_logged: 8, done_count: 8, completion_rate: 0.8 },
    urge: { avg_before: 7.5, avg_after: 3.2, avg_drop: 4.3, drops_by_category: [
      { category: 'DEVICE_FRICTION', avg_drop: 5.1, count: 12, completion_rate: 0.9 }
    ]},
    risk_window: { top_hours: [{ hour: 22, count: 5, signal: 'urge_spike' }], label: '10pm-12am' },
    tools: { best_categories: [
      { category: 'DEVICE_FRICTION', score: 0.85, why: 'drops urge by 5.1 points', count: 12 }
    ]},
    baselines: { track: { slip_frequency_7d: 2 }, goal: { where_now: 'struggling' } },
    slips: { slip_count: 2, second_session_rate: 25 },
    meta: { has_enough_data: true, sample_sizes: { completions: 8, actions: 10, slips: 2 } }
  };

  const result3 = computeReportCompleteness(nearCompleteMetrics);
  console.log('✓ Scenario 3: Near-complete data');
  console.log(`  Completeness: ${result3.percent_complete}%`);
  console.log(`  Missing metrics: ${result3.missing_metrics.length}`);
  console.log(`  Expected: ~90%, got ${result3.percent_complete >= 85 && result3.percent_complete <= 95 ? '✓' : '✗'}\n`);

  // Scenario 4: Complete data (100% expected)
  const completeMetrics = {
    activity: { actions_planned: 14, actions_logged: 14, done_count: 14, completion_rate: 1.0 },
    urge: { avg_before: 7.5, avg_after: 3.2, avg_drop: 4.3, drops_by_category: [
      { category: 'DEVICE_FRICTION', avg_drop: 5.1, count: 15, completion_rate: 0.95 },
      { category: 'ENVIRONMENT_SHIFT', avg_drop: 3.8, count: 12, completion_rate: 0.88 }
    ]},
    risk_window: { top_hours: [
      { hour: 22, count: 8, signal: 'urge_spike' },
      { hour: 23, count: 6, signal: 'slip' }
    ], label: '10pm-12am' },
    tools: { best_categories: [
      { category: 'DEVICE_FRICTION', score: 0.85, why: 'drops urge by 5.1 points', count: 15 },
      { category: 'ENVIRONMENT_SHIFT', score: 0.78, why: '88% completion rate', count: 12 }
    ]},
    baselines: { track: { slip_frequency_7d: 2 }, goal: { where_now: 'improving' } },
    slips: { slip_count: 1, second_session_rate: 0 },
    meta: { has_enough_data: true, sample_sizes: { completions: 14, actions: 14, slips: 1 } }
  };

  const result4 = computeReportCompleteness(completeMetrics);
  console.log('✓ Scenario 4: Complete data');
  console.log(`  Completeness: ${result4.percent_complete}%`);
  console.log(`  Missing metrics: ${result4.missing_metrics.length}`);
  console.log(`  Expected: 100%, got ${result4.percent_complete === 100 ? '✓' : '✗'}\n`);

  // Summary
  console.log('===============================================');
  console.log('Test Summary:');
  console.log(`  Scenario 1 (Empty): ${result1.percent_complete}% - ${result1.percent_complete >= 15 && result1.percent_complete <= 25 ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Scenario 2 (Partial): ${result2.percent_complete}% - ${result2.percent_complete >= 35 && result2.percent_complete <= 65 ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Scenario 2b (+ Baseline): ${result2b.percent_complete}% - ${result2b.percent_complete > result2.percent_complete && result2b.percent_complete >= 50 ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Scenario 3 (Near-complete): ${result3.percent_complete}% - ${result3.percent_complete >= 85 && result3.percent_complete <= 95 ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Scenario 4 (Complete): ${result4.percent_complete}% - ${result4.percent_complete === 100 ? '✓ PASS' : '✗ FAIL'}`);
  console.log('===============================================\n');

  // Test coverage structure
  console.log('Coverage keys available:', Object.keys(result1.coverage));
  console.log('Missing metrics structure:', result1.missing_metrics.length > 0 ? result1.missing_metrics[0] : 'N/A');
}

// Run tests
if (typeof module !== 'undefined' && require.main === module) {
  testCompletenessScenarios();
}

module.exports = { testCompletenessScenarios };
