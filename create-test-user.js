#!/usr/bin/env node

/**
 * Create Test User Script
 * Creates a test user for running the AskMe AI tests
 */

// Handle fetch import for different Node.js versions
let fetch;
try {
  // Try native fetch first (Node.js 18+)
  fetch = globalThis.fetch;
  if (!fetch) {
    // Fallback to node-fetch for older versions
    fetch = require('node-fetch');
  }
} catch (error) {
  console.error('❌ Unable to load fetch. Please install node-fetch: npm install node-fetch');
  process.exit(1);
}

async function createTestUser() {
  console.log('🚀 Creating test user for AskMe AI tests...');
  
  const testUser = {
    email: 'deeshop9821@gmail.com',
    firstName: 'Sarah',
    age: 32,
    goals: 'Weight loss, stress management, better sleep',
    city: 'Austin',
    country: 'Texas',
    maritalStatus: 'single',
    tokens: 100000 // Give plenty of tokens for testing
  };

  try {
    // First check if user already exists
    console.log('🔍 Checking if test user already exists...');
    const checkResponse = await fetch('http://localhost:3000/api/gptRouter?email=deeshop9821@gmail.com');
    const checkData = await checkResponse.json();
    
    if (checkData.id) {
      console.log('✅ Test user already exists!');
      console.log(`   Name: ${checkData.firstName}`);
      console.log(`   Email: ${checkData.email}`);
      console.log(`   Tokens: ${checkData.tokens}`);
      console.log('📋 You can now run the tests!');
      return;
    }

    console.log('📝 User not found, creating new test user...');
    
    // For now, we'll show instructions since we need to create via your registration system
    console.log('');
    console.log('🔧 MANUAL SETUP REQUIRED:');
    console.log('==========================');
    console.log('Please create a test user manually with these details:');
    console.log('');
    console.log('📧 Email: deeshop9821@gmail.com');
    console.log('👤 First Name: Sarah');
    console.log('🎂 Age: 32');
    console.log('⚥  Sex: Female');
    console.log('� Ethnicity: White');
    console.log('�🏙️  City: Austin');
    console.log('�🇸 Country: United States');
    console.log('💰 Tokens: 1000 (or at least 500)');
    console.log('');
    console.log('⚠️  Select these CHALLENGES in the profile setup:');
    console.log('   ✓ Anxiety');
    console.log('   ✓ Depression');
    console.log('   ✓ Relationship Issues');
    console.log('   ✓ Finding Purpose');
    console.log('');
    console.log('💡 How to create the user:');
    console.log('1. Go to http://localhost:3000/login');
    console.log('2. Register with email: deeshop9821@gmail.com');
    console.log('3. Complete profile setup with the details above');
    console.log('4. Select the challenges listed above');
    console.log('5. Complete the onboarding process');
    console.log('6. Add tokens through your admin interface or database');
    console.log('');
    console.log('🧪 After creating the user, run: node test-runner.js basic');

  } catch (error) {
    console.error('❌ Error checking for test user:', error.message);
    console.log('');
    console.log('💡 Make sure your development server is running:');
    console.log('   cd c:\\opt\\mvp\\web');
    console.log('   npm run dev');
  }
}

// Run if called directly
if (require.main === module) {
  createTestUser();
}

module.exports = { createTestUser };
