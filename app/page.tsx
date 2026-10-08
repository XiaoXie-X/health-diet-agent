'use client'
  import { useState, useRef, useEffect } from 'react'
  import XiaoxieIcon from './XiaoxieIcon'

  export default function Home() {
    const [messages, setMessages] = useState<{role: string, content: string}[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [statusText, setStatusText] = useState('')
    const [sessionId, setSessionId] = useState<string>('')
    const [showScrollBtn, setShowScrollBtn] = useState(false)
    const mainRef = useRef<HTMLElement>(null)
    const stickToBottomRef = useRef(true)

    useEffect(() => {
      const saved = localStorage.getItem('sessionId')
      if (saved) setSessionId(saved)
    }, [])

    // 消息渲染完成后贴底滚动（必须等 DOM 更新完，否则滚到的是旧底部，
    // 会导致最后一段气泡露在视口外）
    useEffect(() => {
      if (stickToBottomRef.current) scrollToBottom()
    }, [messages])

    // 贴底滚动：流式期间用瞬时滚动（smooth 动画会被高频打断导致卡顿）
    const scrollToBottom = (smooth = false) => {
      const el = mainRef.current
      if (!el) return
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      } else {
        el.scrollTop = el.scrollHeight
      }
    }

    // 用户主动上翻时停止自动贴底，回到底部附近后恢复
    const handleScroll = () => {
      const el = mainRef.current
      if (!el) return
      stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50
      setShowScrollBtn(!stickToBottomRef.current)
    }

    // 去掉回复中的 Markdown 星号（**加粗**/*斜体*），按纯文本展示
    const stripMarkdown = (text: string) =>
      text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')

    const send = async (text: string) => {
      if (!text.trim() || loading) return
      const userMessage = { role: 'user', content: text }
      const newMessages = [...messages, userMessage]
      setMessages([...newMessages, { role: 'assistant', content: '' }])
      setInput('')
      setLoading(true)
      setStatusText('正在思考…')
      stickToBottomRef.current = true

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

        const handleLine = (line: string) => {
          if (!line.startsWith('data: ')) return
          const data = line.slice(6)
          if (data === '[DONE]') return
          try {
            const json = JSON.parse(data)
            if (json.status) {
              setStatusText(json.status === 'thinking' ? '正在思考…' : (json.label || '处理中…'))
              return
            }
            const content = json.choices?.[0]?.delta?.content
            if (content) {
              setStatusText('')
              assistantMessage += content
              setMessages([...newMessages, { role: 'assistant', content: assistantMessage }])
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
      setStatusText('')
    }

    return (
      <div className="relative mx-auto flex h-dvh w-full max-w-[480px] flex-col border-x border-base-300 bg-base-100 shadow-sm">
        <header className="flex items-center gap-3 border-b border-base-300 px-4 py-3">
          <XiaoxieIcon className="h-10 w-10 shrink-0" />
          <div>
            <h1 className="text-base font-semibold leading-tight">小蟹 · AI 营养师</h1>
            <p className="flex items-center gap-1.5 text-xs text-base-content/60">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" />在线
            </p>
          </div>
        </header>

        <main ref={mainRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <XiaoxieIcon className="h-20 w-20" />
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
            <div key={i} className="chat chat-end animate-fade-up motion-reduce:animate-none">
              <div className="chat-bubble chat-bubble-primary max-w-[90%] whitespace-pre-wrap break-words">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={i} className="chat chat-start animate-fade-up motion-reduce:animate-none">
              <div className="chat-image avatar">
                <XiaoxieIcon className="w-9 shrink-0" />
              </div>
              <div className="chat-bubble bg-base-200 text-base-content max-w-[90%] whitespace-pre-wrap break-words">
                {msg.content === '' ? (
                  <span className="flex items-center gap-2">
                    <span className="loading loading-dots loading-md text-primary"></span>
                    {statusText && <span className="text-sm opacity-70">{statusText}</span>}
                  </span>
                ) : stripMarkdown(msg.content)}
              </div>
            </div>
          ))}
        </main>

        {showScrollBtn && (
          <button
            onClick={() => {
              stickToBottomRef.current = true
              setShowScrollBtn(false)
              scrollToBottom(true)
            }}
            className="btn btn-circle btn-sm absolute bottom-24 left-1/2 z-10 -translate-x-1/2 border-base-300 bg-base-100 shadow-md"
            aria-label="回到最新消息"
          >
            ↓
          </button>
        )}

        <footer className="border-t border-base-300 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send(input)}
              className="input flex-1 rounded-full border-none bg-base-200 focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="问问小蟹营养问题..." />
            <button onClick={() => send(input)} disabled={loading || !input.trim()}
              className="btn btn-primary btn-circle" aria-label="发送">➤</button>
          </div>
        </footer>
      </div>
    )
  }