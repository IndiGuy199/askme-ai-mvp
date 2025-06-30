// Token Optimization Validation Test
// This script tests the optimized token usage vs the original

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testTokenOptimization() {
  console.log('🔬 Testing Token Optimization Improvements...\n');
  
  // Pre-flight check: is server running?
  console.log('🔍 Checking if server is running...');
  try {
    const healthCheck = await fetch('http://localhost:3000/api/gptRouter?email=deeshop9821@gmail.com', {
      method: 'GET',
      headers: { 'User-Agent': 'Token-Optimization-Test/1.0' }
    });
    
    if (healthCheck.ok) {
      console.log('✅ Server is responding\n');
    } else {
      console.log(`⚠️  Server responded with status: ${healthCheck.status}\n`);
    }
  } catch (error) {
    console.log('❌ Server not accessible. Please start with: cd web && npm run dev');
    console.log(`   Error: ${error.message}\n`);
    return;
  }
  
  const testCases = [
    {
      name: 'Simple Greeting',
      message: 'Hi! How are you today?',
      expectedTokens: 400 // Down from ~800
    },
    {
      name: 'Follow-up Question',
      message: 'Can you help me understand what triggers my anxiety?',
      expectedTokens: 600 // Down from ~1200
    },
    {
      name: 'Complex Request',
      message: 'I need help creating a comprehensive daily routine that addresses my anxiety, helps with my relationship issues, and gives me a sense of purpose.',
      expectedTokens: 900 // Down from ~2000
    }
  ];
  
  let totalSavings = 0;
  let successfulTests = 0;
  
  for (const testCase of testCases) {
    try {
      console.log(`🧪 Testing: ${testCase.name}`);
      console.log(`📝 Message: "${testCase.message.substring(0, 60)}..."`);
      
      const startTime = Date.now();
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      console.log('🌐 Sending request to API...');
      
      const response = await fetch('http://localhost:3000/api/gptRouter', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'User-Agent': 'Token-Optimization-Test/1.0'
        },
        body: JSON.stringify({
          email: 'deeshop9821@gmail.com',
          message: testCase.message
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        const actualTokens = data.tokensUsed || 0;
        const expectedTokens = testCase.expectedTokens;
        const savings = expectedTokens > actualTokens ? 
          ((expectedTokens - actualTokens) / expectedTokens * 100).toFixed(1) : 0;
        
        console.log(`✅ Response received (${responseTime}ms)`);
        console.log(`🪙 Tokens used: ${actualTokens} (expected: ~${expectedTokens})`);
        console.log(`💰 Token efficiency: ${actualTokens <= expectedTokens ? 'IMPROVED' : 'NEEDS WORK'}`);
        console.log(`📊 Response length: ${data.response?.length || 0} characters`);
        
        if (actualTokens <= expectedTokens) {
          console.log(`🎯 SUCCESS: ${savings}% better than target!`);
          totalSavings += parseFloat(savings);
          successfulTests++;
        } else {
          console.log(`⚠️  OVER TARGET: ${actualTokens - expectedTokens} tokens above expectation`);
        }
        
        console.log(`📄 Response preview: "${data.response?.substring(0, 100)}..."`);
        
      } else {
        const errorText = await response.text();
        console.log(`❌ Request failed: ${response.status} - ${errorText.substring(0, 200)}`);
      }
      
      console.log('─'.repeat(60));
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`⏰ Test timed out after 30 seconds`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`🚫 Server not running on localhost:3000`);
        console.log(`   Please start the server with: cd web && npm run dev`);
      } else {
        console.log(`❌ Test error: ${error.message}`);
      }
      console.log('─'.repeat(60));
    }
  }
  
  // Summary
  console.log('\n📊 OPTIMIZATION TEST SUMMARY');
  console.log('═'.repeat(50));
  console.log(`✅ Successful optimizations: ${successfulTests}/${testCases.length}`);
  console.log(`💰 Average token savings: ${(totalSavings / successfulTests || 0).toFixed(1)}%`);
  console.log(`🎯 Target: 60-70% token reduction from original ~2000 tokens`);
  
  if (successfulTests === testCases.length && totalSavings > 0) {
    console.log('🎉 OPTIMIZATION SUCCESS! All tests passed with improved token efficiency.');
  } else if (successfulTests > 0) {
    console.log('🔄 PARTIAL SUCCESS: Some optimizations working, continue refinement.');
  } else {
    console.log('🔧 NEEDS WORK: Further optimization required.');
  }
  
  console.log('\n🔍 Check current user token balance:');
  console.log('curl "http://localhost:3000/api/gptRouter?email=deeshop9821@gmail.com"');
}

// Run the test
testTokenOptimization().catch(console.error);
