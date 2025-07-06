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
  const [estimatedCost, setEstimatedCost] = useState(0)
  const [messages, setMessages] = useState([]) // Add missing messages state
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

  // Clear chat function
  const clearChat = () => {
    setMessages([])
    // If ChatBox component has a clear method, we might need to call it
    // For now, clearing the messages state should work
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
    <Layout title="Chat - AskMe AI">
      <div className="chat-container">
        <div className="chat-wrapper">
          
          {/* Updated Header to match screenshot */}
          <div className="chat-header">
            <div className="header-left">
              <h1 className="ai-title">AskMe AI</h1>
              <p className="ai-subtitle">Your Wellness Companion</p>
            </div>
            
            <div className="header-right">
              <div className="token-display">
                <span className="token-count">{tokens.toLocaleString()}</span>
                <span className="token-label">TOKENS</span>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="chat-content">
            <ChatBox 
              userEmail={user.email} 
              onTokenUsed={onTokenUsed}
              onEstimateCost={setEstimatedCost}
              estimateTokens={estimateTokens}
              hideControls={true}  // Add this prop to hide buttons
              showEnhanced={false} // Hide Enhanced button
              showClear={false}    // Hide Clear button  
              showExport={false}   // Hide Export button
            />
          </div>
          
        </div>
      </div>

      <style jsx>{`
        .chat-container {
          min-height: 100vh;
          background: #f8fafc;
          padding: 0;
          margin: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .chat-wrapper {
          width: 100vw;
          max-width: 900px;
          margin: 0 auto;
          background: white;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        /* Header - Purple gradient matching screenshot */
        .chat-header {
          background: linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #8b5cf6 100%);
          color: white;
          padding: 2rem 2rem 1.5rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          position: relative;
        }
        
        .header-left {
          flex: 1;
        }
        
        .ai-title {
          font-size: 2.5rem;
          font-weight: 700;
          margin: 0;
          color: white;
          line-height: 1.2;
        }
        
        .ai-subtitle {
          font-size: 1.125rem;
          margin: 0.25rem 0 0 0;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 400;
        }
        
        .header-right {
          display: flex;
          align-items: center;
        }
        
        /* Token display matching screenshot */
        .token-display {
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 24px;
          padding: 0.75rem 1.25rem;
          backdrop-filter: blur(10px);
          text-align: center;
          min-width: 120px;
        }
        
        .token-count {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
          line-height: 1.2;
        }
        
        .token-label {
          display: block;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
          letter-spacing: 0.5px;
          margin-top: 0.125rem;
        }
        
        .chat-content {
          flex: 1;
          padding: 0;
          overflow-y: auto;
          background: white;
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
          .chat-header {
            padding: 1.5rem 1.5rem 1.25rem 1.5rem;
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
          
          .header-right {
            align-self: center;
          }
          
          .ai-title {
            font-size: 2rem;
          }
        }
        
        @media (max-width: 480px) {
          .chat-wrapper {
            width: 100vw;
          }
          
          .chat-header {
            padding: 1.25rem 1rem 1rem 1rem;
          }
          
          .ai-title {
            font-size: 1.75rem;
          }
          
          .token-display {
            padding: 0.625rem 1rem;
            min-width: 100px;
          }
          
          .token-count {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </Layout>
  )
}