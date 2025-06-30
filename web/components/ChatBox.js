import React, { useState, useRef, useEffect } from 'react'
import styles from '../styles/Chat.module.css'
import ReactMarkdown from 'react-markdown'

export default function ChatBox({ userEmail, onTokenUsed, onEstimateCost, estimateTokens }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(true) // Start with loading state
  const [showWarning, setShowWarning] = useState(false)
  const [userData, setUserData] = useState(null)
  const [savingFavorite, setSavingFavorite] = useState(null) // Track which message is being saved
  const [savedFavorites, setSavedFavorites] = useState(new Set()) // Track which messages have been saved
  const [chatInitialized, setChatInitialized] = useState(false) // Track if chat has been initialized
  const [chatRestored, setChatRestored] = useState(false) // Track if chat was restored from storage
  const bottomRef = useRef(null)

  // Generate session storage key for this user's chat
  const getChatStorageKey = () => `askme_chat_${userEmail}`

  // Save chat state to sessionStorage
  const saveChatState = (chatMessages) => {
    if (!userEmail || chatMessages.length === 0) return
    
    try {
      const chatState = {
        messages: chatMessages,
        timestamp: Date.now(),
        userEmail: userEmail
      }
      sessionStorage.setItem(getChatStorageKey(), JSON.stringify(chatState))
      console.log('Chat state saved to sessionStorage')
    } catch (error) {
      console.error('Error saving chat state:', error)
    }
  }

  // Load chat state from sessionStorage
  const loadChatState = () => {
    if (!userEmail) return null
    
    try {
      const stored = sessionStorage.getItem(getChatStorageKey())
      if (!stored) return null
      
      const chatState = JSON.parse(stored)
      
      // Check if the stored chat is recent (within 24 hours) and for the same user
      const isRecent = (Date.now() - chatState.timestamp) < (24 * 60 * 60 * 1000)
      const isSameUser = chatState.userEmail === userEmail
      
      if (isRecent && isSameUser && chatState.messages?.length > 0) {
        console.log('Restored chat state from sessionStorage:', chatState.messages.length, 'messages')
        return chatState.messages
      }
    } catch (error) {
      console.error('Error loading chat state:', error)
    }
    
    return null
  }

  // Clear chat state from sessionStorage
  const clearChatState = () => {
    if (!userEmail) return
    try {
      sessionStorage.removeItem(getChatStorageKey())
      console.log('Chat state cleared from sessionStorage')
    } catch (error) {
      console.error('Error clearing chat state:', error)
    }
  }  // Fetch user data and initialize chat on component mount
  useEffect(() => {
    async function initializeChat() {
      if (!userEmail) return
      
      try {
        // Set a timeout for the entire initialization process
        const initTimeout = setTimeout(() => {
          console.warn('Chat initialization taking too long, showing fallback')
          setMessages([{
            role: 'assistant',
            content: 'Hello! Welcome to AskMe AI. How can I help you today?',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tokensUsed: 0
          }])
          setChatInitialized(true)
          setIsLoading(false)
        }, 15000) // 15 second timeout
        
        // First try to restore previous chat state
        const restoredMessages = loadChatState()
        if (restoredMessages && restoredMessages.length > 0) {
          console.log('Restoring previous chat session with', restoredMessages.length, 'messages')
          setMessages(restoredMessages)
          setChatInitialized(true)
          setChatRestored(true) // Mark that chat was restored
          setIsLoading(false)
          clearTimeout(initTimeout)
          return
        }

        // If no previous chat state, fetch user data and start fresh
        console.log('No previous chat state found, initializing new chat')
        const userRes = await fetch(`/api/gptRouter?email=${encodeURIComponent(userEmail)}`)
        const userData = await userRes.json()
        
        if (userRes.ok && userData) {
          setUserData(userData)
          
          // Create personalized greeting with memory recall
          await sendInitialGreeting(userData)
          setChatInitialized(true)
        } else {
          throw new Error('Failed to fetch user data')
        }
        
        clearTimeout(initTimeout)
      } catch (err) {
        console.error('Error initializing chat:', err)
        setMessages([{
          role: 'assistant',
          content: 'Hello! Welcome to AskMe AI. How can I help you today?',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tokensUsed: 0
        }])
        setChatInitialized(true)
        setIsLoading(false)
      }
    }
    
    if (!chatInitialized) {
      initializeChat()
    }
  }, [userEmail, chatInitialized])// Send an API request for the initial greeting to load memory context
  const sendInitialGreeting = async (userData) => {
    try {
      console.log('Sending initial greeting to load memory context');
      
      // First, check if user has a memory summary
      let hasMemory = false;
      try {
        // Make a direct check to see if memory exists and is non-empty
        const memCheckRes = await fetch(`/api/gptRouter?email=${encodeURIComponent(userEmail)}&action=refresh_memory`);
        const memData = await memCheckRes.json();
        
        if (memCheckRes.ok && memData) {
          hasMemory = memData.summary_length > 0;
          console.log(`Memory check: User ${hasMemory ? 'has' : 'does not have'} memory (${memData.summary_length || 0} chars)`);
          
          if (!hasMemory && memData.profile_status) {
            console.log('Profile status:', memData.profile_status);
          }
        }
      } catch (memCheckErr) {
        console.error('Error checking memory status:', memCheckErr);
      }
        // Send special startup message to trigger memory context
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const res = await fetch('/api/gptRouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          message: "__INIT_CHAT__", // Special command to initialize chat
          isFirstMessage: true
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      const responseText = await res.text()
      let data
      
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('Error parsing greeting response:', parseError);
        console.log('Raw response:', responseText);
        if (res.ok) {
          data = { response: responseText }
        } else {
          throw new Error(responseText || `Server error (${res.status})`)
        }
      }

      if (res.ok && (data.response || data.message)) {
        console.log('Got initial greeting response:', data.response || data.message);
        console.log('Token usage:', data.tokensUsed || data.tokens || 1);
        
        setMessages([{
          role: 'assistant',
          content: data.response || data.message,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tokensUsed: data.tokensUsed || data.tokens || 1,
          tokenBreakdown: data.tokenBreakdown,
          // Add chunking support for initialization messages too
          isPartial: data.isPartial || false,
          totalChunks: data.totalChunks,
          currentChunk: data.currentChunk || 1,
          conversationId: data.conversationId,
          nextChunkToken: data.nextChunkToken,
          previewNext: data.previewNext
        }])
        
        if (onTokenUsed) {
          onTokenUsed(data.tokensUsed || data.tokens || 1)
        }
      } else {
        // If no valid response, show fallback
        throw new Error('No valid response from API')
      }
    } catch (err) {
      console.error('Error sending initial greeting:', err)
      // Fallback message
      setMessages([{
        role: 'assistant',
        content: `Hello${userData?.firstName ? `, ${userData.firstName}` : ''}! Welcome back to AskMe AI. How can I help you today?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tokensUsed: 0
      }])
    } finally {
      // Always clear loading state
      setIsLoading(false)
    }
  }
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end',
        inline: 'nearest'
      })
    }
  }, [messages])
  
  // Estimate cost when input changes
  useEffect(() => {
    if (input && estimateTokens) {
      // Get full token estimation including system prompt and expected output
      const estimated = estimateTokens(input)
      onEstimateCost?.(estimated)
      
      // Show warning if estimate is high (adjusted threshold for full estimation)
      setShowWarning(estimated > 200)
    } else {
      onEstimateCost?.(0)
      setShowWarning(false)
    }
  }, [input, estimateTokens, onEstimateCost])
  // Handle continuing chunked responses
  const handleContinue = async (conversationId, currentChunk) => {
    if (isLoading) return
    
    setIsLoading(true)
    
    try {
      const res = await fetch('/api/chat-continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          chunkNumber: currentChunk + 1,
          email: userEmail
        })
      })

      const data = await res.json()

      if (res.ok && data.message) {
        // Find the message to update and append the new chunk
        setMessages(prev => prev.map(msg => {
          if (msg.conversationId === conversationId) {
            return {
              ...msg,
              content: msg.content + '\n\n' + data.message,
              isPartial: data.isPartial,
              currentChunk: data.currentChunk,
              nextChunkToken: data.nextChunkToken,
              previewNext: data.previewNext
            }
          }
          return msg
        }))
        
        console.log(`Loaded chunk ${data.currentChunk} of ${data.totalChunks}`)
      } else {
        console.error('Error continuing conversation:', data.error)
        // Show error message
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Error loading more content: ${data.error}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tokensUsed: 0,
          error: true
        }])
      }
    } catch (err) {
      console.error('Error in handleContinue:', err)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error loading more content: ${err.message}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tokensUsed: 0,
        error: true
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    const userMessage = { 
      role: 'user', 
      content: input, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tokensUsed: 0
    }
    
    setMessages(prev => [...prev, userMessage])
    const currentInput = input
    setInput('')
    setIsLoading(true)

    try {
      // Send ONLY the current message to avoid charging for conversation history
      const requestBody = {
        email: userEmail,
        message: currentInput,
        // Don't send conversation history to avoid token charges
        messages: [
          {
            role: 'user',
            content: currentInput
          }
        ]
      }

      const res = await fetch('/api/gptRouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const responseText = await res.text()
      
      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        if (res.ok) {
          data = { response: responseText }
        } else {
          throw new Error(responseText || `Server error (${res.status})`)
        }
      }      if (res.ok && (data.response || data.message)) {
        console.log('📦 CHATBOX DEBUG: Got response from API:', {
          hasResponse: !!data.response,
          isPartial: data.isPartial,
          totalChunks: data.totalChunks,
          currentChunk: data.currentChunk,
          conversationId: data.conversationId,
          nextChunkToken: data.nextChunkToken,
          responseLength: (data.response || data.message || '').length
        });
        
        const assistantMessage = {
          role: 'assistant',
          content: data.response || data.message,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tokensUsed: data.tokensUsed || data.tokens || 1,
          tokenBreakdown: data.tokenBreakdown,
          // Add chunking support
          isPartial: data.isPartial || false,
          totalChunks: data.totalChunks,
          currentChunk: data.currentChunk || 1,
          conversationId: data.conversationId,
          nextChunkToken: data.nextChunkToken,
          previewNext: data.previewNext
        }
        
        console.log('📦 CHATBOX DEBUG: Created assistant message:', {
          isPartial: assistantMessage.isPartial,
          totalChunks: assistantMessage.totalChunks,
          currentChunk: assistantMessage.currentChunk,
          conversationId: assistantMessage.conversationId,
          contentLength: assistantMessage.content.length
        });
        
        setMessages(prev => [...prev, assistantMessage])
        
        if (onTokenUsed) {
          onTokenUsed(data.tokensUsed || data.tokens || 1)
        }
        
        // Check if memory update is needed after receiving a response
        setTimeout(() => checkMemoryStatus(), 1000);
      } else {
        let errorMessage = 'Sorry, there was an error processing your message.'
        
        if (res.status === 403 && data && data.error === 'Insufficient tokens') {
          errorMessage = `⚠️ Insufficient tokens! This conversation needs ${data.required} tokens, but you only have ${data.available}. Please buy more tokens to continue.`
        } else if (data && data.error) {
          errorMessage = `Error: ${data.error}`
        } else {
          errorMessage = `Server error (${res.status}): ${responseText}`
        }
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: errorMessage,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tokensUsed: 0,
          error: true
        }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tokensUsed: 0,
        error: true
      }])
    } finally {
      setIsLoading(false)
    }
  }
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const clearContext = () => {
    setMessages([])
    onEstimateCost?.(0)
    clearChatState() // Clear stored chat state
    setChatInitialized(false) // Reset initialization flag to trigger fresh greeting
    setChatRestored(false) // Reset restored flag
  }
  // Function to check memory status and force update if necessary
  const checkMemoryStatus = async () => {
    if (!userEmail) return;
    try {
      console.log('Checking memory status for user:', userEmail);
        // Check if messages exceed threshold that should trigger memory summarization
      if (messages.length > 0 && messages.length % 6 === 0) { // Changed from 4 to 6 to match backend
        console.log(`Message count (${messages.length}) is at summarization threshold, checking memory status...`);
        
        // Check if there's an existing memory summary
        const userRes = await fetch(`/api/gptRouter?email=${encodeURIComponent(userEmail)}`);
        const userData = await userRes.json();
        
        // This endpoint will return memory summary details
        try {
          const memoryRes = await fetch(`/api/gptRouter?email=${encodeURIComponent(userEmail)}&action=refresh_memory`);
          const memoryData = await memoryRes.json();
          
          if (memoryRes.ok) {
            console.log('Memory refresh triggered successfully', memoryData);
            
            if (memoryData && memoryData.summary_length) {
              console.log(`Memory summary updated, new length: ${memoryData.summary_length}`);
              console.log('Preview:', memoryData.summary_preview);
            } else {
              console.warn('Memory refresh completed but returned no summary length information');
            }
            
            // Check the profile status
            if (memoryData && memoryData.profile_status) {
              console.log('Profile status:', memoryData.profile_status);
              
              // If memory is still empty after update, try one more time
              if (memoryData.profile_status.includes('memory_summary is empty')) {
                console.warn('Memory is still empty after update, trying one more time...');
                
                setTimeout(async () => {
                  try {
                    const retryRes = await fetch(`/api/gptRouter?email=${encodeURIComponent(userEmail)}&action=refresh_memory`);
                    const retryData = await retryRes.json();
                    console.log('Retry result:', retryData);
                  } catch (retryErr) {
                    console.error('Error in memory retry:', retryErr);
                  }
                }, 2000);
              }
            }
          } else {
            console.error('Failed to trigger memory refresh:', memoryData);
          }
        } catch (memoryErr) {
          console.error('Error checking memory status:', memoryErr);
        }
      }
    } catch (err) {
      console.error('Error in checkMemoryStatus:', err);
    }
  }

  // Save message to favorites
  const saveToFavorites = async (messageContent, messageIndex) => {
    if (!userEmail || !messageContent) return;
    
    setSavingFavorite(messageIndex);
    
    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          message_content: messageContent,
          message_role: 'assistant'
        })
      });
      
      const result = await response.json();
        if (response.ok) {
        // Show success notification
        console.log('Message saved to favorites successfully');
        
        // Add to saved favorites set for immediate UI feedback
        setSavedFavorites(prev => new Set([...prev, messageIndex]));
        
        // Clear the saving state after a short success animation
        setTimeout(() => {
          setSavingFavorite(null);
        }, 1500); // Show checkmark for 1.5 seconds
      } else {
        console.error('Failed to save to favorites:', result.error);
        alert('Failed to save to favorites. Please try again.');
        setSavingFavorite(null);
      }
    } catch (error) {
      console.error('Error saving to favorites:', error);
      alert('Error saving to favorites. Please try again.');
      setSavingFavorite(null);
    }
  };

  // Save chat state whenever messages change
  useEffect(() => {
    if (chatInitialized && messages.length > 0) {
      saveChatState(messages)
    }
  }, [messages, chatInitialized, userEmail])

  return (
    <div className="chat-container">
      {/* Context Bar */}
      <div className="context-bar">
        <div className="context-actions">
          <button className="context-btn enhanced-mode" title="Enhanced Mode">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 12a4 4 0 100-8 4 4 0 000 8zM8 0a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2A.5.5 0 018 0zm0 13a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2A.5.5 0 018 13zm8-5a.5.5 0 01-.5.5h-2a.5.5 0 010-1h2a.5.5 0 01.5.5zM3 8a.5.5 0 01-.5.5h-2a.5.5 0 010-1h2A.5.5 0 013 8zm10.657-5.657a.5.5 0 010 .707l-1.414 1.415a.5.5 0 11-.707-.708l1.414-1.414a.5.5 0 01.707 0zm-9.193 9.193a.5.5 0 010 .707L3.05 13.657a.5.5 0 01-.707-.707l1.414-1.414a.5.5 0 01.707 0zm9.193 2.121a.5.5 0 01-.707 0l-1.414-1.414a.5.5 0 11.707-.707l1.414 1.414a.5.5 0 010 .707zM4.464 4.465a.5.5 0 01-.707 0L2.343 3.05a.5.5 0 11.707-.707l1.414 1.414a.5.5 0 010 .708z"/>
            </svg>
            Enhanced
          </button>
          
          <button className="context-btn clear-chat" onClick={clearContext} title="Clear Chat">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
              <path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
            Clear
          </button>
          
          <button className="context-btn export-chat" title="Export Chat">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"/>
              <path d="M7.646 11.854a.5.5 0 00.708 0l3-3a.5.5 0 00-.708-.708L8.5 10.293V1.5a.5.5 0 00-1 0v8.793L5.354 8.146a.5.5 0 10-.708.708l3 3z"/>
            </svg>
            Export
          </button>
        </div>
        
        {/* Session Info */}
        <div className="session-info">
          <span className="message-count">{messages.length} messages</span>
          {chatRestored && (
            <span className="session-status">
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 16A8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                <path d="M8 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H6a.5.5 0 0 1 0-1h1.5V4.5A.5.5 0 0 1 8 4z"/>
              </svg>
              Restored
            </span>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="messages-area">
        <div className="messages-content">
          {/* Chat Restored Indicator */}
          {chatRestored && messages.length > 0 && (
            <div className="chat-restored-banner">
              <div className="restored-content">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 16A8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                  <path d="M8 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H6a.5.5 0 0 1 0-1h1.5V4.5A.5.5 0 0 1 8 4z"/>
                </svg>
                <span>Chat session restored from your previous visit</span>
                <button className="start-fresh-btn" onClick={clearContext}>
                  Start Fresh
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, idx) => (
            <div key={idx} className={`${styles.messageContainer} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}>
              {msg.role === 'assistant' && (
                <div className={styles.assistantAvatar}>
                  <div className={styles.avatarCircle}>
                    <span className={styles.avatarText}>AI</span>
                  </div>
                </div>
              )}
              <div className={`${styles.messageBubble} ${
                msg.role === 'user' 
                  ? styles.userBubble 
                  : msg.error 
                    ? styles.errorBubble
                    : styles.assistantBubble
              }`}>
                <div className={styles.messageContent}>
                  {msg.role === 'assistant' && !msg.error ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>                <div className={styles.messageMeta}>
                  <small className={styles.messageTime}>{msg.time}</small>
                  {msg.tokensUsed > 0 && (
                    <small className={styles.messageTokens}>{msg.tokensUsed} tokens</small>
                  )}
                  
                  {/* Show Continue button for chunked responses */}
                  {msg.isPartial && msg.conversationId && (
                    <div className={styles.continueSection}>
                      {msg.previewNext && (
                        <div className={styles.previewText}>
                          <strong>Coming up:</strong> {msg.previewNext}
                        </div>
                      )}
                      <button
                        onClick={() => handleContinue(msg.conversationId, msg.currentChunk)}
                        disabled={isLoading}
                        className={styles.continueButton}
                      >
                        {isLoading ? (
                          <>
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            <span>📖 Continue reading</span>
                            <span style={{ opacity: 0.7, fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                              ({msg.currentChunk}/{msg.totalChunks})
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {msg.role === 'assistant' && !msg.error && (
                    <button
                      onClick={() => saveToFavorites(msg.content, idx)}
                      disabled={savingFavorite === idx}
                      title="Save to favorites"
                      className={`favorite-button ${savedFavorites.has(idx) ? 'saved' : ''}`}
                    >
                      {savingFavorite === idx ? (
                        <svg width="12" height="12" className="loading-spinner" viewBox="0 0 16 16">
                          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="37.7" strokeDashoffset="37.7">
                            <animateTransform attributeName="transform" type="rotate" dur="1s" repeatCount="indefinite" values="0 8 8;360 8 8"/>
                          </circle>
                        </svg>
                      ) : savedFavorites.has(idx) ? (
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16" className="checkmark-icon">
                          <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                        </svg>
                      ) : (
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
                        </svg>
                      )}
                      {savedFavorites.has(idx) ? 'Saved!' : 'Save'}
                    </button>
                  )}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className={styles.userAvatar}>
                  <div className={`${styles.avatarCircle} ${styles.userAvatarCircle}`}>
                    <span className={styles.avatarText}>You</span>
                  </div>
                </div>
              )}
            </div>
          ))}{isLoading && (
            <div className={`${styles.messageContainer} ${styles.assistantMessage}`}>
              <div className={styles.assistantAvatar}>
                <div className={styles.avatarCircle}>
                  <span className={styles.avatarText}>AI</span>
                </div>
              </div>
              <div className={`${styles.messageBubble} ${styles.assistantBubble} ${styles.loadingBubble}`}>
                <div className={styles.typingIndicator}>
                  <span className={styles.typingDot}></span>
                  <span className={styles.typingDot}></span>
                  <span className={styles.typingDot}></span>
                </div>
                <div className={styles.messageMeta}>
                  <small className={styles.messageTime}>Thinking...</small>
                </div>
              </div>
            </div>
          )}        </div>
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        {showWarning && (
          <div className="warning-message">
            ⚠️ This message may use many tokens. Consider shorter messages to reduce cost.
          </div>
        )}
        <div className="input-container">
          <textarea
            className="message-input"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            rows="1"
          />
          <button 
            className="send-button" 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <svg width="16" height="16" className="loading-spinner" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="37.7" strokeDashoffset="37.7">
                  <animateTransform attributeName="transform" type="rotate" dur="1s" repeatCount="indefinite" values="0 8 8;360 8 8"/>
                </circle>
              </svg>
            ) : (
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M15.854.146a.5.5 0 0 1 .11.54L13.026 8.47l2.938 7.784a.5.5 0 0 1-.648.648L7.532 14.026.146 16.854a.5.5 0 0 1-.54-.11l13.5-13.5a.5.5 0 0 1 .748-.098z"/>
              </svg>
            )}
          </button>
        </div>
      </div>      <style jsx>{`
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: white;
        }
        
        /* Context Bar */
        .context-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1.5rem;
          background: rgba(255, 255, 255, 0.95);
          border-bottom: 1px solid rgba(229, 231, 235, 0.8);
          backdrop-filter: blur(10px);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        
        .context-actions {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        
        .context-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.875rem;
          border: 1px solid rgba(229, 231, 235, 0.8);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.9);
          color: #6b7280;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          backdrop-filter: blur(10px);
        }
        
        .context-btn:hover {
          background: rgba(248, 250, 252, 0.95);
          border-color: rgba(156, 163, 175, 0.6);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        
        .context-btn.enhanced-mode {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
          color: #667eea;
          border-color: rgba(102, 126, 234, 0.3);
        }
        
        .context-btn.enhanced-mode:hover {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
          border-color: rgba(102, 126, 234, 0.5);
        }
        
        .context-btn.clear-chat {
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.3);
        }
        
        .context-btn.clear-chat:hover {
          background: rgba(239, 68, 68, 0.05);
          border-color: rgba(239, 68, 68, 0.4);
        }
        
        .session-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.8rem;
          color: #6b7280;
        }
        
        .message-count {
          font-weight: 500;
        }
        
        .session-status {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          color: #10b981;
          font-weight: 500;
        }
        
        /* Chat Restored Banner */
        .chat-restored-banner {
          margin: 1rem 1.5rem;
          padding: 1rem;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 16px;
          backdrop-filter: blur(10px);
        }
        
        .restored-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: #3b82f6;
          font-size: 0.875rem;
          font-weight: 500;
        }
        
        .start-fresh-btn {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          padding: 0.375rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-left: auto;
        }
        
        .start-fresh-btn:hover {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.5);
          transform: translateY(-1px);
        }
          .messages-area {
          flex: 1;
          overflow-y: auto;
          background: linear-gradient(to bottom, #f8fafc 0%, #f1f5f9 100%);
          min-height: 500px;
          position: relative;
        }
        
        .messages-area::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 20px;
          background: linear-gradient(to bottom, rgba(248, 250, 252, 0.8), transparent);
          pointer-events: none;
          z-index: 1;
        }
        
        .messages-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
        }
          /* Input Area - Sticky and Modern */
        .chat-input-area {
          position: sticky;
          bottom: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(229, 231, 235, 0.8);
          padding: 1.25rem 1.5rem;
          z-index: 10;
        }
        
        .chat-input-area::before {
          content: '';
          position: absolute;
          top: -20px;
          left: 0;
          right: 0;
          height: 20px;
          background: linear-gradient(to top, rgba(255, 255, 255, 0.8), transparent);
          pointer-events: none;
        }
        
        .warning-message {
          background: linear-gradient(135deg, rgba(251, 146, 60, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%);
          color: #f59e0b;
          border: 1px solid rgba(251, 146, 60, 0.3);
          border-radius: 12px;
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .input-container {
          display: flex;
          align-items: flex-end;
          gap: 0.75rem;
          background: white;
          border: 2px solid rgba(229, 231, 235, 0.8);
          border-radius: 24px;
          padding: 0.75rem 1rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;
        }
        
        .input-container:focus-within {
          border-color: rgba(16, 185, 129, 0.5);
          box-shadow: 0 8px 32px rgba(16, 185, 129, 0.15);
          transform: translateY(-2px);
        }        .message-input {
          flex: 1;
          border: none;
          outline: none;
          resize: none;
          font-size: 0.95rem;
          line-height: 1.5;
          font-family: inherit;
          background: transparent;
          min-height: 24px;
          max-height: 120px;
          overflow-y: auto;
          color: #374151;
        }
        
        .message-input:disabled {
          color: #6b7280;
          cursor: not-allowed;
        }
        
        .message-input::placeholder {
          color: #9ca3af;
          font-weight: 400;
        }
          .send-button {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          flex-shrink: 0;
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.25);
        }
        
        .send-button:hover:not(:disabled) {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          transform: scale(1.05) translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
        }
        
        .send-button:focus {
          outline: 3px solid rgba(16, 185, 129, 0.4);
          outline-offset: 2px;
        }
        
        .send-button:disabled {
          background: #e5e7eb;
          color: #9ca3af;
          cursor: not-allowed;
          transform: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .loading-spinner {
          animation: spin 1s linear infinite;
        }
          @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
          .favorite-button {
          background: rgba(66, 133, 244, 0.1);
          color: #4285f4;
          border: 1px solid rgba(66, 133, 244, 0.3);
          border-radius: 15px;
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .favorite-button:hover:not(:disabled) {
          background: rgba(66, 133, 244, 0.2);
          border-color: rgba(66, 133, 244, 0.5);
          transform: translateY(-1px);
        }
        
        .favorite-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .favorite-button.saved {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          border-color: rgba(34, 197, 94, 0.3);
        }
        
        .favorite-button.saved:hover:not(:disabled) {
          background: rgba(34, 197, 94, 0.2);
          border-color: rgba(34, 197, 94, 0.5);
        }
        
        .checkmark-icon {
          animation: checkmarkPop 0.4s ease-out;
        }
          @keyframes checkmarkPop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes pulseSubtle {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
          }
        }
        
        .pulse-animation {
          animation: pulseSubtle 2s infinite;
        }
          /* Responsive Design */
        @media (max-width: 768px) {
          .context-bar {
            padding: 0.5rem 1rem;
          }
          
          .context-actions {
            gap: 0.375rem;
          }
          
          .context-btn {
            padding: 0.375rem 0.625rem;
            font-size: 0.75rem;
          }
          
          .session-info {
            font-size: 0.75rem;
            gap: 0.5rem;
          }
          
          .chat-input-area {
            padding: 1rem;
          }
          
          .input-container {
            gap: 0.5rem;
            padding: 0.625rem 0.875rem;
          }
          
          .send-button {
            width: 42px;
            height: 42px;
          }
          
          .chat-restored-banner {
            margin: 0.75rem 1rem;
            padding: 0.75rem;
          }
          
          .restored-content {
            font-size: 0.8rem;
            gap: 0.5rem;
          }
        }
        
        @media (max-width: 480px) {
          .context-bar {
            flex-direction: column;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
          }
          
          .context-actions {
            order: 2;
            justify-content: center;
            flex-wrap: wrap;
          }
          
          .session-info {
            order: 1;
            justify-content: center;
          }
        }        
        /* Enhanced focus states for accessibility */
        .message-input:focus,
        .send-button:focus,
        .favorite-button:focus,
        .context-btn:focus,
        .start-fresh-btn:focus {
          outline: 3px solid rgba(16, 185, 129, 0.4);
          outline-offset: 2px;
        }
        
        /* Improved contrast for better readability */
        @media (prefers-contrast: high) {
          .favorite-button {
            border-width: 2px;
          }
          
          .context-btn {
            border-width: 2px;
          }
          
          .send-button {
            border: 2px solid currentColor;
          }
        }
        
        /* Reduced motion for users who prefer it */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  )
}
