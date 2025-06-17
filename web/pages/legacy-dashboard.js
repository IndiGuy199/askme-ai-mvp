import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import Link from 'next/link'
import styles from '../styles/EnhancedDashboard.module.css'

export default function EnhancedDashboard() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userGoals, setUserGoals] = useState([])
  const [progress, setProgress] = useState([])
  const [actionPlans, setActionPlans] = useState([])
  const [suggestingGoal, setSuggestingGoal] = useState(null)
  const [recentAchievement, setRecentAchievement] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      
      setUser(session.user)
      await fetchUserData(session.user.email)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        await fetchUserData(session.user.email)
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
      <Layout title="Enhanced Dashboard">
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
        </div>
      </Layout>
    )
  }

  const displayName = userData?.first_name || user?.user_metadata?.first_name || user?.email?.split('@')[0]

  return (
    <Layout title="Enhanced Dashboard">
      <div className={styles.enhancedDashboard}>
        
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.greeting}>
            {getTimeOfDayGreeting()}, {displayName}!
          </h1>
          <div className={styles.tokenBalance}>
            <strong>Token Balance: {userData?.tokens || 0}</strong>
            <Link href="/buy-tokens" className={styles.buyTokensLink}>
              Buy More
            </Link>
          </div>
        </div>

        {/* Achievement Banner */}
        {recentAchievement && (
          <div className={styles.achievementBanner}>
            <div className={styles.achievementIcon}>🏆</div>
            <div className={styles.achievementText}>
              <h3 className={styles.achievementTitle}>{recentAchievement.title}</h3>
              <p className={styles.achievementDesc}>{recentAchievement.description}</p>
            </div>
          </div>
        )}

        {/* Wellness Progress Section */}
        <div className={styles.progressSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Your Wellness Progress</h2>
            <button className={styles.addButton}>+ Add Goal</button>
          </div>
          
          {userGoals.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🎯</div>
              <div className={styles.emptyTitle}>No wellness goals yet</div>
              <div className={styles.emptyDesc}>Let's set up your first wellness goal to get started!</div>
            </div>
          ) : (
            userGoals.map((userGoal) => {
              const goal = userGoal.coach_wellness_goals
              const progressPercent = getProgressForGoal(goal.goal_id)
              const suggestedAction = getSuggestedActionForGoal(goal.goal_id)
              const streakDays = getStreakDays(goal.goal_id)
              
              return (
                <div key={userGoal.id} className={styles.goalCard}>
                  <div className={styles.goalHeader}>
                    <div>
                      <h3 className={styles.goalTitle}>
                        {goal.label}
                        {streakDays > 0 && (
                          <span style={{ marginLeft: '1rem', fontSize: '0.9rem', color: '#48bb78' }}>
                            🔥 {streakDays} day streak!
                          </span>
                        )}
                      </h3>
                    </div>
                    <button 
                      className={styles.updateButton}
                      onClick={() => {
                        const newProgress = prompt(`Update progress for ${goal.label} (0-100):`, progressPercent)
                        if (newProgress !== null && !isNaN(newProgress)) {
                          updateProgress(goal.goal_id, Math.min(100, Math.max(0, parseInt(newProgress))))
                        }
                      }}
                    >
                      Update
                    </button>
                  </div>
                  
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill}
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  <div className={styles.progressText}>{progressPercent}% complete</div>
                  
                  {suggestedAction ? (
                    <div className={styles.suggestedAction}>
                      <div className={styles.actionLabel}>Suggested Action</div>
                      <div className={styles.actionText}>{suggestedAction.action_text}</div>
                      <div className={styles.actionButtons}>
                        <button 
                          className={styles.acceptButton}
                          onClick={() => acceptSuggestedAction(suggestedAction.id)}
                        >
                          ✓ Accept
                        </button>
                        <button 
                          className={styles.suggestButton}
                          onClick={() => generateSuggestedAction(goal.goal_id, goal.label)}
                          disabled={suggestingGoal === goal.goal_id}
                        >
                          {suggestingGoal === goal.goal_id ? '...' : '↻ Suggest Another'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.suggestedAction}>
                      <button 
                        className={styles.acceptButton}
                        onClick={() => generateSuggestedAction(goal.goal_id, goal.label)}
                        disabled={suggestingGoal === goal.goal_id}
                        style={{ width: '100%' }}
                      >
                        {suggestingGoal === goal.goal_id ? 'Generating suggestion...' : '✨ Get AI Suggestion'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>        {/* Today's Recommended Actions */}
        <div className={styles.actionsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Today's Recommended Actions</h2>
            <button className={styles.addButton}>+ Add My Own</button>
          </div>
          
          {getAcceptedActions().length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📝</div>
              <div className={styles.emptyTitle}>No actions for today</div>
              <div className={styles.emptyDesc}>Accept some suggestions from your goals above!</div>
            </div>
          ) : (
            getAcceptedActions().map((action) => (
              <div key={action.id} className={styles.actionCard}>
                <div className={styles.actionContent}>
                  <div className={styles.actionSource}>[AI Coach]:</div>
                  <div className={styles.actionDescription}>"{action.action_text}"</div>
                </div>
                <button 
                  className={styles.markDoneButton}
                  onClick={() => markActionDone(action.id, action.goal_id)}
                >
                  ✓ Mark as Done
                </button>
              </div>
            ))
          )}
        </div>

        {/* Chat with Coach */}
        <div className={styles.chatSection}>
          <Link href="/chat" className={styles.chatButton}>
            💬 Chat about my progress with your AI Coach
          </Link>
        </div>

      </div>
    </Layout>
  )
}
