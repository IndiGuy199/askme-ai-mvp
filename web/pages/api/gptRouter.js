import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default async function handler(req, res) {
  // Handle GET requests for user data
  if (req.method === 'GET') {
    const { email } = req.query
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, tokens, first_name, age, city, country, marital_status, created_at, coach_profile_id')
        .eq('email', email)
        .single()

      if (error || !user) {
        console.error('User lookup error:', error)
        return res.status(404).json({ error: 'User not found' })
      }

      return res.status(200).json({
        id: user.id,  // Add database user ID
        tokens: user.tokens || 0,
        firstName: user.first_name,
        email: user.email,
        age: user.age,
        city: user.city,
        country: user.country,
        maritalStatus: user.marital_status,
        lastLogin: user.created_at,
        coach_profile_id: user.coach_profile_id
      })
    } catch (error) {
      console.error('API error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // Handle POST requests for chat
  if (req.method === 'POST') {
    const { email, message } = req.body
    console.log('API received email:', email)
    console.log('API received message:', message)
    
    if (!email || !message) {
      console.log('Missing email or message')
      return res.status(400).send('Missing email or message')
    }

    // Get user with coach prompt
    const { data: user, error } = await supabase
      .from('users')
      .select('*, coach_profiles(system_prompt)')
      .eq('email', email)
      .single()

    console.log('User lookup result:', user)
    console.log('User lookup error:', error)

    if (error || !user) {
      console.log('User not found')
      return res.status(400).send('User not found')
    }
    if (user.tokens <= 0) {
      console.log('Out of tokens')
      return res.status(403).send('Out of tokens')
    }
    if (!user.coach_profiles || !user.coach_profiles.system_prompt) {
      console.log('No system prompt found for user')
      return res.status(400).send('No system prompt found for user')
    }

    const systemPrompt = user.coach_profiles.system_prompt

    // Generate GPT-4 Response
    let openaiReply = ''
    try {
      console.log('Resolved firstName:', user.first_name)
      const firstName = user.first_name || 'there'
      const personalization = `The user's name is ${firstName}, prefers a ${user.tone || 'neutral'} tone, and their goals are: ${user.goals || 'not specified'}.`
      const greeting = `Hi ${firstName}! You are chatting with AskMe AI. `
      const personalizedPrompt = `${greeting}${personalization}\n\n${systemPrompt}`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: personalizedPrompt },
          { role: 'user', content: message }
        ]
      })
      openaiReply = completion.choices[0]?.message?.content
      console.log('OpenAI reply:', openaiReply)
    } catch (err) {
      console.log('OpenAI error:', err)
      return res.status(500).send('OpenAI error: ' + err.message)
    }

    // Deduct 1 token
    const { error: updateError } = await supabase
      .from('users')
      .update({ tokens: user.tokens - 1 })
      .eq('id', user.id)

    if (updateError) {
      console.log('Token update error:', updateError)
    }

    return res.status(200).json({ reply: openaiReply })
  }

  // Method not allowed
  return res.status(405).send('Method not allowed')
}
