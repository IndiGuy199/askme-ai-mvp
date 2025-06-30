// Simplified Token Optimization Test
const https = require('https');
const http = require('http');

async function simpleTest() {
    console.log('🧪 Simple Token Test Starting...');
    
    // Test if server is reachable
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/gptRouter?email=deeshop9821@gmail.com',
        method: 'GET',
        timeout: 5000
    };
    
    const req = http.request(options, (res) => {
        console.log(`✅ Server responded with status: ${res.statusCode}`);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log('📊 Response length:', data.length);
            console.log('🎯 Server is accessible!');
            runTokenTest();
        });
    });
    
    req.on('error', (error) => {
        console.log('❌ Server connection failed:', error.message);
        console.log('💡 Please start server with: cd web && npm run dev');
    });
    
    req.on('timeout', () => {
        console.log('⏰ Request timed out');
        req.destroy();
    });
    
    req.end();
}

function runTokenTest() {
    console.log('\n🔬 Running Token Usage Test...');
    
    const postData = JSON.stringify({
        email: 'deeshop9821@gmail.com',
        message: 'Hi! How are you today?'
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
    
    const req = http.request(options, (res) => {
        console.log(`📡 API Response Status: ${res.statusCode}`);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                console.log('🪙 Tokens Used:', response.tokensUsed || 'N/A');
                console.log('📝 Response Length:', response.response?.length || 0);
                console.log('✅ Test completed successfully!');
            } catch (error) {
                console.log('❌ Failed to parse response:', error.message);
                console.log('📄 Raw response:', data.substring(0, 200));
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

// Run the test
simpleTest();
