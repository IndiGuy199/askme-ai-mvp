# test_TOKEN_OPTIMIZATION_ANALYSIS.md

## Test Suite: Token Optimization Analysis

### 1. Chat History Limit Test
**Test:** Only 3-4 recent messages are included in the prompt.
- Setup: Simulate chat history with 10 messages.
- Action: Call `getOptimizedChatHistory(user_id, current_message)`.
- Assert: `recent.length === 4`.

### 2. Memory Summary Update Frequency Test
**Test:** Memory summary updates every 3 messages.
- Setup: Simulate messageCount increments.
- Action: Call `triggerMicroSummarization(user_id, messageCount)` for messageCount = 3, 6, 9.
- Assert: `updateMemorySummary` is called at each interval.

### 3. Hierarchical Memory Structure Test
**Test:** All memory layers are present.
- Setup: Simulate memory structure with immediate, recent, session, longTerm.
- Action: Retrieve `memoryStructure`.
- Assert: All keys (`immediate`, `recent`, `session`, `longTerm`) exist.

### 4. Message Relevance Scoring Test
**Test:** Only relevant messages are included.
- Setup: Create messages with varying topic similarity and recency.
- Action: Call `scoreMessageRelevance(message, currentQuery)`.
- Assert: Only messages with `relevanceScore > 0.6` are included.

### 5. Concise System Prompt Test
**Test:** System prompts are concise (<150 tokens).
- Setup: Generate prompts using `optimizedPrompts`.
- Action: Measure token count of each prompt.
- Assert: Each prompt is <150 tokens.

### 6. Model Selection Test
**Test:** Model selection matches token budget and complexity.
- Setup: Provide estimatedTokens and complexity.
- Action: Call `selectModelByTokenBudget(estimatedTokens, complexity)`.
- Assert: Returns correct model (`gpt-3.5-turbo` or `gpt-4-turbo`).

### 7. Dynamic Response Length Test
**Test:** Response length matches query type.
- Setup: Provide query types (`greeting`, `advice`, `crisis`, etc.).
- Action: Retrieve `dynamicMaxTokens[queryType]`.
- Assert: Value matches expected token count.

### 8. Token Usage Reduction Test
**Test:** Token usage is reduced after optimizations.
- Setup: Compare token usage before and after optimization.
- Action: Simulate prompt construction for both cases.
- Assert: Optimized token usage is <= 800 per message.

---