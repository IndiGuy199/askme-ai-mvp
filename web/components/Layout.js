import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../utils/supabaseClient'

export default function Layout({ children, title = 'AskMe AI', hideNavigation = false }) {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Error signing out:', error)
      }

      // Clear any local storage items
      localStorage.removeItem('pendingEmail')
      
      // Clear session storage
      sessionStorage.clear()
      
      // Clear any other stored user data
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('askme_') || key.startsWith('supabase.')) {
          localStorage.removeItem(key)
        }
      })

      console.log('User logged out successfully')
      
      // Force router to refresh and redirect to login page
      window.location.href = '/login'
        } catch (error) {
      console.error('Error during logout:', error)
      // Still redirect to login even if there's an error
      window.location.href = '/login'
    }
  }
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Your AI Wellness Companion" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />      </Head>
      {!hideNavigation && (
        <nav className="navbar navbar-expand navbar-light bg-white border-bottom mb-4" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>          <div className="container">
            <div className="navbar-nav me-auto">
              <Link href="/dashboard" className="nav-link">Dashboard</Link>
              <Link href="/chat" className="nav-link">Chat</Link>
              <Link href="/favorites" className="nav-link">
                <i className="bi bi-star me-1"></i>Favorites
              </Link>
              <Link href="/buy-tokens" className="nav-link">Buy Tokens</Link>
            </div>            <div className="navbar-nav ms-auto">
              <button 
                onClick={handleLogout}
                className="nav-link btn btn-link text-decoration-none p-0"
                style={{ 
                  border: 'none', 
                  background: 'none',
                  color: 'inherit',
                  padding: '0.5rem 1rem'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </nav>
      )}
      
      <main style={{ minHeight: '80vh', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        {children}
      </main>
    </>
  )
}