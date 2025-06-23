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

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../utils/supabaseClient'
import { determineOptimalCoach, getCoachAssignmentReason } from '../utils/coachMatcher'
import Layout from '../components/Layout'
import styles from '../styles/ProfileSetup.module.css'

export default function ProfileSetup() {  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1);
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [allChallenges, setAllChallenges] = useState([])
  
  const [form, setForm] = useState({
    firstName: '',
    age: '',
    sex: '',
    ethnicity: '',
    city: '',
    country: '',
    selectedChallenges: [],
    agreeToTerms: false
  })

  const [showConsentModal, setShowConsentModal] = useState(false)
  const [consentForm, setConsentForm] = useState({
    consentGiven: false,
    understandsLimitations: false,
    agreeToTerms: false
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
      // Fetch challenges only
      const { data: challengesData, error: challengesError } = await supabase
        .from('coach_challenges')
        .select('id, challenge_id, label, description, display_order')
        .eq('is_active', true)
        .order('display_order')

      if (challengesError) throw challengesError

      // Remove duplicates
      const uniqueChallenges = []
      const seenChallengeIds = new Set()
      
      challengesData?.forEach(challenge => {
        if (!seenChallengeIds.has(challenge.challenge_id)) {
          uniqueChallenges.push(challenge)
          seenChallengeIds.add(challenge.challenge_id)
        }
      })

      setAllChallenges(uniqueChallenges)
    } catch (error) {
      console.error('Error loading options:', error)
    }
  }

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }
  const toggleChallenge = (challengeId) => {
    setForm(prev => ({
      ...prev,
      selectedChallenges: prev.selectedChallenges.includes(challengeId)
        ? prev.selectedChallenges.filter(id => id !== challengeId)
        : [...prev.selectedChallenges, challengeId]
    }))
  }

  const handleConsentChange = (field, value) => {
    setConsentForm(prev => ({ ...prev, [field]: value }))
  }
  const acceptConsent = async () => {
    if (consentForm.consentGiven && consentForm.understandsLimitations && consentForm.agreeToTerms) {
      try {
        // Store consent acceptance in database
        const { error: consentError } = await supabase
          .from('user_consent')
          .upsert({
            email: user.email,
            consent_accepted: true,
            consent_date: new Date().toISOString(),
            consent_version: '1.0', // Track consent version for future changes
            ip_address: null, // Could be populated if needed
            user_agent: navigator.userAgent,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (consentError) {
          console.error('Error storing consent:', consentError)
          setMessage('Error storing consent. Please try again.')
          return
        }

        // Update local form state
        setForm(prev => ({ ...prev, agreeToTerms: true }))
        setShowConsentModal(false)
        setMessage('Consent accepted and recorded successfully!')
        
        // Clear consent form
        setConsentForm({
          consentGiven: false,
          understandsLimitations: false,
          agreeToTerms: false
        })
        
      } catch (error) {
        console.error('Error in acceptConsent:', error)
        setMessage('Error processing consent. Please try again.')
      }
    } else {
      setMessage('Please read and accept all consent terms to continue')
    }
  }
  const openConsentModal = () => {
    setShowConsentModal(true)
    setMessage('')
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!form.agreeToTerms) {
      setMessage('Please read and accept the Terms and Conditions to continue')
      return
    }
    
    setLoading(true)
    setMessage('');
    
    try {
      if (!form.firstName.trim()) {
        throw new Error('First name is required')
      }
      if (!form.age) {
        throw new Error('Age is required')
      }
      if (!form.sex) {
        throw new Error('Sex is required')
      }
      if (!form.ethnicity) {
        throw new Error('Ethnicity is required')
      }

      // Create or update user profile
      const { error: userError } = await supabase
        .from('users')        .upsert({
          email: user.email,
          first_name: form.firstName,
          age: parseInt(form.age),
          sex: form.sex,
          ethnicity: form.ethnicity,
          city: form.city || null,
          country: form.country || null,
          profile_completed: true,
          last_updated: new Date().toISOString()
        })

      if (userError) throw userError

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
      }      // Save communication preferences - use default values since step 2 is removed
      const { error: prefsError } = await supabase
        .from('user_communication_preferences')
        .upsert({
          email: user.email,
          communication_style: 'balanced', // Default value
          coaching_format: 'conversational', // Default value
          updated_at: new Date().toISOString()
        })

      if (prefsError) throw prefsError// Determine optimal coach based on challenges and age only
      // Determine optimal coach based on challenges and age only (no goals)
      const optimalCoachCode = determineOptimalCoach(form.selectedChallenges, parseInt(form.age))
      
      // Get the coach profile by code
      const { data: coachProfile } = await supabase
        .from('coach_profiles')
        .select('id')
        .eq('code', optimalCoachCode)
        .single()
      
      if (coachProfile) {
        const { error: coachError } = await supabase
          .from('users')
          .update({ 
            coach_profile_id: coachProfile.id,
            coach_assignment_reason: getCoachAssignmentReason(optimalCoachCode, form.selectedChallenges, parseInt(form.age))
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
      setMessage(error.message || 'An error occurred. Please try again.')    } finally {
      setLoading(false)
    }
  };const nextStep = () => {
    if (currentStep === 1 && (!form.firstName.trim() || !form.age || !form.sex || !form.ethnicity || !form.agreeToTerms)) {
      setMessage('Please fill in all required fields and accept the terms to continue')
      return
    }
    // Since we removed step 2, directly submit the form
    handleSubmit({ preventDefault: () => {} })
    setMessage('')
  }

  const progress = 100 // Single step now

  // Check if user has already given consent
  const checkExistingConsent = async (userEmail) => {
    try {
      const { data, error } = await supabase
        .from('user_consent')
        .select('consent_accepted, consent_date, consent_version')
        .eq('email', userEmail)
        .eq('consent_accepted', true)
        .order('consent_date', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error checking consent:', error)
        return null
      }

      return data && data.length > 0 ? data[0] : null
    } catch (error) {
      console.error('Error in checkExistingConsent:', error)
      return null
    }
  }
  if (dataLoading) {
    return (
      <Layout title="Setting up your profile..." hideNavigation={true}>
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
      <Layout title="Authentication Required" hideNavigation={true}>
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
    <Layout title="Complete Your Profile - AskMe AI" hideNavigation={true}>
      <div className={styles.container}>        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🧠</span>
            <span className={styles.logoText}>AskMe AI</span>
          </div>
          
          <div className={styles.progressSection}>
            <h1 className={styles.title}>Complete Your Profile</h1>
            <p className={styles.subtitle}>
              Tell us about yourself and what you're struggling with
            </p>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Login Button for existing users */}
          <div className={styles.headerActions}>
            <p className={styles.existingUserText}>Already have a profile?</p>
            <button 
              className={styles.loginButton}
              onClick={() => router.push('/login')}
              type="button"
            >
              Sign In
            </button>
          </div>
        </div><form onSubmit={handleSubmit} className={styles.form}>          {currentStep === 1 && (
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
                    </div>                    <div className={styles.inputRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>
                          Age <span className={styles.required}>*</span>
                        </label>
                        <input
                          type="number"
                          className={styles.input}
                          placeholder="Your age"
                          value={form.age}
                          onChange={(e) => handleInputChange('age', e.target.value)}
                          min="13"
                          max="120"
                          required
                        />
                      </div>

                      <div className={styles.inputGroup}>
                        <label className={styles.label}>
                          Sex <span className={styles.required}>*</span>
                        </label>
                        <select
                          className={styles.select}
                          value={form.sex}
                          onChange={(e) => handleInputChange('sex', e.target.value)}
                          required
                        >
                          <option value="">Select...</option>
                          {sexOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>
                        Ethnicity <span className={styles.required}>*</span>
                      </label>
                      <select
                        className={styles.select}
                        value={form.ethnicity}
                        onChange={(e) => handleInputChange('ethnicity', e.target.value)}
                        required
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
                </div>                {/* Challenges Card */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.cardIcon}>💪</span>
                      Current Challenges
                    </h3>                    <p className={styles.cardDescription}>
                      <strong>What are you struggling with most right now?</strong>
                    </p>
                  </div>
                    <div className={styles.cardContent}>
                    <div className={styles.sectionGroup}>
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
                        <div className={styles.coachMatchingNote}>
                        <span className={styles.lightbulbIcon}>💡</span>
                        <span className={styles.noteText}>
                          Based on your selections, we'll match you with the best coach.
                        </span>                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms and Conditions - Full Width */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>
                    <span className={styles.cardIcon}>⚖️</span>
                    Terms & Conditions
                  </h3>
                </div>
                
                <div className={styles.cardContent}>
                  <div className={styles.termsSection}>
                    <div className={styles.termsCheckbox}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={form.agreeToTerms}
                          onChange={(e) => handleInputChange('agreeToTerms', e.target.checked)}
                          className={styles.checkbox}
                          required
                        />
                        <span className={styles.checkboxText}>
                          I agree to the{' '}
                          <button
                            type="button"
                            onClick={openConsentModal}
                            className={styles.termsLink}
                          >
                            Terms and Conditions, Privacy Policy, and Disclaimer
                          </button>
                          {' '}of this wellness coaching service. <span className={styles.required}>*</span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div><div className={styles.stepActions}>
                <button
                  type="button"
                  onClick={nextStep}
                  className={styles.primaryButton}
                  disabled={!form.firstName.trim() || !form.age || !form.sex || !form.ethnicity || !form.agreeToTerms || loading}
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
              </div>            </div>
          )}

          {message && (
            <div className={`${styles.message} ${message.includes('required') || message.includes('error') || message.includes('Error') ? styles.messageError : styles.messageSuccess}`}>
              <span className={styles.messageIcon}>
                {message.includes('required') || message.includes('error') || message.includes('Error') ? '⚠️' : 'ℹ️'}
              </span>
              {message}
            </div>          )}
        </form>

        {/* Consent Modal */}
        {showConsentModal && (
          <div className={styles.modalOverlay} onClick={() => setShowConsentModal(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <span className={styles.cardIcon}>⚖️</span>
                  Important Legal Disclaimer & Consent
                </h3>
                <button 
                  className={styles.modalClose}
                  onClick={() => setShowConsentModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div className={styles.modalBody}>
                <div className={styles.disclaimerSection}>
                  <h4 className={styles.sectionTitle}>🚨 Please Read Carefully</h4>
                  
                  <div className={styles.disclaimerBox}>
                    <h5 className={styles.disclaimerTitle}>This is NOT Medical or Professional Therapy</h5>
                    <p className={styles.disclaimerText}>
                      This application provides AI-powered wellness coaching and support. It is <strong>NOT</strong> a substitute for:
                    </p>
                    <ul className={styles.disclaimerList}>
                      <li>Professional medical advice, diagnosis, or treatment</li>
                      <li>Licensed therapy or counseling services</li>
                      <li>Crisis intervention or emergency mental health services</li>
                      <li>Psychiatric care or medication management</li>
                    </ul>
                  </div>

                  <div className={styles.emergencyBox}>
                    <h5 className={styles.emergencyTitle}>🆘 In Case of Emergency</h5>
                    <p className={styles.emergencyText}>
                      If you are experiencing a mental health crisis, suicidal thoughts, or need immediate help:
                    </p>
                    <ul className={styles.emergencyList}>
                      <li><strong>Call 911</strong> (US) or your local emergency number</li>
                      <li><strong>Crisis Text Line:</strong> Text HOME to 741741</li>
                      <li><strong>National Suicide Prevention Lifeline:</strong> 988</li>
                      <li>Go to your nearest emergency room</li>
                    </ul>
                  </div>

                  <div className={styles.limitationsBox}>
                    <h5 className={styles.limitationsTitle}>Limitations & Responsibilities</h5>
                    <ul className={styles.limitationsList}>
                      <li>This AI coach cannot diagnose mental health conditions</li>
                      <li>Advice is general and may not suit your specific situation</li>
                      <li>You are responsible for your own decisions and actions</li>
                      <li>We recommend consulting licensed professionals for serious concerns</li>
                      <li>The service may have technical limitations or errors</li>
                    </ul>
                  </div>

                  <div className={styles.consentCheckboxes}>
                    <div className={styles.checkboxGroup}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={consentForm.consentGiven}
                          onChange={(e) => handleConsentChange('consentGiven', e.target.checked)}
                          className={styles.checkbox}
                        />
                        <span className={styles.checkboxText}>
                          <strong>I understand this is NOT medical or professional therapy.</strong> I acknowledge that this AI coaching service is for general wellness support only and cannot replace professional medical care, licensed therapy, or crisis intervention services.
                        </span>
                      </label>
                    </div>

                    <div className={styles.checkboxGroup}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={consentForm.understandsLimitations}
                          onChange={(e) => handleConsentChange('understandsLimitations', e.target.checked)}
                          className={styles.checkbox}
                        />
                        <span className={styles.checkboxText}>
                          <strong>I understand the limitations and take responsibility.</strong> I acknowledge that I am responsible for my own decisions and actions. I will seek professional help for serious mental health concerns and use emergency services if needed.
                        </span>
                      </label>
                    </div>

                    <div className={styles.checkboxGroup}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={consentForm.agreeToTerms}
                          onChange={(e) => handleConsentChange('agreeToTerms', e.target.checked)}
                          className={styles.checkbox}
                        />
                        <span className={styles.checkboxText}>
                          <strong>I agree to the terms and limitations.</strong> I voluntarily choose to use this wellness coaching service with full understanding of its limitations. I will not hold the service providers liable for any decisions I make based on the AI's suggestions.
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className={styles.ageConfirmation}>
                    <p className={styles.ageText}>
                      <strong>Age Requirement:</strong> You must be 18 years or older to use this service. 
                      If you are under 18, please seek guidance from a parent, guardian, or school counselor.
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowConsentModal(false)}
                  className={styles.secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={acceptConsent}
                  className={styles.primaryButton}
                  disabled={!consentForm.consentGiven || !consentForm.understandsLimitations || !consentForm.agreeToTerms}
                >
                  I Accept All Terms
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
