// Debug script to test the chunking function specifically
const fs = require('fs');
const path = require('path');

// Copy the chunkResponse function from gptRouter.js
function chunkResponse(text, maxChunkLength = 1500) {
  console.log(`🔍 CHUNK DEBUG: Input text length: ${text.length}, maxChunkLength: ${maxChunkLength}`);
  
  if (!text || text.length <= maxChunkLength) {
    console.log(`🔍 CHUNK DEBUG: Text is shorter than max length, returning single chunk`);
    return [text]
  }

  console.log(`🔍 CHUNK DEBUG: Text exceeds max length, proceeding with chunking`);
  
  const chunks = []
  let currentChunk = ''
  
  // First try to split by paragraphs (double newlines)
  const paragraphs = text.split(/\n\s*\n/)
  console.log(`🔍 CHUNK DEBUG: Split into ${paragraphs.length} paragraphs`);
  
  for (const paragraph of paragraphs) {
    console.log(`🔍 CHUNK DEBUG: Processing paragraph of length ${paragraph.length}`);
    
    // If paragraph itself is too long, split by sentences
    if (paragraph.length > maxChunkLength) {
      console.log(`🔍 CHUNK DEBUG: Paragraph too long, splitting by sentences`);
      const sentences = paragraph.split(/(?<=[.!?])\s+/)
      
      for (const sentence of sentences) {
        // Check if adding this sentence would exceed the limit
        if (currentChunk.length + sentence.length + 2 <= maxChunkLength) {
          currentChunk += (currentChunk ? '\n\n' : '') + sentence
        } else {
          // Save current chunk if it has content
          if (currentChunk) {
            chunks.push(currentChunk.trim())
            currentChunk = sentence
          } else {
            // Handle very long sentences by splitting on word boundaries
            const words = sentence.split(' ')
            for (const word of words) {
              if (currentChunk.length + word.length + 1 <= maxChunkLength) {
                currentChunk += (currentChunk ? ' ' : '') + word
              } else {
                if (currentChunk) {
                  chunks.push(currentChunk.trim())
                  currentChunk = word
                } else {
                  // Very long word, force split
                  chunks.push(word.slice(0, maxChunkLength))
                  currentChunk = word.slice(maxChunkLength)
                }
              }
            }
          }
        }
      }
    } else {
      // Paragraph is reasonable size, check if we can add it to current chunk
      if (currentChunk.length + paragraph.length + 2 <= maxChunkLength) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
      } else {
        // Save current chunk and start new one with this paragraph
        if (currentChunk) {
          chunks.push(currentChunk.trim())
        }
        currentChunk = paragraph
      }
    }
  }

  // Add the final chunk
  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  const result = chunks.filter(chunk => chunk.length > 0);
  console.log(`🔍 CHUNK DEBUG: Final result - ${result.length} chunks with lengths: ${result.map(c => c.length).join(', ')}`);
  
  return result;
}

// Test with a long response
const testResponse = `I understand you're looking for a comprehensive approach to managing anxiety and depression while also improving your relationships and finding more purpose in life. This is a holistic goal that requires addressing multiple interconnected aspects of your well-being. Let me help you create a structured plan that addresses each of these areas systematically.

First, let's focus on anxiety management techniques. Anxiety often stems from our thoughts about future events or past experiences, so developing present-moment awareness is crucial. I recommend starting with daily mindfulness practices - even 10 minutes of guided meditation can make a significant difference. Apps like Headspace or Calm can be helpful starting points. Additionally, learning to identify your anxiety triggers will help you develop specific coping strategies for different situations.

For depression management, establishing consistent daily routines is essential. Depression often disrupts our natural rhythms, so creating structure helps restore stability. This includes maintaining regular sleep schedules, incorporating physical activity, and ensuring you're getting adequate nutrition. Even small victories like making your bed each morning or taking a short walk can help build momentum and improve your mood over time.

Regarding relationships, improving communication skills will have the most significant impact. This means learning to express your needs clearly, setting healthy boundaries, and developing active listening skills. Consider practicing "I" statements when discussing difficult topics, and remember that vulnerability often strengthens relationships rather than weakening them. If you're comfortable with it, sharing your mental health journey with trusted friends or family members can provide additional support.

Finally, finding purpose often comes from aligning your actions with your values. Take time to reflect on what truly matters to you - this might be helping others, creating something beautiful, learning new skills, or contributing to causes you care about. Start small by incorporating one value-driven activity into your week, whether that's volunteering, pursuing a hobby, or working on a personal project that excites you.`;

console.log('=== CHUNKING DEBUG TEST ===');
console.log(`Original text length: ${testResponse.length} characters`);

// Test with 1000 character limit
const chunks1000 = chunkResponse(testResponse, 1000);
console.log(`\nWith 1000 char limit: ${chunks1000.length} chunks`);
chunks1000.forEach((chunk, i) => {
  console.log(`Chunk ${i + 1}: ${chunk.length} characters`);
});

// Test with 1500 character limit
const chunks1500 = chunkResponse(testResponse, 1500);
console.log(`\nWith 1500 char limit: ${chunks1500.length} chunks`);
chunks1500.forEach((chunk, i) => {
  console.log(`Chunk ${i + 1}: ${chunk.length} characters`);
});
