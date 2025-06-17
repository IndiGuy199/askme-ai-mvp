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
      const { email, goalId, goalData } = req.body
      
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
        // Adding an existing goal to user
        const { data: existingGoal, error: checkError } = await supabase
          .from('user_wellness_goals')
          .select('*')
          .eq('user_id', user.id)
          .eq('coach_wellness_goal_id', goalId)
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking existing goal:', checkError)
          return res.status(500).json({ error: 'Failed to check existing goal' })
        }

        if (existingGoal) {
          return res.status(400).json({ error: 'Goal already exists for this user' })
        }

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

        return res.status(201).json({ 
          message: 'Goal added successfully',
          goal: newUserGoal 
        })
      }

      if (goalData) {
        // Creating a custom goal
        const { label, description, category = 'Custom' } = goalData

        if (!label) {
          return res.status(400).json({ error: 'Goal label is required' })
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
            created_by: 'user'
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

        return res.status(201).json({
          message: 'Custom goal created successfully',
          goal: newUserGoal
        })
      }

      return res.status(400).json({ error: 'Either goalId or goalData is required' })
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
