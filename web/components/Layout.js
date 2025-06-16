import Head from 'next/head'
import Link from 'next/link'

export default function Layout({ children, title = 'AskMe AI' }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Your AI Wellness Companion" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
      </Head>
      <nav className="navbar navbar-expand navbar-light bg-white border-bottom mb-4">
        <div className="container">          <div className="navbar-nav me-auto">
            <Link href="/dashboard" className="nav-link">Dashboard</Link>
            <Link href="/chat" className="nav-link">Chat</Link>
            <Link href="/favorites" className="nav-link">
              <i className="bi bi-star me-1"></i>Favorites
            </Link>
            <Link href="/buy-tokens" className="nav-link">Buy Tokens</Link>
          </div>
          <div className="navbar-nav ms-auto">
            <Link href="/logout" className="nav-link">Logout</Link>
          </div>
        </div>
      </nav>
      <main className="container d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        {children}
      </main>
    </>
  )
}