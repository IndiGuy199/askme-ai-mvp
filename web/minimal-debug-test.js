// MINIMAL DEBUG TEST - Let's see what's actually happening
const https = require('https');
const http = require('http');

async function testMinimal() {
    console.log('=== MINIMAL DEBUG TEST START ===');
    console.log('Time:', new Date().toISOString());
    
    const testMessage = "Please give me a very very very detailed explanation of stress management with comprehensive strategies and step-by-step approaches.";
    
    console.log('Test message:', testMessage);
    console.log('Message length:', testMessage.length);
    console.log('Should trigger detailed request logic:', testMessage.includes('very very very'));
    
    try {
        const postData = JSON.stringify({
            email: 'rd9821@gmail.com',
            message: testMessage,
            messages: []
        });
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/gptRouter',
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
        
        console.log('\n=== RESPONSE ANALYSIS ===');
        console.log('Status:', response.status);
        console.log('Response length:', result.response?.length || 0);
        console.log('Response preview:', result.response?.substring(0, 200) + '...');
        console.log('Tokens used:', result.tokensUsed);
        console.log('Is chunked:', result.isPartial || false);
        console.log('Total chunks:', result.totalChunks || 'N/A');
        console.log('Conversation ID:', result.conversationId || 'N/A');
        
        // Check if response seems truncated
        const responseText = result.response || '';
        const seemsTruncated = responseText.length < 500 || 
                              !responseText.includes('.') || 
                              responseText.endsWith('...');
        
        console.log('\n=== TRUNCATION ANALYSIS ===');
        console.log('Response seems truncated:', seemsTruncated);
        console.log('Response ends properly:', responseText.endsWith('.') || responseText.endsWith('!') || responseText.endsWith('?'));
        console.log('Has multiple sentences:', (responseText.match(/\./g) || []).length > 1);
        
        if (result.error) {
            console.log('\nERROR:', result.error);
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
    
    console.log('\n=== TEST COMPLETE ===');
}

testMinimal();
