import { buffer } from 'micro'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  console.log('🚀 Webhook called with method:', req.method)
  console.log('🚀 Headers:', req.headers)
  
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  const sig = req.headers['stripe-signature']
  const buf = await buffer(req)

  console.log('🔍 Webhook signature present:', !!sig)
  console.log('🔍 Buffer length:', buf.length)

  let event
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET)
    console.log('✅ Webhook signature verified successfully')
  } catch (err) {
    console.error('❌ Webhook signature failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  console.log('📨 Received event type:', event.type)

  // ✅ Token grant logic
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const email = session.customer_email
    const priceId = session.metadata?.price_id || session.line_items?.data?.[0]?.price?.id
    
    console.log('💳 Checkout completed for:', email)
    console.log('💰 Price ID:', priceId)
    console.log('📋 Session metadata:', session.metadata)
    console.log('📦 Full session object keys:', Object.keys(session))
    
    // Map price IDs to token amounts
    let tokenAmount = 0;
    if (priceId === 'price_1RWlea4gLT9aIqMDkebCi9N2') {
      tokenAmount = 10000; // 10k tokens for $4.99
      console.log('🎯 Matched 10k token package')
    } else if (priceId === 'price_1RWlfr4gLT9aIqMDl62HX9DF') {
      tokenAmount = 25000; // 25k tokens for $9.99
      console.log('🎯 Matched 25k token package')
    } else {
      // Fallback to metadata if price ID mapping fails
      tokenAmount = parseInt(session.metadata?.token_count || '0');
      console.log('🔄 Using metadata fallback, token_count:', session.metadata?.token_count)
    }
    
    console.log('💎 Crediting tokens:', tokenAmount)
    console.log('📧 Email to credit:', email)

    if (tokenAmount > 0 && email) {
      console.log('🔍 Looking up user in database...')
      const { data: user, error: userError } = await supabase.from('users').select('id, tokens, email').eq('email', email).single()
      
      if (userError) {
        console.error('❌ Error finding user:', userError)
        console.log('📊 User lookup details:', { email, userError })
      }
      
      if (user) {
        console.log('👤 Found user:', { id: user.id, currentTokens: user.tokens, email: user.email })
        const newBalance = user.tokens + tokenAmount;
        console.log('💰 New balance will be:', newBalance)
        
        const { error } = await supabase
          .from('users')
          .update({ tokens: newBalance })
          .eq('id', user.id)
        
        if (error) {
          console.error('❌ Error updating tokens:', error)
          console.log('📊 Update details:', { userId: user.id, newBalance, error })
        } else {
          console.log(`✅ Successfully credited ${tokenAmount} tokens to ${email}. New balance: ${newBalance}`)
        }
      } else {
        console.error('❌ User not found for email:', email)
      }
    } else {
      console.error('❌ Invalid token amount or email:', { tokenAmount, email })
    }
  } else {
    console.log('ℹ️ Ignoring event type:', event.type)
  }

  res.status(200).json({ received: true })
}