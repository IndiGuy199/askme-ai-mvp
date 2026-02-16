/**
 * Test protocol generation by directly importing the handler
 */

// Mock Next.js API request/response
const mockReq = (body) => ({
  method: 'POST',
  body
});

const mockRes = () => {
  const res = {
    statusCode: 200,
    _json: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this._json = data;
      return this;
    }
  };
  return res;
};

async function testProtocol() {
  console.log('🧪 Testing Coach AI Protocol Generation\n');

  const testCases = [
    {
      name: 'Porn - Low Intensity (3) - Bed',
      body: { durationMinutes: 2, track: 'porn', intensity: 3, context: 'bed' }
    },
    {
      name: 'Porn - Medium Intensity (5) - Home',
      body: { durationMinutes: 5, track: 'porn', intensity: 5, context: 'home' }
    },
    {
      name: 'Porn - High Intensity (8) - Bed',
      body: { durationMinutes: 2, track: 'porn', intensity: 8, context: 'bed' }
    }
  ];

  // Import the handler
  let handler;
  try {
    const module = await import('./pages/api/coach/protocol.ts');
    handler = module.default;
    console.log('✅ Handler loaded successfully\n');
  } catch (error) {
    console.error('❌ Failed to load handler:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST: ${testCase.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log('Request:', JSON.stringify(testCase.body, null, 2));

    const req = mockReq(testCase.body);
    const res = mockRes();

    try {
      await handler(req, res);
      
      if (res.statusCode === 200 && res._json) {
        console.log('\n✅ SUCCESS');
        console.log('Response:', {
          sessionId: res._json.sessionId,
          track: res._json.track,
          intensity: res._json.intensity,
          context: res._json.context,
          stepCount: res._json.steps?.length,
          totalSeconds: res._json.totalSeconds,
          steps: res._json.steps?.map(s => ({
            id: s.id,
            title: s.title,
            seconds: s.seconds,
            category: s.category
          }))
        });
      } else {
        console.log('\n❌ FAILED');
        console.log('Status:', res.statusCode);
        console.log('Response:', res._json);
      }
    } catch (error) {
      console.log('\n❌ ERROR');
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('Test complete');
  console.log('='.repeat(60));
}

testProtocol().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
