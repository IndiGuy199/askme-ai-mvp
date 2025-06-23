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

      // Get user challenges with their nested goals
      const { data: userChallenges, error: challengesError } = await supabase
        .from('user_challenges')
        .select(`
          id,
          coach_challenge_id,
          selected_at,
          coach_challenges (
            id,
            challenge_id,
            label,
            description
          )
        `)
        .eq('user_id', user.id)
        .order('selected_at', { ascending: false })

      if (challengesError) {
        console.error('Error fetching user challenges:', challengesError)
        return res.status(500).json({ error: 'Failed to fetch challenges' })
      }

      // For each challenge, get the associated goals
      const challengesWithGoals = await Promise.all(
        (userChallenges || []).map(async (userChallenge) => {
          const challenge = userChallenge.coach_challenges          // Get goals for this challenge - use DISTINCT to prevent duplicates
          const { data: userGoals, error: goalsError } = await supabase
            .from('user_wellness_goals')
            .select(`
              id,
              coach_wellness_goal_id,
              selected_at,
              coach_wellness_goals!inner (
                id,
                goal_id,
                label,
                description,
                challenge_id
              )
            `)
            .eq('user_id', user.id)
            .eq('coach_wellness_goals.challenge_id', challenge.challenge_id)
            .order('selected_at', { ascending: false })

          if (goalsError) {
            console.error('Error fetching goals for challenge:', challenge.challenge_id, goalsError)
            return {
              ...userChallenge,
              goals: []
            }
          }          // Remove any duplicates based on goal_id (just in case)
          const uniqueGoals = userGoals?.filter((goal, index, self) => 
            index === self.findIndex(g => g.coach_wellness_goals.goal_id === goal.coach_wellness_goals.goal_id)
          ) || []

          return {
            ...userChallenge,
            goals: uniqueGoals
          }
        })
      )

      return res.status(200).json({ challengesWithGoals })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Challenges with goals API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
