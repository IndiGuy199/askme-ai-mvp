import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const { method } = req

  switch (method) {
    case 'GET':
      return getActions(req, res)
    case 'POST':
      return createAction(req, res)
    case 'PUT':
      return updateAction(req, res)
    case 'DELETE':
      return deleteAction(req, res)
    case 'PATCH':
      return reorderActions(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
      return res.status(405).json({ error: `Method ${method} Not Allowed` })
  }
}

// GET: Fetch actions for a user's goal
async function getActions(req, res) {
  try {
    const { email, goalId, challengeId } = req.query

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Get user ID from email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Build query for actions — return all non-completed actions (both active and inactive)
    // so the manage/swap modal can show the full library for a goal.
    // is_active is included in the payload so the UI can badge/filter as needed.
    let query = supabase
      .from('action_plans')
      .select('id, user_id, goal_id, challenge_id, action_text, is_complete, is_active, display_order, created_at, completed_at, coach_metadata, status')
      .eq('user_id', user.id)
      .eq('is_complete', false)
      .order('is_active', { ascending: false })  // active actions first
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (goalId) {
      query = query.eq('goal_id', goalId)
    }

    if (challengeId) {
      query = query.eq('challenge_id', challengeId)
    }

    const { data: actions, error: actionsError } = await query

    if (actionsError) {
      throw actionsError
    }

    return res.status(200).json({ actions: actions || [] })

  } catch (error) {
    console.error('Error fetching actions:', error)
    return res.status(500).json({ error: 'Failed to fetch actions' })
  }
}

// POST: Create a new action
async function createAction(req, res) {
  try {
    const { email, goalId, challengeId, actionText, displayOrder, coachMetadata, source } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    if (!source || source !== 'ai') {
      return res.status(400).json({ error: 'Actions must be created from AI suggestions. Please use "Generate Actions with AI" and select at least one suggestion.' })
    }

    if (!actionText) {
      return res.status(400).json({ error: 'Action text is required' })
    }

    // Get user ID from email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // A3: Validate goalId refers to a coach_wellness_goals.goal_id (TEXT slug),
    // not a user_wellness_goals UUID or an unknown identifier.
    if (goalId) {
      const { data: cwg, error: cwgError } = await supabase
        .from('coach_wellness_goals')
        .select('id')
        .eq('goal_id', goalId)
        .maybeSingle()

      if (cwgError) {
        console.error('Error validating goalId against coach_wellness_goals:', cwgError)
      } else if (!cwg) {
        console.error('⚠️ action_plans.goal_id not found in coach_wellness_goals:', goalId)
        return res.status(400).json({
          error: `Invalid goalId "${goalId}": must match a coach_wellness_goals.goal_id. ` +
                 'Ensure you are passing the coach goal_id text field, not a user_wellness_goals UUID.'
        })
      }
    }

    // Get the max display_order for the user's actions
    const { data: existingActions, error: orderError } = await supabase
      .from('action_plans')
      .select('display_order')
      .eq('user_id', user.id)
      .order('display_order', { ascending: false })
      .limit(1)

    let nextOrder = displayOrder
    if (nextOrder === undefined || nextOrder === null) {
      nextOrder = existingActions?.[0]?.display_order ? existingActions[0].display_order + 1 : 1
    }

    // A2: Determine is_active for the new action.
    // A goal can have at most 3 active (is_active=true) actions at a time.
    // If the goal already has 3 active actions, save the new one as inactive (library).
    let isActionActive = true
    if (goalId) {
      const { count: activeCount } = await supabase
        .from('action_plans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('goal_id', goalId)
        .eq('is_complete', false)
        .eq('is_active', true)

      if ((activeCount || 0) >= 3) {
        isActionActive = false
        console.log(`ℹ️ Goal ${goalId} already has ${activeCount} active actions — saving new action as inactive (library).`)
      }
    }

    // Build insert object
    const insertData = {
      user_id: user.id,
      goal_id: goalId || null,
      challenge_id: challengeId || null,
      action_text: actionText,
      is_complete: false,
      is_active: isActionActive,
      status: 'accepted',
      display_order: nextOrder
    }

    // Persist AI-generated metadata if provided
    if (coachMetadata && typeof coachMetadata === 'object') {
      insertData.coach_metadata = coachMetadata
    }

    // Create the action
    const { data: newAction, error: createError } = await supabase
      .from('action_plans')
      .insert(insertData)
      .select()
      .single()

    if (createError) {
      throw createError
    }

    return res.status(201).json({ action: newAction })

  } catch (error) {
    console.error('Error creating action:', error)
    return res.status(500).json({ error: 'Failed to create action' })
  }
}

// PUT: Update an existing action
async function updateAction(req, res) {
  try {
    const { email, actionId, actionText, isComplete, displayOrder } = req.body

    if (!email || !actionId) {
      return res.status(400).json({ error: 'Email and actionId are required' })
    }

    // Get user ID from email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { isActive } = req.body

    // Build update object
    const updates = {}
    if (actionText !== undefined) updates.action_text = actionText
    if (isComplete !== undefined) {
      updates.is_complete = isComplete
      if (isComplete) updates.completed_at = new Date().toISOString()
    }
    if (displayOrder !== undefined) updates.display_order = displayOrder
    // A2: allow toggling is_active for swap-in / swap-out
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean' })
      }
      updates.is_active = isActive
    }

    // Update the action
    const { data: updatedAction, error: updateError } = await supabase
      .from('action_plans')
      .update(updates)
      .eq('id', actionId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return res.status(200).json({ action: updatedAction })

  } catch (error) {
    console.error('Error updating action:', error)
    return res.status(500).json({ error: 'Failed to update action' })
  }
}

// DELETE: Remove an action
async function deleteAction(req, res) {
  try {
    const { email, actionId } = req.body

    if (!email || !actionId) {
      return res.status(400).json({ error: 'Email and actionId are required' })
    }

    // Get user ID from email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get the action before deleting (for archiving)
    const { data: actionToDelete, error: fetchError } = await supabase
      .from('action_plans')
      .select('*')
      .eq('id', actionId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !actionToDelete) {
      return res.status(404).json({ error: 'Action not found' })
    }

    // Archive to action_deletions table
    await supabase.from('action_deletions').insert({
      original_action_id: actionToDelete.id,
      user_id: user.id,
      action_text: actionToDelete.action_text,
      goal_id: actionToDelete.goal_id,
      challenge_id: actionToDelete.challenge_id,
      completion_count: 0
    })

    // Delete the action
    const { error: deleteError } = await supabase
      .from('action_plans')
      .delete()
      .eq('id', actionId)
      .eq('user_id', user.id)

    if (deleteError) {
      throw deleteError
    }

    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('Error deleting action:', error)
    return res.status(500).json({ error: 'Failed to delete action' })
  }
}

// PATCH: Reorder actions
async function reorderActions(req, res) {
  try {
    const { email, actions } = req.body

    if (!email || !actions || !Array.isArray(actions)) {
      return res.status(400).json({ error: 'Email and actions array are required' })
    }

    // Get user ID from email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Update each action's display_order
    const updatePromises = actions.map((action, index) => 
      supabase
        .from('action_plans')
        .update({ display_order: index + 1 })
        .eq('id', action.id)
        .eq('user_id', user.id)
    )

    await Promise.all(updatePromises)

    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('Error reordering actions:', error)
    return res.status(500).json({ error: 'Failed to reorder actions' })
  }
}
