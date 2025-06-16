import React, { useState, useRef, useEffect } from 'react'
import styles from '../styles/Chat.module.css'
import ReactMarkdown from 'react-markdown'

export default function ChatBox({ userEmail, onTokenUsed, contextLength = 5, onEstimateCost, estimateTokens }) {  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(true) // Start with loading state
  const [showWarning, setShowWarning] = useState(false)
  const [userData, setUserData] = useState(null)
  const [savingFavorite, setSavingFavorite] = useState(null) // Track which message is being saved
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
  }
  // Fetch user data and initialize chat on component mount
  useEffect(() => {
    async function initializeChat() {
      if (!userEmail) return
      
      try {
        // First try to restore previous chat state
        const restoredMessages = loadChatState()
          if (restoredMessages && restoredMessages.length > 0) {
          console.log('Restoring previous chat session with', restoredMessages.length, 'messages')
          setMessages(restoredMessages)
          setChatInitialized(true)
          setChatRestored(true) // Mark that chat was restored
          setIsLoading(false)
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
        }
      } catch (err) {
        console.error('Error initializing chat:', err)
        setMessages([{
          role: 'assistant',
          content: 'Hello! Welcome to AskMe AI. How can I help you today?',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tokensUsed: 0
        }])
        setChatInitialized(true)
      } finally {
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
      const res = await fetch('/api/gptRouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          message: "__INIT_CHAT__", // Special command to initialize chat
          isFirstMessage: true
        })
      })

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
          tokenBreakdown: data.tokenBreakdown
        }])
        
        if (onTokenUsed) {
          onTokenUsed(data.tokensUsed || data.tokens || 1)
        }
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
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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
        const assistantMessage = {
          role: 'assistant',
          content: data.response || data.message,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tokensUsed: data.tokensUsed || data.tokens || 1,
          tokenBreakdown: data.tokenBreakdown
        }
        
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
        // You could add a toast notification here
      } else {
        console.error('Failed to save to favorites:', result.error);
        alert('Failed to save to favorites. Please try again.');
      }
    } catch (error) {
      console.error('Error saving to favorites:', error);
      alert('Error saving to favorites. Please try again.');
    } finally {
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
    <div className="d-flex flex-column h-100">      {/* Messages Area */}
      <div className="flex-grow-1 p-3 overflow-auto" style={{ backgroundColor: '#f8f9fa', minHeight: '400px' }}>
        <div className="d-flex flex-column gap-3">          {/* Context Management Info */}
          {messages.length > contextLength && (
            <div className={styles.contextInfo}>
              <div className={styles.contextContent}>
                <div className={styles.contextText}>
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="me-2">
                    <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                  </svg>
                  Using last <strong>{contextLength}</strong> messages for context optimization
                </div>
                <button className={`btn btn-outline-secondary btn-sm ${styles.clearBtn}`} onClick={clearContext}>
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16" className="me-1">
                    <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/>
                  </svg>
                  Clear Chat
                </button>
              </div>
            </div>
          )}          {/* Chat Restored Indicator */}
          {chatRestored && messages.length > 0 && (
            <div className="alert alert-info d-flex align-items-center py-2 px-3" style={{ fontSize: '0.85rem' }}>
              <i className="bi bi-clock-history me-2"></i>
              <span>Chat session restored from your previous visit</span>
              <button 
                className="btn btn-sm btn-outline-primary ms-auto"
                onClick={clearContext}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                Start Fresh
              </button>
            </div>
          )}{/* Messages */}
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
                  {msg.role === 'assistant' && !msg.error && (
                    <button
                      className="btn btn-sm btn-outline-secondary ms-2"
                      onClick={() => saveToFavorites(msg.content, idx)}
                      disabled={savingFavorite === idx}
                      title="Save to favorites"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      {savingFavorite === idx ? (
                        <span className="spinner-border spinner-border-sm me-1" style={{ width: '0.7rem', height: '0.7rem' }}></span>
                      ) : (
                        <i className="bi bi-star me-1"></i>
                      )}
                      Save
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
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-top bg-white">        {showWarning && (
          <div className="alert alert-warning small py-1 mb-2">
            ⚠️ This message may use many tokens. Consider shorter messages to reduce cost.
          </div>
        )}
        <div className="input-group">
          <textarea
            className="form-control"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            rows="1"
            style={{ resize: 'none' }}
          />
          <button 
            className="btn btn-primary" 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
