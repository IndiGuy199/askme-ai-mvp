import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/router'
import ChatBox from '../components/ChatBox'
import Link from 'next/link'
import Layout from '../components/Layout'

export default function Chat() {  const [user, setUser] = useState(null)
  const [tokens, setTokens] = useState(0)
  const [loading, setLoading] = useState(true)
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
      <div className="chat-container">
        <div className="chat-wrapper">
          
          {/* Header */}
          <div className="chat-header">
            <button className="back-button" onClick={() => router.back()}>
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
              </svg>
            </button>
            
            <div className="header-content">
              <h1 className="ai-title">AskMe AI</h1>
              <p className="ai-subtitle">Your Wellness Companion</p>
            </div>
              <div className="token-info">
              <div className={`token-display ${tokens < 100 ? 'low-tokens' : ''}`}>
                <span className="token-count">{tokens}</span>
                <span className="token-label">tokens</span>
              </div>
              <Link href="/buy-tokens" className="buy-tokens-link">
                Buy More
              </Link>
            </div>
          </div>

          {/* Low Token Warning */}
          {tokens < 100 && (
            <div className="low-token-banner">
              <div className="warning-content">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                </svg>
                <span className="warning-text">
                  {tokens === 0 ? 
                    'You\'re out of tokens! Complete your profile setup to get 10,000 free tokens.' :
                    `Running low on tokens (${tokens} remaining). Consider purchasing more to continue chatting.`
                  }
                </span>
                {tokens === 0 ? (
                  <Link href="/profile-setup" className="setup-profile-btn">
                    Complete Profile
                  </Link>
                ) : (
                  <Link href="/buy-tokens" className="buy-tokens-btn">
                    Buy Tokens
                  </Link>
                )}
              </div>
            </div>
          )}          {/* Chat Area */}
          <div className="chat-content">
            <ChatBox 
              userEmail={user.email} 
              onTokenUsed={onTokenUsed}
              onEstimateCost={setEstimatedCost}
              estimateTokens={estimateTokens}
            />
          </div>
          
        </div>
      </div>      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        .chat-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #f4f6fb 100%);
          padding: 0;
          margin: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .chat-wrapper {
          width: 50vw;
          min-width: 320px;
          max-width: 900px;
          margin: 0 auto;
          background: white;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
          border-radius: 0;
        }
        
        .chat-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: clamp(1rem, 2.5vw, 1.5rem) clamp(1.5rem, 4vw, 2rem);
          display: flex;
          align-items: center;
          gap: clamp(1rem, 2.5vw, 1.5rem);
          box-shadow: 0 2px 16px rgba(102, 126, 234, 0.15);
          position: relative;
          flex-wrap: wrap;
        }
        
        .back-button {
          background: rgba(255, 255, 255, 0.15);
          border: none;
          border-radius: 12px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .back-button:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: translateX(-2px);
        }
        
        .header-content {
          flex: 1;
        }
        
        .ai-title {
          font-size: clamp(1.25rem, 3vw, 1.5rem);
          font-weight: 600;
          margin: 0;
          color: white;
          font-family: 'Inter', sans-serif;
        }
        
        .ai-subtitle {
          font-size: clamp(0.8rem, 2vw, 0.9rem);
          margin: 0.25rem 0 0 0;
          color: rgba(255, 255, 255, 0.85);
          font-weight: 300;
        }
        
        .token-info {
          text-align: right;
        }
          .token-display {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          padding: clamp(0.4rem, 1.5vw, 0.5rem) clamp(0.75rem, 2vw, 1rem);
          margin-bottom: 0.75rem;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          display: inline-block;
        }
        
        .token-display.low-tokens {
          background: rgba(255, 193, 7, 0.2);
          border: 1px solid rgba(255, 193, 7, 0.4);
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .token-count {
          font-size: clamp(1rem, 2.5vw, 1.2rem);
          font-weight: 600;
          color: white;
        }
        
        .token-label {
          font-size: clamp(0.7rem, 1.5vw, 0.8rem);
          color: rgba(255, 255, 255, 0.8);
          margin-left: 0.25rem;
          font-weight: 300;
        }
        
        .buy-tokens-link {
          background: rgba(255, 255, 255, 0.9);
          color: #667eea;
          text-decoration: none;
          padding: clamp(0.35rem, 1.5vw, 0.4rem) clamp(0.75rem, 2vw, 1rem);
          border-radius: 16px;
          font-size: clamp(0.8rem, 2vw, 0.85rem);
          font-weight: 500;
          transition: all 0.2s ease;
          display: inline-block;
          white-space: nowrap;
        }
        
        .buy-tokens-link:hover {
          background: white;
          color: #5a67d8;
          text-decoration: none;          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        /* Low Token Warning Banner */
        .low-token-banner {
          background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 152, 0, 0.1) 100%);
          border-bottom: 1px solid rgba(255, 193, 7, 0.3);
          padding: clamp(0.75rem, 2vw, 1rem) clamp(1.5rem, 4vw, 2rem);
          animation: slideDown 0.3s ease-out;
        }
        
        .warning-content {
          display: flex;
          align-items: center;
          gap: clamp(0.75rem, 2vw, 1rem);
          color: #f59e0b;
          font-weight: 500;
          flex-wrap: wrap;
        }
        
        .warning-text {
          flex: 1;
          min-width: 200px;
          font-size: clamp(0.8rem, 2vw, 0.9rem);
        }
        
        .setup-profile-btn, .buy-tokens-btn {
          background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
          color: white;
          text-decoration: none;
          padding: clamp(0.4rem, 1.5vw, 0.5rem) clamp(0.75rem, 2vw, 1rem);
          border-radius: 12px;
          font-size: clamp(0.8rem, 2vw, 0.875rem);
          font-weight: 600;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        
        .setup-profile-btn:hover, .buy-tokens-btn:hover {
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          color: white;
          text-decoration: none;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }.chat-content {
          flex: 1;
          overflow: hidden;
        }        @media (max-width: 768px) {
          .chat-wrapper {
            width: 95vw;
            min-width: 320px;
            border-radius: 0;
            box-shadow: none;
          }
          
          .chat-header {
            padding: 1rem 1.5rem;
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
          
          .header-content {
            order: 1;
          }
          
          .back-button {
            position: absolute;
            left: 1.5rem;
            top: 50%;
            transform: translateY(-50%);
          }
          
          .token-info {
            order: 2;
            margin-top: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
          }
          
          .token-display {
            margin-bottom: 0;
          }
          
          .low-token-banner {
            padding: 0.75rem 1.5rem;
          }
          
          .warning-content {
            flex-direction: column;
            gap: 0.75rem;
            text-align: center;
          }
          
          .warning-text {
            min-width: auto;
          }
        }
        
        @media (min-width: 769px) and (max-width: 1024px) {
          .chat-wrapper {
            width: 70vw;
            max-width: 700px;
          }
        }
        
        @media (min-width: 1025px) {
          .chat-wrapper {
            width: 50vw;
            max-width: 900px;
          }
        }
        
        @media (max-width: 480px) {
          .chat-wrapper {
            width: 100vw;
            min-width: 100%;
          }
          
          .chat-header {
            padding: 0.75rem 1rem;
          }
          
          .back-button {
            left: 1rem;
            width: 32px;
            height: 32px;
          }
          
          .token-info {
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .buy-tokens-link {
            font-size: 0.8rem;
            padding: 0.35rem 0.75rem;
          }
        }
      `}</style>
    </Layout>
  )
}