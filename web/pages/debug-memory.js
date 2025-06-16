import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

// Initialize Supabase client (client-side version)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function DebugMemory() {
  const [memoryData, setMemoryData] = useState(null)
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  // Function to fetch memory summary for a user
  async function fetchMemorySummary() {
    setLoading(true)
    setError(null)
    
    try {
      // First get user ID from email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()
      
      if (userError) throw new Error(`User not found: ${userError.message}`)
      
      // Get memory summary from user_profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('memory_summary, updated_at')
        .eq('user_id', userData.id)
        .single()
        
      if (profileError) throw new Error(`Profile not found: ${profileError.message}`)
      
      setMemoryData({
        userEmail: email,
        userId: userData.id,
        memorySummary: profileData.memory_summary || 'No memory summary found',
        lastUpdated: profileData.updated_at ? new Date(profileData.updated_at).toLocaleString() : 'Unknown'
      })
    } catch (err) {
      console.error('Error fetching memory summary:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Function to trigger memory summarization via API
  async function triggerMemorySummarization() {
    if (!email) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/gptRouter?email=${encodeURIComponent(email)}&action=refresh_memory`)
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error || 'Failed to trigger memory summarization')
      
      alert('Memory summarization triggered successfully!\nClick "Show Memory" again to see the updated summary.')
    } catch (err) {
      console.error('Error triggering memory summarization:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="container mt-5">
        <h1 className="mb-4">Debug Memory Summary</h1>
        
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title">Show User Memory</h5>
            <div className="mb-3">
              <label htmlFor="emailInput" className="form-label">User Email</label>
              <input 
                type="email" 
                className="form-control" 
                id="emailInput"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter user email"
              />
            </div>
            <div className="d-flex gap-2">
              <button 
                className="btn btn-primary" 
                onClick={fetchMemorySummary}
                disabled={!email || loading}
              >
                {loading ? 'Loading...' : 'Show Memory'}
              </button>
              <button 
                className="btn btn-warning" 
                onClick={triggerMemorySummarization}
                disabled={!email || loading}
              >
                Force Update Memory
              </button>
            </div>
            
            {error && (
              <div className="alert alert-danger mt-3">
                {error}
              </div>
            )}
          </div>
        </div>
        
        {memoryData && (
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <div>Memory for {memoryData.userEmail}</div>
              <small className="text-muted">Last updated: {memoryData.lastUpdated}</small>
            </div>
            <div className="card-body">
              <h5 className="card-title">Memory Summary</h5>
              <div className="bg-light p-3 rounded" style={{whiteSpace: 'pre-wrap'}}>
                {memoryData.memorySummary}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
