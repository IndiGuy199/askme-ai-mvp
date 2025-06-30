// Quick test for emoji handling fix
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testEmojiHandling() {
  console.log('🧪 Testing emoji handling fix...');
  
  try {
    const response = await fetch('http://localhost:3000/api/gptRouter', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',  // Ensure UTF-8
        'User-Agent': 'AskMe-AI-Tester/1.0'
      },
      body: JSON.stringify({
        email: 'deeshop9821@gmail.com',
        message: 'Hi � How are you?'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Emoji test PASSED!');
      console.log(`Response: ${data.response?.substring(0, 200)}...`);
      console.log(`Tokens used: ${data.tokensUsed}, remaining: ${data.tokensRemaining}`);
    } else {
      console.log(`❌ Emoji test FAILED: HTTP ${response.status}`);
      const errorData = await response.text();
      console.log(`Error: ${errorData}`);
    }
  } catch (error) {
    console.log(`❌ Emoji test ERROR: ${error.message}`);
  }
}

// Run the test
testEmojiHandling();
