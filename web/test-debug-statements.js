// Simple test to see if our debug statements appear in local server
const axios = require('axios');

async function testDebugStatements() {
  console.log('🧪 Testing if debug statements appear in local server...');
  
  try {
    const response = await axios.post('http://localhost:3000/api/gptRouter', {
      message: "Hello, this is a test message",
      email: "rd9821@gmail.com"
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Response received');
    console.log('Response status:', response.status);
    console.log('Response keys:', Object.keys(response.data));
    console.log('Tokens used:', response.data.tokensUsed);
    console.log('Token breakdown:', response.data.tokenBreakdown);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testDebugStatements();
