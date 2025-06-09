import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import Link from 'next/link'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
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
      const response = await fetch(`/api/gptRouter?email=${encodeURIComponent(email)}`)
      if (response.ok) {
        const data = await response.json()
        setUserData(data)
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
                {/* Back Button */}
                <div className="mb-4">
                  <button 
                    className="btn btn-outline-secondary rounded-circle p-2 border-0" 
                    onClick={() => router.back()}
                    style={{ width: '45px', height: '45px' }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>←</span>
                  </button>
                </div>

                {/* Welcome Message */}
                <div className="text-center mb-4">
                  <h2 className="fw-bold mb-2 text-dark">
                    <span role="img" aria-label="wave" className="me-2">👋</span>
                    Welcome back,
                  </h2>
                  <h3 className="fw-bold text-primary mb-0">
                    {displayName}!
                  </h3>
                  {userData.city && userData.country && (
                    <small className="text-muted d-block mt-1">
                      {userData.city}, {userData.country}
                    </small>
                  )}
                </div>

                {/* Last Login */}
                <div className="text-center mb-4">
                  <small className="text-muted">
                    Last login: {userData.lastLogin ? new Date(userData.lastLogin).toLocaleDateString() : '—'}
                  </small>
                </div>

                {/* Token Card */}
                <div className="card bg-light border-0 mb-4">
                  <div className="card-body text-center py-4">
                    <div className="mb-3">
                      <h4 className="fw-bold mb-1">
                        You have <span className="text-primary">{userData.tokens}</span> tokens left
                      </h4>
                    </div>
                    <Link href="/buy-tokens" className="btn btn-primary btn-lg w-100 rounded-pill">
                      Buy More Tokens
                    </Link>
                  </div>
                </div>

                {/* Conversation Prompt */}
                <div className="alert alert-info border-0 mb-4" style={{ backgroundColor: '#e3f2fd' }}>
                  <p className="mb-0 text-center">
                    <i className="bi bi-chat-dots me-2"></i>
                    Did you try the new evening routine we discussed?
                  </p>
                </div>

                {/* Chat Button */}
                <div className="d-grid">
                  <Link 
                    href="/chat" 
                    className="btn btn-primary btn-lg rounded-pill py-3"
                    style={{ fontSize: '1.1rem' }}
                  >
                    <i className="bi bi-chat-heart me-2"></i>
                    Open AskMe AI Chat
                  </Link>
                </div>

                {/* Footer */}
                <div className="text-center mt-4">
                  <small className="text-muted">Your AI Wellness Companion</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
