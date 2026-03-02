/**
 * Profile Setup Component
 * 
 * SIMPLIFIED SINGLE-STEP FLOW:
 * 1. User enters personal info (first name, age, sex, ethnicity, location)
 * 2. User selects challenges they're facing
 * 3. User accepts legal consent
 * 4. Coach assignment based ONLY on challenges and age
 * 
 * Coach Assignment Logic:
 * - Age 45+ → AskMe AI Coach (specialized for life transitions)
 * - Mental health challenges → Mental Health Coach
 * - Fitness challenges → Fitness Coach
 * - All other cases → General Wellness Coach
 */

// Updated profile setup with Terms & Conditions instead of Communication Preferences
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../utils/supabaseClient'
import { determineOptimalCoach } from '../utils/coachMatcher'
import Layout from '../components/Layout'
import styles from '../styles/ProfileSetup.module.css'

// Only keep categories fallback as a minimal safety net
const FALLBACK_CATEGORIES = [
  {
    id: 2, 
    code: 'addiction_recovery',
    label: 'Compulsive behaviors & recovery',
    description: 'Support for building healthier habits and breaking compulsive cycles'
  }
]

// Allowed category codes visible in onboarding (mental_health hidden for now)
const ALLOWED_CATEGORY_CODES = ['addiction_recovery']

// Map category labels to friendly names
const CATEGORY_LABEL_MAP = {
  addiction_recovery: 'Compulsive behaviors & recovery'
}

// Allowed challenge_ids and their friendly UI labels (porn only for now)
const ALLOWED_CHALLENGE_IDS = ['pornography_addiction', 'porn_recovery', 'porn']
const CHALLENGE_LABEL_MAP = {
  pornography_addiction: 'Porn',
  porn_recovery: 'Porn',
  porn: 'Porn'
}

export default function ProfileSetup() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [categories, setCategories] = useState([])
  const [availableChallenges, setAvailableChallenges] = useState([])
  const [formData, setFormData] = useState({
    firstName: '',
    age: '',
    sex: '',
    ethnicity: '',
    city: '',
    country: '',
    selectedChallenges: [],
    challengeSeverities: {}, // Per-challenge severity: { challenge_id: 'occasional' | 'growing' | ... }
    // Updated consent fields to match new content
    ageConfirmed: false,
    termsAccepted: false,
    privacyAccepted: false,
    aiInteractionAcknowledged: false
  })
  const [loading, setLoading] = useState(false)
  const [challengesLoading, setChallengesLoading] = useState(false)
  const [reassuranceChallenge, setReassuranceChallenge] = useState(null)
  const router = useRouter()

  // Load categories on mount
  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('challenge_categories')
        .select('*')
        .order('display_order')

      if (error) {
        console.warn('Categories table not found:', error)
        setCategories(FALLBACK_CATEGORIES)
      } else if (data && data.length > 0) {
        // Filter to allowed categories and apply label overrides
        const filtered = data
          .filter(c => ALLOWED_CATEGORY_CODES.includes(c.code))
          .map(c => ({ ...c, label: CATEGORY_LABEL_MAP[c.code] || c.label }))
        setCategories(filtered.length > 0 ? filtered : FALLBACK_CATEGORIES)
      } else {
        console.warn('No categories found in database, using fallback')
        setCategories(FALLBACK_CATEGORIES)
      }
    } catch (error) {
      console.error('Error loading categories:', error)
      setCategories(FALLBACK_CATEGORIES)
    }
  }

  const loadChallengesForCategory = async (categoryId) => {
    setChallengesLoading(true)
    try {
      console.log('🔧 Loading challenges for category ID:', categoryId)
      
      // Query coach_challenges for the selected category ONLY
      const { data, error } = await supabase
        .from('coach_challenges')
        .select('id, challenge_id, label, description, category_id')
        .eq('category_id', categoryId)
        .eq('is_active', true)  // Only active challenges
        .order('display_order', { ascending: true })
        .order('label', { ascending: true })

      if (error) {
        console.error('Error loading challenges:', error)
        setAvailableChallenges([])
      } else if (data && data.length > 0) {
        // Transform the data to the format needed by the UI
        // Filter to allowed challenge IDs and apply friendly label overrides
        const challenges = data
          .filter(challenge => {
            const cid = challenge.challenge_id
            return ALLOWED_CHALLENGE_IDS.includes(cid) || ALLOWED_CHALLENGE_IDS.some(a => cid?.startsWith(a))
          })
          .map(challenge => ({
            id: challenge.id, // UUID for database operations
            challenge_id: challenge.challenge_id, // String ID for selection
            label: CHALLENGE_LABEL_MAP[challenge.challenge_id] || challenge.label || formatChallengeLabel(challenge.challenge_id)
          }))
        // If nothing matched the filter, fall through to show all (safety net)
        const finalChallenges = challenges.length > 0 ? challenges : data.map(challenge => ({
          id: challenge.id,
          challenge_id: challenge.challenge_id,
          label: CHALLENGE_LABEL_MAP[challenge.challenge_id] || challenge.label || formatChallengeLabel(challenge.challenge_id)
        }))
        // Apply final safety label override: any porn-related challenge → "Porn"
        const labelledChallenges = finalChallenges.map(c => ({
          ...c,
          label: (c.challenge_id?.toLowerCase().includes('porn') ? 'Porn' : c.label)
        }))
        console.log('🔧 Loaded challenges for category:', labelledChallenges)
        setAvailableChallenges(labelledChallenges)
      } else {
        console.warn(`No challenges found for category ${categoryId}`)
        setAvailableChallenges([])
      }
    } catch (error) {
      console.error('Error loading challenges:', error)
      setAvailableChallenges([])
    } finally {
      setChallengesLoading(false)
    }
  }

  // Helper function to format challenge labels if not provided
  const formatChallengeLabel = (challengeId) => {
    return challengeId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const handleCategorySelect = (category) => {
    setSelectedCategory(category)
    setFormData(prev => ({ ...prev, selectedChallenges: [] }))
    setAvailableChallenges([]) // Clear previous challenges
    loadChallengesForCategory(category.id)
    setCurrentStep(3) // Go directly to challenges selection
  }

  const handleChallengeToggle = (challengeId) => {
    setFormData(prev => {
      const isSelected = prev.selectedChallenges.includes(challengeId)
      const newChallenges = isSelected
        ? prev.selectedChallenges.filter(id => id !== challengeId)
        : [...prev.selectedChallenges, challengeId]
      // Remove severity for deselected challenge
      const newSeverities = { ...prev.challengeSeverities }
      if (isSelected) delete newSeverities[challengeId]
      return { ...prev, selectedChallenges: newChallenges, challengeSeverities: newSeverities }
    })
    setReassuranceChallenge(null)
  }

  const handleSeveritySelect = (challengeId, severity) => {
    setFormData(prev => ({
      ...prev,
      challengeSeverities: { ...prev.challengeSeverities, [challengeId]: severity }
    }))
    setReassuranceChallenge(challengeId)
    setTimeout(() => setReassuranceChallenge(null), 3000)
  }

  // Severity label → numeric level mapping
  const SEVERITY_MAP = {
    occasional: 1,
    growing: 2,
    compulsive: 3,
    overwhelming: 4
  }

  // Check all selected challenges have a severity assigned
  const allSeveritiesSelected = formData.selectedChallenges.length > 0 &&
    formData.selectedChallenges.every(cid => formData.challengeSeverities[cid])

  const handleConsentChange = (consentType, value) => {
    setFormData(prev => ({
      ...prev,
      [consentType]: value
    }))
  }

  const handleSubmit = async () => {
    if (!selectedCategory || formData.selectedChallenges.length === 0) {
      alert('Please select at least one challenge to work on.')
      return
    }

    if (!formData.ageConfirmed || !formData.termsAccepted || !formData.privacyAccepted || !formData.aiInteractionAcknowledged) {
      alert('Please accept all terms and conditions to continue.')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // REMOVE: Client-side coach assignment
      // const assignedCoach = determineOptimalCoach(...)

      // INSTEAD: Get coach from the first selected challenge (since all challenges in a category have the same coach)
      const firstSelectedChallenge = availableChallenges.find(
        challenge => formData.selectedChallenges.includes(challenge.challenge_id)
      )

      if (!firstSelectedChallenge?.id) {
        throw new Error('No valid challenge found for coach assignment')
      }

      // Get the coach already assigned to this challenge in the database
      const { data: challengeWithCoach, error: coachError } = await supabase
        .from('coach_challenges')
        .select('coach_profile_id')
        .eq('id', firstSelectedChallenge.id)
        .single()

      if (coachError || !challengeWithCoach) {
        console.error('Error getting coach for challenge:', coachError)
        throw new Error('Could not determine coach assignment')
      }

      const assignedCoachUUID = challengeWithCoach.coach_profile_id

      // 1. Update users table with the database-assigned coach
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          first_name: formData.firstName,
          age: parseInt(formData.age) || null,
          sex: formData.sex,
          ethnicity: formData.ethnicity,
          city: formData.city,
          country: formData.country,
          coach_profile_id: assignedCoachUUID, // Use database-assigned coach
          primary_category: selectedCategory.code,
          profile_completed: true
        }, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })

      if (userError) {
        console.error('User update error:', userError)
        throw userError
      }

      // 1b. Grant 5000 profile-completion tokens (server-side idempotent via welcome_tokens_granted_at)
      try {
        const { data: granted, error: grantErr } = await supabase.rpc('grant_profile_tokens', { uid: user.id })
        if (grantErr) {
          console.warn('Token grant RPC error (non-fatal):', grantErr)
        } else if (granted) {
          console.log('✅ Granted 5000 profile-completion tokens')
        } else {
          console.log('ℹ️ Profile tokens already granted — skipped')
        }
      } catch (tokenErr) {
        console.warn('Token grant error (non-fatal):', tokenErr)
      }

      // 2. Store consent record
      try {
        const { error: consentError } = await supabase
          .from('user_consent')
          .insert({
            email: user.email,
            consent_accepted: true,
            consent_date: new Date().toISOString(),
            consent_version: '2.0',
            ip_address: userIpAddress,
            user_agent: navigator.userAgent,
            terms_text: 'I accept the Terms of Service and understand that AskMe AI provides wellness guidance and is not a substitute for professional medical care.',
            privacy_text: 'I accept the Privacy Policy and consent to the processing of my personal data for wellness coaching purposes.',
            medical_disclaimer_text: 'I understand that AskMe AI is for educational and wellness support purposes only.',
            consent_method: 'web_form',
            is_active: true
          })

        if (consentError) {
          console.warn('Consent storage error:', consentError)
        }
      } catch (consentError) {
        console.warn('Consent table not available:', consentError)
      }

      // 3. Create user profile record
      const severitySummary = Object.entries(formData.challengeSeverities)
        .map(([cid, sev]) => {
          const ch = availableChallenges.find(c => c.challenge_id === cid)
          return `${ch?.label || cid}: ${sev}`
        })
        .join(', ')

      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          memory_summary: `${formData.firstName} is starting their journey with ${selectedCategory.label}. Selected challenges: ${formData.selectedChallenges.join(', ')}. Severity: ${severitySummary}.`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (profileError) throw profileError

      // 4. Store user challenges using the loaded challenge UUIDs
      try {
        // Get the UUIDs for the selected challenges
        const selectedChallengeUUIDs = availableChallenges
          .filter(challenge => formData.selectedChallenges.includes(challenge.challenge_id))
          .map(challenge => challenge.id)
          .filter(id => id) // Remove any null/undefined IDs

        if (selectedChallengeUUIDs.length > 0) {
          const challengeRecords = selectedChallengeUUIDs.map(challengeUUID => ({
            user_id: user.id,
            coach_challenge_id: challengeUUID
          }))

          const { error: userChallengesError } = await supabase
            .from('user_challenges')
            .insert(challengeRecords)

          if (userChallengesError) {
            console.warn('Could not store user challenge selections:', userChallengesError)
          } else {
            console.log(`Successfully stored ${challengeRecords.length} challenge selections`)
          }

          // 5. Insert severity assessments for each selected challenge
          try {
            const assessmentRecords = availableChallenges
              .filter(c => formData.selectedChallenges.includes(c.challenge_id))
              .map((challenge, index) => {
                const severityLabel = formData.challengeSeverities[challenge.challenge_id]
                return {
                  user_id: user.id,
                  coach_challenge_id: challenge.id, // UUID FK to coach_challenges
                  assessment_source: 'onboarding',
                  severity_level: SEVERITY_MAP[severityLabel],
                  severity_label: severityLabel,
                  severity_confidence: null, // User-reported; implicitly 1.0
                  timeframe_days: 30,
                  criteria_version: 'v1',
                  is_user_reported: true,
                  notes: 'Initial onboarding assessment',
                  signals_json: {
                    source: 'onboarding',
                    challenge_id: challenge.challenge_id,
                    challenge_label: challenge.label,
                    category: selectedCategory.code,
                    selected_index: index
                  }
                }
              })
              .filter(r => r.severity_level) // Skip if severity wasn't set

            if (assessmentRecords.length > 0) {
              const { error: assessError } = await supabase
                .from('user_challenge_assessments')
                .insert(assessmentRecords)

              if (assessError) {
                console.warn('Could not store severity assessments:', assessError)
              } else {
                console.log(`✅ Stored ${assessmentRecords.length} severity assessments (trigger auto-updates latest)`)

                // Mark the first challenge as primary
                const firstChallenge = availableChallenges.find(
                  c => formData.selectedChallenges.includes(c.challenge_id)
                )
                if (firstChallenge) {
                  const { error: primaryError } = await supabase.rpc('set_primary_challenge', {
                    p_user_id: user.id,
                    p_coach_challenge_id: firstChallenge.id
                  })
                  if (primaryError) console.warn('Could not set primary challenge:', primaryError)
                  else console.log('✅ Primary challenge set')
                }
              }
            }
          } catch (assessErr) {
            console.warn('Assessment storage error:', assessErr)
          }

        } else {
          console.warn('No valid challenge UUIDs found for storage')
        }
      } catch (err) {
        console.warn('Challenge storage error:', err)
      }

      console.log(`Profile completed successfully for ${selectedCategory.label} category`)
      router.push('/playbook')

    } catch (error) {
      console.error('Error completing profile:', error)
      alert(`Error completing profile: ${error.message}. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout title="Complete Your Profile - AI assisted recovery coach" forcePreLogin>
      <div className={styles.container}>
        
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>🧠</div>
            <span className={styles.logoText}>AI assisted recovery coach</span>
          </div>
          
          <div className={styles.progressSection}>
            <h1 className={styles.title}>
              {currentStep === 1 && "What would you like help with?"}
              {currentStep === 2 && "Tell us about yourself"}
              {currentStep === 3 && "Choose your challenges"}
              {currentStep === 4 && "Terms and Conditions"}
            </h1>
            <p className={styles.subtitle}>
              {currentStep === 1 && "Choose your primary area of focus to get specialized guidance"}
              {currentStep === 2 && `Focusing on ${selectedCategory?.label} - Tell us about yourself`}
              {currentStep === 3 && `Select the ${selectedCategory?.label.toLowerCase()} challenges you'd like to work on`}
              {currentStep === 4 && "Please review and accept our terms to complete your profile"}
            </p>
            
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${(currentStep / 4) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className={styles.form}>
          <div className={styles.stepContainer}>
            
            {/* Step 1: Category Selection */}
            {currentStep === 1 && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: '420px' }}>
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className={styles.card}
                      onClick={() => handleCategorySelect(category)}
                      style={{ cursor: 'pointer', marginBottom: '1.5rem' }}
                    >
                      <div className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}>
                          <span className={styles.cardIcon}>
                            {category.code === 'addiction_recovery' ? '🔄' : '🧠'}
                          </span>
                          {category.label}
                        </h3>
                        <p className={styles.cardDescription}>{category.description}</p>
                      </div>
                      <div className={styles.cardContent}>
                        <button 
                          type="button"
                          className={`${styles.primaryButton} ${styles.categorySelectButton}`}
                        >
                          <span className={styles.buttonIcon}>✨</span>
                          Get Specialized Help
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Personal Information */}
            {currentStep === 2 && (
              <div className={styles.singleCard}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.cardIcon}>👤</span>
                      Personal Information
                    </h3>
                    <p className={styles.cardDescription}>
                      Help us personalize your experience
                    </p>
                  </div>
                  
                  <div className={styles.cardContent}>
                    <div className={styles.inputRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>
                          First Name
                        </label>
                        <div className={styles.inputWrapper}>
                          <span className={styles.inputIcon}>👤</span>
                          <input
                            className={styles.input}
                            type="text"
                            value={formData.firstName}
                            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                            placeholder="Your first name"
                          />
                        </div>
                      </div>

                      <div className={styles.inputGroup}>
                        <label className={styles.label}>
                          Age
                        </label>
                        <div className={styles.inputWrapper}>
                          <span className={styles.inputIcon}>🎂</span>
                          <input
                            className={styles.input}
                            type="number"
                            value={formData.age}
                            onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                            placeholder="Your age"
                          />
                        </div>
                      </div>
                    </div>

                    <div className={styles.inputRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Gender</label>
                        <select
                          className={styles.select}
                          value={formData.sex}
                          onChange={(e) => setFormData(prev => ({ ...prev, sex: e.target.value }))}
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="non-binary">Non-binary</option>
                          <option value="prefer-not-to-say">Prefer not to say</option>
                        </select>
                      </div>

                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Location</label>
                        <div className={styles.inputWrapper}>
                          <span className={styles.inputIcon}>📍</span>
                          <input
                            className={styles.input}
                            type="text"
                            value={formData.city}
                            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                            placeholder="City, State/Country"
                          />
                        </div>
                      </div>
                    </div>

                    <div className={styles.stepActions}>
                      <button 
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => setCurrentStep(3)}
                      >
                        <span className={styles.buttonIcon}>⬅️</span>
                        Back
                      </button>
                      <button 
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => setCurrentStep(4)}
                      >
                        Skip for now
                      </button>
                      <button 
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => setCurrentStep(4)}
                      >
                        <span className={styles.buttonIcon}>➡️</span>
                        Next: Terms & Conditions
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Challenges */}
            {currentStep === 3 && (
              <div className={styles.singleCard}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.cardIcon}>🎯</span>
                      Your Challenges
                    </h3>
                    <p className={styles.cardDescription}>
                      Select what you'd like to work on
                    </p>
                  </div>
                  
                  <div className={styles.cardContent}>
                    <div className={styles.sectionGroup}>
                      {challengesLoading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <div className={styles.buttonSpinner}></div>
                          <p>Loading challenges...</p>
                        </div>
                      ) : availableChallenges.length > 0 ? (
                        <div className={styles.chipsGrid}>
                          {availableChallenges.map((challenge) => (
                            <button
                              key={challenge.challenge_id}
                              type="button"
                              className={`${styles.chip} ${
                                formData.selectedChallenges.includes(challenge.challenge_id) 
                                  ? styles.chipSelected 
                                  : ''
                              }`}
                              onClick={() => handleChallengeToggle(challenge.challenge_id)}
                            >
                              {challenge.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <p>No challenges available for this category yet.</p>
                        </div>
                      )}
                    </div>

                    {/* Per-Challenge Severity Selection */}
                    {formData.selectedChallenges.map(challengeId => {
                      const challenge = availableChallenges.find(c => c.challenge_id === challengeId)
                      if (!challenge) return null
                      const currentSeverity = formData.challengeSeverities[challengeId]
                      return (
                        <div key={challengeId} className={styles.severitySection}>
                          <div className={styles.severityHeader}>
                            <h4 className={styles.severityTitle}>
                              How does <em>{challenge.label}</em> feel right now?
                            </h4>
                            <p className={styles.severitySubtitle}>Over the last 30 days — this helps us personalize your plan</p>
                          </div>

                          <div className={styles.severityGrid}>
                            {[
                              { key: 'occasional', icon: '〰️', label: 'Occasional', desc: 'It shows up sometimes.', bullets: ['It happens now and then', 'I\'m aware when it occurs'] },
                              { key: 'growing', icon: '🌊', label: 'Growing', desc: 'It\'s becoming a pattern.', bullets: ['It\'s happening more often', 'I\'m starting to notice the impact'] },
                              { key: 'compulsive', icon: '⚡', label: 'Compulsive', desc: 'I often struggle to stop.', bullets: ['It feels hard to control', 'It\'s affecting my daily life'] },
                              { key: 'overwhelming', icon: '🌀', label: 'Overwhelming', desc: 'It feels out of control.', bullets: ['It dominates my thoughts', 'I need support to manage it'] }
                            ].map(sev => (
                              <button
                                key={sev.key}
                                type="button"
                                className={[
                                  styles.severityCard,
                                  styles[`severity${sev.key.charAt(0).toUpperCase() + sev.key.slice(1)}`],
                                  currentSeverity === sev.key ? styles.severitySelected : ''
                                ].join(' ')}
                                onClick={() => handleSeveritySelect(challengeId, sev.key)}
                              >
                                <div className={styles.severityIcon}>{sev.icon}</div>
                                <h5 className={styles.severityLabel}>{sev.label}</h5>
                                <p className={styles.severityDescription}>{sev.desc}</p>
                                <ul className={styles.severityPoints}>
                                  {sev.bullets.map((b, i) => <li key={i}>{b}</li>)}
                                </ul>
                              </button>
                            ))}
                          </div>

                          {/* Per-challenge Reassurance */}
                          {reassuranceChallenge === challengeId && currentSeverity && (
                            <div className={styles.reassuranceMessage}>
                              <span className={styles.reassuranceIcon}>💙</span>
                              <p>Thank you for sharing. You're taking an important step, and we're here to help.</p>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <div className={styles.stepActions}>
                      <button 
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => setCurrentStep(1)}
                      >
                        <span className={styles.buttonIcon}>⬅️</span>
                        Back
                      </button>
                      <button 
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => setCurrentStep(2)}
                        disabled={!allSeveritiesSelected || challengesLoading}
                      >
                        <span className={styles.buttonIcon}>➡️</span>
                        Next: Personal Information
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Terms and Conditions */}
            {currentStep === 4 && (
              <div className={styles.singleCard}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.cardIcon}>📋</span>
                      Terms and Conditions
                    </h3>
                    <p className={styles.cardDescription}>
                      Please review and accept our terms to complete your profile
                    </p>
                  </div>
                  
                  <div className={styles.cardContent}>
                    
                    {/* Wellness Disclaimer */}
                    <div className={styles.disclaimerSection}>
                      <div className={styles.disclaimerBox} style={{ borderLeft: '4px solid #6366f1', backgroundColor: '#f0f4ff', borderRadius: '10px', padding: '1.25rem' }}>
                        <h4 style={{ color: '#3730a3', marginBottom: '0.75rem', fontWeight: 600 }}>
                          🔒 Private. Safe. Wellness support.
                        </h4>
                        <p style={{ lineHeight: '1.6', marginBottom: '0.75rem', color: '#374151' }}>
                          This app provides AI-powered wellness guidance to help you build better habits.
                          It is <strong>not</strong> a substitute for professional medical or mental health care.
                        </p>
                        <p style={{ lineHeight: '1.6', marginBottom: '0', color: '#374151' }}>
                          Your data is private and never sold. If you are ever in immediate danger,
                          please contact a trusted person or emergency services.
                        </p>
                      </div>
                    </div>

                    {/* Inline Terms Summary */}
                    <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '1rem', marginBottom: '1rem', border: '1px solid #e5e7eb' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem' }}>Terms of Service summary</h4>
                      <ul style={{ margin: 0, padding: '0 0 0 1.25rem', color: '#4b5563', fontSize: '0.875rem', lineHeight: 1.7 }}>
                        <li>You must be 18 or older to use this service.</li>
                        <li>This service provides wellness guidance, not clinical treatment.</li>
                        <li>You retain ownership of your personal data.</li>
                        <li>You may delete your account at any time.</li>
                      </ul>
                      <a href="/terms" target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#6366f1', textDecoration: 'underline', display: 'inline-block', marginTop: '0.5rem' }}>Read full Terms of Service →</a>
                    </div>

                    {/* Inline Privacy Summary */}
                    <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '1rem', marginBottom: '1rem', border: '1px solid #e5e7eb' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem' }}>Privacy Policy summary</h4>
                      <ul style={{ margin: 0, padding: '0 0 0 1.25rem', color: '#4b5563', fontSize: '0.875rem', lineHeight: 1.7 }}>
                        <li>Your data is stored securely and never sold to third parties.</li>
                        <li>We use your data only to personalize your coaching experience.</li>
                        <li>We use industry-standard encryption for all data in transit and at rest.</li>
                        <li>You can request deletion of all your data at any time via Settings.</li>
                      </ul>
                      <a href="/privacy" target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#6366f1', textDecoration: 'underline', display: 'inline-block', marginTop: '0.5rem' }}>Read full Privacy Policy →</a>
                    </div>

                    {/* Age Confirmation */}
                    <div className={styles.ageConfirmation}>
                      <p className={styles.ageText}>
                        <strong>Age Verification:</strong> You have indicated that you are {formData.age} years old. 
                        You must be at least 18 years old to use this service.
                      </p>
                    </div>

                    {/* Consent Checkboxes */}
                    <div className={styles.termsSection}>
                      <div className={styles.termsCheckbox}>
                        <input
                          type="checkbox"
                          id="ageConfirmation"
                          checked={formData.ageConfirmed}
                          onChange={(e) => handleConsentChange('ageConfirmed', e.target.checked)}
                          className={styles.checkbox}
                        />
                        <label htmlFor="ageConfirmation" className={styles.checkboxText}>
                          <strong>I confirm that I am 18 years of age or older</strong>
                        </label>
                      </div>

                      <div className={styles.termsCheckbox}>
                        <input
                          type="checkbox"
                          id="termsAccept"
                          checked={formData.termsAccepted}
                          onChange={(e) => handleConsentChange('termsAccepted', e.target.checked)}
                          className={styles.checkbox}
                        />
                        <label htmlFor="termsAccept" className={styles.checkboxText}>
                          I accept the <a href="/terms" target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>Terms of Service</a> and understand that this service
                          provides wellness guidance and is not a substitute for professional medical care
                        </label>
                      </div>

                      <div className={styles.termsCheckbox}>
                        <input
                          type="checkbox"
                          id="privacyAccept"
                          checked={formData.privacyAccepted}
                          onChange={(e) => handleConsentChange('privacyAccepted', e.target.checked)}
                          className={styles.checkbox}
                        />
                        <label htmlFor="privacyAccept" className={styles.checkboxText}>
                          I accept the <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>Privacy Policy</a> and consent to the processing 
                          of my personal data for wellness coaching purposes
                        </label>
                      </div>

                      <div className={styles.termsCheckbox}>
                        <input
                          type="checkbox"
                          id="aiInteraction"
                          checked={formData.aiInteractionAcknowledged}
                          onChange={(e) => handleConsentChange('aiInteractionAcknowledged', e.target.checked)}
                          className={styles.checkbox}
                        />
                        <label htmlFor="aiInteraction" className={styles.checkboxText}>
                          I acknowledge that I am interacting with an AI 🤖 and that all information 
                          and suggestions are for informational purposes only
                        </label>
                      </div>
                    </div>

                    <div className={styles.stepActions}>
                      <button 
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => setCurrentStep(3)}
                      >
                        <span className={styles.buttonIcon}>⬅️</span>
                        Back
                      </button>
                      <button 
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleSubmit}
                        disabled={loading || !formData.termsAccepted || !formData.privacyAccepted || !formData.ageConfirmed || !formData.aiInteractionAcknowledged}
                      >
                        {loading ? (
                          <div className={styles.loadingContent}>
                            <div className={styles.buttonSpinner}></div>
                            Setting Up Profile...
                          </div>
                        ) : (
                          <>
                            <span className={styles.buttonIcon}>✨</span>
                            Complete Profile Setup
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </Layout>
  )
}
