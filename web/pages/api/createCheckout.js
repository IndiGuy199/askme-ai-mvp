// api/createCheckout.js
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16'
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { priceId, email, token_count } = req.body

  if (!priceId || !email || !token_count) {
    return res.status(400).json({ error: 'Missing required parameters' })
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      metadata: {
        token_count: token_count.toString()
      },
      success_url: `${appUrl}/dashboard?success=true`,
      cancel_url: `${appUrl}/dashboard?canceled=true`
    })

    return res.status(200).json({ url: session.url })
  } catch (error) {
    console.error('Stripe session error:', error.message)
    return res.status(500).json({ error: 'Something went wrong creating checkout session.' })
  }
}
