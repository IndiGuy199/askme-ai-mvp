import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import ChatBox from '../components/ChatBox'
import Link from 'next/link'
import Layout from '../components/Layout'

export default function Chat() {
  const [user, setUser] = useState(null)
  const [tokens, setTokens] = useState(0)
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
      await fetchUserTokens(session.user.email)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        await fetchUserTokens(session.user.email)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserTokens = async (email) => {
    try {
      const response = await fetch(`/api/gptRouter?email=${encodeURIComponent(email)}`)
      if (response.ok) {
        const data = await response.json()
        setTokens(data.tokens || 0)
      } else {
        console.error('Failed to fetch user tokens')
        setTokens(0)
      }
    } catch (error) {
      console.error('Error fetching user tokens:', error)
      setTokens(0)
    } finally {
      setLoading(false)
    }
  }

  // Function to update token count after a message is sent
  const onTokenUsed = () => {
    setTokens(prev => Math.max(0, prev - 1))
  }

  if (loading || !user) {
    return (
      <Layout title="Chat">
        <div className="d-flex justify-content-center align-items-center min-vh-100">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Chat">
      <div className="container py-3">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6">
            <div className="bg-white rounded shadow-sm">
              {/* Header */}
              <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                <button className="btn btn-light rounded-circle" onClick={() => router.back()}>
                  <span>←</span>
                </button>
                <div className="text-center">
                  <div className="fw-bold">AskMe AI</div>
                  <small className="text-muted">Your Wellness Companion</small>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-semibold">{tokens}</span>
                  <Link href="/buy-tokens" className="btn btn-outline-secondary btn-sm">
                    Buy Tokens
                  </Link>
                </div>
              </div>
              
              {/* Chat Area */}
              <div style={{ height: '70vh' }}>
                <ChatBox userEmail={user.email} onTokenUsed={onTokenUsed} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}