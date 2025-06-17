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
  const [progress, setProgress] = useState([])
  const [actionPlans, setActionPlans] = useState([])
  const [suggestingGoal, setSuggestingGoal] = useState(null)
  const [recentAchievement, setRecentAchievement] = useState(null)
  const [expandedGoals, setExpandedGoals] = useState(new Set())
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [availableGoals, setAvailableGoals] = useState([])
  const [newGoalLabel, setNewGoalLabel] = useState('')
  const [newGoalDescription, setNewGoalDescription] = useState('')
  const [creatingGoal, setCreatingGoal] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const router = useRouter()

  // Toast notification function
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000)
  }
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      
      setUser(session.user)
      await fetchUserData(session.user.email)
      await fetchAvailableGoals() // Add this line
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        await fetchUserData(session.user.email)
        await fetchAvailableGoals() // Add this line too
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserData = async (email) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/gptRouter?email=${encodeURIComponent(email)}`)
      const data = await response.json()
        if (response.ok) {
        setUserData(data)
        await Promise.all([
          fetchUserGoals(data.id),
          fetchProgress(data.id),
          fetchActionPlans(data.id)
        ])
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
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
          )
        `)
        .eq('user_id', userId)

      if (error) throw error
      setUserGoals(data || [])
    } catch (error) {
      console.error('Error fetching user goals:', error)
    }
  }
  const fetchAvailableGoals = async () => {
    try {
      console.log('Fetching available goals...')
      const { data, error } = await supabase
        .from('coach_wellness_goals')
        .select('*')
        .order('label')

      if (error) throw error
      console.log('Available goals fetched:', data?.length || 0)
      setAvailableGoals(data || [])
    } catch (error) {
      console.error('Error fetching available goals:', error)
    }
  }

  const addGoalToUser = async (goalId) => {
    try {
      console.log('Adding goal to user:', goalId, user?.email)
      setCreatingGoal(true)
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          goalId: goalId
        })
      })

      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', data)
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add goal')
      }      // Close modal first
      setShowGoalModal(false)
      
      // Update the userGoals state directly instead of refetching
      if (data.goal) {
        setUserGoals(prev => [...prev, data.goal])
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
      }

      // Refresh user goals
      await fetchUserGoals(user.id)
      setShowGoalModal(false)
      setNewGoalLabel('')
      setNewGoalDescription('')
      
      // Show success message
      alert('Custom goal created successfully!')
    } catch (error) {
      console.error('Error creating custom goal:', error)
      alert(error.message || 'Failed to create custom goal')
    } finally {
      setCreatingGoal(false)
    }
  }

  const fetchProgress = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('progress')
        .select('*')
        .eq('user_id', userId)

      if (error) throw error
      setProgress(data || [])
    } catch (error) {
      console.error('Error fetching progress:', error)
    }
  }

  const fetchActionPlans = async (userId) => {
    try {
      console.log('📋 Fetching action plans for user:', userId)
      const { data, error } = await supabase
        .from('action_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_complete', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      console.log('📋 Action plans fetched:', data?.length || 0, 'plans')
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
      
      await fetchProgress(userData.id)
    } catch (error) {
      console.error('Error updating progress:', error)
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
  }

  // Helper functions
  const toggleGoalExpanded = (goalId) => {
    const newExpanded = new Set(expandedGoals)
    if (newExpanded.has(goalId)) {
      newExpanded.delete(goalId)
    } else {
      newExpanded.add(goalId)
    }
    setExpandedGoals(newExpanded)
  }

  const getTimeOfDayGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

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
      {/* Header Section - Sticky */}
      <div className="sticky-top bg-gradient" style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        marginTop: '-1.5rem',
        marginLeft: '-15px',
        marginRight: '-15px',
        padding: '2rem 15px 1.5rem'
      }}>
        <div className="container">
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="text-white mb-0 fw-bold fs-2">
              👋 {getTimeOfDayGreeting()}, {displayName}!
            </h1>
            <span className="badge bg-light text-dark rounded-pill px-3 py-2 fs-6">
              <strong>Tokens: {userData?.tokens || 0}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="container" style={{ maxWidth: '600px', marginTop: '2rem' }}>
        
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

        {/* Wellness Progress Section */}
        <div className="card shadow-lg rounded-4 mb-4">
          <div className="card-body p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 className="card-title fw-bold mb-0">Your Wellness Progress</h2>              <button 
                className="btn btn-primary rounded-pill"
                onClick={() => setShowGoalModal(true)}
              >
                <i className="bi bi-plus-circle me-1"></i>Add Goal
              </button>
            </div>
            
            {userGoals.length === 0 ? (
              <div className="text-center py-5">
                <div className="fs-1 mb-3">🎯</div>
                <h4 className="text-muted mb-2">No wellness goals yet</h4>
                <p className="text-muted">Let's set up your first wellness goal to get started!</p>                <button 
                  className="btn btn-primary rounded-pill mt-2"
                  onClick={() => {
                    setShowGoalModal(true)
                    fetchAvailableGoals()
                  }}
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
                const isExpanded = expandedGoals.has(goal.goal_id)
                
                return (
                  <div key={userGoal.id} className="card border-0 shadow-sm rounded-3 mb-3">
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="flex-grow-1">
                          <h5 className="card-title fw-bold mb-1 d-flex align-items-center">
                            {goal.label}
                            {streakDays > 0 && (
                              <span className="badge bg-warning text-dark rounded-pill ms-2 fs-6">
                                🔥 {streakDays}-day streak!
                              </span>
                            )}
                          </h5>
                        </div>
                        <div className="dropdown">
                          <button className="btn btn-sm btn-outline-secondary rounded-pill" type="button" data-bs-toggle="dropdown">
                            <i className="bi bi-three-dots"></i>
                          </button>
                          <ul className="dropdown-menu">
                            <li>
                              <a className="dropdown-item" href="#" 
                                 onClick={() => {
                                   const newProgress = prompt(`Update progress for ${goal.label} (0-100):`, progressPercent)
                                   if (newProgress !== null && !isNaN(newProgress)) {
                                     updateProgress(goal.goal_id, Math.min(100, Math.max(0, parseInt(newProgress))))
                                   }
                                 }}>
                                <i className="bi bi-pencil me-2"></i>Update Progress
                              </a>
                            </li>
                            <li><a className="dropdown-item text-danger" href="#"><i className="bi bi-trash me-2"></i>Remove Goal</a></li>
                          </ul>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="progress rounded-pill" style={{ height: '8px' }}>
                          <div 
                            className="progress-bar rounded-pill" 
                            style={{ 
                              width: `${progressPercent}%`,
                              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                            }}
                          ></div>
                        </div>
                        <small className="text-muted">{progressPercent}% complete</small>
                      </div>
                      
                      {/* Action Area */}
                      <div className="mb-2">
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
                                <button 
                                  className="btn btn-outline-primary btn-sm rounded-pill"
                                  onClick={() => generateSuggestedAction(goal.goal_id, goal.label)}
                                  disabled={suggestingGoal === goal.goal_id}
                                >
                                  <i className="bi bi-arrow-clockwise me-1"></i>
                                  {suggestingGoal === goal.goal_id ? 'Generating...' : 'Suggest Another'}
                                </button>
                              </div>
                            </div>
                          </div>                        ) : (
                          <div className="text-center py-3">
                            <div className="mb-2">
                              <i className="bi bi-lightbulb text-muted" style={{ fontSize: '1.5rem' }}></i>
                            </div>
                            <p className="small text-muted mb-3">No action suggestions yet</p>                            <button 
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
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Today's Recommended Actions */}
        <div className="card shadow-lg rounded-4 mb-4">
          <div className="card-body p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 className="card-title fw-bold mb-0">Today's Recommended Actions</h2>
              <button className="btn btn-outline-primary rounded-pill">
                <i className="bi bi-plus-circle me-1"></i>Add My Own
              </button>
            </div>
            
            {getAcceptedActions().length === 0 ? (
              <div className="text-center py-4">
                <div className="fs-1 mb-3">📝</div>
                <h5 className="text-muted mb-2">No actions for today</h5>
                <p className="text-muted">Accept some suggestions from your goals above!</p>
                <div className="alert alert-info rounded-3 mt-3">
                  <i className="bi bi-info-circle me-2"></i>
                  <strong>Keep your streak!</strong> Daily check-ins help build healthy habits.
                </div>
              </div>
            ) : (
              <>
                <div className="alert alert-info rounded-3 mb-3">
                  <i className="bi bi-calendar-check me-2"></i>
                  <strong>Keep your streak!</strong> You have {getAcceptedActions().length} action{getAcceptedActions().length !== 1 ? 's' : ''} to complete today.
                </div>
                
                {getAcceptedActions().map((action, index) => (
                  <div key={action.id} className="toast-container position-relative mb-2">
                    <div className="card border-0 bg-light rounded-3 shadow-sm">
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="small text-muted mb-1">
                              <i className="bi bi-robot me-1"></i>[AI Coach]:
                            </div>
                            <p className="mb-0">"{action.action_text}"</p>
                          </div>
                          <div className="d-flex gap-1 ms-3">
                            <button 
                              className="btn btn-primary btn-sm rounded-pill"
                              onClick={() => markActionDone(action.id, action.goal_id)}
                            >
                              <i className="bi bi-check-circle me-1"></i>Mark as Done
                            </button>
                            <button className="btn btn-sm btn-outline-secondary rounded-circle">
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button className="btn btn-sm btn-outline-danger rounded-circle">
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
            💬 Chat about my progress with your AI Coach
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
      `}</style>

      {/* Goal Selection Modal */}
      {showGoalModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-star me-2"></i>Add a Wellness Goal
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setShowGoalModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="row">
                  <div className="col-md-8">
                    <h6 className="fw-bold mb-3">Choose from Popular Goals</h6>                    <div className="row g-2">
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
              </div>
            </div>
          </div>
        </div>      )}

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
            <span className="flex-grow-1">{toast.message}</span>
            <button 
              className="btn-close btn-close-white ms-2" 
              onClick={() => setToast({ show: false, message: '', type: 'success' })}
              style={{ fontSize: '0.8rem' }}
            ></button>
          </div>
        </div>
      )}
    </Layout>
  )
}
