import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import { supabase } from '../utils/supabaseClient'
import { useSuggestionCache } from '../hooks/useSuggestionCache'
import styles from '../styles/Playbook.module.css'

export default function Playbook() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('track') // 'track' or 'second'
  const [trackGoal, setTrackGoal] = useState(null)
  const [wellnessGoal, setWellnessGoal] = useState(null)
  const [trackActions, setTrackActions] = useState([])
  const [wellnessActions, setWellnessActions] = useState([])
  const [primaryTrack, setPrimaryTrack] = useState('porn') // 'porn', 'sex', 'food'
  const [streak, setStreak] = useState(0)
  const [showManageModal, setShowManageModal] = useState(false)
  const [updatingAction, setUpdatingAction] = useState(null)
  
  // Action logging state
  const [showLogModal, setShowLogModal] = useState(false)
  const [selectedActionToLog, setSelectedActionToLog] = useState(null)
  const [logCompletionStatus, setLogCompletionStatus] = useState('done')
  const [logCompletionPercent, setLogCompletionPercent] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [logUrgeBefore, setLogUrgeBefore] = useState('')
  const [logUrgeAfter, setLogUrgeAfter] = useState('')
  const [logContext, setLogContext] = useState('')
  const [actionLogs, setActionLogs] = useState({}) // Map of action_id -> array of logs
  const [savingLog, setSavingLog] = useState(false)
  
  // Baseline modal state
  const [showBaselineModal, setShowBaselineModal] = useState(false)
  const [baselineType, setBaselineType] = useState('goal') // 'goal' or 'track'
  const [baselineSlot, setBaselineSlot] = useState(1)
  const [baselineGoal, setBaselineGoal] = useState(null)
  const [goalBaselines, setGoalBaselines] = useState({}) // slot -> latest baseline
  const [trackBaseline, setTrackBaseline] = useState(null) // single track baseline
  
  // Track baseline data (track-level: porn recovery overall)
  const [trackBaselineData, setTrackBaselineData] = useState({
    slip_frequency_30d: '',
    longest_streak_90d: '',
    strongest_urge_time: '',
    biggest_trigger: '',
    notes: ''
  })
  
  // Goal baseline data (goal-specific)
  const [goalBaselineData, setGoalBaselineData] = useState({
    goal_baseline_level: '',
    goal_obstacle_text: '',
    confidence_0_10: null,
    notes: ''
  })
  
  const [actionBaselineData, setActionBaselineData] = useState({
    expected_minutes: '',
    difficulty_1_5: '',
    target_per_week: '',
    notes: ''
  })
  const [savingBaseline, setSavingBaseline] = useState(false)
  const [baselineContext, setBaselineContext] = useState('edit') // 'swap-goal' | 'swap-action' | 'edit'
  const [baselineValidationError, setBaselineValidationError] = useState('')
  
  // Modal workflow state
  const [modalView, setModalView] = useState('menu') // 'menu', 'view-goals', 'create-goal', 'swap-goal-select', 'swap-goal-checkin', 'swap-actions', 'swap-action-checkin', 'create-action'
  const [selectedChallenge, setSelectedChallenge] = useState(null)
  const [selectedGoalForActions, setSelectedGoalForActions] = useState(null)
  const [selectedGoalForSwap, setSelectedGoalForSwap] = useState(null)
  const [swapType, setSwapType] = useState(null) // 'track' or 'second'
  const [isSwapFlow, setIsSwapFlow] = useState(false) // Track if user came from swap action/goal flow
  const [isFromLibrary, setIsFromLibrary] = useState(false) // Track if user came from library view
  const [userChallenges, setUserChallenges] = useState([])
  const [userGoals, setUserGoals] = useState([])
  const [goalActions, setGoalActions] = useState([])
  const [selectedActions, setSelectedActions] = useState([])
  const [availableChallenges, setAvailableChallenges] = useState([])
  const [availableGoals, setAvailableGoals] = useState([])
  const [coachGoals, setCoachGoals] = useState([]) // Pre-defined goals from coach
  const [selectedCoachGoal, setSelectedCoachGoal] = useState('') // Selected from dropdown
  const [newGoalLabel, setNewGoalLabel] = useState('')
  const [newGoalDescription, setNewGoalDescription] = useState('')
  const [newActionText, setNewActionText] = useState('')
  const [savingData, setSavingData] = useState(false)
  const [draggedAction, setDraggedAction] = useState(null)
  const [generatingGoal, setGeneratingGoal] = useState(false)
  const [generatingAction, setGeneratingAction] = useState(false)
  const [generatedGoalOptions, setGeneratedGoalOptions] = useState([]) // Store 3 AI-generated goal options
  const [selectedGoalOption, setSelectedGoalOption] = useState(null) // User's choice from options
  const [generatedActionOptions, setGeneratedActionOptions] = useState([]) // Store 3 AI-generated action options
  const [selectedActionOptions, setSelectedActionOptions] = useState([]) // User's selected actions (checkboxes)
  const [expandedGoalId, setExpandedGoalId] = useState(null) // Track which goal's actions are shown in library
  const [expandedTodayGoalId, setExpandedTodayGoalId] = useState(null) // Track which goal is expanded in Today's actions
  
  // Notification state
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' }) // type: 'success', 'error', 'warning'
  
  // Swap check-in state (exit metrics)
  const [swapCheckInRating, setSwapCheckInRating] = useState(0) // 1-4 star rating
  const [swapCheckInNotes, setSwapCheckInNotes] = useState('')
  const [swapCheckInReason, setSwapCheckInReason] = useState('') // reason chip
  const [actionToSwapOut, setActionToSwapOut] = useState(null) // action being replaced
  const [actionToSwapIn, setActionToSwapIn] = useState(null) // action replacing it

  // Create baseline state (lightweight)
  const [createActionConfidence, setCreateActionConfidence] = useState(0) // 1-4
  const [createActionFriction, setCreateActionFriction] = useState('') // max 200 chars
  
  // Weekly insights state
  const [weeklyInsights, setWeeklyInsights] = useState(null) // { risk_window, best_tool, best_lever, keep, change, try }
  const [generatingInsights, setGeneratingInsights] = useState(false)
  const [expandedAINoteIndex, setExpandedAINoteIndex] = useState(null) // Track which AI action note is expanded in create modal
  const [expandedActionNotes, setExpandedActionNotes] = useState({}) // Track expanded "why this works" by action ID everywhere
  
  // Derive current goal ID for action cache - MUST use user_wellness_goals.id (unique per user's goal instance)
  // NOT coach_wellness_goals.goal_id (template ID shared across all users)
  const currentActionGoalId = selectedGoalForSwap?.id ||              // user_wellness_goals.id (CORRECT - unique)
                               selectedGoalForActions?.id ||           // user_wellness_goals.id (CORRECT - unique)
                               selectedGoalForSwap?.goal_id ||         // fallback
                               selectedGoalForActions?.goal_id         // fallback
  
  // Suggestion cache hooks for goals and actions
  const goalCache = useSuggestionCache(userData?.id, primaryTrack, 'goals')
  const actionCache = useSuggestionCache(userData?.id, currentActionGoalId, 'actions')

  // Toggle "Why this works" note expansion for any action by ID
  const toggleActionNote = (actionId) => {
    setExpandedActionNotes(prev => ({ ...prev, [actionId]: !prev[actionId] }))
  }

  // Reset swap check-in state
  const resetSwapCheckIn = () => {
    setSwapCheckInRating(0)
    setSwapCheckInNotes('')
    setSwapCheckInReason('')
    setActionToSwapOut(null)
    setActionToSwapIn(null)
  }

  // Reset create baseline state
  const resetCreateBaseline = () => {
    setCreateActionConfidence(0)
    setCreateActionFriction('')
  }

  // Insert a goal event row (analytics plumbing)
  const insertGoalEvent = async (eventData) => {
    if (!userData?.id) return
    try {
      const { error } = await supabase.from('user_goal_events').insert({
        user_id: userData.id,
        ...eventData
      })
      if (error) console.warn('Goal event insert failed:', error)
    } catch (err) {
      console.warn('Goal event insert error:', err)
    }
  }

  // Insert an action event row (analytics plumbing)
  const insertActionEvent = async (eventData) => {
    if (!userData?.id) return
    try {
      const { error } = await supabase.from('user_action_events').insert({
        user_id: userData.id,
        ...eventData
      })
      if (error) console.warn('Action event insert failed:', error)
    } catch (err) {
      console.warn('Action event insert error:', err)
    }
  }

  // Allowed reason codes for swap check-in
  const ACTION_REASON_CODES = ['too_hard', 'too_easy', 'didnt_fit_triggers', 'forgot', 'felt_pointless', 'other']
  const GOAL_REASON_CODES = ['not_relevant', 'too_vague', 'too_hard', 'needs_different_focus', 'completed', 'other']
  const ACTION_REASON_LABELS = { too_hard: 'Too hard', too_easy: 'Too easy', didnt_fit_triggers: "Didn't fit my triggers", forgot: 'Forgot', felt_pointless: 'Felt pointless', other: 'Other' }
  const GOAL_REASON_LABELS = { not_relevant: 'Not relevant anymore', too_vague: 'Too vague', too_hard: 'Too hard', needs_different_focus: 'Needs different focus', completed: 'Completed', other: 'Other' }

  // Star Rating inline component
  const StarRating = ({ value, onChange, size = 28 }) => (
    <div style={{ display: 'flex', gap: '6px' }}>
      {[1, 2, 3, 4].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: `${size}px`,
            color: star <= value ? '#f59e0b' : '#d1d5db',
            padding: '2px',
            transition: 'color 0.15s, transform 0.15s',
            transform: star <= value ? 'scale(1.1)' : 'scale(1)'
          }}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  )

  // Reason Chips inline component
  const ReasonChips = ({ codes, labels, value, onChange }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
      {codes.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(value === code ? '' : code)}
          style={{
            padding: '5px 12px',
            fontSize: '12px',
            borderRadius: '16px',
            border: value === code ? '1.5px solid #6366f1' : '1px solid #d1d5db',
            background: value === code ? '#eef2ff' : '#fff',
            color: value === code ? '#4338ca' : '#6b7280',
            cursor: 'pointer',
            fontWeight: value === code ? '600' : '400',
            transition: 'all 0.15s'
          }}
        >
          {labels[code]}
        </button>
      ))}
    </div>
  )

  // Render enriched metadata badges + details for an action
  const renderActionMetadata = (action, opts = {}) => {
    const meta = action.coachMetadata || action.coach_metadata
    if (!meta) return null
    const { compact = false } = opts
    const noteExpanded = expandedActionNotes[action.id]
    
    return (
      <div style={{ marginTop: '6px' }} onClick={e => e.stopPropagation()}>
        {/* Mechanism + Category badges */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: compact ? '4px' : '8px' }}>
          {meta.mechanism_type && (
            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              ⚡ {meta.mechanism_type.replace(/_/g, ' ')}
            </span>
          )}
          {meta.category && (
            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#065f46' }}>
              {meta.category}
            </span>
          )}
          {meta.duration_minutes && (
            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#dbeafe', color: '#1e40af' }}>
              ⏱️ {meta.duration_minutes}m
            </span>
          )}
          {meta.difficulty && (
            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#f3e8ff', color: '#6b21a8' }}>
              {meta.difficulty}
            </span>
          )}
        </div>
        
        {!compact && (
          <>
            {/* Trigger */}
            {meta.trigger_condition && (
              <div style={{ fontSize: '11px', color: '#b45309', marginBottom: '4px', lineHeight: '1.4', backgroundColor: '#fffbeb', padding: '4px 8px', borderRadius: '5px' }}>
                <strong>🔥 Trigger:</strong> {meta.trigger_condition}
              </div>
            )}
            
            {/* Success criteria */}
            {meta.success_criteria && (
              <div style={{ fontSize: '11px', color: '#374151', marginBottom: '4px', lineHeight: '1.4' }}>
                <strong>✅ Success:</strong> {meta.success_criteria}
              </div>
            )}
            
            {/* When to do */}
            {meta.when_to_do && (
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', lineHeight: '1.4' }}>
                <strong>🕐 When:</strong> {meta.when_to_do}
              </div>
            )}
          </>
        )}
        
        {/* Why this works — always show toggle */}
        {meta.ai_note && (
          <div style={{ marginTop: '2px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); toggleActionNote(action.id) }}
              style={{ background: 'none', border: 'none', padding: '2px 0', fontSize: '11px', color: '#6366f1', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span style={{ transition: 'transform 0.2s', transform: noteExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
              🔍 Why this works
            </button>
            {noteExpanded && (
              <div style={{ marginTop: '4px', padding: '8px 10px', backgroundColor: '#f5f3ff', borderRadius: '5px', fontSize: '11px', color: '#4338ca', lineHeight: '1.5', borderLeft: '3px solid #6366f1' }}>
                {meta.ai_note}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  useEffect(() => {
    let mounted = true

    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return

        if (!session) {
          router.push('/login')
          return
        }

        setUser(session.user)
        await fetchUserData(session.user.email)
      } catch (error) {
        console.error('Error in getSession:', error)
        if (mounted) setLoading(false)
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      
      if (!session) {
        router.push('/login')
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session.user)
        fetchUserData(session.user.email)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])
  
  // Debug: Log cache keys in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && currentActionGoalId) {
      console.log('[Cache] Action cache scoped to goal ID:', currentActionGoalId)
      console.log('[Cache] Goal object:', selectedGoalForSwap || selectedGoalForActions)
    }
  }, [currentActionGoalId])
  
  // Sync action cache current items with UI when cache changes
  useEffect(() => {
    if (actionCache.currentItems && actionCache.currentItems.length > 0 && modalView === 'create-action') {
      setGeneratedActionOptions(actionCache.currentItems)
      // Don't reset selection - let user keep their current selection when navigating
    }
  }, [actionCache.currentBatchIndex, actionCache.currentItems, modalView])
  
  // Sync goal cache current items with UI when cache changes
  useEffect(() => {
    if (goalCache.currentItems && goalCache.currentItems.length > 0 && modalView === 'create-goal') {
      setGeneratedGoalOptions(goalCache.currentItems)
      // Auto-select first option
      setSelectedGoalOption(0)
      setNewGoalLabel(goalCache.currentItems[0]?.label || '')
      setNewGoalDescription(goalCache.currentItems[0]?.description || '')
    }
  }, [goalCache.currentBatchIndex, goalCache.currentItems, modalView])

  // Show notification helper
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type })
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' })
    }, 4000) // Hide after 4 seconds
  }

  const fetchUserData = async (email) => {
    try {
      setLoading(true)

      // Get user from database
      const { data: dbUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (userError) throw userError
      
      setUserData(dbUser)
      
      // Get primary track from profile (fallback to 'porn')
      const userPrimaryTrack = dbUser.primary_track || 'porn'
      setPrimaryTrack(userPrimaryTrack)

      // Fetch user's challenges and goals
      const { data: challengesData, error: challengesError } = await supabase
        .from('user_challenges')
        .select(`
          id,
          coach_challenges (
            id,
            challenge_id,
            label,
            description
          )
        `)
        .eq('user_id', dbUser.id)
        .order('selected_at', { ascending: false })

      if (challengesError) throw challengesError

      // Get goals for the user (only active ones for playbook display)
      const { data: goalsData, error: goalsError } = await supabase
        .from('user_wellness_goals')
        .select(`
          id,
          coach_wellness_goals (
            id,
            goal_id,
            label,
            description,
            challenge_id
          )
        `)
        .eq('user_id', dbUser.id)
        .eq('is_active', true)
        .order('selected_at', { ascending: false })

      if (goalsError) throw goalsError

      // Map track goal (primary challenge/goal)
      // For simplicity, use first challenge that matches track category
      const trackChallengeMap = {
        'porn': 'Pornography',
        'sex': 'Sexual Behavior',
        'food': 'Food'
      }
      
      const trackCategoryName = trackChallengeMap[userPrimaryTrack] || 'Pornography'
      
      // Find goals related to the primary track
      const trackGoals = goalsData.filter(g => {
        const challenge = challengesData?.find(c => 
          c.coach_challenges?.challenge_id === g.coach_wellness_goals?.challenge_id
        )
        // Match by challenge label since category field doesn't exist
        return challenge?.coach_challenges?.label?.toLowerCase().includes(userPrimaryTrack) ||
               challenge?.coach_challenges?.challenge_id?.includes(userPrimaryTrack)
      })

      // Find a second goal (any other goal not the primary track goal)
      const secondGoals = goalsData.filter(g => g.id !== trackGoals[0]?.id)

      // Set the goals
      if (trackGoals.length > 0) {
        setTrackGoal({
          id: trackGoals[0].id,
          goal_id: trackGoals[0].coach_wellness_goals?.goal_id || trackGoals[0].goal_id,
          name: trackGoals[0].coach_wellness_goals?.label || 'Track Goal',
          description: trackGoals[0].coach_wellness_goals?.description
        })
      } else {
        // Default track goal if none exists
        setTrackGoal({
          id: null,
          name: 'No Unfiltered Internet',
          description: 'Set up boundaries for internet usage'
        })
      }

      if (secondGoals.length > 0) {
        setWellnessGoal({
          id: secondGoals[0].id,
          goal_id: secondGoals[0].coach_wellness_goals?.goal_id || secondGoals[0].goal_id,
          name: secondGoals[0].coach_wellness_goals?.label || secondGoals[0].label || 'Second Goal',
          description: secondGoals[0].coach_wellness_goals?.description || secondGoals[0].description
        })
      } else {
        // No second goal yet
        setWellnessGoal({
          id: null,
          goal_id: null,
          name: 'Add second goal',
          description: 'Pick a second goal to support your recovery'
        })
      }

      // Fetch actions for each goal
      await fetchActionsForGoals(dbUser.id, trackGoals[0]?.coach_wellness_goals?.goal_id || trackGoals[0]?.goal_id, secondGoals[0]?.coach_wellness_goals?.goal_id || secondGoals[0]?.goal_id)
      
      // Calculate streak from action completions
      await calculateStreak(dbUser.id)
      
      // Fetch goal baselines for manage modal badges
      await fetchGoalBaselines()
      await fetchTrackBaseline(dbUser.id)

    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchActionsForGoals = async (userId, trackGoalId, wellnessGoalId) => {
    try {
      console.log('📋 Fetching actions for userId:', userId, 'trackGoalId:', trackGoalId, 'wellnessGoalId:', wellnessGoalId)
      
      // Fetch action plans ordered by display_order for the "Today's Actions" section
      const { data: actionPlans, error } = await supabase
        .from('action_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_complete', false)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error

      console.log('📥 Fetched action plans:', actionPlans)

      // Get action completions with full log details
      const { data: completions, error: completionsError } = await supabase
        .from('action_completions')
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })

      if (completionsError) throw completionsError
      
      // Build action logs map
      const logsMap = {}
      completions?.forEach(log => {
        if (!logsMap[log.action_id]) {
          logsMap[log.action_id] = []
        }
        logsMap[log.action_id].push(log)
      })
      setActionLogs(logsMap)

      // Transform action_plans to match the expected format
      const transformAction = (action) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        // Get today's logs for this action
        const todayLogs = completions?.filter(c => {
          if (c.action_id !== action.id) return false
          const logDate = new Date(c.logged_at || c.completed_at)
          logDate.setHours(0, 0, 0, 0)
          return logDate.getTime() === today.getTime()
        }) || []
        
        // Get the most recent log (for "last log" display)
        const lastLog = completions?.find(c => c.action_id === action.id)
        
        // Determine if completed today (done or >= 90% partial)
        const isCompletedToday = todayLogs.some(log => {
          if (log.completion_status === 'done') return true
          if (log.completion_status === 'partial' && log.completion_percent >= 90) return true
          return false
        })
        
        const isTrackGoal = trackGoalId && action.goal_id === trackGoalId
        const isWellnessGoal = wellnessGoalId && action.goal_id === wellnessGoalId
        
        // Extract metadata if present
        const meta = action.coach_metadata || null
        
        return {
          id: action.id,
          title: action.action_text,
          durationSeconds: meta?.duration_minutes ? meta.duration_minutes * 60 : 120,
          status: isCompletedToday ? 'completed' : 'not_started',
          lastLog: lastLog,
          goalType: isTrackGoal
            ? 'track'
            : isWellnessGoal
              ? 'second'
              : (action.goal_id?.includes('porn') || action.goal_id?.includes('sex') || action.goal_id?.includes('food') ? 'track' : 'second'),
          // Enrichment data from AI
          coachMetadata: meta
        }
      }

      // Transform and split by goal type
      const transformedActions = actionPlans.map(transformAction)

      // Separate into track and second goal based on goal_id (max 3 per goal)
      const trackActionsData = transformedActions.filter(a => a.goalType === 'track').slice(0, 3)
      const wellnessActionsData = transformedActions.filter(a => a.goalType === 'second').slice(0, 3)

      console.log('✅ Track actions:', trackActionsData)
      console.log('✅ Second goal actions:', wellnessActionsData)

      setTrackActions(trackActionsData)
      setWellnessActions(wellnessActionsData)

      // Auto-enrich actions missing coach_metadata (background, no blocking)
      const actionsNeedingEnrich = actionPlans.filter(a => !a.coach_metadata)
      if (actionsNeedingEnrich.length > 0) {
        autoEnrichActions(actionsNeedingEnrich.map(a => a.id), trackGoalId, wellnessGoalId)
      }

    } catch (error) {
      console.error('Error fetching actions:', error)
    }
  }

  // Background auto-enrich: generate metadata for actions that don't have it
  const autoEnrichActions = async (actionIds, trackGoalId, wellnessGoalId) => {
    if (!user?.email || actionIds.length === 0) return
    
    try {
      console.log(`🔄 Auto-enriching ${actionIds.length} actions missing metadata...`)
      
      const response = await fetch('/api/coach/enrich-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          actionIds: actionIds
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.enriched > 0) {
        console.log(`✅ Enriched ${data.enriched} actions`)
        
        // Update local state with enriched data
        const enrichMap = {}
        data.results.forEach(r => { enrichMap[r.id] = r.metadata })
        
        // Update trackActions
        setTrackActions(prev => prev.map(action => {
          if (enrichMap[action.id]) {
            return {
              ...action,
              coachMetadata: enrichMap[action.id],
              durationSeconds: enrichMap[action.id].duration_minutes ? enrichMap[action.id].duration_minutes * 60 : action.durationSeconds
            }
          }
          return action
        }))
        
        // Update wellnessActions
        setWellnessActions(prev => prev.map(action => {
          if (enrichMap[action.id]) {
            return {
              ...action,
              coachMetadata: enrichMap[action.id],
              durationSeconds: enrichMap[action.id].duration_minutes ? enrichMap[action.id].duration_minutes * 60 : action.durationSeconds
            }
          }
          return action
        }))
      }
    } catch (error) {
      console.error('⚠️ Auto-enrich failed (non-blocking):', error)
    }
  }

  const calculateStreak = async (userId) => {
    try {
      // Get action completions from the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: completions, error } = await supabase
        .from('action_completions')
        .select('completed_at')
        .eq('user_id', userId)
        .gte('completed_at', thirtyDaysAgo.toISOString())
        .order('completed_at', { ascending: false })

      if (error) throw error

      // Calculate consecutive days with completions
      let currentStreak = 0
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (completions && completions.length > 0) {
        const completionDates = completions.map(c => {
          const date = new Date(c.completed_at)
          date.setHours(0, 0, 0, 0)
          return date.getTime()
        })

        const uniqueDates = [...new Set(completionDates)].sort((a, b) => b - a)
        
        let checkDate = today.getTime()
        for (const dateTime of uniqueDates) {
          if (dateTime === checkDate || dateTime === checkDate - 86400000) { // Today or yesterday
            currentStreak++
            checkDate = dateTime - 86400000 // Move to previous day
          } else {
            break
          }
        }
      }

      setStreak(currentStreak)
    } catch (error) {
      console.error('Error calculating streak:', error)
      setStreak(0)
    }
  }

  const handleStartAction = (action) => {
    // TODO: Implement action start flow
    // Options:
    // 1. Navigate to /chat with action context
    // 2. Open a dedicated action modal with timer
    // 3. Navigate to /support-now with action pre-selected
    console.log('Starting action:', action)
    
    // For now, show a simple alert
    // Replace this with your preferred action execution flow
    const confirmed = confirm(
      `Start: ${action.title}\n\nDuration: ${Math.floor(action.durationSeconds / 60)} minutes\n\nThis will open your action flow. Continue?`
    )
    
    if (confirmed) {
      // Example: Navigate to chat with action context
      router.push({
        pathname: '/chat',
        query: { 
          action: action.id,
          context: 'playbook'
        }
      })
    }
  }

  const handleCompleteAction = async (action) => {
    if (!userData?.id) {
      console.error('No user data available')
      return
    }

    try {
      setUpdatingAction(action.id)

      // Mark action as complete in database
      const { error } = await supabase
        .from('action_completions')
        .insert({
          user_id: userData.id,
          action_id: action.id,
          completed_at: new Date().toISOString()
        })

      if (error) {
        // If error is duplicate, that's okay - action already completed
        if (error.code !== '23505') { // PostgreSQL unique violation code
          throw error
        }
      }

      // Update local state
      if (action.goalType === 'track') {
        setTrackActions(prev => prev.map(a => 
          a.id === action.id ? { ...a, status: 'completed' } : a
        ))
      } else {
        setWellnessActions(prev => prev.map(a => 
          a.id === action.id ? { ...a, status: 'completed' } : a
        ))
      }

      // Recalculate streak
      await calculateStreak(userData.id)

    } catch (error) {
      console.error('Error completing action:', error)
      showNotification('Failed to mark action as complete. Please try again.', 'error')
    } finally {
      setUpdatingAction(null)
    }
  }
  
  // Open log modal
  const handleOpenLogModal = (action) => {
    setSelectedActionToLog(action)
    setLogCompletionStatus('done')
    setLogCompletionPercent('')
    setLogNotes('')
    setShowLogModal(true)
  }
  
  // Save action log
  const handleSaveLog = async () => {
    if (!userData?.id || !selectedActionToLog) {
      console.error('Missing user data or action')
      return
    }
    
    // Validation: if partial, need percent
    if (logCompletionStatus === 'partial') {
      if (!logCompletionPercent) {
        showNotification('For partial completion, please enter percentage.', 'warning')
        return
      }
    }
    
    // Clamp percent to 0-100
    const clampedPercent = logCompletionPercent 
      ? Math.max(0, Math.min(100, parseInt(logCompletionPercent))) 
      : null
    
    try {
      setSavingLog(true)
      
      const logData = {
        user_id: userData.id,
        action_id: selectedActionToLog.id,
        completion_status: logCompletionStatus,
        completion_percent: clampedPercent,
        notes: logNotes || null,
        urge_before_0_10: logUrgeBefore !== '' ? parseInt(logUrgeBefore) : null,
        urge_after_0_10: logUrgeAfter !== '' ? parseInt(logUrgeAfter) : null,
        context: logContext || null,
        logged_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      }
      
      const { data, error } = await supabase
        .from('action_completions')
        .insert(logData)
        .select()
        .single()
      
      if (error) throw error
      
      // Update local logs map
      setActionLogs(prev => ({
        ...prev,
        [selectedActionToLog.id]: [data, ...(prev[selectedActionToLog.id] || [])]
      }))
      
      // Determine if checkbox should be checked (done or >= 90%)
      const isCompleted = logCompletionStatus === 'done' || 
        (logCompletionStatus === 'partial' && clampedPercent >= 90)
      
      // Update action status in UI
      const updatedAction = {
        ...selectedActionToLog,
        status: isCompleted ? 'completed' : selectedActionToLog.status,
        lastLog: data
      }
      
      if (selectedActionToLog.goalType === 'track') {
        setTrackActions(prev => prev.map(a => 
          a.id === selectedActionToLog.id ? updatedAction : a
        ))
      } else {
        setWellnessActions(prev => prev.map(a => 
          a.id === selectedActionToLog.id ? updatedAction : a
        ))
      }
      
      // Recalculate streak if completed
      if (isCompleted) {
        await calculateStreak(userData.id)
      }
      
      // Close modal and show success feedback
      setShowLogModal(false)
      showNotification('✅ Saved!', 'success')
      
    } catch (error) {
      console.error('Error saving log:', error)
      showNotification('Failed to save log. Please try again.', 'error')
    } finally {
      setSavingLog(false)
    }
  }
  
  // Format last log for display
  const formatLastLog = (lastLog) => {
    if (!lastLog) return 'Last log: none yet'
    
    const logDate = new Date(lastLog.logged_at || lastLog.completed_at)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const logDateOnly = new Date(logDate)
    logDateOnly.setHours(0, 0, 0, 0)
    
    const isToday = logDateOnly.getTime() === today.getTime()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = logDateOnly.getTime() === yesterday.getTime()
    
    let dateStr = ''
    if (isToday) {
      dateStr = logDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    } else if (isYesterday) {
      dateStr = 'yesterday'
    } else {
      dateStr = logDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    
    let statusStr = ''
    if (lastLog.completion_status === 'done') {
      statusStr = 'done'
    } else if (lastLog.completion_status === 'partial') {
      if (lastLog.completion_percent) {
        statusStr = `partial (${lastLog.completion_percent}%)`
      } else {
        statusStr = 'partial'
      }
    }
    
    return `Last log: ${dateStr} • ${statusStr}`
  }

  // ============ BASELINE FUNCTIONS ============
  
  // Fetch track baseline
  const fetchTrackBaseline = async (userId = null) => {
    const effectiveUserId = userId || userData?.id
    if (!effectiveUserId) {
      console.log('🔍 fetchTrackBaseline: No user ID available')
      return
    }
    console.log('🔍 fetchTrackBaseline: Fetching for user', effectiveUserId)
    try {
      const { data, error } = await supabase
        .from('user_track_baselines')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('track_id', 'porn_recovery')
        .maybeSingle()
      
      console.log('🔍 fetchTrackBaseline result:', { data, error })
      if (error && error.code !== 'PGRST116') throw error // Ignore "no rows" error
      setTrackBaseline(data)
      console.log('🔍 trackBaseline state set to:', data)
    } catch (err) {
      console.error('❌ Error fetching track baseline:', err)
    }
  }
  
  // Fetch latest baselines for active goal slots
  const fetchGoalBaselines = async () => {
    if (!userData?.id) return
    try {
      const { data, error } = await supabase
        .from('user_goal_baselines')
        .select('*')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      // Build map: slot -> latest baseline
      const map = {}
      data?.forEach(b => {
        if (!map[b.goal_slot]) map[b.goal_slot] = b
      })
      setGoalBaselines(map)
    } catch (err) {
      console.error('Error fetching goal baselines:', err)
    }
  }
  
  // Open track baseline modal
  const openTrackBaselineModal = () => {
    setBaselineType('track')
    setBaselineValidationError('')
    
    // Pre-fill from existing track baseline if available
    if (trackBaseline) {
      setTrackBaselineData({
        slip_frequency_30d: trackBaseline.slip_frequency_30d || '',
        longest_streak_90d: trackBaseline.longest_streak_90d || '',
        strongest_urge_time: trackBaseline.strongest_urge_time || '',
        biggest_trigger: trackBaseline.biggest_trigger || '',
        notes: trackBaseline.notes || ''
      })
    } else {
      setTrackBaselineData({
        slip_frequency_30d: '',
        longest_streak_90d: '',
        strongest_urge_time: '',
        biggest_trigger: '',
        notes: ''
      })
    }
    setShowBaselineModal(true)
  }
  
  // Open goal baseline modal
  const openGoalBaselineModal = (slot, goal, context) => {
    setBaselineType('goal')
    setBaselineSlot(slot || 1)
    setBaselineGoal(goal)
    setBaselineContext(context || 'edit')
    setBaselineValidationError('')
    
    // Pre-fill from existing baseline if available
    const existing = goalBaselines[slot]
    if (existing) {
      setGoalBaselineData({
        goal_baseline_level: existing.goal_baseline_level || '',
        goal_obstacle_text: existing.goal_obstacle_text || '',
        confidence_0_10: existing.confidence_0_10,
        notes: existing.notes || ''
      })
    } else {
      setGoalBaselineData({
        goal_baseline_level: '',
        goal_obstacle_text: '',
        confidence_0_10: null,
        notes: ''
      })
    }
    setShowBaselineModal(true)
  }
  
  // Save track baseline
  const saveTrackBaseline = async () => {
    if (!user?.email) return
    
    // All-or-nothing validation: every required field must be filled
    const missing = []
    if (!trackBaselineData.slip_frequency_30d) missing.push('Slip frequency')
    if (!trackBaselineData.longest_streak_90d) missing.push('Longest streak')
    if (!trackBaselineData.strongest_urge_time) missing.push('Strongest urge time')
    if (!trackBaselineData.biggest_trigger) missing.push('Biggest trigger')
    
    if (missing.length > 0) {
      setBaselineValidationError(`Please fill in: ${missing.join(', ')}`)
      return
    }
    
    setBaselineValidationError('')
    setSavingBaseline(true)
    
    try {
      const response = await fetch('/api/baselines/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          trackId: 'porn_recovery',
          slip_frequency_30d: trackBaselineData.slip_frequency_30d,
          longest_streak_90d: trackBaselineData.longest_streak_90d,
          strongest_urge_time: trackBaselineData.strongest_urge_time,
          biggest_trigger: trackBaselineData.biggest_trigger,
          notes: trackBaselineData.notes || null
        })
      })
      
      const data = await response.json()
      console.log('💾 Save track baseline response:', { ok: response.ok, data })
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save track baseline')
      }
      
      console.log('✅ Track baseline saved, now fetching...')
      await fetchTrackBaseline()
      console.log('✅ Track baseline fetched, closing modal')
      setShowBaselineModal(false)
      showNotification('✅ Track baseline saved!', 'success')
    } catch (err) {
      console.error('Error saving track baseline:', err)
      showNotification(err.message || 'Failed to save baseline.', 'error')
    } finally {
      setSavingBaseline(false)
    }
  }
  
  // Save goal baseline
  const saveGoalBaseline = async () => {
    if (!user?.email) return
    
    // All-or-nothing validation: every required field must be filled
    const missing = []
    if (!goalBaselineData.goal_baseline_level) missing.push('Baseline level')
    if (!goalBaselineData.goal_obstacle_text || goalBaselineData.goal_obstacle_text.trim().length < 3) {
      missing.push('What gets in the way (min 3 chars)')
    }
    if (goalBaselineData.confidence_0_10 === null) missing.push('Confidence')
    
    if (missing.length > 0) {
      setBaselineValidationError(`Please fill in: ${missing.join(', ')}`)
      return
    }
    
    setBaselineValidationError('')
    setSavingBaseline(true)
    
    try {
      const response = await fetch('/api/baselines/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          goalId: baselineGoal?.id || null,
          goalSlot: baselineSlot,
          goal_baseline_level: goalBaselineData.goal_baseline_level,
          goal_obstacle_text: goalBaselineData.goal_obstacle_text.trim(),
          confidence_0_10: goalBaselineData.confidence_0_10,
          notes: goalBaselineData.notes || null
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save goal baseline')
      }
      
      await fetchGoalBaselines()
      setShowBaselineModal(false)
      showNotification('✅ Goal baseline saved!', 'success')
    } catch (err) {
      console.error('Error saving goal baseline:', err)
      showNotification(err.message || 'Failed to save baseline.', 'error')
    } finally {
      setSavingBaseline(false)
    }
  }
  
  // Save action baseline
  const saveActionBaseline = async (actionId) => {
    if (!userData?.id) return
    // All-or-nothing validation
    const missing = []
    if (!actionBaselineData.expected_minutes) missing.push('Expected minutes')
    if (!actionBaselineData.difficulty_1_5) missing.push('Difficulty')
    if (!actionBaselineData.target_per_week) missing.push('Target per week')
    if (missing.length > 0) {
      setBaselineValidationError(`Please fill in: ${missing.join(', ')}`)
      return
    }
    setBaselineValidationError('')
    setSavingBaseline(true)
    try {
      const { error } = await supabase
        .from('user_action_baselines')
        .insert({
          user_id: userData.id,
          user_goal_id: baselineGoal?.id || null,
          action_id: actionId || null,
          expected_minutes: actionBaselineData.expected_minutes ? parseInt(actionBaselineData.expected_minutes) : null,
          difficulty_1_5: actionBaselineData.difficulty_1_5 ? parseInt(actionBaselineData.difficulty_1_5) : null,
          target_per_week: actionBaselineData.target_per_week ? parseInt(actionBaselineData.target_per_week) : null,
          notes: actionBaselineData.notes || null
        })
      
      if (error) throw error
      
      setShowBaselineModal(false)
      showNotification('✅ Action baseline saved!', 'success')
    } catch (err) {
      console.error('Error saving action baseline:', err)
      showNotification('Failed to save baseline.', 'error')
    } finally {
      setSavingBaseline(false)
    }
  }

  // ============ MODAL WORKFLOW FUNCTIONS ============
  
  // Open manage modal and load data
  const openManageModal = async () => {
    setShowManageModal(true)
    setModalView('menu')
    await loadModalData()
  }
  
  // Load all data needed for the modal
  const loadModalData = async () => {
    if (!userData?.id || !user?.email) return
    
    try {
      // Fetch user's challenges with their goals
      const { data: challenges, error: challengesError } = await supabase
        .from('user_challenges')
        .select(`
          id,
          coach_challenges (
            id,
            challenge_id,
            label,
            description
          )
        `)
        .eq('user_id', userData.id)
      
      if (challengesError) throw challengesError
      setUserChallenges(challenges || [])
      
      // Fetch user's goals (all goals including library for swap view)
      const { data: goals, error: goalsError } = await supabase
        .from('user_wellness_goals')
        .select(`
          id,
          is_active,
          coach_wellness_goals (
            id,
            goal_id,
            label,
            description,
            challenge_id
          )
        `)
        .eq('user_id', userData.id)
        .order('is_active', { ascending: false })  // Show active first
        .order('selected_at', { ascending: false })
      
      if (goalsError) throw goalsError
      setUserGoals(goals || [])
      
      // Fetch available challenges (active ones)
      const { data: availChallenges, error: availChallengesError } = await supabase
        .from('coach_challenges')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      
      if (availChallengesError) throw availChallengesError
      setAvailableChallenges(availChallenges || [])
      
    } catch (error) {
      console.error('Error loading modal data:', error)
    }
  }
  
  // Fetch goals for a specific challenge
  const fetchGoalsForChallenge = async (challengeId) => {
    try {
      const { data: goals, error } = await supabase
        .from('coach_wellness_goals')
        .select('*')
        .eq('challenge_id', challengeId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      
      if (error) throw error
      setAvailableGoals(goals || [])
    } catch (error) {
      console.error('Error fetching goals for challenge:', error)
      setAvailableGoals([])
    }
  }
  
  // Fetch actions for a specific goal
  const fetchActionsForGoal = async (goalId) => {
    if (!user?.email) {
      console.log('❌ No user email for fetching actions')
      return
    }
    
    console.log('🔍 Fetching actions for goalId:', goalId)
    
    try {
      const url = `/api/actions?email=${encodeURIComponent(user.email)}&goalId=${goalId}`
      console.log('📤 Fetching from:', url)
      
      const response = await fetch(url)
      const data = await response.json()
      
      console.log('📥 Actions response:', data)
      
      if (response.ok) {
        console.log(`✅ Found ${data.actions?.length || 0} actions for this goal`)
        setGoalActions(data.actions || [])
      } else {
        console.error('❌ Error fetching actions:', data.error)
        setGoalActions([])
      }
    } catch (error) {
      console.error('Error fetching actions:', error)
      setGoalActions([])
    }
  }
  
  // View goals for a challenge
  const viewChallengeGoals = async (challenge) => {
    setSelectedChallenge(challenge)
    await fetchGoalsForChallenge(challenge.coach_challenges?.challenge_id || challenge.challenge_id)
    setModalView('goals')
  }
  
  // View actions for a goal
  const viewGoalActions = async (goal) => {
    setSelectedGoalForActions(goal)
    // Use goal_id field (not database UUID) for querying actions
    const goalId = goal.coach_wellness_goals?.goal_id || goal.goal_id
    console.log('📥 Fetching actions for goal_id:', goalId)
    await fetchActionsForGoal(goalId)
    setModalView('actions')
  }
  
  // Add a challenge to the user
  const addChallengeToUser = async (challenge) => {
    if (!user?.email) return
    
    setSavingData(true)
    try {
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          challengeId: challenge.challenge_id
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add challenge')
      }
      
      // Refresh modal data
      await loadModalData()
      showNotification('Challenge added successfully!', 'success')
    } catch (error) {
      console.error('Error adding challenge:', error)
      showNotification(error.message || 'Failed to add challenge', 'error')
    } finally {
      setSavingData(false)
    }
  }
  
  // Add a goal to the user (for current challenge)
  const addGoalToUser = async (goal) => {
    if (!user?.email || !selectedChallenge) return
    
    setSavingData(true)
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          goalId: goal.id,
          challengeId: selectedChallenge.coach_challenges?.challenge_id
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add goal')
      }
      
      // Refresh data
      await loadModalData()
      await fetchGoalsForChallenge(selectedChallenge.coach_challenges?.challenge_id)
      showNotification('Goal added successfully!', 'success')
    } catch (error) {
      console.error('Error adding goal:', error)
      showNotification(error.message || 'Failed to add goal', 'error')
    } finally {
      setSavingData(false)
    }
  }
  
  // Create custom goal
  const createCustomGoal = async () => {
    if (!user?.email) return
    
    console.log('🎯 Creating goal - initial state:', {
      selectedCoachGoal,
      coachGoals: coachGoals.length,
      userChallenges: userChallenges.length,
      selectedChallenge
    })
    
    // Check if user selected a coach goal or entered custom text
    const selectedGoalObj = selectedCoachGoal 
      ? coachGoals.find(g => g.goal_id === selectedCoachGoal)
      : null
    
    console.log('🔍 Selected goal object:', selectedGoalObj)
    
    const goalLabel = selectedGoalObj?.label || newGoalLabel.trim()
    
    if (!goalLabel) {
      showNotification('Please select a goal or enter a custom goal name', 'warning')
      return
    }

    // Check for duplicate goals
    const isDuplicate = userGoals.some(g => {
      const existingLabel = g.coach_wellness_goals?.label || g.label
      const existingGoalId = g.coach_wellness_goals?.goal_id || g.goal_id
      return existingLabel === goalLabel || (selectedCoachGoal && existingGoalId === selectedCoachGoal)
    })
    
    if (isDuplicate) {
      showNotification('You already have this goal. Please choose a different one.', 'warning')
      return
    }

    if (!swapType && userGoals.filter(g => g.is_active).length >= 2) {
      showNotification('You can only have 2 active goals. Please swap out an existing goal first, or this will be added to your library.', 'warning')
    }
    
    const goalDescription = selectedGoalObj?.description || newGoalDescription.trim() || newGoalLabel.trim()
    
    // Get challenge_id: from selected coach goal, or from selectedChallenge, or from user's first challenge
    let challengeId = selectedGoalObj?.challenge_id || selectedChallenge?.coach_challenges?.challenge_id
    
    console.log('🔍 Challenge ID from selected goal:', selectedGoalObj?.challenge_id)
    console.log('🔍 Challenge ID from selectedChallenge:', selectedChallenge?.coach_challenges?.challenge_id)
    
    if (!challengeId && userChallenges.length > 0) {
      // Fallback to user's first challenge
      challengeId = userChallenges[0]?.coach_challenges?.challenge_id
      console.log('🔍 Challenge ID from user challenges:', challengeId)
    }
    
    if (!challengeId) {
      showNotification('No challenge found. Please contact support.', 'error')
      console.error('❌ No challenge ID found:', { selectedGoalObj, selectedChallenge, userChallenges })
      return
    }
    
    console.log('✅ Creating goal with:', { goalLabel, goalDescription, challengeId })
    
    setSavingData(true)
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          challengeId: challengeId,  // Send at top level
          goalData: {
            label: goalLabel,
            description: goalDescription,
            challengeId: challengeId  // Also send inside goalData for the API
          }
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create goal')
      }
      
      const responseData = await response.json()
      const createdGoalId = responseData.goal?.id || null
      
      // Insert 'create' event (analytics plumbing)
      if (createdGoalId) {
        await insertGoalEvent({
          event_type: 'create',
          goal_id: createdGoalId,
          to_user_goal_id: createdGoalId,
          challenge_id: challengeId || null
        })
      }
      
      // Reset and go back
      setNewGoalLabel('')
      setNewGoalDescription('')
      setSelectedCoachGoal('')
      setGeneratedGoalOptions([])  // Clear AI-generated options
      setSelectedGoalOption(null)  // Clear selection
      resetCreateBaseline()
      await loadModalData()
      if (selectedChallenge) {
        await fetchGoalsForChallenge(selectedChallenge.coach_challenges?.challenge_id)
      }
      
      // Navigate back appropriately
      if (isFromLibrary) {
        // User came from library - go back to library view
        setModalView('view-goals')
        setIsFromLibrary(false) // Reset flag
      } else if (isSwapFlow && userGoals.length > 0) {
        // User came from swap goal flow AND there were existing goals - go back to swap-goal-select
        setModalView('swap-goal-select')
        setIsSwapFlow(false) // Reset flag
      } else {
        // User was creating a new goal or first goal - close modal
        setShowManageModal(false)
        setModalView('menu')
      }
      showNotification('Goal created successfully!', 'success')
    } catch (error) {
      console.error('Error creating goal:', error)
      showNotification(error.message || 'Failed to create goal', 'error')
    } finally {
      setSavingData(false)
    }
  }
  
  // Create new action(s)
  const createNewAction = async () => {
    // Use either selectedGoalForActions or selectedGoalForSwap
    const goalToUse = selectedGoalForActions || selectedGoalForSwap
    
    console.log('🎯 Goal to use:', goalToUse)
    console.log('🎯 Selected goal for swap:', selectedGoalForSwap)
    console.log('🎯 Track goal:', trackGoal)
    console.log('🎯 Wellness goal:', wellnessGoal)
    
    // If no goal explicitly selected, try to infer from context
    const inferredGoal = goalToUse || (swapType === 'track' ? trackGoal : wellnessGoal)
    
    const hasSelectedAI = selectedActionOptions.length > 0 && generatedActionOptions.length > 0
    // Build action items with full metadata for AI-generated, or just text for manual
    const actionItems = hasSelectedAI
      ? selectedActionOptions
          .map(index => {
            const action = generatedActionOptions[index]
            if (!action) return null
            return {
              text: action.title,
              coachMetadata: {
                trigger_condition: action.trigger_condition || null,
                mechanism_type: action.mechanism_type || null,
                ai_note: action.ai_note || null,
                category: action.category || null,
                duration_minutes: action.duration_minutes || null,
                difficulty: action.difficulty || null,
                success_criteria: action.success_criteria || null,
                when_to_do: action.when_to_do || null
              }
            }
          })
          .filter(Boolean)
      : [newActionText.trim()].filter(Boolean).map(text => ({ text, coachMetadata: null }))
    const actionTexts = actionItems.map(item => item.text)

    const existingCount = goalActions.length
    // Only enforce 3-action limit if NOT from library
    if (!isFromLibrary && existingCount + actionTexts.length > 3) {
      showNotification('Each goal can have up to 3 actions. Please swap an action instead.', 'warning')
      return
    }
    
    if (!user?.email || actionTexts.length === 0 || !inferredGoal) {
      console.log('❌ Cannot create action:', {
        hasEmail: !!user?.email,
        actionCount: actionTexts.length,
        hasGoal: !!inferredGoal
      })
      showNotification('Please select or enter at least one action', 'warning')
      return
    }
    
    // Check for duplicate actions
    const existingActionTitles = goalActions.map(a => a.title?.toLowerCase().trim())
    const duplicates = actionTexts.filter(text => 
      existingActionTitles.includes(text.toLowerCase().trim())
    )
    
    if (duplicates.length > 0) {
      showNotification(`Action "${duplicates[0]}" already exists for this goal. Please choose a different action.`, 'warning')
      return
    }
    
    console.log('🎯 Creating actions with goal:', inferredGoal)
    
    setSavingData(true)
    try {
      const goalId = inferredGoal.coach_wellness_goals?.goal_id || inferredGoal.goal_id
      const goalDbId = inferredGoal.coach_wellness_goals?.id || inferredGoal.id
      
      console.log('📤 Sending action create requests:', {
        goalId,
        goalDbId,
        actionCount: actionTexts.length
      })
      
      for (const actionItem of actionItems) {
        const response = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            goalId: goalId,
            challengeId: inferredGoal.coach_wellness_goals?.challenge_id || inferredGoal.challenge_id || null,
            actionText: actionItem.text,
            coachMetadata: actionItem.coachMetadata || null
          })
        })
        
        const data = await response.json()
        console.log('📥 Action create response:', data)
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create action')
        }
        
        // Log 'create' event with baseline data for each created action
        const createdActionId = data.action?.id || null
        await insertActionEvent({
          event_type: 'create',
          goal_id: inferredGoal?.id || null,
          action_id: createdActionId,
          user_goal_id: inferredGoal?.id || null,
          baseline_confidence_1_4: createActionConfidence || null,
          notes: createActionFriction || null
        })
      }
      
      // Reset and refresh
      setNewActionText('')
      setGeneratedActionOptions([])
      setSelectedActionOptions([])
      resetCreateBaseline()
      
      // Fetch updated actions for the goal using goal_id
      if (goalId) {
        await fetchActionsForGoal(goalId)
      }
      
      // Refresh main page actions too
      if (userData?.id) {
        await fetchActionsForGoals(userData.id, trackGoal?.goal_id, wellnessGoal?.goal_id)
      }
      
      // Navigate back appropriately
      if (isFromLibrary) {
        // User came from library - go back to library view
        setModalView('view-goals')
        setIsFromLibrary(false) // Reset flag
      } else if (isSwapFlow) {
        // User came from swap action flow - go back to swap-actions modal
        setModalView('swap-actions')
        setIsSwapFlow(false) // Reset flag
      } else {
        // User was creating new actions - close modal
        setShowManageModal(false)
        setModalView('menu')
      }
      showNotification(`Created ${actionTexts.length} action${actionTexts.length > 1 ? 's' : ''} successfully!`, 'success')
    } catch (error) {
      console.error('❌ Error creating action:', error)
      showNotification(error.message || 'Failed to create action', 'error')
    } finally {
      setSavingData(false)
    }
  }
  
  // Delete action
  const deleteAction = async (action) => {
    if (!user?.email || !confirm('Are you sure you want to delete this action?')) return
    
    setSavingData(true)
    try {
      const response = await fetch('/api/actions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          actionId: action.id
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete action')
      }
      
      // Refresh actions
      await fetchActionsForGoal(selectedGoalForActions.coach_wellness_goals?.id || selectedGoalForActions.id)
      
      // Refresh main page actions
      if (userData?.id) {
        await fetchActionsForGoals(userData.id, trackGoal?.goal_id, wellnessGoal?.goal_id)
      }
    } catch (error) {
      console.error('Error deleting action:', error)
      showNotification(error.message || 'Failed to delete action', 'error')
    } finally {
      setSavingData(false)
    }
  }
  
  // Drag and drop handlers for action reordering
  const handleDragStart = (e, action) => {
    setDraggedAction(action)
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  
  const handleDrop = async (e, targetAction) => {
    e.preventDefault()
    if (!draggedAction || draggedAction.id === targetAction.id) return
    
    // Reorder the actions
    const reorderedActions = [...goalActions]
    const draggedIndex = reorderedActions.findIndex(a => a.id === draggedAction.id)
    const targetIndex = reorderedActions.findIndex(a => a.id === targetAction.id)
    
    reorderedActions.splice(draggedIndex, 1)
    reorderedActions.splice(targetIndex, 0, draggedAction)
    
    setGoalActions(reorderedActions)
    setDraggedAction(null)
    
    // Save new order to backend
    try {
      const response = await fetch('/api/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          actions: reorderedActions.map((a, i) => ({ id: a.id, displayOrder: i + 1 }))
        })
      })
      
      if (!response.ok) {
        console.error('Failed to save action order')
      }
      
      // Refresh main page actions
      if (userData?.id) {
        await fetchActionsForGoals(userData.id, trackGoal?.goal_id, wellnessGoal?.goal_id)
      }
    } catch (error) {
      console.error('Error saving action order:', error)
    }
  }
  
  // Save primary track
  const savePrimaryTrack = async (newTrack) => {
    if (!user?.email) return
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ primary_track: newTrack })
        .eq('email', user.email)
      
      if (error) throw error
      setPrimaryTrack(newTrack)
    } catch (error) {
      console.error('Error saving primary track:', error)
    }
  }
  
  // Check if user has a challenge
  const userHasChallenge = (challengeId) => {
    return userChallenges.some(uc => 
      uc.coach_challenges?.challenge_id === challengeId
    )
  }
  
  // Check if user has a goal
  const userHasGoal = (goalId) => {
    return userGoals.some(ug => 
      ug.coach_wellness_goals?.goal_id === goalId || ug.coach_wellness_goals?.id === goalId
    )
  }
  
  // Get user's goals for a specific challenge
  const getGoalsForChallenge = (challengeId) => {
    return userGoals.filter(ug => 
      ug.coach_wellness_goals?.challenge_id === challengeId
    )
  }
  
  // Fetch coach's pre-defined goals
  const fetchCoachGoals = async () => {
    if (!userData?.id) {
      console.log('❌ No userData.id found')
      return
    }
    
    try {
      console.log('🔍 Fetching coach goals for user:', userData.id)
      
      // Get user's challenges to find the coach and challenge
      const { data: userChallenges, error: challengeError } = await supabase
        .from('user_challenges')
        .select(`
          id,
          coach_challenges (
            id,
            challenge_id,
            coach_profile_id
          )
        `)
        .eq('user_id', userData.id)
        .limit(1)
      
      console.log('📋 User challenges query result:', { userChallenges, challengeError })
      
      if (challengeError) throw challengeError
      
      if (!userChallenges || userChallenges.length === 0) {
        console.log('⚠️ No user challenges found')
        setCoachGoals([])
        return
      }
      
      const coachId = userChallenges[0]?.coach_challenges?.coach_profile_id
      const challengeId = userChallenges[0]?.coach_challenges?.challenge_id
      const coachChallengeId = userChallenges[0]?.coach_challenges?.id
      
      console.log('🎯 Extracted coach_profile_id:', coachId, 'challenge_id:', challengeId, 'coach_challenge_id:', coachChallengeId)
      
      if (!coachId || !coachChallengeId) {
        console.log('⚠️ No coach_profile_id or coach_challenge_id found')
        setCoachGoals([])
        return
      }
      
      // Get user's current severity for this challenge
      const { data: latestAssessment, error: assessmentError } = await supabase
        .from('user_challenge_latest_assessment')
        .select('severity_label')
        .eq('user_id', userData.id)
        .eq('coach_challenge_id', coachChallengeId)
        .single()
      
      console.log('📊 User severity assessment:', { latestAssessment, assessmentError })
      
      // If no assessment found, show all active goals (backward compatibility)
      const userSeverity = latestAssessment?.severity_label
      
      console.log('🔎 Querying coach_wellness_goals with:', { coachId, challengeId, userSeverity })
      
      // Fetch goals for this coach and challenge
      // Filter by user's severity OR NULL severity (general goals)
      let query = supabase
        .from('coach_wellness_goals')
        .select('*')
        .eq('coach_profile_id', coachId)
        .eq('challenge_id', challengeId)
        .eq('is_active', true)
      
      // Filter by severity: match user's severity OR NULL (general goals)
      if (userSeverity) {
        query = query.or(`severity.eq.${userSeverity},severity.is.null`)
      }
      
      const { data: goals, error } = await query.order('display_order', { ascending: true })
      
      console.log('✅ Coach wellness goals query result:', { goals, error })
      
      if (error) throw error
      
      console.log(`✅ Successfully fetched ${goals?.length || 0} coach goals for severity: ${userSeverity || 'all'}`)
      
      // Log each goal to verify challenge_id is present
      if (goals && goals.length > 0) {
        console.log('📋 Coach goals details:', goals.map(g => ({
          label: g.label,
          goal_id: g.goal_id,
          challenge_id: g.challenge_id,
          severity: g.severity,
          coach_profile_id: g.coach_profile_id
        })))
      }
      
      setCoachGoals(goals || [])
    } catch (error) {
      console.error('❌ Error fetching coach goals:', error)
      setCoachGoals([])
    }
  }
  
  // Open View Goals modal
  const openViewGoalsModal = async () => {
    await loadModalData()
    await fetchCoachGoals()
    setModalView('view-goals')
  }
  
  // Open Swap Action flow
  const openSwapActionModal = async (type, actionBeingSwapped = null) => {
    setSwapType(type)
    setIsSwapFlow(true) // Mark as swap flow
    resetSwapCheckIn()
    
    // Track which action is being swapped out
    if (actionBeingSwapped) {
      setActionToSwapOut(actionBeingSwapped)
    }
    
    // Get the current goal we're swapping actions for
    const currentGoal = type === 'track' ? trackGoal : wellnessGoal
    
    if (!currentGoal) {
      showNotification('No goal selected', 'error')
      return
    }
    
    setSelectedGoalForSwap(currentGoal)
    
    // Fetch all actions for this goal from the library
    const goalId = currentGoal.coach_wellness_goals?.goal_id || currentGoal.goal_id
    console.log('📥 Fetching all actions for goal_id:', goalId)
    await fetchActionsForGoal(goalId)
    
    // Go directly to swap-actions view
    setModalView('swap-actions')
  }
  
  // Select goal for swapping — show check-in before finalizing
  const selectGoalForSwap = async (goal) => {
    console.log('🎯 Selecting goal for swap:', goal)
    setSelectedGoalForSwap(goal)
    resetSwapCheckIn()
    
    // Show goal swap check-in step before finalizing
    setModalView('swap-goal-checkin')
  }
  
  // Complete the goal swap by deactivating old goal and activating new one
  const completeGoalSwap = async (newGoal) => {
    if (!user?.email || !swapType) return
    
    setSavingData(true)
    try {
      const currentGoal = swapType === 'track' ? trackGoal : wellnessGoal
      
      // Log the goal swap_out event with check-in data (replaces old duplicate logging)
      if (currentGoal?.id && userData?.id) {
        await insertGoalEvent({
          event_type: 'swap_out',
          goal_slot: swapType === 'track' ? 1 : 2,
          goal_id: currentGoal.id,
          from_user_goal_id: currentGoal.id,
          swapped_to_goal_id: newGoal.id,
          rating_1_4: swapCheckInRating || null,
          reason_code: swapCheckInReason || null,
          notes: swapCheckInNotes || null
        })
        // Log swap_in for the new goal
        await insertGoalEvent({
          event_type: 'swap_in',
          goal_slot: swapType === 'track' ? 1 : 2,
          goal_id: newGoal.id,
          to_user_goal_id: newGoal.id
        })
      }
      
      // Deactivate current goal if exists
      if (currentGoal?.id) {
        const deactivateResponse = await fetch('/api/goals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            goalId: currentGoal.id,
            isActive: false
          })
        })
        
        if (!deactivateResponse.ok) {
          throw new Error('Failed to deactivate current goal')
        }
      }
      
      // Activate new goal
      const activateResponse = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          goalId: newGoal.id,
          isActive: true
        })
      })
      
      if (!activateResponse.ok) {
        throw new Error('Failed to activate new goal')
      }
      
      // Reload data
      await loadModalData()
      
      // Update local state
      const goalData = {
        id: newGoal.id,
        goal_id: newGoal.coach_wellness_goals?.goal_id || newGoal.goal_id,
        name: newGoal.coach_wellness_goals?.label || newGoal.label
      }
      
      if (swapType === 'track') {
        setTrackGoal(goalData)
        if (userData?.id) {
          await fetchActionsForGoals(userData.id, goalData.goal_id, wellnessGoal?.goal_id)
        }
      } else {
        setWellnessGoal(goalData)
        if (userData?.id) {
          await fetchActionsForGoals(userData.id, trackGoal?.goal_id, goalData.goal_id)
        }
      }
      
      resetSwapCheckIn()
      closeModal()
      
      // Open baseline modal for the new goal (goal-only context)
      const slot = swapType === 'track' ? 1 : 2
      openGoalBaselineModal(slot, goalData, 'swap-goal')
      
      showNotification('Goal swapped! Set your starting baseline.', 'success')
    } catch (error) {
      console.error('Error swapping goal:', error)
      showNotification(error.message || 'Failed to swap goal', 'error')
    } finally {
      setSavingData(false)
    }
  }
  
  // Remove goal from active slots (move to library)
  const removeGoal = async (goalDbId) => {
    if (!user?.email) return
    
    if (!confirm('Remove this goal from your active goals? It will be moved to your Library.')) {
      return
    }
    
    setSavingData(true)
    try {
      const response = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          goalId: goalDbId,
          isActive: false
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove goal')
      }
      
      // Log goal remove event
      if (userData?.id) {
        await supabase.from('user_goal_events').insert({
          user_id: userData.id,
          event_type: 'remove',
          goal_slot: 2,
          from_user_goal_id: goalDbId
        }).catch(err => console.warn('Goal event log failed:', err))
      }
      
      // Clear from local state
      setWellnessGoal(null)
      setWellnessActions([])
      
      // Reload data
      await loadModalData()
      
      showNotification('Goal moved to Library!', 'success')
    } catch (error) {
      console.error('Error removing goal:', error)
      showNotification(error.message || 'Failed to remove goal', 'error')
    } finally {
      setSavingData(false)
    }
  }
  
  // Toggle action selection
  const toggleActionSelection = (actionId) => {
    setSelectedActions(prev => {
      if (prev.includes(actionId)) {
        return prev.filter(id => id !== actionId)
      } else if (prev.length < 3) {
        return [...prev, actionId]
      }
      return prev
    })
  }
  
  // Save selected actions and update display
  const saveSelectedActions = async () => {
    if (selectedActions.length === 0) {
      showNotification('Please select at least one action', 'warning')
      return
    }
    
    // If check-in required and not yet completed, show check-in step
    if (actionToSwapOut && swapCheckInRating === 0) {
      setModalView('swap-action-checkin')
      return
    }
    
    setSavingData(true)
    try {
      // If we're swapping goals, complete the goal swap first
      if (swapType && selectedGoalForSwap && !actionToSwapOut) {
        await completeGoalSwap(selectedGoalForSwap)
      }
      
      // Log swap_out event with check-in data
      if (actionToSwapOut && userData?.id) {
        const goalId = selectedGoalForSwap?.coach_wellness_goals?.goal_id || selectedGoalForSwap?.goal_id
        await insertActionEvent({
          event_type: 'swap_out',
          goal_id: selectedGoalForSwap?.id || null,
          action_id: actionToSwapOut.id,
          rating_1_4: swapCheckInRating || null,
          reason_code: swapCheckInReason || null,
          notes: swapCheckInNotes || null,
          swapped_to_action_id: selectedActions[0] || null
        })
        // Also log swap_in for the new action
        await insertActionEvent({
          event_type: 'swap_in',
          goal_id: selectedGoalForSwap?.id || null,
          action_id: selectedActions[0] || null
        })
      }
      
      // Update display order of selected actions to make them top 3
      const reorderPromises = selectedActions.map((actionId, index) => 
        fetch('/api/actions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            actionId: actionId,
            displayOrder: index + 1
          })
        })
      )
      
      await Promise.all(reorderPromises)
      
      // Refresh the main page actions
      if (userData?.id) {
        await fetchActionsForGoals(userData.id, trackGoal?.goal_id, wellnessGoal?.goal_id)
      }
      
      resetSwapCheckIn()
      closeModal()
      
      // Open action baseline modal after action swap-in
      if (actionToSwapOut) {
        const slot = swapType === 'track' ? 1 : 2
        const goal = swapType === 'track' ? trackGoal : wellnessGoal
        openBaselineModal('action', slot, goal, 'swap-action')
      }
      
      const message = swapType 
        ? 'Goal swapped and actions updated successfully!' 
        : `${selectedActions.length} action(s) updated successfully!`
      showNotification(message, 'success')
    } catch (error) {
      console.error('Error saving actions:', error)
      showNotification('Failed to save actions', 'error')
    } finally {
      setSavingData(false)
    }
  }
  
  // Generate goal using AI (Coach AI system)
  const generateGoalWithAI = async () => {
    if (!user?.email) return
    
    setGeneratingGoal(true)
    try {
      console.log('🎯 Generating goal using Coach AI system for user:', user.email)
      
      const response = await fetch('/api/coach/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          seedGoalTitle: newGoalLabel?.trim() || null,
          seedGoalDescription: newGoalDescription?.trim() || null
        })
      })
      
      const data = await response.json()
      
      console.log('✅ Coach AI Response:', data)
      
      if (response.ok && data.goals && data.goals.length > 0) {
        // Store all generated goal options IN CACHE
        console.log(`🎯 Received ${data.goals.length} goal options from Coach AI`)
        
        // Add to cache instead of replacing
        goalCache.addBatch(data.goals)
        
        // Set UI state to show cached items
        setGeneratedGoalOptions(data.goals)
        // Auto-select the first one, but user can change
        setSelectedGoalOption(0)
        setNewGoalLabel(data.goals[0].label)
        setNewGoalDescription(data.goals[0].description || '')
        console.log(`💰 Tokens used: ${data.tokens_used}, Remaining: ${data.tokens_remaining}`)
      } else {
        console.error('❌ Coach AI response not ok:', data)
        showNotification(data.error || 'Failed to generate goal. Please try again.', 'error')
      }
    } catch (error) {
      console.error('❌ Error generating goal:', error)
      showNotification('Failed to generate goal. Please try again.', 'error')
    } finally {
      setGeneratingGoal(false)
    }
  }
  
  // Select a different goal from generated options
  const selectGoalOption = (index) => {
    if (generatedGoalOptions[index]) {
      setSelectedGoalOption(index)
      setNewGoalLabel(generatedGoalOptions[index].label)
      setNewGoalDescription(generatedGoalOptions[index].description || '')
      console.log('🎯 User selected goal option:', index, generatedGoalOptions[index].label)
    }
  }
  
  // Generate action using AI (Coach AI system)
  const generateActionWithAI = async () => {
    if (!user?.email || !selectedGoalForSwap) return
    
    setGeneratingAction(true)
    try {
      const goalId = selectedGoalForSwap.wellness_goal_id || selectedGoalForSwap.id
      const goalLabel = selectedGoalForSwap.coach_wellness_goals?.label || selectedGoalForSwap.label || newGoalLabel || 'your goal'
      const goalDescription = selectedGoalForSwap.coach_wellness_goals?.description || selectedGoalForSwap.description || newGoalDescription
      
      console.log('🎯 Generating action using Coach AI for goal:', goalLabel, 'goalId:', goalId)
      
      // For custom goals (IDs starting with "custom_"), pass goal details directly instead of goalId
      const isCustomGoal = goalId && String(goalId).startsWith('custom_')
      
      // Determine goal type for track-specific prompting
      const goalType = swapType === 'track' ? 'track' : 'wellness'
      
      const requestBody = {
        email: user.email,
        goalLabel: goalLabel,
        goalDescription: goalDescription,
        goalType: goalType,
        seedActionText: newActionText?.trim() || null
      }
      
      // Only include goalId if it's a coach goal (not custom)
      if (!isCustomGoal && goalId) {
        requestBody.goalId = goalId
      }
      
      console.log('📤 Request body:', requestBody)
      
      const response = await fetch('/api/coach/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      const data = await response.json()
      
      console.log('✅ Coach AI Response:', data)
      
      if (response.ok && data.actions && data.actions.length > 0) {
        // Store all generated action options IN CACHE
        console.log(`🎯 Received ${data.actions.length} action options from Coach AI`)
        
        // Filter out actions that are already active for this goal
        const activeActionTexts = goalActions
          .filter(a => a.is_complete === false && a.action_text)
          .map(a => a.action_text.toLowerCase().trim())
        
        const filteredActions = data.actions.filter(a => {
          const actionText = a.action_text || a.title || ''
          return actionText && !activeActionTexts.includes(actionText.toLowerCase().trim())
        })
        
        // Add to cache instead of replacing
        actionCache.addBatch(filteredActions)
        
        setGeneratedActionOptions(filteredActions)
        // Auto-select the first TWO actions
        setSelectedActionOptions([0, 1])
        setExpandedAINoteIndex(null)
        showNotification(`✨ Generated ${filteredActions.length} action suggestions!`, 'success')
        console.log(`💰 Tokens used: ${data.tokens_used}, Remaining: ${data.tokens_remaining}`)
      } else {
        console.error('❌ Coach AI response not ok:', data)
        showNotification(data.error || 'Failed to generate actions. Please try again.', 'error')
      }
    } catch (error) {
      console.error('❌ Error generating actions:', error)
      showNotification('Failed to generate actions. Please try again.', 'error')
    } finally {
      setGeneratingAction(false)
    }
  }
  
  // Generate weekly insights using Coach AI
  const generateWeeklyInsights = async () => {
    if (!user) return
    
    setGeneratingInsights(true)
    
    try {
      console.log('🔮 Generating weekly insights...')
      
      const response = await fetch('/api/coach/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        console.log('✅ Weekly insights generated:', data)
        
        // Store insights data
        setWeeklyInsights({
          risk_window: data.insights.risk_window,
          best_tool: data.insights.best_tool,
          best_lever: data.insights.best_lever,
          keep: data.next_week_plan.keep,
          change: data.next_week_plan.change,
          try: data.next_week_plan.try
        })
        
        showNotification('✨ Weekly insights generated!', 'success')
        console.log(`💰 Tokens used: ${data.tokens_used}, Remaining: ${data.tokens_remaining}`)
        
        // Update user tokens in state
        setUser(prev => ({ ...prev, tokens: data.tokens_remaining }))
      } else {
        console.error('❌ Insights generation failed:', data)
        if (data.error === 'Insufficient tokens') {
          showNotification(`Need ${data.required} tokens. You have ${data.available}.`, 'warning')
        } else {
          showNotification(data.error || 'Failed to generate insights. Please try again.', 'error')
        }
      }
    } catch (error) {
      console.error('❌ Error generating insights:', error)
      showNotification('Failed to generate insights. Please try again.', 'error')
    } finally {
      setGeneratingInsights(false)
    }
  }
  
  // Apply next week plan (creates actions from keep/change/try recommendations)
  const applyNextWeekPlan = async () => {
    if (!weeklyInsights || !weeklyInsights.keep || !weeklyInsights.change || !weeklyInsights.try) {
      showNotification('Generate insights first before applying plan.', 'warning')
      return
    }
    
    if (coachGoals.length === 0) {
      showNotification('Add a goal first before applying plan.', 'warning')
      return
    }
    
    try {
      setSavingData(true)
      
      // Combine all recommendations (2 keep + 2 change + 2 try = 6 actions)
      const allRecommendations = [
        ...weeklyInsights.keep.map(text => ({ text, type: 'keep' })),
        ...weeklyInsights.change.map(text => ({ text, type: 'change' })),
        ...weeklyInsights.try.map(text => ({ text, type: 'try' }))
      ]
      
      console.log(`📋 Applying ${allRecommendations.length} recommendations to first goal...`)
      
      // Apply all actions to the first active goal
      const targetGoal = coachGoals[0]
      let successCount = 0
      
      for (const rec of allRecommendations) {
        // Check if action already exists
        const existingActions = await supabase
          .from('action_plans')
          .select('title')
          .eq('goal_id', targetGoal.id)
        
        const isDuplicate = existingActions.data?.some(
          action => action.title.toLowerCase().trim() === rec.text.toLowerCase().trim()
        )
        
        if (isDuplicate) {
          console.log(`⚠️ Skipping duplicate action: "${rec.text}"`)
          continue
        }
        
        // Create action
        const { error } = await supabase
          .from('action_plans')
          .insert({
            goal_id: targetGoal.id,
            title: rec.text,
            when_to_use: 'anytime',
            is_coach_generated: true,
            coach_metadata: { source: 'weekly_insights', type: rec.type }
          })
        
        if (!error) {
          successCount++
        }
      }
      
      showNotification(`✅ Added ${successCount} actions to "${targetGoal.coach_wellness_goals.label}"!`, 'success')
      
      // Refresh data
      await fetchUserGoalsAndActions()
      
    } catch (error) {
      console.error('❌ Error applying plan:', error)
      showNotification('Failed to apply plan. Please try again.', 'error')
    } finally {
      setSavingData(false)
    }
  }
  
  // Toggle AI-generated action option selection (checkbox)
  const toggleAIActionOption = (index) => {
    setSelectedActionOptions(prev => {
      if (prev.includes(index)) {
        // Deselect
        return prev.filter(i => i !== index)
      } else {
        // Select
        return [...prev, index]
      }
    })
  }
  
  // Close modal and reset state
  const closeModal = () => {
    setShowManageModal(false)
    setModalView('menu')
    setSelectedChallenge(null)
    setSelectedGoalForActions(null)
    setSelectedGoalForSwap(null)
    setSwapType(null)
    setSelectedCoachGoal('')
    setNewGoalLabel('')
    setNewGoalDescription('')
    setNewActionText('')
    setGoalActions([])
    setSelectedActions([])
    setAvailableGoals([])
    setCoachGoals([])
    setGeneratedGoalOptions([]) // Clear AI-generated options
    setSelectedGoalOption(null) // Clear selection
    setGeneratedActionOptions([]) // Clear AI-generated action options
    setSelectedActionOptions([]) // Clear action selections
  }

  const handleContinuePlan = () => {
    // Find first incomplete action in selected tab
    const actions = selectedTab === 'track' ? trackActions : wellnessActions
    const firstIncomplete = actions.find(a => a.status === 'not_started')
    
    if (firstIncomplete) {
      handleStartAction(firstIncomplete)
    } else {
      // All actions complete, open manage
      openManageModal()
    }
  }

  const getTrackLabel = () => {
    const trackLabels = {
      'porn': 'Porn goal',
      'sex': 'Sex goal',
      'food': 'Food goal'
    }
    return trackLabels[primaryTrack] || 'Track goal'
  }

  const currentActions = selectedTab === 'track' ? trackActions : wellnessActions
  const currentGoal = selectedTab === 'track' ? trackGoal : wellnessGoal

  if (loading) {
    return (
      <Layout title="Your Playbook">
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading your playbook...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Your Playbook">
      {/* Notification Toast */}
      {notification.show && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 10000,
            maxWidth: '400px',
            padding: '16px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'slideIn 0.3s ease-out',
            background: notification.type === 'success' ? '#10b981' : 
                       notification.type === 'error' ? '#ef4444' : 
                       notification.type === 'warning' ? '#f59e0b' : '#3b82f6',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500'
          }}
          onClick={() => setNotification({ show: false, message: '', type: 'success' })}
        >
          <span style={{ fontSize: '20px' }}>
            {notification.type === 'success' ? '✓' : 
             notification.type === 'error' ? '✕' : 
             notification.type === 'warning' ? '⚠' : 'ℹ'}
          </span>
          <span style={{ flex: 1 }}>{notification.message}</span>
          <button
            onClick={() => setNotification({ show: false, message: '', type: 'success' })}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0',
              lineHeight: '1'
            }}
          >
            ×
          </button>
        </div>
      )}
      
      <div className={styles.playbookContainer}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>Your Playbook</h1>
            <p className={styles.subtitle}>Track → Goal → Actions. One clear next step.</p>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.badge}>
              <span className={styles.badgeLabel}>Tokens:</span>
              <span className={styles.badgeValue}>{userData?.tokens?.toLocaleString() || 0}</span>
            </div>
            <div className={styles.badge}>
              <span className={styles.badgeLabel}>Streak:</span>
              <span className={styles.badgeValue}>{streak} days</span>
            </div>
          </div>
        </header>

        <div className={styles.contentGrid}>
          {/* Left Column - Main Content */}
          <div className={styles.leftColumn}>
            {/* Next Step Card */}
            <div className={styles.card}>
              <div className={styles.nextStepHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Next step</h2>
                  <p className={styles.reassurance}>You're okay. Pick one small rep.</p>
                </div>
                <Link href="/support-now" className={styles.supportLink}>
                  Support Now (Free)
                </Link>
              </div>
              
              <div className={styles.nextStepContent}>
                <div className={styles.streakInfo}>
                  <input 
                    type="checkbox" 
                    checked={streak >= 6} 
                    readOnly 
                    className={styles.streakCheckbox}
                  />
                  <span className={styles.streakText}>6-day streak</span>
                  <span className={styles.streakProgress}>Today: 1 / 3 reps</span>
                </div>
                <button 
                  className={styles.continuePlanButton}
                  onClick={handleContinuePlan}
                >
                  Continue Plan (2 min)
                </button>
              </div>
            </div>

            {/* Today's Actions Card */}
            <div className={styles.card}>
              <div className={styles.actionsHeader}>
                <h2 className={styles.cardTitle}>Today's actions</h2>
                <button 
                  className={styles.manageButton}
                  onClick={openManageModal}
                >
                  Manage
                </button>
              </div>
              
              <p className={styles.actionsSubtitle}>
                Click any goal below to view its actions. Click again to collapse.
              </p>

              {/* Accordion-style Goals */}
              <div className={styles.goalsAccordion}>
                {/* Track Goal */}
                {trackGoal && (
                  <div className={styles.goalAccordionItem}>
                    <div 
                      className={styles.goalAccordionHeader}
                      onClick={() => setExpandedTodayGoalId(
                        expandedTodayGoalId === 'track' ? null : 'track'
                      )}
                    >
                      <div className={styles.goalAccordionHeaderLeft}>
                        <span className={styles.goalAccordionIcon}>
                          {expandedTodayGoalId === 'track' ? '▼' : '▶'}
                        </span>
                        <div>
                          <h3 className={styles.goalAccordionTitle}>
                            {trackGoal?.name || getTrackLabel()}
                          </h3>
                          <p className={styles.goalAccordionMeta}>
                            {trackActions.length} action{trackActions.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <span className={styles.activeGoalBadge}>Active</span>
                    </div>
                    
                    {expandedTodayGoalId === 'track' && (
                      <div className={styles.goalAccordionContent}>
                        {trackActions.length === 0 ? (
                          <div className={styles.emptyState}>
                            <p>No actions yet. Add up to 3 for this goal.</p>
                            <button className={styles.secondaryButton} onClick={() => {
                              setShowManageModal(true)
                              setSelectedGoalForSwap(trackGoal)
                              setSwapType('track')
                              setIsSwapFlow(false) // Not a swap flow
                              setModalView('create-action')
                            }}>
                              Add action
                            </button>
                          </div>
                        ) : (
                          trackActions.map((action) => (
                            <div key={action.id} className={styles.actionRow} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                  type="checkbox"
                                  checked={action.status === 'completed'}
                                  onChange={() => {}} 
                                  className={styles.actionCheckbox}
                                />
                                <div className={styles.actionContent} style={{ flex: 1 }}>
                                  <div className={styles.actionTitleRow}>
                                    <span className={styles.actionTitle}>{action.title}</span>
                                    <span className={styles.durationPill}>
                                      {Math.floor(action.durationSeconds / 60)}m
                                    </span>
                                  </div>
                                  <span className={styles.actionLastLog}>
                                    {formatLastLog(action.lastLog)}
                                  </span>
                                </div>
                                <button
                                  className={styles.actionButton}
                                  onClick={() => handleOpenLogModal(action)}
                                >
                                  Log
                                </button>
                              </div>
                              {renderActionMetadata(action)}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Wellness Goal */}
                {wellnessGoal?.goal_id ? (
                  <div className={styles.goalAccordionItem}>
                    <div 
                      className={styles.goalAccordionHeader}
                      onClick={() => setExpandedTodayGoalId(
                        expandedTodayGoalId === 'wellness' ? null : 'wellness'
                      )}
                    >
                      <div className={styles.goalAccordionHeaderLeft}>
                        <span className={styles.goalAccordionIcon}>
                          {expandedTodayGoalId === 'wellness' ? '▼' : '▶'}
                        </span>
                        <div>
                          <h3 className={styles.goalAccordionTitle}>
                            {wellnessGoal.name}
                          </h3>
                          <p className={styles.goalAccordionMeta}>
                            {wellnessActions.length} action{wellnessActions.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <span className={styles.activeGoalBadge}>Active</span>
                    </div>
                    
                    {expandedTodayGoalId === 'wellness' && (
                      <div className={styles.goalAccordionContent}>
                        {wellnessActions.length === 0 ? (
                          <div className={styles.emptyState}>
                            <p>No actions yet. Add up to 3 for this goal.</p>
                            <button className={styles.secondaryButton} onClick={() => {
                              setShowManageModal(true)
                              setSelectedGoalForSwap(wellnessGoal)
                              setSwapType('wellness')
                              setIsSwapFlow(false) // Not a swap flow
                              setModalView('create-action')
                            }}>
                              Add action
                            </button>
                          </div>
                        ) : (
                          wellnessActions.map((action) => (
                            <div key={action.id} className={styles.actionRow} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                  type="checkbox"
                                  checked={action.status === 'completed'}
                                  onChange={() => {}} 
                                  className={styles.actionCheckbox}
                                />
                                <div className={styles.actionContent} style={{ flex: 1 }}>
                                  <div className={styles.actionTitleRow}>
                                    <span className={styles.actionTitle}>{action.title}</span>
                                    <span className={styles.durationPill}>
                                      {Math.floor(action.durationSeconds / 60)}m
                                    </span>
                                  </div>
                                  <span className={styles.actionLastLog}>
                                    {formatLastLog(action.lastLog)}
                                  </span>
                                </div>
                                <button
                                  className={styles.actionButton}
                                  onClick={() => handleOpenLogModal(action)}
                                >
                                  Log
                                </button>
                              </div>
                              {renderActionMetadata(action)}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.goalAccordionItem}>
                    <div className={styles.emptyState}>
                      <p>Add a second goal to unlock more actions.</p>
                      <button className={styles.secondaryButton} onClick={openManageModal}>
                        Add second goal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className={styles.rightColumn}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Weekly patterns</h2>
              <p className={styles.patternsSubtitle}>3 quick insights (opt-in)</p>
              
              {weeklyInsights ? (
                <>
                  <ul className={styles.patternList}>
                    <li className={styles.patternItem}>
                      <span className={styles.patternBullet}>•</span>
                      <span>Risk window: {weeklyInsights.risk_window}</span>
                    </li>
                    <li className={styles.patternItem}>
                      <span className={styles.patternBullet}>•</span>
                      <span>Best tool: {weeklyInsights.best_tool}</span>
                    </li>
                    <li className={styles.patternItem}>
                      <span className={styles.patternBullet}>•</span>
                      <span>Best lever: {weeklyInsights.best_lever}</span>
                    </li>
                  </ul>

                  <button 
                    className={styles.applyPlanButton}
                    onClick={applyNextWeekPlan}
                    disabled={savingData}
                  >
                    {savingData ? 'Applying...' : 'Apply next-week plan (600)'}
                  </button>
                  
                  <button 
                    className={styles.secondaryButton}
                    onClick={generateWeeklyInsights}
                    disabled={generatingInsights}
                    style={{ marginTop: '8px', width: '100%' }}
                  >
                    {generatingInsights ? 'Generating...' : 'Refresh insights (100)'}
                  </button>

                  <button 
                    className={styles.secondaryButton}
                    onClick={() => router.push('/playbook/insights')}
                    style={{ marginTop: '8px', width: '100%', borderColor: '#8b5cf6', color: '#8b5cf6' }}
                  >
                    📊 View detailed report
                  </button>
                </>
              ) : (
                <>
                  <div style={{ 
                    padding: '20px', 
                    textAlign: 'center', 
                    backgroundColor: '#f9fafb', 
                    borderRadius: '8px',
                    marginBottom: '12px'
                  }}>
                    <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '12px' }}>
                      Get AI-powered insights from your past week's actions and completion patterns.
                    </p>
                  </div>
                  
                  <button 
                    className={styles.primaryButton}
                    onClick={generateWeeklyInsights}
                    disabled={generatingInsights}
                    style={{ width: '100%' }}
                  >
                    {generatingInsights ? 'Generating...' : 'Generate insights (100 tokens)'}
                  </button>

                  <button 
                    className={styles.secondaryButton}
                    onClick={() => router.push('/playbook/insights')}
                    style={{ marginTop: '8px', width: '100%', borderColor: '#8b5cf6', color: '#8b5cf6' }}
                  >
                    📊 View detailed report
                  </button>
                </>
              )}
            </div>

            {/* Tokens Card */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Tokens</h2>
              <p className={styles.tokensSubtitle}>Reminders only appear here.</p>
              
              <button className={styles.buyTokensButton}>
                <Link href="/buy-tokens" style={{ color: 'inherit', textDecoration: 'none' }}>
                  Buy tokens
                </Link>
              </button>
            </div>
          </div>
        </div>

        {/* Simplified Manage Modal */}
        {showManageModal && (
          <div className={styles.modalOverlay} onClick={closeModal}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>Manage</h2>
                <button 
                  className={styles.modalClose}
                  onClick={closeModal}
                >
                  ×
                </button>
              </div>
              
              <div className={styles.modalContent}>
                {/* MAIN MENU - Redesigned to match mockup */}
                {modalView === 'menu' && (
                  <>
                    <p className={styles.modalSubtitle}>Keep the main UI calm. Configure goals &amp; actions here.</p>
                    
                    {/* ACTIVE GOALS (2 SLOTS) - WITH COLLAPSIBLE ACTIONS */}
                    <div className={styles.menuSection}>
                      <h4 className={styles.menuSectionLabel}>ACTIVE GOALS (2 SLOTS MAX)</h4>
                      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px', marginTop: '-8px' }}>
                        You can have 2 active goals at a time. Swap = replace one with another from your library. Extra goals are saved in your library.
                      </p>
                      
                      {/* Goal Slot 1 - Track Goal */}
                      <div className={styles.goalSlotCard}>
                        <div 
                          className={styles.goalSlotHeader}
                          onClick={() => setExpandedGoalId(expandedGoalId === 'track' ? null : 'track')}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className={styles.goalSlotInfo}>
                            <h3 className={styles.goalSlotTitle}>
                              <span style={{ marginRight: '8px', fontSize: '14px', color: '#6366f1' }}>
                                {expandedGoalId === 'track' ? '▼' : '▶'}
                              </span>
                              Goal 1: {trackGoal?.name || getTrackLabel()}
                            </h3>
                            <p className={styles.goalSlotMeta}>
                              Track goal ({primaryTrack} recovery) • {trackActions.length} actions pinned
                            </p>
                            {goalBaselines[1] ? (
                              <span className={styles.baselineBadge}>Baseline: set/updated</span>
                            ) : (
                              <span className={styles.baselineBadgeEmpty}>No baseline yet</span>
                            )}
                          </div>
                        </div>
                        
                        {/* Collapsible Actions Section */}
                        {expandedGoalId === 'track' && (
                          <div style={{ 
                            marginTop: '16px', 
                            paddingTop: '16px', 
                            borderTop: '1px solid #e5e7eb',
                            animation: 'slideDown 0.2s ease-out'
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              marginBottom: '16px'
                            }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: 0 }}>
                                Actions ({trackActions.length}/3)
                              </h4>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                  className={styles.swapGoalButton}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSwapType('track')
                                    setIsSwapFlow(true) // Mark as swap flow
                                    setModalView('swap-goal-select')
                                  }}
                                >
                                  Swap goal
                                </button>
                                <button 
                                  className={styles.editBaselineLink}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openGoalBaselineModal(1, trackGoal, 'edit')
                                  }}
                                >
                                  Edit baseline
                                </button>
                              </div>
                            </div>
                            
                            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
                              Logging helps you see patterns and track progress over time.
                            </p>
                            
                            {/* List actions */}
                            {trackActions.map((action, idx) => (
                              <div key={action.id} style={{ 
                                padding: '10px 12px',
                                background: '#f9fafb',
                                borderRadius: '6px',
                                marginBottom: '6px',
                                border: '1px solid #e5e7eb'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>• {action.title}</span>
                                  <button 
                                    className={styles.actionSwapBtn}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openSwapActionModal('track', action)
                                    }}
                                    style={{ 
                                      fontSize: '12px', 
                                      padding: '6px 12px',
                                      background: 'white',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      color: '#374151',
                                      flexShrink: 0
                                    }}
                                  >
                                    Swap
                                  </button>
                                </div>
                                {renderActionMetadata(action, { compact: false })}
                              </div>
                            ))}
                            
                            {/* Add action button if less than 3 */}
                            {trackActions.length < 3 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedGoalForSwap(trackGoal)
                                  setSwapType('track')
                                  setIsSwapFlow(false) // Not a swap flow
                                  setModalView('create-action')
                                }}
                                style={{
                                  width: '100%',
                                  padding: '12px',
                                  marginTop: '8px',
                                  background: 'white',
                                  border: '2px dashed #d1d5db',
                                  borderRadius: '8px',
                                  color: '#6b7280',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.borderColor = '#6366f1'
                                  e.currentTarget.style.color = '#6366f1'
                                  e.currentTarget.style.background = '#f9fafb'
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.borderColor = '#d1d5db'
                                  e.currentTarget.style.color = '#6b7280'
                                  e.currentTarget.style.background = 'white'
                                }}
                              >
                                + Add action ({trackActions.length}/3)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Goal Slot 2 - Wellness Goal */}
                      <div className={styles.goalSlotCard}>
                        <div 
                          className={styles.goalSlotHeader}
                          onClick={() => wellnessGoal?.goal_id && setExpandedGoalId(expandedGoalId === 'wellness' ? null : 'wellness')}
                          style={{ cursor: wellnessGoal?.goal_id ? 'pointer' : 'default' }}
                        >
                          <div className={styles.goalSlotInfo}>
                            <h3 className={styles.goalSlotTitle}>
                              {wellnessGoal?.goal_id && (
                                <span style={{ marginRight: '8px', fontSize: '14px', color: '#6366f1' }}>
                                  {expandedGoalId === 'wellness' ? '▼' : '▶'}
                                </span>
                              )}
                              Goal 2: {wellnessGoal?.name || 'No second goal'}
                            </h3>
                            <p className={styles.goalSlotMeta}>
                              Optional goal • {wellnessActions.length} actions pinned
                            </p>
                            {wellnessGoal?.goal_id && goalBaselines[2] ? (
                              <span className={styles.baselineBadge}>Baseline: set/updated</span>
                            ) : wellnessGoal?.goal_id ? (
                              <span className={styles.baselineBadgeEmpty}>No baseline yet</span>
                            ) : null}
                          </div>
                        </div>
                        
                        {/* Show add goal button if no wellness goal */}
                        {!wellnessGoal?.goal_id && (
                          <div style={{ marginTop: '12px' }}>
                            <button 
                              className={styles.swapGoalButton}
                              onClick={async (e) => {
                                e.stopPropagation()
                                setSwapType('second')
                                await fetchCoachGoals()
                                setGeneratedGoalOptions([])
                                setSelectedGoalOption(null)
                                setNewGoalLabel('')
                                setNewGoalDescription('')
                                setModalView('create-goal')
                              }}
                              style={{ width: '100%' }}
                            >
                              Add goal
                            </button>
                          </div>
                        )}
                        
                        {/* Collapsible Actions Section */}
                        {wellnessGoal?.goal_id && expandedGoalId === 'wellness' && (
                          <div style={{ 
                            marginTop: '16px', 
                            paddingTop: '16px', 
                            borderTop: '1px solid #e5e7eb',
                            animation: 'slideDown 0.2s ease-out'
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              marginBottom: '16px'
                            }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: 0 }}>
                                Actions ({wellnessActions.length}/3)
                              </h4>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                  className={styles.swapGoalButton}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSwapType('second')
                                    setIsSwapFlow(true) // Mark as swap flow
                                    setModalView('swap-goal-select')
                                  }}
                                >
                                  Swap goal
                                </button>
                                <button 
                                  className={styles.editBaselineLink}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openGoalBaselineModal(2, wellnessGoal, 'edit')
                                  }}
                                >
                                  Edit baseline
                                </button>
                              </div>
                            </div>
                            
                            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
                              Logging helps you see patterns and track progress over time.
                            </p>
                            
                            {/* List actions */}
                            {wellnessActions.map((action, idx) => (
                              <div key={action.id} style={{ 
                                padding: '12px',
                                background: '#fafbfc',
                                borderRadius: '8px',
                                marginBottom: '8px',
                                border: '1px solid #e5e7eb'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>• {action.title}</span>
                                  <button 
                                    className={styles.actionSwapBtn}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openSwapActionModal('second', action)
                                    }}
                                  >
                                    Swap
                                  </button>
                                </div>
                                {renderActionMetadata(action, { compact: false })}
                              </div>
                            ))}
                            
                            {/* Add action button if less than 3 */}
                            {wellnessActions.length < 3 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedGoalForSwap(wellnessGoal)
                                  setSwapType('second')
                                  setIsSwapFlow(false) // Not a swap flow
                                  setModalView('create-action')
                                }}
                                style={{
                                  width: '100%',
                                  padding: '12px',
                                  marginTop: '8px',
                                  background: 'white',
                                  border: '2px dashed #d1d5db',
                                  borderRadius: '8px',
                                  color: '#6b7280',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.borderColor = '#6366f1'
                                  e.currentTarget.style.color = '#6366f1'
                                  e.currentTarget.style.background = '#f9fafb'
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.borderColor = '#d1d5db'
                                  e.currentTarget.style.color = '#6b7280'
                                  e.currentTarget.style.background = 'white'
                                }}
                              >
                                + Add action ({wellnessActions.length}/3)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Library Link */}
                    <button 
                      className={styles.libraryButton}
                      onClick={async () => {
                        await loadModalData()
                        setModalView('view-goals')
                      }}
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        marginTop: '16px',
                        background: 'transparent',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        color: '#4f46e5',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      📚 View Library (All Goals & Actions)
                    </button>
                    
                    {/* Track Baseline Button */}
                    <button 
                      className={styles.libraryButton}
                      onClick={() => openTrackBaselineModal()}
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        marginTop: '12px',
                        background: trackBaseline ? '#f0fdf4' : 'transparent',
                        border: trackBaseline ? '1px solid #86efac' : '1px solid #d1d5db',
                        borderRadius: '8px',
                        color: trackBaseline ? '#15803d' : '#4f46e5',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      🎯 {trackBaseline ? 'Edit Track Baseline' : 'Set Track Baseline'}
                    </button>
                    
                    {/* Done Button */}
                    <button 
                      className={styles.doneButton}
                      onClick={closeModal}
                    >
                      Done
                    </button>
                  </>
                )}
                
                {/* VIEW GOALS MODAL */}
                {modalView === 'view-goals' && (
                  <div className={styles.goalSelectionView}>
                    <h3 className={styles.viewTitle}>📚 Goal Library</h3>
                    <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
                      All your goals and their actions. Active goals appear at the top.
                    </p>
                    
                    {userGoals.length > 0 ? (
                      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {userGoals.map((goal) => {
                          const isExpanded = expandedGoalId === goal.id
                          const goalId = goal.coach_wellness_goals?.goal_id || goal.goal_id
                          
                          return (
                            <div 
                              key={goal.id} 
                              style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '16px',
                                marginBottom: '12px',
                                background: goal.is_active ? '#f0fdf4' : '#fff'
                              }}
                            >
                              <div 
                                style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'start', 
                                  marginBottom: '8px',
                                  cursor: 'pointer'
                                }}
                                onClick={async () => {
                                  if (isExpanded) {
                                    setExpandedGoalId(null)
                                  } else {
                                    setExpandedGoalId(goal.id)
                                    // Fetch actions for this goal
                                    if (goalId) {
                                      await fetchActionsForGoal(goalId)
                                    }
                                  }
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                                    {isExpanded ? '▼' : '▶'} {goal.coach_wellness_goals?.label || goal.label}
                                    {goal.is_active && <span style={{ marginLeft: '8px', padding: '2px 8px', background: '#10b981', color: 'white', fontSize: '12px', borderRadius: '4px' }}>Active</span>}
                                  </h4>
                                  {goal.coach_wellness_goals?.description && (
                                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                                      {goal.coach_wellness_goals.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              {/* Expandable actions section */}
                              {isExpanded && (
                                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                                    Actions ({goalActions?.length || 0}/3):
                                  </div>
                                  {goalActions && goalActions.length > 0 ? (
                                    <div>
                                      {goalActions.map((action, idx) => (
                                        <div 
                                          key={action.id || idx}
                                          style={{
                                            padding: '8px 12px',
                                            background: action.is_complete === false ? '#f0fdf4' : '#f9fafb',
                                            border: action.is_complete === false ? '1px solid #86efac' : 'none',
                                            borderRadius: '6px',
                                            marginBottom: '6px',
                                            fontSize: '13px',
                                            color: '#374151'
                                          }}
                                        >
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: '500' }}>
                                              {action.is_complete === false && (
                                                <span style={{ color: '#22c55e', marginRight: '4px', fontSize: '10px' }}>●</span>
                                              )}
                                              {action.action_text || action.title}
                                            </span>
                                          </div>
                                          {renderActionMetadata(action)}
                                        </div>
                                      ))}
                                      
                                      {/* Add action button - no limit in library */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSelectedGoalForSwap(goal)
                                          setIsFromLibrary(true) // From library view
                                          setIsSwapFlow(false) // Not a swap flow
                                          setModalView('create-action')
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '8px',
                                          marginTop: '4px',
                                          background: 'transparent',
                                          border: '1px dashed #d1d5db',
                                          borderRadius: '6px',
                                          color: '#6b7280',
                                          fontSize: '12px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        + Add action ({goalActions.length} total)
                                      </button>
                                    </div>
                                  ) : (
                                    <div>
                                      <div style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic', marginBottom: '8px' }}>
                                        No actions yet for this goal
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSelectedGoalForSwap(goal)
                                          setIsFromLibrary(true) // From library view
                                          setIsSwapFlow(false) // Not a swap flow
                                          setModalView('create-action')
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '8px',
                                          background: 'transparent',
                                          border: '1px dashed #d1d5db',
                                          borderRadius: '6px',
                                          color: '#6b7280',
                                          fontSize: '12px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        + Add first action
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className={styles.emptyState}>No goals yet. Create your first goal!</p>
                    )}
                    
                    <button 
                      className={styles.createNewGoalLink}
                      onClick={async () => {
                        await fetchCoachGoals()
                        setGeneratedGoalOptions([])  // Clear previous AI options
                        setSelectedGoalOption(null)  // Clear selection
                        setNewGoalLabel('')  // Clear custom inputs
                        setNewGoalDescription('')
                        setIsFromLibrary(true) // From library view
                        setModalView('create-goal')
                      }}
                      style={{ marginTop: '16px' }}
                    >
                      + Create a new goal
                    </button>
                    
                    <div className={styles.modalActions}>
                      <button className={styles.secondaryButton} onClick={() => setModalView('menu')}>
                        Back
                      </button>
                    </div>
                  </div>
                )}
                
                {/* CREATE GOAL MODAL */}
                {modalView === 'create-goal' && (
                  <div className={styles.createView}>
                    <h3 className={styles.viewTitle}>Create a new goal</h3>
                    
                    {/* How this works guidance */}
                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: '8px',
                      marginBottom: '20px',
                      fontSize: '13px',
                      color: '#0c4a6e'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        💡 How this works
                      </div>
                      <ul style={{ margin: '0', paddingLeft: '20px', lineHeight: '1.6' }}>
                        <li>Pick a suggested goal OR create your own</li>
                        <li>You can have up to 2 active goals at a time</li>
                        <li>Extra goals are saved to your Library</li>
                        <li>Use "AI Suggest Goals" to browse AI-generated options</li>
                      </ul>
                    </div>
                    
                    {/* Choose from existing goals */}
                    {coachGoals.length > 0 && (
                      <div className={styles.formGroup}>
                        <label>Choose from suggested goals</label>
                        <select 
                          className={styles.manageSelect}
                          value={selectedCoachGoal}
                          onChange={(e) => {
                            setSelectedCoachGoal(e.target.value)
                            // Clear custom inputs when selecting from dropdown
                            if (e.target.value) {
                              setNewGoalLabel('')
                              setNewGoalDescription('')
                            }
                          }}
                        >
                          <option value="">-- Or create your own below --</option>
                          {coachGoals
                            .filter((goal) => {
                              // Only show coach goals (those with coach_profile_id and challenge_id)
                              if (!goal.coach_profile_id || !goal.challenge_id) return false
                              // Exclude goals already added by user
                              const alreadyAdded = userGoals.some(ug => 
                                ug.coach_wellness_goals?.goal_id === goal.goal_id || 
                                ug.goal_id === goal.goal_id
                              )
                              return !alreadyAdded
                            })
                            .map((goal) => (
                              <option key={goal.goal_id} value={goal.goal_id}>
                                {goal.label}
                              </option>
                            ))}
                        </select>
                        {coachGoals.filter((goal) => {
                          if (!goal.coach_profile_id || !goal.challenge_id) return false
                          const alreadyAdded = userGoals.some(ug => 
                            ug.coach_wellness_goals?.goal_id === goal.goal_id || 
                            ug.goal_id === goal.goal_id
                          )
                          return !alreadyAdded
                        }).length === 0 && (
                          <div style={{
                            fontSize: '13px',
                            color: '#6b7280',
                            padding: '8px 12px',
                            backgroundColor: '#fef3c7',
                            border: '1px solid #fde68a',
                            borderRadius: '6px',
                            marginTop: '8px'
                          }}>
                            💡 No suggested goals loaded yet. Tap "AI Suggest Goals" below or create your own.
                          </div>
                        )}
                        {selectedCoachGoal && (
                          <small style={{ color: '#666', fontSize: '12px', marginTop: '8px', display: 'block' }}>
                            {coachGoals.find(g => g.goal_id === selectedCoachGoal)?.description}
                          </small>
                        )}
                      </div>
                    )}
                    
                    {/* Custom goal inputs */}
                    {!selectedCoachGoal && (
                      <>
                        <div className={styles.formGroup}>
                          <label>Goal Name</label>
                          <input
                            type="text"
                            value={newGoalLabel}
                            onChange={(e) => {
                              console.log('📝 Input changed to:', e.target.value)
                              setNewGoalLabel(e.target.value)
                            }}
                            placeholder="e.g., No unfiltered access"
                            className={styles.input}
                          />
                        </div>
                        
                        <div className={styles.formGroup}>
                          <label>Description (optional)</label>
                          <textarea
                            value={newGoalDescription}
                            onChange={(e) => setNewGoalDescription(e.target.value)}
                            placeholder="Describe your goal..."
                            className={styles.textarea}
                            rows={3}
                          />
                        </div>
                        
                        {/* Show generated goal options if available */}
                        {generatedGoalOptions.length > 0 && (
                          <div className={styles.goalOptionsContainer} style={{ 
                            marginTop: '20px', 
                            marginBottom: '20px',
                            padding: '15px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <div style={{ fontWeight: '500', color: '#333' }}>
                                💡 AI Generated Options (choose one):
                              </div>
                              {goalCache.totalBatches > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#666' }}>
                                  <button
                                    onClick={() => goalCache.goToPrevBatch()}
                                    disabled={!goalCache.hasPrev}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '12px',
                                      borderRadius: '4px',
                                      border: '1px solid #ddd',
                                      backgroundColor: goalCache.hasPrev ? '#fff' : '#f5f5f5',
                                      cursor: goalCache.hasPrev ? 'pointer' : 'not-allowed',
                                      color: goalCache.hasPrev ? '#333' : '#999'
                                    }}
                                  >
                                    ← Prev
                                  </button>
                                  <span style={{ fontSize: '12px', color: '#666' }}>
                                    Batch {goalCache.currentBatchIndex + 1} of {goalCache.totalBatches}
                                  </span>
                                  <button
                                    onClick={() => goalCache.goToNextBatch()}
                                    disabled={!goalCache.hasNext}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '12px',
                                      borderRadius: '4px',
                                      border: '1px solid #ddd',
                                      backgroundColor: goalCache.hasNext ? '#fff' : '#f5f5f5',
                                      cursor: goalCache.hasNext ? 'pointer' : 'not-allowed',
                                      color: goalCache.hasNext ? '#333' : '#999'
                                    }}
                                  >
                                    Next →
                                  </button>
                                </div>
                              )}
                            </div>
                            {generatedGoalOptions.map((goal, index) => (
                              <div 
                                key={index}
                                onClick={() => selectGoalOption(index)}
                                style={{
                                  padding: '12px',
                                  marginBottom: '8px',
                                  backgroundColor: selectedGoalOption === index ? '#e3f2fd' : '#fff',
                                  border: selectedGoalOption === index ? '2px solid #2196f3' : '1px solid #ddd',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'start', gap: '10px' }}>
                                  <input
                                    type="radio"
                                    name="goalOption"
                                    checked={selectedGoalOption === index}
                                    onChange={() => selectGoalOption(index)}
                                    style={{ marginTop: '2px', cursor: 'pointer' }}
                                  />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '500', color: '#333', marginBottom: '4px' }}>
                                      {goal.label}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.4' }}>
                                      {goal.description}
                                    </div>
                                    {goal.why_this_now && (
                                      <div style={{ fontSize: '12px', color: '#888', marginTop: '6px', fontStyle: 'italic' }}>
                                        Why now: {goal.why_this_now}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <button 
                          className={styles.aiSuggestButton}
                          onClick={generateGoalWithAI}
                          disabled={generatingGoal}
                        >
                          {generatingGoal ? '✨ Generating...' : (generatedGoalOptions.length > 0 ? '🔄 Generate More Options' : '✨ AI Suggest Goals')}
                        </button>
                      </>
                    )}
                    
                    <div className={styles.modalActions}>
                      <button 
                        className={styles.secondaryButton} 
                        onClick={() => setModalView(modalView === 'create-goal' && !swapType ? 'view-goals' : 'menu')}
                      >
                        Back
                      </button>
                      <button 
                        className={styles.primaryButton}
                        onClick={createCustomGoal}
                        disabled={(!selectedCoachGoal && !newGoalLabel.trim()) || savingData}
                      >
                        {savingData ? 'Creating...' : 'Create Goal'}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* SWAP GOAL SELECT MODAL */}
                {modalView === 'swap-goal-select' && (
                  <div className={styles.swapView}>
                    <h3 className={styles.viewTitle}>Swap {swapType === 'track' ? 'Track' : 'Second'} Goal</h3>
                    
                    {/* Current goal being swapped out */}
                    <div style={{ 
                      background: '#f3f4f6', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      marginBottom: '16px',
                      fontSize: '14px'
                    }}>
                      <strong>Swapping out:</strong> {swapType === 'track' ? trackGoal?.name : wellnessGoal?.name}
                      <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>
                        Your progress will be logged before switching
                      </div>
                    </div>
                    
                    <p className={styles.sectionLabel}>
                      Choose from your library or create new:
                      {swapType === 'track' && <span style={{ display: 'block', fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        Showing goals for {primaryTrack} track
                      </span>}
                    </p>
                    
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#6b7280', 
                      marginBottom: '12px',
                      padding: '10px',
                      background: '#fef3c7',
                      borderRadius: '6px',
                      border: '1px solid #fde68a'
                    }}>
                      💡 <strong>Swap =</strong> Replace your current active goal with one from your library. Your progress will be logged first.
                    </div>
                    
                    {(() => {
                      // Get all active goal IDs to exclude them
                      const activeGoalIds = []
                      if (trackGoal?.id) activeGoalIds.push(trackGoal.id)
                      if (wellnessGoal?.id) activeGoalIds.push(wellnessGoal.id)
                      
                      console.log('🔍 Swap Goal - Active goal IDs:', activeGoalIds)
                      console.log('🔍 Swap Goal - All user goals:', userGoals.length)
                      
                      const filteredGoals = userGoals.filter(goal => {
                        // Exclude currently active goals (both slots)
                        if (activeGoalIds.includes(goal.id)) {
                          console.log('❌ Excluding active goal:', goal.coach_wellness_goals?.label || goal.label)
                          return false
                        }
                        
                        // For 'track' swap, filter to same track only
                        // For 'second' swap, show ALL inactive goals (any track)
                        if (swapType === 'track') {
                          const goalChallengeId = goal.coach_wellness_goals?.challenge_id || goal.challenge_id || ''
                          const isTrackGoal = goalChallengeId.includes(primaryTrack)
                          if (!isTrackGoal) {
                            console.log('❌ Excluding wrong track goal:', goal.coach_wellness_goals?.label || goal.label)
                            return false
                          }
                        }
                        
                        console.log('✅ Including goal:', goal.coach_wellness_goals?.label || goal.label)
                        return true
                      })
                      
                      console.log('🎯 Filtered goals for swap:', filteredGoals.length)
                      
                      return filteredGoals.length > 0 ? (
                        <div className={styles.goalRadioList}>
                          {filteredGoals.map((goal) => (
                            <label 
                              key={goal.id} 
                              className={styles.goalRadioItem}
                              onClick={() => selectGoalForSwap(goal)}
                            >
                              <input type="radio" name="goal" className={styles.radio} />
                              <span className={styles.goalRadioLabel}>
                                {goal.coach_wellness_goals?.label || goal.label}
                              </span>
                              <span className={styles.goalRadioMeta}>
                                {goal.coach_wellness_goals?.description || goal.description || 'No description'}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div style={{
                          padding: '24px',
                          background: '#f9fafb',
                          borderRadius: '8px',
                          border: '1px dashed #d1d5db',
                          marginBottom: '16px',
                          textAlign: 'center'
                        }}>
                          <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 8px 0' }}>
                            📚 No other goals in your library yet
                          </p>
                          <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
                            Create one to swap in
                          </p>
                        </div>
                      )
                    })()}
                    
                    <button 
                      className={styles.createNewGoalLink}
                      onClick={async () => {
                        await fetchCoachGoals()
                        setGeneratedGoalOptions([])  // Clear previous AI options
                        setSelectedGoalOption(null)  // Clear selection
                        setModalView('create-goal')
                      }}
                    >
                      + Create a new goal
                    </button>
                    
                    <button 
                      className={styles.secondaryButton} 
                      onClick={() => setModalView('menu')}
                      style={{ width: '100%', marginTop: '1rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                
                {/* SWAP ACTIONS MODAL - Step 1: Select replacement */}
                {modalView === 'swap-actions' && selectedGoalForSwap && (
                  <div className={styles.swapView}>
                    <h3 className={styles.viewTitle}>Swap Action</h3>
                    
                    {/* Show which goal & action we're swapping */}
                    <div style={{ 
                      background: '#f0fdf4', 
                      padding: '12px 16px', 
                      borderRadius: '8px', 
                      marginBottom: '16px',
                      border: '1px solid #86efac'
                    }}>
                      <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '600', marginBottom: '4px' }}>
                        SWAPPING ACTION FOR:
                      </div>
                      <div style={{ fontSize: '15px', color: '#166534', fontWeight: '600' }}>
                        {selectedGoalForSwap.coach_wellness_goals?.label || selectedGoalForSwap.label || selectedGoalForSwap.name}
                      </div>
                      {actionToSwapOut && (
                        <div style={{ fontSize: '13px', color: '#166534', marginTop: '6px', borderTop: '1px solid #bbf7d0', paddingTop: '6px' }}>
                          Replacing: <strong>{actionToSwapOut.title || actionToSwapOut.action_text}</strong>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#6b7280', 
                      marginBottom: '12px',
                      padding: '10px',
                      background: '#fef3c7',
                      borderRadius: '6px',
                      border: '1px solid #fde68a'
                    }}>
                      💡 <strong>Step 1:</strong> Choose a replacement action from your library.
                    </div>
                    
                    {(() => {
                      const activeActions = swapType === 'track' ? trackActions : wellnessActions
                      const activeActionIds = activeActions.map(a => a.id)
                      const availableActions = goalActions.filter(action => !activeActionIds.includes(action.id))
                      
                      return availableActions.length > 0 ? (
                        <>
                          <p className={styles.sectionLabel} style={{ marginBottom: '12px' }}>
                            Choose an action from your library:
                          </p>
                          <div className={styles.actionCheckboxList}>
                            {availableActions.map((action) => {
                              const meta = action.coach_metadata || action.coachMetadata
                              return (
                                <label key={action.id} className={styles.actionCheckboxItem} style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'pointer' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input 
                                      type="radio"
                                      name="swapAction"
                                      className={styles.radio}
                                      checked={selectedActions.includes(action.id)}
                                      onChange={() => {
                                        setSelectedActions([action.id])
                                        setActionToSwapIn(action)
                                      }}
                                    />
                                    <div className={styles.actionCheckboxContent} style={{ flex: 1 }}>
                                      <span className={styles.actionCheckboxLabel}>
                                        {action.action_text || action.title}
                                      </span>
                                      {meta?.trigger_condition && (
                                        <span className={styles.actionCheckboxMeta}>
                                          🔥 {meta.trigger_condition}
                                        </span>
                                      )}
                                    </div>
                                    <span className={styles.actionDuration}>
                                      {meta?.duration_minutes ? `${meta.duration_minutes}m` : '2m'}
                                    </span>
                                  </div>
                                  {renderActionMetadata(action, { compact: true })}
                                </label>
                              )
                            })}
                          </div>
                        </>
                      ) : (
                        <div style={{
                          padding: '24px',
                          background: '#f9fafb',
                          borderRadius: '8px',
                          border: '1px dashed #d1d5db',
                          marginBottom: '16px',
                          textAlign: 'center'
                        }}>
                          <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 8px 0' }}>
                            📚 No saved actions available to swap
                          </p>
                          <p style={{ color: '#9ca3af', fontSize: '13px', margin: '0 0 16px 0' }}>
                            Create a new action to add options here
                          </p>
                          <button 
                            className={styles.primaryButton}
                            onClick={() => setModalView('create-action')}
                            style={{ padding: '10px 20px' }}
                          >
                            Create an action
                          </button>
                        </div>
                      )
                    })()}
                    
                    {(() => {
                      const activeActions = swapType === 'track' ? trackActions : wellnessActions
                      const activeActionIds = activeActions.map(a => a.id)
                      const availableActions = goalActions.filter(action => !activeActionIds.includes(action.id))
                      
                      return availableActions.length > 0 && (
                        <>
                          <button 
                            className={styles.createNewGoalLink}
                            onClick={() => setModalView('create-action')}
                            style={{ marginBottom: '12px' }}
                          >
                            + Create a new action
                          </button>
                          
                          <button 
                            className={styles.primaryButton}
                            onClick={() => {
                              if (selectedActions.length === 0) {
                                showNotification('Please select an action', 'warning')
                                return
                              }
                              // Proceed to check-in step
                              setModalView('swap-action-checkin')
                            }}
                            disabled={selectedActions.length === 0}
                            style={{ width: '100%', marginBottom: '8px' }}
                          >
                            Next →
                          </button>
                        </>
                      )
                    })()}
                    
                    <button 
                      className={styles.secondaryButton}
                      onClick={() => { resetSwapCheckIn(); setModalView('menu') }}
                      style={{ width: '100%' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* SWAP ACTION CHECK-IN - Step 2: Quick feedback on outgoing action */}
                {modalView === 'swap-action-checkin' && (
                  <div className={styles.swapView}>
                    <h3 className={styles.viewTitle}>Quick check-in</h3>
                    
                    <div style={{ 
                      background: '#f0f9ff', 
                      padding: '12px', 
                      borderRadius: '6px', 
                      marginBottom: '20px',
                      fontSize: '13px',
                      color: '#0369a1',
                      border: '1px solid #bae6fd'
                    }}>
                      📊 <strong>Before you swap</strong> — this 10-second check-in helps us learn what works for you.
                    </div>

                    {actionToSwapOut && (
                      <div style={{ 
                        background: '#f3f4f6', 
                        padding: '12px', 
                        borderRadius: '8px', 
                        marginBottom: '16px',
                        fontSize: '14px'
                      }}>
                        <strong>Swapping out:</strong> {actionToSwapOut.title || actionToSwapOut.action_text}
                      </div>
                    )}
                    
                    {/* Star Rating - required */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>How helpful was this action for your goal? <span style={{ color: '#ef4444' }}>*</span></label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                        <StarRating value={swapCheckInRating} onChange={setSwapCheckInRating} />
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                          {swapCheckInRating === 1 ? 'Not helpful' : swapCheckInRating === 2 ? 'Slightly helpful' : swapCheckInRating === 3 ? 'Helpful' : swapCheckInRating === 4 ? 'Very helpful' : 'Select rating'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Quick reason chips - optional */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Why are you swapping? (optional)</label>
                      <ReasonChips codes={ACTION_REASON_CODES} labels={ACTION_REASON_LABELS} value={swapCheckInReason} onChange={setSwapCheckInReason} />
                    </div>
                    
                    {/* Notes - optional */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>What worked / what didn't? (optional)</label>
                      <textarea
                        className={styles.textarea}
                        placeholder="e.g., This was hard to remember in the moment..."
                        rows="2"
                        maxLength={500}
                        value={swapCheckInNotes}
                        onChange={(e) => setSwapCheckInNotes(e.target.value)}
                      />
                    </div>
                    
                    <div className={styles.modalActions}>
                      <button 
                        className={styles.secondaryButton}
                        onClick={() => setModalView('swap-actions')}
                      >
                        ← Back
                      </button>
                      <button 
                        className={styles.primaryButton}
                        onClick={saveSelectedActions}
                        disabled={swapCheckInRating === 0 || savingData}
                      >
                        {savingData ? 'Swapping...' : 'Confirm Swap'}
                      </button>
                    </div>
                  </div>
                )}

                {/* SWAP GOAL CHECK-IN - Quick feedback on outgoing goal */}
                {modalView === 'swap-goal-checkin' && (
                  <div className={styles.swapView}>
                    <h3 className={styles.viewTitle}>Quick check-in</h3>
                    
                    <div style={{ 
                      background: '#f0f9ff', 
                      padding: '12px', 
                      borderRadius: '6px', 
                      marginBottom: '20px',
                      fontSize: '13px',
                      color: '#0369a1',
                      border: '1px solid #bae6fd'
                    }}>
                      📊 <strong>Before you swap</strong> — this 10-second check-in helps us learn what works for you.
                    </div>
                    
                    <div style={{ 
                      background: '#f3f4f6', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      marginBottom: '16px',
                      fontSize: '14px'
                    }}>
                      <strong>Swapping out:</strong> {swapType === 'track' ? trackGoal?.name : wellnessGoal?.name}
                      <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>
                        Replacing with: <strong>{selectedGoalForSwap?.coach_wellness_goals?.label || selectedGoalForSwap?.label || selectedGoalForSwap?.name}</strong>
                      </div>
                    </div>
                    
                    {/* Star Rating - required */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>How helpful was this goal for your recovery right now? <span style={{ color: '#ef4444' }}>*</span></label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                        <StarRating value={swapCheckInRating} onChange={setSwapCheckInRating} />
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                          {swapCheckInRating === 1 ? 'Not helpful' : swapCheckInRating === 2 ? 'Slightly helpful' : swapCheckInRating === 3 ? 'Helpful' : swapCheckInRating === 4 ? 'Very helpful' : 'Select rating'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Quick reason chips - optional */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Why are you swapping? (optional)</label>
                      <ReasonChips codes={GOAL_REASON_CODES} labels={GOAL_REASON_LABELS} value={swapCheckInReason} onChange={setSwapCheckInReason} />
                    </div>
                    
                    {/* Notes - optional */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Any thoughts on this goal? (optional)</label>
                      <textarea
                        className={styles.textarea}
                        placeholder="e.g., I completed this, time to move on..."
                        rows="2"
                        maxLength={500}
                        value={swapCheckInNotes}
                        onChange={(e) => setSwapCheckInNotes(e.target.value)}
                      />
                    </div>
                    
                    <div className={styles.modalActions}>
                      <button 
                        className={styles.secondaryButton}
                        onClick={() => { resetSwapCheckIn(); setModalView('swap-goal-select') }}
                      >
                        ← Back
                      </button>
                      <button 
                        className={styles.primaryButton}
                        onClick={() => completeGoalSwap(selectedGoalForSwap)}
                        disabled={swapCheckInRating === 0 || savingData}
                      >
                        {savingData ? 'Swapping...' : 'Confirm Swap'}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* CREATE ACTION MODAL */}
                {modalView === 'create-action' && (
                  <div className={styles.createView}>
                    <h3 className={styles.viewTitle}>Create Actions</h3>
                    
                    {/* Display goal name */}
                    {selectedGoalForSwap && (
                      <div style={{ 
                        background: '#f0fdf4', 
                        padding: '12px 16px', 
                        borderRadius: '8px', 
                        marginBottom: '16px',
                        border: '1px solid #86efac'
                      }}>
                        <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '600', marginBottom: '4px' }}>
                          CREATING ACTIONS FOR:
                        </div>
                        <div style={{ fontSize: '15px', color: '#166534', fontWeight: '600' }}>
                          {selectedGoalForSwap.coach_wellness_goals?.label || selectedGoalForSwap.label || selectedGoalForSwap.name}
                        </div>
                      </div>
                    )}
                    
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#1e40af', 
                      marginBottom: '20px',
                      padding: '12px',
                      background: '#dbeafe',
                      borderRadius: '6px',
                      border: '1px solid #93c5fd'
                    }}>
                      💪 <strong>Actions are your daily tools.</strong> Each goal can have up to 3 actions. Make them specific and achievable!
                    </div>
                    
                    {/* Manual or AI toggle */}
                    <div style={{ 
                      marginBottom: '20px',
                      padding: '16px',
                      background: '#fef9c3',
                      borderRadius: '8px',
                      border: '1px solid #fde047'
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#854d0e', marginBottom: '12px' }}>
                        ✨ Choose your approach:
                      </div>
                      <div style={{ fontSize: '13px', color: '#713f12', lineHeight: '1.6' }}>
                        • <strong>Use AI:</strong> Click "Generate Actions with AI" for personalized suggestions (costs 75 tokens)<br/>
                        • <strong>Create Manually:</strong> Type your own action in the box below
                      </div>
                    </div>
                    
                    {/* Show generated action options if available */}
                    {generatedActionOptions.length > 0 && (
                      <div className={styles.actionOptionsContainer} style={{ 
                        marginTop: '0', 
                        marginBottom: '20px',
                        padding: '16px',
                        backgroundColor: '#f0fdf4',
                        borderRadius: '8px',
                        border: '2px solid #86efac'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div style={{ 
                            fontWeight: '600', 
                            color: '#15803d',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span>💡 AI Generated Actions</span>
                            <span style={{ 
                              fontSize: '11px', 
                              background: '#dcfce7', 
                              padding: '2px 8px', 
                              borderRadius: '12px',
                              color: '#166534'
                            }}>
                              Select one or more
                            </span>
                          </div>
                          {actionCache.totalBatches > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#666' }}>
                              <button
                                onClick={() => actionCache.goToPrevBatch()}
                                disabled={!actionCache.hasPrev}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  borderRadius: '4px',
                                  border: '1px solid #ddd',
                                  backgroundColor: actionCache.hasPrev ? '#fff' : '#f5f5f5',
                                  cursor: actionCache.hasPrev ? 'pointer' : 'not-allowed',
                                  color: actionCache.hasPrev ? '#333' : '#999'
                                }}
                              >
                                ← Prev
                              </button>
                              <span style={{ fontSize: '12px', color: '#666' }}>
                                Batch {actionCache.currentBatchIndex + 1} of {actionCache.totalBatches}
                              </span>
                              <button
                                onClick={() => actionCache.goToNextBatch()}
                                disabled={!actionCache.hasNext}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  borderRadius: '4px',
                                  border: '1px solid #ddd',
                                  backgroundColor: actionCache.hasNext ? '#fff' : '#f5f5f5',
                                  cursor: actionCache.hasNext ? 'pointer' : 'not-allowed',
                                  color: actionCache.hasNext ? '#333' : '#999'
                                }}
                              >
                                Next →
                              </button>
                            </div>
                          )}
                        </div>
                        {generatedActionOptions.map((action, index) => (
                          <div 
                            key={index}
                            onClick={() => toggleAIActionOption(index)}
                            style={{
                              padding: '16px',
                              marginBottom: '12px',
                              backgroundColor: selectedActionOptions.includes(index) ? '#dcfce7' : '#fff',
                              border: selectedActionOptions.includes(index) ? '2px solid #10b981' : '1px solid #d1d5db',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                              <input
                                type="checkbox"
                                checked={selectedActionOptions.includes(index)}
                                onChange={() => {}}
                                style={{ marginTop: '4px', cursor: 'pointer', width: '18px', height: '18px', flexShrink: 0 }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '600', color: '#111827', marginBottom: '8px', fontSize: '14px', lineHeight: '1.4' }}>
                                  {action.title}
                                </div>
                                
                                {/* Mechanism + Category badges */}
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                  {action.mechanism_type && (
                                    <span style={{ 
                                      fontSize: '11px', 
                                      padding: '2px 8px', 
                                      borderRadius: '12px', 
                                      backgroundColor: '#fef3c7', 
                                      color: '#92400e',
                                      fontWeight: '600',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.5px'
                                    }}>
                                      ⚡ {action.mechanism_type.replace('_', ' ')}
                                    </span>
                                  )}
                                  <span style={{ 
                                    fontSize: '11px', 
                                    padding: '2px 8px', 
                                    borderRadius: '12px', 
                                    backgroundColor: '#dbeafe', 
                                    color: '#1e40af' 
                                  }}>
                                    ⏱️ {action.duration_minutes} min
                                  </span>
                                  <span style={{ 
                                    fontSize: '11px', 
                                    padding: '2px 8px', 
                                    borderRadius: '12px', 
                                    backgroundColor: '#f3e8ff', 
                                    color: '#6b21a8' 
                                  }}>
                                    {action.difficulty}
                                  </span>
                                  <span style={{ 
                                    fontSize: '11px', 
                                    padding: '2px 8px', 
                                    borderRadius: '12px', 
                                    backgroundColor: '#ecfdf5', 
                                    color: '#065f46' 
                                  }}>
                                    {action.category}
                                  </span>
                                </div>
                                
                                {/* Trigger condition */}
                                {action.trigger_condition && (
                                  <div style={{ fontSize: '12px', color: '#b45309', marginBottom: '6px', lineHeight: '1.5', backgroundColor: '#fffbeb', padding: '6px 10px', borderRadius: '6px' }}>
                                    <strong>🔥 Trigger:</strong> {action.trigger_condition}
                                  </div>
                                )}
                                
                                {/* Success criteria */}
                                <div style={{ fontSize: '12px', color: '#374151', marginBottom: '6px', lineHeight: '1.5' }}>
                                  <strong>✅ Success:</strong> {action.success_criteria}
                                </div>
                                
                                {/* When to do */}
                                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', lineHeight: '1.5' }}>
                                  <strong>🕐 When:</strong> {action.when_to_do}
                                </div>
                                
                                {/* Collapsible "Why this works" section */}
                                {action.ai_note && (
                                  <div style={{ marginTop: '4px' }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setExpandedAINoteIndex(expandedAINoteIndex === index ? null : index)
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: '4px 0',
                                        fontSize: '12px',
                                        color: '#6366f1',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <span style={{ transition: 'transform 0.2s', transform: expandedAINoteIndex === index ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
                                      🔍 Why this works
                                    </button>
                                    {expandedAINoteIndex === index && (
                                      <div style={{
                                        marginTop: '6px',
                                        padding: '10px 12px',
                                        backgroundColor: '#f5f3ff',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        color: '#4338ca',
                                        lineHeight: '1.6',
                                        borderLeft: '3px solid #6366f1'
                                      }}>
                                        {action.ai_note}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Fallback for old why_this field */}
                                {!action.ai_note && action.why_this && (
                                  <div style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', lineHeight: '1.5' }}>
                                    💡 {action.why_this}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div style={{ fontSize: '12px', color: '#059669', marginTop: '12px', fontStyle: 'italic' }}>
                          💡 Tip: You can select multiple actions and create them all at once
                        </div>
                      </div>
                    )}
                    
                    {/* Manual action input */}
                    {generatedActionOptions.length === 0 && (
                      <div className={styles.formGroup}>
                        <label style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px', display: 'block' }}>
                          Or type your own action:
                        </label>
                        <textarea
                          value={newActionText}
                          onChange={(e) => setNewActionText(e.target.value)}
                          placeholder="e.g., Take 3 deep breaths when urge appears"
                          className={styles.textarea}
                          rows={3}
                          style={{ fontSize: '14px' }}
                        />
                      </div>
                    )}
                    
                    <button 
                      className={styles.aiSuggestButton}
                      onClick={generateActionWithAI}
                      disabled={generatingAction}
                      style={{ 
                        width: '100%',
                        marginTop: generatedActionOptions.length > 0 ? '0' : '16px',
                        marginBottom: '16px'
                      }}
                    >
                      {generatingAction ? '✨ Generating...' : (generatedActionOptions.length > 0 ? '🔄 Generate Different Actions' : '✨ Generate Actions with AI')}
                    </button>
                    
                    {/* Baseline (optional) - lightweight create-time capture */}
                    <div style={{ 
                      padding: '16px',
                      background: '#fafafa',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      marginBottom: '16px'
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                        📊 Baseline (optional)
                      </div>
                      <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
                        <label className={styles.formLabel} style={{ fontSize: '13px' }}>Confidence to do this action this week?</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                          <StarRating value={createActionConfidence} onChange={setCreateActionConfidence} size={24} />
                          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {createActionConfidence === 1 ? 'Low' : createActionConfidence === 2 ? 'Some' : createActionConfidence === 3 ? 'Good' : createActionConfidence === 4 ? 'Very high' : 'Skip'}
                          </span>
                        </div>
                      </div>
                      <div className={styles.formGroup} style={{ marginBottom: '0' }}>
                        <label className={styles.formLabel} style={{ fontSize: '13px' }}>What might make this hard? (optional)</label>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="e.g., Remembering to do it when stressed..."
                          maxLength={200}
                          value={createActionFriction}
                          onChange={(e) => setCreateActionFriction(e.target.value)}
                          style={{ fontSize: '13px' }}
                        />
                      </div>
                    </div>
                    
                    <div className={styles.modalActions}>
                      <button 
                        className={styles.secondaryButton}
                        onClick={() => {
                          setGeneratedActionOptions([])
                          setSelectedActionOptions([])
                          setNewActionText('')
                          resetCreateBaseline()
                          setModalView('menu')
                        }}
                      >
                        Cancel
                      </button>
                      <button 
                        className={styles.primaryButton}
                        onClick={createNewAction}
                        disabled={((!newActionText.trim() && selectedActionOptions.length === 0) || savingData)}
                      >
                        {savingData ? 'Creating...' : `Create ${selectedActionOptions.length > 0 ? `(${selectedActionOptions.length})` : ''} Action${selectedActionOptions.length > 1 ? 's' : ''}`}
                      </button>
                    </div>
                  </div>
                )}
                
              </div>
            </div>
          </div>
        )}
        
        {/* Log Action Modal */}
        {showLogModal && selectedActionToLog && (
          <div className={styles.modalOverlay} onClick={() => setShowLogModal(false)}>
            <div className={styles.logModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>Log action</h2>
                <button 
                  className={styles.modalClose}
                  onClick={() => setShowLogModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div className={styles.modalContent}>
                <div className={styles.logActionTitle}>
                  {selectedActionToLog.title}
                </div>
                
                <div style={{ 
                  background: '#f0f9ff', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  marginBottom: '16px',
                  fontSize: '13px',
                  color: '#0369a1',
                  border: '1px solid #bae6fd'
                }}>
                  💡 <strong>Why log?</strong> Tracking helps you see patterns, measure progress, and understand what works for you over time.
                </div>
                
                {/* Completion Status */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>How much did you complete?</label>
                  <div className={styles.radioGroup}>
                    <label className={styles.radioOption}>
                      <input
                        type="radio"
                        name="completion"
                        value="done"
                        checked={logCompletionStatus === 'done'}
                        onChange={(e) => setLogCompletionStatus(e.target.value)}
                      />
                      <span>Done</span>
                    </label>
                    <label className={styles.radioOption}>
                      <input
                        type="radio"
                        name="completion"
                        value="partial"
                        checked={logCompletionStatus === 'partial'}
                        onChange={(e) => setLogCompletionStatus(e.target.value)}
                      />
                      <span>Partial</span>
                    </label>
                  </div>
                </div>
                
                {/* Partial completion fields */}
                {logCompletionStatus === 'partial' && (
                  <div className={styles.partialFields}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Completion percent (0-100)</label>
                      <input
                        type="number"
                        className={styles.input}
                        placeholder="e.g., 50"
                        min="0"
                        max="100"
                        value={logCompletionPercent}
                        onChange={(e) => setLogCompletionPercent(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                
                {/* Urge Before (optional) */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Urge level before? (optional, 0-10)</label>
                  <div className={styles.rangeRow}>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={logUrgeBefore || 0}
                      onChange={(e) => setLogUrgeBefore(parseInt(e.target.value))}
                      className={styles.rangeInput}
                    />
                    <span className={styles.rangeValue}>{logUrgeBefore || '—'}</span>
                  </div>
                </div>
                
                {/* Urge After (optional) */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Urge level after? (optional, 0-10)</label>
                  <div className={styles.rangeRow}>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={logUrgeAfter || 0}
                      onChange={(e) => setLogUrgeAfter(parseInt(e.target.value))}
                      className={styles.rangeInput}
                    />
                    <span className={styles.rangeValue}>{logUrgeAfter || '—'}</span>
                  </div>
                </div>
                
                {/* Context (optional) */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Where were you? (optional)</label>
                  <select
                    className={styles.input}
                    value={logContext}
                    onChange={(e) => setLogContext(e.target.value)}
                  >
                    <option value="">— Skip —</option>
                    <option value="bed">Bed</option>
                    <option value="bathroom">Bathroom</option>
                    <option value="couch">Couch</option>
                    <option value="desk">Desk</option>
                    <option value="car">Car</option>
                    <option value="outside">Outside</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                {/* Notes */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Notes (optional)</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="What did you do? How did it go?"
                    rows="3"
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                  />
                </div>
                
                {/* Action buttons */}
                <div className={styles.modalActions}>
                  <button 
                    className={styles.secondaryButton}
                    onClick={() => setShowLogModal(false)}
                    disabled={savingLog}
                  >
                    Cancel
                  </button>
                  <button 
                    className={styles.primaryButton}
                    onClick={handleSaveLog}
                    disabled={savingLog}
                  >
                    {savingLog ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Baseline Capture Modal */}
        {showBaselineModal && (
          <div className={styles.modalOverlay} onClick={() => setShowBaselineModal(false)}>
            <div className={styles.baselineModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>{baselineType === 'track' ? 'Track Baseline' : 'Goal Baseline'}</h2>
                <button 
                  className={styles.modalClose}
                  onClick={() => setShowBaselineModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div className={styles.modalContent}>
                <p className={styles.baselineSubtitle}>
                  {baselineType === 'track' 
                    ? 'Capture your porn recovery state overall. 30-60 seconds. All fields required to save.' 
                    : 'Capture where you are with this specific goal. All fields required to save.'}
                </p>
                
                <div style={{ 
                  background: '#f0fdf4', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  marginBottom: '16px',
                  fontSize: '13px',
                  color: '#166534',
                  border: '1px solid #bbf7d0'
                }}>
                  📊 <strong>Why baseline?</strong> This "before" snapshot helps you measure real progress. Track your wins over time!
                </div>
                
                {/* Validation error */}
                {baselineValidationError && (
                  <div style={{
                    background: '#fef2f2',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    fontSize: '13px',
                    color: '#991b1b',
                    border: '1px solid #fecaca'
                  }}>
                    ⚠️ {baselineValidationError}
                  </div>
                )}
                
                {/* TRACK BASELINE FORM */}
                {baselineType === 'track' && (
                  <div className={styles.baselineForm}>
                    <div className={styles.baselineGoalName}>
                      Porn Recovery Track
                    </div>
                    
                    {/* Slip frequency */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>How often did you slip in the last 30 days?</label>
                      <select
                        className={styles.input}
                        value={trackBaselineData.slip_frequency_30d}
                        onChange={(e) => setTrackBaselineData(prev => ({ ...prev, slip_frequency_30d: e.target.value }))}
                      >
                        <option value="">Select...</option>
                        <option value="none">None</option>
                        <option value="1_2">1-2 times</option>
                        <option value="weekly">About weekly</option>
                        <option value="most_days">Most days</option>
                        <option value="daily">Daily</option>
                      </select>
                    </div>
                    
                    {/* Longest streak */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Longest streak in the last 90 days?</label>
                      <select
                        className={styles.input}
                        value={trackBaselineData.longest_streak_90d}
                        onChange={(e) => setTrackBaselineData(prev => ({ ...prev, longest_streak_90d: e.target.value }))}
                      >
                        <option value="">Select...</option>
                        <option value="lt_3d">Less than 3 days</option>
                        <option value="3_7d">3-7 days</option>
                        <option value="1_3w">1-3 weeks</option>
                        <option value="1m_plus">1 month+</option>
                      </select>
                    </div>
                    
                    {/* Strongest urge time */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>When are urges strongest?</label>
                      <select
                        className={styles.input}
                        value={trackBaselineData.strongest_urge_time}
                        onChange={(e) => setTrackBaselineData(prev => ({ ...prev, strongest_urge_time: e.target.value }))}
                      >
                        <option value="">Select...</option>
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                        <option value="evening">Evening</option>
                        <option value="late_night">Late night</option>
                      </select>
                    </div>
                    
                    {/* Biggest trigger */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Biggest trigger right now?</label>
                      <select
                        className={styles.input}
                        value={trackBaselineData.biggest_trigger}
                        onChange={(e) => setTrackBaselineData(prev => ({ ...prev, biggest_trigger: e.target.value }))}
                      >
                        <option value="">Select...</option>
                        <option value="boredom">Boredom</option>
                        <option value="stress">Stress</option>
                        <option value="loneliness">Loneliness</option>
                        <option value="anxiety">Anxiety</option>
                        <option value="conflict">Conflict</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    
                    {/* Notes */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Anything else? (optional)</label>
                      <textarea
                        className={styles.textarea}
                        placeholder="e.g., trying a new approach..."
                        rows="2"
                        value={trackBaselineData.notes}
                        onChange={(e) => setTrackBaselineData(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>
                    
                    {/* Actions */}
                    <div className={styles.modalActions}>
                      <button 
                        className={styles.secondaryButton}
                        onClick={() => setShowBaselineModal(false)}
                        disabled={savingBaseline}
                      >
                        Skip
                      </button>
                      <button 
                        className={styles.primaryButton}
                        onClick={saveTrackBaseline}
                        disabled={savingBaseline}
                      >
                        {savingBaseline ? 'Saving...' : 'Save baseline'}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* GOAL BASELINE FORM */}
                {baselineType === 'goal' && (
                  <div className={styles.baselineForm}>
                    <div className={styles.baselineGoalName}>
                      {baselineGoal?.name || `Goal ${baselineSlot}`}
                    </div>
                    
                    {/* Where are you now */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Where are you with this goal right now?</label>
                      <select
                        className={styles.input}
                        value={goalBaselineData.goal_baseline_level}
                        onChange={(e) => setGoalBaselineData(prev => ({ ...prev, goal_baseline_level: e.target.value }))}
                      >
                        <option value="">Select...</option>
                        <option value="not_started">Not started yet</option>
                        <option value="inconsistent">Inconsistent / hit or miss</option>
                        <option value="some_progress">Some progress made</option>
                        <option value="mostly_consistent">Mostly consistent</option>
                      </select>
                    </div>
                    
                    {/* What gets in the way */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>What usually gets in the way? (min 3 chars)</label>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="e.g., Late night scrolling, work stress..."
                        maxLength={200}
                        value={goalBaselineData.goal_obstacle_text}
                        onChange={(e) => setGoalBaselineData(prev => ({ ...prev, goal_obstacle_text: e.target.value }))}
                      />
                    </div>
                    
                    {/* Confidence slider */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Confidence you can stick to this goal? (0-10)</label>
                      <div className={styles.rangeRow}>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          value={goalBaselineData.confidence_0_10 ?? 5}
                          onChange={(e) => setGoalBaselineData(prev => ({ ...prev, confidence_0_10: parseInt(e.target.value) }))}
                          className={styles.rangeInput}
                        />
                        <span className={styles.rangeValue}>{goalBaselineData.confidence_0_10 ?? '—'}</span>
                      </div>
                    </div>
                    
                    {/* Notes */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Anything else? (optional)</label>
                      <textarea
                        className={styles.textarea}
                        placeholder="e.g., trying a new approach..."
                        rows="2"
                        value={goalBaselineData.notes}
                        onChange={(e) => setGoalBaselineData(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>
                    
                    {/* Actions */}
                    <div className={styles.modalActions}>
                      <button 
                        className={styles.secondaryButton}
                        onClick={() => setShowBaselineModal(false)}
                        disabled={savingBaseline}
                      >
                        Skip
                      </button>
                      <button 
                        className={styles.primaryButton}
                        onClick={saveGoalBaseline}
                        disabled={savingBaseline}
                      >
                        {savingBaseline ? 'Saving...' : 'Save baseline'}
                      </button>
                    </div>
                  </div>
                )}
                
                {baselineType === 'action' && (
                  <div className={styles.baselineForm}>
                    <div className={styles.baselineGoalName}>
                      Actions for: {baselineGoal?.name || `Goal ${baselineSlot}`}
                    </div>
                    
                    {/* Select action */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Which action?</label>
                      <select
                        className={styles.input}
                        id="baselineActionSelect"
                        defaultValue=""
                      >
                        <option value="" disabled>Choose an action...</option>
                        {(baselineSlot === 1 ? trackActions : wellnessActions).map(a => (
                          <option key={a.id} value={a.id}>{a.title}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Expected minutes */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>How many minutes do you expect this to take?</label>
                      <input
                        type="number"
                        className={styles.input}
                        placeholder="e.g., 15"
                        min="1"
                        max="120"
                        value={actionBaselineData.expected_minutes}
                        onChange={(e) => setActionBaselineData(prev => ({ ...prev, expected_minutes: e.target.value }))}
                      />
                    </div>
                    
                    {/* Difficulty */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>How hard does this feel? (1 = easy, 5 = very hard)</label>
                      <select
                        className={styles.input}
                        value={actionBaselineData.difficulty_1_5}
                        onChange={(e) => setActionBaselineData(prev => ({ ...prev, difficulty_1_5: e.target.value }))}
                      >
                        <option value="" disabled>Select...</option>
                        <option value="1">1 – Easy</option>
                        <option value="2">2 – Mild</option>
                        <option value="3">3 – Moderate</option>
                        <option value="4">4 – Hard</option>
                        <option value="5">5 – Very hard</option>
                      </select>
                    </div>
                    
                    {/* Target per week */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>How many times per week do you plan to do this?</label>
                      <input
                        type="number"
                        className={styles.input}
                        placeholder="e.g., 5"
                        min="1"
                        max="7"
                        value={actionBaselineData.target_per_week}
                        onChange={(e) => setActionBaselineData(prev => ({ ...prev, target_per_week: e.target.value }))}
                      />
                    </div>
                    
                    {/* Notes */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Notes (optional)</label>
                      <textarea
                        className={styles.textarea}
                        placeholder="Any context for this action..."
                        rows="2"
                        value={actionBaselineData.notes}
                        onChange={(e) => setActionBaselineData(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>
                    
                    {/* Actions */}
                    <div className={styles.modalActions}>
                      <button 
                        className={styles.secondaryButton}
                        onClick={() => setShowBaselineModal(false)}
                        disabled={savingBaseline}
                      >
                        Skip
                      </button>
                      <button 
                        className={styles.primaryButton}
                        onClick={() => {
                          const sel = document.getElementById('baselineActionSelect')
                          saveActionBaseline(sel?.value || null)
                        }}
                        disabled={savingBaseline}
                      >
                        {savingBaseline ? 'Saving...' : 'Save baseline'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
