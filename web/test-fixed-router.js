// Test the FIXED router specifically
const http = require('http');

async function testFixedRouter() {
    console.log('=== TESTING FIXED ROUTER ===');
    console.log('Time:', new Date().toISOString());
    
    const testMessage = "Please give me a very very very detailed explanation of stress management with comprehensive strategies and step-by-step approaches.";
    
    console.log('Test message:', testMessage);
    console.log('Message length:', testMessage.length);
    console.log('Should trigger detailed request logic:', testMessage.includes('very very'));
    
    try {
        const postData = JSON.stringify({
            email: 'rd9821@gmail.com',
            message: testMessage,
            messages: []
        });
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/gptRouter-fixed',  // Using the NEW fixed router
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const response = await new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, data: JSON.parse(data) });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: data, error: e });
                    }
                });
            });
            
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
        
        const result = response.data;
        
        console.log('\n=== FIXED ROUTER RESULTS ===');
        console.log('Status:', response.status);
        console.log('Response length:', result.response?.length || 0);
        console.log('Response preview:', result.response?.substring(0, 200) + '...');
        console.log('Tokens used:', result.tokensUsed);
        console.log('Debug info:', result.debug);
        
        // Check if response seems complete
        const responseText = result.response || '';
        const seemsComplete = responseText.length > 1000 && 
                             (responseText.endsWith('.') || responseText.endsWith('!') || responseText.endsWith('?'));
        
        console.log('\n=== COMPLETION ANALYSIS ===');
        console.log('Response seems complete:', seemsComplete);
        console.log('Response length > 1000:', responseText.length > 1000);
        console.log('Response ends properly:', responseText.endsWith('.') || responseText.endsWith('!') || responseText.endsWith('?'));
        console.log('Last 50 characters:', responseText.slice(-50));
        
        if (result.error) {
            console.log('\nERROR:', result.error);
        }
        
    } catch (error) {
        console.error('Fixed router test failed:', error);
    }
    
    console.log('\n=== FIXED ROUTER TEST COMPLETE ===');
}

testFixedRouter();
