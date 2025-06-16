# AskMe AI - Wellness Coaching Chat Application

## 🎯 Overview

AskMe AI is a sophisticated wellness coaching chat application designed specifically for men 45+ that provides personalized, therapy-like conversations through AI-powered coaching. The system combines intelligent conversation management, comprehensive user profiling, and adaptive memory systems to deliver meaningful wellness support.

## 🏗️ Core Architecture

### **Technology Stack**
- **Frontend**: Next.js (React 19.1.0)
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-3.5-turbo / GPT-4
- **Authentication**: Supabase Auth
- **Styling**: Bootstrap 5.3.6 with custom CSS modules
- **Deployment**: Vercel-ready configuration

### **Key Design Principles**
- **Therapy-like Conversations**: AI asks thoughtful questions rather than giving direct advice
- **Personalization**: Comprehensive user profiling with coach matching
- **Memory Continuity**: Advanced memory summarization for consistent conversations
- **Token Efficiency**: Optimized prompt management and context handling

## 🧠 Main Features & Logic

### **1. Intelligent Coach Matching System**

#### **Coach Profiles**
```sql
coach_profiles (
  id, code, label, system_prompt, 
  medium_prompt, short_prompt, brand_theme
)
```

- **Multiple Coach Personalities**: Different coaching styles and approaches
- **Custom Prompts**: Each coach has unique conversation templates
- **Automatic Assignment**: Algorithm matches users to optimal coaches based on:
  - Selected wellness goals
  - Personal challenges
  - Demographics (age, background)
  - Conversation preferences

#### **Matching Algorithm Logic**
```javascript
// Assigns coach based on user profile and preferences
const assignedCoach = assignCoachBasedOnProfile(
  selectedGoalIds, 
  selectedChallengeIds, 
  userAge, 
  demographics
);
```

### **2. Comprehensive User Profiling**

#### **Multi-Dimensional User Data**
```sql
users (
  id, email, coach_profile_id, tokens, 
  first_name, age, sex, ethnicity, city, country
)

user_profiles (
  user_id, memory_summary, last_activity, 
  created_at, updated_at
)
```

#### **Wellness Goals & Challenges**
- **Structured Goal System**: Predefined wellness categories
- **Custom Goals**: Users can add personal objectives
- **Challenge Tracking**: Current life difficulties and obstacles
- **Progress Monitoring**: Quantified progress tracking per goal

#### **Goal Categories**
- Energy & Vitality
- Sleep Quality
- Stress Management
- Relationship Health
- Career Satisfaction
- Physical Fitness
- Mental Clarity

### **3. Advanced Memory Management System**

#### **Intelligent Memory Summarization**
The system maintains conversation continuity through sophisticated memory management:

```javascript
// Memory update triggers (6 different scenarios)
const shouldUpdateMemory = 
  totalMessages % 6 === 0 ||                   // Periodic updates
  !profile.last_memory_summary ||              // First conversation
  recentSubstantialCount % 4 === 0 ||          // Quality-based
  timeTrigger ||                               // 24+ hour inactivity
  breakthroughTrigger ||                       // Insight detection
  topicShiftTrigger;                           // Topic change detection
```

#### **Memory Update Triggers**
1. **Periodic Updates**: Every 6 messages
2. **Quality-Based**: Every 4 substantial messages (filters out "yes"/"ok")
3. **Time-Based**: 24+ hours since last update
4. **Breakthrough Detection**: Keywords indicating insights ("realize", "understand")
5. **Topic Shift Detection**: Conversation theme changes (work → relationships)
6. **Session Timeout**: 30-minute inactivity threshold

#### **Memory Structure**
```
Name, Current Focus, Key Insights, Communication Style, 
Goals/Challenges, Recent Developments, Next Areas to Explore
```

### **4. Conversation Intelligence**

#### **Adaptive Prompt System**
```javascript
// Dynamic prompt selection based on conversation context
const prompts = {
  full: "Deep, comprehensive coaching prompt (800+ tokens)",
  medium: "Balanced exploration prompt (400-600 tokens)", 
  short: "Focused, direct prompt (200-400 tokens)",
  init: "Personalized greeting with memory recall"
};
```

#### **Context-Aware Responses**
- **Memory Integration**: References past conversations naturally
- **Goal Awareness**: Incorporates current wellness objectives
- **Challenge Recognition**: Acknowledges ongoing difficulties
- **Progress Tracking**: Celebrates achievements and growth

#### **Conversation Flow Logic**
```javascript
// Intelligent conversation management
if (is_init_message && memory_summary) {
  // Load previous context and greet by name
  context_message = `Previous context: ${memory_summary}`;
} else if (hasGoals || hasChallenges) {
  // Emphasize current wellness focus
  context_message = `Current Goals: ${goalLabels}`;
}
```

### **5. Token Economy & Optimization**

#### **Smart Token Management**
- **Welcome Tokens**: 20 tokens for new users
- **Consumption Tracking**: Real-time token deduction
- **Cost Estimation**: Pre-message token cost preview
- **Context Optimization**: Configurable message history (3-10 messages)

#### **Token Efficiency Features**
```javascript
// Optimized prompt construction
const getPromptAndModel = (user_message, profile, chat_history) => {
  // Smart model selection based on complexity
  const model = isSimpleRequest(user_message) ? 'gpt-3.5-turbo' : 'gpt-4';
  
  // Minimal context for cost efficiency
  const maxMessages = memory_summary ? 3 : 4;
  
  // Compressed message history
  const truncatedHistory = chat_history.slice(-maxMessages);
};
```

### **6. Session & Activity Tracking**

#### **Smart Session Management**
```javascript
// Session timeout detection
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Automatic session-end memory updates
if (timeSinceActivity > SESSION_TIMEOUT) {
  await updateMemorySummary(user_id, true); // Comprehensive update
}
```

#### **Activity Monitoring**
- **Last Activity Tracking**: Database timestamp updates
- **Inactivity Detection**: Automatic session boundary detection
- **Browser Close Handling**: Graceful session end management

### **7. Topic & Emotion Intelligence**

#### **Topic Shift Detection**
```javascript
// Sophisticated topic analysis
const topicKeywords = {
  work: ['career', 'job', 'office', 'boss', 'deadline'],
  relationships: ['partner', 'family', 'dating', 'marriage'],
  health: ['stress', 'anxiety', 'exercise', 'sleep'],
  // ... 8 major life categories
};

// Trigger memory update on significant topic changes
if (topicSimilarity < 0.3) { // 70% different = topic shift
  await updateMemorySummary(user_id, false);
}
```

#### **Breakthrough Moment Recognition**
```javascript
// Emotional breakthrough detection
const breakthroughKeywords = [
  'realize', 'understand', 'breakthrough', 'clarity', 
  'insight', 'epiphany', 'aha', 'figured out'
];

// Immediate memory capture for therapeutic moments
if (hasBreakthroughKeywords(message)) {
  await updateMemorySummary(user_id, true); // Comprehensive update
}
```

## 📊 Data Flow & User Journey

### **1. User Onboarding**
```
Email Signup → Profile Creation → Goal Selection → 
Challenge Identification → Coach Assignment → Dashboard
```

### **2. Coach Assignment Logic**
```javascript
// Multi-factor coach matching
const coachScore = calculateCoachScore({
  userGoals: selectedGoalIds,
  userChallenges: selectedChallengeIds,
  userAge: age,
  coachSpecialties: coach.specialties
});

// Assign optimal coach
const assignedCoach = coaches.reduce((best, current) => 
  coachScore(current) > coachScore(best) ? current : best
);
```

### **3. Conversation Lifecycle**
```
Chat Initialization → Memory Context Loading → 
Personalized Greeting → Conversation Flow → 
Memory Updates → Session Management
```

### **4. Memory Evolution**
```
Initial Summary (first conversation) → 
Incremental Updates (new insights) → 
Topic Integration (theme changes) → 
Breakthrough Capture (key moments) → 
Historical Context (long-term patterns)
```

## 🎛️ Key Configuration

### **Conversation Parameters**
```javascript
const CONFIG = {
  // Memory triggers
  PERIODIC_UPDATE_INTERVAL: 6,        // messages
  QUALITY_UPDATE_THRESHOLD: 4,        // substantial messages
  TIME_UPDATE_THRESHOLD: 24,          // hours
  SESSION_TIMEOUT: 30,                // minutes
  
  // Token optimization
  DEFAULT_CONTEXT_LENGTH: 5,          // message history
  MIN_TOKENS_REQUIRED: 50,            // for responses
  WELCOME_TOKENS: 20,                 // new user bonus
  
  // Memory management
  SUMMARY_MAX_LENGTH: 250,            // words
  TOPIC_SHIFT_THRESHOLD: 0.3,         // similarity score
  MESSAGE_CLEANUP_KEEP: 15            // recent messages
};
```

### **Coach Prompt Templates**
Each coach has customized prompts for different conversation depths:
- **Full Prompt**: Comprehensive coaching (800+ tokens)
- **Medium Prompt**: Balanced exploration (400-600 tokens)
- **Short Prompt**: Focused interaction (200-400 tokens)

## 🔧 API Endpoints

### **Main Chat API**: `/api/gptRouter`
```javascript
// POST: Send chat message
{
  email: "user@example.com",
  message: "How can I manage stress better?",
  isFirstMessage: false
}

// GET: Fetch user data
?email=user@example.com

// GET: Force memory refresh
?email=user@example.com&action=refresh_memory

// GET: End session
?email=user@example.com&action=end_session
```

### **Response Format**
```javascript
{
  response: "AI coach response text",
  tokensUsed: 45,
  tokenBreakdown: {
    input: 25,
    output: 20
  },
  memoryUpdated: true
}
```

## 🎨 User Interface Components

### **Chat Interface** (`ChatBox.js`)
- **Real-time Messaging**: Instant AI responses
- **Token Display**: Live token consumption tracking
- **Context Controls**: Adjustable conversation history
- **Memory Status**: Visual memory update indicators
- **Responsive Design**: Mobile-optimized layout

### **Dashboard** (`dashboard.js`)
- **Wellness Progress**: Goal tracking and visualization
- **Action Plans**: Personalized task management
- **Token Balance**: Purchase and usage monitoring
- **Quick Chat Access**: Direct link to coaching

### **Profile Setup** (`auth/callback.js`)
- **Multi-step Onboarding**: Progressive information collection
- **Goal Selection**: Visual wellness objective picker
- **Challenge Assessment**: Personal difficulty identification
- **Coach Matching**: Automatic optimal assignment

## 🔄 Background Processes

### **Automatic Memory Updates**
- **Message-triggered**: Every 6 messages or 4 substantial messages
- **Time-triggered**: Daily memory refresh for inactive users
- **Event-triggered**: Breakthrough moments and topic shifts
- **Session-triggered**: Conversation end detection

### **Database Cleanup**
- **Chat History**: Aggressive cleanup after memory summarization
- **Keep Recent**: Maintains 15 most recent messages
- **Storage Optimization**: Prevents database bloat

### **Token Management**
- **Usage Tracking**: Real-time deduction and logging
- **Cost Estimation**: Pre-message token cost calculation
- **Insufficient Balance**: Graceful degradation and user notification

## 🚀 Performance Optimizations

### **Memory Efficiency**
- **Incremental Updates**: Builds on existing memory rather than replacing
- **Context Compression**: Intelligent message truncation
- **Smart Caching**: Response caching with TTL

### **Database Optimization**
- **Indexed Queries**: Efficient user and message lookups
- **Minimal Selects**: Only fetch required columns
- **Batch Operations**: Group related database operations

### **AI Cost Management**
- **Model Selection**: GPT-3.5-turbo for simple requests, GPT-4 for complex
- **Prompt Optimization**: Minimal token usage while maintaining quality
- **Context Limiting**: Configurable history depth

## 📈 Key Metrics & Monitoring

### **User Engagement**
- **Session Duration**: Average conversation length
- **Message Frequency**: User interaction patterns
- **Goal Progress**: Wellness objective advancement
- **Retention Rate**: Long-term user engagement

### **System Performance**
- **Memory Update Success**: Successful summarization rate
- **Token Efficiency**: Average tokens per conversation
- **Response Time**: AI response latency
- **Error Rates**: System failure monitoring

### **Conversation Quality**
- **Breakthrough Detection**: Key insight identification
- **Topic Coverage**: Conversation theme diversity
- **Personalization Score**: Memory integration effectiveness
- **User Satisfaction**: Implicit feedback indicators

---

**AskMe AI represents a breakthrough in personalized wellness coaching, combining advanced AI conversation management with sophisticated user profiling to deliver therapy-like support that adapts and grows with each user's wellness journey.**
