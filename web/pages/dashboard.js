import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import Link from 'next/link'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userGoals, setUserGoals] = useState([])
  const [userChallenges, setUserChallenges] = useState([])
  const [activeTab, setActiveTab] = useState('goals')
  const [progress, setProgress] = useState([])
  const [actionPlans, setActionPlans] = useState([])
  const [suggestingGoal, setSuggestingGoal] = useState(null)
  const [recentAchievement, setRecentAchievement] = useState(null)
  const [expandedGoals, setExpandedGoals] = useState(new Set())
  const [showGoalModal, setShowGoalModal] = useState(false)
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
              fetchAvailableGoals(),
              fetchAvailableChallenges()
            ]).catch(authError => {
              console.error('Error in auth state change:', authError)
              if (mounted) setLoading(false)
            })
          }
        } else {
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
    try {
      setLoading(true)
      console.log('Fetching user data for:', email)
      
      const response = await fetch(`/api/gptRouter?email=${encodeURIComponent(email)}`)
      const data = await response.json()

      if (response.ok) {
        console.log('User data fetched successfully:', data.id)
        setUserData(data)
        await Promise.all([
          fetchUserGoals(data.id),
          fetchUserChallenges(data.id),
          fetchProgress(data.id),
          fetchActionPlans(data.id)
        ])
      } else {
        console.error('Failed to fetch user data:', data)
        throw new Error(data.error || 'Failed to fetch user data')
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
      // Don't keep retrying on error - just show the error
      showToast('Failed to load user data. Please refresh the page.', 'error')
    } finally {
      setLoading(false)
    }
  }
  const fetchUserGoals = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_wellness_goals')
        .select(`
          id,
          coach_wellness_goals (
            id,
            goal_id,
            label,
            description
          )        `)
        .eq('user_id', userId)

      if (error) throw error;
      setUserGoals(data || [])
    } catch (error) {
      console.error('Error fetching user goals:', error)
    }
  }
  
  const fetchAvailableGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('coach_wellness_goals')
        .select('*')        .order('label')

      if (error) throw error;
      setAvailableGoals(data || [])
    } catch (error) {
      console.error('Error fetching available goals:', error)
    }
  }
  const fetchUserChallenges = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_challenges')
        .select(`
          id,
          coach_challenge_id,
          coach_challenges (
            id,
            challenge_id,
            label,
            description
          )
        `)
        .eq('user_id', userId)

      if (error) throw error;
      setUserChallenges(data || [])
    } catch (error) {
      console.error('Error fetching user challenges:', error)
    }
  }
  
  const fetchAvailableChallenges = async () => {
    try {
      const { data, error } = await supabase
        .from('coach_challenges')
        .select('*')
        .order('label')

      if (error) throw error;
      setAvailableChallenges(data || [])
    } catch (error) {
      console.error('Error fetching available challenges:', error)
    }
  }
  
  const addGoalToUser = async (goalId) => {
    try {
      setCreatingGoal(true)
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          goalId: goalId
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add goal')
      }
      
      // Close modal first
      setShowGoalModal(false)
      
      // Update the userGoals state directly instead of refetching
      if (data.goal) {
        setUserGoals(prev => [...prev, data.goal])
        // Refresh progress data to show the initial 0% progress
        await fetchProgress(userData.id)
        showToast('Goal added successfully! 🎯')
      }
      
    } catch (error) {
      console.error('Error adding goal:', error)
      // Show error in a more user-friendly way
      setShowGoalModal(false)
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
            category: 'Custom'
          }
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create goal')
      }      // Refresh user goals
      await fetchUserGoals(userData.id)
      setShowGoalModal(false)
      setNewGoalLabel('')
      setNewGoalDescription('')
      
      // Initialize progress record for the new custom goal
      // Note: The goal_id for custom goals is generated in the API
      // We'll fetch the latest goals to get the proper goal_id
      await fetchProgress(userData.id)
      
      // Show success message
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      
      // Update the userChallenges state directly instead of refetching
      if (data.challenge) {
        setUserChallenges(prev => [...prev, data.challenge])
        // Refresh progress data to show the initial 0% progress
        await fetchProgress(userData.id)
        showToast('Challenge added successfully! 💪')
      }
      
    } catch (error) {
      console.error('Error adding challenge:', error)
      // Show error in a more user-friendly way
      setShowGoalModal(false)
      showToast(error.message || 'Failed to add challenge', 'error')
    } finally {
      setCreatingGoal(false)
    }
  }

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
      }      // Refresh user challenges
      await fetchUserChallenges(userData.id)
      setShowGoalModal(false)
      setNewGoalLabel('')
      setNewGoalDescription('')
      
      // Initialize progress record for the new custom challenge
      await fetchProgress(userData.id)
      
      // Show success message
      showToast('Custom challenge created successfully! 💪')
    } catch (error) {
      console.error('Error creating custom challenge:', error)
      showToast(error.message || 'Failed to create custom challenge', 'error')    } finally {
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
      }
    } catch (error) {
      console.error('Error marking action done:', error)
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
  };
  const updateChallengeProgress = async (challengeId, newPercent) => {
    try {
      const currentProgress = progress.find(p => p.challenge_id === challengeId)
      
      if (currentProgress) {
        const { data, error } = await supabase
          .from('progress')
          .update({ 
            progress_percent: newPercent,
            last_updated: new Date().toISOString()
          })
          .eq('id', currentProgress.id)
          .select()
          
        if (error) {
          console.error('Update error:', error)
          throw error
        }
      } else {
        const insertData = {
          user_id: userData.id,
          challenge_id: challengeId,
          progress_percent: newPercent,
          last_updated: new Date().toISOString()
        }
        
        const { data, error } = await supabase
          .from('progress')
          .insert(insertData)
          .select()
          
        if (error) {
          console.error('Insert error:', error)
          throw error
        }
      }
      
      // Force refresh the progress data
      await fetchProgress(userData.id)
    } catch (error) {
      console.error('Error updating challenge progress:', error)
      throw error // Re-throw so the UI can show the error
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
    // For challenges, we need to use the string challenge_id (how progress is stored)
    const challengeId = type === 'challenge' ? item.challenge_id : null
    const goalId = type === 'goal' ? (item.goal_id || item.coach_wellness_goals?.goal_id) : null
    
    const currentProgress = type === 'goal' 
      ? getProgressForGoal(goalId)
      : getChallengeProgress(challengeId)
    
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
    return actionPlans.filter(action => 
      !action.is_complete &&
      action.status === 'accepted' // Only show accepted actions in "Today's Recommended Actions"
    )
  }  // Challenge-specific helper functions
  const getChallengeProgress = (challengeId) => {
    const challengeProgress = progress.find(p => p.challenge_id === challengeId)
    return challengeProgress ? challengeProgress.progress_percent : 0
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

  // ...existing code...

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
        marginBottom: '2rem'
      }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          borderRadius: '16px',
          padding: '2rem 1.5rem'
        }}>
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="text-white mb-0 fw-bold" style={{ 
              fontSize: '2.25rem',
              lineHeight: '1.2',
              letterSpacing: '-0.025em'
            }}>
              👋 Your Wellness<br />Progress
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
              Add Goal or Challenge
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="container" style={{ 
        maxWidth: '600px', 
        padding: '0 24px'
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
          </div>        )}
        
        {/* Wellness Progress Section with Tabs */}
        <div className="card shadow-lg rounded-4 mb-4">
          <div className="card-body p-4">
            
            {/* Goals and Challenges Side by Side */}
            <div className="row g-4 mb-4">
              
              {/* Goals Column */}
              <div className="col-md-6">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h3 className="fw-bold mb-0" style={{ color: '#007bff' }}>Goals</h3>
                </div>
                
                {userGoals.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="fs-3 mb-3">🎯</div>
                    <h5 className="text-muted mb-2">No wellness goals yet</h5>
                    <p className="text-muted small">Let's set up your first wellness goal!</p>
                    <button 
                      className="btn btn-primary rounded-pill mt-2"
                      onClick={() => setShowGoalModal(true)}
                    >
                      <i className="bi bi-star me-1"></i>Create Your First Goal
                    </button>
                  </div>
                ) : (
                  userGoals.map((userGoal) => {
                    const goal = userGoal.coach_wellness_goals
                    const progressPercent = getProgressForGoal(goal.goal_id)
                    const suggestedAction = getSuggestedActionForGoal(goal.goal_id)
                    const streakDays = getStreakDays(goal.goal_id)
                    
                    return (                      <div key={userGoal.id} className="card border-0 shadow-sm rounded-3 mb-3">
                        <div className="card-body p-4">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <h5 className="card-title fw-bold mb-0">{goal.label}</h5>
                            <button 
                              className="btn btn-outline-primary btn-sm rounded-pill"
                              onClick={() => openProgressModal(goal, 'goal')}
                            >
                              <i className="bi bi-arrow-up-circle me-1"></i>Update
                            </button>
                          </div>
                          <p className="text-muted mb-3">{progressPercent}% complete</p>
                          
                          {/* Progress Bar */}
                          <div className="mb-4">
                            <div className="progress rounded-pill" style={{ height: '8px', backgroundColor: '#e9ecef' }}>
                              <div 
                                className="progress-bar rounded-pill" 
                                style={{ 
                                  width: `${progressPercent}%`,
                                  backgroundColor: '#007bff'
                                }}
                              ></div>
                            </div>
                          </div>
                          
                          {/* Action Area */}
                          {suggestedAction ? (
                            <div className="card bg-light border-0 rounded-3">
                              <div className="card-body p-3">
                                <div className="small text-muted mb-1">Suggested Action</div>
                                <p className="mb-3">{suggestedAction.action_text}</p>
                                <div className="d-flex gap-2">
                                  <button 
                                    className="btn btn-primary btn-sm rounded-pill"
                                    onClick={() => acceptSuggestedAction(suggestedAction.id)}
                                  >
                                    <i className="bi bi-check-circle me-1"></i>Accept
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-3">
                              <div className="mb-2">
                                <i className="bi bi-lightbulb text-muted" style={{ fontSize: '2rem' }}></i>
                              </div>
                              <p className="text-muted mb-3">No action suggestions yet</p>
                              <button 
                                className="btn btn-primary rounded-pill"
                                onClick={() => generateSuggestedAction(goal.goal_id, goal.label)}
                                disabled={suggestingGoal === goal.goal_id}
                              >
                                <i className="bi bi-star me-1"></i>
                                {suggestingGoal === goal.goal_id ? 'Generating suggestion...' : 'Get AI Suggestion'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })                )}
              </div>
              
              {/* Challenges Column */}
              <div className="col-md-6">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h3 className="fw-bold mb-0">Challenges</h3>
                </div>
                {userChallenges.length === 0 ? (
                  <div className="text-center py-5">
                    <div className="fs-1 mb-3">💪</div>
                    <h4 className="text-muted mb-2">No challenges tracked yet</h4>
                    <p className="text-muted">Start tracking a challenge you'd like to overcome!</p>
                    <button 
                      className="btn btn-primary rounded-pill mt-2"
                      onClick={() => setShowGoalModal(true)}
                    >
                      <i className="bi bi-shield-check me-1"></i>Add Your First Challenge
                    </button>                  </div>
                ) : (                  userChallenges.map((userChallenge) => {
                    const challenge = userChallenge.coach_challenges
                    
                    // Use the challenge_id string for progress (this is how it's stored in the API)
                    const progressPercent = getChallengeProgress(challenge.challenge_id)
                    const suggestedAction = getSuggestedActionForChallenge(challenge.challenge_id) // Keep string ID for action plans
                    
                    return (<div key={userChallenge.id} className="card border-0 shadow-sm rounded-3 mb-3">
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="flex-grow-1">
                              <h5 className="card-title fw-bold mb-1 d-flex align-items-center">
                                <span className="me-2" style={{ color: '#dc3545', fontSize: '0.8rem' }}>🔴</span>
                                {challenge.label}
                              </h5>
                              <p className="text-muted small mb-0">{challenge.description}</p>
                            </div>
                            <button 
                              className="btn btn-outline-success btn-sm rounded-pill"
                              onClick={() => openProgressModal(challenge, 'challenge')}
                            >
                              <i className="bi bi-arrow-up-circle me-1"></i>Update
                            </button>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="mb-3">
                            <div className="progress rounded-pill" style={{ height: '8px' }}>
                              <div 
                                className="progress-bar rounded-pill bg-success" 
                                style={{ width: `${progressPercent}%` }}
                              ></div>
                            </div>
                            <small className="text-muted">{progressPercent}% complete</small>
                          </div>
                          
                          {/* Action Area */}
                          {suggestedAction ? (
                            <div className="card bg-light border-0 rounded-3">
                              <div className="card-body p-3">
                                <div className="small text-muted mb-1">Suggested Action</div>
                                <p className="mb-3">{suggestedAction.action_text}</p>
                                <div className="d-flex gap-2">
                                  <button 
                                    className="btn btn-success btn-sm rounded-pill"
                                    onClick={() => acceptSuggestedAction(suggestedAction.id)}
                                  >
                                    <i className="bi bi-check-circle me-1"></i>Accept
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-3">
                              <button 
                                className="btn btn-primary rounded-pill"
                                onClick={() => generateChallengeAction(challenge.challenge_id, challenge.label)}
                                disabled={suggestingGoal === challenge.challenge_id}
                              >
                                <i className="bi bi-list me-1"></i>
                                {suggestingGoal === challenge.challenge_id ? 'Generating...' : 'View Actions'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Groping to Recommended Actions - Separate Card */}
        <div className="card shadow-lg rounded-4 mb-4">
          <div className="card-body p-4">
            <h3 className="fw-bold mb-4">Groping to Recommended Actions</h3>
              
              {getAcceptedActions().length === 0 ? (
                <div className="text-center py-4">
                  <div className="fs-4 mb-3">📝</div>
                  <h5 className="text-muted mb-2">No actions for today</h5>
                  <p className="text-muted">Accept some suggestions from your goals above!</p>
                </div>
              ) : (
                <>
                  <div className="alert alert-info rounded-3 mb-3 border-0">
                    <i className="bi bi-calendar-check me-2"></i>
                    <strong>Keep your streak!</strong> You have {getAcceptedActions().length} action{getAcceptedActions().length !== 1 ? 's' : ''} to complete today.
                  </div>
                  
                  {getAcceptedActions().map((action, index) => (
                    <div key={action.id} className="card border-0 bg-light rounded-3 shadow-sm mb-3">
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="small text-muted mb-1">
                              <i className="bi bi-robot me-1"></i>[AI Coach]:
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
                            <button className="btn btn-outline-secondary rounded-circle p-2">
                              <i className="bi bi-pencil" style={{ fontSize: '0.9rem' }}></i>
                            </button>
                            <button className="btn btn-outline-danger rounded-circle p-2">
                              <i className="bi bi-trash" style={{ fontSize: '0.9rem' }}></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Persistent Chat CTA - Fixed at bottom */}
        <div className="position-fixed bottom-0 start-0 end-0 p-3" style={{ zIndex: 1000 }}>
          <div className="container" style={{ maxWidth: '600px' }}>
            <Link href="/chat" className="btn btn-primary w-100 rounded-pill py-3 shadow-lg text-decoration-none">
              <i className="bi bi-chat-dots me-2"></i>
              Chat about my progress with your AI Coach
            </Link>
          </div>
        </div>

      {/* Bottom padding to account for fixed chat button */}
      <div style={{ height: '100px' }}></div>

      <style jsx>{`
        .bg-gradient {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        }
        
        .card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .card:hover {
          transform: translateY(-2px);
        }
        
        .progress-bar {
          transition: width 0.3s ease;
        }
        
        .btn {
          transition: all 0.2s ease;
        }
        
        .btn:hover {
          transform: translateY(-1px);
        }
        
        .toast-container {
          animation: fadeInUp 0.3s ease;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .alert {
          border: none;
        }
        
        .shadow-lg {
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
        }
          .shadow-sm {
          box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important;
        }

        .goal-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
          transition: all 0.2s ease-in-out;
        }

        .modal {
          z-index: 1060;
        }
      `}</style>      {/* Goal/Challenge Selection Modal */}
      {showGoalModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-star me-2"></i>Add Goal or Challenge
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setShowGoalModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4">
                {/* Modal Tabs */}
                <div className="nav nav-pills justify-content-center mb-4" style={{ backgroundColor: '#f8f9fa', borderRadius: '25px', padding: '4px' }}>
                  <button 
                    className={`nav-link rounded-pill px-4 ${activeTab === 'goals' ? 'active' : ''}`}
                    onClick={() => setActiveTab('goals')}
                    style={{ 
                      backgroundColor: activeTab === 'goals' ? '#007bff' : 'transparent',
                      color: activeTab === 'goals' ? 'white' : '#6c757d',
                      border: 'none'
                    }}
                  >
                    Goals
                  </button>
                  <button 
                    className={`nav-link rounded-pill px-4 ${activeTab === 'challenges' ? 'active' : ''}`}
                    onClick={() => setActiveTab('challenges')}
                    style={{ 
                      backgroundColor: activeTab === 'challenges' ? '#007bff' : 'transparent',
                      color: activeTab === 'challenges' ? 'white' : '#6c757d',
                      border: 'none'
                    }}
                  >
                    Challenges
                  </button>
                </div>

                {/* Goals Tab */}
                {activeTab === 'goals' && (
                  <div className="row">
                    <div className="col-md-8">
                      <h6 className="fw-bold mb-3">Choose from Popular Goals</h6>
                      <div className="row g-2">
                        {availableGoals.slice(0, 8).map((goal) => (
                          <div key={goal.id} className="col-sm-6">
                            <div 
                              className="card border-0 bg-light h-100 goal-card"
                              style={{ cursor: 'pointer' }}
                              onClick={() => addGoalToUser(goal.id)}
                            >
                              <div className="card-body p-3">
                                <h6 className="card-title mb-1">{goal.label}</h6>
                                <p className="card-text small text-muted mb-0">
                                  {goal.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="col-md-4">
                      <h6 className="fw-bold mb-3">Create Custom Goal</h6>
                      <div className="card border-0 bg-light">
                        <div className="card-body p-3">
                          <div className="mb-3">
                            <label className="form-label small fw-bold">Goal Title</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g., Read 30 minutes daily"
                              value={newGoalLabel}
                              onChange={(e) => setNewGoalLabel(e.target.value)}
                            />
                          </div>
                          <div className="mb-3">
                            <label className="form-label small fw-bold">Description (Optional)</label>
                            <textarea
                              className="form-control"
                              rows="3"
                              placeholder="Describe your goal..."
                              value={newGoalDescription}
                              onChange={(e) => setNewGoalDescription(e.target.value)}
                            />
                          </div>
                          <button
                            className="btn btn-success w-100"
                            onClick={createCustomGoal}
                            disabled={creatingGoal || !newGoalLabel.trim()}
                          >
                            {creatingGoal ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                Creating...
                              </>
                            ) : (
                              <>
                                <i className="bi bi-plus-circle me-1"></i>
                                Create Goal
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Challenges Tab */}
                {activeTab === 'challenges' && (
                  <div className="row">
                    <div className="col-md-8">
                      <h6 className="fw-bold mb-3">Choose from Common Challenges</h6>
                      <div className="row g-2">
                        {availableChallenges.slice(0, 8).map((challenge) => (
                          <div key={challenge.id} className="col-sm-6">
                            <div 
                              className="card border-0 bg-light h-100 goal-card"
                              style={{ cursor: 'pointer' }}
                              onClick={() => addChallengeToUser(challenge.id)}
                            >
                              <div className="card-body p-3">
                                <h6 className="card-title mb-1 d-flex align-items-center">
                                  <span className="me-2" style={{ color: '#dc3545', fontSize: '0.8rem' }}>🔴</span>
                                  {challenge.label}
                                </h6>
                                <p className="card-text small text-muted mb-0">
                                  {challenge.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="col-md-4">
                      <h6 className="fw-bold mb-3">Create Custom Challenge</h6>
                      <div className="card border-0 bg-light">
                        <div className="card-body p-3">
                          <div className="mb-3">
                            <label className="form-label small fw-bold">Challenge Title</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g., Overcoming Social Anxiety"
                              value={newGoalLabel}
                              onChange={(e) => setNewGoalLabel(e.target.value)}
                            />
                          </div>
                          <div className="mb-3">
                            <label className="form-label small fw-bold">Description (Optional)</label>
                            <textarea
                              className="form-control"
                              rows="3"
                              placeholder="Describe your challenge..."
                              value={newGoalDescription}
                              onChange={(e) => setNewGoalDescription(e.target.value)}
                            />
                          </div>
                          <button
                            className="btn btn-warning w-100"
                            onClick={createCustomChallenge}
                            disabled={creatingGoal || !newGoalLabel.trim()}
                          >
                            {creatingGoal ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                Creating...
                              </>
                            ) : (
                              <>
                                <i className="bi bi-shield-check me-1"></i>
                                Create Challenge
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Update Modal */}
      {showProgressModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-arrow-up-circle me-2"></i>
                  Update {progressType === 'goal' ? 'Goal' : 'Challenge'} Progress
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setShowProgressModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4">                <div className="mb-3">
                  <h6 className="fw-bold mb-2">
                    {progressType === 'goal' 
                      ? (selectedProgressItem?.label || selectedProgressItem?.coach_wellness_goals?.label)
                      : (selectedProgressItem?.label) // For challenges, the item IS the coach_challenges object
                    }
                  </h6>
                  <p className="text-muted small mb-3">
                    {progressType === 'goal' 
                      ? (selectedProgressItem?.description || selectedProgressItem?.coach_wellness_goals?.description)
                      : (selectedProgressItem?.description) // For challenges, the item IS the coach_challenges object
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
                      step="5"
                      value={newProgressPercent} 
                      onChange={(e) => setNewProgressPercent(parseInt(e.target.value))}
                    />
                    <span className="badge bg-primary fs-6" style={{ minWidth: '60px' }}>
                      {newProgressPercent}%
                    </span>
                  </div>
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
                >
                  <i className="bi bi-check-circle me-1"></i>
                  Save Progress
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div 
          className={`position-fixed top-0 end-0 m-3 p-3 rounded-3 shadow-lg ${
            toast.type === 'error' ? 'bg-danger text-white' : 'bg-success text-white'
          }`}
          style={{ zIndex: 1050, minWidth: '300px' }}
        >
          <div className="d-flex align-items-center">
            <span className="me-2">
              {toast.type === 'error' ? '❌' : '✅'}
            </span>
            <span className="flex-grow-1">{toast.message}</span>            <button 
              className="btn-close btn-close-white ms-2" 
              onClick={() => setToast({ show: false, message: '', type: 'success' })}
              style={{ fontSize: '0.8rem' }}
            ></button>
          </div>        </div>
      )}    </Layout>
  )
}