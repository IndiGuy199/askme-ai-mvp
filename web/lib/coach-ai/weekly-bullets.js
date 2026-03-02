/**
 * Deterministic weekly pattern bullet derivation.
 * Plain CJS version (mirrors deriveWeeklyBullets in prompts.ts) for Node.js scripts/tests.
 * Depends on completeness.js for mapCategoryToLabel.
 */
'use strict';

const { mapCategoryToLabel } = require('./completeness');

/**
 * Derive weekly pattern bullets + next_week_plan from InsightMetrics.
 * No AI call; returns InsightResponseSchema-compatible shape.
 * @param {object} metrics  — result of getInsightMetrics()
 * @param {string} challengeId — user's challenge_id
 */
function deriveWeeklyBullets(metrics, challengeId) {
  const urgePairs = metrics?.meta?.sample_sizes?.urge_pairs ?? 0;
  const completionRate = metrics?.activity?.completion_rate ?? 0;
  const actionsLogged = metrics?.activity?.actions_logged ?? 0;
  const actionsPlanned = metrics?.activity?.actions_planned ?? 0;
  const bestCat = metrics?.tools?.best_categories?.[0];
  const dropsEntry = metrics?.urge?.drops_by_category?.[0];
  const topHour = metrics?.risk_window?.top_hours?.[0];
  const riskLabel = metrics?.risk_window?.label ?? null;
  const riskConf = metrics?.risk_window?.confidence ?? 'none';
  const slipCount = metrics?.slips?.slip_count ?? 0;

  const hasAnyData = actionsPlanned > 0 || actionsLogged > 0;
  const insufficient_data = !hasAnyData;
  const low_confidence = hasAnyData && (actionsLogged < 5 || (urgePairs < 3 && !bestCat));

  // ---- High-risk time bullet ----
  let risk_window;
  if (riskLabel && riskConf !== 'none') {
    risk_window = riskConf === 'low'
      ? `${riskLabel} (low confidence \u2014 log more to confirm)`
      : `${riskLabel} (${riskConf} confidence)`;
  } else if (topHour) {
    risk_window = `around ${topHour.hour}:00 (low confidence \u2014 log more timestamped actions)`;
  } else {
    risk_window = 'not enough data yet \u2014 log more timestamped actions';
  }

  // ---- What helps most bullet ----
  const toolSource = bestCat ?? (dropsEntry ? { category: dropsEntry.category, sample_size: dropsEntry.count ?? 0 } : null);
  let best_tool;
  if (toolSource) {
    const label = mapCategoryToLabel(toolSource.category);
    const n = toolSource.sample_size ?? toolSource.count ?? 0;
    best_tool = n > 0 ? `${label} (${n} log${n !== 1 ? 's' : ''})` : label;
  } else {
    best_tool = 'not enough data yet \u2014 add urge ratings when you log actions';
  }

  // ---- Best next step (best_lever) ----
  let best_lever;
  if (!hasAnyData) {
    best_lever = 'start by adding actions to your Playbook and logging completions';
  } else if (urgePairs < 5) {
    const need = Math.max(1, 5 - urgePairs);
    best_lever = `log urge before/after on ${need} more action log${need !== 1 ? 's' : ''} to unlock urge analysis`;
  } else if (completionRate < 0.2) {
    best_lever = 'pick 1 action and log it daily for 7 days to build consistency';
  } else if (bestCat && (bestCat.sample_size ?? 0) < 5) {
    best_lever = `repeat "${mapCategoryToLabel(bestCat.category)}" 3 more times to confirm it works`;
  } else {
    const toolName = bestCat ? mapCategoryToLabel(bestCat.category) : 'your top tools';
    const when = riskLabel ?? 'your high-risk times';
    best_lever = `keep using ${toolName} during ${when}`;
  }

  // ---- next_week_plan ----
  const keep = [
    bestCat ? `Keep using ${mapCategoryToLabel(bestCat.category)} as your primary tool` : 'Keep logging actions in your Playbook each day',
    riskLabel ? `Stay aware of your ${riskLabel} risk window` : 'Keep logging actions with timestamps so patterns emerge'
  ];

  const change = [
    completionRate < 0.4
      ? 'Reduce action count \u2014 focus on just 2-3 high-impact ones'
      : 'Try logging one action type you have not used before',
    urgePairs < 5
      ? `Add urge before & after ratings to ${Math.max(1, 5 - urgePairs)} more log${Math.max(1, 5 - urgePairs) !== 1 ? 's' : ''}`
      : 'Vary the time of day you use your top action to find the best window'
  ];

  const tryItems = [
    urgePairs < 5
      ? 'Rate your urge (0\u201310) before AND after your next 3 logged actions'
      : bestCat
        ? `Use ${mapCategoryToLabel(bestCat.category)} specifically at your high-risk time for one week`
        : 'Pick one new action category and log it 3 times this week',
    slipCount > 0
      ? 'After a slip, pause 5 mins and write down the trigger before any next step'
      : 'Try a brand-new action from a category you have not yet logged'
  ];

  return {
    challenge_id: challengeId,
    timeframe_days: 7,
    low_confidence,
    insufficient_data,
    insights: { risk_window, best_tool, best_lever },
    next_week_plan: { keep, change, try: tryItems }
  };
}

module.exports = { deriveWeeklyBullets };
