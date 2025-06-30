## AskMe AI Token Optimization Analysis & Improvement Recommendations

## 🔍 Current Token Usage Algorithm Analysis

### **Current Token Consumption: ~2000 tokens per message**

### 📊 **Current Algorithm Components**

#### 1. **Conversation History Loading**
```javascript
// CURRENT: Loads up to 15 messages from database
const { data: chat_history } = await supabase
  .from('chat_messages')
  .select('role, content')
  .eq('user_id', user_id)
  .order('created_at', { ascending: true })
  .limit(15);  // 🔴 HIGH TOKEN USAGE

// Then adds up to 8-10 messages to prompt
const maxMessages = is_first_message ? 4 : (memory_summary ? 8 : 10);
```

#### 2. **Context Building Strategy**
```javascript
// Memory summary (up to 400 chars)
context_message = `Previous context: ${memory_summary.substring(0, 400)}`;

// User goals and challenges added separately
// System prompts (coach-specific or default)
// Chat history (8-10 full messages)
```

#### 3. **Model Selection**
- **GPT-4-Turbo**: Complex queries, first messages
- **GPT-3.5-Turbo**: Simple requests, initialized users
- **Max tokens**: 2000 (GPT-4) / 1500 (GPT-3.5)

#### 4. **Token Estimation Logic**
```javascript
// Input token calculation includes:
// - System prompt (~200-500 tokens)
// - Context message (~100-200 tokens) 
// - Memory summary (~100-150 tokens)
// - 8-10 chat messages (~800-1200 tokens)
// - Current user message (~50-200 tokens)
// Total Input: ~1250-2050 tokens per request
```

---

## ⚠️ **ROOT CAUSES OF HIGH TOKEN USAGE**

### 1. **Excessive Chat History**
- **Problem**: Loading 8-10 full messages (up to 500 chars each)
- **Impact**: ~800-1200 tokens just for history
- **Token Cost**: 60-80% of total input tokens

### 2. **Redundant Context Layering**
- **Problem**: Memory summary + full chat history + goals/challenges
- **Impact**: Information overlap and redundancy
- **Token Cost**: ~200-400 tokens of duplicate information

### 3. **Inefficient Memory Summarization**
- **Problem**: Memory summarization happens too infrequently
- **Impact**: Relies on raw chat history instead of compressed summaries
- **Token Cost**: 500-800 tokens that could be 50-100 tokens

### 4. **Unoptimized System Prompts**
- **Problem**: Long, verbose coach-specific prompts
- **Impact**: 200-500 tokens for system instructions
- **Token Cost**: Could be reduced by 50-70%

---

## 🚀 **OPTIMIZATION RECOMMENDATIONS**

### **TARGET: Reduce token usage from ~2000 to ~600-800 tokens per message**

### 🏆 **Priority 1: Smart Chat History Management**

#### A. **Implement Sliding Window with Summarization**
```javascript
// IMPROVED ALGORITHM
async function getOptimizedChatHistory(user_id, current_message) {
  // Keep only last 3-4 messages for immediate context
  const recentMessages = await getLastNMessages(user_id, 4);
  
  // For older context, use compressed summaries
  const olderContext = await getCompressedContext(user_id, 10); // 10 older messages → summary
  
  return {
    recent: recentMessages,        // ~200-400 tokens
    compressed: olderContext,      // ~50-100 tokens
    total_tokens: 250-500         // vs current 800-1200
  };
}
```

#### B. **Message Relevance Scoring**
```javascript
// Only include highly relevant historical messages
function scoreMessageRelevance(message, currentQuery) {
  const relevanceScore = 
    topicSimilarity(message.content, currentQuery) * 0.4 +
    recencyScore(message.created_at) * 0.3 +
    lengthImportance(message.content) * 0.3;
  
  return relevanceScore > 0.6; // Only include relevant messages
}
```

### 🏆 **Priority 2: Enhanced Memory Compression**

#### A. **Frequent Micro-Summarization**
```javascript
// CURRENT: Summarize every 8-10 messages
// IMPROVED: Summarize every 3-4 messages
async function triggerMicroSummarization(user_id, messageCount) {
  if (messageCount % 3 === 0) {  // Every 3 messages instead of 8-10
    await updateMemorySummary(user_id, 'incremental');
  }
}
```

#### B. **Hierarchical Memory Structure**
```javascript
// Multi-layer memory system
const memoryStructure = {
  immediate: last3Messages,      // ~150-300 tokens
  recent: last10MessagesSummary, // ~100 tokens  
  session: currentSessionSummary, // ~50 tokens
  longTerm: userPersonalitySummary // ~50 tokens
  // Total: ~350-500 tokens vs current ~800-1200
};
```

### 🏆 **Priority 3: Prompt Optimization**

#### A. **Compressed System Prompts**
```javascript
// CURRENT: 200-500 token system prompts
// IMPROVED: 50-150 token focused prompts
const optimizedPrompts = {
  concise: "You are Sarah's mental health coach. Be supportive, ask follow-up questions.", // ~20 tokens
  focused: "Coach for anxiety/depression. Reference: [compressed_context]", // ~30 tokens
  adaptive: dynamicPromptBasedOnContext(user_profile) // 50-100 tokens
};
```

#### B. **Context-Aware Prompt Selection**
```javascript
function selectOptimalPrompt(messageType, contextSize, userState) {
  if (messageType === 'greeting') return prompts.minimal;
  if (contextSize > 500) return prompts.ultra_concise;
  if (userState === 'crisis') return prompts.focused_support;
  return prompts.balanced;
}
```

### 🏆 **Priority 4: Smart Model Selection**

#### A. **Token-Aware Model Routing**
```javascript
function selectModelByTokenBudget(estimatedTokens, complexity) {
  if (estimatedTokens < 400 && complexity === 'low') return 'gpt-3.5-turbo';
  if (estimatedTokens < 800 && complexity === 'medium') return 'gpt-3.5-turbo';
  return 'gpt-4-turbo'; // Only for high complexity + high token scenarios
}
```

#### B. **Response Length Optimization**
```javascript
// Adjust max_tokens based on query complexity
const dynamicMaxTokens = {
  greeting: 150,
  followUp: 200, 
  advice: 400,
  crisis: 600,
  complex: 800
};
```

---

## 🛠️ **IMPLEMENTATION PLAN**

### **Phase 1: Quick Wins (30-40% reduction)**
1. ✅ **Reduce chat history from 8-10 to 3-4 messages**
2. ✅ **Compress memory summaries more frequently (every 3 vs 8 messages)**
3. ✅ **Implement concise system prompts (50% reduction)**

### **Phase 2: Smart Context (50-60% reduction)**
1. 🔄 **Implement relevance scoring for historical messages**
2. 🔄 **Add hierarchical memory structure**
3. 🔄 **Context-aware prompt selection**

### **Phase 3: Advanced Optimization (70-80% reduction)**
1. 🚀 **Implement semantic similarity for context selection**
2. 🚀 **Dynamic response length based on query type**
3. 🚀 **Predictive token budgeting**

---

## 📊 **EXPECTED RESULTS**

### **Before Optimization**
- Average tokens per message: ~2000
- Input tokens: ~1250-1750
- Output tokens: ~500-750
- Cost per conversation turn: High

### **After Phase 1 (Quick Wins)**
- Average tokens per message: ~1200-1400
- Input tokens: ~800-1000  
- Output tokens: ~400-500
- **40% token reduction**

### **After Phase 2 (Smart Context)**
- Average tokens per message: ~800-1000
- Input tokens: ~500-700
- Output tokens: ~300-400
- **60% token reduction**

### **After Phase 3 (Advanced)**
- Average tokens per message: ~600-800
- Input tokens: ~400-500
- Output tokens: ~200-300
- **70-80% token reduction**

---

## 🎯 **IMMEDIATE ACTION ITEMS**

### **1. Update Chat History Limit**
```javascript
// In getPromptAndModel function
const maxMessages = is_first_message ? 2 : 4; // Reduced from 4:10
```

### **2. Implement Frequent Memory Updates**
```javascript
// In main chat handler
if (messageCount % 3 === 0) {
  await updateMemorySummary(user_id, false);
}
```

### **3. Create Concise Prompt Variants**
```javascript
const concisePrompts = {
  init: "You are {firstName}'s supportive mental health coach.",
  ongoing: "Continue as {firstName}'s coach. Context: {compressed_memory}",
  crisis: "Provide immediate support to {firstName}."
};
```

These optimizations should reduce your token usage from ~2000 per message to ~600-800 per message, a **60-70% improvement** while maintaining conversation quality and context retention.
