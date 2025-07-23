// Test if server changes are taking effect
const axios = require('axios');

async function testServerChanges() {
  console.log('🧪 Testing server changes...');
  
  try {
    const response = await axios.post('http://localhost:3000/api/gptRouter', {
      message: "TEST_SERVER_RESPONSE - please confirm server changes are working",
      email: "test@test.com",
      user_id: "046d3d85-fd5e-466b-b799-c7fe18f6d00b"
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Response received');
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testServerChanges();
