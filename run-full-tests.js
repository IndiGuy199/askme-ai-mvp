// Test executor wrapper
const { spawn } = require('child_process');

console.log('🧪 Starting Full Test Suite...\n');

const testProcess = spawn('node', ['test-runner.js', 'full'], {
  cwd: 'C:\\opt\\mvp',
  stdio: 'inherit',
  shell: true
});

testProcess.on('error', (error) => {
  console.error('❌ Failed to start tests:', error);
});

testProcess.on('exit', (code) => {
  console.log(`\n📊 Tests completed with exit code: ${code}`);
  if (code === 0) {
    console.log('✅ All tests passed!');
  } else {
    console.log('❌ Some tests failed or encountered errors');
  }
});

// Also run token optimization test after the main tests
testProcess.on('exit', () => {
  console.log('\n🔄 Running Token Optimization Test...');
  
  const tokenTest = spawn('node', ['test-token-optimization.js'], {
    cwd: 'C:\\opt\\mvp',
    stdio: 'inherit',
    shell: true
  });
  
  tokenTest.on('exit', (code) => {
    console.log(`\n🪙 Token test completed with exit code: ${code}`);
  });
});
