#!/usr/bin/env node

/**
 * Quick test script for Coach AI endpoints
 * Run: node test-coach-ai.js <email>
 */

const TEST_EMAIL = process.argv[2] || 'rdee199@gmail.com';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testEndpoint(name, endpoint, body) {
  console.log(`\n🧪 Testing ${name}...`);
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ ${name} SUCCESS`);
      console.log('Response preview:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
      console.log(`Tokens used: ${data.tokens_used}, Remaining: ${data.tokens_remaining}`);
      return data;
    } else {
      console.log(`❌ ${name} FAILED`);
      console.log('Error:', data.error);
      return null;
    }
  } catch (error) {
    console.log(`❌ ${name} ERROR`);
    console.log(error.message);
    return null;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Coach AI Endpoint Tests');
  console.log('='.repeat(60));
  console.log(`Email: ${TEST_EMAIL}`);
  console.log(`Base URL: ${BASE_URL}`);

  // Test Goals
  const goalsResult = await testEndpoint(
    'Goals',
    '/api/coach/goals',
    { email: TEST_EMAIL }
  );

  // Test Actions (if goals succeeded, use first goal)
  if (goalsResult && goalsResult.goals && goalsResult.goals.length > 0) {
    await testEndpoint(
      'Actions',
      '/api/coach/actions',
      { 
        email: TEST_EMAIL,
        goalId: 'porn_addiction_goal_1' // Use a known goal ID
      }
    );
  } else {
    console.log('\n⏭️  Skipping Actions test (no goals to test with)');
  }

  // Test Insights
  await testEndpoint(
    'Insights',
    '/api/coach/insights',
    { email: TEST_EMAIL }
  );

  console.log('\n' + '='.repeat(60));
  console.log('Tests complete!');
  console.log('='.repeat(60));
}

runTests().catch(console.error);
