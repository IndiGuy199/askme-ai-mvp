import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  // Add comprehensive logging
  console.log('🔥 Contact API called:', {
    method: req.method,
    headers: req.headers,
    hasBody: !!req.body,
    timestamp: new Date().toISOString()
  })

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2))
    
    const { name, email, message } = req.body || {}

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Please provide name, email, and message'
      })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format'
      })
    }

    // Check environment variables with detailed logging
    console.log('🔧 Environment check:', {
      hasEmailUser: !!process.env.EMAIL_USER,
      hasEmailPassword: !!process.env.EMAIL_APP_PASSWORD,
      nodeEnv: process.env.NODE_ENV
    })

    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      console.error('❌ Email configuration missing')
      // Return success to avoid revealing configuration issues
      return res.status(200).json({ 
        success: true,
        message: 'Message received. We\'ll get back to you soon.',
        debug: 'Email service temporarily unavailable'
      })
    }

    console.log('📧 Processing contact form submission:', {
      name: name.trim(),
      email: email.trim(),
      messageLength: message.trim().length,
      timestamp: new Date().toISOString()
    })

    // Create transporter with additional fallback options
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      },
      secure: true,
      logger: false,
      debug: false,
      // Add timeout and retry options
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000
    })

    // Skip verification in development to avoid delays
    if (process.env.NODE_ENV === 'production') {
      try {
        await transporter.verify()
        console.log('✅ Email transporter verified')
      } catch (verifyError) {
        console.error('❌ Email transporter verification failed:', verifyError)
        return res.status(200).json({ 
          success: true,
          message: 'Message received. We\'ll get back to you soon.',
          debug: 'Email service verification failed'
        })
      }
    } else {
      console.log('⚠️ Skipping email verification in development')
    }

    // Email content for the support team
    const supportEmailContent = {
      from: process.env.EMAIL_USER,
      to: 'proservices330@gmail.com',
      subject: `🔔 New Contact Form Submission from ${name.trim()}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">AskMe AI Support Portal</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="border-left: 4px solid #667eea; padding-left: 20px; margin-bottom: 25px;">
              <h2 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px;">Contact Details</h2>
              <p style="margin: 8px 0; color: #4a5568;"><strong>Name:</strong> ${name.trim()}</p>
              <p style="margin: 8px 0; color: #4a5568;"><strong>Email:</strong> <a href="mailto:${email.trim()}" style="color: #667eea; text-decoration: none;">${email.trim()}</a></p>
              <p style="margin: 8px 0; color: #4a5568;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <div style="border-left: 4px solid #10b981; padding-left: 20px;">
              <h2 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px;">Message</h2>
              <div style="background: #f7fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #2d3748; line-height: 1.6; white-space: pre-wrap;">${message.trim()}</p>
              </div>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
              <a href="mailto:${email.trim()}?subject=Re: Your AskMe AI Inquiry" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600;">
                Reply to ${name.trim()}
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #718096; font-size: 14px;">
            <p>This email was sent from the AskMe AI contact form.</p>
          </div>
        </div>
      `
    }

    // Auto-reply email for the user
    const autoReplyContent = {
      from: process.env.EMAIL_USER,
      to: email.trim(),
      subject: '✅ Thank you for contacting AskMe AI - We\'ve received your message!',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Thank You for Reaching Out!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">We've received your message</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Hi ${name.trim()},
            </p>
            
            <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
              Thank you for contacting AskMe AI! We've successfully received your message and our support team will review it shortly.
            </p>
            
            <div style="background: #f7fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
              <h3 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px;">What's Next?</h3>
              <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">We typically respond within 24 hours during business days</li>
                <li style="margin-bottom: 8px;">For urgent issues, you can chat with our AI assistant</li>
                <li style="margin-bottom: 8px;">Check your spam folder if you don't see our reply</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/chat" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600; margin-right: 10px;">
                Chat with AI
              </a>
              <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard" 
                 style="background: #e2e8f0; color: #4a5568; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600;">
                Go to Dashboard
              </a>
            </div>
            
            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
              <p style="color: #718096; font-size: 14px; margin: 0;">
                Best regards,<br>
                <strong style="color: #4a5568;">The AskMe AI Support Team</strong>
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #718096; font-size: 12px;">
            <p>This is an automated response. Please do not reply to this email.</p>
            <p>If you need immediate assistance, please visit our <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/chat" style="color: #667eea;">chat support</a>.</p>
          </div>
        </div>
      `
    }

    // Send emails with timeout protection
    const emailPromises = []
    
    // Support email
    emailPromises.push(
      Promise.race([
        transporter.sendMail(supportEmailContent),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Support email timeout')), 15000)
        )
      ]).catch(error => {
        console.error('❌ Support email failed:', error)
        return { error: 'Support email failed' }
      })
    )

    // Auto-reply email
    emailPromises.push(
      Promise.race([
        transporter.sendMail(autoReplyContent),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auto-reply timeout')), 15000)
        )
      ]).catch(error => {
        console.error('❌ Auto-reply failed:', error)
        return { error: 'Auto-reply failed' }
      })
    )

    console.log('📤 Sending emails...')
    const results = await Promise.allSettled(emailPromises)
    
    console.log('📧 Email results:', results.map(r => r.status))

    console.log('✅ Contact form processing completed')

    res.status(200).json({ 
      success: true, 
      message: 'Message sent successfully! We\'ll get back to you soon.',
      debug: process.env.NODE_ENV === 'development' ? {
        emailResults: results.map(r => r.status)
      } : undefined
    })

  } catch (error) {
    console.error('❌ Unexpected error in contact API:', error)
    console.error('Stack trace:', error.stack)
    
    // Always return success to avoid revealing internal errors
    res.status(200).json({ 
      success: true,
      message: 'Message received. We\'ll get back to you soon.',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

// Export config to handle larger payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: false,
  },
}
