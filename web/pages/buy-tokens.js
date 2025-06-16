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
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState(100)
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
    setLoading(true)
    try {
      const res = await fetch('/api/createCheckout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, email: userEmail, token_count: tokenCount })
      })
      const data = await res.json()
      if (data?.url) {
        window.location.href = data.url
      } else {
        alert('Unable to start checkout session.')
      }
    } catch (err) {
      console.error(err)
      alert('Error initiating purchase.')
    }
    setLoading(false)
  }

  return (
    <Layout title="Buy More Tokens">
      <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        <h1 className="display-5 fw-bold mb-3 text-center">Buy More Tokens</h1>
        <p className="lead text-center mb-4">
          Choose a token pack to continue chatting with AskMe AI.
        </p>
        <div className="w-100" style={{ maxWidth: 600 }}>
          {PACKS.map(pack => (
            <div
              key={pack.tokens}
              className="d-flex justify-content-between align-items-center border rounded mb-3 px-4 py-3"
              style={{ borderWidth: 2, borderColor: '#1976d2' }}
            >
              <span className="fw-bold fs-4">{pack.tokens} Tokens — ${pack.price}</span>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => handleBuy(pack.tokens, pack.priceId)}
              >
                Buy Now
              </button>
            </div>
          ))}
        </div>
        <div className="text-center mt-4 text-secondary">
          <div>Your tokens will be credited automatically after payment.</div>
          <div>Secure payments via Stripe.</div>
        </div>
      </div>
    </Layout>
  )
}
