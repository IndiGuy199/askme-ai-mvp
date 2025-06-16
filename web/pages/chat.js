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
  const [contextLength, setContextLength] = useState(1); // Only 1 message in context for minimal token use
  const [estimatedCost, setEstimatedCost] = useState(0)
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
  }  // Function to estimate token cost for a single message, minimal system prompt
  const estimateTokens = (text) => {
    const userMessageTokens = Math.ceil(text.length / 4);
    const systemPromptTokens = 40; // Keep system prompt very short
    const totalInputTokens = userMessageTokens + systemPromptTokens;
    // Shortest possible output
    const estimatedOutputTokens = Math.min(userMessageTokens * 2, 80);
    return totalInputTokens + estimatedOutputTokens;
  }

  // Function to update token count after a message is sent
  const onTokenUsed = (actualTokensUsed) => {
    if (actualTokensUsed) {
      setTokens(prev => Math.max(0, prev - actualTokensUsed))
    } else {
      // Fallback for backward compatibility
      setTokens(prev => Math.max(0, prev - 1))
    }
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
            <div className="bg-white rounded shadow-sm">              {/* Header */}
              <div className="chat-header">
                <button className="btn btn-light btn-back" onClick={() => router.back()}>
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
                  </svg>
                </button>
                <div className="chat-title">
                  <div className="ai-indicator">
                    <div className="ai-dot"></div>
                    <span className="fw-bold">AskMe AI</span>
                  </div>
                  <small className="text-muted">Your Personal Wellness Companion</small>
                </div>
                <div className="token-display">
                  <div className="token-count">
                    <span className="token-number">{tokens}</span>
                    <small className="token-label">tokens</small>
                  </div>
                  <Link href="/buy-tokens" className="btn btn-outline-primary btn-sm buy-tokens-btn">
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16" className="me-1">
                      <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                    </svg>
                    Buy Tokens
                  </Link>
                </div>
              </div>
                {/* Token Optimization Controls */}
              <div className="context-controls">
                <div className="context-selector">
                  <label className="context-label">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="me-2">
                      <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                    </svg>
                    Context Length
                  </label>
                  <select 
                    className="form-select context-select" 
                    value={contextLength}
                    onChange={(e) => setContextLength(parseInt(e.target.value))}
                  >
                    <option value={3}>Short (3 msgs)</option>
                    <option value={5}>Medium (5 msgs)</option>
                    <option value={10}>Long (10 msgs)</option>
                  </select>
                </div>
                {estimatedCost > 0 && (
                  <div className="cost-estimate">
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16" className="me-1">
                      <path d="M4 10.781c.148 1.667 1.513 2.85 3.591 3.003V15h1.043v-1.216c2.27-.179 3.678-1.438 3.678-3.3 0-1.59-.947-2.51-2.956-3.028l-.722-.187V3.467c1.122.11 1.879.714 2.07 1.616h1.47c-.166-1.6-1.54-2.748-3.54-2.875V1H7.591v1.233c-1.939.23-3.27 1.472-3.27 3.156 0 1.454.966 2.483 2.661 2.917l.61.162v4.031c-1.149-.17-1.94-.8-2.131-1.718H4zm3.391-3.836c-1.043-.263-1.6-.825-1.6-1.616 0-.944.704-1.641 1.8-1.828v3.495l-.2-.05zm1.591 1.872c1.287.323 1.852.859 1.852 1.769 0 1.097-.826 1.828-2.2 1.939V8.73l.348.086z"/>
                    </svg>
                    Est. {estimatedCost} tokens
                  </div>
                )}
              </div>
              
              {/* Chat Area */}
              <div style={{ height: '70vh' }}>
                <ChatBox 
                  userEmail={user.email} 
                  onTokenUsed={onTokenUsed}
                  contextLength={contextLength}
                  onEstimateCost={setEstimatedCost}
                  estimateTokens={estimateTokens}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}