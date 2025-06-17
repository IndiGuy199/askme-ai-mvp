import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import styles from '../styles/Login.module.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isClientReady, setIsClientReady] = useState(false)
  const router = useRouter()
  useEffect(() => {
    // Check if Supabase client is properly initialized
    if (supabase && supabase.auth) {
      setIsClientReady(true)
    } else {
      setMessage('Authentication service is not available. Please check your configuration.')
      console.error('Supabase client not properly initialized:', supabase)
    }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    
    if (!isClientReady) {
      setMessage('Authentication service is not ready. Please refresh the page.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'}/auth/callback`,
        },
      })

      if (error) throw error
      setMessage('Check your email for the login link!')
      if (typeof window !== 'undefined') {
        localStorage.setItem('pendingEmail', email)
      }
    } catch (error) {
      console.error('Login error:', error)
      setMessage(error.error_description || error.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <Layout title="Sign In - AskMe AI">
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          {/* Logo Section */}
          <div className={styles.logoSection}>
            <div className={styles.logo}>
              <span className={styles.logoIcon}>🧠</span>
            </div>
          </div>

          {/* Header */}
          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Welcome Back!</h1>
            <p className={styles.cardSubtitle}>
              Sign in to continue your wellness journey
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className={styles.loginForm}>
            <div className={styles.inputGroup}>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={styles.emailInput}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !isClientReady}
              className={`${styles.loginButton} ${loading ? styles.loading : ''}`}
            >
              {loading ? (
                <span className={styles.loadingContent}>
                  <span className={styles.spinner}></span>
                  Sending Magic Link...
                </span>
              ) : (
                <span className={styles.buttonContent}>
                  <span className={styles.buttonIcon}>✨</span>
                  Send Magic Link
                </span>
              )}
            </button>

            {/* Security Note */}
            <div className={styles.securityNote}>
              🔒 Secure, passwordless login. Magic link expires in 15 minutes.
            </div>

            {message && (
              <div className={`${styles.message} ${message.includes('Check') ? styles.success : styles.error}`}>
                <span className={styles.messageIcon}>
                  {message.includes('Check') ? '✅' : '⚠️'}
                </span>
                {message}
              </div>
            )}
          </form>

          {/* Features Section */}
          <div className={styles.featuresSection}>
            <div className={styles.featuresDivider}>
              <span>Features</span>
            </div>
            <div className={styles.features}>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>🧑‍💼</span>
                <span>Personalized AI Coach</span>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>🏆</span>
                <span>Goal Tracking</span>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>⭐</span>
                <span>Save Insights</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}