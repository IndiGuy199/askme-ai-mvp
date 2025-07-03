// pages/buy-tokens.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../utils/supabaseClient'
import Layout from '../components/Layout'

const PACKS = [
  { tokens: 25000, price: '9.99', priceId: 'price_1RWlfr4gLT9aIqMDl62HX9DF' },
  { tokens: 10000, price: '4.99', priceId: 'price_1RWlea4gLT9aIqMDkebCi9N2' },
]

export default function BuyTokens() {
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [purchasingPackId, setPurchasingPackId] = useState(null)
  const router = useRouter()

  // Get logged-in user email
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email)
      } else {
        router.push('/login')
      }
    }
    fetchUser()
  }, [router])

  const handleBuy = async (tokenCount, priceId) => {
    if (!userEmail) return alert('User not authenticated.')
    
    setPurchasingPackId(priceId)
    setLoading(true)
    
    console.log('🛒 Initiating purchase:', { tokenCount, priceId, email: userEmail })
    
    try {
      const res = await fetch('/api/createCheckout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, email: userEmail, token_count: tokenCount })
      })
      
      const data = await res.json()
      console.log('💳 Checkout response:', data)
      
      if (data?.url) {
        console.log('✅ Redirecting to Stripe checkout:', data.url)
        window.location.href = data.url
      } else {
        console.error('❌ No checkout URL received:', data)
        alert('Unable to start checkout session. Please try again.')
      }
    } catch (err) {
      console.error('❌ Purchase error:', err)
      alert('Error initiating purchase. Please try again.')
    }
    
    setLoading(false)
    setPurchasingPackId(null)
  }

  return (
    <Layout title="Buy More Tokens">
      <div className="container-fluid" style={{ 
        width: '50vw',
        minWidth: '320px',
        maxWidth: '600px',
        margin: '0 auto',
        padding: '2rem 1rem'
      }}>
        
        {/* Header Section */}
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
          padding: 'clamp(2rem, 5vw, 3rem) clamp(1.5rem, 4vw, 2rem)',
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          <div className="d-flex align-items-center justify-content-center mb-3">
            <span style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', marginRight: '1rem' }}>👋</span>
            <h1 className="text-white mb-0 fw-bold" style={{ 
              fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
              lineHeight: '1.2',
              letterSpacing: '-0.025em'
            }}>
              Buy More Tokens
            </h1>
          </div>
          <p className="text-white mb-0 opacity-90" style={{ 
            fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
            fontWeight: '400'
          }}>
            Choose a token pack to continue chatting with AskMe AI.
          </p>
        </div>

        {/* Token Packs */}
        <div className="d-flex flex-column gap-3 mb-4">
          {PACKS.map(pack => (
            <div
              key={pack.tokens}
              className="card border-0 shadow-sm rounded-3"
              style={{ 
                border: '2px solid #e9ecef',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#667eea'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e9ecef'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h3 className="fw-bold mb-1" style={{ 
                      fontSize: 'clamp(1.3rem, 3vw, 1.5rem)',
                      color: '#2d3748'
                    }}>
                      {pack.tokens.toLocaleString()} Tokens
                    </h3>
                    <div className="d-flex align-items-baseline">
                      <span className="fw-bold" style={{ 
                        fontSize: 'clamp(1.8rem, 4vw, 2.2rem)',
                        color: '#667eea'
                      }}>
                        ${pack.price}
                      </span>
                      <span className="text-muted ms-2" style={{ fontSize: '0.9rem' }}>
                        (${(parseFloat(pack.price) / pack.tokens * 1000).toFixed(3)}/1k tokens)
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-lg rounded-pill px-4 py-2"
                    onClick={() => handleBuy(pack.tokens, pack.priceId)}
                    disabled={loading}
                    style={{ 
                      background: purchasingPackId === pack.priceId 
                        ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      fontSize: 'clamp(0.9rem, 2vw, 1rem)',
                      fontWeight: '600',
                      minWidth: '120px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {purchasingPackId === pack.priceId ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Processing...
                      </>
                    ) : (
                      'Buy Now'
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Indicators */}
        <div className="card border-0 bg-light rounded-3">
          <div className="card-body p-4 text-center">
            <div className="row g-3">
              <div className="col-md-6">
                <div className="d-flex align-items-center justify-content-center mb-2">
                  <i className="bi bi-shield-check text-success fs-4 me-2"></i>
                  <span className="fw-semibold" style={{ color: '#2d3748' }}>
                    Secure Payments
                  </span>
                </div>
                <p className="text-muted mb-0 small">
                  Protected by Stripe encryption
                </p>
              </div>
              <div className="col-md-6">
                <div className="d-flex align-items-center justify-content-center mb-2">
                  <i className="bi bi-lightning-charge text-primary fs-4 me-2"></i>
                  <span className="fw-semibold" style={{ color: '#2d3748' }}>
                    Instant Credit
                  </span>
                </div>
                <p className="text-muted mb-0 small">
                  Tokens added automatically after payment
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-center mt-4">
          <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
            <i className="bi bi-info-circle text-primary"></i>
            <span className="text-muted small">
              Need help? <a href="/chat" className="text-decoration-none">Chat with our AI support</a>
            </span>
          </div>
          <div className="text-muted small">
            <i className="bi bi-arrow-left me-1"></i>
            <a href="/dashboard" className="text-decoration-none">Back to Dashboard</a>
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }
        
        .btn:disabled {
          transform: none !important;
          opacity: 0.8;
        }
        
        .card:hover .btn {
          background: linear-gradient(135deg, #5a67d8 0%, #667eea 100%) !important;
        }
        
        .spinner-border-sm {
          width: 1rem;
          height: 1rem;
        }
        
        @media (max-width: 576px) {
          .card-body {
            padding: 1.5rem !important;
          }
          
          .btn-lg {
            padding: 0.75rem 1.5rem !important;
            font-size: 0.9rem !important;
          }
        }
      `}</style>
    </Layout>
  )
}
