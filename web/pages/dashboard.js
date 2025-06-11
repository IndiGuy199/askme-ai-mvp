import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import Link from 'next/link'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState([])
  const [actionPlans, setActionPlans] = useState([])
  // State for add goal/action modals
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [showAddAction, setShowAddAction] = useState(false)
  const [showUpdateProgress, setShowUpdateProgress] = useState(false)
  const [newGoalName, setNewGoalName] = useState('')
  const [newActionDesc, setNewActionDesc] = useState('')
  const [newActionGoalId, setNewActionGoalId] = useState('')
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [newProgress, setNewProgress] = useState(0)
  const router = useRouter()

  // Fetch user goals and their progress
  const [userGoals, setUserGoals] = useState([])
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
        setUser(session.user)
      await fetchUserData(session.user.email)
      // Note: We'll fetch progress and action plans after userData is loaded
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        await fetchUserData(session.user.email)
        // Note: We'll fetch progress and action plans after userData is loaded
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserData = async (email) => {
    try {
      const response = await fetch(`/api/gptRouter?email=${encodeURIComponent(email)}`)
      if (response.ok) {
        const data = await response.json()
        setUserData(data) // Don't modify the data, use it as-is from the API
      } else {
        console.error('Failed to fetch user data')
        // Fallback to auth user data
        setUserData({
          tokens: 0,
          firstName: user?.user_metadata?.first_name || email?.split('@')[0],
          email: email,
          lastLogin: null
        })
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
      // Fallback to auth user data
      setUserData({
        tokens: 0,
        firstName: user?.user_metadata?.first_name || email?.split('@')[0],
        email: email,
        lastLogin: null
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchProgress = async (userId) => {
    try {
      let { data, error } = await supabase
        .from('progress')
        .select('id, goal_id, percent_complete, updated_at, goals(name)')
        .eq('user_id', userId)
      if (error) throw error
      setProgress(data || [])
    } catch (err) {
      setProgress([])
    }
  }

  const fetchActionPlans = async (userId) => {
    try {
      let { data, error } = await supabase
        .from('action_plans')
        .select('id, action, due_date, completed, goal_id, goals(name)')
        .eq('user_id', userId)
        .gte('due_date', new Date().toISOString().slice(0, 10))
        .order('due_date', { ascending: true })
      if (error) throw error
      setActionPlans(data || [])
    } catch (err) {
      setActionPlans([])
    }
  }

  // Fetch user goals and their progress
  useEffect(() => {
    if (!user || !userData) return;
    const fetchUserGoals = async () => {
      // Use the database user ID from userData.id (not databaseUserId)
      const dbUserId = userData.id;
      console.log('Fetching user goals for database user ID:', dbUserId);
      console.log('UserData object:', userData);
      
      if (!dbUserId) {
        console.log('No database user ID found in userData');
        return;
      }
      
      // First, let's try a simple query to see if we have any user_wellness_goals
      let { data: simpleData, error: simpleError } = await supabase
        .from('user_wellness_goals')
        .select('*')
        .eq('user_id', dbUserId)
      
      console.log('Simple user_wellness_goals query with database user ID:', dbUserId);
      console.log('Simple user_wellness_goals query:', { simpleData, simpleError });
      
      if (simpleData && simpleData.length > 0) {
        // Get the full goal data with coach_wellness_goals
        let { data, error } = await supabase
          .from('user_wellness_goals')
          .select(`
            id,
            coach_wellness_goal_id,
            coach_wellness_goals(label, goal_id)
          `)
          .eq('user_id', dbUserId)
        
        console.log('Complex user goals query result:', { data, error });
        
        if (!error && data) {
          console.log('Found', data.length, 'goals, fetching progress for each...');
          // For each goal, get the progress separately
          for (let goal of data) {
            if (goal.coach_wellness_goals?.goal_id) {
              console.log('Fetching progress for goal:', goal.coach_wellness_goals.goal_id);
              const { data: progressData } = await supabase
                .from('progress')
                .select('progress_percent')
                .eq('user_id', dbUserId)
                .eq('goal_id', goal.coach_wellness_goals.goal_id)
                .single()
              goal.progress = progressData
              console.log('Progress for goal', goal.coach_wellness_goals.goal_id, ':', progressData);
            }
          }
          console.log('Final userGoals data:', data);
          setUserGoals(data)
        } else {
          console.log('Complex query failed:', error);
          setUserGoals([])
        }
      } else {
        console.log('No user_wellness_goals found for user:', dbUserId);
        setUserGoals([])
      }
    }
    fetchUserGoals()
  }, [user, userData, showAddGoal])

  const handleMarkComplete = async (actionId) => {
    await supabase
      .from('action_plans')
      .update({ completed: true })
      .eq('id', actionId)
    setActionPlans((prev) => prev.map(a => a.id === actionId ? { ...a, completed: true } : a))
  }

  const handleUpdateProgress = (goal) => {
    setSelectedGoal(goal)
    // Find current progress for this goal
    const currentProgress = goal.progress?.progress_percent || 0
    setNewProgress(currentProgress)
    setShowUpdateProgress(true)
  }
  const handleSaveProgress = async () => {
    if (!selectedGoal || !userData.id) return

    console.log('Saving progress:', {
      selectedGoal,
      newProgress,
      userId: userData.id,
      goalId: selectedGoal.coach_wellness_goals?.goal_id
    })

    try {
      const { error } = await supabase
        .from('progress')
        .update({ progress_percent: newProgress })
        .eq('user_id', userData.id)
        .eq('goal_id', selectedGoal.coach_wellness_goals?.goal_id)

      if (error) {
        console.error('Error updating progress:', error)
        alert('Error updating progress: ' + error.message)
        return
      }

      console.log('Progress updated successfully')

      // Refresh user goals to show updated progress
      const dbUserId = userData.id
      let { data, error: fetchError } = await supabase
        .from('user_wellness_goals')
        .select(`
          id,
          coach_wellness_goal_id,
          coach_wellness_goals(label, goal_id)
        `)
        .eq('user_id', dbUserId)
      
      if (!fetchError && data) {
        for (let goal of data) {
          const { data: progressData } = await supabase
            .from('progress')
            .select('progress_percent')
            .eq('user_id', dbUserId)
            .eq('goal_id', goal.coach_wellness_goals?.goal_id)
            .single()
          goal.progress = progressData
        }
        setUserGoals(data)
        console.log('User goals refreshed')
      }

      setShowUpdateProgress(false)
      setSelectedGoal(null)
      setNewProgress(0)
    } catch (error) {
      console.error('Error updating progress:', error)
      alert('Error updating progress: ' + error.message)
    }
  }
  // Handler to add a new goal
  const handleAddGoal = async () => {
    if (!newGoalName.trim()) return;
    if (!userData.coach_profile_id) {
      alert('No coach_profile_id found for user.');
      return;
    }

    console.log('Adding goal for user ID:', userData.id)
    
    // 1. Check if goal already exists for this coach
    let { data: existingGoals, error: findError } = await supabase
      .from('coach_wellness_goals')
      .select('*')
      .eq('coach_profile_id', userData.coach_profile_id)
      .ilike('label', newGoalName.trim());
    let goal;
    if (findError) {
      alert('Error searching for goal: ' + findError.message);
      return;
    }
    if (existingGoals && existingGoals.length > 0) {
      goal = existingGoals[0];    } else {
      // 2. If not found, create new goal
      let { data: newGoal, error: goalError } = await supabase
        .from('coach_wellness_goals')
        .insert([{
          coach_profile_id: userData.coach_profile_id,
          goal_id: `user_${Date.now()}`,
          label: newGoalName.trim(),
          description: '',
          display_order: 99,
          is_active: true
        }])
        .select()
        .single();
      if (goalError) {
        alert('Error adding goal: ' + goalError.message);
        return;
      }
      goal = newGoal;
    }
    // 3. Link user to goal if not already linked
    let { data: userGoal, error: userGoalError } = await supabase
      .from('user_wellness_goals')
      .select('*')
      .eq('user_id', userData.id)
      .eq('coach_wellness_goal_id', goal.id);
    if (!userGoal || userGoal.length === 0) {
      const { error: uwgError } = await supabase
        .from('user_wellness_goals')
        .insert([{ user_id: userData.id, coach_wellness_goal_id: goal.id }]);
      if (uwgError) {
        alert('Error linking user to goal: ' + uwgError.message);
        return;
      }
    }
    // 4. Add progress row if not already present
    let { data: prog, error: progFindError } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', userData.id)
      .eq('goal_id', goal.goal_id);
    if (!prog || prog.length === 0) {
      const { error: progError } = await supabase
        .from('progress')
        .insert([{ user_id: userData.id, goal_id: goal.goal_id, progress_percent: 0 }]);
      if (progError) {
        alert('Error creating progress row: ' + progError.message);
        return;
      }
    }
    setShowAddGoal(false);
    setNewGoalName("");
    // Refresh user goals
    let { data, error } = await supabase
      .from('user_wellness_goals')
      .select(`
        id,
        coach_wellness_goal_id,
        coach_wellness_goals(label, goal_id),
        progress:progress(id, goal_id, user_id, progress_percent)
      `)
      .eq('user_id', userData.id)
    if (!error) setUserGoals(data || [])
    fetchProgress(userData.id);
  };

  // Handler to add a new action plan
  const handleAddAction = async () => {
    if (!newActionDesc.trim() || !newActionGoalId) return;
    await supabase
      .from('action_plans')
      .insert([{
        user_id: user.id,
        goal_id: newActionGoalId,
        action: newActionDesc.trim(),
        due_date: new Date().toISOString().slice(0, 10),
        completed: false
      }]);
    setShowAddAction(false);
    setNewActionDesc("");
    setNewActionGoalId("");
    fetchActionPlans(user.id);
  };

  if (loading || !user || !userData) {
    return (
      <Layout title="Dashboard">
        <div className="d-flex justify-content-center align-items-center min-vh-100">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Layout>
    )
  }

  const displayName = userData.firstName || user.user_metadata?.first_name || user.email.split('@')[0]

  return (
    <Layout title="Dashboard">
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: '#f8f9fa' }}>
        <div className="row w-100 justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-4">
            <div className="card shadow-lg border-0 rounded-4">
              <div className="card-body p-4 p-md-5">
                {/* Greeting and Token Balance */}
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div>
                    <h3 className="fw-bold mb-0">
                      <span role="img" aria-label="coach" className="me-2">🧑‍💼</span>
                      Good Morning, {displayName}!
                    </h3>
                  </div>
                  <div className="text-end">
                    <div className="text-muted" style={{ fontSize: '1rem' }}>Token Balance:</div>
                    <div className="fw-bold" style={{ fontSize: '1.5rem' }}>{userData.tokens}</div>
                  </div>
                </div>

                {/* Wellness Progress */}
                <div className="card mb-4 border-0" style={{ background: '#f7fafd' }}>
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="fw-bold mb-0">Your Wellness Progress</h5>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => setShowAddGoal(true)}>
                        + Add Goal
                      </button>
                    </div>
                    {/* Debug info */}
                    <div className="text-muted small mb-2">Debug: {userGoals.length} goals found</div>                    {userGoals.length === 0 ? (
                      <div className="text-muted">No goals yet. Add your first goal.</div>
                    ) : (
                      userGoals.map((item) => {
                        // progress is now an array (from left join), filter for this user
                        const userProgress = Array.isArray(item.progress)
                          ? item.progress.find(p => p.user_id === user.id)
                          : item.progress;
                        const percent = userProgress?.progress_percent || 0;
                        return (
                          <div key={item.id} className="mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="fw-semibold" style={{ fontSize: '1.1rem' }}>{item.coach_wellness_goals?.label || 'Goal'}</span>
                              <button className="btn btn-link p-0 fw-bold text-primary" style={{ fontSize: '1rem' }} onClick={() => handleUpdateProgress(item)}>
                                Update
                              </button>
                            </div>
                            <div className="d-flex align-items-center">
                              <div className="flex-grow-1 me-3">
                                <div className="progress" style={{ height: '10px', background: '#e9ecef' }}>
                                  <div className="progress-bar" role="progressbar" style={{ width: `${percent}%`, background: 'linear-gradient(90deg, #4fc3f7 60%, #b2ebf2 100%)' }} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}></div>
                                </div>
                              </div>
                              <span className="fw-bold text-secondary" style={{ minWidth: '40px', textAlign: 'right' }}>{percent}%</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Recommended Actions */}
                <div className="card mb-4 border-0" style={{ background: '#f7fafd' }}>
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="fw-bold mb-0">Today's Recommended Actions</h5>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => setShowAddAction(true)}>
                        + Add Action
                      </button>
                    </div>
                    {actionPlans.length === 0 ? (
                      <div className="text-muted">No actions for today.</div>
                    ) : (
                      <ul className="list-unstyled mb-0">
                        {actionPlans.map((action) => (
                          <li key={action.id} className="d-flex align-items-center mb-3">
                            <span className="me-3" style={{ fontSize: '1.05rem' }}>• {action.action}</span>
                            <button 
                              className="btn btn-outline-info btn-sm ms-auto" 
                              disabled={action.completed}
                              onClick={() => handleMarkComplete(action.id)}
                              style={{ minWidth: '120px' }}
                            >
                              {action.completed ? 'Completed' : 'Mark Complete'}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Encouragement Message */}
                <div className="text-center mb-4">
                  <div className="fw-semibold text-secondary" style={{ fontSize: '1.1rem' }}>
                    Great progress! Keep it up and let us know how we can help further.
                  </div>
                </div>

                {/* Chat Button */}
                <div className="d-grid">
                  <Link 
                    href="/chat" 
                    className="btn btn-primary btn-lg rounded-pill py-3"
                    style={{ fontSize: '1.1rem', background: '#1976d2', border: 'none' }}
                  >
                    Chat with Your AI Coach
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add New Goal</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddGoal(false)}></button>
              </div>
              <div className="modal-body">
                <input type="text" className="form-control mb-3" placeholder="Goal name" value={newGoalName} onChange={e => setNewGoalName(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowAddGoal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAddGoal} disabled={!newGoalName.trim()}>Add Goal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Action Modal */}
      {showAddAction && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add New Action</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddAction(false)}></button>
              </div>
              <div className="modal-body">
                <input type="text" className="form-control mb-3" placeholder="Action description" value={newActionDesc} onChange={e => setNewActionDesc(e.target.value)} />
                <select className="form-select mb-3" value={newActionGoalId} onChange={e => setNewActionGoalId(e.target.value)}>
                  <option value="">Select goal</option>
                  {progress.map((item) => (
                    <option key={item.goal_id} value={item.goal_id}>{item.goals?.name || 'Goal'}</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowAddAction(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAddAction} disabled={!newActionDesc.trim() || !newActionGoalId}>Add Action</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Progress Modal */}
      {showUpdateProgress && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Update Progress: {selectedGoal?.coach_wellness_goals?.label}</h5>
                <button type="button" className="btn-close" onClick={() => setShowUpdateProgress(false)}></button>
              </div>
              <div className="modal-body">
                <label className="form-label">Progress Percentage</label>
                <input 
                  type="range" 
                  className="form-range mb-3" 
                  min="0" 
                  max="100" 
                  value={newProgress} 
                  onChange={e => setNewProgress(parseInt(e.target.value))}
                />
                <div className="text-center">
                  <span className="badge bg-primary fs-6">{newProgress}%</span>
                </div>
                <div className="progress mt-3" style={{ height: '10px' }}>
                  <div 
                    className="progress-bar" 
                    role="progressbar" 
                    style={{ width: `${newProgress}%`, background: 'linear-gradient(90deg, #4fc3f7 60%, #b2ebf2 100%)' }} 
                    aria-valuenow={newProgress} 
                    aria-valuemin={0} 
                    aria-valuemax={100}
                  ></div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowUpdateProgress(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveProgress}>Update Progress</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
