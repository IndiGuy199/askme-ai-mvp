// pages/api/webhook-test.js - Test endpoint to verify webhook functionality
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, tokenAmount } = req.body

  if (!email || !tokenAmount) {
    return res.status(400).json({ error: 'Missing email or tokenAmount' })
  }

  console.log(`🧪 Testing token credit for ${email} with ${tokenAmount} tokens`)

  try {
    // Look up user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, tokens, email')
      .eq('email', email)
      .single()

    if (userError) {
      console.error('❌ User lookup error:', userError)
      return res.status(404).json({ error: 'User not found', details: userError })
    }

    if (user) {
      console.log('👤 Found user:', { id: user.id, currentTokens: user.tokens })
      const newBalance = user.tokens + parseInt(tokenAmount)
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ tokens: newBalance })
        .eq('id', user.id)

      if (updateError) {
        console.error('❌ Token update error:', updateError)
        return res.status(500).json({ error: 'Failed to update tokens', details: updateError })
      }

      console.log(`✅ Successfully credited ${tokenAmount} tokens. New balance: ${newBalance}`)
      return res.status(200).json({ 
        success: true, 
        user: user.email,
        previousBalance: user.tokens,
        newBalance: newBalance,
        tokensAdded: parseInt(tokenAmount)
      })
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}
