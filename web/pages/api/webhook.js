import { buffer } from 'micro'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  const timestamp = new Date().toISOString()
  console.log(`🚀 [${timestamp}] Webhook called with method:`, req.method)
  console.log(`🚀 [${timestamp}] Headers:`, JSON.stringify(req.headers, null, 2))
  
  if (req.method !== 'POST') {
    console.log(`❌ [${timestamp}] Invalid method: ${req.method}`)
    return res.status(405).end('Method Not Allowed')
  }

  const sig = req.headers['stripe-signature']
  const buf = await buffer(req)

  console.log(`🔍 [${timestamp}] Webhook signature present:`, !!sig)
  console.log(`🔍 [${timestamp}] Buffer length:`, buf.length)
  console.log(`🔍 [${timestamp}] STRIPE_WEBHOOK_SECRET set:`, !!process.env.STRIPE_WEBHOOK_SECRET)

  let event
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET)
    console.log(`✅ [${timestamp}] Webhook signature verified successfully`)
  } catch (err) {
    console.error(`❌ [${timestamp}] Webhook signature failed:`, err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  console.log(`📨 [${timestamp}] Received event type:`, event.type)
  console.log(`📨 [${timestamp}] Event ID:`, event.id)

  // ✅ Token grant logic
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const email = session.customer_email
    const priceId = session.metadata?.price_id || session.line_items?.data?.[0]?.price?.id
    
    console.log(`💳 [${timestamp}] Checkout completed for:`, email)
    console.log(`💰 [${timestamp}] Price ID:`, priceId)
    console.log(`📋 [${timestamp}] Session metadata:`, JSON.stringify(session.metadata, null, 2))
    console.log(`🆔 [${timestamp}] Session ID:`, session.id)
    
    // Enhanced logging for debugging
    if (session.line_items?.data?.length > 0) {
      console.log(`🛒 [${timestamp}] Line items:`, JSON.stringify(session.line_items.data, null, 2))
    }
    
    // Map price IDs to token amounts
    let tokenAmount = 0;
    if (priceId === 'price_1RWlea4gLT9aIqMDkebCi9N2') {
      tokenAmount = 10000; // 10k tokens for $4.99
      console.log(`🎯 [${timestamp}] Matched 10k token package`)
    } else if (priceId === 'price_1RWlfr4gLT9aIqMDl62HX9DF') {
      tokenAmount = 25000; // 25k tokens for $9.99
      console.log(`🎯 [${timestamp}] Matched 25k token package`)
    } else {
      // Fallback to metadata if price ID mapping fails
      tokenAmount = parseInt(session.metadata?.token_count || '0');
      console.log(`🔄 [${timestamp}] Using metadata fallback, token_count:`, session.metadata?.token_count)
    }
    
    console.log(`💎 [${timestamp}] Crediting tokens:`, tokenAmount, `to email:`, email)

    if (tokenAmount > 0 && email) {
      console.log(`🔍 [${timestamp}] Looking up user in database...`)
      const { data: user, error: userError } = await supabase.from('users').select('id, tokens, email').eq('email', email).single()
      
      if (userError) {
        console.error(`❌ [${timestamp}] Error finding user:`, userError)
        console.log(`📊 [${timestamp}] User lookup details:`, { email, userError })
        
        // Additional debugging: check if user exists with different email format
        const { data: allUsers, error: allUsersError } = await supabase
          .from('users')
          .select('id, email')
          .ilike('email', `%${email.split('@')[0]}%`)
          .limit(5)
        
        if (!allUsersError && allUsers?.length > 0) {
          console.log(`🔍 [${timestamp}] Similar email addresses found:`, allUsers.map(u => u.email))
        }
      }
      
      if (user) {
        console.log(`👤 [${timestamp}] Found user:`, { id: user.id, currentTokens: user.tokens, email: user.email })
        const newBalance = user.tokens + tokenAmount;
        console.log(`💰 [${timestamp}] New balance will be:`, newBalance)
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ tokens: newBalance })
          .eq('id', user.id)
        
        if (updateError) {
          console.error(`❌ [${timestamp}] Error updating tokens:`, updateError)
          console.log(`📊 [${timestamp}] Update details:`, { userId: user.id, newBalance, updateError })
        } else {
          console.log(`✅ [${timestamp}] Successfully credited ${tokenAmount} tokens to ${email}. New balance: ${newBalance}`)
        }
      } else {
        console.error(`❌ [${timestamp}] User not found for email:`, email)
        
        // Additional debugging: show total user count
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
        console.log(`📊 [${timestamp}] Total users in database:`, count)
      }
    } else {
      console.error(`❌ [${timestamp}] Invalid token amount or email:`, { tokenAmount, email })
    }
  } else {
    console.log(`ℹ️ [${timestamp}] Ignoring event type:`, event.type)
  }

  console.log(`✅ [${timestamp}] Webhook processing completed`)
  res.status(200).json({ received: true, timestamp })
}