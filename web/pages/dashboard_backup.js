import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import Link from 'next/link'

export default function Dashboard() {  const [user, setUser] = useState(null)
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
        if (mounted) setLoading(false)
      }
    }

    getSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
      showToast('Failed to load user data. Please refresh the page.', 'error')
    } finally {g(false)
      setLoading(false)  }
  
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
  const openGoalModalForChallenge = (challengeId) => {  }
  
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
      showToast(error.message || 'Failed to create custom challenge', 'error')
    } finally {
      setCreatingGoal(false)
    }
  }
  
  const fetchProgress = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('progress')   .eq('user_id', userId)        .select('*')
        .eq('user_id', userId)

      if (error) throw error
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
      setActionPlans(data || [])
    } catch (error) {
      console.error('Error fetching action plans:', error)
    }
  }
  const generateSuggestedAction = async (goalId, goalLabel) => {  const generateSuggestedAction = async (goalId, goalLabel) => {
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
      const data = await response.json()
      if (response.ok && data.response) {        // Save the suggested action with status 'suggested'      if (response.ok && data.response) {
        // Save the suggested action with status 'suggested'
        const { error } = await supabase
          .from('action_plans')
          .insert({
            user_id: userData.id,            goal_id: goalId,
            action_text: data.response.trim(),
            is_complete: false,
            status: 'suggested', // Add status to distinguish from accepted actions
            created_at: new Date().toISOString()
          })

        if (!error) {
          await fetchActionPlans(userData.id)
        }
      }
    } catch (error) {
      console.error('Error generating action:', error)
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
    } catch (error) {
      console.error('Error deleting action:', error)
      showToast('Failed to delete action', 'error')
    }
  }
  const updateProgress = async (goalId, newPercent) => {  const updateProgress = async (goalId, newPercent) => {
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
      } else {
        await supabase
          .from('progress')
          .insert({
            user_id: userData.id,
            goal_id: goalId,
            progress_percent: newPercent,
            last_updated: new Date().toISOString()
          })
      }
      await fetchProgress(userData.id);
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const initializeProgress = async (itemId, type) => {
    try {      const existingProgress = progress.find(p => 
        type === 'goal' ? p.goal_id === itemId : p.challenge_id === itemId
      )
      
      if (!existingProgress) {
        const progressData = {
          user_id: userData.id,
          progress_percent: 0,
          last_updated: new Date().toISOString()
        }
        
        if (type === 'goal') {
          progressData.goal_id = itemId        } else {
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
    
    setSelectedProgressItem(item)
    setProgressType(type)
    setNewProgressPercent(currentProgress)
    setShowProgressModal(true)
  }
    const saveProgress = async () => {
    if (!selectedProgressItem) return

    try {
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
      }      setShowProgressModal(false)
      setSelectedProgressItem(null)
      showToast(`${progressType === 'goal' ? 'Goal' : 'Challenge'} progress updated! 📈`)
    } catch (error) {
      console.error('Error saving progress:', error)
      showToast('Failed to update progress', 'error')
    }
  }
  const getProgressForGoal = (goalId) => {
    const goalProgress = progress.find(p => p.goal_id === goalId)
    return goalProgress ? goalProgress.progress_percent : 0
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

    try {
      // Find the challenge details
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
- Personalized to the user's communication style`      const response = await fetch('/api/gptRouter', {
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
          email: user.email,
          goalData: {
            label: suggestion.title,
            description: suggestion.description,
            category: 'AI Suggested',            challengeId: selectedChallengeForGoal
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
      <div className="container" style={{ 
        maxWidth: '600px', 
        marginBottom: '0'
      }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          borderRadius: '16px 16px 0 0',
          padding: '2rem 1.5rem 2rem 1.5rem',
          marginBottom: '0'
        }}>
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="text-white mb-0 fw-bold" style={{ 
              fontSize: '2.25rem',
              lineHeight: '1.2',
              letterSpacing: '-0.025em'
            }}>
              👋 Your Wellness<br />Challenges
            </h1>
            <button 
              className="btn rounded-pill px-4 py-3"
              onClick={() => setShowGoalModal(true)}
              style={{ 
                backgroundColor: 'white',
                color: '#374151',
                fontWeight: '600',
                fontSize: '1rem',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                whiteSpace: 'nowrap'
              }}
            >
              Add Challenge
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="container" style={{ 
        maxWidth: '600px', 
        padding: '0 24px',
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
            
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h2 className="fw-bold mb-0">Your Goals</h2>
              <span className="text-muted">Track your progress</span>
            </div>

            {/* Challenges and Goals */}
            {challengesWithGoals.length === 0 ? (
              <div className="text-center py-5">
                <div className="fs-1 mb-3">🚀</div>                <h4 className="text-muted mb-2">Ready to Start Your Wellness Journey?</h4>
                <p className="text-muted">Add your first challenge and start setting goals to track your progress!</p>
                <button 
                  className="btn btn-primary rounded-pill px-4 py-3"
                  onClick={() => setShowGoalModal(true)}
                >
                  <i className="bi bi-shield-check me-2"></i>Create Your First Challenge
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
                          ) : (
                            <div className="row g-3">
                              {challengeWithGoals.goals.map((userGoal) => {
                                const goalProgress = getProgressForGoal(userGoal.goal_id)
                                const suggestedAction = getSuggestedActionForGoal(userGoal.goal_id)
                                
                                return (
                                  <div key={userGoal.id} className="col-md-6">
                                    <div className="card border rounded-3">
                                      <div className="card-body p-3">
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                          <h6 className="card-title mb-1">{userGoal.coach_wellness_goals.label}</h6>
                                          <button 
                                            className="btn btn-outline-primary btn-sm rounded-pill"
                                            onClick={() => openProgressModal(userGoal, 'goal')}
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
                                            <div className="d-flex gap-2">
                                              <button 
                                                className="btn btn-primary btn-sm rounded-pill"
                                                onClick={() => acceptSuggestedAction(suggestedAction.id)}
                                              >
                                                <i className="bi bi-check me-1"></i>Accept
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-center">
                                            <button 
                                              className="btn btn-outline-primary btn-sm rounded-pill"
                                              onClick={() => generateSuggestedAction(userGoal.goal_id, userGoal.coach_wellness_goals.label)}
                                              disabled={suggestingGoal === userGoal.goal_id}
                                            >
                                              <i className="bi bi-lightbulb me-1"></i>
                                              {suggestingGoal === userGoal.goal_id ? 'Thinking...' : 'Get Suggestion'}
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
            <h3 className="fw-bold mb-4">Today's Recommended Actions</h3>
            
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
                
                {getAcceptedActions().map((action, index) => (
                  <div key={action.id} className="card border-0 bg-light rounded-3 mb-3">
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="badge bg-primary text-white mb-1">
                            Day {index + 1} [AI Coach]:
                          </div>
                          <p className="mb-0">"{action.action_text}"</p>
                        </div>
                        <div className="d-flex gap-2 ms-3">
                          <button 
                            className="btn btn-primary rounded-pill px-4"
                            onClick={() => markActionDone(action.id, action.goal_id || action.challenge_id)}
                          >
                            Mark as Done
                          </button>
                          <button 
                            className="btn btn-outline-danger rounded-circle p-2"
                            onClick={() => deleteAction(action.id)}
                          >
                            <i className="bi bi-trash" style={{ fontSize: '0.9rem' }}></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>        </div>
      </div>
      
      {/* Fixed Chat Button */}
      <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1000 }}>
        <a 
          href="/chat" 
          className="btn btn-primary rounded-pill py-3 shadow-lg text-decoration-none"
        >
          💬 Chat
        </a>
      </div>
      
      {/* Challenge Selection Modal */}
      {showGoalModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
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
                <div className="mb-3">
                  <h6 className="fw-bold mb-3">Choose from Available Challenges</h6>
                  <div className="row g-3">
                    {availableChallenges.map((challenge) => {
                      const alreadySelected = userHasChallenge(challenge.challenge_id)
                      
                      return (
                        <div key={challenge.challenge_id} className="col-12">
                          <div className={`card h-100 ${alreadySelected ? 'border-success' : 'border'}`}>
                            <div className="card-body p-3">
                              <h6 className="card-title mb-1">{challenge.label}</h6>
                              <p className={`card-text small mb-0 ${alreadySelected ? 'text-muted' : 'text-muted'}`}>
                                {challenge.description}
                              </p>
                              {alreadySelected && (
                                <small className="text-success mt-1 d-block">
                                  ✓ Already added
                                </small>
                              )}
                            </div>
                            {!alreadySelected && (
                              <div className="card-footer bg-transparent border-0 pt-0">
                                <button 
                                  className="btn btn-primary btn-sm w-100 rounded-pill"
                                  onClick={() => addChallengeToUser(challenge.challenge_id)}
                                  disabled={creatingGoal}
                                >
                                  {creatingGoal ? 'Adding...' : 'Add Challenge'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                <hr />
                
                <div className="col-md-4">
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
            <span className="me-2">{toast.type === 'error' ? '❌' : '✅'}</span>
            <span className="flex-grow-1">{toast.message}</span>
            <button 
              className="btn-close btn-close-white ms-2"
              onClick={() => setToast({ message: '', type: 'success' })}
            ></button>
          </div>
        </div>      )}
    </Layout>
  )
}

  const deleteAction = async (actionId) => {
    try {
      // Delete the action from action_plans
      const { error } = await supabase
        .from('action_plans')
        .delete()v>
        .eq('id', actionId)div>

      if (!error) {
        await fetchActionPlans(userData.id)div> {/* End Main Content Container */}
        showToast('Action deleted successfully! 🗑️')
      } else {        {/* Persistent Chat CTA - Fixed at bottom */}
        console.error('Error deleting action:', error)-0 end-0 p-3" style={{ zIndex: 1000 }}>
        showToast('Failed to delete action', 'error')
      }nded-pill py-3 shadow-lg text-decoration-none">
    } catch (error) {
      console.error('Error deleting action:', error)h
      showToast('Failed to delete action', 'error')
    }
  }

  const updateProgress = async (goalId, newPercent) => {      {/* Bottom padding to account for fixed chat button */}
    try {
      const currentProgress = progress.find(p => p.goal_id === goalId)
            <style jsx>{`
      if (currentProgress) {t {
        await supabaselinear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          .from('progress')
          .update({ 
            progress_percent: newPercent,.card {
            last_updated: new Date().toISOString()ition: transform 0.2s ease, box-shadow 0.2s ease;
          })
          .eq('id', currentProgress.id)
      } else {.card:hover {
        await supabasetranslateY(-2px);
          .from('progress')
          .insert({
            user_id: userData.id,.progress-bar {
            goal_id: goalId,idth 0.3s ease;
            progress_percent: newPercent,
            last_updated: new Date().toISOString()
          }).btn {
      }sition: all 0.2s ease;
        await fetchProgress(userData.id);
    } catch (error) {
      console.error('Error updating progress:', error);.btn:hover {
    } translateY(-1px);
  };  const initializeProgress = async (itemId, type) => {
    try {
      const existingProgress = progress.find(p => .toast-container {
        type === 'goal' ? p.goal_id === itemId : p.challenge_id === itemIdnUp 0.3s ease;
      )
      
      if (!existingProgress) {@keyframes fadeInUp {
        const progressData = {
          user_id: userData.id,ity: 0;
          progress_percent: 0,translateY(20px);
          last_updated: new Date().toISOString()
        }o {
        acity: 1;
        if (type === 'goal') {translateY(0);
          progressData.goal_id = itemId
        } else {
          progressData.challenge_id = itemId
        }.alert {
        : none;
        await supabase
          .from('progress')
          .insert(progressData).shadow-lg {
          await fetchProgress(userData.id): 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
      }
    } catch (error) { .shadow-sm {
      console.error('Error initializing progress:', error)0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important;
    }
  }
  const openProgressModal = (item, type) => {        .goal-card:hover {
    // Only allow progress tracking for goals, not challengeslateY(-2px);
    if (type !== 'goal') returnba(0, 0, 0, 0.15) !important;
    
    const goalId = item.goal_id || item.coach_wellness_goals?.goal_id
    const currentProgress = getProgressForGoal(goalId)
            .modal {
    setSelectedProgressItem(item);x: 1060;
    setProgressType(type);
    setNewProgressPercent(currentProgress);/style>      {/* Goal/Challenge Selection Modal */}
    setShowProgressModal(true)
  }odal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
    const saveProgress = async () => {
    if (!selectedProgressItem) return0 shadow-lg">
te">                <h5 className="modal-title">
    try {
      console.log('� saveProgress called with:', {
        selectedProgressItem,n" 
        progressType,-close btn-close-white" 
        newProgressPercent
      })al(false)
      Goal(null)
      // For challenges, we need to use the string challenge_id (how progress is stored)
      const itemId = progressType === 'goal' utton>
        ? (selectedProgressItem.goal_id || selectedProgressItem.coach_wellness_goals?.goal_id)        <div className="modal-body p-4">
        : selectedProgressItem.challenge_id // Use the string challenge_id for challenges
on Challenges</h6>
      console.log('� Extracted itemId:', itemId, 'Type:', typeof itemId)
ice(0, 8).map((challenge) => {
      if (!itemId) {challenge_id)
        console.error('� No itemId found for:', progressType, selectedProgressItem)
        showToast('Failed to update progress - ID not found', 'error')ey={challenge.id} className="col-sm-6">
        return
      }ssName={`card h-100 goal-card ${alreadySelected ? 'border-success' : 'border-0 bg-light'}`}

      if (progressType === 'goal') { alreadySelected ? 'not-allowed' : 'pointer',
        await updateProgress(itemId, newProgressPercent)
      } else {
        console.log('� Calling updateChallengeProgress with:', itemId, newProgressPercent)Click={() => !alreadySelected && addChallengeToUser(challenge.id)}
        await updateChallengeProgress(itemId, newProgressPercent)
      } <div className="card-body p-3">
-1 d-flex align-items-center ${alreadySelected ? 'text-success' : ''}`}>
      setShowProgressModal(false)
      setSelectedProgressItem(null)
      showToast(`${progressType === 'goal' ? 'Goal' : 'Challenge'} progress updated! 📈`)&& (
    } catch (error) {dge bg-success ms-2">
      console.error('Error saving progress:', error)
      showToast('Failed to update progress', 'error')
    }
  }>
assName={`card-text small mb-0 ${alreadySelected ? 'text-muted' : 'text-muted'}`}>
  const getProgressForGoal = (goalId) => {
    const goalProgress = progress.find(p => p.goal_id === goalId)
    return goalProgress ? goalProgress.progress_percent : 0eadySelected && (
  }ext-success mt-1 d-block">
  const getSuggestedActionForGoal = (goalId) => {
    return actionPlans.find(action => 
      action.goal_id === goalId && 
      !action.is_complete &&
      action.status === 'suggested' // Only show pending suggestions in goal cardsv>
    )
  }

  const getAcceptedActions = () => {                </div>
    return actionPlans.filter(action =>      !action.is_complete &&
      action.status === 'accepted' // Only show accepted actions in "Today's Recommended Actions"
    )
  }

  const getSuggestedActionForChallenge = (challengeId) => {
    return actionPlans.find(action =>       {/* Goal Selection Modal */}
      action.challenge_id === challengeId && 
      !action.is_complete &&ock" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      action.status === 'suggested'
    )0 shadow-lg">
  }te">

  const generateChallengeAction = async (challengeId, challengeLabel) => { me-2"></i>Add Goal to Challenge
    setSuggestingGoal(challengeId) // Reuse the same state
    on 
    try {button" 
      const prompt = `As a wellness coach, suggest one specific, actionable step for someone working on overcoming "${challengeLabel}".-close btn-close-white" 
      
The suggestion should be:ectionModal(false)
- Concrete and doable today or this week)
- Specific and measurable
- Supportive and encouragingon('')

Challenge: ${challengeLabel}utton>

Respond with just the action suggestion (1-2 sentences, max 100 characters).`lassName="modal-body p-4">

      const response = await fetch('/api/gptRouter', {-md-8">
        method: 'POST',b-3">Choose from Available Goals</h6>
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,=> !goal.challenge_id || goal.challenge_id === selectedChallengeForGoal)
          message: prompt,
          includeMemory: false=> (
        })d} className="col-sm-6">
      })
ssName="card border-0 bg-light h-100 goal-card"
      const data = await response.json()
      goal.id)}
      if (response.ok && data.response) {
        const { error } = await supabase <div className="card-body p-3">
          .from('action_plans')1">{goal.label}</h6>
          .insert({
            user_id: userData.id,
            challenge_id: challengeId,
            action_text: data.response.trim(),
            is_complete: false,
            status: 'suggested',
            created_at: new Date().toISOString()
          })>
ableGoals.filter(goal => !goal.challenge_id || goal.challenge_id === selectedChallengeForGoal).length === 0 && (
        if (!error) {
          await fetchActionPlans(userData.id)iv>
        }ble goals for this challenge. Create a custom goal instead!</p>
      }
    } catch (error) {
      console.error('Error generating challenge action:', error)v>
    } finally {lassName="col-md-4">
      setSuggestingGoal(null)b-3">Create Custom Goal</h6>
    }
  }

  // Generate AI-suggested goals for a specific challengerm-label small fw-bold">Goal Title</label>
  const generateAISuggestedGoals = async (challengeId) => {
    setLoadingSuggestions(true)="text"
    setAiSuggestedGoals([])form-control"
30 minutes daily"
    try {
      // Find the challenge detailsNewGoalLabel(e.target.value)}
      const challenge = challengesWithGoals.find(c => c.coach_challenges.challenge_id === challengeId)?.coach_challenges
      v>
      if (!challenge) {lassName="mb-3">
        console.error('Challenge not found for ID:', challengeId)rm-label small fw-bold">Description (Optional)</label>
        return
      }me="form-control"

      const prompt = `As a wellness coach, suggest 4 specific, actionable goals for someone working on "${challenge.label}".der="Describe your goal..."

Challenge context: ${challenge.description}lDescription(e.target.value)}

User context:v>
- Communication style: ${userData?.tone || 'balanced'}n
- First name: ${userData?.first_name || 'User'}Name="btn btn-success w-100"
- Any preferences: ${userData?.preferences || 'No specific preferences listed'}
!newGoalLabel.trim()}
For each goal, provide:
1. A clear, specific goal title (max 50 characters) {creatingGoal ? (
2. A brief description of what this goal involves (max 100 characters)
<span className="spinner-border spinner-border-sm me-2"></span>
Format your response as a JSON array with objects containing "title" and "description" fields.

Example format:
[
  {"title": "Walk 20 minutes daily", "description": "Take a brisk 20-minute walk every day to boost energy and mood"},<i className="bi bi-plus-circle me-1"></i>
  {"title": "Practice deep breathing", "description": "Spend 5 minutes doing deep breathing exercises when feeling stressed"}
]

Make the goals:tton>
- Specific and measurable
- Achievable for beginners
- Directly related to overcoming "${challenge.label}"
- Personalized to the user's communication style`

      const response = await fetch('/api/gptRouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          message: prompt,      {/* Progress Update Modal */}
          includeMemory: false
        }) d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      })

      const data = await response.json()te">
      
      if (response.ok && data.response) {up-circle me-2"></i>
        try {
          // Clean the response to extract JSON
          let jsonString = data.response.trim()on 
          button" 
          // Remove any markdown formatting-close btn-close-white" 
          jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '')lse)}
          
          // Parse the JSON
          const suggestedGoals = JSON.parse(jsonString)lassName="modal-body p-4">                <div className="mb-3">
          
          if (Array.isArray(suggestedGoals) && suggestedGoals.length > 0) {
            setAiSuggestedGoals(suggestedGoals)?.label || selectedProgressItem?.coach_wellness_goals?.label)
          } else {object
            console.error('Invalid suggestions format:', suggestedGoals)
            showToast('Failed to generate goal suggestions', 'error')6>
          }assName="text-muted small mb-3">
        } catch (parseError) {
          console.error('Error parsing AI suggestions:', parseError, data.response)?.description || selectedProgressItem?.coach_wellness_goals?.description)
          showToast('Failed to parse goal suggestions', 'error')
        }
      } else {>
        console.error('Error from AI:', data)
        showToast('Failed to generate goal suggestions', 'error')
      }<div className="mb-4">
    } catch (error) {rm-label fw-bold">Progress Percentage</label>
      console.error('Error generating AI suggestions:', error)
      showToast('Failed to generate goal suggestions', 'error')
    } finally {"range" 
      setLoadingSuggestions(false)rm-range flex-grow-1" 
    }
  }" 

  // Create a goal from AI suggestionewProgressPercent} 
  const createGoalFromSuggestion = async (suggestion) => {ressPercent(parseInt(e.target.value))}
    try {
      setCreatingGoal(true)pan className="badge bg-primary fs-6" style={{ minWidth: '60px' }}>
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          goalData: {<div className="mb-3">
            label: suggestion.title,ress rounded-pill" style={{ height: '12px' }}>
            description: suggestion.description,
            category: 'AI Suggested',ssName="progress-bar rounded-pill" 
            challengeId: selectedChallengeForGoal
          }`${newProgressPercent}%`,
        })= 'goal' ? '#007bff' : '#28a745'
      })
iv>
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create goal')lassName="modal-footer">
      }
      button" 
      // Refresh challenges with goals btn-secondary rounded-pill"
      await fetchChallengesWithGoals(user.email)}
      await fetchProgress(userData.id)
       Cancel
      setShowGoalSelectionModal(false)>
      setSelectedChallengeForGoal(null)
      setAiSuggestedGoals([])button" 
       btn-primary rounded-pill"
      showToast('AI-suggested goal created successfully! 🎯', 'success')
    } catch (error) {
      console.error('Error creating goal from suggestion:', error) <i className="bi bi-check-circle me-1"></i>
      showToast(error.message || 'Failed to create goal', 'error')
    } finally {
      setCreatingGoal(false)
    }
  }
  const fetchProgress = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('progress')      {/* Toast Notification */}
        .select('*')        .eq('user_id', userId)

      if (error) throw error;ssName={`position-fixed top-0 end-0 m-3 p-3 rounded-3 shadow-lg ${
      white'
      setProgress(data || [])
    } catch (error) {le={{ zIndex: 1050, minWidth: '300px' }}
      console.error('Error fetching progress:', error)
    } <div className="d-flex align-items-center">
  }
  const fetchActionPlans = async (userId) => {r' ? '❌' : '✅'}
    try {
      const { data, error } = await supabaselassName="flex-grow-1">{toast.message}</span>            <button 
        .from('action_plans')
        .select('*')age: '', type: 'success' })}
        .eq('user_id', userId)
        .eq('is_complete', false)        .order('created_at', { ascending: false })
  </div>
      if (error) throw error;
      setActionPlans(data || [])
    } catch (error) {      console.error('Error fetching action plans:', error)
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
      
      if (response.ok && data.response) {        // Save the suggested action with status 'suggested'
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
        }
      }
    } catch (error) {
      console.error('Error generating action:', error)
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
      }    } catch (error) {
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
    } catch (error) {
      console.error('Error deleting action:', error)
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
      } else {
        await supabase
          .from('progress')
          .insert({
            user_id: userData.id,
            goal_id: goalId,
            progress_percent: newPercent,
            last_updated: new Date().toISOString()
          })
      }
        await fetchProgress(userData.id);
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };  const initializeProgress = async (itemId, type) => {
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
    
    setSelectedProgressItem(item);
    setProgressType(type);
    setNewProgressPercent(currentProgress);
    setShowProgressModal(true)
  }
    const saveProgress = async () => {
    if (!selectedProgressItem) return

    try {
      console.log('� saveProgress called with:', {
        selectedProgressItem,
        progressType,
        newProgressPercent
      })
      
      // For challenges, we need to use the string challenge_id (how progress is stored)
      const itemId = progressType === 'goal' 
        ? (selectedProgressItem.goal_id || selectedProgressItem.coach_wellness_goals?.goal_id)
        : selectedProgressItem.challenge_id // Use the string challenge_id for challenges

      console.log('� Extracted itemId:', itemId, 'Type:', typeof itemId)

      if (!itemId) {
        console.error('� No itemId found for:', progressType, selectedProgressItem)
        showToast('Failed to update progress - ID not found', 'error')
        return
      }

      if (progressType === 'goal') {
        await updateProgress(itemId, newProgressPercent)
      } else {
        console.log('� Calling updateChallengeProgress with:', itemId, newProgressPercent)
        await updateChallengeProgress(itemId, newProgressPercent)
      }

      setShowProgressModal(false)
      setSelectedProgressItem(null)
      showToast(`${progressType === 'goal' ? 'Goal' : 'Challenge'} progress updated! 📈`)
    } catch (error) {
      console.error('Error saving progress:', error)
      showToast('Failed to update progress', 'error')
    }
  }

  const getProgressForGoal = (goalId) => {
    const goalProgress = progress.find(p => p.goal_id === goalId)
    return goalProgress ? goalProgress.progress_percent : 0
  }
  const getSuggestedActionForGoal = (goalId) => {
    return actionPlans.find(action => 
      action.goal_id === goalId && 
      !action.is_complete &&
      action.status === 'suggested' // Only show pending suggestions in goal cards
    )
  }

  const getAcceptedActions = () => {
    return actionPlans.filter(action =>      !action.is_complete &&
      action.status === 'accepted' // Only show accepted actions in "Today's Recommended Actions"
    )
  }

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
          .insert({
            user_id: userData.id,
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

    try {
      // Find the challenge details
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
          email: user.email,
          goalData: {
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
  const fetchProgress = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('progress')
        .select('*')        .eq('user_id', userId)

      if (error) throw error;
      
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
        .eq('is_complete', false)        .order('created_at', { ascending: false })

      if (error) throw error;
      setActionPlans(data || [])
    } catch (error) {
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
      
      if (response.ok && data.response) {        // Save the suggested action with status 'suggested'
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
        }
      }
    } catch (error) {
      console.error('Error generating action:', error)
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
      }    } catch (error) {
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
    } catch (error) {
      console.error('Error deleting action:', error)
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
      } else {
        await supabase
          .from('progress')
          .insert({
            user_id: userData.id,
            goal_id: goalId,
            progress_percent: newPercent,
            last_updated: new Date().toISOString()
          })
      }
        await fetchProgress(userData.id);
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };  const initializeProgress = async (itemId, type) => {
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
    
    setSelectedProgressItem(item);
    setProgressType(type);
    setNewProgressPercent(currentProgress);
    setShowProgressModal(true)
  }
    const saveProgress = async () => {
    if (!selectedProgressItem) return

    try {
      console.log('� saveProgress called with:', {
        selectedProgressItem,
        progressType,
        newProgressPercent
      })
      
      // For challenges, we need to use the string challenge_id (how progress is stored)
      const itemId = progressType === 'goal' 
        ? (selectedProgressItem.goal_id || selectedProgressItem.coach_wellness_goals?.goal_id)
        : selectedProgressItem.challenge_id // Use the string challenge_id for challenges

      console.log('� Extracted itemId:', itemId, 'Type:', typeof itemId)

      if (!itemId) {
        console.error('� No itemId found for:', progressType, selectedProgressItem)
        showToast('Failed to update progress - ID not found', 'error')
        return
      }

      if (progressType === 'goal') {
        await updateProgress(itemId, newProgressPercent)
      } else {
        console.log('� Calling updateChallengeProgress with:', itemId, newProgressPercent)
        await updateChallengeProgress(itemId, newProgressPercent)
      }

      setShowProgressModal(false)
      setSelectedProgressItem(null)
      showToast(`${progressType === 'goal' ? 'Goal' : 'Challenge'} progress updated! 📈`)
    } catch (error) {
      console.error('Error saving progress:', error)
      showToast('Failed to update progress', 'error')
    }
  }
