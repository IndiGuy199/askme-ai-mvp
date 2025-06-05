import { buffer } from 'micro'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  const sig = req.headers['stripe-signature']
  const buf = await buffer(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // ✅ Token grant logic
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const email = session.customer_email
    const tokenAmount = parseInt(session.metadata.token_count || '0')

    const { data: user } = await supabase.from('users').select('id, tokens').eq('email', email).single()
    if (user) {
      await supabase
        .from('users')
        .update({ tokens: user.tokens + tokenAmount })
        .eq('id', user.id)
    }
  }

  res.status(200).json({ received: true })
}
