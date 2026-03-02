/**
 * Cache key and invalidation logic tests for insights-detailed API.
 * Tests the pure functions that can be exercised without a live DB.
 * Run with: node web/lib/coach-ai/__tests__/insights-caching.test.js
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

// ─────────────────────────────────────────────
// Inline the pure functions under test
// (avoids needing to compile TypeScript or spin up Supabase)
// ─────────────────────────────────────────────

function buildCacheKey(userId, trackId, rangeKey, compareMode) {
  return `${userId}:${trackId}:${rangeKey}:${compareMode}`;
}

function getDateRange(rangeKey) {
  const end = new Date();
  const start = new Date();
  switch (rangeKey) {
    case 'last_7_days':  start.setDate(end.getDate() - 7);  break;
    case 'last_30_days': start.setDate(end.getDate() - 30); break;
    case 'last_90_days': start.setDate(end.getDate() - 90); break;
    case 'since_beginning': start.setFullYear(2020);         break;
    default: throw new Error(`Unknown rangeKey: ${rangeKey}`);
  }
  return { start, end };
}

// Simulate the TTL check that getValidSnapshot performs
function isWithinTTL(snapshotCreatedAt, ttlHours = 4) {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - ttlHours);
  return new Date(snapshotCreatedAt) > cutoff;
}

// Simulate the invalidation check: cache is stale if any new events occurred after snapshotCreatedAt
function isCacheInvalidated(snapshotCreatedAt, latestEventAt) {
  if (!latestEventAt) return false; // no new events → cache still valid
  return new Date(latestEventAt) > new Date(snapshotCreatedAt);
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

function testCacheBehavior() {
  console.log('🧪 Testing insights cache key and invalidation logic...\n');

  // ---- 1. Cache key format ----
  console.log('Scenario 1: buildCacheKey produces correct composite key');
  const key1 = buildCacheKey('user-123', 'track-456', 'last_7_days', 'none');
  assert('key = userId:trackId:rangeKey:compareMode', key1 === 'user-123:track-456:last_7_days:none');

  const key2 = buildCacheKey('user-abc', 'track-xyz', 'last_30_days', 'prior_period');
  assert('compare mode included in key', key2 === 'user-abc:track-xyz:last_30_days:prior_period');

  const key3 = buildCacheKey('user-123', 'track-456', 'last_7_days', 'none');
  const key4 = buildCacheKey('user-123', 'track-456', 'last_7_days', 'prior_period');
  assert('same inputs same key (deterministic)', key1 === key3);
  assert('different compareMode → different key', key3 !== key4);

  const key5 = buildCacheKey('user-123', 'track-456', 'last_30_days', 'none');
  assert('different rangeKey → different key', key1 !== key5);
  console.log();

  // ---- 2. TTL check ----
  console.log('Scenario 2: TTL check (4-hour window)');
  const now = new Date();

  const fresh2h = new Date(now); fresh2h.setHours(fresh2h.getHours() - 2);
  assert('snapshot 2h old is within 4h TTL', isWithinTTL(fresh2h.toISOString()) === true);

  const fresh3h59 = new Date(now); fresh3h59.setHours(fresh3h59.getHours() - 3); fresh3h59.setMinutes(fresh3h59.getMinutes() - 59);
  assert('snapshot 3h59m old is within 4h TTL', isWithinTTL(fresh3h59.toISOString()) === true);

  const expired5h = new Date(now); expired5h.setHours(expired5h.getHours() - 5);
  assert('snapshot 5h old is outside 4h TTL', isWithinTTL(expired5h.toISOString()) === false);

  const expired4h1m = new Date(now); expired4h1m.setHours(expired4h1m.getHours() - 4); expired4h1m.setMinutes(expired4h1m.getMinutes() - 1);
  assert('snapshot 4h1m old is outside 4h TTL', isWithinTTL(expired4h1m.toISOString()) === false);
  console.log();

  // ---- 3. Cache invalidation by new events ----
  console.log('Scenario 3: Cache invalidated by newer events');
  const snap1h = new Date(now); snap1h.setHours(snap1h.getHours() - 1);

  // No new events → valid
  assert('no new events → cache NOT invalidated', isCacheInvalidated(snap1h.toISOString(), null) === false);
  assert('no new events (undefined) → cache NOT invalidated', isCacheInvalidated(snap1h.toISOString(), undefined) === false);

  // Event AFTER snapshot → invalidated
  const eventAfter = new Date(now); eventAfter.setMinutes(eventAfter.getMinutes() - 30);
  assert('event after snapshot → cache invalidated', isCacheInvalidated(snap1h.toISOString(), eventAfter.toISOString()) === true);

  // Event BEFORE snapshot → still valid
  const eventBefore = new Date(snap1h); eventBefore.setHours(eventBefore.getHours() - 1);
  assert('event before snapshot → cache NOT invalidated', isCacheInvalidated(snap1h.toISOString(), eventBefore.toISOString()) === false);

  // Event AT EXACT snapshot time → treat as before, not invalidated
  assert('event exactly at snapshot time → cache NOT invalidated', isCacheInvalidated(snap1h.toISOString(), snap1h.toISOString()) === false);
  console.log();

  // ---- 4. getDateRange produces valid windows ----
  console.log('Scenario 4: getDateRange produces correct time windows');
  const r7 = getDateRange('last_7_days');
  const diffDays7 = Math.round((r7.end - r7.start) / (1000 * 60 * 60 * 24));
  assert('last_7_days window is ~7 days', diffDays7 === 7);

  const r30 = getDateRange('last_30_days');
  const diffDays30 = Math.round((r30.end - r30.start) / (1000 * 60 * 60 * 24));
  assert('last_30_days window is ~30 days', diffDays30 === 30);

  const r90 = getDateRange('last_90_days');
  const diffDays90 = Math.round((r90.end - r90.start) / (1000 * 60 * 60 * 24));
  assert('last_90_days window is ~90 days', diffDays90 === 90);

  const rAll = getDateRange('since_beginning');
  assert('since_beginning start is year 2020', rAll.start.getFullYear() === 2020);
  console.log();

  // ---- 5. Cache key uniqueness — different user/track combos never collide ----
  console.log('Scenario 5: No cache key collisions across users/tracks');
  const keys = [
    buildCacheKey('user-1', 'track-A', 'last_7_days', 'none'),
    buildCacheKey('user-2', 'track-A', 'last_7_days', 'none'),
    buildCacheKey('user-1', 'track-B', 'last_7_days', 'none'),
    buildCacheKey('user-1', 'track-A', 'last_30_days', 'none'),
    buildCacheKey('user-1', 'track-A', 'last_7_days', 'prior_period'),
  ];
  const uniqueKeys = new Set(keys);
  assert('all 5 combinations produce unique keys', uniqueKeys.size === 5);
  console.log();

  // ---- Summary ----
  console.log('===============================================');
  console.log(`Test Summary: ${passed} passed, ${failed} failed`);
  console.log('===============================================\n');

  if (failed > 0) process.exit(1);
}

if (typeof module !== 'undefined' && require.main === module) {
  testCacheBehavior();
}

module.exports = { testCacheBehavior };
