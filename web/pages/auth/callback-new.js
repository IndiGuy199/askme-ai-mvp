import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        console.log('🚀 Processing auth callback...')
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session) {
          console.error('❌ Session error:', sessionError)
          router.replace('/login')
          return
        }

        console.log('✅ Session found for user:', session.user.email)
        
        // Check if user profile exists and is complete
        const { data: userProfile } = await supabase
          .from('users')
          .select('profile_completed')
          .eq('email', session.user.email)
          .single()
        
        if (userProfile?.profile_completed) {
          console.log('✅ Profile complete, redirecting to dashboard')
          router.replace('/dashboard')
        } else {
          console.log('📝 Profile incomplete, redirecting to setup')
          router.replace('/profile-setup')
        }
      } catch (error) {
        console.error('💥 Error in auth callback:', error)
        router.replace('/login')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(255, 255, 255, 0.3)',
          borderTop: '4px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 2rem'
        }}></div>
        <h3 style={{ marginBottom: '0.5rem' }}>Completing Sign In...</h3>
        <p style={{ opacity: 0.8 }}>Please wait while we set up your account</p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}
