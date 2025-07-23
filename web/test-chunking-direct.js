// Quick test to debug the chunking issue specifically
const axios = require('axios');

async function testChunking() {
  console.log('🧪 Testing chunking functionality...');
  
  try {
    const response = await axios.post('http://localhost:3000/api/gptRouter', {
      message: "I need you to create the most comprehensive analysis and detailed explanation of mental health and personal development. This should be an extremely thorough resource that covers every aspect of mental wellness, personal growth, and life improvement. Please provide: 1) A complete guide for managing anxiety, depression, PTSD, and bipolar disorder including specific wake-up times, morning rituals (meditation, journaling, exercise), afternoon productivity strategies, evening wind-down routines, bedtime protocols, breathing exercises with step-by-step instructions, various meditation techniques (mindfulness, loving-kindness, body scan), grounding exercises for panic attacks, progressive muscle relaxation, and detailed dietary recommendations with specific foods and meal timing. 2) Comprehensive relationship improvement strategies including advanced communication techniques, conflict resolution frameworks, methods for building deep trust, setting healthy boundaries with scripts and examples, expressing difficult emotions effectively, active listening skills with practice exercises, maintaining long-distance relationships, dealing with toxic people, rebuilding after betrayal, and creating meaningful social connections. 3) A thorough exploration of finding life purpose including detailed values clarification exercises with worksheets, passion discovery methods through various activities, comprehensive goal-setting frameworks (SMART goals, OKRs, backward planning), career exploration strategies including assessments and informational interviews, volunteer opportunities with specific organizations, creative pursuits for self-expression, spiritual practices from different traditions, and methods for discovering your unique contribution to the world. Please make this a long response with extensive discussion that goes well over 1000 characters so I can test the chunking functionality.",
      email: "rd9821@gmail.com", // Required field
      user_id: "046d3d85-fd5e-466b-b799-c7fe18f6d00b" // Specified user ID
    }, {
      timeout: 60000, // 60 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Response received');
    
    // Debug: Full response structure
    console.log('\n🔍 FULL RESPONSE DEBUG:');
    console.log('Response status:', response.status);
    console.log('Response headers:', JSON.stringify(response.headers, null, 2));
    console.log('Response data keys:', Object.keys(response.data));
    console.log('Full response.data:', JSON.stringify(response.data, null, 2));
    
    // Basic response info
    console.log('\n📊 RESPONSE ANALYSIS:');
    console.log(`📏 Response length: ${response.data.response?.length || 0} characters`);
    console.log(`🧩 Is partial: ${response.data.isPartial} (type: ${typeof response.data.isPartial})`);
    console.log(`📦 Total chunks: ${response.data.totalChunks} (type: ${typeof response.data.totalChunks})`);
    console.log(`🔢 Current chunk: ${response.data.currentChunk} (type: ${typeof response.data.currentChunk})`);
    console.log(`🆔 Conversation ID: ${response.data.conversationId}`);
    
    // Check for all possible chunking-related fields
    console.log('\n🔎 CHUNKING FIELDS CHECK:');
    const possibleChunkFields = ['isPartial', 'totalChunks', 'currentChunk', 'chunkId', 'hasMore', 'chunks', 'chunked', 'partial'];
    possibleChunkFields.forEach(field => {
      if (response.data.hasOwnProperty(field)) {
        console.log(`  ✓ ${field}: ${response.data[field]} (${typeof response.data[field]})`);
      } else {
        console.log(`  ✗ ${field}: not present`);
      }
    });
    
    if (response.data.response) {
      console.log(`\n📖 Response preview: "${response.data.response.substring(0, 150)}..."`);
      console.log(`📖 Response ending: "...${response.data.response.substring(response.data.response.length - 150)}"`);
    }
    
    // Test chunking threshold
    if (response.data.response && response.data.response.length > 800) {
      console.log('✅ Response is longer than 800 characters');
      if (response.data.isPartial) {
        console.log('✅ Response is properly chunked');
      } else {
        console.log('❌ Response should be chunked but isPartial is false');
      }
    } else {
      console.log('❌ Response is not long enough to test chunking');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testChunking();
