// Test the chunking function directly

// Simulate the response we're getting
const testResponse = `Creating a comprehensive guide to mental health and personal development is a significant task, but here's a detailed outline to help you manage various aspects of mental wellness and personal growth:

### 1. Managing Mental Health Conditions
- **General Routine**
  - **Wake-up Time:** Consistency is key. Aim for the same time daily.
  - **Morning Rituals:**
    - **Meditation**: Start with 5 minutes of mindfulness or loving-kindness meditation.
    - **Journaling**: Write down thoughts and feelings to clarify your mental state.
    - **Exercise**: Even 10 minutes of yoga or a brisk walk can uplift your mood.

- **Afternoon Productivity Strategies:**
  - **Work Breaks**: Short breaks every hour to maintain focus and reduce stress.
  - **Prioritization**: Use techniques like the Eisenhower Box to manage tasks.

- **Evening Wind-Down Routines:**
  - **Digital Detox**: Avoid screens at least 1`;

console.log('Original response length:', testResponse.length);
console.log('Original response preview:', testResponse.substring(0, 100) + '...');

// Test the chunking function
function chunkResponse(text, maxChunkLength = 800) {
  console.log(`\n🧪 CHUNKING TEST: Input length ${text.length}, threshold ${maxChunkLength}`);
  
  if (!text || text.length <= maxChunkLength) {
    console.log(`📝 Not chunking: length ${text.length} <= threshold ${maxChunkLength}`);
    return [text]
  }

  const chunks = []
  let currentChunk = ''
  
  console.log(`📝 Starting chunking process...`);
  
  // First try to split by paragraphs (double newlines)
  const paragraphs = text.split(/\n\s*\n/)
  console.log(`📝 Split into ${paragraphs.length} paragraphs`);
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    console.log(`📝 Processing paragraph ${i+1}: length ${paragraph.length}`);
    
    // If paragraph itself is too long, split by sentences
    if (paragraph.length > maxChunkLength) {
      console.log(`📝 Paragraph ${i+1} is too long (${paragraph.length} > ${maxChunkLength}), splitting by sentences`);
      const sentences = paragraph.split(/(?<=[.!?])\s+/)
      console.log(`📝 Split paragraph into ${sentences.length} sentences`);
      
      for (const sentence of sentences) {
        // Check if adding this sentence would exceed the limit
        if (currentChunk.length + sentence.length + 2 <= maxChunkLength) {
          currentChunk += (currentChunk ? '\n\n' : '') + sentence
          console.log(`📝 Added sentence to chunk, new length: ${currentChunk.length}`);
        } else {
          // Save current chunk if it has content
          if (currentChunk) {
            chunks.push(currentChunk.trim())
            console.log(`📝 Pushed chunk ${chunks.length}, length: ${currentChunk.trim().length}`);
            currentChunk = sentence
            console.log(`📝 Started new chunk with sentence, length: ${currentChunk.length}`);
          } else {
            // Handle very long sentences by splitting on word boundaries
            console.log(`📝 Very long sentence, splitting by words`);
            const words = sentence.split(' ')
            for (const word of words) {
              if (currentChunk.length + word.length + 1 <= maxChunkLength) {
                currentChunk += (currentChunk ? ' ' : '') + word
              } else {
                if (currentChunk) {
                  chunks.push(currentChunk.trim())
                  console.log(`📝 Pushed word chunk ${chunks.length}, length: ${currentChunk.trim().length}`);
                  currentChunk = word
                } else {
                  // Very long word, force split
                  chunks.push(word.slice(0, maxChunkLength))
                  console.log(`📝 Force split long word, pushed chunk ${chunks.length}`);
                  currentChunk = word.slice(maxChunkLength)
                }
              }
            }
          }
        }
      }
    } else {
      // Paragraph is reasonable size, check if we can add it to current chunk
      console.log(`📝 Paragraph ${i+1} is reasonable size (${paragraph.length})`);
      if (currentChunk.length + paragraph.length + 2 <= maxChunkLength) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
        console.log(`📝 Added paragraph to chunk, new length: ${currentChunk.length}`);
      } else {
        // Save current chunk and start new one with this paragraph
        if (currentChunk) {
          chunks.push(currentChunk.trim())
          console.log(`📝 Pushed chunk ${chunks.length}, length: ${currentChunk.trim().length}`);
        }
        currentChunk = paragraph
        console.log(`📝 Started new chunk with paragraph, length: ${currentChunk.length}`);
      }
    }
  }

  // Add the final chunk
  if (currentChunk) {
    chunks.push(currentChunk.trim())
    console.log(`📝 Pushed final chunk ${chunks.length}, length: ${currentChunk.trim().length}`);
  }

  const filteredChunks = chunks.filter(chunk => chunk.length > 0);
  console.log(`📝 Final result: ${filteredChunks.length} chunks after filtering`);
  filteredChunks.forEach((chunk, i) => {
    console.log(`📝 Chunk ${i+1}: ${chunk.length} characters`);
  });

  return filteredChunks;
}

const result = chunkResponse(testResponse, 800);
console.log('\n🔍 CHUNKING RESULT:');
console.log('Number of chunks:', result.length);
console.log('Should be chunked:', result.length > 1);
result.forEach((chunk, i) => {
  console.log(`\nChunk ${i+1} (${chunk.length} chars):`);
  console.log(chunk.substring(0, 100) + '...');
});
