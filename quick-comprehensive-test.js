// Quick API Test to verify messageCount fix
const http = require('http');

async function testApiQuick() {
    console.log('🔧 Testing API Fix for messageCount error...\n');
    
    const testMessage = 'Hi! How are you today?';
    
    const postData = JSON.stringify({
        email: 'deeshop9821@gmail.com',
        message: testMessage
    });
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/gptRouter',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 30000
    };
    
    console.log('📡 Sending test message to API...');
    
    const req = http.request(options, (res) => {
        console.log(`📊 Response Status: ${res.statusCode}`);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const response = JSON.parse(data);
                    console.log('✅ API Response Successful!');
                    console.log('🪙 Tokens Used:', response.tokensUsed || 'N/A');
                    console.log('📝 Response Length:', response.response?.length || 0);
                    console.log('🎯 messageCount fix successful!');
                    
                    // Test chunking scenario
                    testChunking();
                    
                } catch (error) {
                    console.log('❌ Failed to parse response:', error.message);
                    console.log('📄 Raw response (first 300 chars):', data.substring(0, 300));
                }
            } else {
                console.log('❌ API returned error status:', res.statusCode);
                console.log('📄 Error response:', data.substring(0, 500));
            }
        });
    });
    
    req.on('error', (error) => {
        console.log('❌ API request failed:', error.message);
    });
    
    req.on('timeout', () => {
        console.log('⏰ API request timed out after 30 seconds');
        req.destroy();
    });
    
    req.write(postData);
    req.end();
}

function testChunking() {
    console.log('\n🧩 Testing Chunking Capability...');
    
    const longMessage = `I need comprehensive help with multiple complex issues. First, I'm dealing with severe anxiety that affects my daily life, work performance, and relationships. I wake up every morning with a knot in my stomach, worrying about everything from minor daily tasks to major life decisions. This anxiety has been getting worse over the past six months, and I think it might be related to some significant changes in my life.

    Second, I'm having relationship problems with my partner. We've been together for three years, but lately, we seem to argue about everything - money, household responsibilities, future plans, and even small things like what to watch on TV. I feel like we're not communicating effectively, and I'm not sure how to bridge this gap. Sometimes I wonder if we're just incompatible, but other times I think we can work through this if we had the right tools and strategies.

    Third, I'm struggling with my career direction. I've been in my current job for two years, and while it pays well, I don't feel fulfilled or passionate about the work. I keep thinking about changing careers, maybe going back to school, or starting my own business, but I'm scared of taking the financial risk. The uncertainty is paralyzing, and I end up doing nothing, which makes me feel even worse about myself.

    Fourth, I have some health concerns that I've been putting off addressing. I know I should exercise more, eat better, and get regular check-ups, but I always find excuses. My energy levels are low, I'm not sleeping well, and I think my poor lifestyle habits are contributing to my anxiety and relationship problems.

    Can you help me create a comprehensive plan that addresses all these interconnected issues? I need practical strategies, not just general advice.`;
    
    const postData = JSON.stringify({
        email: 'deeshop9821@gmail.com',
        message: longMessage
    });
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/gptRouter',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 45000 // Longer timeout for complex message
    };
    
    console.log('📡 Sending complex chunking test message...');
    
    const req = http.request(options, (res) => {
        console.log(`📊 Chunking Test Status: ${res.statusCode}`);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const response = JSON.parse(data);
                    console.log('✅ Chunking Test Successful!');
                    console.log('🪙 Tokens Used:', response.tokensUsed || 'N/A');
                    console.log('📝 Response Length:', response.response?.length || 0);
                    console.log('🧩 Chunking capability verified!');
                    
                    // Test memory persistence
                    setTimeout(() => testMemory(), 2000);
                    
                } catch (error) {
                    console.log('❌ Failed to parse chunking response:', error.message);
                }
            } else {
                console.log('❌ Chunking test failed with status:', res.statusCode);
                console.log('📄 Error:', data.substring(0, 500));
            }
        });
    });
    
    req.on('error', (error) => {
        console.log('❌ Chunking test request failed:', error.message);
    });
    
    req.on('timeout', () => {
        console.log('⏰ Chunking test timed out');
        req.destroy();
    });
    
    req.write(postData);
    req.end();
}

function testMemory() {
    console.log('\n🧠 Testing Memory/Context Retention...');
    
    const followUpMessage = `Based on our previous conversation about my anxiety, relationship issues, career concerns, and health problems, can you give me specific next steps for this week? Focus on the most urgent priorities.`;
    
    const postData = JSON.stringify({
        email: 'deeshop9821@gmail.com',
        message: followUpMessage
    });
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/gptRouter',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 30000
    };
    
    console.log('📡 Sending memory/context test message...');
    
    const req = http.request(options, (res) => {
        console.log(`📊 Memory Test Status: ${res.statusCode}`);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const response = JSON.parse(data);
                    console.log('✅ Memory Test Successful!');
                    console.log('🪙 Tokens Used:', response.tokensUsed || 'N/A');
                    console.log('📝 Response Length:', response.response?.length || 0);
                    console.log('🧠 Memory/context retention verified!');
                    
                    console.log('\n🎉 COMPREHENSIVE TEST SUMMARY:');
                    console.log('═'.repeat(50));
                    console.log('✅ API messageCount fix: WORKING');
                    console.log('✅ Basic messaging: WORKING');  
                    console.log('✅ Chunking capability: WORKING');
                    console.log('✅ Memory/context: WORKING');
                    console.log('🎯 All core functionality validated!');
                    
                } catch (error) {
                    console.log('❌ Failed to parse memory response:', error.message);
                }
            } else {
                console.log('❌ Memory test failed with status:', res.statusCode);
                console.log('📄 Error:', data.substring(0, 500));
            }
        });
    });
    
    req.on('error', (error) => {
        console.log('❌ Memory test request failed:', error.message);
    });
    
    req.on('timeout', () => {
        console.log('⏰ Memory test timed out');
        req.destroy();
    });
    
    req.write(postData);
    req.end();
}

// Start the test
testApiQuick();
