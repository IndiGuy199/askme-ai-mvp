/**
 * POST /api/coach/insights-detailed
 * Generate detailed insights report with time filters and comparison
 * Supports snapshot caching for fast report rendering
 */
import { createClient } from '@supabase/supabase-js';
import { getInsightMetrics } from '../../../lib/coach-ai/context';
import { buildCompactInsightPrompt, deriveCompareConfidence } from '../../../lib/coach-ai/prompts';
import { DetailedInsightDataSchema, type RangeKey, type CompareMode, type DetailedInsightsResponse } from '../../../lib/coach-ai/schema';
import { generateStructuredOutput } from '../../../lib/coach-ai/client';
import { computeReportCompleteness } from '../../../lib/coach-ai/completeness';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const INSIGHT_GENERATION_TOKEN_COST = 400; // Full detailed report cost (0 when cached)

/**
 * Safe defaults used by the schema guard when required keys are missing.
 * These are intentionally sparse so they prompt the user to log more data
 * rather than sounding like a full report.
 */
const SCHEMA_DEFAULTS = {
  summary_paragraph: 'Keep logging actions to build pattern data. Complete at least 3 actions this week.',
  whats_working: [
    'You have actions set up — this is the foundation for all pattern analysis.',
    'Starting your logging streak builds data for future insights.'
  ],
  where_vulnerable: [
    'Without completion logs, high-risk times and urge patterns cannot be identified yet.',
    'Actions without urge ratings miss the key signal of what actually reduces urges.'
  ],
  patterns_triggers: [
    'Log at least 10 actions with timestamps to unlock high-risk time detection.',
    'Add urge before/after on 5+ actions to reveal which tools lower urges most.'
  ],
  slip_analysis: null as null,
  one_experiment: {
    title: 'Build your data baseline',
    why: 'Need more completion logs to identify patterns.',
    steps: [
      'Complete any 3 actions from your Playbook this week.',
      'Rate your urge before and after each one (0–10).',
      'Revisit this report in 7 days to see first patterns emerge.'
    ]
  },
  compare_section: { label: 'No comparison selected', bullets: [] as string[] }
};

/**
 * Normalize AI output to the stable v3 schema.
 * Fills missing keys with safe defaults.
 * Overrides compare_section.label and bullets based on compare_mode + compare_confidence.
 */
function applySchemaGuard(
  data: any,
  compareMode: CompareMode,
  compareMetrics: any
): any {
  if (!data || typeof data !== 'object') {
    console.warn('[schema-guard] Received non-object data, using full defaults');
    data = {};
  }

  const result: any = {
    summary_paragraph: typeof data.summary_paragraph === 'string' && data.summary_paragraph.length >= 10
      ? data.summary_paragraph
      : SCHEMA_DEFAULTS.summary_paragraph,
    whats_working: Array.isArray(data.whats_working) && data.whats_working.length >= 2
      ? data.whats_working
      : SCHEMA_DEFAULTS.whats_working,
    where_vulnerable: Array.isArray(data.where_vulnerable) && data.where_vulnerable.length >= 2
      ? data.where_vulnerable
      : SCHEMA_DEFAULTS.where_vulnerable,
    patterns_triggers: Array.isArray(data.patterns_triggers) && data.patterns_triggers.length >= 2
      ? data.patterns_triggers
      : SCHEMA_DEFAULTS.patterns_triggers,
    // slip_analysis is null unless model provided a valid object
    slip_analysis: (data.slip_analysis && typeof data.slip_analysis === 'object'
      && data.slip_analysis.pattern && data.slip_analysis.anti_binge_rule && data.slip_analysis.repair_step)
      ? data.slip_analysis
      : null,
    one_experiment: (data.one_experiment && typeof data.one_experiment === 'object'
      && data.one_experiment.title && Array.isArray(data.one_experiment.steps))
      ? data.one_experiment
      : SCHEMA_DEFAULTS.one_experiment,
    compare_section: SCHEMA_DEFAULTS.compare_section
  };

  // Normalize compare_section label and bullets based on mode + confidence
  if (compareMode === 'none' || !compareMetrics) {
    result.compare_section = { label: 'No comparison selected', bullets: [] };
  } else {
    const conf = deriveCompareConfidence(compareMetrics);
    const modeLabel = compareMode === 'baseline' ? 'Compared to baseline' : 'Compared to previous period';
    if (conf === 'high' || conf === 'medium') {
      // Accept model bullets when available; default to empty
      const modelBullets = (data.compare_section?.bullets && Array.isArray(data.compare_section.bullets))
        ? data.compare_section.bullets.slice(0, 3)
        : [];
      result.compare_section = { label: modeLabel, bullets: modelBullets };
    } else {
      // Low or none confidence — prohibit compare conclusions
      result.compare_section = { label: 'Not enough data to compare yet', bullets: [] };
    }
  }

  // Warn in dev when required keys were missing
  const missingKeys = ['summary_paragraph', 'whats_working', 'where_vulnerable', 'patterns_triggers', 'one_experiment']
    .filter(k => !data[k]);
  if (missingKeys.length > 0) {
    console.warn('[schema-guard] Missing keys filled with defaults:', missingKeys);
  }

  return result;
}

/** Deterministic cache key (mirrors the uniqueness constraint columns). */
function buildCacheKey(userId: string, trackId: string, rangeKey: RangeKey, compareMode: CompareMode): string {
  return `${userId}:${trackId}:${rangeKey}:${compareMode}`;
}

/**
 * Calculate date ranges based on range_key
 */
/** Truncate a Date to the start of the current UTC hour so cache keys are stable within the same hour. */
function truncateToHour(d: Date): Date {
  const t = new Date(d);
  t.setUTCMinutes(0, 0, 0);
  return t;
}

function getDateRange(rangeKey: RangeKey): { start: Date; end: Date } {
  // Use exact current time as the range end — do NOT truncate to the hour.
  // Truncation was previously used thinking it helped cache stability, but the cache
  // key is derived from range_key/user/track strings only (not timestamps), so
  // truncation is unnecessary.  Worse, truncation excluded completions logged in the
  // current partial hour, causing "0 completions" for fresh activity.
  const end = new Date();
  const start = new Date(end);

  switch (rangeKey) {
    case 'last_7_days':
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    case 'last_30_days':
      start.setUTCDate(start.getUTCDate() - 30);
      break;
    case 'last_90_days':
      start.setUTCDate(start.getUTCDate() - 90);
      break;
    case 'since_beginning':
      start.setUTCFullYear(2020); // Far back default
      break;
  }

  return { start, end };
}

/**
 * Get compare period date range
 */
function getCompareDateRange(rangeKey: RangeKey, currentStart: Date, currentEnd: Date): { start: Date; end: Date } | null {
  const daysDiff = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));
  
  const end = new Date(currentStart);
  const start = new Date(end);
  start.setDate(start.getDate() - daysDiff);

  return { start, end };
}

/**
 * Check if a snapshot exists for this cache_key, is within TTL, and has no new user data since it was saved.
 */
async function getValidSnapshot(
  userId: string,
  trackId: string,
  rangeKey: RangeKey,
  compareMode: CompareMode
): Promise<any | null> {
  try {
    const cacheKey = buildCacheKey(userId, trackId, rangeKey, compareMode);
    const fourHoursAgo = new Date();
    fourHoursAgo.setHours(fourHoursAgo.getHours() - 4); // 4h TTL

    // Look up by the stable cache_key string — no timestamp precision issues.
    const { data: snapshot, error } = await supabase
      .from('user_insight_snapshots')
      .select('*')
      .eq('user_id', userId)
      .eq('cache_key', cacheKey)
      .gte('created_at', fourHoursAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Snapshot lookup error:', error);
      return null;
    }
    if (!snapshot) return null;

    const snapshotCreatedAt = snapshot.created_at;

    // Check all event sources that could invalidate the cache
    const [
      { count: newCompletions },
      { count: newCompletionsLoggedAt },
      { count: newTrackBaselines },
      { count: newGoalBaselines },
      { count: newActionEvents },
      { count: newGoalEvents },
      { count: newSupportSessions },
      { count: newSlipEvents },
      { count: newActionPlans }
    ] = await Promise.all([
      supabase
        .from('action_completions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', snapshotCreatedAt),
      // Also check logged_at — the field explicitly set by log-action.ts.
      // A completion logged in the same second as the snapshot may be missed by
      // the created_at check due to sub-second precision; logged_at catches it too.
      supabase
        .from('action_completions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('logged_at', snapshotCreatedAt),
      supabase
        .from('user_track_baselines')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('track_id', trackId)
        .gte('updated_at', snapshotCreatedAt),
      supabase
        .from('user_goal_baselines')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', snapshotCreatedAt),
      supabase
        .from('user_action_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', snapshotCreatedAt),
      supabase
        .from('user_goal_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', snapshotCreatedAt),
      supabase
        .from('support_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', snapshotCreatedAt),
      // Slip events also invalidate the cache
      supabase
        .from('slip_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', snapshotCreatedAt),
      // Action plan changes (new/updated actions) invalidate the cache
      supabase
        .from('action_plans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('updated_at', snapshotCreatedAt)
    ]);

    const hasNewData =
      (newCompletions        && newCompletions        > 0) ||
      (newCompletionsLoggedAt && newCompletionsLoggedAt > 0) ||
      (newTrackBaselines     && newTrackBaselines     > 0) ||
      (newGoalBaselines      && newGoalBaselines      > 0) ||
      (newActionEvents       && newActionEvents       > 0) ||
      (newGoalEvents         && newGoalEvents         > 0) ||
      (newSupportSessions    && newSupportSessions    > 0) ||
      (newSlipEvents         && newSlipEvents         > 0) ||
      (newActionPlans        && newActionPlans        > 0);

    if (hasNewData) {
      console.log('🔄 Cache invalidated due to new user data since snapshot');
      return null;
    }

    // Additional check: detect completions that fell in the gap between the
    // snapshot's stored end_at and when the snapshot was actually saved.
    // This can happen if the range end was ever truncated to the hour: completions
    // logged in that partial hour before save time would be missed by the main
    // range query but are legitimate data for "this period".
    const snapshotEndAt = snapshot.end_at;
    if (snapshotEndAt) {
      const { count: gapCompletions } = await supabase
        .from('action_completions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gt('logged_at', snapshotEndAt)        // logged after the stored range end
        .lte('logged_at', snapshotCreatedAt);  // but before/at snapshot creation

      if (gapCompletions && gapCompletions > 0) {
        console.log(`🔄 Cache invalidated: ${gapCompletions} completions exist in end_at→snapshot gap`);
        return null;
      }
    }

    return snapshot;
  } catch (error) {
    console.error('Error fetching snapshot:', error);
    return null;
  }
}

/**
 * Save snapshot: delete any existing row for this cache_key, then insert fresh.
 * Using delete+insert avoids upsert column-set and timestamp-precision pitfalls.
 */
async function saveSnapshot(
  userId: string,
  trackId: string,
  rangeKey: RangeKey,
  compareMode: CompareMode,
  startAt: Date,
  endAt: Date,
  metrics: any,
  insights: any,
  completeness?: any,
  compareMetrics?: any,
  compareInsights?: any
): Promise<void> {
  try {
    const cacheKey = buildCacheKey(userId, trackId, rangeKey, compareMode);

    // Delete stale rows for this cache_key before inserting fresh data.
    await supabase
      .from('user_insight_snapshots')
      .delete()
      .eq('user_id', userId)
      .eq('cache_key', cacheKey);

    // Note: cache_key is a GENERATED ALWAYS AS column in Postgres — omit it from INSERT.
    // Postgres derives it automatically from user_id, track_id, range_key, compare_mode.
    const payload: any = {
      user_id: userId,
      track_id: trackId,
      range_key: rangeKey,
      compare_mode: compareMode,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      metrics_json: metrics,
      insights_json: insights,
      version: 2
    };
    if (completeness)    payload.completeness_json      = completeness;
    if (compareMetrics)  payload.compare_metrics_json   = compareMetrics;
    if (compareInsights) payload.compare_insights_json  = compareInsights;

    const { error } = await supabase
      .from('user_insight_snapshots')
      .insert(payload);

    if (error) console.error('Error saving snapshot:', error);
    else console.log('✅ Snapshot saved for cache_key:', cacheKey);
  } catch (error) {
    console.error('Error saving snapshot:', error);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      email, 
      range_key = 'last_7_days', 
      compare_mode = 'none',
      track_id = 'porn_recovery'
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Validate range_key and compare_mode
    const validRangeKeys: RangeKey[] = ['last_7_days', 'last_30_days', 'last_90_days', 'since_beginning'];
    const validCompareModes: CompareMode[] = ['previous_period', 'baseline', 'none'];

    if (!validRangeKeys.includes(range_key)) {
      return res.status(400).json({ error: 'Invalid range_key' });
    }

    if (!validCompareModes.includes(compare_mode)) {
      return res.status(400).json({ error: 'Invalid compare_mode' });
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, email, tokens')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate date ranges
    const currentRange = getDateRange(range_key);

    // Check for cached snapshot
    const cachedSnapshot = await getValidSnapshot(
      user.id,
      track_id,
      range_key,
      compare_mode
    );

    if (cachedSnapshot) {
      console.log('\u2705 Returning cached snapshot (4h TTL)');
      
      // Always recompute completeness to keep improvement_items current with latest logic
      const completeness = computeReportCompleteness(cachedSnapshot.metrics_json);
      
      const response: DetailedInsightsResponse = {
        report_completeness: completeness,
        snapshot: {
          metrics: cachedSnapshot.metrics_json,
          insights: cachedSnapshot.insights_json
        },
        compare_snapshot: cachedSnapshot.compare_metrics_json ? {
          metrics: cachedSnapshot.compare_metrics_json,
          insights: cachedSnapshot.compare_insights_json
        } : null,
        cached: true
      };

      return res.status(200).json({ ...response, tokens_used: 0, tokens_remaining: user.tokens });
    }

    // Check tokens for new generation
    if (user.tokens < INSIGHT_GENERATION_TOKEN_COST) {
      return res.status(403).json({
        error: 'Insufficient tokens',
        required: INSIGHT_GENERATION_TOKEN_COST,
        available: user.tokens
      });
    }

    console.log('🔄 Generating new insights for:', {
      userId: user.id,
      rangeKey: range_key,
      compareMode: compare_mode
    });

    // Fetch current metrics
    const currentMetrics = await getInsightMetrics(
      supabase,
      user.id,
      track_id,
      currentRange.start,
      currentRange.end
    );

    // Fetch compare metrics if needed
    let compareMetrics = null;
    if (compare_mode === 'previous_period') {
      const compareRange = getCompareDateRange(range_key, currentRange.start, currentRange.end);
      if (compareRange) {
        compareMetrics = await getInsightMetrics(
          supabase,
          user.id,
          track_id,
          compareRange.start,
          compareRange.end
        );
      }
    } else if (compare_mode === 'baseline') {
      // Use baseline from track baselines table
      const { data: baseline } = await supabase
        .from('user_track_baselines')
        .select('*')
        .eq('user_id', user.id)
        .eq('track_id', track_id)
        .maybeSingle();

      if (baseline) {
        // Convert baseline to metrics-like format
        compareMetrics = {
          activity: { completion_rate: 0 },
          urge: { avg_drop: null },
          slips: { slip_count: baseline.slip_frequency_7d || 0 }
        };
      }
    }

    // Generate AI insights for selected range
    const prompt = buildCompactInsightPrompt(currentMetrics, compareMetrics, user.first_name, compare_mode);
    const result = await generateStructuredOutput(
      'You are a porn recovery coach specializing in binge prevention, device friction, and shame repair.',
      prompt,
      DetailedInsightDataSchema,
      'gpt-4o-mini'
    );

    let insightsData;
    if (result.success && result.data) {
      insightsData = applySchemaGuard(result.data, compare_mode, compareMetrics);
    } else {
      console.warn('⚠️ Model failed, using fallback');
      insightsData = applySchemaGuard(null, compare_mode, compareMetrics);
    }

    // Generate compare insights separately to avoid duplicate snapshot/compare content
    let compareInsightsData = null;
    if (compareMetrics) {
      const comparePrompt = buildCompactInsightPrompt(compareMetrics, currentMetrics, user.first_name, compare_mode);
      const compareResult = await generateStructuredOutput(
'You are a porn recovery coach specializing in binge prevention, device friction, and shame repair.',
        comparePrompt,
        DetailedInsightDataSchema,
        'gpt-4o-mini'
      );

      if (compareResult.success && compareResult.data) {
        compareInsightsData = applySchemaGuard(compareResult.data, compare_mode, currentMetrics);
      } else {
        compareInsightsData = applySchemaGuard(null, compare_mode, currentMetrics);
      }
    }

    // Save snapshot (Phase 3: include completeness + compare data)
    const completeness = computeReportCompleteness(currentMetrics);

    await saveSnapshot(
      user.id,
      track_id,
      range_key,
      compare_mode,
      currentRange.start,
      currentRange.end,
      currentMetrics,
      insightsData,
      completeness,
      compareMetrics,
      compareInsightsData
    );

    // Deduct tokens
    await supabase
      .from('users')
      .update({ tokens: user.tokens - INSIGHT_GENERATION_TOKEN_COST })
      .eq('id', user.id);

    // Log usage
    await supabase.from('coach_ai_usage_logs').insert({
      user_id: user.id,
      kind: 'insights_detailed',
      prompt_tokens: result.usage?.promptTokens || 0,
      completion_tokens: result.usage?.completionTokens || 0,
      total_tokens: result.usage?.totalTokens || INSIGHT_GENERATION_TOKEN_COST,
      success: result.success,
      error_message: result.error || null
    });

    // Compute delta if compare exists
    let delta = null;
    if (compareMetrics) {
      delta = {
        completion_rate_change: currentMetrics.activity.completion_rate - (compareMetrics.activity?.completion_rate || 0),
        avg_drop_change: currentMetrics.urge.avg_drop !== null && compareMetrics.urge?.avg_drop !== null
          ? currentMetrics.urge.avg_drop - compareMetrics.urge.avg_drop
          : null,
        slip_count_change: currentMetrics.slips.slip_count - (compareMetrics.slips?.slip_count || 0)
      };
    }

    // Compute report completeness (already computed above for save)
    const response: DetailedInsightsResponse = {
      report_completeness: completeness,
      snapshot: {
        metrics: currentMetrics,
        insights: insightsData
      },
      compare_snapshot: compareMetrics ? {
        metrics: compareMetrics,
        insights: compareInsightsData || insightsData
      } : null,
      delta,
      cached: false
    };

    return res.status(200).json({
      ...response,
      tokens_used: INSIGHT_GENERATION_TOKEN_COST,
      tokens_remaining: user.tokens - INSIGHT_GENERATION_TOKEN_COST
    });

  } catch (error: any) {
    console.error('❌ Detailed insight generation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
