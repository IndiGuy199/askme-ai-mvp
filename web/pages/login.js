import { useState, useEffect, useRef } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import styles from '../styles/Login.module.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isClientReady, setIsClientReady] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const cooldownTimer = useRef(null)
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

  // Initialize cooldown from localStorage (persists across refresh)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const until = Number(localStorage.getItem('otpCooldownUntil') || 0)
    const now = Date.now()
    if (until > now) setCooldown(Math.ceil((until - now) / 1000))
  }, [])

  // Tick down the cooldown every second
  useEffect(() => {
    if (cooldown <= 0) {
      if (typeof window !== 'undefined') localStorage.removeItem('otpCooldownUntil')
      return
    }
    clearTimeout(cooldownTimer.current)
    cooldownTimer.current = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(cooldownTimer.current)
  }, [cooldown])

  const startCooldown = (seconds = 45) => {
    const s = Math.max(1, Number.isFinite(seconds) ? seconds : 45)
    const until = Date.now() + s * 1000
    if (typeof window !== 'undefined') localStorage.setItem('otpCooldownUntil', String(until))
    setCooldown(s)
  }

  const secondsFromError = (msg) => {
    const m = msg?.match(/after\s+(\d+)\s+seconds/i)
    return m ? parseInt(m[1], 10) : 45
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (cooldown > 0) {
      setMessage(`Please wait ${cooldown}s before requesting another magic link.`)
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`
        }
      })

      if (error) {
        // Track auth error
        try {
          if (window.GenericAnalytics) {
            window.GenericAnalytics.trackEvent('auth_error', {
              type: 'otp_signin',
              code: error.status || 429,
              message: error.message || 'Unknown error'
            })
          }
        } catch {}

        if (/security purposes/i.test(error.message)) {
          const secs = secondsFromError(error.message)
          startCooldown(secs)
          setMessage(`Please wait ${secs}s before requesting another login link.`)
        } else {
          setMessage(error.message || 'Login failed. Please try again.')
        }
        return
      }

      // Success
      setMessage('Check your email for the login link!')
      try {
        if (window.GenericAnalytics) {
          window.GenericAnalytics.trackEvent('login_magic_link_sent', { email_domain: (email.split('@')[1] || '').toLowerCase() })
        }
      } catch {}
      // Optional: start a short cooldown to prevent immediate re-requests
      startCooldown(45)
    } catch (err) {
      setMessage('Unexpected error. Please try again.')
      console.error('Login error:', err)
      try {
        if (window.GenericAnalytics) {
          window.GenericAnalytics.trackEvent('auth_error', { type: 'otp_signin', message: String(err) })
        }
      } catch {}
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
              disabled={loading || !email || !isClientReady || cooldown > 0}
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
                  {cooldown > 0 ? `Wait ${cooldown}s` : 'Send Magic Link'}
                </span>
              )}
            </button>

            {/* Optional inline cooldown/help text */}
            {cooldown > 0 && (
              <div className={styles.securityNote}>
                Please wait {cooldown}s before requesting another email.
              </div>
            )}

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