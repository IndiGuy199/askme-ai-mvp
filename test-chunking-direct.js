// Quick test to debug the chunking issue specifically
const axios = require('axios');

async function testChunking() {
  console.log('🧪 Testing chunking functionality...');
  
  try {
    const response = await axios.post('http://localhost:3000/api/gptRouter', {
      message: "Can you help me create a comprehensive plan for managing my anxiety and depression while also improving my relationships and finding more purpose in life? I need detailed strategies for each area including daily routines, coping mechanisms, communication skills, and ways to discover what truly matters to me. Please provide specific actionable steps I can take immediately as well as longer-term goals to work towards.",
      email: "rd9821@gmail.com", // Required field
      user_id: "046d3d85-fd5e-466b-b799-c7fe18f6d00b" // Specified user ID
    }, {
      timeout: 60000, // 60 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Response received');
    console.log(`📏 Response length: ${response.data.response?.length || 0} characters`);
    console.log(`🧩 Is partial: ${response.data.isPartial}`);
    console.log(`📦 Total chunks: ${response.data.totalChunks}`);
    console.log(`🔢 Current chunk: ${response.data.currentChunk}`);
    console.log(`🆔 Conversation ID: ${response.data.conversationId}`);
    
    if (response.data.response) {
      console.log(`📖 Response preview: "${response.data.response.substring(0, 150)}..."`);
    }
    
    // Test chunking threshold
    if (response.data.response && response.data.response.length > 1000) {
      console.log('✅ Response is longer than 1000 characters');
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
