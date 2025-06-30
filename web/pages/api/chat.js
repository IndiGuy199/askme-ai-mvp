import OpenAI from 'openai'
import { supabase } from '../../utils/supabaseClient'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const MAX_RESPONSE_TOKENS = 1500
const CHUNK_OVERLAP = 100

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message, email, conversationId, continueFromChunk } = req.body

  try {
    // Get user data including ID
    const { data: userData } = await supabase
      .from('users')
      .select('id, tokens')
      .eq('email', email)
      .single()

    if (!userData || userData.tokens <= 0) {
      return res.status(400).json({ error: 'Insufficient tokens' })
    }

    let systemPrompt = `You are AskMe AI, a wellness companion. Provide helpful, actionable advice for health, fitness, nutrition, and mental wellness. Be encouraging and supportive.`
    
    if (continueFromChunk) {
      systemPrompt += ` Continue from where you left off in your previous response. Pick up naturally from: "${continueFromChunk.lastSentence}"`
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 3000,
      temperature: 0.7,
    })

    const fullResponse = completion.choices[0].message.content
    const tokensUsed = completion.usage.total_tokens

    const responseChunks = chunkResponse(fullResponse, MAX_RESPONSE_TOKENS)
    const isChunked = responseChunks.length > 1

    let responseData = {
      message: responseChunks[0],
      tokensUsed,
      isPartial: isChunked,
      totalChunks: responseChunks.length,
      currentChunk: 1,
      conversationId: conversationId || generateConversationId()
    }

    if (isChunked) {
      // Store using user_id instead of email
      await supabase
        .from('chat_chunks')
        .insert({
          conversation_id: responseData.conversationId,
          user_id: userData.id, // Use user ID instead of email
          full_response: fullResponse,
          chunks: responseChunks,
          current_chunk: 1,
          created_at: new Date().toISOString()
        })

      responseData.nextChunkToken = `chunk_${responseData.conversationId}_2`
      responseData.previewNext = getPreviewText(responseChunks[1])
    }

    // Deduct tokens
    await supabase
      .from('users')
      .update({ tokens: userData.tokens - tokensUsed })
      .eq('id', userData.id) // Use ID for update too

    res.status(200).json(responseData)

  } catch (error) {
    console.error('Chat API Error:', error)
    res.status(500).json({ error: 'Failed to generate response' })
  }
}

function chunkResponse(text, maxTokens) {
  const words = text.split(' ')
  const chunks = []
  let currentChunk = []
  let currentLength = 0

  // Rough estimation: 1 token ≈ 0.75 words
  const maxWords = Math.floor(maxTokens * 0.75)

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    
    if (currentLength + word.length > maxWords && currentChunk.length > 0) {
      // Find a good break point (sentence end)
      const chunkText = currentChunk.join(' ')
      const lastSentenceEnd = Math.max(
        chunkText.lastIndexOf('.'),
        chunkText.lastIndexOf('!'),
        chunkText.lastIndexOf('?')
      )

      if (lastSentenceEnd > chunkText.length * 0.5) {
        // Good break point found
        chunks.push(chunkText.substring(0, lastSentenceEnd + 1))
        const remainder = chunkText.substring(lastSentenceEnd + 1).trim()
        currentChunk = remainder ? remainder.split(' ') : [word]
        currentLength = remainder ? remainder.length : word.length
      } else {
        // No good break point, force break
        chunks.push(currentChunk.join(' '))
        currentChunk = [word]
        currentLength = word.length
      }
    } else {
      currentChunk.push(word)
      currentLength += word.length + 1
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '))
  }

  return chunks.filter(chunk => chunk.trim().length > 0)
}

function getPreviewText(text) {
  if (!text) return ''
  const firstSentence = text.split(/[.!?]/)[0]
  return firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence + '...'
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2)}`
}