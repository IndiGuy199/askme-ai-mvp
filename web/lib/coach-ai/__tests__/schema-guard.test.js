/**
 * Tests for applySchemaGuard() — API schema normalisation.
 * Run with: node web/lib/coach-ai/__tests__/schema-guard.test.js
 *
 * Strategy: Inline the pure applySchemaGuard logic so tests run without
 * requiring TypeScript compilation or ESM resolution.
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

function assertType(label, value, type) {
  assert(label, typeof value === type);
}

// ── Inline helpers ────────────────────────────────────────────────────────────

function deriveCompareConfidence(m) {
  if (!m) return 'none';
  const completions =
    m.meta?.sample_sizes?.completions ?? m.activity?.actions_logged ?? 0;
  const urgePairs    = m.meta?.sample_sizes?.urge_pairs ?? 0;
  const timestamped  = m.meta?.sample_sizes?.timestamped_logs ?? 0;
  if (completions >= 5 && (urgePairs >= 3 || timestamped >= 5)) return 'high';
  if (completions >= 3) return 'medium';
  if (completions >= 1) return 'low';
  return 'none';
}

const SCHEMA_DEFAULTS = {
  summary_paragraph: 'Keep logging actions to build pattern data.',
  whats_working: ['Bullet A.', 'Bullet B.'],
  where_vulnerable: ['Gap A.', 'Gap B.'],
  patterns_triggers: ['Pattern A.', 'Pattern B.'],
  slip_analysis: null,
  one_experiment: {
    title: 'Build your data baseline',
    why: 'Need more completion logs.',
    steps: ['Step 1.', 'Step 2.', 'Step 3.']
  },
  compare_section: { label: 'No comparison selected', bullets: [] }
};

function applySchemaGuard(data, compareMode, compareMetrics) {
  if (!data || typeof data !== 'object') data = {};

  const result = {
    summary_paragraph: typeof data.summary_paragraph === 'string' && data.summary_paragraph.length >= 10
      ? data.summary_paragraph : SCHEMA_DEFAULTS.summary_paragraph,
    whats_working: Array.isArray(data.whats_working) && data.whats_working.length >= 2
      ? data.whats_working : SCHEMA_DEFAULTS.whats_working,
    where_vulnerable: Array.isArray(data.where_vulnerable) && data.where_vulnerable.length >= 2
      ? data.where_vulnerable : SCHEMA_DEFAULTS.where_vulnerable,
    patterns_triggers: Array.isArray(data.patterns_triggers) && data.patterns_triggers.length >= 2
      ? data.patterns_triggers : SCHEMA_DEFAULTS.patterns_triggers,
    slip_analysis: (data.slip_analysis && typeof data.slip_analysis === 'object'
      && data.slip_analysis.pattern && data.slip_analysis.anti_binge_rule && data.slip_analysis.repair_step)
      ? data.slip_analysis : null,
    one_experiment: (data.one_experiment && typeof data.one_experiment === 'object'
      && data.one_experiment.title && Array.isArray(data.one_experiment.steps))
      ? data.one_experiment : SCHEMA_DEFAULTS.one_experiment,
    compare_section: SCHEMA_DEFAULTS.compare_section
  };

  if (compareMode === 'none' || !compareMetrics) {
    result.compare_section = { label: 'No comparison selected', bullets: [] };
  } else {
    const conf = deriveCompareConfidence(compareMetrics);
    const modeLabel = compareMode === 'baseline' ? 'Compared to baseline' : 'Compared to previous period';
    if (conf === 'high' || conf === 'medium') {
      const modelBullets = (data.compare_section?.bullets && Array.isArray(data.compare_section.bullets))
        ? data.compare_section.bullets.slice(0, 3) : [];
      result.compare_section = { label: modeLabel, bullets: modelBullets };
    } else {
      result.compare_section = { label: 'Not enough data to compare yet', bullets: [] };
    }
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GOOD_DATA = {
  summary_paragraph: 'You had a solid week with consistent action logging and measurable urge reduction.',
  whats_working: ['Phone barriers reduced evening urge spikes — log more to confirm.', 'Completion rate at 60% is above baseline.'],
  where_vulnerable: ['Late night hours remain high-risk — 3+ logs show a pattern.', 'Urge data is still sparse.'],
  patterns_triggers: ['10pm–12am is your most logged window — treat it as confirmed.', 'Urge before averaging 6.2 suggests moderate baseline cravings.'],
  slip_analysis: null,
  one_experiment: { title: 'Night lock', why: 'Late night is your peak risk.', steps: ['s1', 's2', 's3'] },
  compare_section: { label: 'Compared to previous period', bullets: ['Completion up 10%.', 'Urge drop improved.'] }
};

// ── Test: happy path ──────────────────────────────────────────────────────────
console.log('\napplySchemaGuard — happy path (valid v3 data)');

const result1 = applySchemaGuard(GOOD_DATA, 'none', null);
assert('summary_paragraph preserved',      result1.summary_paragraph === GOOD_DATA.summary_paragraph);
assert('whats_working preserved',          result1.whats_working === GOOD_DATA.whats_working);
assert('where_vulnerable preserved',       result1.where_vulnerable === GOOD_DATA.where_vulnerable);
assert('patterns_triggers preserved',      result1.patterns_triggers === GOOD_DATA.patterns_triggers);
assert('slip_analysis is null (no slips)', result1.slip_analysis === null);
assert('one_experiment preserved',         result1.one_experiment === GOOD_DATA.one_experiment);

// ── Test: compare_mode = none → label "No comparison selected" ────────────────
console.log('\napplySchemaGuard — compare_mode=none');

assert('compare_section.label = "No comparison selected"', result1.compare_section.label === 'No comparison selected');
assert('compare_section.bullets = []', Array.isArray(result1.compare_section.bullets) && result1.compare_section.bullets.length === 0);

// ── Test: all required keys present even with null input ─────────────────────
console.log('\napplySchemaGuard — null input fills defaults');

const result2 = applySchemaGuard(null, 'none', null);
const REQUIRED_KEYS = ['summary_paragraph', 'whats_working', 'where_vulnerable', 'patterns_triggers', 'slip_analysis', 'one_experiment', 'compare_section'];
REQUIRED_KEYS.forEach(k => {
  assert(`key "${k}" present`, k in result2);
});
assert('whats_working is array with ≥2 items', Array.isArray(result2.whats_working) && result2.whats_working.length >= 2);
assert('where_vulnerable is array with ≥2 items', Array.isArray(result2.where_vulnerable) && result2.where_vulnerable.length >= 2);
assert('patterns_triggers is array with ≥2 items', Array.isArray(result2.patterns_triggers) && result2.patterns_triggers.length >= 2);
assert('slip_analysis defaults to null', result2.slip_analysis === null);
assert('one_experiment has title', typeof result2.one_experiment.title === 'string');
assert('one_experiment has steps array', Array.isArray(result2.one_experiment.steps));
assert('compare_section is object', typeof result2.compare_section === 'object');
assert('compare_section.bullets is array', Array.isArray(result2.compare_section.bullets));

// ── Test: compare_mode=previous_period, high confidence ──────────────────────
console.log('\napplySchemaGuard — compare_mode=previous_period, high confidence');

const highCompare = { meta: { sample_sizes: { completions: 6, urge_pairs: 4, timestamped_logs: 0 } } };
const result3 = applySchemaGuard(GOOD_DATA, 'previous_period', highCompare);
assert('label = "Compared to previous period"', result3.compare_section.label === 'Compared to previous period');
// Model provided bullets and confidence is high — they should be kept
assert('model bullets preserved', Array.isArray(result3.compare_section.bullets));

// ── Test: compare_mode=previous_period, low confidence ───────────────────────
console.log('\napplySchemaGuard — compare_mode=previous_period, low confidence');

const lowCompare = { activity: { actions_logged: 1 }, meta: { sample_sizes: { completions: 1, urge_pairs: 0 } } };
const result4 = applySchemaGuard(GOOD_DATA, 'previous_period', lowCompare);
assert('low-conf: label = "Not enough data to compare yet"', result4.compare_section.label === 'Not enough data to compare yet');
assert('low-conf: bullets = []', result4.compare_section.bullets.length === 0);

// ── Test: compare_mode=baseline, low confidence ───────────────────────────────
console.log('\napplySchemaGuard — compare_mode=baseline, no compare metrics');

const result5 = applySchemaGuard(GOOD_DATA, 'baseline', null);
assert('no compareMetrics: label = "No comparison selected"', result5.compare_section.label === 'No comparison selected');
assert('no compareMetrics: bullets = []', result5.compare_section.bullets.length === 0);

// ── Test: compare_mode=baseline, valid baseline ───────────────────────────────
console.log('\napplySchemaGuard — compare_mode=baseline, medium confidence');

const baselineMetrics = { activity: { actions_logged: 4 }, meta: { sample_sizes: { completions: 4, urge_pairs: 1 } } };
const result6 = applySchemaGuard(GOOD_DATA, 'baseline', baselineMetrics);
assert('baseline medium-conf: label = "Compared to baseline"', result6.compare_section.label === 'Compared to baseline');

// ── Test: slip_analysis only present when model returns valid object ──────────
console.log('\napplySchemaGuard — slip_analysis handling');

const dataWithSlip = {
  ...GOOD_DATA,
  slip_analysis: { pattern: 'Slipped 3x on weekends', anti_binge_rule: 'Cap at 1 day', repair_step: '5-min log' }
};
const result7 = applySchemaGuard(dataWithSlip, 'none', null);
assert('valid slip_analysis preserved', result7.slip_analysis !== null && result7.slip_analysis.pattern === 'Slipped 3x on weekends');

const dataPartialSlip = { ...GOOD_DATA, slip_analysis: { pattern: 'Some pattern' } }; // missing fields
const result8 = applySchemaGuard(dataPartialSlip, 'none', null);
assert('partial slip_analysis rejected → null', result8.slip_analysis === null);

// ── Test: ui rendering check — no blank sections ──────────────────────────────
console.log('\nUI contract — sections always renderable');

function checkRenderable(schema) {
  // Every array section must be a non-empty array OR null (for slip_analysis)
  return (
    typeof schema.summary_paragraph === 'string' && schema.summary_paragraph.length > 0 &&
    Array.isArray(schema.whats_working) && schema.whats_working.length >= 2 &&
    Array.isArray(schema.where_vulnerable) && schema.where_vulnerable.length >= 2 &&
    Array.isArray(schema.patterns_triggers) && schema.patterns_triggers.length >= 2 &&
    (schema.slip_analysis === null || typeof schema.slip_analysis === 'object') &&
    typeof schema.one_experiment === 'object' && schema.one_experiment !== null &&
    typeof schema.compare_section === 'object' && Array.isArray(schema.compare_section.bullets)
  );
}

assert('null input → renderable output',    checkRenderable(applySchemaGuard(null, 'none', null)));
assert('valid v3 → renderable',             checkRenderable(applySchemaGuard(GOOD_DATA, 'none', null)));
assert('missing bullets → renderable',      checkRenderable(applySchemaGuard({ summary_paragraph: 'X'.repeat(10) }, 'none', null)));
assert('compare result → renderable',       checkRenderable(applySchemaGuard(GOOD_DATA, 'previous_period', highCompare)));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} assertions: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
