import { useState } from 'react'
import Link from 'next/link'
import Layout from '../components/Layout'

export default function FAQ() {
  const [openFAQ, setOpenFAQ] = useState(null)

  const faqs = [
    {
      id: 1,
      question: "What is AskMe AI?",
      answer: "AskMe AI is your personal wellness companion. We provide AI-powered coaching, mentorship, and support tailored for men 30+ looking to improve their mental, emotional, and physical well-being."
    },
    {
      id: 2,
      question: "How do I start using AskMe AI?",
      answer: "Simply sign up, complete your profile, and select the challenges you'd like to work on. Your personalized dashboard and AI coach will guide you from there."
    },
    {
      id: 3,
      question: "How do I buy more tokens?",
      answer: "Go to the 'Buy Tokens' section from your dashboard or the top navigation menu. Choose your preferred token pack and corporate your purchase securely."
    },
    {
      id: 4,
      question: "What happens when I run out of tokens?",
      answer: "When your token balance runs low, you'll receive a prompt to purchase more tokens. Tokens are needed to chat with your AI coach and access premium features."
    },
    {
      id: 5,
      question: "Is my data secure and private?",
      answer: "Yes! We use industry-standard security protocols to protect your personal data. Your conversations are confidential and never shared with third parties."
    },
    {
      id: 6,
      question: "Can I get advice for specific health or mental health conditions?",
      answer: "AskMe AI provides guidance, support, and educational information, but does not replace professional medical advice or therapy. For serious conditions, always consult a qualified professional."
    }
  ]

  const toggleFAQ = (id) => {
    setOpenFAQ(openFAQ === id ? null : id)
  }

  return (
    <Layout title="FAQ - AskMe AI">
      {/* Main Content */}
      <div className="container" style={{ maxWidth: '800px', paddingTop: '2rem' }}>
        
        {/* Header Section */}
        <div className="text-center mb-5">
          <h1 style={{ 
            fontSize: '3.5rem',
            fontWeight: '700',
            color: '#2d3748',
            marginBottom: '1rem',
            lineHeight: '1.1'
          }}>
            Frequently Asked Questions
          </h1>
        </div>

        {/* FAQ Items */}
        <div style={{
          background: 'white',
          borderRadius: '24px',
          padding: '2rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
          marginBottom: '2rem'
        }}>
          {faqs.map((faq) => (
            <div key={faq.id} className="mb-3">
              <button
                className="btn w-100 text-start d-flex justify-content-between align-items-center p-3"
                style={{
                  background: openFAQ === faq.id ? '#f8fafc' : 'transparent',
                  border: '2px solid #f1f5f9',
                  borderRadius: '16px',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: '#2d3748',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => toggleFAQ(faq.id)}
              >
                <span>{faq.question}</span>
                <i className={`bi bi-chevron-${openFAQ === faq.id ? 'up' : 'down'}`} 
                   style={{ fontSize: '1.2rem', color: '#667eea' }}></i>
              </button>
              
              {openFAQ === faq.id && (
                <div style={{
                  padding: '1.5rem',
                  margin: '0.5rem 0',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <p style={{
                    margin: 0,
                    color: '#4a5568',
                    lineHeight: '1.6',
                    fontSize: '1rem'
                  }}>
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* "Didn't find your answer?" Section */}
        <div className="text-center" style={{
          background: 'white',
          borderRadius: '24px',
          padding: '3rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
          marginBottom: '2rem'
        }}>
          <h2 style={{ 
            fontSize: '2rem',
            fontWeight: '700',
            color: '#2d3748',
            marginBottom: '1rem'
          }}>
            Didn't find your answer?
          </h2>
          <p style={{ 
            fontSize: '1.1rem', 
            color: '#718096', 
            marginBottom: '2rem' 
          }}>
            Check our Help Center or contact us below!
          </p>
          <Link href="/contact" 
                className="btn btn-lg rounded-pill px-5 py-3 text-decoration-none"
                style={{ 
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  border: 'none',
                  color: 'white',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)'
                  e.target.style.boxShadow = '0 8px 30px rgba(59, 130, 246, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)'
                  e.target.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.3)'
                }}
          >
            Contact Support
          </Link>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        .btn:focus {
          box-shadow: 0 0 0 4px rgba(167, 139, 250, 0.1) !important;
          outline: none;
        }
        
        .btn:hover {
          border-color: #a78bfa !important;
        }
        
        @media (max-width: 768px) {
          .container {
            padding: 0 1rem;
          }
          
          h1 {
            font-size: 2.5rem !important;
          }
          
          h2 {
            font-size: 1.5rem !important;
          }
        }
        
        @media (max-width: 576px) {
          h1 {
            font-size: 2rem !important;
          }
          
          h2 {
            font-size: 1.3rem !important;
          }
        }
        
        /* Smooth transitions */
        * {
          transition: all 0.2s ease;
        }
      `}</style>
    </Layout>
  )
}
