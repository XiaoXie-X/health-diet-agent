'use client'
  import { useState, useRef, useEffect } from 'react'

  export default function Home() {
    const [messages, setMessages] = useState<{role: string, content: string}[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [sessionId, setSessionId] = useState<string>('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const saved = localStorage.getItem('sessionId')
      if (saved) setSessionId(saved)
    }, [])

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const sendMessage = async () => {
      if (!input.trim() || loading) return
      const userMessage = { role: 'user', content: input }
      const newMessages = [...messages, userMessage]
      setMessages(newMessages)
      setInput('')
      setLoading(true)
      setTimeout(scrollToBottom, 50)

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(sessionId ? { 'x-session-id': sessionId } : {}) },
          body: JSON.stringify({ messages: newMessages })
        })
        const newSessionId = res.headers.get('x-session-id')
        if (newSessionId && !sessionId) {
          setSessionId(newSessionId)
          localStorage.setItem('sessionId', newSessionId)
        }
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let assistantMessage = ''
        setMessages([...newMessages, { role: 'assistant', content: '' }])

        const handleLine = (line: string) => {
          if (!line.startsWith('data: ')) return
          const data = line.slice(6)
          if (data === '[DONE]') return
          try {
            const json = JSON.parse(data)
            const content = json.choices?.[0]?.delta?.content
            if (content) {
              assistantMessage += content
              setMessages([...newMessages, { role: 'assistant', content: assistantMessage }])
              scrollToBottom()
            }
          } catch (e) {}
        }

        if (reader) {
          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) handleLine(line)
          }
          if (buffer) handleLine(buffer)
        }
      } catch (error) {
        console.error('Error:', error)
      }
      setLoading(false)
    }

    return (
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">健康饮食助手</h1>
        <div className="border rounded-lg p-4 h-96 overflow-y-auto mb-4">
          {messages.length === 0 && <div className="text-gray-400 text-center">问我任何营养问题...</div>}
          {messages.map((msg, i) => (
            <div key={i} className={`mb-2 ${msg.role === 'user' ? 'text-right' : ''}`}>
              <span className={`inline-block p-2 rounded max-w-[85%] sm:max-w-[75%] whitespace-pre-wrap break-words ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                {msg.content}
              </span>
            </div>
          ))}
          {loading && <div className="text-gray-500">思考中...</div>}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
            className="flex-1 border rounded px-3 py-2" placeholder="输入消息..." />
          <button onClick={sendMessage} className="bg-blue-500 text-white px-4 py-2 rounded">发送</button>
        </div>
      </div>
    )
  }