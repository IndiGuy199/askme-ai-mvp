import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const router = useRouter()

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setToast({ message: 'Please fill in all fields', type: 'error' })
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          message: formData.message.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
      }
      
      setSubmitted(true)
      setToast({ message: data.message || 'Message sent successfully! We\'ll get back to you soon.', type: 'success' })
      
      // Reset form after success
      setTimeout(() => {
        setFormData({ name: '', email: '', message: '' })
        setSubmitted(false)
      }, 3000)
      
    } catch (error) {
      console.error('Contact form error:', error)
      setToast({ message: error.message || 'Failed to send message. Please try again.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout title="Contact Us - AskMe AI">
      {/* Main Content */}
      <div className="container" style={{ maxWidth: '600px', paddingTop: '2rem' }}>
          
          {/* Header Section */}
          <div className="text-center mb-5">
            <h1 style={{ 
              fontSize: '3.5rem',
              fontWeight: '700',
              color: '#2d3748',
              marginBottom: '1rem',
              lineHeight: '1.1'
            }}>
              We're here to help!
            </h1>
            <p style={{ 
              fontSize: '1.2rem',
              color: '#718096',
              fontWeight: '400',
              maxWidth: '500px',
              margin: '0 auto'
            }}>
              Have questions or feedback? Feel free to reach out.
            </p>
          </div>

        {/* Contact Form Card */}
        <div style={{
          background: 'white',
          borderRadius: '24px',
          padding: '3rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
          marginBottom: '2rem'
        }}>
          
          {/* Heart Icon */}
          <div className="text-center mb-4">
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto'
            }}>
              <i className="bi bi-heart-fill text-white" style={{ fontSize: '2rem' }}></i>
            </div>
          </div>

          {submitted ? (
            <div className="text-center py-5">
              <div style={{ 
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 2rem'
              }}>
                <i className="bi bi-check-lg" style={{ 
                  fontSize: '2rem',
                  color: 'white'
                }}></i>
              </div>
              <h3 className="fw-bold mb-2" style={{ color: '#2d3748' }}>
                Message Sent!
              </h3>
              <p className="text-muted mb-3">
                Thank you for reaching out. We'll get back to you within 24 hours.
              </p>
              <button 
                className="btn rounded-pill px-4 py-2"
                onClick={() => router.push('/dashboard')}
                style={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  color: 'white',
                  fontWeight: '600'
                }}
              >
                Back to Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <div style={{ position: 'relative' }}>
                  <i className="bi bi-person-fill" style={{
                    position: 'absolute',
                    left: '20px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#a78bfa',
                    fontSize: '1.2rem',
                    zIndex: 2
                  }}></i>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    style={{ 
                      border: '2px solid #f1f5f9',
                      borderRadius: '16px',
                      padding: '16px 20px 16px 55px',
                      fontSize: '1rem',
                      height: '60px',
                      background: '#f8fafc',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#a78bfa'}
                    onBlur={(e) => e.target.style.borderColor = '#f1f5f9'}
                  />
                </div>
              </div>

              <div className="mb-4">
                <div style={{ position: 'relative' }}>
                  <i className="bi bi-envelope-fill" style={{
                    position: 'absolute',
                    left: '20px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#a78bfa',
                    fontSize: '1.2rem',
                    zIndex: 2
                  }}></i>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    style={{ 
                      border: '2px solid #f1f5f9',
                      borderRadius: '16px',
                      padding: '16px 20px 16px 55px',
                      fontSize: '1rem',
                      height: '60px',
                      background: '#f8fafc',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#a78bfa'}
                    onBlur={(e) => e.target.style.borderColor = '#f1f5f9'}
                  />
                </div>
              </div>

              <div className="mb-4">
                <textarea
                  className="form-control"
                  placeholder="Message"
                  rows="5"
                  value={formData.message}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  style={{ 
                    border: '2px solid #f1f5f9',
                    borderRadius: '16px',
                    padding: '20px',
                    fontSize: '1rem',
                    background: '#f8fafc',
                    resize: 'vertical',
                    minHeight: '120px',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#a78bfa'}
                  onBlur={(e) => e.target.style.borderColor = '#f1f5f9'}
                ></textarea>
              </div>

              <div className="text-center">
                <button
                  type="submit"
                  className="btn btn-lg rounded-pill px-5 py-3"
                  disabled={loading}
                  style={{ 
                    background: loading 
                      ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                      : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    border: 'none',
                    color: 'white',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    minWidth: '200px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.target.style.transform = 'translateY(-2px)'
                      e.target.style.boxShadow = '0 8px 30px rgba(59, 130, 246, 0.4)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.target.style.transform = 'translateY(0)'
                      e.target.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.3)'
                    }
                  }}
                >
                  {loading ? (
                    <>
                      <div className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      Sending...
                    </>
                  ) : (
                    'Send Message'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Direct Contact Section */}
        <div className="text-center">
          <p style={{ fontSize: '1rem', color: '#718096', marginBottom: '0.5rem' }}>
            Or email us directly at
          </p>
          <a 
            href="mailto:support@askmeai.com"
            style={{ 
              fontSize: '1.2rem',
              fontWeight: '600',
              color: '#3b82f6',
              textDecoration: 'none'
            }}
          >
            support@askmeai.com
          </a>
          <p style={{ fontSize: '0.9rem', color: '#a0aec0', marginTop: '0.5rem' }}>
            .
          </p>
        </div>

        </div>
      
      {/* Toast Notification */}
      {toast.message && (
        <div 
          className={`position-fixed top-0 end-0 m-3 p-3 rounded-4 shadow-lg ${
            toast.type === 'error' ? 'bg-danger text-white' : 'bg-success text-white'
          }`}
          style={{ zIndex: 1050, minWidth: '300px' }}
        >
          <div className="d-flex align-items-center">
            <span className="me-2">{toast.type === 'error' ? '❌' : '✅'}</span>
            <span className="flex-grow-1">{toast.message}</span>
            <button 
              className="btn-close btn-close-white ms-2"
              onClick={() => setToast({ message: '', type: 'success' })}
            ></button>
          </div>
        </div>
      )}

      {/* Custom Styles */}
      <style jsx>{`
        .form-control:focus {
          box-shadow: 0 0 0 4px rgba(167, 139, 250, 0.1) !important;
          outline: none;
        }
        
        .btn:disabled {
          transform: none !important;
          opacity: 0.8;
        }
        
        @media (max-width: 768px) {
          .container {
            padding: 0 1rem;
          }
          
          h1 {
            font-size: 2.5rem !important;
          }
        }
        
        @media (max-width: 576px) {
          h1 {
            font-size: 2rem !important;
          }
        }
        
        .spinner-border-sm {
          width: 1rem;
          height: 1rem;
        }
        
        /* Smooth transitions */
        * {
          transition: all 0.2s ease;
        }
      `}</style>
    </Layout>
  )
}