import React, { useState, useRef, useEffect } from 'react'

export default function ChatBox({ userEmail, onTokenUsed }) {
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: 'Hello, welcome to AskMe AI! Before we get start, what\'s your first name?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
    { 
      role: 'assistant', 
      content: 'And, how do you prefer to receive advice? I can be direct, gentle, or offer structured guidance, whatever you like.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    const userMessage = { 
      role: 'user', 
      content: input, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/gptRouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, message: input })
      })

      const data = res.ok ? await res.json() : { reply: 'Error: ' + (await res.text()) }
      
      const assistantMessage = {
        role: 'assistant',
        content: data.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      
      setMessages(prev => [...prev, assistantMessage])
      
      // Notify parent component that a token was used
      if (res.ok && onTokenUsed) {
        onTokenUsed()
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="d-flex flex-column h-100">
      {/* Chat Header */}
      <div className="bg-primary text-white p-3 text-center">
        <h4 className="mb-0">AskMe AI</h4>
      </div>
      
      {/* Messages Area */}
      <div className="flex-grow-1 overflow-auto p-3" style={{ backgroundColor: '#f8f9fa', minHeight: '400px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`d-flex mb-3 ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>
            {msg.role === 'assistant' && (
              <div className="me-2">
                <div className="bg-secondary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                  <span className="text-white">👤</span>
                </div>
              </div>
            )}
            <div className={`p-3 rounded ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white border'}`} style={{ maxWidth: '70%' }}>
              <div>{msg.content}</div>
              <small className={`d-block mt-1 ${msg.role === 'user' ? 'text-white-50' : 'text-muted'}`}>
                {msg.time}
              </small>
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="d-flex justify-content-start mb-3">
            <div className="me-2">
              <div className="bg-secondary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                <span className="text-white">👤</span>
              </div>
            </div>
            <div className="bg-white border p-3 rounded">
              <div className="d-flex align-items-center">
                <div className="spinner-border spinner-border-sm me-2" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                Thinking...
              </div>
            </div>
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>
      
      {/* Input Area */}
      <div className="p-3 border-top bg-white">
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
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
