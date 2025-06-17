import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../utils/supabaseClient'
import { determineOptimalCoach, getCoachAssignmentReason } from '../utils/coachMatcher'
import Layout from '../components/Layout'
import styles from '../styles/ProfileSetup.module.css'

export default function ProfileSetup() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [allGoals, setAllGoals] = useState([])
  const [allChallenges, setAllChallenges] = useState([])

  const [form, setForm] = useState({
    firstName: '',
    age: '',
    sex: '',
    ethnicity: '',
    city: '',
    country: '',
    selectedGoals: [],
    selectedChallenges: [],
    communicationStyle: '',
    coachingFormat: ''
  })

  const countries = [
    'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 
    'France', 'Italy', 'Spain', 'Netherlands', 'Sweden', 'Norway', 'Denmark',
    'Finland', 'Switzerland', 'Austria', 'Belgium', 'Portugal', 'Other'
  ]

  const sexOptions = ['Male', 'Female', 'Non-binary', 'Prefer not to say']
  
  const ethnicityOptions = [
    'Asian', 'Black or African American', 'Hispanic or Latino', 
    'Native American', 'Pacific Islander', 'White', 'Mixed', 'Other', 'Prefer not to say'
  ]

  const communicationStyles = [
    { id: 'direct', label: 'Direct', icon: '🎯', description: 'Straightforward and to the point' },
    { id: 'stepByStep', label: 'Step-by-Step', icon: '📋', description: 'Detailed guidance with clear actions' },
    { id: 'gentle', label: 'Gentle', icon: '🌸', description: 'Supportive and encouraging approach' }
  ]

  const coachingFormats = [
    { id: 'brief', label: 'Brief', icon: '⚡', description: 'Quick, concise responses' },
    { id: 'detailed', label: 'Detailed', icon: '📚', description: 'In-depth explanations and examples' },
    { id: 'conversational', label: 'Conversational', icon: '💬', description: 'Natural, flowing dialogue' }
  ]

  useEffect(() => {
    async function initialize() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session) {
          router.push('/login')
          return
        }

        // Check if profile is already complete
        const { data: userProfile } = await supabase
          .from('users')
          .select('profile_completed')
          .eq('email', session.user.email)
          .single()

        if (userProfile?.profile_completed) {
          router.push('/dashboard')
          return
        }

        await loadAllOptions()
        setUser(session.user)
      } catch (error) {
        console.error('Error initializing:', error)
        setMessage('An error occurred. Please try again.')
      } finally {
        setDataLoading(false)
      }
    }

    initialize()
  }, [router])

  const loadAllOptions = async () => {
    try {
      // Fetch wellness goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('coach_wellness_goals')
        .select('id, goal_id, label, description, display_order')
        .eq('is_active', true)
        .order('display_order')

      if (goalsError) throw goalsError

      // Fetch challenges
      const { data: challengesData, error: challengesError } = await supabase
        .from('coach_challenges')
        .select('id, challenge_id, label, description, display_order')
        .eq('is_active', true)
        .order('display_order')

      if (challengesError) throw challengesError

      // Remove duplicates
      const uniqueGoals = []
      const seenGoalIds = new Set()
      
      goalsData?.forEach(goal => {
        if (!seenGoalIds.has(goal.goal_id)) {
          uniqueGoals.push(goal)
          seenGoalIds.add(goal.goal_id)
        }
      })

      const uniqueChallenges = []
      const seenChallengeIds = new Set()
      
      challengesData?.forEach(challenge => {
        if (!seenChallengeIds.has(challenge.challenge_id)) {
          uniqueChallenges.push(challenge)
          seenChallengeIds.add(challenge.challenge_id)
        }
      })

      setAllGoals(uniqueGoals)
      setAllChallenges(uniqueChallenges)
    } catch (error) {
      console.error('Error loading options:', error)
    }
  }

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleGoal = (goalId) => {
    setForm(prev => ({
      ...prev,
      selectedGoals: prev.selectedGoals.includes(goalId)
        ? prev.selectedGoals.filter(id => id !== goalId)
        : [...prev.selectedGoals, goalId]
    }))
  }

  const toggleChallenge = (challengeId) => {
    setForm(prev => ({
      ...prev,
      selectedChallenges: prev.selectedChallenges.includes(challengeId)
        ? prev.selectedChallenges.filter(id => id !== challengeId)
        : [...prev.selectedChallenges, challengeId]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (!form.firstName.trim()) {
        throw new Error('First name is required')
      }

      // Create or update user profile
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          email: user.email,
          first_name: form.firstName,
          age: form.age ? parseInt(form.age) : null,
          sex: form.sex || null,
          ethnicity: form.ethnicity || null,
          city: form.city || null,
          country: form.country || null,
          profile_completed: true,
          last_updated: new Date().toISOString()
        })

      if (userError) throw userError

      // Save wellness goals
      if (form.selectedGoals.length > 0) {
        const goalsData = form.selectedGoals.map(goalId => ({
          email: user.email,
          goal_id: goalId,
          created_at: new Date().toISOString()
        }))

        const { error: goalsError } = await supabase
          .from('user_wellness_goals')
          .upsert(goalsData)

        if (goalsError) throw goalsError
      }

      // Save challenges
      if (form.selectedChallenges.length > 0) {
        const challengesData = form.selectedChallenges.map(challengeId => ({
          email: user.email,
          challenge_id: challengeId,
          created_at: new Date().toISOString()
        }))

        const { error: challengesError } = await supabase
          .from('user_challenges')
          .upsert(challengesData)

        if (challengesError) throw challengesError
      }

      // Save communication preferences
      const { error: prefsError } = await supabase
        .from('user_communication_preferences')
        .upsert({
          email: user.email,
          communication_style: form.communicationStyle,
          coaching_format: form.coachingFormat,
          updated_at: new Date().toISOString()
        })

      if (prefsError) throw prefsError      // Determine optimal coach
      const optimalCoach = await determineOptimalCoach(user.email)
      
      if (optimalCoach) {
        const { error: coachError } = await supabase
          .from('users')
          .update({ 
            coach_profile_id: optimalCoach.id,
            coach_assignment_reason: getCoachAssignmentReason(optimalCoach, form.selectedGoals, form.selectedChallenges)
          })
          .eq('email', user.email)

        if (coachError) throw coachError
      }

      // Grant 10,000 welcome tokens for completing profile
      console.log('Granting 10,000 welcome tokens for profile completion...')
      const { error: tokenError } = await supabase
        .from('users')
        .update({ tokens: 10000 })
        .eq('email', user.email)

      if (tokenError) {
        console.error('Failed to grant welcome tokens:', tokenError)
        // Don't throw error - profile creation succeeded, just log the token issue
      } else {
        console.log('Successfully granted 10,000 welcome tokens')
      }

      router.push('/dashboard')
    } catch (error) {
      console.error('Error saving profile:', error)
      setMessage(error.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const nextStep = () => {
    if (currentStep === 1 && !form.firstName.trim()) {
      setMessage('First name is required to continue')
      return
    }
    setCurrentStep(2)
    setMessage('')
  }

  const prevStep = () => {
    setCurrentStep(1)
    setMessage('')
  }

  const progress = currentStep === 1 ? 50 : 100

  if (dataLoading) {
    return (
      <Layout title="Setting up your profile...">
        <div className={styles.loadingContainer}>
          <div className={styles.loadingContent}>
            <div className={styles.loadingSpinner}></div>
            <h3>Setting up your profile...</h3>
            <p>Just a moment while we prepare everything for you</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!user) {
    return (
      <Layout title="Authentication Required">
        <div className={styles.errorContainer}>
          <div className={styles.errorContent}>
            <div className={styles.errorIcon}>🔒</div>
            <h3>Authentication Required</h3>
            <p>Please sign in to continue setting up your profile</p>
            <button 
              className={styles.primaryButton}
              onClick={() => router.push('/login')}
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Complete Your Profile - AskMe AI">
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🧠</span>
            <span className={styles.logoText}>AskMe AI</span>
          </div>
          
          <div className={styles.progressSection}>
            <h1 className={styles.title}>Complete Your Profile</h1>
            <p className={styles.subtitle}>
              Step {currentStep} of 2: {currentStep === 1 ? 'About You' : 'Your Preferences'}
            </p>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {currentStep === 1 && (
            <div className={styles.stepContainer}>
              <div className={styles.cardsGrid}>
                {/* Personal Information Card */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.cardIcon}>👤</span>
                      Personal Information
                    </h3>
                  </div>
                  
                  <div className={styles.cardContent}>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>
                        First Name <span className={styles.required}>*</span>
                      </label>
                      <div className={styles.inputWrapper}>
                        <span className={styles.inputIcon}>👤</span>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="Enter your first name"
                          value={form.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className={styles.inputRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Age (optional)</label>
                        <input
                          type="number"
                          className={styles.input}
                          placeholder="Your age"
                          value={form.age}
                          onChange={(e) => handleInputChange('age', e.target.value)}
                          min="13"
                          max="120"
                        />
                      </div>

                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Sex (optional)</label>
                        <select
                          className={styles.select}
                          value={form.sex}
                          onChange={(e) => handleInputChange('sex', e.target.value)}
                        >
                          <option value="">Select...</option>
                          {sexOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Ethnicity (optional)</label>
                      <select
                        className={styles.select}
                        value={form.ethnicity}
                        onChange={(e) => handleInputChange('ethnicity', e.target.value)}
                      >
                        <option value="">Select...</option>
                        {ethnicityOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.inputRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Country</label>
                        <div className={styles.inputWrapper}>
                          <span className={styles.inputIcon}>🌎</span>
                          <select
                            className={styles.select}
                            value={form.country}
                            onChange={(e) => handleInputChange('country', e.target.value)}
                          >
                            <option value="">Select country...</option>
                            {countries.map(country => (
                              <option key={country} value={country}>{country}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className={styles.inputGroup}>
                        <label className={styles.label}>City</label>
                        <div className={styles.inputWrapper}>
                          <span className={styles.inputIcon}>🏙️</span>
                          <input
                            type="text"
                            className={styles.input}
                            placeholder="Your city"
                            value={form.city}
                            onChange={(e) => handleInputChange('city', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Goals & Challenges Card */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.cardIcon}>🎯</span>
                      Goals & Challenges
                    </h3>
                  </div>
                  
                  <div className={styles.cardContent}>
                    <div className={styles.sectionGroup}>
                      <h4 className={styles.sectionTitle}>Primary Wellness Goals</h4>
                      <div className={styles.chipsGrid}>
                        {allGoals.map(goal => (
                          <button
                            key={goal.goal_id}
                            type="button"
                            className={`${styles.chip} ${form.selectedGoals.includes(goal.goal_id) ? styles.chipSelected : ''}`}
                            onClick={() => toggleGoal(goal.goal_id)}
                          >
                            {goal.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.sectionGroup}>
                      <h4 className={styles.sectionTitle}>Current Challenges</h4>
                      <div className={styles.chipsGrid}>
                        {allChallenges.map(challenge => (
                          <button
                            key={challenge.challenge_id}
                            type="button"
                            className={`${styles.chip} ${form.selectedChallenges.includes(challenge.challenge_id) ? styles.chipSelected : ''}`}
                            onClick={() => toggleChallenge(challenge.challenge_id)}
                          >
                            {challenge.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.stepActions}>
                <button
                  type="button"
                  onClick={nextStep}
                  className={styles.primaryButton}
                  disabled={!form.firstName.trim()}
                >
                  Continue to Preferences
                  <span className={styles.buttonIcon}>→</span>
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className={styles.stepContainer}>
              <div className={styles.singleCard}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.cardIcon}>⚙️</span>
                      Coaching Preferences
                    </h3>
                    <p className={styles.cardDescription}>
                      Help us customize your coaching experience
                    </p>
                  </div>
                  
                  <div className={styles.cardContent}>
                    <div className={styles.sectionGroup}>
                      <h4 className={styles.sectionTitle}>Preferred Advice Style</h4>
                      <div className={styles.radioGrid}>
                        {communicationStyles.map(style => (
                          <label
                            key={style.id}
                            className={`${styles.radioCard} ${form.communicationStyle === style.id ? styles.radioCardSelected : ''}`}
                          >
                            <input
                              type="radio"
                              name="communicationStyle"
                              value={style.id}
                              checked={form.communicationStyle === style.id}
                              onChange={(e) => handleInputChange('communicationStyle', e.target.value)}
                              className={styles.radioInput}
                            />
                            <div className={styles.radioContent}>
                              <span className={styles.radioIcon}>{style.icon}</span>
                              <span className={styles.radioLabel}>{style.label}</span>
                              <span className={styles.radioDescription}>{style.description}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className={styles.sectionGroup}>
                      <h4 className={styles.sectionTitle}>Response Detail</h4>
                      <div className={styles.radioGrid}>
                        {coachingFormats.map(format => (
                          <label
                            key={format.id}
                            className={`${styles.radioCard} ${form.coachingFormat === format.id ? styles.radioCardSelected : ''}`}
                          >
                            <input
                              type="radio"
                              name="coachingFormat"
                              value={format.id}
                              checked={form.coachingFormat === format.id}
                              onChange={(e) => handleInputChange('coachingFormat', e.target.value)}
                              className={styles.radioInput}
                            />
                            <div className={styles.radioContent}>
                              <span className={styles.radioIcon}>{format.icon}</span>
                              <span className={styles.radioLabel}>{format.label}</span>
                              <span className={styles.radioDescription}>{format.description}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.stepActions}>
                <button
                  type="button"
                  onClick={prevStep}
                  className={styles.secondaryButton}
                >
                  <span className={styles.buttonIcon}>←</span>
                  Back
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={loading}
                >
                  {loading ? (
                    <span className={styles.loadingContent}>
                      <span className={styles.buttonSpinner}></span>
                      Completing Setup...
                    </span>
                  ) : (
                    <span>
                      Complete Setup
                      <span className={styles.buttonIcon}>✨</span>
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {message && (
            <div className={`${styles.message} ${message.includes('required') || message.includes('error') || message.includes('Error') ? styles.messageError : styles.messageSuccess}`}>
              <span className={styles.messageIcon}>
                {message.includes('required') || message.includes('error') || message.includes('Error') ? '⚠️' : 'ℹ️'}
              </span>
              {message}
            </div>
          )}
        </form>
      </div>
    </Layout>
  )
}
