/**
 * API Route: /api/assessments
 * 
 * Manages user challenge severity assessments.
 * 
 * GET  - Fetch assessments (latest or history) for a user
 * POST - Create a new assessment (self_checkin, system_inferred, coach_prompt)
 * 
 * The trigger in the database automatically updates
 * user_challenge_latest_assessment on every INSERT.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const SEVERITY_LABELS = ['occasional', 'growing', 'compulsive', 'overwhelming']
const SEVERITY_MAP = { occasional: 1, growing: 2, compulsive: 3, overwhelming: 4 }
const ASSESSMENT_SOURCES = ['onboarding', 'self_checkin', 'system_inferred', 'coach_prompt']

export default async function handler(req, res) {
  switch (req.method) {
    case 'GET':
      return getAssessments(req, res)
    case 'POST':
      return createAssessment(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

/**
 * GET /api/assessments?email=...&mode=latest|history&challengeId=...
 * 
 * mode=latest (default): Returns one row per challenge from user_challenge_latest_assessment
 * mode=history: Returns full history from user_challenge_assessments
 */
async function getAssessments(req, res) {
  try {
    const { email, mode = 'latest', challengeId, limit = 20 } = req.query

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Resolve user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (mode === 'latest') {
      // Fast snapshot: one row per challenge
      let query = supabase
        .from('user_challenge_latest_assessment')
        .select(`
          *,
          coach_challenges (
            id,
            challenge_id,
            label,
            description
          )
        `)
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })

      if (challengeId) {
        query = query.eq('coach_challenge_id', challengeId)
      }

      const { data, error } = await query
      if (error) throw error

      return res.status(200).json({ assessments: data || [] })

    } else {
      // Full history
      let query = supabase
        .from('user_challenge_assessments')
        .select(`
          *,
          coach_challenges (
            id,
            challenge_id,
            label
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit))

      if (challengeId) {
        query = query.eq('coach_challenge_id', challengeId)
      }

      const { data, error } = await query
      if (error) throw error

      return res.status(200).json({ assessments: data || [] })
    }

  } catch (error) {
    console.error('Error fetching assessments:', error)
    return res.status(500).json({ error: 'Failed to fetch assessments' })
  }
}

/**
 * POST /api/assessments
 * Body: {
 *   email: string (required)
 *   coachChallengeId: UUID (required) - FK to coach_challenges.id
 *   severityLabel: 'occasional'|'growing'|'compulsive'|'overwhelming' (required)
 *   source: 'self_checkin'|'system_inferred'|'coach_prompt' (default: 'self_checkin')
 *   timeframeDays: 30|90 (default: 30)
 *   notes: string (optional)
 *   signalsJson: object (optional)
 *   severityConfidence: number 0-1 (optional, mainly for system_inferred)
 * }
 */
async function createAssessment(req, res) {
  try {
    const {
      email,
      coachChallengeId,
      severityLabel,
      source = 'self_checkin',
      timeframeDays = 30,
      notes = null,
      signalsJson = null,
      severityConfidence = null
    } = req.body

    // Validate required fields
    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }
    if (!coachChallengeId) {
      return res.status(400).json({ error: 'coachChallengeId is required' })
    }
    if (!severityLabel || !SEVERITY_LABELS.includes(severityLabel)) {
      return res.status(400).json({ error: `severityLabel must be one of: ${SEVERITY_LABELS.join(', ')}` })
    }
    if (!ASSESSMENT_SOURCES.includes(source)) {
      return res.status(400).json({ error: `source must be one of: ${ASSESSMENT_SOURCES.join(', ')}` })
    }
    if (![30, 90].includes(timeframeDays)) {
      return res.status(400).json({ error: 'timeframeDays must be 30 or 90' })
    }

    // Resolve user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Insert assessment (trigger will auto-update latest table)
    const { data: assessment, error: insertError } = await supabase
      .from('user_challenge_assessments')
      .insert({
        user_id: user.id,
        coach_challenge_id: coachChallengeId,
        assessment_source: source,
        severity_level: SEVERITY_MAP[severityLabel],
        severity_label: severityLabel,
        severity_confidence: severityConfidence,
        timeframe_days: timeframeDays,
        criteria_version: 'v1',
        notes,
        signals_json: signalsJson,
        is_user_reported: ['onboarding', 'self_checkin'].includes(source)
      })
      .select()
      .single()

    if (insertError) throw insertError

    return res.status(201).json({ assessment })

  } catch (error) {
    console.error('Error creating assessment:', error)
    return res.status(500).json({ error: 'Failed to create assessment' })
  }
}
