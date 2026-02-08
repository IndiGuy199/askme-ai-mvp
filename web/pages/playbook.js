import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import { supabase } from '../utils/supabaseClient'
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
  
  // Modal workflow state
  const [modalView, setModalView] = useState('menu') // 'menu', 'view-goals', 'create-goal', 'swap-goal-select', 'swap-actions', 'create-action'
  const [selectedChallenge, setSelectedChallenge] = useState(null)
  const [selectedGoalForActions, setSelectedGoalForActions] = useState(null)
  const [selectedGoalForSwap, setSelectedGoalForSwap] = useState(null)
  const [swapType, setSwapType] = useState(null) // 'track' or 'second'
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

      // Get action completions to determine status
      const { data: completions, error: completionsError } = await supabase
        .from('action_completions')
        .select('*')
        .eq('user_id', userId)

      if (completionsError) throw completionsError

      // Transform action_plans to match the expected format
      const transformAction = (action) => {
        const completion = completions?.find(c => c.action_id === action.id)
        const isTrackGoal = trackGoalId && action.goal_id === trackGoalId
        const isWellnessGoal = wellnessGoalId && action.goal_id === wellnessGoalId
        return {
          id: action.id,
          title: action.action_text,
          durationSeconds: 120, // Default 2 minutes
          status: completion ? 'completed' : 'not_started',
          goalType: isTrackGoal
            ? 'track'
            : isWellnessGoal
              ? 'second'
              : (action.goal_id?.includes('porn') || action.goal_id?.includes('sex') || action.goal_id?.includes('food') ? 'track' : 'second')
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

    } catch (error) {
      console.error('Error fetching actions:', error)
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
      alert('Failed to mark action as complete. Please try again.')
    } finally {
      setUpdatingAction(null)
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
      alert('Challenge added successfully!')
    } catch (error) {
      console.error('Error adding challenge:', error)
      alert(error.message || 'Failed to add challenge')
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
      alert('Goal added successfully!')
    } catch (error) {
      console.error('Error adding goal:', error)
      alert(error.message || 'Failed to add goal')
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
      alert('Please select a goal or enter a custom goal name')
      return
    }

    if (!swapType && userGoals.length >= 2) {
      alert('You can keep 2 active goals. Extra goals live in the Library.')
      return
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
      alert('No challenge found. Please contact support.')
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
      
      // Reset and go back
      setNewGoalLabel('')
      setNewGoalDescription('')
      setSelectedCoachGoal('')
      setGeneratedGoalOptions([])  // Clear AI-generated options
      setSelectedGoalOption(null)  // Clear selection
      await loadModalData()
      if (selectedChallenge) {
        await fetchGoalsForChallenge(selectedChallenge.coach_challenges?.challenge_id)
      }
      setModalView('view-goals')
      alert('Goal created successfully!')
    } catch (error) {
      console.error('Error creating goal:', error)
      alert(error.message || 'Failed to create goal')
    } finally {
      setSavingData(false)
    }
  }
  
  // Create new action(s)
  const createNewAction = async () => {
    // Use either selectedGoalForActions or selectedGoalForSwap
    const goalToUse = selectedGoalForActions || selectedGoalForSwap
    const hasSelectedAI = selectedActionOptions.length > 0 && generatedActionOptions.length > 0
    const actionTexts = hasSelectedAI
      ? selectedActionOptions
          .map(index => generatedActionOptions[index]?.title)
          .filter(Boolean)
      : [newActionText.trim()].filter(Boolean)

    const existingCount = goalActions.length
    if (existingCount + actionTexts.length > 3) {
      alert('Each goal can have up to 3 actions. Please swap an action instead.')
      return
    }
    
    if (!user?.email || actionTexts.length === 0 || !goalToUse) {
      console.log('❌ Cannot create action:', {
        hasEmail: !!user?.email,
        actionCount: actionTexts.length,
        hasGoal: !!goalToUse
      })
      alert('Please select or enter at least one action')
      return
    }
    
    console.log('🎯 Creating actions with goal:', goalToUse)
    
    setSavingData(true)
    try {
      const goalId = goalToUse.coach_wellness_goals?.goal_id || goalToUse.goal_id
      const goalDbId = goalToUse.coach_wellness_goals?.id || goalToUse.id
      
      console.log('📤 Sending action create requests:', {
        goalId,
        goalDbId,
        actionCount: actionTexts.length
      })
      
      for (const actionText of actionTexts) {
        const response = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            goalId: goalId,
            challengeId: goalToUse.coach_wellness_goals?.challenge_id || goalToUse.challenge_id || null,
            actionText: actionText
          })
        })
        
        const data = await response.json()
        console.log('📥 Action create response:', data)
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create action')
        }
      }
      
      // Reset and refresh
      setNewActionText('')
      setGeneratedActionOptions([])
      setSelectedActionOptions([])
      
      // Fetch updated actions for the goal using goal_id
      if (goalId) {
        await fetchActionsForGoal(goalId)
      }
      
      // Refresh main page actions too
      if (userData?.id) {
        await fetchActionsForGoals(userData.id, trackGoal?.goal_id, wellnessGoal?.goal_id)
      }
      
      // Navigate back to actions view
      setModalView('swap-actions')
      alert(`Created ${actionTexts.length} action${actionTexts.length > 1 ? 's' : ''} successfully!`)
    } catch (error) {
      console.error('❌ Error creating action:', error)
      alert(error.message || 'Failed to create action')
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
      alert(error.message || 'Failed to delete action')
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
  const openSwapActionModal = async (type) => {
    setSwapType(type)
    await loadModalData()
    await fetchCoachGoals()
    
    // If user has goals, show goal selection
    if (userGoals.length > 0) {
      setModalView('swap-goal-select')
    } else {
      // No goals, go directly to create goal
      setModalView('create-goal')
    }
  }
  
  // Select goal for swapping actions
  const selectGoalForSwap = async (goal) => {
    console.log('🎯 Selecting goal for swap:', goal)
    setSelectedGoalForSwap(goal)
    
    // Use goal_id field (not database UUID) for querying actions
    const goalId = goal.coach_wellness_goals?.goal_id || goal.goal_id
    console.log('📥 Fetching actions for goal_id:', goalId)
    
    await fetchActionsForGoal(goalId)
    
    // Note: We can't check goalActions.length here because state updates are async
    // Instead, always go to swap-actions view and let the UI handle empty state
    setModalView('swap-actions')
  }
  
  // Complete the goal swap by deactivating old goal and activating new one
  const completeGoalSwap = async (newGoal) => {
    if (!user?.email || !swapType) return
    
    setSavingData(true)
    try {
      const currentGoal = swapType === 'track' ? trackGoal : wellnessGoal
      
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
        // Fetch actions for new track goal
        if (userData?.id) {
          await fetchActionsForGoals(userData.id, goalData.goal_id, wellnessGoal?.goal_id)
        }
      } else {
        setWellnessGoal(goalData)
        // Fetch actions for new second goal
        if (userData?.id) {
          await fetchActionsForGoals(userData.id, trackGoal?.goal_id, goalData.goal_id)
        }
      }
      
      closeModal()
      alert('Goal swapped successfully!')
    } catch (error) {
      console.error('Error swapping goal:', error)
      alert(error.message || 'Failed to swap goal')
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
      
      // Clear from local state
      setWellnessGoal(null)
      setWellnessActions([])
      
      // Reload data
      await loadModalData()
      
      alert('Goal moved to Library!')
    } catch (error) {
      console.error('Error removing goal:', error)
      alert(error.message || 'Failed to remove goal')
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
      alert('Please select at least one action')
      return
    }
    
    setSavingData(true)
    try {
      // If we're swapping goals, complete the goal swap first
      if (swapType && selectedGoalForSwap) {
        await completeGoalSwap(selectedGoalForSwap)
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
      
      closeModal()
      const message = swapType 
        ? 'Goal swapped and actions updated successfully!' 
        : `${selectedActions.length} action(s) updated successfully!`
      alert(message)
    } catch (error) {
      console.error('Error saving actions:', error)
      alert('Failed to save actions')
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
          email: user.email
        })
      })
      
      const data = await response.json()
      
      console.log('✅ Coach AI Response:', data)
      
      if (response.ok && data.goals && data.goals.length > 0) {
        // Store all generated goal options
        console.log(`🎯 Received ${data.goals.length} goal options from Coach AI`)
        setGeneratedGoalOptions(data.goals)
        // Auto-select the first one, but user can change
        setSelectedGoalOption(0)
        setNewGoalLabel(data.goals[0].label)
        setNewGoalDescription(data.goals[0].description || '')
        console.log(`💰 Tokens used: ${data.tokens_used}, Remaining: ${data.tokens_remaining}`)
      } else {
        console.error('❌ Coach AI response not ok:', data)
        alert(data.error || 'Failed to generate goal. Please try again.')
      }
    } catch (error) {
      console.error('❌ Error generating goal:', error)
      alert('Failed to generate goal. Please try again.')
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
      
      const requestBody = {
        email: user.email,
        goalLabel: goalLabel,
        goalDescription: goalDescription
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
        // Store all generated action options
        console.log(`🎯 Received ${data.actions.length} action options from Coach AI`)
        setGeneratedActionOptions(data.actions)
        // Auto-select the first one
        setSelectedActionOptions([0])
        setNewActionText(data.actions[0].title)
        console.log(`💰 Tokens used: ${data.tokens_used}, Remaining: ${data.tokens_remaining}`)
      } else {
        console.error('❌ Coach AI response not ok:', data)
        alert(data.error || 'Failed to generate action. Please try again.')
      }
    } catch (error) {
      console.error('❌ Error generating action:', error)
      alert('Failed to generate action. Please try again.')
    } finally {
      setGeneratingAction(false)
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
                Toggle between your two active goals. Top 3 actions shown.
              </p>

              {/* Tab Toggle */}
              <div className={styles.tabContainer}>
                <button
                  className={`${styles.tab} ${selectedTab === 'track' ? styles.tabActive : ''}`}
                  onClick={() => setSelectedTab('track')}
                >
                  {trackGoal?.name || getTrackLabel()}
                </button>
                <button
                  className={`${styles.tab} ${selectedTab === 'second' ? styles.tabActive : ''}`}
                  onClick={() => setSelectedTab('second')}
                >
                  {wellnessGoal?.goal_id ? wellnessGoal?.name : '+ Add second goal'}
                </button>
              </div>

              {/* Action List */}
              <div className={styles.actionList}>
                {selectedTab === 'second' && !wellnessGoal?.goal_id ? (
                  <div className={styles.emptyState}>
                    <p>Add a second goal to unlock more actions.</p>
                    <button className={styles.secondaryButton} onClick={openManageModal}>
                      Add second goal
                    </button>
                  </div>
                ) : currentActions.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No actions yet. Add up to 3 for this goal.</p>
                    <button className={styles.secondaryButton} onClick={openManageModal}>
                      {currentActions.length < 3 ? 'Add action' : 'Swap action'}
                    </button>
                  </div>
                ) : (
                  currentActions.map((action) => (
                    <div key={action.id} className={styles.actionRow}>
                      <input
                        type="checkbox"
                        checked={action.status === 'completed'}
                        readOnly
                        className={styles.actionCheckbox}
                      />
                      <div className={styles.actionContent}>
                        <span className={styles.actionTitle}>{action.title}</span>
                        <span className={styles.actionLabel}>
                          {currentGoal?.name || 'Goal'}
                        </span>
                      </div>
                      <span className={styles.durationPill}>
                        {Math.floor(action.durationSeconds / 60)}m
                      </span>
                      <button
                        className={`${styles.actionButton} ${
                          action.status === 'completed' ? styles.actionButtonDone : ''
                        }`}
                        onClick={() => 
                          action.status === 'completed' 
                            ? null 
                            : action.status === 'not_started'
                              ? handleStartAction(action)
                              : handleCompleteAction(action)
                        }
                      >
                        {action.status === 'completed' ? 'Done' : 'Start'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className={styles.rightColumn}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Weekly patterns</h2>
              <p className={styles.patternsSubtitle}>3 quick insights (opt-in)</p>
              <ul className={styles.patternList}>
                <li className={styles.patternItem}>
                  <span className={styles.patternBullet}>•</span>
                  <span>Risk window: 10:30pm-12:30am</span>
                </li>
                <li className={styles.patternItem}>
                  <span className={styles.patternBullet}>•</span>
                  <span>Best tool: 5-min reset when intensity &gt; 7</span>
                </li>
                <li className={styles.patternItem}>
                  <span className={styles.patternBullet}>•</span>
                  <span>Best lever: phone charges outside bedroom</span>
                </li>
              </ul>

              <button className={styles.applyPlanButton}>
                Apply next-week plan (600)
              </button>
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
                {/* MAIN MENU */}
                {modalView === 'menu' && (
                  <>
                    <p className={styles.modalSubtitle}>Manage your recovery goals and actions</p>
                    
                    {/* Menu Items */}
                    <div className={styles.menuList}>
                  
                  {/* Section 1: Primary Track */}
                  <div className={styles.menuSection}>
                    <h4 className={styles.menuSectionTitle}>Primary Track</h4>
                    <div className={styles.menuItem}>
                      <div className={styles.menuItemContent}>
                        <h3 className={styles.menuItemTitle}>Switch Track</h3>
                        <p className={styles.menuItemDesc}>Porn / Sex / Food (weekly focus)</p>
                        <select 
                          value={primaryTrack}
                          onChange={(e) => savePrimaryTrack(e.target.value)}
                          className={styles.manageSelect}
                        >
                          <option value="porn">Porn Recovery</option>
                          <option value="sex">Sexual Health</option>
                          <option value="food">Food & Eating</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Section 2: Active Goals (2 slots) */}
                  <div className={styles.menuSection}>
                    <h4 className={styles.menuSectionTitle}>Active Goals (2 slots)</h4>
                    
                    {/* Slot 1: Track Goal */}
                    <div className={styles.menuItem}>
                      <div className={styles.menuItemContent}>
                        <h3 className={styles.menuItemTitle}>
                          Goal 1: {trackGoal?.name || getTrackLabel()}
                        </h3>
                        <p className={styles.menuItemDesc}>Track goal (tied to {primaryTrack})</p>
                      </div>
                      <button 
                        className={styles.menuItemAction}
                        onClick={() => {
                          setSwapType('track')
                          setModalView('swap-goal-select')
                        }}
                      >
                        Swap Goal
                      </button>
                    </div>
                    
                    {/* Slot 2: Second Goal */}
                    <div className={styles.menuItem}>
                      <div className={styles.menuItemContent}>
                        <h3 className={styles.menuItemTitle}>
                          Goal 2: {wellnessGoal?.name || 'No second goal'}
                        </h3>
                        <p className={styles.menuItemDesc}>Optional recovery goal</p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {wellnessGoal?.goal_id ? (
                          <>
                            <button 
                              className={styles.menuItemAction}
                              onClick={() => {
                                setSwapType('second')
                                setModalView('swap-goal-select')
                              }}
                            >
                              Swap Goal
                            </button>
                            <button 
                              className={styles.menuItemAction}
                              onClick={() => removeGoal(wellnessGoal.id)}
                              style={{ backgroundColor: '#dc3545' }}
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <button 
                            className={styles.menuItemAction}
                            onClick={async () => {
                              await fetchCoachGoals()
                              setGeneratedGoalOptions([])
                              setSelectedGoalOption(null)
                              setNewGoalLabel('')
                              setNewGoalDescription('')
                              setModalView('create-goal')
                            }}
                          >
                            Add Goal
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Section 3: Actions per Goal */}
                  <div className={styles.menuSection}>
                    <h4 className={styles.menuSectionTitle}>Actions (up to 3 per goal)</h4>
                    
                    {/* Track Goal Actions */}
                    {trackGoal?.goal_id && (
                      <div className={styles.menuItem}>
                        <div className={styles.menuItemContent}>
                          <h3 className={styles.menuItemTitle}>
                            {trackGoal?.name} Actions
                          </h3>
                          <p className={styles.menuItemDesc}>
                            {trackActions.length} of 3 actions
                          </p>
                        </div>
                        <button 
                          className={styles.menuItemAction}
                          onClick={() => openSwapActionModal('track')}
                        >
                          {trackActions.length < 3 ? 'Add Action' : 'Swap Action'}
                        </button>
                      </div>
                    )}
                    
                    {/* Second Goal Actions */}
                    {wellnessGoal?.goal_id && (
                      <div className={styles.menuItem}>
                        <div className={styles.menuItemContent}>
                          <h3 className={styles.menuItemTitle}>
                            {wellnessGoal?.name} Actions
                          </h3>
                          <p className={styles.menuItemDesc}>
                            {wellnessActions.length} of 3 actions
                          </p>
                        </div>
                        <button 
                          className={styles.menuItemAction}
                          onClick={() => openSwapActionModal('second')}
                        >
                          {wellnessActions.length < 3 ? 'Add Action' : 'Swap Action'}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Section 4: Library */}
                  <div className={styles.menuSection}>
                    <h4 className={styles.menuSectionTitle}>Library</h4>
                    <button 
                      className={styles.menuItem}
                      onClick={() => router.push('/library')}
                    >
                      <div className={styles.menuItemContent}>
                        <h3 className={styles.menuItemTitle}>Open Library</h3>
                        <p className={styles.menuItemDesc}>Browse saved goals & actions</p>
                      </div>
                    </button>
                  </div>
                  
                </div>
                
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
                    <h3 className={styles.viewTitle}>View Your Goals</h3>
                    
                    <div className={styles.formGroup}>
                      <label>Select a Goal</label>
                      {userGoals.length > 0 ? (
                        <select 
                          className={styles.manageSelect}
                          defaultValue=""
                        >
                          <option value="" disabled>Choose a goal...</option>
                          {userGoals.map((goal) => (
                            <option key={goal.id} value={goal.id}>
                              {goal.coach_wellness_goals?.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className={styles.emptyState}>No goals yet. Create your first goal!</p>
                      )}
                    </div>
                    
                    <button 
                      className={styles.createNewGoalLink}
                      onClick={async () => {
                        await fetchCoachGoals()
                        setGeneratedGoalOptions([])  // Clear previous AI options
                        setSelectedGoalOption(null)  // Clear selection
                        setNewGoalLabel('')  // Clear custom inputs
                        setNewGoalDescription('')
                        setModalView('create-goal')
                      }}
                    >
                      + Create a new goal
                    </button>
                    
                    <div className={styles.modalActions}>
                      <button className={styles.secondaryButton} onClick={() => setModalView('menu')}>
                        Back
                      </button>
                      <button 
                        className={styles.primaryButton}
                        onClick={() => router.push('/dashboard')}
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}
                
                {/* CREATE GOAL MODAL */}
                {modalView === 'create-goal' && (
                  <div className={styles.createView}>
                    <h3 className={styles.viewTitle}>Create a new goal</h3>
                    
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
                          {coachGoals.map((goal) => (
                            <option key={goal.goal_id} value={goal.goal_id}>
                              {goal.label}
                            </option>
                          ))}
                        </select>
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
                            <div style={{ marginBottom: '12px', fontWeight: '500', color: '#333' }}>
                              💡 AI Generated Options (choose one):
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
                    <h3 className={styles.viewTitle}>Swap Today's Goal</h3>
                    
                    <div className={styles.tabGroup}>
                      <button 
                        className={`${styles.tabButton} ${swapType === 'track' ? styles.tabActive : ''}`}
                        onClick={() => setSwapType('track')}
                      >
                        Track goal
                      </button>
                      <button 
                        className={`${styles.tabButton} ${swapType === 'second' ? styles.tabActive : ''}`}
                        onClick={() => setSwapType('second')}
                      >
                        Second goal
                      </button>
                    </div>
                    
                    <p className={styles.sectionLabel}>
                      Which goal fits best today?
                      {swapType === 'track' && <span style={{ display: 'block', fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        Showing goals for {primaryTrack} track
                      </span>}
                    </p>
                    
                    <div className={styles.goalRadioList}>
                      {userGoals
                        .filter(goal => {
                          if (!swapType) return true // Show all if no swap type
                          const goalChallengeId = goal.coach_wellness_goals?.challenge_id || goal.challenge_id || ''
                          const isTrackGoal = goalChallengeId.includes(primaryTrack)
                          return swapType === 'track' ? isTrackGoal : !isTrackGoal
                        })
                        .map((goal) => (
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
                            {Math.floor(Math.random() * 5)} min reset at midday / {Math.floor(Math.random() * 10)}xn
                          </span>
                        </label>
                      ))}
                    </div>
                    
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
                
                {/* SWAP ACTIONS MODAL */}
                {modalView === 'swap-actions' && selectedGoalForSwap && (
                  <div className={styles.swapView}>
                    <h3 className={styles.viewTitle}>Create (or choose) related Actions</h3>
                    
                    <p className={styles.instructionText}>
                      Select up to 3 actions to focus on this week.
                    </p>
                    <p className={styles.helperText}>
                      Tap + to add. Tap existing to edit. All save to their 1st from our their goal.
                    </p>
                    
                    <div className={styles.actionButtons}>
                      <button className={styles.outlineButton}>
                        Select from Library
                      </button>
                      <button 
                        className={styles.outlineButton}
                        onClick={() => setModalView('create-action')}
                      >
                        Create new action
                      </button>
                    </div>
                    
                    <div className={styles.searchBox}>
                      <span className={styles.searchIcon}>🔍</span>
                      <input 
                        type="text" 
                        placeholder="Search library..."
                        className={styles.searchInput}
                      />
                    </div>
                    
                    <div className={styles.actionCheckboxList}>
                      {goalActions.map((action) => (
                        <label key={action.id} className={styles.actionCheckboxItem}>
                          <input 
                            type="checkbox"
                            className={styles.checkbox}
                            checked={selectedActions.includes(action.id)}
                            onChange={() => toggleActionSelection(action.id)}
                            disabled={!selectedActions.includes(action.id) && selectedActions.length >= 3}
                          />
                          <div className={styles.actionCheckboxContent}>
                            <span className={styles.actionCheckboxLabel}>
                              {action.action_text}
                            </span>
                            <span className={styles.actionCheckboxMeta}>
                              Linked to: Improval Library · 2 min reset nor in varned stt.
                            </span>
                          </div>
                          <span className={styles.actionDuration}>2m</span>
                        </label>
                      ))}
                    </div>
                    
                    <button 
                      className={styles.primaryButton}
                      onClick={saveSelectedActions}
                      disabled={selectedActions.length === 0 || savingData}
                      style={{ width: '100%', marginTop: '1rem' }}
                    >
                      {savingData ? 'Saving...' : `Save ${selectedActions.length} action${selectedActions.length !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                )}
                
                {/* CREATE ACTION MODAL */}
                {modalView === 'create-action' && (
                  <div className={styles.createView}>
                    <h3 className={styles.viewTitle}>Create a new action</h3>
                    
                    <div className={styles.formGroup}>
                      <label>Action Description</label>
                      <textarea
                        value={newActionText}
                        onChange={(e) => setNewActionText(e.target.value)}
                        placeholder="e.g., Enable Focus mode on phone for 2 hours"
                        className={styles.textarea}
                        rows={4}
                      />
                    </div>
                    
                    {/* Show generated action options if available */}
                    {generatedActionOptions.length > 0 && (
                      <div className={styles.actionOptionsContainer} style={{ 
                        marginTop: '20px', 
                        marginBottom: '20px',
                        padding: '15px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <div style={{ marginBottom: '12px', fontWeight: '500', color: '#333' }}>
                          💡 AI Generated Actions (select one or more):
                        </div>
                        {generatedActionOptions.map((action, index) => (
                          <div 
                            key={index}
                            style={{
                              padding: '12px',
                              marginBottom: '8px',
                              backgroundColor: selectedActionOptions.includes(index) ? '#e3f2fd' : '#fff',
                              border: selectedActionOptions.includes(index) ? '2px solid #2196f3' : '1px solid #ddd',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'start', gap: '10px' }}>
                              <input
                                type="checkbox"
                                checked={selectedActionOptions.includes(index)}
                                onChange={() => toggleAIActionOption(index)}
                                style={{ marginTop: '2px', cursor: 'pointer' }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '500', color: '#333', marginBottom: '4px' }}>
                                  {action.title}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                                  ⏱️ {action.duration_minutes} min • {action.difficulty} • {action.category}
                                </div>
                                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                                  ✅ Success: {action.success_criteria}
                                </div>
                                <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
                                  When: {action.when_to_do}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <button 
                      className={styles.aiSuggestButton}
                      onClick={generateActionWithAI}
                      disabled={generatingAction}
                    >
                      {generatingAction ? '✨ Generating...' : (generatedActionOptions.length > 0 ? '🔄 Generate More Actions' : '✨ AI Suggest Actions')}
                    </button>
                    
                    <div className={styles.modalActions}>
                      <button 
                        className={styles.secondaryButton}
                        onClick={() => setModalView(goalActions.length > 0 ? 'swap-actions' : 'swap-goal-select')}
                      >
                        Back
                      </button>
                      <button 
                        className={styles.primaryButton}
                        onClick={createNewAction}
                        disabled={((!newActionText.trim() && selectedActionOptions.length === 0) || savingData)}
                      >
                        {savingData ? 'Creating...' : 'Create Action'}
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
