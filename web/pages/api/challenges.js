import { supabase } from '../../utils/supabaseClient'

export default async function handler(req, res) {
  // Check if supabase client is available
  if (!supabase) {
    console.error('Supabase client not initialized')
    return res.status(500).json({ error: 'Database connection not available' })
  }

  try {
    if (req.method === 'GET') {
      const { email } = req.query
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' })
      }

      // Get user first
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (userError) {
        console.error('Error fetching user:', userError)
        return res.status(404).json({ error: 'User not found' })
      }

      // Get user challenges with coach challenges details
      const { data: userChallenges, error } = await supabase
        .from('user_challenges')
        .select(`
          *,
          coach_challenges (*)
        `)
        .eq('user_id', user.id)
        .order('selected_at', { ascending: false })

      if (error) {
        console.error('Error fetching user challenges:', error)
        return res.status(500).json({ error: 'Failed to fetch challenges' })
      }

      return res.status(200).json({ challenges: userChallenges || [] })
    }

    if (req.method === 'POST') {
      const { email, challengeId, challengeData } = req.body
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' })
      }

      // Get user first
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, coach_profile_id')
        .eq('email', email)
        .single()

      if (userError) {
        console.error('Error fetching user:', userError)
        return res.status(404).json({ error: 'User not found' })
      }

      if (challengeId) {
        // Adding an existing challenge to user
        const { data: existingChallenge, error: checkError } = await supabase
          .from('user_challenges')
          .select('*')
          .eq('user_id', user.id)
          .eq('coach_challenge_id', challengeId)
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking existing challenge:', checkError)
          return res.status(500).json({ error: 'Failed to check existing challenge' })
        }

        if (existingChallenge) {
          return res.status(400).json({ error: 'Challenge already exists for this user' })
        }

        const { data: newUserChallenge, error: insertError } = await supabase
          .from('user_challenges')
          .insert({
            user_id: user.id,
            coach_challenge_id: challengeId          })
          .select(`
            *,
            coach_challenges (*)
          `)
          .single()

        if (insertError) {
          console.error('Error adding challenge to user:', insertError)
          return res.status(500).json({ error: 'Failed to add challenge' })
        }

        // Initialize progress record for this challenge
        const { error: progressError } = await supabase
          .from('progress')
          .insert({
            user_id: user.id,
            challenge_id: newUserChallenge.coach_challenges.challenge_id,
            progress_percent: 0,
            last_updated: new Date().toISOString()
          })

        if (progressError) {
          console.error('Error initializing progress for challenge:', progressError)
          // Don't fail the entire operation, just log the error
        }

        return res.status(201).json({ 
          message: 'Challenge added successfully',
          challenge: newUserChallenge 
        })
      }

      if (challengeData) {
        // Creating a custom challenge
        const { label, description } = challengeData

        if (!label) {
          return res.status(400).json({ error: 'Challenge label is required' })
        }

        // Generate a unique challenge_id for custom challenges
        const challengeIdText = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').trim('_')
        const uniqueChallengeId = `custom_${challengeIdText}_${Date.now()}`

        // First create the challenge in coach_challenges
        const { data: newChallenge, error: challengeError } = await supabase
          .from('coach_challenges')
          .insert({
            coach_profile_id: user.coach_profile_id,
            challenge_id: uniqueChallengeId,
            label,
            description: description || label
          })
          .select()
          .single()

        if (challengeError) {
          console.error('Error creating custom challenge:', challengeError)
          return res.status(500).json({ error: 'Failed to create custom challenge' })
        }

        // Then add it to user_challenges
        const { data: newUserChallenge, error: userChallengeError } = await supabase
          .from('user_challenges')
          .insert({
            user_id: user.id,
            coach_challenge_id: newChallenge.id
          })
          .select(`
            *,            coach_challenges (*)
          `)
          .single()

        if (userChallengeError) {
          console.error('Error adding custom challenge to user:', userChallengeError)
          return res.status(500).json({ error: 'Failed to add custom challenge to user' })
        }

        // Initialize progress record for this custom challenge
        const { error: progressError } = await supabase
          .from('progress')
          .insert({
            user_id: user.id,
            challenge_id: newChallenge.challenge_id,
            progress_percent: 0,
            last_updated: new Date().toISOString()
          })

        if (progressError) {
          console.error('Error initializing progress for custom challenge:', progressError)
          // Don't fail the entire operation, just log the error
        }

        return res.status(201).json({
          message: 'Custom challenge created successfully',
          challenge: newUserChallenge
        })
      }

      return res.status(400).json({ error: 'Either challengeId or challengeData is required' })
    }

    if (req.method === 'DELETE') {
      const { email, challengeId } = req.body
      
      if (!email || !challengeId) {
        return res.status(400).json({ error: 'Email and challengeId are required' })
      }

      // Get user first
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (userError) {
        console.error('Error fetching user:', userError)
        return res.status(404).json({ error: 'User not found' })
      }

      const { error } = await supabase
        .from('user_challenges')
        .delete()
        .eq('user_id', user.id)
        .eq('coach_challenge_id', challengeId)

      if (error) {
        console.error('Error deleting challenge:', error)
        return res.status(500).json({ error: 'Failed to delete challenge' })
      }

      return res.status(200).json({ message: 'Challenge deleted successfully' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Challenges API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
