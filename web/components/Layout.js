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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      
      {!hideNavigation && (
        <div style={{
          background: 'linear-gradient(135deg, #e8f2ff 0%, #f0e8ff 50%, #e8f2ff 100%)',
          paddingTop: '2rem',
          paddingBottom: '1rem'
        }}>
          <div className="container">
            <nav className="navbar navbar-expand-lg" style={{ 
              background: 'rgba(255, 255, 255, 0.95)', 
              borderRadius: '20px', 
              padding: '0.75rem 2rem', 
              backdropFilter: 'blur(10px)', 
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              <div className="container-fluid">
                <Link href="/dashboard" className="navbar-brand d-flex align-items-center text-decoration-none">
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px'
                  }}>
                    <i className="bi bi-chat-dots-fill text-white" style={{ fontSize: '1.2rem' }}></i>
                  </div>
                  <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2d3748' }}>AskMe AI</span>
                </Link>
                
                {/* Mobile menu toggle */}
                <button 
                  className="navbar-toggler border-0" 
                  type="button" 
                  data-bs-toggle="collapse" 
                  data-bs-target="#navbarNav"
                  style={{ background: 'none', boxShadow: 'none' }}
                >
                  <i className="bi bi-list" style={{ fontSize: '1.5rem', color: '#2d3748' }}></i>
                </button>
                
                <div className="collapse navbar-collapse" id="navbarNav">
                  <ul className="navbar-nav ms-auto d-flex gap-1">
                    <li className="nav-item">
                      <Link href="/playbook" className="nav-link px-3 py-2 rounded-pill text-decoration-none" 
                            style={{ color: '#4a5568', fontWeight: '500', transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => { e.target.style.backgroundColor = '#f1f5f9'; e.target.style.color = '#2d3748' }}
                            onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#4a5568' }}>
                        <i className="bi bi-book me-1"></i>Playbook
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link href="/dashboard" className="nav-link px-3 py-2 rounded-pill text-decoration-none" 
                            style={{ color: '#4a5568', fontWeight: '500', transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => { e.target.style.backgroundColor = '#f1f5f9'; e.target.style.color = '#2d3748' }}
                            onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#4a5568' }}>
                        Dashboard
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link href="/chat" className="nav-link px-3 py-2 rounded-pill text-decoration-none" 
                            style={{ color: '#4a5568', fontWeight: '500', transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => { e.target.style.backgroundColor = '#f1f5f9'; e.target.style.color = '#2d3748' }}
                            onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#4a5568' }}>
                        Chat
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link href="/favorites" className="nav-link px-3 py-2 rounded-pill text-decoration-none" 
                            style={{ color: '#4a5568', fontWeight: '500', transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => { e.target.style.backgroundColor = '#f1f5f9'; e.target.style.color = '#2d3748' }}
                            onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#4a5568' }}>
                        <i className="bi bi-star me-1"></i>Favorites
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link href="/buy-tokens" className="nav-link px-3 py-2 rounded-pill text-decoration-none" 
                            style={{ color: '#4a5568', fontWeight: '500', transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => { e.target.style.backgroundColor = '#f1f5f9'; e.target.style.color = '#2d3748' }}
                            onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#4a5568' }}>
                        Buy Tokens
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link href="/faq" className="nav-link px-3 py-2 rounded-pill text-decoration-none" 
                            style={{ color: '#4a5568', fontWeight: '500', transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => { e.target.style.backgroundColor = '#f1f5f9'; e.target.style.color = '#2d3748' }}
                            onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#4a5568' }}>
                        FAQ
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link href="/contact" className="nav-link px-3 py-2 rounded-pill text-decoration-none" 
                            style={{ color: '#4a5568', fontWeight: '500', transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => { e.target.style.backgroundColor = '#f1f5f9'; e.target.style.color = '#2d3748' }}
                            onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#4a5568' }}>
                        Contact Us
                      </Link>
                    </li>
                    <li className="nav-item">
                      <button 
                        onClick={handleLogout}
                        className="nav-link px-3 py-2 rounded-pill border-0 text-decoration-none"
                        style={{ 
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          color: 'white',
                          fontWeight: '500',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)' }}
                        onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = 'none' }}
                      >
                        Logout
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </nav>
          </div>
        </div>
      )}
      
      <main style={{ 
        minHeight: '80vh', 
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        background: hideNavigation ? 'white' : 'linear-gradient(135deg, #e8f2ff 0%, #f0e8ff 50%, #e8f2ff 100%)',
        paddingTop: hideNavigation ? '0' : '0'
      }}>
        {children}
      </main>
    </>
  )
}