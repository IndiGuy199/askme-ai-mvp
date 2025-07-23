// Test the chunking with the same message from the logs
const axios = require('axios');

async function testChunkingFromLogs() {
  console.log('🧪 Testing chunking with message from server logs...');
  
  try {
    const response = await axios.post('http://localhost:3000/api/gptRouter', {
      message: "give a very very very detailed list of suggestions and step to manage the anxiety from the fish bone stuck in my throat and lower my pain",
      email: "rd9821@gmail.com",
      user_id: "046d3d85-fd5e-466b-b799-c7fe18f6d00b"
    }, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Response received');
    console.log('📏 Response length:', response.data.response?.length || 0);
    
    // Check for chunking metadata
    console.log('\n🔍 Chunking metadata:');
    console.log('isPartial:', response.data.isPartial);
    console.log('totalChunks:', response.data.totalChunks);
    console.log('currentChunk:', response.data.currentChunk);
    console.log('conversationId:', response.data.conversationId);
    
    if (response.data.isPartial) {
      console.log('✅ CHUNKING IS WORKING!');
      console.log('🧩 First chunk length:', response.data.response.length);
      console.log('🧩 Total chunks:', response.data.totalChunks);
      console.log('🧩 Conversation ID:', response.data.conversationId);
    } else {
      console.log('❌ Response not chunked');
      if (response.data.response && response.data.response.length > 800) {
        console.log('⚠️  Response is longer than 800 chars but not chunked');
      }
    }
    
    console.log('\n📖 Response preview:');
    console.log(response.data.response?.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testChunkingFromLogs();
