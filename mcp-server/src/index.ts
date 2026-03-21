/**
 * DTMMax MCP Server
 * HTTP rejimda ishlaydi — Claude Code ham, Codex ham ulana oladi
 * Port: 3100
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express from 'express'
import cors from 'cors'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, relative, resolve } from 'path'
import { execSync } from 'child_process'
import { z } from 'zod'

const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 3100
const ROOT = resolve(join(import.meta.dirname, '../..'))   // project root

// ─── Yordamchi funksiyalar ────────────────────────────────────────────────────

/** Faylni xavfsiz o'qish */
function safeRead(filePath: string): string {
  try {
    const abs = resolve(filePath.startsWith('/') ? filePath : join(ROOT, filePath))
    if (!abs.startsWith(ROOT)) return '❌ Root dan tashqari fayl o\'qib bo\'lmaydi'
    if (!existsSync(abs)) return `❌ Fayl topilmadi: ${filePath}`
    const content = readFileSync(abs, 'utf-8')
    // 50KB dan katta faylni qisqartirish
    if (content.length > 50000) {
      return content.slice(0, 50000) + '\n\n... [qolgan qism qisqartirildi, jami ' + content.length + ' belgi]'
    }
    return content
  } catch (e: any) {
    return `❌ Xato: ${e.message}`
  }
}

/** Papkani rekursiv ro'yxatga olish */
function listDir(dirPath: string, depth = 2, current = 0): string {
  try {
    const abs = resolve(dirPath.startsWith('/') ? dirPath : join(ROOT, dirPath))
    if (!abs.startsWith(ROOT)) return '❌ Root dan tashqari'
    if (!existsSync(abs)) return `❌ Papka topilmadi: ${dirPath}`

    const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage'])
    const items = readdirSync(abs)
    let result = ''

    for (const item of items) {
      if (SKIP.has(item)) continue
      const itemPath = join(abs, item)
      const stat = statSync(itemPath)
      const indent = '  '.repeat(current)
      const rel = relative(ROOT, itemPath)

      if (stat.isDirectory()) {
        result += `${indent}📁 ${item}/\n`
        if (current < depth) {
          result += listDir(itemPath, depth, current + 1)
        }
      } else {
        const size = stat.size < 1024 ? `${stat.size}b` : `${Math.round(stat.size / 1024)}kb`
        result += `${indent}📄 ${item} (${size})\n`
      }
    }
    return result
  } catch (e: any) {
    return `❌ Xato: ${e.message}`
  }
}

/** Kodda qidirish (grep) */
function searchCode(pattern: string, dir = '', fileExt = ''): string {
  try {
    const searchDir = dir ? join(ROOT, dir) : ROOT
    const extFlag = fileExt ? `--include="*.${fileExt}"` : '--include="*.{ts,tsx,js,jsx,json,md}"'
    const cmd = `grep -r --line-number -i ${extFlag} "${pattern.replace(/"/g, '\\"')}" "${searchDir}" 2>/dev/null | head -50`
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 10000 })
    if (!result.trim()) return `"${pattern}" topilmadi`
    // Absolute path ni relative ga aylantirish
    return result.split('\n').map(line => line.replace(ROOT + '/', '')).join('\n')
  } catch (e: any) {
    if (e.status === 1) return `"${pattern}" topilmadi`
    return `❌ Xato: ${e.message}`
  }
}

// ─── MCP Server va toollar ────────────────────────────────────────────────────

function createServer(): McpServer {
  const server = new McpServer({
    name: 'dtmmax-mcp',
    version: '1.0.0',
  })

  // ── TOOL 1: read_file ──────────────────────────────────────────────────────
  server.tool(
    'read_file',
    'Loyihadagi istalgan faylni o\'qiydi',
    { path: z.string().describe('Fayl yo\'li (root dan nisbatan yoki absolut)') },
    async ({ path }) => ({
      content: [{ type: 'text', text: safeRead(path) }]
    })
  )

  // ── TOOL 2: list_directory ─────────────────────────────────────────────────
  server.tool(
    'list_directory',
    'Papka tarkibini ko\'rsatadi',
    {
      path: z.string().default('').describe('Papka yo\'li, bo\'sh bo\'lsa root ko\'rsatadi'),
      depth: z.number().default(2).describe('Rekursiya chuqurligi (1-4)')
    },
    async ({ path, depth }) => ({
      content: [{ type: 'text', text: listDir(path || ROOT, Math.min(depth, 4)) }]
    })
  )

  // ── TOOL 3: search_code ────────────────────────────────────────────────────
  server.tool(
    'search_code',
    'Loyiha kodida matn/pattern qidiradi',
    {
      pattern: z.string().describe('Qidiruv so\'zi yoki regex'),
      directory: z.string().default('').describe('Qidiruv papkasi (frontend, backend, ...)'),
      extension: z.string().default('').describe('Fayl kengaytmasi (ts, tsx, json...)')
    },
    async ({ pattern, directory, extension }) => ({
      content: [{ type: 'text', text: searchCode(pattern, directory, extension) }]
    })
  )

  // ── TOOL 4: get_schema ─────────────────────────────────────────────────────
  server.tool(
    'get_schema',
    'Prisma database schema ni to\'liq ko\'rsatadi',
    {},
    async () => ({
      content: [{ type: 'text', text: safeRead('backend/prisma/schema.prisma') }]
    })
  )

  // ── TOOL 5: get_routes ─────────────────────────────────────────────────────
  server.tool(
    'get_routes',
    'Barcha backend API routelarini va endpointlarni ko\'rsatadi',
    {},
    async () => {
      const routesDir = join(ROOT, 'backend/src/routes')
      const files = readdirSync(routesDir).filter(f => f.endsWith('.ts'))
      let result = '# DTMMax API Routes\n\n'

      for (const file of files) {
        result += `## ${file}\n`
        const content = readFileSync(join(routesDir, file), 'utf-8')
        // Faqat router.get/post/put/delete qatorlarni chiqarish
        const lines = content.split('\n')
        lines.forEach((line, i) => {
          const match = line.match(/router\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/)
          if (match) {
            result += `  ${match[1].toUpperCase()} /api/${file.replace('.ts', '')}${match[2]}\n`
          }
        })
        result += '\n'
      }
      return { content: [{ type: 'text', text: result }] }
    }
  )

  // ── TOOL 6: get_project_info ───────────────────────────────────────────────
  server.tool(
    'get_project_info',
    'DTMMax loyihasi haqida to\'liq ma\'lumot — stack, arxitektura, muhim fayllar',
    {},
    async () => {
      const info = `# DTMMax Platform — Loyiha Ma'lumoti

## Nima bu?
O'zbekistonda DTM (Davlat Test Markazi) va Milliy Sertifikat imtihonlariga
tayyorlaydigan AI-platformasi.

## Tech Stack
- **Frontend**: React 19 + Vite 7 + TypeScript + Tailwind CSS v4
- **Backend**: Node.js + Express 5 + TypeScript + Prisma 5
- **Database**: PostgreSQL (Railway da joylashgan)
- **AI**: DeepSeek API (chat/reasoning) + GPT-4o-mini (OCR/vision)
- **Auth**: JWT (7 kun), rollar: STUDENT / TEACHER / ADMIN
- **Email**: Resend (noreply@dtmmax.uz)
- **Deploy**: Railway (backend + frontend birgalikda)

## Papka tuzilishi
\`\`\`
main platforma/
├── frontend/          # React ilovasi
│   └── src/
│       ├── pages/Student/ChatLayout.tsx   ← ASOSIY (2900+ qator)
│       ├── pages/Teacher/TeacherPanel.tsx ← O'qituvchi paneli
│       ├── pages/Admin/AdminPanel.tsx     ← Admin paneli
│       └── hooks/useTestPanel.ts          ← Test panel logikasi
├── backend/           # Express server
│   ├── src/
│   │   ├── routes/chat.ts      ← AI streaming (SSE)
│   │   ├── routes/tests.ts     ← Test CRUD + Rasch scoring
│   │   ├── routes/auth.ts      ← Auth + email verification
│   │   └── utils/rasch.ts      ← Rasch model (adaptiv baholash)
│   └── prisma/schema.prisma    ← 16 ta model
└── mcp-server/        ← BU SERVER (Claude Code + Codex uchun)
\`\`\`

## Rollar va ruxsatlar
- STUDENT: chat, testlar, flashcardlar, profil
- TEACHER: test yaratish, analytics, bildirishnomalar
- ADMIN: hammasi + foydalanuvchilar, AI sozlamalari

## Muhim konstantalar
- Admin email: admin@dtmmax.uz
- Frontend URL: https://dtmmax.pro
- JWT muddati: 7 kun
- AI model (chat): deepseek-chat
- AI model (reasoning): deepseek-reasoner
- Vision model: gpt-4o-mini
`
      return { content: [{ type: 'text', text: info }] }
    }
  )

  // ── TOOL 7: get_env_vars ───────────────────────────────────────────────────
  server.tool(
    'get_env_vars',
    'Kerakli environment variable larni (nomlarini) ko\'rsatadi — qiymatlarini emas',
    {},
    async () => ({
      content: [{ type: 'text', text: safeRead('backend/.env.example') }]
    })
  )

  // ── TOOL 8: run_safe_command ───────────────────────────────────────────────
  server.tool(
    'run_safe_command',
    'Xavfsiz buyruqlarni bajaradi: tsc --noEmit, git status, git log, git diff',
    {
      command: z.enum([
        'tsc-check-backend',
        'tsc-check-frontend',
        'git-status',
        'git-log',
        'git-diff'
      ]).describe('Bajarilishi mumkin bo\'lgan buyruq')
    },
    async ({ command }) => {
      const commands: Record<string, { cmd: string; cwd: string }> = {
        'tsc-check-backend': { cmd: 'npx tsc --noEmit 2>&1 | head -50', cwd: join(ROOT, 'backend') },
        'tsc-check-frontend': { cmd: 'npx tsc --noEmit 2>&1 | head -50', cwd: join(ROOT, 'frontend') },
        'git-status': { cmd: 'git status', cwd: ROOT },
        'git-log': { cmd: 'git log --oneline -20', cwd: ROOT },
        'git-diff': { cmd: 'git diff --stat HEAD~1', cwd: ROOT },
      }
      const { cmd, cwd } = commands[command]
      try {
        const result = execSync(cmd, { encoding: 'utf-8', cwd, timeout: 30000 })
        return { content: [{ type: 'text', text: result || '✅ (chiqish yo\'q — xato yo\'q)' }] }
      } catch (e: any) {
        return { content: [{ type: 'text', text: e.stdout || e.message }] }
      }
    }
  )

  // ── TOOL 9: get_recent_changes ─────────────────────────────────────────────
  server.tool(
    'get_recent_changes',
    'So\'nggi git commitlar va o\'zgartirilgan fayllarni ko\'rsatadi',
    {
      count: z.number().default(5).describe('Ko\'rsatiladigan commitlar soni')
    },
    async ({ count }) => {
      try {
        const log = execSync(
          `git log --oneline -${Math.min(count, 20)} && echo "---" && git diff --name-only HEAD~1 2>/dev/null`,
          { encoding: 'utf-8', cwd: ROOT, timeout: 10000 }
        )
        return { content: [{ type: 'text', text: log }] }
      } catch (e: any) {
        return { content: [{ type: 'text', text: e.message }] }
      }
    }
  )

  return server
}

// ─── Express HTTP server ──────────────────────────────────────────────────────

const app = express()
app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'dtmmax-mcp',
    version: '1.0.0',
    tools: [
      'read_file', 'list_directory', 'search_code',
      'get_schema', 'get_routes', 'get_project_info',
      'get_env_vars', 'run_safe_command', 'get_recent_changes'
    ],
    port: PORT
  })
})

// MCP endpoint — har so'rov uchun yangi transport
app.post('/mcp', async (req, res) => {
  const server = createServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,  // stateless
  })
  res.on('close', () => server.close())
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
})

app.get('/mcp', async (req, res) => {
  const server = createServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  res.on('close', () => server.close())
  await server.connect(transport)
  await transport.handleRequest(req, res)
})

app.delete('/mcp', async (req, res) => {
  res.status(405).json({ error: 'DELETE supported emas' })
})

app.listen(PORT, () => {
  console.log(`\n🚀 DTMMax MCP Server ishga tushdi`)
  console.log(`   Port: http://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/health`)
  console.log(`   MCP endpoint: http://localhost:${PORT}/mcp`)
  console.log(`\n   Claude Code: .mcp.json ga url qo'shing`)
  console.log(`   Codex: Settings > MCP > http://localhost:${PORT}/mcp\n`)
})
