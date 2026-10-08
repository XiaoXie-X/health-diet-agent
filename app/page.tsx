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

    const send = async (text: string) => {
      if (!text.trim() || loading) return
      const userMessage = { role: 'user', content: text }
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
      <div className="mx-auto flex h-dvh w-full max-w-[480px] flex-col border-x border-base-300 bg-base-100 shadow-sm">
        <header className="flex items-center gap-3 border-b border-base-300 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xl">🦀</div>
          <div>
            <h1 className="text-base font-semibold leading-tight">小蟹 · AI 营养师</h1>
            <p className="flex items-center gap-1.5 text-xs text-base-content/60">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" />在线
            </p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-4xl">🦀</div>
              <div>
                <h2 className="text-lg font-semibold">你好，我是小蟹</h2>
                <p className="mt-1 text-sm text-base-content/60">你的 AI 营养师，随时帮你分析饮食、推荐健康搭配</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {['今天午餐吃什么更健康？', '帮我算一份沙拉的热量', '减脂期怎么吃主食？'].map(q => (
                  <button key={q} onClick={() => send(q)}
                    className="btn btn-sm btn-outline btn-primary rounded-full">{q}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => msg.role === 'user' ? (
            <div key={i} className="chat chat-end">
              <div className="chat-bubble chat-bubble-primary max-w-[90%] whitespace-pre-wrap break-words">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={i} className="chat chat-start">
              <div className="chat-image avatar">
                <div className="flex w-9 items-center justify-center rounded-full bg-primary/10 text-primary">🦀</div>
              </div>
              <div className="chat-bubble bg-base-200 text-base-content max-w-[90%] whitespace-pre-wrap break-words">
                {msg.content === '' ? <span className="loading loading-dots loading-md text-primary"></span> : msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </main>

        <footer className="border-t border-base-300 p-3">
          <div className="flex items-center gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send(input)}
              className="input flex-1 bg-base-200" placeholder="问问小蟹营养问题..." />
            <button onClick={() => send(input)} disabled={loading || !input.trim()}
              className="btn btn-primary btn-circle" aria-label="发送">➤</button>
          </div>
        </footer>
      </div>
    )
  }