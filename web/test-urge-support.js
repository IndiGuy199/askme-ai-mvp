/**
 * Test Coach AI Protocol via HTTP
 */

const testCases = [
  {
    name: 'Porn - Low Intensity (3) - Bed - 2min',
    body: { durationMinutes: 2, track: 'porn', intensity: 3, context: 'bed' }
  },
  {
    name: 'Porn - Medium Intensity (5) - Home - 5min',
    body: { durationMinutes: 5, track: 'porn', intensity: 5, context: 'home' }
  },
  {
    name: 'Porn - High Intensity (8) - Bed - 2min',
    body: { durationMinutes: 2, track: 'porn', intensity: 8, context: 'bed' }
  },
  {
    name: 'Porn - Very High Intensity (10) - Out - 5min',
    body: { durationMinutes: 5, track: 'porn', intensity: 10, context: 'out' }
  },
  {
    name: 'Porn - No Intensity - No Context - 2min',
    body: { durationMinutes: 2, track: 'porn' }
  },
  {
    name: 'Porn - Medium (6) - Home - 5min',
    body: { durationMinutes: 5, track: 'porn', intensity: 6, context: 'home' }
  }
];

async function testProtocol() {
  console.log('🧪 Testing Coach AI Protocol Generation via HTTP\n');
  console.log('Server: http://localhost:3000\n');

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`TEST: ${testCase.name}`);
    console.log(`${'='.repeat(70)}`);
    console.log('Request:', JSON.stringify(testCase.body, null, 2));

    try {
      const response = await fetch('http://localhost:3000/api/coach/protocol', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.body)
      });

      const data = await response.json();

      if (response.ok) {
        console.log('\n✅ SUCCESS (Status:', response.status, ')');
        console.log('\n📋 Protocol Summary:');
        console.log('  Session ID:', data.sessionId);
        console.log('  Track:', data.track);
        console.log('  Duration:', data.durationMinutes, 'min');
        console.log('  Intensity:', data.intensity);
        console.log('  Context:', data.context);
        console.log('  Step Count:', data.steps?.length);
        console.log('  Total Seconds:', data.totalSeconds);
        
        console.log('\n📝 Steps:');
        data.steps?.forEach((step, i) => {
          console.log(`  ${i + 1}. [${step.seconds}s] ${step.title} (${step.category})`);
          console.log(`     "${step.instruction}"`);
        });

        if (data.close) {
          console.log('\n🎯 Close:');
          console.log(`  ${data.close.title}`);
          console.log(`  "${data.close.instruction}"`);
        }

        // Validation checks
        console.log('\n🔍 Validation:');
        const expectedSeconds = testCase.body.durationMinutes * 60;
        const actualSeconds = data.steps.reduce((sum, s) => sum + s.seconds, 0);
        console.log(`  Duration check: ${actualSeconds}s / ${expectedSeconds}s expected`, 
          actualSeconds === expectedSeconds ? '✅' : '⚠️');
        
        const hasGrounding = data.steps.some(s => s.category === 'grounding');
        const hasDefusion = data.steps.some(s => s.category === 'defusion');
        const hasFriction = data.steps.some(s => s.category === 'friction');
        const hasRedirect = data.steps.some(s => s.category === 'redirect');
        
        console.log(`  Has grounding step: ${hasGrounding ? '✅' : '❌'}`);
        console.log(`  Has defusion step: ${hasDefusion ? '✅' : '❌'}`);
        console.log(`  Has friction step: ${hasFriction ? '✅' : '❌'}`);
        console.log(`  Has redirect step: ${hasRedirect ? '✅' : '❌'}`);

        // Check for device-killing instructions
        const deviceKillingPhrases = [
          'turn off', 'shut down', 'delete the app', 'power off',
          'close the app', 'uninstall'
        ];
        const hasDeviceKilling = data.steps.some(s => 
          deviceKillingPhrases.some(phrase => 
            s.instruction.toLowerCase().includes(phrase)
          )
        );
        console.log(`  Avoids device-killing: ${!hasDeviceKilling ? '✅' : '❌'}`);

        // Check for porn-specific language if applicable
        if (testCase.body.track === 'porn') {
          const pornPatterns = [
            'spiral', 'peek', 'fantasy', 'tab', 'scroll', 
            'urge', 'phone', 'feet', 'posture'
          ];
          const hasPornSpecific = data.steps.some(s =>
            pornPatterns.some(pattern => 
              s.instruction.toLowerCase().includes(pattern) || 
              s.title.toLowerCase().includes(pattern)
            )
          );
          console.log(`  Porn-specific language: ${hasPornSpecific ? '✅' : '⚠️'}`);
        }

      } else {
        console.log('\n❌ FAILED (Status:', response.status, ')');
        console.log('Response:', JSON.stringify(data, null, 2));
      }

    } catch (error) {
      console.log('\n❌ ERROR');
      console.error('Error:', error.message);
      if (error.cause) {
        console.error('Cause:', error.cause);
      }
    }

    // Wait a bit between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n\n' + '='.repeat(70));
  console.log('✅ All tests complete');
  console.log('='.repeat(70));
}

testProtocol().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
