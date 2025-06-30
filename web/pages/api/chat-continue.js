import { supabase } from '../../utils/supabaseClient'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { conversationId, chunkNumber, email } = req.body

  try {
    // Get user ID from email
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (!userData) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get the stored chunks using user_id
    const { data: chatData } = await supabase
      .from('chat_chunks')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userData.id) // Use user_id instead of email
      .single()

    if (!chatData) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    const requestedChunk = chunkNumber - 1
    const chunks = chatData.chunks

    if (requestedChunk >= chunks.length) {
      return res.status(400).json({ error: 'Chunk not found' })
    }

    const isLastChunk = requestedChunk === chunks.length - 1
    
    let responseData = {
      message: chunks[requestedChunk],
      isPartial: !isLastChunk,
      totalChunks: chunks.length,
      currentChunk: chunkNumber,
      conversationId
    }

    if (!isLastChunk) {
      responseData.nextChunkToken = `chunk_${conversationId}_${chunkNumber + 1}`
      responseData.previewNext = getPreviewText(chunks[requestedChunk + 1])
    }

    // Update current chunk
    await supabase
      .from('chat_chunks')
      .update({ current_chunk: chunkNumber })
      .eq('conversation_id', conversationId)
      .eq('user_id', userData.id) // Use user_id

    res.status(200).json(responseData)

  } catch (error) {
    console.error('Continue API Error:', error)
    res.status(500).json({ error: 'Failed to get next chunk' })
  }
}

function getPreviewText(text) {
  if (!text) return ''
  const firstSentence = text.split(/[.!?]/)[0]
  return firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence + '...'
}