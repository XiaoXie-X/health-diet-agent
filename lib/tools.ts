export const tools = [
      {
    type: 'function',
    function: {
      name: 'search_web',
      description: '搜索互联网获取最新信息，用于查询实时资讯、新闻、最新研究等',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词，如：北京今天天气、最新减肥方法'
          }
        },
        required: ['query']
      }
    }
  },
    {
      type: 'function',
      function: {
        name: 'get_nutrition',
        description: '查询食物的营养成分，包括热量、蛋白质、碳水、脂肪',
        parameters: {
          type: 'object',
          properties: {
            food: {
              type: 'string',
              description: '食物名称，如：苹果、鸡胸肉、米饭'
            }
          },
          required: ['food']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'calculate_calories',
        description: '根据身高、体重、年龄、性别计算每日所需热量（TDEE）',
        parameters: {
          type: 'object',
          properties: {
            height: { type: 'number', description: '身高（cm）' },
            weight: { type: 'number', description: '体重（kg）' },
            age: { type: 'number', description: '年龄' },
            gender: { type: 'string', description: '性别：男/女' },
            activity: { type: 'string', description: '活动量：久坐/轻度/中度/高强度' }
          },
          required: ['height', 'weight', 'age', 'gender', 'activity']
        }
      }
    }
  ]

  // 工具执行函数：实际执行工具逻辑
  export async function executeTool(name: string, args: any): Promise<any> {
    if (name === 'get_nutrition') {
      return getNutrition(args.food)
    }
   if (name === 'calculate_calories') {
    return calculateTDEE(args.height, args.weight, args.age, args.gender, args.activity)
  }
  if (name === 'search_web') {
    return await searchWeb(args.query)
  }
  return { error: '未知工具' }
  }

  // 食物营养数据库（简化版）
  function getNutrition(food: string) {
    const db: Record<string, any> = {
      '苹果': { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 },
      '香蕉': { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6 },
      '鸡胸肉': { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
      '鸡蛋': { calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0 },
      '米饭': { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 },
      '面条': { calories: 138, protein: 4.5, carbs: 25, fat: 2, fiber: 1.2 },
      '西兰花': { calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6 },
      '三文鱼': { calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0 },
      '豆腐': { calories: 76, protein: 8, carbs: 1.9, fat: 4.8, fiber: 0.3 },
      '牛奶': { calories: 42, protein: 3.4, carbs: 5, fat: 1, fiber: 0 },
      '燕麦': { calories: 389, protein: 17, carbs: 66, fat: 7, fiber: 11 },
      '红薯': { calories: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3 }
    }

    const nutrition = db[food]
    if (nutrition) {
      return { food, ...nutrition, unit: '每100g' }
    }
    return { food, message: '暂无该食物数据，以下为估算：热量约100kcal/100g' }
  }

  // 计算TDEE（每日总消耗热量）
  function calculateTDEE(height: number, weight: number, age: number, gender: string, activity: string) {
    // BMR计算（Mifflin-St Jeor公式）
    let bmr = 0
    if (gender === '男') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161
    }

    // 活动系数
    const activityMap: Record<string, number> = {
      '久坐': 1.2,
      '轻度': 1.375,
      '中度': 1.55,
      '高强度': 1.725
    }
    const multiplier = activityMap[activity] || 1.2
    const tdee = Math.round(bmr * multiplier)

    return {
      bmr: Math.round(bmr),
      tdee,
      recommendation: {
        减脂: tdee - 500,
        增肌: tdee + 300,
        维持: tdee
      }
    }
  }async function searchWeb(query: string) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: query,
          max_results: 3
        })
      })

      const data = await response.json().catch(() => null)

      // 区分「服务调用失败」和「确实没有结果」，让模型能据此选择兜底策略
      if (!response.ok || !data) {
        return { query, message: `搜索服务调用失败（HTTP ${response.status}）。请改用你已有的知识回答，并注明可能不是最新信息` }
      }

      if (data.results && data.results.length > 0) {
        return {
          query,
          results: data.results.map((r: any) => ({
            title: r.title,
            // 截断正文，避免模型把网页原文整段粘贴给用户
            content: (r.content || '').slice(0, 600),
            url: r.url
          }))
        }
      }
      return { query, message: '未找到相关信息。请改用你已有的知识回答，并注明可能不是最新信息' }
    } catch (error) {
      return { query, message: '搜索服务暂时不可用。请改用你已有的知识回答，并注明可能不是最新信息' }
    }
  }