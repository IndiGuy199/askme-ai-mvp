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

      // Get user goals with coach wellness goals details
      const { data: userGoals, error } = await supabase
        .from('user_wellness_goals')
        .select(`
          *,
          coach_wellness_goals (*)
        `)
        .eq('user_id', user.id)
        .order('selected_at', { ascending: false })

      if (error) {
        console.error('Error fetching user goals:', error)
        return res.status(500).json({ error: 'Failed to fetch goals' })
      }

      return res.status(200).json({ goals: userGoals || [] })
    }

    if (req.method === 'POST') {
      const { email, goalId, goalData, challengeId } = req.body
      
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

      if (goalId) {
        // Adding an existing goal to user for a specific challenge
        if (!challengeId) {
          return res.status(400).json({ error: 'Challenge ID is required when adding goals' })
        }        // Check if user already has this specific goal
        const { data: existingUserGoals, error: checkError } = await supabase
          .from('user_wellness_goals')
          .select(`
            id,
            coach_wellness_goals (
              id,
              goal_id,
              challenge_id
            )
          `)
          .eq('user_id', user.id)
          .eq('coach_wellness_goal_id', goalId)

        if (checkError) {
          console.error('Error checking existing goal:', checkError)
          return res.status(500).json({ error: 'Failed to check existing goal' })
        }

        // Check if the user already has this goal for this challenge
        const hasGoalForChallenge = existingUserGoals?.some(userGoal => 
          userGoal.coach_wellness_goals?.challenge_id === challengeId
        )

        if (hasGoalForChallenge) {
          return res.status(400).json({ error: 'Goal already exists for this challenge' })
        }

        // Also check if user already has this goal for any challenge (prevent duplicate goals entirely)
        if (existingUserGoals && existingUserGoals.length > 0) {
          return res.status(400).json({ error: 'You already have this goal' })
        }// Get the goal details - allow goals without challenge_id (legacy goals)
        const { data: goalDetails, error: goalDetailsError } = await supabase
          .from('coach_wellness_goals')
          .select('*')
          .eq('id', goalId)
          .single()

        if (goalDetailsError) {
          console.error('Error fetching goal details:', goalDetailsError)
          return res.status(400).json({ error: 'Goal not found' })
        }

        // If the goal already has a challenge_id and it doesn't match, reject it
        if (goalDetails.challenge_id && goalDetails.challenge_id !== challengeId) {
          return res.status(400).json({ error: 'This goal belongs to a different challenge' })
        }

        // If the goal doesn't have a challenge_id, we'll link it to this challenge when adding to user
        // This handles legacy goals that were created before the nested structure

        // If the goal doesn't have a challenge_id, update it to link to this challenge
        if (!goalDetails.challenge_id) {
          const { error: updateError } = await supabase
            .from('coach_wellness_goals')
            .update({ challenge_id: challengeId })
            .eq('id', goalId)

          if (updateError) {
            console.error('Error linking goal to challenge:', updateError)
            // Continue anyway - this is not critical
          }
        }

        // Add the goal to the user
        const { data: newUserGoal, error: insertError } = await supabase
          .from('user_wellness_goals')
          .insert({
            user_id: user.id,
            coach_wellness_goal_id: goalId
          })
          .select(`
            *,
            coach_wellness_goals (*)
          `)
          .single()

        if (insertError) {
          console.error('Error adding goal to user:', insertError)
          return res.status(500).json({ error: 'Failed to add goal' })
        }

        // Initialize progress record for this goal
        const { error: progressError } = await supabase
          .from('progress')
          .insert({
            user_id: user.id,
            goal_id: goalDetails.goal_id,
            progress_percent: 0,
            last_updated: new Date().toISOString()
          })

        if (progressError) {
          console.error('Error initializing progress:', progressError)
          // Don't fail the entire operation, just log the error
        }

        return res.status(201).json({ 
          message: 'Goal added successfully',
          goal: newUserGoal 
        })
      }

      if (goalData) {
        // Creating a custom goal
        const { label, description, category = 'Custom', challengeId } = goalData

        if (!label) {
          return res.status(400).json({ error: 'Goal label is required' })
        }

        if (!challengeId) {
          return res.status(400).json({ error: 'Challenge ID is required for new goals' })
        }

        // Generate a unique goal_id for custom goals
        const goalIdText = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').trim('_')
        const uniqueGoalId = `custom_${goalIdText}_${Date.now()}`

        // First create the goal in coach_wellness_goals
        const { data: newGoal, error: goalError } = await supabase
          .from('coach_wellness_goals')
          .insert({
            coach_profile_id: user.coach_profile_id,
            goal_id: uniqueGoalId,
            label,
            description: description || label,
            created_by: 'user',
            challenge_id: challengeId
          })
          .select()
          .single()

        if (goalError) {
          console.error('Error creating custom goal:', goalError)
          return res.status(500).json({ error: 'Failed to create custom goal' })
        }

        // Then add it to user_wellness_goals
        const { data: newUserGoal, error: userGoalError } = await supabase
          .from('user_wellness_goals')
          .insert({
            user_id: user.id,
            coach_wellness_goal_id: newGoal.id
          })
          .select(`
            *,
            coach_wellness_goals (*)
          `)
          .single()

        if (userGoalError) {
          console.error('Error adding custom goal to user:', userGoalError)
          return res.status(500).json({ error: 'Failed to add custom goal to user' })
        }

        // Initialize progress record for this custom goal
        const { error: progressError } = await supabase
          .from('progress')
          .insert({
            user_id: user.id,
            goal_id: newGoal.goal_id,
            progress_percent: 0,
            last_updated: new Date().toISOString()
          })

        if (progressError) {
          console.error('Error initializing progress for custom goal:', progressError)
          // Don't fail the entire operation, just log the error
        }

        return res.status(201).json({
          message: 'Custom goal created successfully',
          goal: newUserGoal
        })
      }

      return res.status(400).json({ error: 'Either goalId or goalData is required' })
    }

    if (req.method === 'PUT') {
      const { email, goalId, isActive } = req.body
      
      if (!email || !goalId || typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'Email, goalId, and isActive (boolean) are required' })
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

      // Update the goal's active status
      const { data: updatedGoal, error } = await supabase
        .from('user_wellness_goals')
        .update({ is_active: isActive })
        .eq('id', goalId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating goal:', error)
        return res.status(500).json({ error: 'Failed to update goal' })
      }

      return res.status(200).json({ 
        message: `Goal ${isActive ? 'activated' : 'deactivated'} successfully`,
        goal: updatedGoal
      })
    }

    if (req.method === 'DELETE') {
      const { email, goalId } = req.body
      
      if (!email || !goalId) {
        return res.status(400).json({ error: 'Email and goalId are required' })
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
        .from('user_wellness_goals')
        .delete()
        .eq('user_id', user.id)
        .eq('coach_wellness_goal_id', goalId)

      if (error) {
        console.error('Error deleting goal:', error)
        return res.status(500).json({ error: 'Failed to delete goal' })
      }

      return res.status(200).json({ message: 'Goal deleted successfully' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Goals API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
