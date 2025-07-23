// Test the chunkResponse function directly
const fs = require('fs');
const path = require('path');

// Read the gptRouter file to extract the chunkResponse function
const gptRouterPath = path.join(__dirname, 'pages', 'api', 'gptRouter.js');
const gptRouterContent = fs.readFileSync(gptRouterPath, 'utf8');

// Extract the chunkResponse function (this is a bit hacky but will work for testing)
eval(gptRouterContent.match(/function chunkResponse[\s\S]*?^}/m)[0]);

// Test with a long response
const testResponse = `Creating a comprehensive guide to mental health and personal development is a significant endeavor, and while I can't cover everything in one go, I'll start with a detailed outline focusing on managing common mental health conditions, enhancing relationships, and finding life purpose.

### 1. Managing Mental Health Conditions:
- **Anxiety, Depression, PTSD, Bipolar Disorder:**
   - **Morning Rituals:**
     - Wake-up Time: Consistently between 6-7 AM.
     - Meditation (10 minutes): Start with mindfulness or a body scan technique.
     - Journaling (15 minutes): Focus on gratitude or setting daily intentions.
     - Exercise (30 minutes): Could be yoga, walking, or any moderate activity.
   - **Afternoon Productivity Strategies:**
     - Structured breaks every 90 minutes.
     - Breathing exercises for focus: 4-7-8 breathing technique.
   - **Evening Wind-Down Routines:**
     - Digital detox after 8 PM.
     - Reading or light stretching.
     - Sleep by 10-11 PM for 7-8 hours of rest.

### 2. Enhancing Relationships:
- **Communication Skills:**
   - Active listening techniques
   - Conflict resolution strategies
   - Building emotional intimacy
- **Setting Boundaries:**
   - Learning to say no
   - Maintaining personal space
   - Balancing give and take`;

console.log('🧪 Testing chunkResponse function directly...');
console.log(`📏 Test response length: ${testResponse.length} characters`);
console.log(`📦 Should be chunked if > 800 chars: ${testResponse.length > 800}`);

try {
  const chunks = chunkResponse(testResponse, 800);
  console.log(`📦 CHUNKING RESULT: ${chunks.length} chunks returned`);
  
  if (chunks.length > 1) {
    console.log('✅ Chunking worked!');
    chunks.forEach((chunk, index) => {
      console.log(`📦 Chunk ${index + 1}: ${chunk.length} characters`);
      console.log(`📖 Preview: "${chunk.substring(0, 100)}..."`);
    });
  } else {
    console.log('❌ Chunking failed - only 1 chunk returned');
    console.log(`📖 Single chunk: "${chunks[0].substring(0, 200)}..."`);
  }
} catch (error) {
  console.error('❌ Error testing chunkResponse:', error);
}
