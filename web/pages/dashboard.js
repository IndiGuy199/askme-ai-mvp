import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { supabase } from '../utils/supabaseClient'
import Link from 'next/link'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [challengesWithGoals, setChallengesWithGoals] = useState([])
  const [activeTab, setActiveTab] = useState('challenges')
  const [progress, setProgress] = useState([])
  const [actionPlans, setActionPlans] = useState([])
  const [suggestingGoal, setSuggestingGoal] = useState(null)
  const [recentAchievement, setRecentAchievement] = useState(null)
  const [expandedChallenges, setExpandedChallenges] = useState(new Set())
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [showGoalSelectionModal, setShowGoalSelectionModal] = useState(false)
  const [selectedChallengeForGoal, setSelectedChallengeForGoal] = useState(null)
  const [availableGoals, setAvailableGoals] = useState([])
  const [availableChallenges, setAvailableChallenges] = useState([])
  const [newGoalLabel, setNewGoalLabel] = useState('')
  const [newGoalDescription, setNewGoalDescription] = useState('')
  const [creatingGoal, setCreatingGoal] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [selectedProgressItem, setSelectedProgressItem] = useState(null)
  const [newProgressPercent, setNewProgressPercent] = useState(0)
  const [progressType, setProgressType] = useState('goal') // 'goal' or 'challenge'
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [aiSuggestedGoals, setAiSuggestedGoals] = useState([])
  const [updatingProgress, setUpdatingProgress] = useState(false)
  const router = useRouter()
  // Toast notification function
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000)
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
        
        if (mounted) {
          try {
            await Promise.all([
              fetchUserData(session.user.email),
              fetchChallengesWithGoals(session.user.email),
              fetchAvailableGoals(),
              fetchAvailableChallenges()
            ])
          } catch (dataError) {
            console.error('Error fetching initial data:', dataError)
            setLoading(false)
          }
        }
      } catch (error) {
        console.error('Error in getSession:', error)
        if (mounted) setLoading(false)      }
    }
    
    getSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      
      console.log('Auth state change event:', event, 'Session exists:', !!session)
      
      try {
        if (!session) {
          router.push('/login')
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Only fetch data on sign in or token refresh, not on every auth change
          setUser(session.user)
          if (mounted) {
            Promise.all([
              fetchUserData(session.user.email),
              fetchChallengesWithGoals(session.user.email),
              fetchAvailableGoals(),
              fetchAvailableChallenges()
            ]).catch(authError => {
              console.error('Error in auth state change:', authError)
              if (mounted) setLoading(false)
            })
          }        } else {
          // Just update the user without refetching data
          setUser(session.user)
        }
      } catch (authError) {
        console.error('Error in auth state change:', authError)
        if (mounted) setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // Remove router dependency
  
  const fetchUserData = async (email) => {
    try {      setLoading(true)
      console.log('Fetching user data for:', email)
      const response = await fetch(`/api/gptRouter?email=${encodeURIComponent(email)}`)
      const data = await response.json()
      
      if (response.ok) {
        console.log('User data fetched successfully:', data.id)
        setUserData(data)
        await Promise.all([
          fetchProgress(data.id),
          fetchActionPlans(data.id)
        ])
      } else {
        console.error('Failed to fetch user data:', data)
        throw new Error(data.error || 'Failed to fetch user data')
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
      showToast('Failed to load user data. Please refresh the page.', 'error')    } finally {
      setLoading(false)
    }
  }
  
  const fetchChallengesWithGoals = async (email) => {
    try {
      const response = await fetch(`/api/challenges-with-goals?email=${encodeURIComponent(email)}`)
      const data = await response.json()
      
      if (response.ok) {
        setChallengesWithGoals(data.challengesWithGoals || [])
      } else {
        console.error('Failed to fetch challenges with goals:', data)
        throw new Error(data.error || 'Failed to fetch challenges with goals')
      }
    } catch (error) {
      console.error('Error fetching challenges with goals:', error)
      showToast('Failed to load challenges and goals.', 'error')
    }
  }
    const fetchAvailableGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('coach_wellness_goals')
        .select('*')
        .order('label')
        
      if (error) throw error
      setAvailableGoals(data || [])
    } catch (error) {
      console.error('Error fetching available goals:', error)
    }
  }
  
  const fetchAvailableChallenges = async () => {
    try {
      const { data, error } = await supabase
        .from('coach_challenges')
        .select('*')
        .order('label')
        
      if (error) throw error
      setAvailableChallenges(data || [])
    } catch (error) {
      console.error('Error fetching available challenges:', error)
    }
  }
  
  // Helper function to toggle challenge expansion
  const toggleChallengeExpansion = (challengeId) => {
    setExpandedChallenges(prev => {
      const newSet = new Set(prev)
      if (newSet.has(challengeId)) {
        newSet.delete(challengeId)
      } else {
        newSet.add(challengeId)
      }
      return newSet
    })
  }
    // Helper function to open goal creation modal for a specific challenge
  const openGoalModalForChallenge = (challengeId) => {
    setSelectedChallengeForGoal(challengeId)
    setShowGoalSelectionModal(true)
  }
  
  // Helper function to check if user already has a challenge
  const userHasChallenge = (challengeId) => {
    return challengesWithGoals.some(userChallenge => 
      userChallenge.coach_challenges?.challenge_id === challengeId
    )
  }
  
  const addGoalToUser = async (goalId) => {
    try {
      setCreatingGoal(true)
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          goalId: goalId,
          challengeId: selectedChallengeForGoal        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add goal')
      }
      
      // Close modal first
      setShowGoalSelectionModal(false)
      setSelectedChallengeForGoal(null)
      
      // Refresh the challenges with goals data
      await fetchChallengesWithGoals(user.email)
      await fetchProgress(userData.id)
      showToast('Goal added successfully! 🎯')
    } catch (error) {
      console.error('Error adding goal:', error)
      setShowGoalSelectionModal(false)
      setSelectedChallengeForGoal(null)
      showToast(error.message || 'Failed to add goal', 'error')
    } finally {
      setCreatingGoal(false)
    }
  }
  
  const createCustomGoal = async () => {
    if (!newGoalLabel.trim()) {
      alert('Please enter a goal title')
      return
    }
    
    if (!selectedChallengeForGoal) {
      alert('Please select a challenge for this goal')
      return
    }
    
    try {
      setCreatingGoal(true)
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          goalData: {
            label: newGoalLabel.trim(),
            description: newGoalDescription.trim() || newGoalLabel.trim(),
            category: 'Custom',
            challengeId: selectedChallengeForGoal
          }
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create goal')
      }
      
      // Refresh challenges with goals
      await fetchChallengesWithGoals(user.email)
      await fetchProgress(userData.id)
      setShowGoalSelectionModal(false)
      setSelectedChallengeForGoal(null)
      setNewGoalLabel('')
      setNewGoalDescription('')
      showToast('Custom goal created successfully! 🎯')
    } catch (error) {
      console.error('Error creating custom goal:', error)
      showToast(error.message || 'Failed to create custom goal', 'error')
    } finally {
      setCreatingGoal(false)
    }
  }
  
  const addChallengeToUser = async (challengeId) => {
    try {
      setCreatingGoal(true)
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },        body: JSON.stringify({
          email: user.email,
          challengeId: challengeId
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add challenge')
      }
      
      // Close modal first
      setShowGoalModal(false)
      
      // Refresh challenges with goals data
      await fetchChallengesWithGoals(user.email)
      await fetchProgress(userData.id)
      showToast('Challenge added successfully! 💪')
    } catch (error) {
      console.error('Error adding challenge:', error)
      setShowGoalModal(false)
      showToast(error.message || 'Failed to add challenge', 'error')
    } finally {
      setCreatingGoal(false)
    }  }
  
  const createCustomChallenge = async () => {
    if (!newGoalLabel.trim()) {
      alert('Please enter a challenge title')
      return
    }
    
    try {
      setCreatingGoal(true)
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          challengeData: {
            label: newGoalLabel.trim(),
            description: newGoalDescription.trim() || newGoalLabel.trim(),
            category: 'Custom'
          }
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create challenge')
      }
        // Refresh challenges with goals
      await fetchChallengesWithGoals(user.email)
      await fetchProgress(userData.id)
      setShowGoalModal(false)
      setNewGoalLabel('')
      setNewGoalDescription('')
      showToast('Custom challenge created successfully! 💪')
    } catch (error) {
      console.error('Error creating custom challenge:', error)
      showToast(error.message || 'Failed to create custom challenge', 'error')    } finally {
      setCreatingGoal(false)
    }
  };

  const fetchProgress = async (userId) => {
    try {
      console.log('🔧 fetchProgress called for userId:', userId)
      const { data, error } = await supabase
        .from('progress')
        .select('*')
        .eq('user_id', userId)

      if (error) throw error
      console.log('🔧 fetchProgress result:', data)
      setProgress(data || [])
    } catch (error) {
      console.error('Error fetching progress:', error)
    }
  }
  
  const fetchActionPlans = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('action_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_complete', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      setActionPlans(data || [])    } catch (error) {
      console.error('Error fetching action plans:', error)
    }
  }
    const generateSuggestedAction = async (goalId, goalLabel) => {
    setSuggestingGoal(goalId)
    
    try {
      // Generate AI suggestion using OpenAI
      const prompt = `As a wellness coach, suggest one specific, actionable step for someone working on "${goalLabel}".
      
The suggestion should be:
- Concrete and doable today or this week
- Specific and measurable
- Motivating but achievable

User context:
- Communication style: ${userData.tone || 'balanced'}
- Goal: ${goalLabel}

Respond with just the action suggestion (1-2 sentences, max 100 characters).`

      const response = await fetch('/api/gptRouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          message: prompt,
          includeMemory: false
        })
      })

      const data = await response.json()
      
      if (response.ok && data.response) {
        // Check if there's already a suggested action for this goal
        const existingSuggestion = getSuggestedActionForGoal(goalId)
        
        if (existingSuggestion) {
          // Update the existing suggestion with the new action
          const { error } = await supabase
            .from('action_plans')
            .update({
              action_text: data.response.trim(),
              created_at: new Date().toISOString()
            })
            .eq('id', existingSuggestion.id)

          if (!error) {
            await fetchActionPlans(userData.id)
            showToast('New action suggestion generated! 💡', 'success')
          } else {
            console.error('Error updating suggested action:', error)
            showToast('Failed to update action suggestion', 'error')
          }
        } else {
          // Create a new suggested action
          const { error } = await supabase
            .from('action_plans')
            .insert({
              user_id: userData.id,
              goal_id: goalId,
              action_text: data.response.trim(),
              is_complete: false,
              status: 'suggested', // Add status to distinguish from accepted actions
              created_at: new Date().toISOString()
            })

          if (!error) {
            await fetchActionPlans(userData.id)
            showToast('Action suggestion generated! 💡', 'success')
          } else {
            console.error('Error saving suggested action:', error)
            showToast('Failed to save action suggestion', 'error')
          }
        }
      } else {
        console.error('Failed to generate action suggestion:', data)
        showToast('Failed to generate action suggestion', 'error')
      }
    } catch (error) {
      console.error('Error generating action:', error)
      showToast('Failed to generate action suggestion', 'error')
    } finally {
      setSuggestingGoal(null)
    }
  }
    const acceptSuggestedAction = async (actionId) => {
    try {
      // Mark action as accepted, which moves it to "Today's Recommended Actions"
      const { error } = await supabase
        .from('action_plans')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', actionId)

      if (!error) {
        await fetchActionPlans(userData.id)
      }
    } catch (error) {
      console.error('Error accepting action:', error)
    }
  }
  const markActionDone = async (actionId, goalId) => {
    try {
      // Mark action as complete
      const { error } = await supabase
        .from('action_plans')
        .update({ 
          is_complete: true, 
          completed_at: new Date().toISOString() 
        })
        .eq('id', actionId)

      if (!error) {
        // Update progress if goal exists
        if (goalId) {
          const currentProgress = progress.find(p => p.goal_id === goalId)
          const newProgressPercent = Math.min(100, (currentProgress?.progress_percent || 0) + 5)
          
          if (currentProgress) {
            await supabase
              .from('progress')
              .update({ 
                progress_percent: newProgressPercent,
                last_updated: new Date().toISOString()
              })
              .eq('id', currentProgress.id)
          } else {
            await supabase
              .from('progress')
              .insert({
                user_id: userData.id,
                goal_id: goalId,
                progress_percent: 5,
                last_updated: new Date().toISOString()
              })
          }
            // Check for achievements
          if (newProgressPercent >= 25 && newProgressPercent < 30) {
            setRecentAchievement({
              title: "Great Progress!",
              description: "You've made solid progress on your wellness goals!"
            })
          } else if (newProgressPercent >= 50 && newProgressPercent < 55) {
            setRecentAchievement({
              title: "Halfway There!",
              description: "You're 50% complete with this goal!"
            })
          }
          
          await fetchProgress(userData.id)
        }
        
        await fetchActionPlans(userData.id)
      }
    } catch (error) {
      console.error('Error marking action done:', error)
    }
  }
  const deleteAction = async (actionId) => {
    try {
      // Delete the action from action_plans
      const { error } = await supabase
        .from('action_plans')
        .delete()
        .eq('id', actionId)

      if (!error) {
        await fetchActionPlans(userData.id)
        showToast('Action deleted successfully! 🗑️')
      } else {
        console.error('Error deleting action:', error)
        showToast('Failed to delete action', 'error')
      }
    } catch (error) {      console.error('Error deleting action:', error)
      showToast('Failed to delete action', 'error')
    }
  }
    const updateProgress = async (goalId, newPercent) => {
    try {
      const currentProgress = progress.find(p => p.goal_id === goalId)
      
      if (currentProgress) {
        await supabase
          .from('progress')
          .update({ 
            progress_percent: newPercent,
            last_updated: new Date().toISOString()
          })
          .eq('id', currentProgress.id)
      } else {        await supabase
          .from('progress')
          .insert({
            user_id: userData.id,
            goal_id: goalId,
            progress_percent: newPercent,
            last_updated: new Date().toISOString()
          })      }
      
      // Refresh progress state after update
      await fetchProgress(userData.id)
    } catch (error) {
      console.error('Error updating progress:', error)
    }
  }
  const updateChallengeProgress = async (challengeId, newPercent) => {
    try {
      const currentProgress = progress.find(p => p.challenge_id === challengeId)
      
      if (currentProgress) {
        await supabase
          .from('progress')
          .update({ 
            progress_percent: newPercent,
            last_updated: new Date().toISOString()
          })
          .eq('id', currentProgress.id)
      } else {        await supabase
          .from('progress')
          .insert({
            user_id: userData.id,
            challenge_id: challengeId,
            progress_percent: newPercent,
            last_updated: new Date().toISOString()
          })      }
      
      // Refresh progress state after update
      await fetchProgress(userData.id)
    } catch (error) {
      console.error('Error updating challenge progress:', error)
    }
  }
  const initializeProgress = async (itemId, type) => {
    try {
      const existingProgress = progress.find(p => 
        type === 'goal' ? p.goal_id === itemId : p.challenge_id === itemId
      )
      
      if (!existingProgress) {
        const progressData = {
          user_id: userData.id,
          progress_percent: 0,
          last_updated: new Date().toISOString()
        }
        
        if (type === 'goal') {
          progressData.goal_id = itemId
        } else {
          progressData.challenge_id = itemId
        }
        
        await supabase
          .from('progress')
          .insert(progressData)
          
        await fetchProgress(userData.id)
      }
    } catch (error) {
      console.error('Error initializing progress:', error)
    }
  }
    const openProgressModal = (item, type) => {
    // Only allow progress tracking for goals, not challenges
    if (type !== 'goal') return
    
    const goalId = item.goal_id || item.coach_wellness_goals?.goal_id
    const currentProgress = getProgressForGoal(goalId)
    
    console.log('🔧 Opening progress modal for goalId:', goalId, 'current progress:', currentProgress)
      setSelectedProgressItem(item)
    setProgressType(type)
    setNewProgressPercent(currentProgress) // This should show the actual current progress
    setShowProgressModal(true)
  }
  
  const saveProgress = async () => {
    if (!selectedProgressItem) return

    try {
      setUpdatingProgress(true)
      console.log('🔧 saveProgress called with:', {
        selectedProgressItem,
        progressType,
        newProgressPercent
      })
      
      // For challenges, we need to use the string challenge_id (how progress is stored)
      const itemId = progressType === 'goal' 
        ? (selectedProgressItem.goal_id || selectedProgressItem.coach_wellness_goals?.goal_id)
        : selectedProgressItem.challenge_id

      console.log('🔧 Extracted itemId:', itemId, 'Type:', typeof itemId)

      if (!itemId) {
        console.error('🔧 No itemId found for:', progressType, selectedProgressItem)
        showToast('Failed to update progress - ID not found', 'error')
        return
      }
      
      if (progressType === 'goal') {
        await updateProgress(itemId, newProgressPercent)
      } else {
        console.log('🔧 Calling updateChallengeProgress with:', itemId, newProgressPercent)
        await updateChallengeProgress(itemId, newProgressPercent)
      }
      
      // Refresh progress data after update
      console.log('🔧 Refreshing progress data after update...')
      await fetchProgress(userData.id)
      
      setShowProgressModal(false)
      setSelectedProgressItem(null)
      showToast(`${progressType === 'goal' ? 'Goal' : 'Challenge'} progress updated! 📈`)
    } catch (error) {
      console.error('Error saving progress:', error)
      showToast('Failed to update progress', 'error')
    } finally {
      setUpdatingProgress(false)
    }
  };

  const getProgressForGoal = (goalId) => {
    const goalProgress = progress.find(p => p.goal_id === goalId)
    const progressPercent = goalProgress ? goalProgress.progress_percent : 0
    console.log('🔧 getProgressForGoal:', goalId, 'found:', goalProgress, 'returning:', progressPercent)
    return progressPercent
  }

  const getSuggestedActionForGoal = (goalId) => {
    return actionPlans.find(action => 
      action.goal_id === goalId && 
      !action.is_complete &&
      action.status === 'suggested' // Only show pending suggestions in goal cards
    )
  }

  const getAcceptedActions = () => {
    return actionPlans.filter(action => 
      !action.is_complete &&
      action.status === 'accepted' // Only show accepted actions in "Today's Recommended Actions"
    )  }
  
  const getSuggestedActionForChallenge = (challengeId) => {
    return actionPlans.find(action => 
      action.challenge_id === challengeId && 
      !action.is_complete &&
      action.status === 'suggested'
    )
  }
  
  const generateChallengeAction = async (challengeId, challengeLabel) => {
    setSuggestingGoal(challengeId) // Reuse the same state
    
    try {
      const prompt = `As a wellness coach, suggest one specific, actionable step for someone working on overcoming "${challengeLabel}".
      
The suggestion should be:
- Concrete and doable today or this week
- Specific and measurable
- Supportive and encouraging

Challenge: ${challengeLabel}

Respond with just the action suggestion (1-2 sentences, max 100 characters).`

      const response = await fetch('/api/gptRouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          message: prompt,
          includeMemory: false
        })
      })

      const data = await response.json()
      
      if (response.ok && data.response) {
        const { error } = await supabase
          .from('action_plans')
          .insert({            user_id: userData.id,
            challenge_id: challengeId,
            action_text: data.response.trim(),
            is_complete: false,
            status: 'suggested',
            created_at: new Date().toISOString()
          })
          
        if (!error) {
          await fetchActionPlans(userData.id)
        }
      }
    } catch (error) {
      console.error('Error generating challenge action:', error)
    } finally {
      setSuggestingGoal(null)
    }
  }
  
  // Generate AI-suggested goals for a specific challenge
  const generateAISuggestedGoals = async (challengeId) => {
    setLoadingSuggestions(true)
    setAiSuggestedGoals([])

    try {      // Find the challenge details
      const challenge = challengesWithGoals.find(c => c.coach_challenges.challenge_id === challengeId)?.coach_challenges
      
      if (!challenge) {
        console.error('Challenge not found for ID:', challengeId)
        return
      }

      const prompt = `As a wellness coach, suggest 4 specific, actionable goals for someone working on "${challenge.label}".

Challenge context: ${challenge.description}

User context:
- Communication style: ${userData?.tone || 'balanced'}
- First name: ${userData?.first_name || 'User'}
- Any preferences: ${userData?.preferences || 'No specific preferences listed'}

For each goal, provide:
1. A clear, specific goal title (max 50 characters)
2. A brief description of what this goal involves (max 100 characters)

Format your response as a JSON array with objects containing "title" and "description" fields.

Example format:
[
  {"title": "Walk 20 minutes daily", "description": "Take a brisk 20-minute walk every day to boost energy and mood"},
  {"title": "Practice deep breathing", "description": "Spend 5 minutes doing deep breathing exercises when feeling stressed"}
]

Make the goals:
- Specific and measurable
- Achievable for beginners
- Directly related to overcoming "${challenge.label}"
- Personalized to the user's communication style`

      const response = await fetch('/api/gptRouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          message: prompt,
          includeMemory: false
        })
      })

      const data = await response.json()
      
      if (response.ok && data.response) {
        try {
          // Clean the response to extract JSON
          let jsonString = data.response.trim()
          
          // Remove any markdown formatting
          jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '')
          
          // Parse the JSON
          const suggestedGoals = JSON.parse(jsonString)
          
          if (Array.isArray(suggestedGoals) && suggestedGoals.length > 0) {
            setAiSuggestedGoals(suggestedGoals)
          } else {
            console.error('Invalid suggestions format:', suggestedGoals)
            showToast('Failed to generate goal suggestions', 'error')
          }
        } catch (parseError) {
          console.error('Error parsing AI suggestions:', parseError, data.response)
          showToast('Failed to parse goal suggestions', 'error')
        }
      } else {
        console.error('Error from AI:', data)
        showToast('Failed to generate goal suggestions', 'error')
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error)
      showToast('Failed to generate goal suggestions', 'error')
    } finally {
      setLoadingSuggestions(false)
    }
  }

  // Create a goal from AI suggestion
  const createGoalFromSuggestion = async (suggestion) => {
    try {
      setCreatingGoal(true)
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,          goalData: {
            label: suggestion.title,
            description: suggestion.description,
            category: 'AI Suggested',
            challengeId: selectedChallengeForGoal
          }
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create goal')
      }
      
      // Refresh challenges with goals
      await fetchChallengesWithGoals(user.email)
      await fetchProgress(userData.id)
      
      setShowGoalSelectionModal(false)
      setSelectedChallengeForGoal(null)
      setAiSuggestedGoals([])
      
      showToast('AI-suggested goal created successfully! 🎯', 'success')
    } catch (error) {
      console.error('Error creating goal from suggestion:', error)
      showToast(error.message || 'Failed to create goal', 'error')
    } finally {
      setCreatingGoal(false)
    }
  }

  // Helper function to get goal streak days
  const getStreakDays = (goalId) => {
    // Simple streak calculation - could be enhanced
    const goalProgress = progress.find(p => p.goal_id === goalId)
    if (!goalProgress) return 0
    
    // If progress was updated today, assume streak continues
    const lastUpdate = new Date(goalProgress.last_updated)
    const today = new Date()
    const daysDiff = Math.floor((today - lastUpdate) / (1000 * 60 * 60 * 24))
    
    if (daysDiff <= 1 && goalProgress.progress_percent > 0) {
      return Math.floor(goalProgress.progress_percent / 10) + 1 // Rough estimate
    }
    return 0
  }

  if (loading) {
    return (
      <Layout title="Dashboard">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Layout>
    )
  }

  const displayName = userData?.first_name || user?.user_metadata?.first_name || user?.email?.split('@')[0]
  
  return (
    <Layout title="Dashboard">
      {/* Header Section */}
      <div className="container-fluid" style={{ 
        width: '50vw',
        minWidth: '280px',
        maxWidth: '900px',
        margin: '0 auto',
        marginBottom: '0'
      }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          borderRadius: '16px 16px 0 0',
          padding: 'clamp(1.5rem, 4vw, 2rem) clamp(1rem, 3vw, 1.5rem)',
          marginBottom: '0'
        }}>
          <div className="d-flex justify-content-between align-items-start flex-wrap">
            <div>
              <h1 className="text-white mb-0 fw-bold" style={{ 
                fontSize: 'clamp(1.5rem, 3.5vw, 2rem)',
                lineHeight: '1.2',
                letterSpacing: '-0.025em'
              }}>
                👋 Your Wellness<br />Challenges
              </h1>
            </div>
            <div className="d-flex align-items-center mt-2 mt-md-0">
              <div 
                className="rounded-circle bg-white d-flex align-items-center justify-content-center me-2"
                style={{ 
                  width: 'clamp(40px, 8vw, 50px)', 
                  height: 'clamp(40px, 8vw, 50px)',
                  fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
                  color: '#6366f1',
                  fontWeight: 'bold'
                }}
              >
                {displayName?.charAt(0)?.toUpperCase() || '👤'}
              </div>
              <span className="text-white fw-medium" style={{ 
                fontSize: 'clamp(0.9rem, 2vw, 1rem)' 
              }}>
                {displayName}
              </span>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-white mb-0 opacity-75" style={{ 
              fontSize: 'clamp(0.8rem, 1.8vw, 0.9rem)' 
            }}>
              Keep it up, you're <strong>making</strong> great progress!
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="container-fluid" style={{ 
        width: '50vw',
        minWidth: '320px',
        maxWidth: '900px',
        margin: '0 auto',
        padding: '0 1rem',
        marginTop: '0'
      }}>
        
        {/* Achievement Banner */}
        {recentAchievement && (
          <div className="alert alert-success alert-dismissible fade show rounded-4 shadow-sm mb-4" role="alert">
            <div className="d-flex align-items-center">
              <div className="fs-3 me-3">🏆</div>
              <div>
                <h5 className="alert-heading mb-1">{recentAchievement.title}</h5>
                <p className="mb-0">{recentAchievement.description}</p>
              </div>
            </div>
            <button type="button" className="btn-close" onClick={() => setRecentAchievement(null)}></button>
          </div>
        )}

        {/* Wellness Progress Section with Tabs */}
        <div className="card shadow-lg" style={{ borderRadius: '0', marginTop: '-1px', border: 'none' }}>
          <div className="card-body p-4" style={{ paddingTop: '2rem' }}>
            
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
              <h2 className="fw-bold mb-0" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>Your Challenges</h2>
              <button 
                className="btn btn-primary rounded-pill px-4 py-2"
                onClick={() => setShowGoalModal(true)}
                style={{ 
                  fontSize: 'clamp(0.8rem, 1.8vw, 0.9rem)',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  minWidth: 'fit-content'
                }}
              >
                <i className="bi bi-plus me-1"></i>Add Challenge
              </button>
            </div>

            {/* Challenges and Goals */}
            {challengesWithGoals.length === 0 ? (
              <div className="text-center py-5">
                <div className="fs-1 mb-3">🚀</div>
                <h4 className="text-muted mb-2">Ready to Start Your Wellness Journey?</h4>
                <p className="text-muted">Add your first challenge and start setting goals to track your progress!</p>
                <button 
                  className="btn btn-primary rounded-pill px-4 py-3"
                  onClick={() => setShowGoalModal(true)}
                >
                  <i className="bi bi-plus-circle me-2"></i>Create Your First Challenge
                </button>
              </div>
            ) : (
              challengesWithGoals.map((challengeWithGoals) => {
                const isExpanded = expandedChallenges.has(challengeWithGoals.coach_challenges.challenge_id)
                
                return (
                  <div key={challengeWithGoals.id} className="card border-0 shadow-sm rounded-3 mb-4">
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="d-flex align-items-center mb-2">
                          <button 
                            className="btn btn-link p-0 me-3 text-decoration-none"
                            onClick={() => toggleChallengeExpansion(challengeWithGoals.coach_challenges.challenge_id)}
                          >
                            <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                          </button>
                          <span className="me-2" style={{ color: '#dc3545', fontSize: '1rem' }}>💪</span>
                          <div>
                            <h5 className="mb-1 fw-bold">{challengeWithGoals.coach_challenges.label}</h5>
                            <p className="text-muted mb-2" style={{ marginLeft: '3.5rem' }}>
                              {challengeWithGoals.coach_challenges.description}
                            </p>
                          </div>                        </div>
                      </div>
                      
                      {/* Expandable Goals Section */}
                      {isExpanded && (
                        <div style={{ marginLeft: '3.5rem', paddingTop: '1rem', borderTop: '1px solid #e9ecef' }}>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="mb-0">Challenge Goals</h6>
                            <button 
                              className="btn btn-primary btn-sm rounded-pill"
                              onClick={() => openGoalModalForChallenge(challengeWithGoals.coach_challenges.challenge_id)}
                            >
                              <i className="bi bi-plus me-1"></i>Add Goal
                            </button>
                          </div>
                          
                          {challengeWithGoals.goals.length === 0 ? (
                            <div className="text-center py-4 bg-light rounded-3">
                              <p className="text-muted mb-3">No goals yet for this challenge</p>
                              <button 
                                className="btn btn-primary btn-sm rounded-pill"
                                onClick={() => openGoalModalForChallenge(challengeWithGoals.coach_challenges.challenge_id)}
                              >
                                <i className="bi bi-plus-circle me-1"></i>Add Your First Goal
                              </button>
                            </div>
                          ) : (                            <div className="row g-3">
                              {challengeWithGoals.goals.map((userGoal) => {
                                console.log('🔧 Debug userGoal structure:', userGoal)
                                const goalId = userGoal.goal_id || userGoal.coach_wellness_goals?.goal_id
                                const goalProgress = getProgressForGoal(goalId)
                                const suggestedAction = getSuggestedActionForGoal(goalId)
                                
                                return (
                                  <div key={userGoal.id} className="col-12 col-sm-6 col-lg-4">
                                    <div className="card border rounded-3 h-100">
                                      <div className="card-body p-3 d-flex flex-column">
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                          <h6 className="card-title mb-1 flex-grow-1" style={{ 
                                            fontSize: 'clamp(0.85rem, 1.2vw, 0.95rem)',
                                            lineHeight: '1.3'
                                          }}>
                                            {userGoal.coach_wellness_goals.label}
                                          </h6>
                                          <button 
                                            className="btn btn-outline-primary btn-sm rounded-pill ms-2"
                                            onClick={() => openProgressModal(userGoal, 'goal')}
                                            style={{ fontSize: 'clamp(0.7rem, 1vw, 0.8rem)' }}
                                          >
                                            <i className="bi bi-arrow-up me-1"></i>{goalProgress}%
                                          </button>
                                        </div>
                                        
                                        {/* Goal Progress Bar */}
                                        <div className="progress rounded-pill" style={{ height: '6px' }}>
                                          <div 
                                            className="progress-bar rounded-pill" 
                                            style={{ 
                                              width: `${goalProgress}%`,
                                              backgroundColor: '#007bff'
                                            }}
                                          ></div>
                                        </div>
                                        
                                        {/* Goal Action */}
                                        {suggestedAction ? (
                                          <div className="mt-3 p-2 bg-white border rounded-2 p-2">
                                            <div className="badge bg-info text-white mb-1">AI Suggested</div>
                                            <p className="small mb-2">{suggestedAction.action_text}</p>
                                            <div className="d-flex gap-2 flex-wrap">
                                              <button 
                                                className="btn btn-primary btn-sm rounded-pill"
                                                onClick={() => acceptSuggestedAction(suggestedAction.id)}
                                                disabled={suggestingGoal === goalId}
                                              >
                                                <i className="bi bi-check me-1"></i>Accept
                                              </button>
                                              <button 
                                                className="btn btn-outline-secondary btn-sm rounded-pill"
                                                onClick={() => generateSuggestedAction(goalId, userGoal.coach_wellness_goals.label)}
                                                disabled={suggestingGoal === goalId}
                                              >
                                                <i className="bi bi-arrow-clockwise me-1"></i>
                                                <span className="d-none d-lg-inline">
                                                  {suggestingGoal === goalId ? 'Generating...' : 'Generate Another'}
                                                </span>
                                                <span className="d-lg-none">
                                                  {suggestingGoal === goalId ? '...' : 'New'}
                                                </span>
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-center mt-auto">
                                            <button 
                                              className="btn btn-outline-primary btn-sm rounded-pill w-100"
                                              onClick={() => generateSuggestedAction(goalId, userGoal.coach_wellness_goals.label)}
                                              disabled={suggestingGoal === goalId}
                                            >
                                              <i className="bi bi-lightbulb me-1"></i>
                                              <span className="d-none d-md-inline">
                                                {suggestingGoal === goalId ? 'Thinking...' : 'Get Suggestion'}
                                              </span>
                                              <span className="d-md-none">
                                                {suggestingGoal === goalId ? '...' : 'Suggest'}
                                              </span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
        
        {/* Today's Recommended Actions */}
        <div className="card shadow-lg rounded-3 mt-4">
          <div className="card-body p-4">
            <h3 className="fw-bold mb-4" style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.75rem)' }}>Today's Recommended Actions</h3>
            
            {getAcceptedActions().length === 0 ? (
              <div className="text-center py-4">
                <div className="fs-3 mb-2">🎯</div>
                <h5 className="text-muted mb-2">No actions for today</h5>
                <p className="text-muted">Accept suggestions from your goals above!</p>
              </div>
            ) : (
              <div>
                <div className="alert alert-info rounded-3 mb-3 border-0">
                  <i className="bi bi-info-circle me-2"></i>
                  You have {getAcceptedActions().length} action{getAcceptedActions().length !== 1 ? 's' : ''} to complete today.
                </div>
                
                <div className="row g-3">
                  {getAcceptedActions().map((action, index) => (
                    <div key={action.id} className="col-12 col-md-6 col-xl-4">
                      <div className="card border-0 bg-light rounded-3 h-100">
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <div className="badge bg-primary text-white mb-2" style={{ fontSize: 'clamp(0.7rem, 1vw, 0.8rem)' }}>
                                Day {index + 1} [AI Coach]:
                              </div>
                              <p className="mb-0" style={{ fontSize: 'clamp(0.8rem, 1.2vw, 0.9rem)' }}>"{action.action_text}"</p>
                            </div>
                            <div className="d-flex flex-column gap-2 ms-3">
                              <button 
                                className="btn btn-primary btn-sm rounded-pill"
                                onClick={() => markActionDone(action.id, action.goal_id || action.challenge_id)}
                                style={{ fontSize: 'clamp(0.7rem, 1vw, 0.8rem)' }}
                              >
                                <i className="bi bi-check me-1"></i>
                                <span className="d-none d-lg-inline">Mark as Done</span>
                                <span className="d-lg-none">Done</span>
                              </button>
                              <button 
                                className="btn btn-outline-danger btn-sm rounded-circle p-2"
                                onClick={() => deleteAction(action.id)}
                              >
                                <i className="bi bi-trash" style={{ fontSize: 'clamp(0.6rem, 0.8vw, 0.7rem)' }}></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>        </div>
      </div>
      {/* Fixed Chat Button - Blue Bar Style */}
      <div 
        className="position-fixed bottom-0 start-50 translate-middle-x p-3" 
        style={{ 
          zIndex: 1000, 
          width: '50vw',
          minWidth: '320px',
          maxWidth: '900px'
        }}
      >
        <div 
          className="w-100 rounded-pill py-3 shadow-lg"
          style={{ 
            background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <a 
            href="/chat" 
            className="btn btn-light w-100 rounded-pill py-2 text-decoration-none fw-bold mx-3"
            style={{ 
              color: '#007bff',
              fontSize: 'clamp(1rem, 2vw, 1.1rem)',
              border: 'none',
              width: 'calc(100% - 1.5rem)'
            }}
          >
            <i className="bi bi-chat-dots me-2"></i>
            💬 Chat about my progress with your AI Coach
          </a>
        </div>
      </div>
      
      {/* Challenge Selection Modal */}      {showGoalModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-plus-circle me-2"></i>Add Challenge
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowGoalModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="mb-4">
                  <h6 className="fw-bold mb-3">Choose from Available Challenges</h6>
                  <div className="row g-3">
                    {availableChallenges.map((challenge) => {
                      const alreadySelected = userHasChallenge(challenge.challenge_id)
                      
                      return (
                        <div key={challenge.challenge_id} className="col-12 col-md-6">
                          <div className={`card h-100 ${alreadySelected ? 'border-success' : 'border'}`}>
                            <div className="card-body p-3 d-flex flex-column">
                              <h6 className="card-title mb-2">{challenge.label}</h6>
                              <p className="card-text small text-muted mb-3 flex-grow-1">
                                {challenge.description}
                              </p>
                              {alreadySelected ? (
                                <small className="text-success fw-medium">
                                  <i className="bi bi-check-circle me-1"></i>Already added
                                </small>
                              ) : (
                                <button 
                                  className="btn btn-primary btn-sm rounded-pill mt-auto"
                                  onClick={() => addChallengeToUser(challenge.challenge_id)}
                                  disabled={creatingGoal}
                                >
                                  {creatingGoal ? 'Adding...' : 'Add Challenge'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                <hr />
                
                <div className="row">
                  <div className="col-12 col-md-8 mx-auto">
                    <h6 className="fw-bold mb-3">Create Custom Challenge</h6>
                    <div className="mb-3">
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="Challenge title (e.g., 'Exercise 30 minutes daily')"
                        value={newGoalLabel}
                        onChange={(e) => setNewGoalLabel(e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <textarea 
                        className="form-control"
                        placeholder="Challenge description (optional)"
                        value={newGoalDescription}
                        onChange={(e) => setNewGoalDescription(e.target.value)}
                        rows="3"
                      ></textarea>
                    </div>
                    <button 
                      className="btn btn-primary w-100 rounded-pill"
                      onClick={createCustomChallenge}
                      disabled={creatingGoal || !newGoalLabel.trim()}
                    >
                      {creatingGoal ? 'Creating...' : 'Create Custom Challenge'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Progress Update Modal */}
      {showProgressModal && selectedProgressItem && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Update Progress</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowProgressModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="mb-3">
                  <h6 className="fw-bold">
                    {progressType === 'goal' 
                      ? (selectedProgressItem?.coach_wellness_goals?.label || selectedProgressItem?.label)
                      : (selectedProgressItem?.coach_challenges?.label || selectedProgressItem?.label)
                    }
                  </h6>
                  <p className="text-muted small mb-3">
                    {progressType === 'goal' 
                      ? (selectedProgressItem?.coach_wellness_goals?.description || selectedProgressItem?.description)
                      : (selectedProgressItem?.coach_challenges?.description || selectedProgressItem?.description)
                    }
                  </p>
                </div>
                
                <div className="mb-4">
                  <label className="form-label fw-bold">Progress Percentage</label>
                  <div className="d-flex align-items-center gap-3">
                    <input 
                      type="range" 
                      className="form-range flex-grow-1" 
                      min="0" 
                      max="100" 
                      value={newProgressPercent} 
                      onChange={(e) => setNewProgressPercent(parseInt(e.target.value))}
                    />
                    <span className="badge bg-primary fs-6" style={{ minWidth: '60px' }}>
                      {newProgressPercent}%
                    </span>
                  </div>
                  
                  <div className="mb-3">
                    <div className="progress rounded-pill" style={{ height: '12px' }}>
                      <div 
                        className="progress-bar rounded-pill" 
                        style={{ 
                          width: `${newProgressPercent}%`,
                          backgroundColor: progressType === 'goal' ? '#007bff' : '#28a745'
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary rounded-pill"
                  onClick={() => setShowProgressModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary rounded-pill"
                  onClick={saveProgress}
                  disabled={updatingProgress}
                >
                  <i className="bi bi-check-circle me-1"></i>
                  {updatingProgress ? 'Updating...' : 'Update Progress'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast Notification */}
      {toast.message && (
        <div 
          className={`position-fixed top-0 end-0 m-3 p-3 rounded-3 shadow-lg ${
            toast.type === 'error' ? 'bg-danger text-white' : 'bg-success text-white'
          }`}
          style={{ zIndex: 1050, minWidth: '300px' }}
        >
          <div className="d-flex align-items-center">
            <span className="me-2">{toast.type === 'error' ? '❌' : '✅'}</span>            <span className="flex-grow-1">{toast.message}</span>
            <button 
              className="btn-close btn-close-white ms-2"
              onClick={() => setToast({ message: '', type: 'success' })}
            ></button>
          </div>
        </div>
      )}
      
      {/* Goal Selection Modal */}
      {showGoalSelectionModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-plus-circle me-2"></i>Add Goal to Challenge
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowGoalSelectionModal(false)
                    setSelectedChallengeForGoal(null)
                    setAiSuggestedGoals([])
                  }}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="row">
                  <div className="col-md-8">
                    <h6 className="fw-bold mb-3">Choose from Available Goals</h6>
                    <div className="row g-3 mb-4">
                      {availableGoals.filter(goal => !goal.challenge_id || goal.challenge_id === selectedChallengeForGoal).map((goal) => (
                        <div key={goal.id} className="col-sm-6">
                          <div 
                            className="card border-0 bg-light h-100 goal-card"
                            style={{ cursor: 'pointer' }}
                            onClick={() => addGoalToUser(goal.id)}
                          >
                            <div className="card-body p-3">
                              <h6 className="card-title mb-1">{goal.label}</h6>
                              <p className="card-text small text-muted">{goal.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {availableGoals.filter(goal => !goal.challenge_id || goal.challenge_id === selectedChallengeForGoal).length === 0 && (
                      <div className="alert alert-info">
                        <p className="mb-0">No available goals for this challenge. Create a custom goal instead!</p>
                      </div>
                    )}
                    
                    <hr />
                    
                    <div className="mb-3">
                      <h6 className="fw-bold mb-3">AI Suggested Goals</h6>
                      <button 
                        className="btn btn-outline-primary rounded-pill mb-3"
                        onClick={() => generateAISuggestedGoals(selectedChallengeForGoal)}
                        disabled={loadingSuggestions}
                      >
                        {loadingSuggestions ? 'Generating...' : '✨ Get AI Suggestions'}
                      </button>
                      
                      {aiSuggestedGoals.length > 0 && (
                        <div className="row g-2">
                          {aiSuggestedGoals.map((suggestion, index) => (
                            <div key={index} className="col-sm-6">
                              <div className="card border-primary">
                                <div className="card-body p-3">
                                  <h6 className="card-title mb-1">{suggestion.title}</h6>
                                  <p className="card-text small text-muted mb-2">{suggestion.description}</p>
                                  <button 
                                    className="btn btn-primary btn-sm rounded-pill w-100"
                                    onClick={() => createGoalFromSuggestion(suggestion)}
                                    disabled={creatingGoal}
                                  >
                                    {creatingGoal ? 'Adding...' : 'Add Goal'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="col-md-4">
                    <h6 className="fw-bold mb-3">Create Custom Goal</h6>
                    <div className="mb-3">
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="Goal title (e.g., 'Walk 30 minutes daily')"
                        value={newGoalLabel}
                        onChange={(e) => setNewGoalLabel(e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <textarea 
                        className="form-control"
                        placeholder="Goal description (optional)"
                        value={newGoalDescription}
                        onChange={(e) => setNewGoalDescription(e.target.value)}
                        rows="3"
                      ></textarea>
                    </div>
                    <button 
                      className="btn btn-primary w-100 rounded-pill"
                      onClick={createCustomGoal}
                      disabled={creatingGoal || !newGoalLabel.trim()}
                    >
                      {creatingGoal ? 'Creating...' : 'Create Custom Goal'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

