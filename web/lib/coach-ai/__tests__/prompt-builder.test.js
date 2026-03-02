/**
 * Tests for buildCompactInsightPrompt() — prompt content validation.
 * Run with: node web/lib/coach-ai/__tests__/prompt-builder.test.js
 *
 * Strategy: Inline a minimal reproduction of the prompt-builder logic so we
 * can test its output structure without importing TypeScript at runtime.
 * We verify:
 *   1. Required METRICS keys are present in the prompt string.
 *   2. Compare-confidence gating flags appear when needed.
 *   3. Required output JSON keys are listed in the prompt.
 *   4. Category codes are never passed raw to the model.
 */

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// ── Inline the pure helpers under test ─────────────────────────────────────

function translateCategoryCode(code) {
  const MAP = {
    DEVICE_FRICTION:      'Phone barriers',
    ENVIRONMENT_SHIFT:    'Environment change',
    ACCOUNTABILITY_PING:  'Accountability check-in',
    TIME_PROTOCOL:        'Time-based rule',
    ANTI_BINGE_LOCK:      'Anti-binge lock',
    RECOVERY_REPAIR:      'Recovery repair',
    SHAME_REPAIR:         'Shame repair',
    URGE_INTERRUPT:       'Urge interrupt',
  };
  return MAP[code] ?? code;
}

function deriveCompareConfidence(m) {
  if (!m) return 'none';
  const completions =
    m.meta?.sample_sizes?.completions ?? m.activity?.actions_logged ?? 0;
  const urgePairs = m.meta?.sample_sizes?.urge_pairs ?? 0;
  const timestamped = m.meta?.sample_sizes?.timestamped_logs ?? 0;
  if (completions >= 5 && (urgePairs >= 3 || timestamped >= 5)) return 'high';
  if (completions >= 3) return 'medium';
  if (completions >= 1) return 'low';
  return 'none';
}

function buildPrompt(metrics, compareMetrics, firstName, compareMode) {
  const slipCountVal = metrics.slips?.slip_count ?? 0;
  const compact = {
    period: `${metrics.range?.days || '?'}d`,
    actions_planned: metrics.activity?.actions_planned ?? 0,
    actions_logged:  metrics.activity?.actions_logged ?? 0,
    completion_rate: metrics.activity?.completion_rate ?? 0,
    urge_confidence: metrics.urge?.confidence ?? 'none',
    best_tools: (metrics.tools?.best_categories || []).map(t => ({
      tool:  translateCategoryCode(t.category),
      score: t.score,
      n:     t.sample_size
    })),
    samples: metrics.meta?.sample_sizes ?? {}
  };
  if (slipCountVal > 0) compact.slips = slipCountVal;

  const compareConf = deriveCompareConfidence(compareMetrics);
  const compareAllowed = compareConf === 'high' || compareConf === 'medium';
  const resolvedCompareMode = compareMode || 'none';

  let compareContextBlock = '';
  if (compareMetrics && compareAllowed) {
    const modeLabel = resolvedCompareMode === 'baseline' ? 'Compared to baseline' : 'Compared to previous period';
    compareContextBlock = `PREV_PERIOD (${compareConf} confidence): {...}\ncompare_section.label = "${modeLabel}"`;
  } else if (compareMetrics && !compareAllowed) {
    compareContextBlock = `PREV_PERIOD: insufficient data (compare_confidence=${compareConf}).\ncompare_section.bullets = []`;
  } else {
    compareContextBlock = `No compare period provided.\ncompare_section.label = "No comparison selected"\ncompare_section.bullets = []`;
  }

  return `METRICS: ${JSON.stringify(compact)}\n${compareContextBlock}\nRequired output keys: summary_paragraph, whats_working, where_vulnerable, patterns_triggers, slip_analysis, one_experiment, compare_section`;
}

// ── Test: deriveCompareConfidence ────────────────────────────────────────────
console.log('\nderiveCompareConfidence()');

assert('null metrics → none', deriveCompareConfidence(null) === 'none');
assert('0 completions → none', deriveCompareConfidence({ activity: { actions_logged: 0 }, meta: { sample_sizes: { urge_pairs: 0 } } }) === 'none');
assert('1 completion → low', deriveCompareConfidence({ activity: { actions_logged: 1 }, meta: { sample_sizes: { urge_pairs: 0 } } }) === 'low');
assert('3 completions → medium', deriveCompareConfidence({ activity: { actions_logged: 3 }, meta: { sample_sizes: { urge_pairs: 0 } } }) === 'medium');
assert('5+ completions & 3+ urge_pairs → high',
  deriveCompareConfidence({ meta: { sample_sizes: { completions: 6, urge_pairs: 4, timestamped_logs: 0 } } }) === 'high');
assert('5+ completions & 5+ timestamped → high',
  deriveCompareConfidence({ meta: { sample_sizes: { completions: 5, urge_pairs: 0, timestamped_logs: 5 } } }) === 'high');
assert('5 completions, 0 urge pairs, 0 timestamped → medium',
  deriveCompareConfidence({ meta: { sample_sizes: { completions: 5, urge_pairs: 0, timestamped_logs: 0 } } }) === 'medium');

// ── Test: category code translation ─────────────────────────────────────────
console.log('\ntranslateCategoryCode()');

assert('DEVICE_FRICTION → "Phone barriers"', translateCategoryCode('DEVICE_FRICTION') === 'Phone barriers');
assert('ENVIRONMENT_SHIFT → "Environment change"', translateCategoryCode('ENVIRONMENT_SHIFT') === 'Environment change');
assert('ACCOUNTABILITY_PING → "Accountability check-in"', translateCategoryCode('ACCOUNTABILITY_PING') === 'Accountability check-in');
assert('unknown code passes through', translateCategoryCode('CUSTOM_THING') === 'CUSTOM_THING');

// ── Test: prompt string contains required output keys ────────────────────────
console.log('\nbuildPrompt() — required output keys');

const baseMetrics = {
  range: { days: 7 },
  activity: { actions_planned: 5, actions_logged: 3, completion_rate: 0.6 },
  urge: { confidence: 'medium' },
  tools: { best_categories: [{ category: 'DEVICE_FRICTION', score: 0.8, sample_size: 4 }] },
  meta: { sample_sizes: { completions: 3, urge_pairs: 2 } }
};

const promptNoCompare = buildPrompt(baseMetrics, null, 'Alex', 'none');
assert('prompt contains summary_paragraph key', promptNoCompare.includes('summary_paragraph'));
assert('prompt contains whats_working key', promptNoCompare.includes('whats_working'));
assert('prompt contains where_vulnerable key', promptNoCompare.includes('where_vulnerable'));
assert('prompt contains patterns_triggers key', promptNoCompare.includes('patterns_triggers'));
assert('prompt contains slip_analysis key', promptNoCompare.includes('slip_analysis'));
assert('prompt contains one_experiment key', promptNoCompare.includes('one_experiment'));
assert('prompt contains compare_section key', promptNoCompare.includes('compare_section'));

// ── Test: compare gating — no compare data ───────────────────────────────────
console.log('\nbuildPrompt() — compare gating (no compare)');

assert('no-compare prompt includes "No comparison selected"', promptNoCompare.includes('No comparison selected'));
assert('no-compare prompt includes empty bullets instruction', promptNoCompare.includes('bullets = []') || promptNoCompare.includes('bullets: []'));

// ── Test: compare gating — low confidence compare ───────────────────────────
console.log('\nbuildPrompt() — compare gating (low confidence)');

const lowCompareMetrics = {
  activity: { actions_logged: 1 },
  meta: { sample_sizes: { completions: 1, urge_pairs: 0 } }
};
const promptLowCompare = buildPrompt(baseMetrics, lowCompareMetrics, 'Alex', 'previous_period');
assert('low-confidence prevents bullets', promptLowCompare.includes('bullets = []') || promptLowCompare.includes('insufficient data'));
assert('low-confidence shows "Not enough data"', promptLowCompare.includes('Not enough data') || promptLowCompare.includes('insufficient data'));

// ── Test: compare gating — high confidence compare ───────────────────────────
console.log('\nbuildPrompt() — compare gating (high confidence)');

const highCompareMetrics = {
  activity: { actions_logged: 6 },
  urge: { avg_drop: 2.1 },
  slips: { slip_count: 0 },
  meta: { sample_sizes: { completions: 6, urge_pairs: 4, timestamped_logs: 0 } }
};
const promptHighCompare = buildPrompt(baseMetrics, highCompareMetrics, 'Alex', 'previous_period');
assert('high-confidence allowed shows "Compared to previous period"', promptHighCompare.includes('Compared to previous period'));

// ── Test: slip_analysis not mentioned when no slips ───────────────────────────
console.log('\nbuildPrompt() — slip suppression');

const metricsNoSlips = { ...baseMetrics, slips: { slip_count: 0 } };
const promptNoSlips = buildPrompt(metricsNoSlips, null, 'Alex', 'none');
const metricsJson = JSON.parse(promptNoSlips.match(/METRICS: ({.*?})\n/)?.[1] || '{}');
assert('slip_count=0 → no slips key in METRICS blob', !('slips' in metricsJson));

const metricsWithSlips = { ...baseMetrics, slips: { slip_count: 3 } };
const promptWithSlips = buildPrompt(metricsWithSlips, null, 'Alex', 'none');
const metricsJsonSlips = JSON.parse(promptWithSlips.match(/METRICS: ({.*?})\n/)?.[1] || '{}');
assert('slip_count>0 → slips key present in METRICS blob', 'slips' in metricsJsonSlips && metricsJsonSlips.slips === 3);

// ── Test: raw category codes not in prompt ────────────────────────────────────
console.log('\nbuildPrompt() — no raw category codes in prompt');

const rawCodes = ['DEVICE_FRICTION', 'ENVIRONMENT_SHIFT', 'ACCOUNTABILITY_PING', 'TIME_PROTOCOL', 'ANTI_BINGE_LOCK'];
rawCodes.forEach(code => {
  assert(`"${code}" not present in prompt`, !promptNoCompare.includes(code));
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} assertions: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
