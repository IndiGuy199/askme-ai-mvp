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

    // Build query for actions
    let query = supabase
      .from('action_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_complete', false)
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
    const { email, goalId, challengeId, actionText, displayOrder, coachMetadata } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
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

    // Build insert object
    const insertData = {
      user_id: user.id,
      goal_id: goalId || null,
      challenge_id: challengeId || null,
      action_text: actionText,
      is_complete: false,
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

    // Build update object
    const updates = {}
    if (actionText !== undefined) updates.action_text = actionText
    if (isComplete !== undefined) {
      updates.is_complete = isComplete
      if (isComplete) updates.completed_at = new Date().toISOString()
    }
    if (displayOrder !== undefined) updates.display_order = displayOrder

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
