# AskMe AI - Comprehensive Test Chat Scenarios

## Overview
This document provides detailed test scenarios to validate the AskMe AI's functionality including:
- Context retention across messages
- Response chunking for long answers
- Goal and challenge tracking
- Memory summarization
- Coach profile personalization
- Session management

## Test User Profile Setup
Before testing, ensure you have a test user with:
- **Email**: deeshop9821@gmail.com  
- **Name**: Sarah
- **Age**: 32
- **Sex**: Female
- **Ethnicity**: White
- **Location**: Austin, United States
- **Selected Challenges**: Anxiety, Depression, Relationship Issues, Finding Purpose (select multiple)
- **Goals**: Will be set up after profile creation through the goals system
- **Tokens**: At least 500 (add via database/admin interface)

---

## Test Scenario 1: Initial Greeting & Context Recognition
**Purpose**: Test initialization, name recognition, and goal awareness

### Message 1 (Initialization)
```
__INIT_CHAT__
```
**Expected Response**:
- Warm greeting using user's name (Sarah)
- Reference to previous conversations if any
- Acknowledgment of current challenges (anxiety, depression, relationship issues, finding purpose)
- Coach personality should be evident based on matched coach profile

### Message 2 (Follow-up)
```
Hi! I'm feeling a bit overwhelmed today and could use some guidance.
```
**Expected Response**:
- Empathetic response
- Reference to anxiety/stress challenges from profile
- Practical advice
- Should maintain context from greeting

---

## Test Scenario 2: Long Response Chunking
**Purpose**: Test the chunking system for responses over 1500 characters

### Message 3 (Complex Request)
```
Can you help me create a comprehensive plan for managing my anxiety and depression? I want something detailed that covers daily coping strategies, relationship improvement techniques, ways to find more purpose in my life, and practical steps I can take when I'm feeling overwhelmed. Please be very thorough and include specific examples and timeframes.
```
**Expected Response**:
- Should trigger chunking (response likely >1500 chars)
- Multiple chunks with coherent breaks
- Each chunk should be complete thoughts
- UI should show chunk navigation
- Total response should be comprehensive and cover anxiety, depression, relationships, and purpose

---

## Test Scenario 3: Context Retention Test
**Purpose**: Verify the AI remembers previous conversation elements

### Message 4 (Reference Previous)
```
That plan looks really helpful! But I'm particularly struggling with the relationship part you mentioned. I have trouble communicating with my partner when I'm feeling anxious. What specific strategies can help with that?
```
**Expected Response**:
- Should reference the previous comprehensive plan
- Focus specifically on relationship communication during anxiety
- Maintain context about Sarah's challenges
- Show understanding of the specific relationship issues

### Message 5 (Challenge-Specific Follow-up)
```
Also, how does this help with finding my purpose? I feel really lost in life right now and don't know what direction to go in.
```
**Expected Response**:
- Reference "Finding Purpose" as one of her selected challenges
- Connect previous advice to purpose-finding strategies
- Show awareness of her existential concerns
- Provide specific guidance for discovering life direction

---

## Test Scenario 4: Memory and Summarization
**Purpose**: Test memory retention and summarization after multiple messages

### Message 6 (New Topic Introduction)
```
By the way, I've been having a really hard time with my depression lately. I know this was one of my main challenges, but I keep having these days where I can barely get out of bed and everything feels pointless.
```
**Expected Response**:
- Acknowledge depression as one of her stated challenges
- Address the severity of symptoms with empathy
- Provide targeted depression management advice
- May trigger memory summarization in background

### Message 7 (Complex Interconnected Query)
```
I've tried therapy and medication before, but nothing seems to help long-term. My anxiety makes my depression worse, and when I'm depressed I isolate myself which hurts my relationships, and then the relationship problems make me feel more anxious and hopeless about my future. Sometimes I have panic attacks thinking about how I'm wasting my life and not living up to my potential. It feels like everything is connected - the anxiety, depression, relationship issues, and feeling lost about my purpose. Can you help me break this cycle?
```
**Expected Response**:
- Long, detailed response (should trigger chunking)
- Address interconnected issues (anxiety, depression, relationships, purpose)
- Reference her specific challenges from profile
- Provide systematic approach to breaking negative cycles
- Show understanding of the complex interplay between her challenges

---

## Test Scenario 5: Goal Progress and Tracking
**Purpose**: Test goal-related conversations and progress tracking

### Message 8 (Progress Update)
```
I wanted to update you on my progress. I've been following some of your advice for about a week now. I had fewer panic attacks this week, and I managed to have an honest conversation with my partner about my anxiety instead of shutting down. But I'm still struggling with the depression and feeling unmotivated about my future.
```
**Expected Response**:
- Celebrate the progress made (fewer panic attacks, better communication)
- Reference specific previous advice given
- Address ongoing depression and motivation challenges
- Suggest adjustments or next steps
- Show continuity with previous conversations

### Message 9 (Challenge Evolution)
```
I'm thinking I might need to focus less on my anxiety for now and more on finding some direction in my life. Maybe if I had more purpose and meaning, the other stuff would be easier to handle? What do you think?
```
**Expected Response**:
- Support the strategic shift in focus
- Reference her current challenges and how they interconnect
- Provide guidance on purpose-finding as a foundation
- Should update understanding of her evolving priorities

---

## Test Scenario 6: Stress Testing Long Conversations
**Purpose**: Test system stability and context retention over extended chat

### Message 10 (Detailed Life Context)
```
Let me give you more context about my situation. I work as a marketing manager at a tech startup, but I don't feel passionate about it. My days are filled with meetings and deadlines that feel meaningless. I live alone in Austin, which I love, but I struggle with loneliness. My relationships with family are strained because of my mental health struggles, and I don't have many close friends. I spend weekends mostly alone, which makes my depression worse. I keep thinking there must be more to life than this, but I don't know how to find it or what I'm even looking for. I feel stuck between wanting to make big changes and being too scared and overwhelmed to actually do anything. Where would you suggest I start?
```
**Expected Response**:
- Process the detailed context about work, relationships, and isolation
- Prioritize recommendations based on her situation and challenges
- Reference her challenges (depression, anxiety, relationship issues, finding purpose) in context
- May trigger chunking due to comprehensive response
- Should acknowledge the complexity of feeling stuck between desire for change and fear

### Message 11 (Follow-up Question)
```
That's really helpful advice. Quick question though - you mentioned earlier about relationship communication strategies. Do you remember what specific techniques you suggested for talking to my partner when I'm feeling anxious?
```
**Expected Response**:
- Should recall and reference previous relationship communication advice
- Demonstrate context retention across multiple messages
- May need to acknowledge if that specific advice wasn't given yet

---

## Test Scenario 7: Session End and Memory Testing
**Purpose**: Test session management and memory persistence

### Message 12 (Session Wind-down)
```
This has been really helpful. I feel like I have a clearer direction now. I'm going to start with the purpose-finding exercises you suggested and work on being more open with my partner about my struggles. Thank you for listening and understanding my situation.
```
**Expected Response**:
- Encouraging wrap-up
- Summarize key takeaways (purpose-finding, communication)
- Reinforce next steps
- Warm closing

### After Session Break (simulate logging out and back in)
**Test the session end functionality by calling the API endpoint:**
```
GET /api/gptRouter?email=deeshop9821@gmail.com&action=end_session
```

### Message 13 (New Session Test)
```
__INIT_CHAT__
```
**Expected Response**:
- Should reference previous conversation
- Remember her challenges (anxiety, depression, relationship issues, finding purpose)
- Show continuity despite session break
- Greet her by name

### Message 14 (Memory Persistence Test)
```
I wanted to follow up on our conversation about anxiety and relationship communication. I tried some of the techniques we discussed with my partner.
```
**Expected Response**:
- Should recall the anxiety and relationship communication discussion
- Reference specific techniques if they were given
- Ask about progress or results
- Demonstrate memory persistence

---

## Test Scenario 8: Error Recovery and Edge Cases
**Purpose**: Test system robustness

### Message 15 (Very Short Message)
```
yes
```
**Expected Response**:
- Should handle gracefully
- May ask for clarification
- Maintain conversation context

### Message 16 (Ambiguous Reference)
```
Can you explain that thing you mentioned before about the thing?
```
**Expected Response**:
- Should ask for clarification
- Maybe reference recent topics discussed
- Handle ambiguity gracefully

### Message 17 (Topic Change)
```
Actually, let's change topics. I want to talk about my work situation and feeling unfulfilled in my career instead.
```
**Expected Response**:
- Acknowledge topic change
- Transition smoothly to career/purpose topic
- May relate to existing "Finding Purpose" challenge

---

## Test Scenario 9: Token Management and Limits
**Purpose**: Test token consumption and limits handling

### Message 18 (Check Token Balance)
```
Can you tell me how many tokens I have left?
```
**Expected Response**:
- Should display current token balance
- Should not consume excessive tokens for this simple query

### Message 19 (Token Exhaustion Test)
**Setup**: Manually set user's token balance to 50 tokens
```
I need a very comprehensive, detailed plan for managing all my mental health challenges including anxiety, depression, relationship issues, and finding my life purpose. Please include specific daily strategies, therapy techniques, relationship communication scripts, career exploration exercises, mindfulness practices, and step-by-step guides for each area. I want everything to be extremely detailed with examples and implementation timelines.
```
**Expected Response**:
- Should return "insufficient tokens" error
- Should not process the request
- Should preserve user's remaining token balance
- Should suggest purchasing more tokens

---

## Test Scenario 10: Database Schema Validation
**Purpose**: Test that all database operations work correctly

### Database Checks to Perform During Testing:

#### Check Chat Messages Storage
```sql
-- Verify messages are being stored correctly
SELECT user_id, role, content, created_at, tokens_used 
FROM chat_messages 
WHERE user_id = (SELECT id FROM users WHERE email = 'deeshop9821@gmail.com')
ORDER BY created_at DESC 
LIMIT 10;
```

#### Check Chunked Responses
```sql
-- Verify chunked responses are stored properly
SELECT 
    cc.user_id,
    cc.message_id,
    cc.chunk_number,
    cc.total_chunks,
    LENGTH(cc.content) as chunk_length,
    cc.created_at
FROM chat_chunks cc
WHERE cc.user_id = (SELECT id FROM users WHERE email = 'deeshop9821@gmail.com')
ORDER BY cc.created_at DESC, cc.chunk_number ASC
LIMIT 15;
```

#### Check Memory Summarization
```sql
-- Verify memory summaries are being created/updated
SELECT 
    user_id,
    LENGTH(memory_summary) as summary_length,
    updated_at,
    last_memory_date
FROM user_profiles 
WHERE user_id = (SELECT id FROM users WHERE email = 'deeshop9821@gmail.com');
```

#### Check User Activity Tracking
```sql
-- Verify user activity is tracked
SELECT 
    email,
    last_active,
    total_messages,
    tokens_remaining,
    created_at
FROM users 
WHERE email = 'deeshop9821@gmail.com';
```

---

## Test Scenario 11: Performance and Load Testing
**Purpose**: Test system performance under various conditions

### Message 20 (Rapid Fire Messages)
Send these messages quickly in succession (within 30 seconds):

```
How are you today?
```
```
What's the weather like?
```
```
Can you help me with stress?
```
```
What about exercise?
```
```
Tell me about sleep hygiene.
```

**Expected Behavior**:
- All messages should be processed in order
- Context should be maintained across rapid messages
- No race conditions or database errors
- Response times should remain reasonable (< 30 seconds each)

### Message 21 (Complex Concurrent Test)
**Setup**: If possible, test with multiple users simultaneously

Create 2-3 test users and have them send complex requests at the same time:

User A:
```
Give me a detailed workout plan for beginners focusing on strength training.
```

User B:
```
I need comprehensive meal prep strategies for busy professionals with dietary restrictions.
```

User C:
```
Can you create a stress management plan that includes mindfulness, time management, and work-life balance techniques?
```

**Expected Behavior**:
- All users should receive appropriate responses
- No cross-contamination of user data
- Database operations should handle concurrent access
- Chunking should work correctly for all users

---

## Test Scenario 12: Edge Case and Error Recovery
**Purpose**: Test system robustness with unusual inputs

### Message 22 (Special Characters and Formatting)
```
Can you help me with my challenges? Here's my situation:
- I'm struggling with � severe anxiety  
- Depression is hitting hard �
- Relationship problems = constant stress 💔
- Feeling lost about my purpose 🤷‍♀️

What should I do???
```
**Expected Response**:
- Should handle emojis and special characters gracefully
- Should parse the structured information about her specific challenges
- Should provide relevant advice despite unusual formatting

### Message 23 (Very Long Single Message)
```
[Create a message that's approximately 2000+ characters of continuous text without natural breaking points - one very long paragraph discussing health goals, challenges, daily routine, work stress, family situation, past attempts at lifestyle changes, current frustrations, future aspirations, specific questions about nutrition, exercise preferences, time constraints, budget limitations, equipment availability, social support systems, previous injuries or health conditions, medication considerations, dietary restrictions, food preferences, cooking skills, meal timing, hydration habits, sleep environment, work schedule, commute details, weekend activities, stress triggers, relaxation preferences, motivation challenges, accountability needs, progress tracking preferences, and desired outcomes - all in one continuous flow to test the chunking system's ability to handle text without natural break points]
```
**Expected Response**:
- Should chunk appropriately even without natural breaks
- Should maintain coherent meaning across chunks
- Should not break mid-sentence if possible
- Should handle the complexity gracefully

### Message 24 (Empty and Invalid Inputs)
Test these sequentially:

```
[Send empty message]
```
```
   
```
```
null
```
```
undefined
```
**Expected Responses**:
- Should handle each gracefully
- Should not crash the system
- Should provide appropriate error messages or prompts for clarification

---

## Test Scenario 13: Coach Profile Switching
**Purpose**: Test different coach personalities and consistency

### Setup: Switch Coach Profile
**Step 1**: Update user's coach profile to "Direct/Assertive Coach"

### Message 25 (Test Direct Coach Style)
```
I keep making excuses for not exercising. I say I'll start tomorrow but then I don't. I'm frustrated with myself.
```
**Expected Response**:
- Should match direct/assertive coaching style
- May use more challenging language
- Should push for immediate action
- Tone should be firm but supportive

### Setup: Switch Coach Profile
**Step 2**: Update user's coach profile to "Gentle/Supportive Coach"

### Message 26 (Test Gentle Coach Style)
```
I'm feeling really discouraged about my progress. I feel like I'm failing at everything I try to do for my health.
```
**Expected Response**:
- Should match gentle/supportive coaching style
- Should be more nurturing and understanding
- Should focus on encouragement and small wins
- Tone should be warm and compassionate

### Message 27 (Consistency Check)
```
Can you remind me what we discussed about sleep earlier?
```
**Expected Response**:
- Should maintain new coach personality
- Should recall previous sleep discussion
- Should demonstrate personality consistency

---

## Advanced Technical Validation

### API Response Structure Validation
Monitor these API responses during testing:

```javascript
// Expected structure for regular messages
{
  success: true,
  response: "AI response text",
  chunked: false,        // or true if chunked
  chunks: null,          // or array if chunked
  tokensUsed: number,
  tokensRemaining: number,
  sessionId: "session-id",
  messageId: "message-id"
}

// Expected structure for chunked messages
{
  success: true,
  response: "Combined response text",
  chunked: true,
  chunks: [
    {
      chunkNumber: 1,
      totalChunks: 3,
      content: "First chunk content..."
    },
    // ... more chunks
  ],
  tokensUsed: number,
  tokensRemaining: number,
  sessionId: "session-id",
  messageId: "message-id"
}
```

### Performance Benchmarks
During testing, monitor and record:

- **Response Time**: < 30 seconds for complex requests
- **Memory Usage**: Should not spike excessively during chunking
- **Database Performance**: Query times should be reasonable
- **Token Consumption**: Should be proportional to request complexity
- **Error Rate**: Should be < 1% for valid requests

### Browser Console Monitoring
Watch for these types of logs during testing:

```javascript
// Good logs to see:
"Chat message sent successfully"
"Response received and processed"
"Chunked response: 3 chunks stored"
"Memory summary updated"
"Context loaded from previous session"

// Error logs to investigate:
"Failed to store chat chunk"
"Memory summarization failed"
"Token calculation error"
"Database operation failed"
```

---

## Automated Testing Setup

### Optional: Create Test Automation Script

If you want to automate some of these tests, here's a basic JavaScript test framework you could implement:

```javascript
// test-automation.js
class AskMeAITester {
  constructor(baseUrl, testUserEmail) {
    this.baseUrl = baseUrl;
    this.testUserEmail = testUserEmail;
    this.testResults = [];
  }

  async sendMessage(message, expectedChecks = []) {
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/gptRouter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.testUserEmail,
          message: message
        })
      });
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      // Perform checks
      const results = {
        message: message.substring(0, 50) + '...',
        success: data.success,
        responseTime: responseTime,
        chunked: data.chunked,
        tokensUsed: data.tokensUsed,
        checks: expectedChecks.map(check => check(data))
      };
      
      this.testResults.push(results);
      return results;
    } catch (error) {
      console.error('Test failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Add more automated test methods here
}

// Usage example:
const tester = new AskMeAITester('http://localhost:3000', 'deeshop9821@gmail.com');
// Run automated tests...
```

---

## Final Validation Checklist

### ✅ Core Functionality
- [ ] All message types process correctly
- [ ] Context is maintained across conversations
- [ ] Chunking works for long responses
- [ ] Memory summarization triggers appropriately
- [ ] Coach profiles apply consistently
- [ ] Token management works correctly

### ✅ Database Integrity
- [ ] Messages stored correctly in `chat_messages`
- [ ] Chunks stored correctly in `chat_chunks`
- [ ] Memory summaries updated in `user_profiles`
- [ ] User activity tracked in `users` table
- [ ] No orphaned records or foreign key violations

### ✅ Error Handling
- [ ] Invalid inputs handled gracefully
- [ ] Network errors don't crash the system
- [ ] Database errors are caught and reported
- [ ] Token exhaustion handled properly
- [ ] Rate limiting works if implemented

### ✅ Performance
- [ ] Response times meet expectations
- [ ] Memory usage remains stable
- [ ] Database queries are efficient
- [ ] Concurrent users handled properly

### ✅ User Experience
- [ ] Chat interface is responsive
- [ ] Chunked responses display well
- [ ] Error messages are user-friendly
- [ ] Token balance is visible and accurate
- [ ] Coach personality is evident and consistent

---

*This expanded test suite provides comprehensive coverage of your AskMe AI system. Execute these tests systematically to ensure all components are working correctly and the user experience is smooth and reliable.*
