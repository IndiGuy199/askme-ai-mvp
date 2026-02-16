/**
 * POST /api/coach/insights-detailed
 * Generate detailed insights report with time filters and comparison
 * Supports snapshot caching for fast report rendering
 */
import { createClient } from '@supabase/supabase-js';
import { getInsightMetrics } from '../../../lib/coach-ai/context';
import { buildCompactInsightPrompt } from '../../../lib/coach-ai/prompts';
import { DetailedInsightDataSchema, type RangeKey, type CompareMode, type DetailedInsightsResponse } from '../../../lib/coach-ai/schema';
import { generateStructuredOutput } from '../../../lib/coach-ai/client';
import { computeReportCompleteness } from '../../../lib/coach-ai/completeness';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const INSIGHT_GENERATION_TOKEN_COST = 50; // Lower cost due to compact prompt

/**
 * Calculate date ranges based on range_key
 */
function getDateRange(rangeKey: RangeKey): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (rangeKey) {
    case 'last_7_days':
      start.setDate(end.getDate() - 7);
      break;
    case 'last_30_days':
      start.setDate(end.getDate() - 30);
      break;
    case 'last_90_days':
      start.setDate(end.getDate() - 90);
      break;
    case 'since_beginning':
      start.setFullYear(2020); // Far back default
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
 * Check if snapshot is fresh (created within last 6 hours AND no new events since)
 */
async function getValidSnapshot(
  userId: string,
  trackId: string,
  rangeKey: RangeKey,
  compareMode: CompareMode,
  startAt: Date,
  endAt: Date
): Promise<any | null> {
  try {
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

    const { data: snapshot } = await supabase
      .from('user_insight_snapshots')
      .select('*')
      .eq('user_id', userId)
      .eq('track_id', trackId)
      .eq('range_key', rangeKey)
      .eq('compare_mode', compareMode)
      .gte('created_at', sixHoursAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!snapshot) return null;

    // Check if any new completion events exist since snapshot was created
    const { count: newCompletions } = await supabase
      .from('action_completions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', snapshot.created_at);

    // Check if track baseline was updated since snapshot
    const { count: newTrackBaselines } = await supabase
      .from('user_track_baselines')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('track_id', trackId)
      .gte('updated_at', snapshot.created_at);

    // Check if any goal baselines were created/updated since snapshot
    const { count: newGoalBaselines } = await supabase
      .from('user_goal_baselines')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', snapshot.created_at);

    // Invalidate cache if there are any new events or baseline updates
    if ((newCompletions && newCompletions > 0) || 
        (newTrackBaselines && newTrackBaselines > 0) ||
        (newGoalBaselines && newGoalBaselines > 0)) {
      console.log('🔄 Cache invalidated due to new data:', {
        newCompletions,
        newTrackBaselines,
        newGoalBaselines
      });
      return null;
    }

    return snapshot;
  } catch (error) {
    console.error('Error fetching snapshot:', error);
    return null;
  }
}

/**
 * Upsert snapshot to database
 */
async function saveSnapshot(
  userId: string,
  trackId: string,
  rangeKey: RangeKey,
  compareMode: CompareMode,
  startAt: Date,
  endAt: Date,
  metrics: any,
  insights: any
): Promise<void> {
  try {
    await supabase
      .from('user_insight_snapshots')
      .upsert({
        user_id: userId,
        track_id: trackId,
        range_key: rangeKey,
        compare_mode: compareMode,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        metrics_json: metrics,
        insights_json: insights,
        version: 1
      }, {
        onConflict: 'user_id,track_id,range_key,compare_mode,start_at,end_at'
      });
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
      compare_mode,
      currentRange.start,
      currentRange.end
    );

    if (cachedSnapshot) {
      console.log('✅ Returning cached snapshot');
      
      // Compute completeness from cached metrics
      const completeness = computeReportCompleteness(cachedSnapshot.metrics_json);
      
      const response: DetailedInsightsResponse = {
        report_completeness: completeness,
        snapshot: {
          metrics: cachedSnapshot.metrics_json,
          insights: cachedSnapshot.insights_json
        },
        cached: true
      };

      return res.status(200).json(response);
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

    // Generate AI insights
    const prompt = buildCompactInsightPrompt(currentMetrics, compareMetrics, user.first_name);
    const result = await generateStructuredOutput(
      'You are a porn addiction recovery analyst.',
      prompt,
      DetailedInsightDataSchema,
      'gpt-4o-mini'
    );

    let insightsData;
    if (result.success && result.data) {
      insightsData = result.data;
    } else {
      console.warn('⚠️ Model failed, using fallback');
      insightsData = {
        risk_window: 'not enough data',
        best_tool: 'still learning',
        best_lever: 'Environment Shift',
        insights: [
          'Continue logging actions to build pattern data',
          'Complete at least 3 actions this week',
          'Note urge levels before and after each action'
        ],
        next_experiment: {
          title: 'Build your data baseline',
          why: 'Need more completion logs to identify patterns',
          steps: [
            'Complete 3+ actions this week',
            'Log urge levels each time'
          ]
        }
      };
    }

    // Save snapshot
    await saveSnapshot(
      user.id,
      track_id,
      range_key,
      compare_mode,
      currentRange.start,
      currentRange.end,
      currentMetrics,
      insightsData
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

    // Compute report completeness
    const completeness = computeReportCompleteness(currentMetrics);

    const response: DetailedInsightsResponse = {
      report_completeness: completeness,
      snapshot: {
        metrics: currentMetrics,
        insights: insightsData
      },
      compare_snapshot: compareMetrics ? {
        metrics: compareMetrics,
        insights: insightsData // Same insights, could generate separate if needed
      } : null,
      delta,
      cached: false
    };

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('❌ Detailed insight generation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
