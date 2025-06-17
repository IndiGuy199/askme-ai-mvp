import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../utils/supabaseClient'

export default function Logout() {
  const router = useRouter()

  useEffect(() => {
    const performLogout = async () => {
      try {
        // Sign out from Supabase
        const { error } = await supabase.auth.signOut()
        
        if (error) {
          console.error('Error signing out:', error)
        }

        // Clear any local storage items
        localStorage.removeItem('pendingEmail')
        localStorage.removeItem('askme_chat_' + localStorage.getItem('userEmail'))
        
        // Clear session storage
        sessionStorage.clear()
        
        // Clear any other stored user data
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('askme_') || key.startsWith('supabase.')) {
            localStorage.removeItem(key)
          }
        })

        console.log('User logged out successfully')
        
        // Redirect to login page
        router.push('/login')
        
      } catch (error) {
        console.error('Error during logout:', error)
        // Still redirect to login even if there's an error
        router.push('/login')
      }
    }

    performLogout()
  }, [router])

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '2rem',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          fontSize: '2rem',
          marginBottom: '1rem'
        }}>
          👋
        </div>
        <h2 style={{
          color: '#374151',
          marginBottom: '0.5rem',
          fontSize: '1.5rem'
        }}>
          Logging you out...
        </h2>
        <p style={{
          color: '#6b7280',
          margin: 0
        }}>
          Please wait while we securely sign you out.
        </p>
        <div style={{
          marginTop: '1.5rem',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
