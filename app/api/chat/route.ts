 import { userDb, messageDb } from '@/lib/db'
  import { tools, executeTool } from '@/lib/tools'

  export async function POST(request: Request) {
    const { messages } = await request.json()
    const sessionId = request.headers.get('x-session-id') || 'user_' + Math.random().toString(36).substring(2, 15)
    const user = userDb.getOrCreate(sessionId)
    const historyMessages = messageDb.getHistory(sessionId, 20)

    const systemPrompt = `你是营养师小蟹，说话像朋友一样自然随和。回答简短实用，推荐食物时简单说说理由。

【输出格式】
- 用纯文本回复，禁止使用 Markdown 语法（如 **加粗**、# 标题、* 星号列表）
- 需要列举时用「1. 2. 3.」编号或顿号分隔，一项一行
- 先给结论，再说理由，控制在 200 字以内

【工具使用】
- 用户询问具体食物的营养成分（热量/蛋白质等）→ 调用 get_nutrition
- 用户想算每日热量需求、减脂增肌摄入量 → 调用 calculate_calories
- 涉及时令食物、最新资讯、需要联网核实的内容 → 调用 search_web
- 日常闲聊和一般饮食建议不需要工具，直接回答

用户信息：
- 年龄：${user.age || '未知'}
- 性别：${user.gender || '未知'}
- 身高：${user.height ? user.height + 'cm' : '未知'}
- 体重：${user.weight ? user.weight + 'kg' : '未知'}
- 目标：${user.goal || '一般健康'}
- 过敏：${user.allergies || '无'}
- 忌口：${user.dislikes || '无'}

如果聊天中用户提到了以上信息，记得主动确认并更新。`

    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.map((m: any) => ({ role: m.role, content: m.content })),
      ...messages
    ]

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        messages: allMessages,
        model: 'deepseek-chat',
        tools: tools,
        stream: true
      })
    })

    const lastUserMessage = messages[messages.length - 1]
    if (lastUserMessage) {
      messageDb.save(sessionId, lastUserMessage.role, lastUserMessage.content)
    }

    const encoder = new TextEncoder()
const stream = new ReadableStream({
      async start(controller) {
        // 立即播报思考状态，让用户马上看到反馈
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'thinking' })}\n\n`))

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let assistantMessage = ''
        let toolCalls: any[] = []

        if (reader) {
          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') continue
                try {
                  const json = JSON.parse(data)
                  const choice = json.choices?.[0]
                  const content = choice?.delta?.content
                  if (content) assistantMessage += content
                  const toolCall = choice?.delta?.tool_calls
                  if (toolCall) {
                    for (const tc of toolCall) {
                      if (!toolCalls[tc.index]) {
                        toolCalls[tc.index] = { id: tc.id || '', name: tc.function?.name || '', arguments: '' }
                      }
                      if (tc.id) toolCalls[tc.index].id = tc.id
                      if (tc.function?.name) toolCalls[tc.index].name = tc.function.name
                      if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments
                    }
                  }
                } catch (e) {}
              }
            }
          }
        }

        // 处理工具调用
        if (toolCalls.length > 0 && toolCalls[0].name) {
          try {
            const tc = toolCalls[0]
            let args = {}
            try { args = tc.arguments ? JSON.parse(tc.arguments) : {} } catch (e) { args = {} }

            // 播报工具执行状态，让用户知道进行到哪一步
            const toolLabels: Record<string, string> = {
              search_web: `联网搜索：${(args as any).query || ''}`,
              get_nutrition: `查询营养数据：${(args as any).food || ''}`,
              calculate_calories: '计算每日热量需求'
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'tool', label: toolLabels[tc.name] || '调用工具中…' })}\n\n`))

            const result = await executeTool(tc.name, args)

            if (tc.name === 'search_web') {
              const data = result as any
              if (data.results && data.results.length > 0) {
                assistantMessage = `搜索结果：\n\n${data.results.map((r: any) => `📌 ${r.title}\n${r.content}\n🔗 ${r.url}`).join('\n\n')}`
              } else {
                assistantMessage = '没有找到相关信息'
              }
            } else if (tc.name === 'get_nutrition') {
              const data = result as any
              if (data.calories !== undefined) {
                assistantMessage = `${data.food}的营养成分（每100g）：\n- 热量：${data.calories}kcal\n- 蛋白质：${data.protein}g\n- 碳水：${data.carbs}g\n- 脂肪：${data.fat}g`
              } else {
                // 数据库未收录，让模型基于营养知识给出估算
                assistantMessage = await estimateNutrition((args as any).food)
              }
            } else if (tc.name === 'calculate_calories') {
              const data = result as any
              assistantMessage = `计算结果：\n- 基础代谢率(BMR)：${data.bmr}kcal\n-
        每日消耗(TDEE)：${data.tdee}kcal\n\n减脂建议：${data.recommendation.减脂}kcal/天\n增肌建议：${data.recommendation.增肌}kcal/天`
            } else {
              assistantMessage = JSON.stringify(result, null, 2)
            }
          } catch (e) {
            assistantMessage = '工具调用出错了'
          }
        }

        // 发送回复
        if (!assistantMessage) {
    assistantMessage = '抱歉，我没听懂，能再说一遍吗？'
  }

  if (assistantMessage) {
          // 分段发送，模拟流式效果
          const chunkSize = 10
          for (let i = 0; i < assistantMessage.length; i += chunkSize) {
            const chunk = assistantMessage.slice(i, i + chunkSize)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`))
          }
          messageDb.save(sessionId, 'assistant', assistantMessage)
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'x-session-id': sessionId }
    })
  }

  // 数据库未收录的食物：调用模型基于营养知识估算
  async function estimateNutrition(food: string): Promise<string> {
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          stream: false,
          messages: [
            { role: 'system', content: '你是营养数据库。根据营养学知识估算食物每100g的营养成分，用纯文本回复（禁止Markdown符号），格式：\nXX的营养成分（每100g，估算值）：\n- 热量：XXkcal\n- 蛋白质：XXg\n- 碳水：XXg\n- 脂肪：XXg\n最后单独一行注明「以上为估算值，仅供参考」。' },
            { role: 'user', content: `食物：${food}` }
          ]
        })
      })
      const data = await res.json()
      return data.choices?.[0]?.message?.content || `抱歉，暂时查不到「${food}」的营养数据`
    } catch (e) {
      return `抱歉，暂时查不到「${food}」的营养数据`
    }
  }