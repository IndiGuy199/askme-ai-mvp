import { supabase } from '../../utils/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    return handleCreateFavorite(req, res);
  } else if (req.method === 'GET') {
    return handleGetFavorites(req, res);
  } else if (req.method === 'DELETE') {
    return handleDeleteFavorite(req, res);
  } else if (req.method === 'PUT') {
    return handleUpdateFavorite(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Create a new favorite
async function handleCreateFavorite(req, res) {
  try {
    const { email, message_content, message_role = 'assistant', title, category, tags, notes } = req.body;
    
    if (!email || !message_content) {
      return res.status(400).json({ error: 'Email and message content are required' });
    }
    
    // Get user ID from email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
      
    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create the favorite
    const { data: favorite, error: favoriteError } = await supabase
      .from('user_favorites')
      .insert([{
        user_id: user.id,
        message_content,
        message_role,
        title: title || null,
        category: category || null,
        tags: tags || null,
        notes: notes || null
      }])
      .select()
      .single();
      
    if (favoriteError) {
      console.error('Error creating favorite:', favoriteError);
      return res.status(500).json({ error: 'Failed to save favorite' });
    }
    
    return res.status(201).json({ 
      success: true, 
      favorite,
      message: 'Advice saved to favorites successfully' 
    });
    
  } catch (error) {
    console.error('Error in handleCreateFavorite:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get user's favorites
async function handleGetFavorites(req, res) {
  try {
    const { email, category, limit = 50, offset = 0 } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Get user ID from email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
      
    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Build query
    let query = supabase
      .from('user_favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    // Filter by category if provided
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    
    const { data: favorites, error: favoritesError } = await query;
    
    if (favoritesError) {
      console.error('Error fetching favorites:', favoritesError);
      return res.status(500).json({ error: 'Failed to fetch favorites' });
    }
    
    return res.status(200).json({ 
      success: true, 
      favorites: favorites || [],
      total: favorites?.length || 0
    });
    
  } catch (error) {
    console.error('Error in handleGetFavorites:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete a favorite
async function handleDeleteFavorite(req, res) {
  try {
    const { email, favorite_id } = req.body;
    
    if (!email || !favorite_id) {
      return res.status(400).json({ error: 'Email and favorite ID are required' });
    }
    
    // Get user ID from email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
      
    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete the favorite (only if it belongs to the user)
    const { error: deleteError } = await supabase
      .from('user_favorites')
      .delete()
      .eq('id', favorite_id)
      .eq('user_id', user.id);
      
    if (deleteError) {
      console.error('Error deleting favorite:', deleteError);
      return res.status(500).json({ error: 'Failed to delete favorite' });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Favorite deleted successfully' 
    });
    
  } catch (error) {
    console.error('Error in handleDeleteFavorite:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update a favorite (edit title, category, tags, notes)
async function handleUpdateFavorite(req, res) {
  try {
    const { email, favorite_id, title, category, tags, notes } = req.body;
    
    if (!email || !favorite_id) {
      return res.status(400).json({ error: 'Email and favorite ID are required' });
    }
    
    // Get user ID from email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
      
    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update the favorite (only if it belongs to the user)
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (notes !== undefined) updateData.notes = notes;
    
    const { data: updatedFavorite, error: updateError } = await supabase
      .from('user_favorites')
      .update(updateData)
      .eq('id', favorite_id)
      .eq('user_id', user.id)
      .select()
      .single();
      
    if (updateError) {
      console.error('Error updating favorite:', updateError);
      return res.status(500).json({ error: 'Failed to update favorite' });
    }
    
    return res.status(200).json({ 
      success: true, 
      favorite: updatedFavorite,
      message: 'Favorite updated successfully' 
    });
    
  } catch (error) {
    console.error('Error in handleUpdateFavorite:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
