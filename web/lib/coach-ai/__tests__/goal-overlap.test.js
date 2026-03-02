/**
 * Targeted tests for goal overlap correctness in Insights metrics/completeness.
 * Run with: node web/lib/coach-ai/__tests__/goal-overlap.test.js
 */

let computeGoalsActiveInRange;
let computeReportCompleteness;

try {
  ({ computeGoalsActiveInRange, computeReportCompleteness } = require('../completeness'));
} catch {
  ({ computeGoalsActiveInRange, computeReportCompleteness } = require('../completeness.ts'));
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

function testGoalOverlapScenarios() {
  console.log('🧪 Testing goal overlap and active_goal completeness guard...\n');

  const now = new Date('2026-02-18T12:00:00.000Z');
  const rangeStart = new Date('2026-02-11T00:00:00.000Z');
  const rangeEnd = now;

  // A) Goal selected before range, still active through range
  console.log('Scenario A: selected before range, remains active');
  const goalsA = [{
    id: 'goal-A',
    goal_slot: 1,
    is_active: true,
    selected_at: '2026-02-04T09:00:00.000Z',
    created_at: '2026-02-04T09:00:00.000Z'
  }];
  const eventsA = [];
  const resultA = computeGoalsActiveInRange(eventsA, goalsA, rangeStart, rangeEnd);
  assert('goals_active_count >= 1', resultA.goals_active_count >= 1);
  console.log();

  // B) Swap mid-range: both old and new overlap
  console.log('Scenario B: swap mid-range counts both goals');
  const goalsB = [{
    id: 'goal-B',
    goal_slot: 1,
    is_active: true,
    selected_at: '2026-02-14T08:00:00.000Z',
    created_at: '2026-02-14T08:00:00.000Z'
  }];
  const eventsB = [
    {
      goal_slot: 1,
      swapped_goal_id: 'goal-A',
      swapped_out_goal_id: null,
      created_at: '2026-02-10T10:00:00.000Z'
    },
    {
      goal_slot: 1,
      swapped_goal_id: 'goal-B',
      swapped_out_goal_id: 'goal-A',
      created_at: '2026-02-14T08:00:00.000Z'
    }
  ];
  const resultB = computeGoalsActiveInRange(eventsB, goalsB, rangeStart, rangeEnd);
  assert('goals_active_count == 2', resultB.goals_active_count === 2);
  console.log();

  // C) No events, current active goals exist
  console.log('Scenario C: no events, current active goals fallback');
  const goalsC = [
    {
      id: 'goal-C1',
      goal_slot: 1,
      is_active: true,
      selected_at: '2026-02-01T09:00:00.000Z',
      created_at: '2026-02-01T09:00:00.000Z'
    },
    {
      id: 'goal-C2',
      goal_slot: 2,
      is_active: true,
      selected_at: '2026-02-03T09:00:00.000Z',
      created_at: '2026-02-03T09:00:00.000Z'
    }
  ];
  const resultC = computeGoalsActiveInRange([], goalsC, rangeStart, rangeEnd);
  assert('goals_active_count reflects both active goals', resultC.goals_active_count === 2);
  console.log();

  // D) Completeness should not show missing active_goal when goals_active > 0
  console.log('Scenario D: completeness guard avoids false active_goal missing');
  const metricsD = {
    activity: {
      actions_planned: 3,
      actions_logged: 2,
      done_count: 2,
      partial_count: 0,
      completion_rate: 0.5,
      action_days_available: 12,
      completion_quality_avg: 100
    },
    urge: { avg_before: null, avg_after: null, avg_drop: null, drops_by_category: [], confidence: 'none' },
    risk_window: { top_hours: [], label: null, confidence: 'none' },
    tools: { best_categories: [] },
    baselines: { track: null, goal: null },
    slips: { slip_count: 0, second_session_rate: null },
    meta: {
      has_enough_data: true,
      sample_sizes: {
        completions: 2,
        actions: 3,
        goals_active: 1,
        slips: 0,
        urge_pairs: 0,
        timestamped_logs: 2
      }
    }
  };
  const completenessD = computeReportCompleteness(metricsD);
  assert(
    'missing_metrics does not include active_goal when goals_active > 0',
    !completenessD.missing_metrics.some((item) => item.key === 'active_goal')
  );
  console.log();

  // E) Regression: goal created 30 days before range start, no events, last_7_days window
  console.log('Scenario E: goal created 30 days before range, no events → still active (regression)');
  const last7Start = new Date('2026-02-11T00:00:00.000Z');
  const last7End   = new Date('2026-02-18T23:59:59.999Z');
  const goalsE = [{
    id: 'goal-E1',
    goal_slot: 1,
    is_active: true,
    selected_at: '2026-01-19T09:00:00.000Z', // 30 days before range start
    created_at:  '2026-01-19T09:00:00.000Z'
  }];
  const resultE = computeGoalsActiveInRange([], goalsE, last7Start, last7End);
  assert('goal created 30d before range counts as active (goals_active_count >= 1)', resultE.goals_active_count >= 1);
  assert('goals_active_unique_in_range contains goal-E1', Array.isArray(resultE.goals_active_unique_in_range) && resultE.goals_active_unique_in_range.includes('goal-E1'));
  console.log();

  // F) Regression: goal opened before range, then removed before range start → should NOT count
  console.log('Scenario F: goal opened then removed before range → NOT active (regression)');
  // goal-F1 was activated on Jan 1, then removed on Feb 5 (6 days before range starts Feb 11)
  const eventsF = [
    {
      goal_slot: 1,
      swapped_goal_id: 'goal-F1',
      swapped_out_goal_id: null,
      created_at: '2026-01-01T09:00:00.000Z' // goal-F1 starts
    },
    {
      goal_slot: 1,
      swapped_goal_id: null, // no replacement — slot cleared
      swapped_out_goal_id: 'goal-F1',
      created_at: '2026-02-05T12:00:00.000Z' // removed 6 days before range
    }
  ];
  const resultF = computeGoalsActiveInRange(eventsF, [], last7Start, last7End);
  assert('goal removed before range does not count (goals_active_count === 0)', resultF.goals_active_count === 0);
  console.log();

  console.log('===============================================');
  console.log(`Test Summary: ${passed} passed, ${failed} failed`);
  console.log('===============================================\n');

  if (failed > 0) process.exit(1);
}

if (typeof module !== 'undefined' && require.main === module) {
  testGoalOverlapScenarios();
}

module.exports = { testGoalOverlapScenarios };
