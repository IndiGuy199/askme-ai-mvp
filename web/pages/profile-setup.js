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
    id: 1,
    code: 'mental_health',
    label: 'Mental Health',
    description: 'Help with anxiety, depression, stress, and emotional wellbeing'
  },
  {
    id: 2, 
    code: 'addiction_recovery',
    label: 'Addiction & Recovery',
    description: 'Support for overcoming addictive behaviors and maintaining recovery'
  }
]

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
    // Updated consent fields to match new content
    ageConfirmed: false,
    termsAccepted: false,
    privacyAccepted: false,
    aiInteractionAcknowledged: false
  })
  const [loading, setLoading] = useState(false)
  const [challengesLoading, setChallengesLoading] = useState(false)
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
        setCategories(data)
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
        const challenges = data.map(challenge => ({
          id: challenge.id, // UUID for database operations
          challenge_id: challenge.challenge_id, // String ID for selection
          label: challenge.label || formatChallengeLabel(challenge.challenge_id)
        }))
        
        console.log('🔧 Loaded challenges for category:', challenges)
        setAvailableChallenges(challenges)
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
    setCurrentStep(2)
  }

  const handleChallengeToggle = (challengeId) => {
    setFormData(prev => ({
      ...prev,
      selectedChallenges: prev.selectedChallenges.includes(challengeId)
        ? prev.selectedChallenges.filter(id => id !== challengeId)
        : [...prev.selectedChallenges, challengeId]
    }))
  }

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
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          memory_summary: `${formData.firstName} is starting their journey with ${selectedCategory.label}. Selected challenges: ${formData.selectedChallenges.join(', ')}.`,
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
        } else {
          console.warn('No valid challenge UUIDs found for storage')
        }
      } catch (err) {
        console.warn('Challenge storage error:', err)
      }

      console.log(`Profile completed successfully for ${selectedCategory.label} category`)
      router.push('/dashboard')

    } catch (error) {
      console.error('Error completing profile:', error)
      alert(`Error completing profile: ${error.message}. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout title="Complete Your Profile - AskMe AI">
      <div className={styles.container}>
        
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>🧠</div>
            <span className={styles.logoText}>AskMe AI</span>
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
              {currentStep === 2 && `Focusing on ${selectedCategory?.label}`}
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
              <div className={styles.cardsGrid}>
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className={styles.card}
                    onClick={() => handleCategorySelect(category)}
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
                          First Name <span className={styles.required}>*</span>
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
                          Age <span className={styles.required}>*</span>
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
                        className={styles.primaryButton}
                        onClick={() => setCurrentStep(3)}
                        disabled={!formData.firstName || !formData.age}
                      >
                        <span className={styles.buttonIcon}>➡️</span>
                        Next: Choose Your Challenges
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

                    <div className={styles.stepActions}>
                      <button 
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => setCurrentStep(2)}
                      >
                        <span className={styles.buttonIcon}>⬅️</span>
                        Back
                      </button>
                      <button 
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => setCurrentStep(4)}
                        disabled={formData.selectedChallenges.length === 0 || challengesLoading}
                      >
                        <span className={styles.buttonIcon}>➡️</span>
                        Next: Terms & Conditions
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
                    
                    {/* Important Disclaimer */}
                    <div className={styles.disclaimerSection}>
                      <div className={styles.disclaimerBox}>
                        <h4 style={{ color: '#dc2626', marginBottom: '1rem' }}>
                          ⚠️ Important Medical Disclaimer
                        </h4>
                        <p style={{ lineHeight: '1.6', marginBottom: '0.75rem' }}>
                          <strong>AskMe AI is for educational and wellness support purposes only.</strong> 
                          It is not a substitute for professional medical advice, diagnosis, or treatment.
                        </p>
                        <p style={{ lineHeight: '1.6', marginBottom: '0.75rem' }}>
                          If you are experiencing a mental health crisis, having thoughts of self-harm, 
                          or need immediate medical attention, please contact emergency services immediately 
                          or call the National Suicide Prevention Lifeline at 988.
                        </p>
                        <p style={{ lineHeight: '1.6', marginBottom: '0' }}>
                          Always consult with qualified healthcare professionals for medical concerns.
                        </p>
                      </div>
                    </div>

                    {/* Age Confirmation */}
                    <div className={styles.ageConfirmation}>
                      <p className={styles.ageText}>
                        <strong>Age Verification:</strong> You have indicated that you are {formData.age} years old. 
                        You must be at least 18 years old to use AskMe AI.
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
                          I accept the <strong>Terms of Service</strong> and understand that AskMe AI 
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
                          I accept the <strong>Privacy Policy</strong> and consent to the processing 
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
