import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../utils/supabaseClient'
import styles from '../styles/Playbook.module.css'

export default function Library() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState(null)
  const [user, setUser] = useState(null)
  const [libraryGoals, setLibraryGoals] = useState([])
  const [activeGoals, setActiveGoals] = useState([])
  const [selectedTab, setSelectedTab] = useState('goals') // 'goals' or 'actions'
  const [savingData, setSavingData] = useState(false)

  useEffect(() => {
    fetchLibraryData()
  }, [])

  const fetchLibraryData = async () => {
    try {
      // Get current user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        router.push('/login')
        return
      }

      // Get user profile
      const { data: dbUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email)
        .single()

      if (userError) throw userError

      setUserData(dbUser)
      setUser(authUser)

      // Get all user goals
      const { data: allGoals, error: goalsError } = await supabase
        .from('user_wellness_goals')
        .select(`
          id,
          is_active,
          selected_at,
          coach_wellness_goals (
            id,
            goal_id,
            label,
            description,
            challenge_id
          )
        `)
        .eq('user_id', dbUser.id)
        .order('is_active', { ascending: false })
        .order('selected_at', { ascending: false })

      if (goalsError) throw goalsError

      // Separate active and library goals
      const active = allGoals?.filter(g => g.is_active) || []
      const library = allGoals?.filter(g => !g.is_active) || []

      setActiveGoals(active)
      setLibraryGoals(library)

    } catch (error) {
      console.error('Error fetching library data:', error)
      alert('Failed to load library data')
    } finally {
      setLoading(false)
    }
  }

  const pinGoalToActive = async (goal) => {
    if (activeGoals.length >= 2) {
      alert('You already have 2 active goals. Remove one first to pin this goal.')
      return
    }

    setSavingData(true)
    try {
      const response = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          goalId: goal.id,
          isActive: true
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to activate goal')
      }

      alert('Goal pinned to active! Go to Playbook to see it.')
      await fetchLibraryData()
    } catch (error) {
      console.error('Error pinning goal:', error)
      alert(error.message || 'Failed to pin goal')
    } finally {
      setSavingData(false)
    }
  }

  const unpinGoalFromActive = async (goal) => {
    if (!confirm('Move this goal to Library?')) {
      return
    }

    setSavingData(true)
    try {
      const response = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          goalId: goal.id,
          isActive: false
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to deactivate goal')
      }

      alert('Goal moved to Library!')
      await fetchLibraryData()
    } catch (error) {
      console.error('Error unpinning goal:', error)
      alert(error.message || 'Failed to unpin goal')
    } finally {
      setSavingData(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading library...</p>
      </div>
    )
  }

  return (
    <div className={styles.playbookContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Library</h1>
          <p className={styles.subtitle}>
            Manage your saved goals and actions. Pin up to 2 goals to your Playbook.
          </p>
        </div>
        <button 
          className={styles.supportButton}
          onClick={() => router.push('/playbook')}
        >
          ← Back to Playbook
        </button>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabContainer} style={{ marginBottom: '2rem' }}>
        <button
          className={`${styles.tab} ${selectedTab === 'goals' ? styles.tabActive : ''}`}
          onClick={() => setSelectedTab('goals')}
        >
          Goals
        </button>
        <button
          className={`${styles.tab} ${selectedTab === 'actions' ? styles.tabActive : ''}`}
          onClick={() => setSelectedTab('actions')}
        >
          Actions (Coming Soon)
        </button>
      </div>

      {/* Goals Tab */}
      {selectedTab === 'goals' && (
        <div>
          {/* Active Goals Section */}
          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#1f2937' }}>
              Active Goals ({activeGoals.length}/2)
            </h2>
            {activeGoals.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activeGoals.map(goal => (
                  <div 
                    key={goal.id}
                    style={{
                      background: '#f0fdf4',
                      border: '2px solid #86efac',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>✓</span>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                          {goal.coach_wellness_goals?.label || 'Goal'}
                        </h3>
                      </div>
                      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
                        {goal.coach_wellness_goals?.description || 'No description'}
                      </p>
                      <p style={{ color: '#10b981', fontSize: '0.8125rem', marginTop: '0.5rem', fontWeight: '500' }}>
                        Currently active on Playbook
                      </p>
                    </div>
                    <button 
                      className={styles.menuItemAction}
                      onClick={() => unpinGoalFromActive(goal)}
                      disabled={savingData}
                      style={{ backgroundColor: '#dc3545', flexShrink: 0 }}
                    >
                      Unpin
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                No active goals. Go to Playbook to add goals.
              </p>
            )}
          </div>

          {/* Library Goals Section */}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#1f2937' }}>
              Library Goals ({libraryGoals.length})
            </h2>
            {libraryGoals.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {libraryGoals.map(goal => (
                  <div 
                    key={goal.id}
                    style={{
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>
                        {goal.coach_wellness_goals?.label || 'Goal'}
                      </h3>
                      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
                        {goal.coach_wellness_goals?.description || 'No description'}
                      </p>
                      <p style={{ color: '#9ca3af', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                        Saved {new Date(goal.selected_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button 
                      className={styles.menuItemAction}
                      onClick={() => pinGoalToActive(goal)}
                      disabled={savingData || activeGoals.length >= 2}
                      style={{ flexShrink: 0 }}
                    >
                      {activeGoals.length >= 2 ? '2/2 Active' : 'Pin to Active'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ 
                background: '#f9fafb', 
                border: '1px dashed #d1d5db',
                borderRadius: '12px',
                padding: '3rem',
                textAlign: 'center'
              }}>
                <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '0.5rem' }}>
                  No goals in library yet
                </p>
                <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                  Goals you remove from active slots will appear here
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions Tab */}
      {selectedTab === 'actions' && (
        <div style={{ 
          background: '#f9fafb', 
          border: '1px dashed #d1d5db',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center'
        }}>
          <p style={{ color: '#6b7280', fontSize: '1.125rem', marginBottom: '0.5rem' }}>
            Actions Library Coming Soon
          </p>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            Browse and manage all your saved actions here
          </p>
        </div>
      )}
    </div>
  )
}
