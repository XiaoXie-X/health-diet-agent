# 🦀 小蟹 · AI 营养师

> 会记事的贴心营养师 —— 基于大模型的个性化健康饮食助手

**在线体验**：[health-diet-agent-xie-2b9b.vercel.app](https://health-diet-agent-5arbojzc2-xie-2b9b.vercel.app)

![技术栈](https://img.shields.io/badge/Next.js-16-black) ![模型](https://img.shields.io/badge/DeepSeek-Function%20Calling-blue) ![UI](https://img.shields.io/badge/daisyUI-5-brightgreen) ![部署](https://img.shields.io/badge/Vercel-已上线-success)

![产品截图](docs/screenshot.png)

---

## 💡 为什么做这个

使用通用 AI 助手咨询饮食问题时，存在两个核心痛点：

| 痛点 | 表现 | 本产品的解法 |
|------|------|--------------|
| **数据幻觉** | AI 随口编造食物热量，数字看着精确其实是编的 | 营养数据强制走本地数据库查询（Function Calling），未收录食物由模型估算但**必须标注"估算值"**，不冒充精确数据 |
| **无记忆** | 每次对话都要重新交代身高体重、过敏忌口 | 用户画像持久化存储（SQLite），跨会话记住你的身体数据和偏好 |

## ✨ 核心功能

- 💬 **对话式营养咨询** —— 营养师"小蟹"人设，朋友式口吻，多轮上下文
- 🔍 **三种智能工具** —— 营养查询 / 每日热量计算（BMR·TDEE）/ 联网搜索（Tavily）
- 🧠 **用户画像记忆** —— 年龄、身高体重、目标、过敏忌口自动采集与更新
- ⚡ **流式输出 + 阶段播报** —— "正在思考 → 联网搜索：XX → 生成中"，等待不再黑盒
- 🛡️ **可信设计** —— 估算值明确披露、疾病饮食建议就医、拒绝推荐极端饮食方式

## 🏗️ 技术架构

```
用户 ⇄ Next.js 前端（daisyUI 聊天界面，流式渲染）
         │  SSE（Server-Sent Events）
         ▼
      /api/chat（对话编排层）
         │
         ├─⬀ DeepSeek API（人设提示词 + Function Calling）
         │        │ 判断需要工具时
         │        ▼
         ├─⬀ 本地营养数据库（12种食物精确值）
         ├─⬀ 热量计算引擎（Mifflin-St Jeor 公式）
         ├─⬀ Tavily 联网搜索
         └─⬀ 估算兜底（未收录食物 → 二次调用模型并标注不确定性）
         │
         ▼
      SQLite（用户画像 + 对话历史）
```

**关键技术决策**：

| 决策 | 理由 |
|------|------|
| Function Calling 而非让模型直接回答 | 大模型背食物热量经常幻觉，精确数据必须走数据库 |
| SSE 状态事件设计 | 工具调用链路需 8-10 秒，无反馈的等待=流失，分阶段播报降低焦虑 |
| 模型估算必须标注"估算值" | 承认不确定性是可信 AI 的底线设计 |
| 前后端双层行缓冲 | SSE 数据被 TCP 分包切断时防丢字 |

## 📈 产品迭代

**提示词三轮数据驱动迭代**：

| 版本 | 迭代内容 | 针对问题 |
|------|----------|----------|
| v1 | 基础人设 | — |
| v2 | 输出格式约束（禁 Markdown）+ 工具使用策略 | 回复带星号、该查不查 |
| v3 | 专业约束 + 安全护栏 + 对话引导 + 弹性长度 | 编数据、疾病边界、回复冗长 |

**工程历程**：18+ 个语义化提交，从 MVP 到上线全程可回溯（`git log` 可查）。

## 🚀 本地运行

```bash
git clone https://github.com/XiaoXie-X/health-diet-agent.git
cd health-diet-agent
npm install

# 创建 .env.local 填入：
# DEEPSEEK_API_KEY=你的key
# TAVILY_API_KEY=你的key

npm run dev  # 打开 http://localhost:3000
```

## 🗺️ Roadmap

- [ ] 食物营养数据库扩充（接入中国食物成分表 / RAG 检索）
- [ ] 用户反馈闭环（点赞点踩 + bad case 分析）
- [ ] 饮食记录与周报分析
- [ ] 线上数据持久化（云数据库）
- [ ] 用户注册登录

---

*独立设计与开发 · 2026.09 - 2026.10*
