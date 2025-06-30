# Quick Test Execution Guide

## Prerequisites

### 1. Server Running
```bash
cd web
npm run dev
```
Server should be running at http://localhost:3000

### 2. Test User Setup
You need a test user with email: deeshop9821@gmail.com

**Important**: The test user needs sufficient tokens (minimum 5000 recommended for comprehensive testing).

If you get a 403 "Insufficient tokens" error, run this SQL command:
```sql
UPDATE users SET tokens = 5000 WHERE email = 'deeshop9821@gmail.com';
```

## Step-by-Step Test Execution

### 1. Start Your Development Server
```bash
# Open Terminal/Command Prompt
cd c:\opt\mvp\web
npm run dev
# Leave this running and open a new terminal
```

### 2. Install Test Dependencies
```bash
# In a new terminal, go to project root
cd c:\opt\mvp
npm install node-fetch
```

### 3. Create Test User (if not exists)
You need a test user with email: deeshop9821@gmail.com
- Either create through your registration process
- Or add directly to database with sufficient tokens

### 4. Run Tests

#### Option A: Simple Windows Batch (Recommended for first run)
```batch
# From c:\opt\mvp directory
run-tests.bat basic
```

#### Option B: Node.js with detailed output
```bash
# From c:\opt\mvp directory
node test-runner.js basic --verbose
```

#### Option C: Full test suite
```bash
node test-runner.js full --verbose
```

## What to Look For in Results

### ✅ Success Indicators:
- "Test user found: Sarah"
- "Response received" with reasonable response times
- "All validation checks passed"
- Final summary showing 100% success rate

### ❌ Potential Issues to Check:
- "Test user not found" - Need to create test user
- "Connection refused" - Server not running
- "Insufficient tokens" - Add tokens to test user
- "Database errors" - Check schema and RLS policies
- Validation failures - Check AI response quality

### 📊 Expected Results for Each Test:

#### Initialization Test:
- Should greet user by name (Sarah)
- Should reference user's goals
- Response time: 2-5 seconds

#### Chunking Test:
- Long responses should be chunked (>1500 chars)
- Should see "Response was chunked into X parts"
- Each chunk should be coherent

#### Context Retention:
- Should reference previous conversation
- Should maintain topic continuity
- Should remember user details

#### Memory Test:
- Should trigger memory summarization after 8-10 messages
- Should persist context across sessions
- Should update user profile

#### Token Test:
- Should show current token balance
- Should track token usage accurately
- Should handle low token scenarios

## Troubleshooting Commands

If tests fail, use these to diagnose:

### Check if server is running:
```bash
curl http://localhost:3000/api/gptRouter?email=deeshop9821@gmail.com
```

### Check test user in database:
```sql
SELECT id, email, first_name, tokens 
FROM users 
WHERE email = 'deeshop9821@gmail.com';
```

### Check chat_chunks table exists:
```sql
SELECT COUNT(*) FROM chat_chunks;
```

### Check recent chat messages:
```sql
SELECT role, content, created_at 
FROM chat_messages 
WHERE user_id = (SELECT id FROM users WHERE email = 'deeshop9821@gmail.com')
ORDER BY created_at DESC 
LIMIT 5;
```

## Expected Test Timeline:
- Basic tests: 5-10 minutes
- Full test suite: 15-20 minutes
- Individual scenarios: 1-3 minutes each

## Success Criteria:
- All HTTP requests return 200 status
- AI responses are contextual and relevant
- Chunking works for long responses (>1500 chars)
- Memory persists across conversation
- Token tracking is accurate
- No database errors or exceptions
