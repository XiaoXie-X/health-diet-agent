 import Database from 'better-sqlite3'
  import path from 'path'
 interface User {
    id: number
    session_id: string
    age: number | null
    gender: string | null
    height: number | null
    weight: number | null
    goal: string | null
    allergies: string | null
    dislikes: string | null
  }
  // 数据库文件路径：本地用 data/app.db；Vercel 文件系统只读，改用 /tmp（不持久，冷启动重置）
  const dbPath = process.env.VERCEL ? '/tmp/app.db' : path.join(process.cwd(), 'data', 'app.db')

  // 创建数据库连接
  const db = new Database(dbPath)

  // 开启WAL模式，提高并发性能
  db.pragma('journal_mode = WAL')

  // 初始化用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      age INTEGER,
      gender TEXT,
      height REAL,
      weight REAL,
      goal TEXT,
      allergies TEXT,
      dislikes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 初始化对话历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 用户相关操作
  export const userDb = {
    // 获取或创建用户
     getOrCreate(sessionId: string): User {
    let user = db.prepare('SELECT * FROM users WHERE session_id = ?').get(sessionId) as User | undefined
    if (!user) {
      db.prepare('INSERT INTO users (session_id) VALUES (?)').run(sessionId)
      user = db.prepare('SELECT * FROM users WHERE session_id = ?').get(sessionId) as User
    }
    return user
  },

    // 更新用户画像
    update(sessionId: string, data: {
      age?: number,
      gender?: string,
      height?: number,
      weight?: number,
      goal?: string,
      allergies?: string,
      dislikes?: string
    }) {
      const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
      const values = Object.values(data)
      db.prepare(`UPDATE users SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?`)
        .run(...values, sessionId)
    }
  }

  // 消息相关操作
  export const messageDb = {
    // 获取对话历史
    getHistory(sessionId: string, limit = 20) {
      return db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?')
        .all(sessionId, limit)
        .reverse()
    },

    // 保存消息
    save(sessionId: string, role: string, content: string) {
      db.prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)')
        .run(sessionId, role, content)
    }
  }

  export default db