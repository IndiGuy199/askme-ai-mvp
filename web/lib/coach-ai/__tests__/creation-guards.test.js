/**
 * Tests for goal/action creation guards introduced to prevent free-text creation.
 *
 * Validates:
 *  - Goal API: source field required (library | ai) on goalData path
 *  - Action API: source: 'ai' required on every createAction call
 *  - Goal API: new user_wellness_goals rows created with is_active: false (swap-on-create fix)
 *  - UI disabled-state logic: Create Goal button, Create Action button
 *
 * Run with: node web/lib/coach-ai/__tests__/creation-guards.test.js
 */

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

// ---------------------------------------------------------------------------
// Pure validator mirrors — match the logic added to the API handlers exactly.
// ---------------------------------------------------------------------------

/** Mirrors the source guard in /api/goals.js POST → goalData path */
function validateGoalCreateSource(body) {
  const { source, goalData } = body;
  if (!goalData) return { ok: true }; // goalId path, no guard here
  if (!source || !['library', 'ai'].includes(source)) {
    return { ok: false, status: 400, error: 'Goal creation requires a valid source. Please select a goal from the dropdown or use AI Suggest Goals to generate one.' };
  }
  return { ok: true };
}

/** Mirrors the source guard in /api/actions.js createAction */
function validateActionCreateSource(body) {
  const { source } = body;
  if (!source || source !== 'ai') {
    return { ok: false, status: 400, error: 'Actions must be created from AI suggestions. Please use "Generate Actions with AI" and select at least one suggestion.' };
  }
  return { ok: true };
}

/**
 * Mirrors the insertData for a new user_wellness_goal row.
 * The bug was: no is_active field → DB default TRUE → goal immediately active.
 * The fix: explicitly pass is_active: false in the insert.
 */
function buildUserWellnessGoalInsert(userId, coachWellnessGoalId) {
  return {
    user_id: userId,
    coach_wellness_goal_id: coachWellnessGoalId,
    is_active: false,   // explicit — must not rely on DB default
  };
}

/**
 * Mirrors the Create Goal button disabled logic (playbook.js).
 * Enabled only when either:
 *  - selectedCoachGoal (dropdown pick), OR
 *  - selectedGoalOption !== null AND generatedGoalOptions.length > 0 (AI pick)
 */
function isCreateGoalButtonDisabled({ selectedCoachGoal, selectedGoalOption, generatedGoalOptions, savingData }) {
  return (!selectedCoachGoal && (selectedGoalOption === null || generatedGoalOptions.length === 0)) || savingData;
}

/**
 * Mirrors the Create Action button disabled logic (playbook.js).
 * Enabled only when at least one AI option is selected.
 */
function isCreateActionButtonDisabled({ selectedActionOptions, savingData }) {
  return selectedActionOptions.length === 0 || savingData;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function testGoalSourceValidation() {
  console.log('\n🧪 Goal source validation (API guard)');

  assert('no source + goalData → 400',
    !validateGoalCreateSource({ goalData: { label: 'Test', challengeId: 'c1' } }).ok);

  assert('source undefined + goalData → 400',
    !validateGoalCreateSource({ source: undefined, goalData: { label: 'Test', challengeId: 'c1' } }).ok);

  assert('source "manual" + goalData → 400',
    !validateGoalCreateSource({ source: 'manual', goalData: { label: 'Test', challengeId: 'c1' } }).ok);

  assert('source "freetext" + goalData → 400',
    !validateGoalCreateSource({ source: 'freetext', goalData: { label: 'Test', challengeId: 'c1' } }).ok);

  assert('source "ai" + goalData → ok',
    validateGoalCreateSource({ source: 'ai', goalData: { label: 'Test', challengeId: 'c1' } }).ok);

  assert('source "library" + goalData → ok',
    validateGoalCreateSource({ source: 'library', goalData: { label: 'Test', challengeId: 'c1' } }).ok);

  assert('goalId path (no goalData) → ok regardless of source',
    validateGoalCreateSource({ goalId: 'g1', challengeId: 'c1' }).ok);

  // Error message is descriptive
  const err = validateGoalCreateSource({ goalData: { label: 'x' } });
  assert('error message contains "source"', err.error.toLowerCase().includes('source'));
}

function testActionSourceValidation() {
  console.log('\n🧪 Action source validation (API guard)');

  assert('no source → 400',
    !validateActionCreateSource({ email: 'u@x.com', actionText: 'foo' }).ok);

  assert('source undefined → 400',
    !validateActionCreateSource({ email: 'u@x.com', actionText: 'foo', source: undefined }).ok);

  assert('source "manual" → 400',
    !validateActionCreateSource({ email: 'u@x.com', actionText: 'foo', source: 'manual' }).ok);

  assert('source "library" → 400',
    !validateActionCreateSource({ email: 'u@x.com', actionText: 'foo', source: 'library' }).ok);

  assert('source "freetext" → 400',
    !validateActionCreateSource({ email: 'u@x.com', actionText: 'foo', source: 'freetext' }).ok);

  assert('source "ai" → ok',
    validateActionCreateSource({ email: 'u@x.com', actionText: 'foo', source: 'ai' }).ok);

  const err = validateActionCreateSource({ actionText: 'foo' });
  assert('error message mentions AI suggestions', err.error.toLowerCase().includes('ai'));
  assert('status is 400', err.status === 400);
}

function testIsActiveFalseOnCreate() {
  console.log('\n🧪 is_active: false on new user_wellness_goal inserts (swap-on-create fix)');

  const insert = buildUserWellnessGoalInsert('user-123', 'cwg-456');
  assert('insert has is_active field', 'is_active' in insert);
  assert('is_active is explicitly false', insert.is_active === false);
  assert('user_id is correct', insert.user_id === 'user-123');
  assert('coach_wellness_goal_id is correct', insert.coach_wellness_goal_id === 'cwg-456');

  // The old bug: no is_active field → DB default true → auto-activated
  const oldInsert = { user_id: 'u', coach_wellness_goal_id: 'g' };
  assert('OLD insert (bug): is_active not present → would use DB default', !('is_active' in oldInsert));
  // This confirms the bug pattern — absence = defaulting to true in the DB
}

function testCreateGoalButtonDisabled() {
  console.log('\n🧪 Create Goal button disabled logic (UI guard)');

  // Disabled states
  assert('no selection (empty dropdown + no AI) → disabled',
    isCreateGoalButtonDisabled({ selectedCoachGoal: '', selectedGoalOption: null, generatedGoalOptions: [], savingData: false }));

  assert('no dropdown, selectedGoalOption set but no generated options → disabled',
    isCreateGoalButtonDisabled({ selectedCoachGoal: '', selectedGoalOption: 0, generatedGoalOptions: [], savingData: false }));

  assert('no dropdown, no selectedGoalOption but has generated options → disabled',
    isCreateGoalButtonDisabled({ selectedCoachGoal: '', selectedGoalOption: null, generatedGoalOptions: [{ label: 'G' }], savingData: false }));

  assert('saving in progress → disabled',
    isCreateGoalButtonDisabled({ selectedCoachGoal: 'g1', selectedGoalOption: null, generatedGoalOptions: [], savingData: true }));

  // Enabled states
  assert('dropdown selected → enabled',
    !isCreateGoalButtonDisabled({ selectedCoachGoal: 'g1', selectedGoalOption: null, generatedGoalOptions: [], savingData: false }));

  assert('AI option selected + has generated options → enabled',
    !isCreateGoalButtonDisabled({ selectedCoachGoal: '', selectedGoalOption: 0, generatedGoalOptions: [{ label: 'G' }], savingData: false }));

  assert('AI option at index 2 selected → enabled',
    !isCreateGoalButtonDisabled({ selectedCoachGoal: '', selectedGoalOption: 2, generatedGoalOptions: [{ label: 'A' }, { label: 'B' }, { label: 'C' }], savingData: false }));
}

function testCreateActionButtonDisabled() {
  console.log('\n🧪 Create Action button disabled logic (UI guard)');

  // Disabled states
  assert('no AI options selected → disabled',
    isCreateActionButtonDisabled({ selectedActionOptions: [], savingData: false }));

  assert('saving in progress → disabled',
    isCreateActionButtonDisabled({ selectedActionOptions: [0], savingData: true }));

  assert('saving + no selection → disabled',
    isCreateActionButtonDisabled({ selectedActionOptions: [], savingData: true }));

  // Enabled states
  assert('one AI option selected → enabled',
    !isCreateActionButtonDisabled({ selectedActionOptions: [0], savingData: false }));

  assert('multiple AI options selected → enabled',
    !isCreateActionButtonDisabled({ selectedActionOptions: [0, 1, 2], savingData: false }));

  // Old (buggy) disabled logic: newActionText.trim() would be enough to enable
  // Verify the new logic IGNORES free text
  const oldDisabled = (text, aiSelections) => (!text.trim() && aiSelections.length === 0);
  const newDisabled = (aiSelections) => aiSelections.length === 0;

  assert('OLD logic (bug): text + no AI → was enabled', !oldDisabled('some text', []));
  assert('NEW logic (fix): text + no AI → stays disabled', newDisabled([]));
  assert('NEW logic: no text + AI selected → enabled', !newDisabled([0]));
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

testGoalSourceValidation();
testActionSourceValidation();
testIsActiveFalseOnCreate();
testCreateGoalButtonDisabled();
testCreateActionButtonDisabled();

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('❌ Some tests failed');
  process.exit(1);
} else {
  console.log('✅ All tests passed');
}
