# AskMe AI Test Scripts

This directory contains automated test scripts to validate your AskMe AI system functionality. The tests cover all major features including chunking, memor```sql
-- Check recent chat messages
SELECT user_id, role, content, created_at 
FROM chat_messages 
WHERE user_id = (SELECT id FROM users WHERE email = 'deeshop9821@gmail.com')
ORDER BY created_at DESC LIMIT 10;

-- Check chunked responses
SELECT user_id, chunk_number, total_chunks, LENGTH(content) as chunk_length
FROM chat_chunks 
WHERE user_id = (SELECT id FROM users WHERE email = 'deeshop9821@gmail.com')
ORDER BY created_at DESC LIMIT 5;
```tention, and error handling.

## Quick Start

### Prerequisites
1. Make sure your AskMe AI server is running (`npm run dev` in the `web` directory)
2. Create a test user with email `deeshop9821@gmail.com` or update the scripts with your test user email
3. Ensure the test user has sufficient tokens (at least 500 recommended)

### Running Tests

#### Option 1: Windows Batch File (Simplest)
```batch
# From c:\opt\mvp directory
run-tests.bat basic          # Run basic tests
run-tests.bat full           # Run complete test suite
run-tests.bat chunking       # Test chunking only
```

#### Option 2: PowerShell Script
```powershell
# From c:\opt\mvp directory
.\test-runner.ps1 -Scenario basic
.\test-runner.ps1 -Scenario full -Verbose
.\test-runner.ps1 -Scenario chunking -Delay 2000
```

#### Option 3: Node.js Script (Most Detailed)
```bash
# From c:\opt\mvp directory
node test-runner.js basic
node test-runner.js full --verbose
node test-runner.js chunking --delay=2000
```

#### Option 4: NPM Scripts (From web directory)
```bash
# From c:\opt\mvp\web directory
npm test                     # Basic tests
npm run test:full           # Complete test suite
npm run test:chunking       # Chunking tests
npm run test:verbose        # Basic tests with verbose output
```

## Available Test Scenarios

### Basic Scenarios
- **basic** - Essential functionality tests (5-10 minutes)
  - Initialization and greeting
  - Context retention
  - Basic chunking
  - Token management

- **full** - Complete test suite (15-20 minutes)
  - All basic tests
  - Memory and summarization
  - Stress testing
  - Edge cases

### Specific Test Categories
- **chunking** - Response chunking validation
- **memory** - Memory summarization and persistence
- **tokens** - Token management and limits
- **edge** - Edge cases and error handling
- **scenario-1** through **scenario-5** - Individual test scenarios

## Test Configuration

### Default Test User Profile
The scripts expect a test user with these details:
- **Email**: deeshop9821@gmail.com
- **Name**: Sarah
- **Age**: 32
- **Goals**: Weight loss, stress management, better sleep
- **Challenges**: Emotional eating, work-life balance

### Customizing Test Configuration

#### In Node.js script (test-runner.js):
```javascript
const tester = new AskMeAITester({
  baseUrl: 'http://localhost:3000',
  testUserEmail: 'your-test-user@example.com',
  verbose: true,
  delay: 1500
});
```

#### In PowerShell script:
```powershell
.\test-runner.ps1 -TestEmail "your-test-user@example.com" -BaseUrl "http://localhost:3000" -Delay 1500
```

## Test Outputs

### Console Output
- Real-time test progress with colored indicators
- Success/failure status for each test
- Response times and token usage
- Validation results

### Log Files
When using verbose mode:
- `logs/test-runner.log` - Detailed test execution log
- `test-results.json` - Complete test results in JSON format

### Sample Output
```
🤖 AskMe AI Test Runner
========================
📋 Scenario: basic
🔊 Verbose: false
⏱️  Delay: 1000ms

✅ Test user found: Sarah (ID: 123-456-789)
🧪 Sending message: "__INIT_CHAT__"
✅ Response received (2341ms, 287 chars)
🪙 Tokens used: 45, remaining: 455
✅ Check 1 passed: Response should be successful
✅ Check 2 passed: Response should include user name (Sarah)
✅ Check 3 passed: Response should reference user goals

📊 TEST EXECUTION SUMMARY
========================
📋 Total Tests: 5
✅ Successful Requests: 5/5 (100%)
🎯 Passed Validations: 5/5 (100%)
⏱️  Total Time: 23s
📈 Average Response Time: 2156ms
```

## Troubleshooting

### Common Issues

#### "Test user not found"
- Create a user account with email `deeshop9821@gmail.com`
- Or update the test scripts with your existing test user email

#### "Connection refused" or "Server not responding"
- Make sure your development server is running (`npm run dev`)
- Check that the server is accessible at `http://localhost:3000`
- Verify no firewall is blocking the connection

#### "Insufficient tokens"
- Ensure your test user has enough tokens (500+ recommended)
- Check token balance in the database or through the API

#### "Database errors"
- Verify all database migrations are applied
- Check that the `chat_chunks` table exists and has proper schema
- Ensure RLS policies allow service role operations

#### Node.js dependencies missing
```bash
# Install required dependencies
npm install node-fetch
```

### Test Validation Failures

If tests pass but validations fail, check:
1. **Response content** - AI responses should be contextual and relevant
2. **Chunking behavior** - Long responses should be properly chunked
3. **Memory persistence** - Context should be maintained across messages
4. **Token counting** - Token usage should be reasonable and tracked

### Performance Issues

If tests are slow:
- Increase delay between requests: `--delay=3000`
- Run specific scenarios instead of full suite
- Check server performance and database query times
- Monitor memory usage during chunking operations

## Advanced Usage

### Database Validation
The test scripts include SQL queries to validate database operations:

```sql
-- Check chat messages
SELECT user_id, role, content, created_at 
FROM chat_messages 
WHERE user_id = (SELECT id FROM users WHERE email = 'deeshop9821@gmail.com')
ORDER BY created_at DESC LIMIT 10;

-- Check chunked responses
SELECT user_id, chunk_number, total_chunks, LENGTH(content) as chunk_length
FROM chat_chunks 
WHERE user_id = (SELECT id FROM users WHERE email = 'deeshop9821@gmail.com')
ORDER BY created_at DESC LIMIT 5;
```

### Custom Test Messages
Modify the test scripts to include your own test messages and validation criteria:

```javascript
await this.sendMessage("Your custom test message", [
  (data) => ({
    passed: data.success === true,
    message: 'Your validation description'
  }),
  (data) => ({
    passed: data.response.includes('expected phrase'),
    message: 'Should contain expected phrase'
  })
], 'Your Test Name');
```

### Automated CI/CD Integration
The Node.js script returns appropriate exit codes for CI/CD integration:
- Exit code 0: All tests passed
- Exit code 1: Tests failed or validation errors

## Support

If you encounter issues with the test scripts:
1. Check the console output for specific error messages
2. Review the test results JSON file for detailed information
3. Ensure your AskMe AI system is properly configured
4. Verify database schema and RLS policies are correct

The test scripts are designed to be comprehensive yet easy to use. They will help you validate that all the improvements to your AskMe AI system are working correctly.
