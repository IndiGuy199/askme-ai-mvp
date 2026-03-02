import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'

const BRAND = 'AI assisted recovery coach'

// Shared link style helpers
const navLink = { color: '#4a5568', fontWeight: '500', transition: 'all 0.2s ease', textDecoration: 'none' }

export default function Layout({ children, title = BRAND, hideNavigation = false, forcePreLogin = false }) {
  const router = useRouter()
  const [session, setSession] = useState(undefined) // undefined = loading, null = no session
  const [mobileOpen, setMobileOpen] = useState(false)

  // Resolve auth state once on mount, then listen for changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [router.pathname])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      localStorage.removeItem('pendingEmail')
      sessionStorage.clear()
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('askme_') || key.startsWith('supabase.')) localStorage.removeItem(key)
      })
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      window.location.href = '/login'
    }
  }

  const isLoggedIn = forcePreLogin ? false : Boolean(session)
  // While loading, render nothing in the menu area to avoid a flicker
  const navReady = forcePreLogin ? true : session !== undefined

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
            <nav style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '20px',
              padding: '0.75rem 2rem',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'nowrap',
              position: 'relative'
            }}>

              {/* Brand */}
              <Link href={isLoggedIn ? '/playbook' : '/'} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', flexShrink: 0
                }}>
                  <i className="bi bi-chat-dots-fill" style={{ color: 'white', fontSize: '1.2rem' }}></i>
                </div>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#2d3748', whiteSpace: 'nowrap' }}>{BRAND}</span>
              </Link>

              {/* Desktop nav — only render once auth state is known */}
              {navReady && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}
                    className="d-none d-lg-flex">
                  {isLoggedIn ? (
                    <>
                      <li><Link href="/playbook" className="nav-link px-3 py-2 rounded-pill" style={navLink}><i className="bi bi-book me-1"></i>Playbook</Link></li>
                      <li><Link href="/buy-tokens" className="nav-link px-3 py-2 rounded-pill" style={navLink}>Buy Tokens</Link></li>
                      <li><Link href="/faq" className="nav-link px-3 py-2 rounded-pill" style={navLink}>FAQ</Link></li>
                      <li><Link href="/contact" className="nav-link px-3 py-2 rounded-pill" style={navLink}>Contact Us</Link></li>
                      <li>
                        <button onClick={handleLogout} style={{
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          color: 'white', fontWeight: '500', border: 'none',
                          padding: '8px 18px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.9rem'
                        }}>Logout</button>
                      </li>
                    </>
                  ) : (
                    <>
                      <li><Link href="/support-now" className="nav-link px-3 py-2 rounded-pill" style={navLink}>Urge Support</Link></li>
                      <li><Link href="/demo" className="nav-link px-3 py-2 rounded-pill" style={navLink}>Demo</Link></li>
                      <li><Link href="/faq" className="nav-link px-3 py-2 rounded-pill" style={navLink}>FAQ</Link></li>
                      <li><Link href="/contact" className="nav-link px-3 py-2 rounded-pill" style={navLink}>Contact Us</Link></li>
                      <li>
                        <Link href="/login" style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white', fontWeight: '600', textDecoration: 'none',
                          padding: '8px 20px', borderRadius: '999px', fontSize: '0.9rem', whiteSpace: 'nowrap'
                        }}>Sign In</Link>
                      </li>
                    </>
                  )}
                </ul>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(o => !o)}
                className="d-flex d-lg-none"
                aria-label="Toggle menu"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '4px 8px', borderRadius: '8px',
                  lineHeight: 1, flexShrink: 0
                }}
              >
                <i className="bi bi-list" style={{ fontSize: '1.8rem', color: '#2d3748' }}></i>
              </button>

              {/* Mobile dropdown */}
              {mobileOpen && navReady && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                  background: 'white', borderRadius: '16px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                  zIndex: 1000, padding: '12px 8px',
                  display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                  {isLoggedIn ? (
                    <>
                      <Link href="/playbook" style={{ ...navLink, padding: '10px 16px', borderRadius: '10px', display: 'block' }}><i className="bi bi-book me-2"></i>Playbook</Link>
                      <Link href="/buy-tokens" style={{ ...navLink, padding: '10px 16px', borderRadius: '10px', display: 'block' }}>Buy Tokens</Link>
                      <Link href="/faq" style={{ ...navLink, padding: '10px 16px', borderRadius: '10px', display: 'block' }}>FAQ</Link>
                      <Link href="/contact" style={{ ...navLink, padding: '10px 16px', borderRadius: '10px', display: 'block' }}>Contact Us</Link>
                      <button onClick={handleLogout} style={{
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: 'white', fontWeight: '500', border: 'none',
                        padding: '10px 16px', borderRadius: '10px', cursor: 'pointer',
                        textAlign: 'left', fontSize: '1rem', marginTop: '4px'
                      }}>Logout</button>
                    </>
                  ) : (
                    <>
                      <Link href="/support-now" style={{ ...navLink, padding: '10px 16px', borderRadius: '10px', display: 'block' }}>Urge Support</Link>
                      <Link href="/demo" style={{ ...navLink, padding: '10px 16px', borderRadius: '10px', display: 'block' }}>Demo</Link>
                      <Link href="/faq" style={{ ...navLink, padding: '10px 16px', borderRadius: '10px', display: 'block' }}>FAQ</Link>
                      <Link href="/contact" style={{ ...navLink, padding: '10px 16px', borderRadius: '10px', display: 'block' }}>Contact Us</Link>
                      <Link href="/login" style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white', fontWeight: '600', textDecoration: 'none',
                        padding: '10px 16px', borderRadius: '10px', display: 'block',
                        textAlign: 'center', marginTop: '4px'
                      }}>Sign In</Link>
                    </>
                  )}
                </div>
              )}
            </nav>
          </div>
        </div>
      )}

      <main style={{
        minHeight: '80vh',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        background: hideNavigation ? 'white' : 'linear-gradient(135deg, #e8f2ff 0%, #f0e8ff 50%, #e8f2ff 100%)'
      }}>
        {children}
      </main>
    </>
  )
}