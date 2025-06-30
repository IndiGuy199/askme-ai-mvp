// Server Status Checker
const http = require('http');
const { execSync } = require('child_process');

function checkServerStatus() {
    console.log('🔍 Checking Server Status...\n');
    
    // Check if port 3000 is in use
    try {
        const netstat = execSync('netstat -an | findstr :3000', { encoding: 'utf8' });
        if (netstat.includes('3000')) {
            console.log('✅ Port 3000 is in use:');
            console.log(netstat);
        } else {
            console.log('❌ Port 3000 is not in use');
        }
    } catch (error) {
        console.log('❌ Port 3000 is not in use');
    }
    
    // Check for Node.js processes
    try {
        const tasklist = execSync('tasklist | findstr node', { encoding: 'utf8' });
        if (tasklist) {
            console.log('\n🟢 Node.js processes running:');
            console.log(tasklist);
        } else {
            console.log('\n❌ No Node.js processes found');
        }
    } catch (error) {
        console.log('\n❌ No Node.js processes found');
    }
    
    // Try to connect to server
    console.log('\n🌐 Testing server connection...');
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/',
        method: 'GET',
        timeout: 5000
    };
    
    const req = http.request(options, (res) => {
        console.log(`✅ Server is responding! Status: ${res.statusCode}`);
        console.log('🎯 Ready to run token tests');
    });
    
    req.on('error', (error) => {
        console.log('❌ Server connection failed:', error.code);
        console.log('💡 Start server with: cd web && npm run dev');
    });
    
    req.on('timeout', () => {
        console.log('⏰ Connection timed out');
        req.destroy();
    });
    
    req.end();
}

checkServerStatus();
