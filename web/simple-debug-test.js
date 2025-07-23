// Simple test to verify which code is actually running
const axios = require('axios');

async function testActualCode() {
  console.log('🔍 Testing what code is actually running...');
  
  try {
    // Test with a very detailed request that should trigger high token limits
    const response = await axios.post('http://localhost:3000/api/gptRouter', {
      email: 'sarah@deeshop.com',
      message: 'Please provide a very very very detailed comprehensive analysis of stress management techniques with extensive step-by-step instructions'
    });
    
    console.log('✅ Response received');
    console.log('Response length:', response.data.response?.length || 0);
    console.log('Is chunked:', response.data.isPartial || false);
    console.log('Total chunks:', response.data.totalChunks || 1);
    console.log('Tokens used:', response.data.tokensUsed || 0);
    
    // Check if response seems truncated
    const isLikelyTruncated = response.data.response && 
      response.data.response.length < 500 && 
      !response.data.response.includes('conclusion') &&
      !response.data.response.includes('summary');
    
    console.log('Likely truncated:', isLikelyTruncated);
    
    if (response.data.response) {
      console.log('\n📝 Response preview (first 200 chars):');
      console.log(response.data.response.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testActualCode();
