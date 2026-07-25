import { timingSafeEqual } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { isLoopbackHost, loadConfig } from './config.js'
import { RoomStore } from './store.js'
import {
  AGENT_RUNTIMES,
  AGENT_STATUSES,
  MESSAGE_KINDS,
  RISK_LEVELS,
  TASK_STATUSES,
} from './types.js'

const config = loadConfig()
if (!isLoopbackHost(config.host) && !config.token) {
  throw new Error('Loopback tashqarisida AGENT_ROOM_TOKEN majburiy')
}

const store = new RoomStore({ dbPath: config.dbPath, repoRoot: config.repoRoot })

function jsonText(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  }
}

async function safeTool(operation: () => unknown | Promise<unknown>): Promise<{
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}> {
  try {
    return jsonText(await operation())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Noma’lum xato'
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
      isError: true,
    }
  }
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'dtmmax-agent-room',
    version: '0.1.0',
  })

  server.tool(
    'room_register_agent',
    'Agent Room agentini ro‘yxatdan o‘tkazadi yoki heartbeat ma’lumotini yangilaydi',
    {
      id: z.string().describe('Barqaror agent ID: claude, codex, kimi'),
      name: z.string(),
      runtime: z.enum(AGENT_RUNTIMES),
      capabilities: z.array(z.string()).default([]),
    },
    async input => safeTool(() => store.registerAgent(input)),
  )

  server.tool(
    'room_heartbeat',
    'Agent holatini va lastSeen vaqtini yangilaydi',
    {
      agentId: z.string(),
      status: z.enum(AGENT_STATUSES).default('idle'),
    },
    async ({ agentId, status }) => safeTool(() => store.heartbeat(agentId, status)),
  )

  server.tool(
    'room_create_task',
    'Himoyalangan main/reysh branchlaridan tashqarida task yaratadi',
    {
      title: z.string(),
      description: z.string(),
      createdBy: z.string(),
      priority: z.number().int().min(0).max(100).default(50),
      riskLevel: z.enum(RISK_LEVELS).default('read_only'),
      preferredAgent: z.string().nullable().default(null),
      baseBranch: z.string().default('redesign/dtmmax-v2'),
      allowedPaths: z.array(z.string()).default([]),
      acceptanceCriteria: z.array(z.string()).default([]),
      maxTurns: z.number().int().min(1).max(20).default(6),
    },
    async input => safeTool(() => store.createTask(input)),
  )

  server.tool(
    'room_list_tasks',
    'Task navbatini priority tartibida ko‘rsatadi',
    {
      status: z.enum(TASK_STATUSES).optional(),
      assignedTo: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async input => safeTool(() => store.listTasks(input)),
  )

  server.tool(
    'room_claim_task',
    'Queued taskni atomik ravishda bitta agentga biriktiradi',
    {
      agentId: z.string(),
      taskId: z.string().optional(),
    },
    async ({ agentId, taskId }) => safeTool(() => store.claimTask(agentId, taskId)),
  )

  server.tool(
    'room_update_task',
    'Task statusini ruxsat etilgan state-machine bo‘yicha yangilaydi',
    {
      taskId: z.string(),
      actor: z.string(),
      status: z.enum(TASK_STATUSES),
      note: z.string().default(''),
    },
    async ({ taskId, actor, status, note }) => (
      safeTool(() => store.updateTaskStatus(taskId, actor, status, note))
    ),
  )

  server.tool(
    'room_send_message',
    'Agentga taskga bog‘langan xabar, savol, dalil yoki qaror yuboradi',
    {
      taskId: z.string().nullable().default(null),
      sender: z.string(),
      recipient: z.string(),
      kind: z.enum(MESSAGE_KINDS).default('note'),
      body: z.string(),
      replyTo: z.string().nullable().default(null),
      requiresResponse: z.boolean().default(false),
    },
    async input => safeTool(() => store.sendMessage(input)),
  )

  server.tool(
    'room_read_inbox',
    'Agentning o‘qilmagan xabarlarini oladi',
    {
      agentId: z.string(),
      taskId: z.string().optional(),
      markRead: z.boolean().default(true),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ agentId, taskId, markRead, limit }) => (
      safeTool(() => store.readInbox(agentId, { taskId, markRead, limit }))
    ),
  )

  server.tool(
    'room_lock_files',
    'Task agenti fayl/papkalarni vaqtincha lock qiladi va parallel konfliktni bloklaydi',
    {
      taskId: z.string(),
      agentId: z.string(),
      paths: z.array(z.string()).min(1),
      ttlMinutes: z.number().int().min(1).max(240).default(30),
    },
    async input => safeTool(() => store.acquireLocks(input)),
  )

  server.tool(
    'room_unlock_files',
    'Agentning task bo‘yicha locklarini bo‘shatadi',
    {
      taskId: z.string(),
      agentId: z.string(),
      paths: z.array(z.string()).optional(),
    },
    async input => safeTool(() => ({ released: store.releaseLocks(input) })),
  )

  server.tool(
    'room_request_review',
    'Boshqa agentdan commit yoki task reviewini so‘raydi',
    {
      taskId: z.string(),
      requestedBy: z.string(),
      reviewer: z.string(),
      commitSha: z.string().optional(),
      note: z.string().optional(),
    },
    async input => safeTool(() => store.requestReview(input)),
  )

  server.tool(
    'room_submit_review',
    'Reviewer tasdiq yoki changes_requested xulosasini yuboradi',
    {
      taskId: z.string(),
      reviewer: z.string(),
      verdict: z.enum(['approved', 'changes_requested']),
      summary: z.string(),
    },
    async input => safeTool(() => store.submitReview(input)),
  )

  server.tool(
    'room_request_approval',
    'High-risk yoki preview integration harakati uchun inson tasdig‘ini so‘raydi',
    {
      taskId: z.string(),
      action: z.string(),
      requestedBy: z.string(),
      reason: z.string(),
    },
    async input => safeTool(() => store.requestApproval(input)),
  )

  server.tool(
    'room_activity',
    'Agent Room audit jurnalini incremental o‘qiydi',
    {
      afterId: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(1000).default(200),
    },
    async input => safeTool(() => store.getActivity(input)),
  )

  server.tool(
    'room_snapshot',
    'Agentlar, tasklar, locklar va pending approval holatini ko‘rsatadi',
    {},
    async () => safeTool(() => store.getSnapshot()),
  )

  return server
}

function constantTimeMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!config.token) {
    next()
    return
  }
  const authorization = req.headers.authorization ?? ''
  if (constantTimeMatch(authorization, `Bearer ${config.token}`)) {
    next()
    return
  }
  res.status(401).json({ error: 'Agent Room token noto‘g‘ri' })
}

const app = express()
app.disable('x-powered-by')
app.use(cors({ origin: false }))
app.use(express.json({ limit: '256kb' }))

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'dtmmax-agent-room',
    version: '0.1.0',
    host: config.host,
    protectedBranches: ['main', 'reysh'],
    supervisorMode: config.supervisorMode,
    writesEnabled: config.allowWrites,
  })
})

app.get('/api/snapshot', requireAuth, (_req, res) => {
  res.json(store.getSnapshot())
})

app.get('/events', requireAuth, (req, res) => {
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let cursor = Math.max(0, Number.parseInt(String(req.query.afterId ?? '0'), 10) || 0)
  const sendNewEvents = () => {
    const events = store.getActivity({ afterId: cursor, limit: 200 })
    events.forEach(event => {
      cursor = Math.max(cursor, event.id)
      res.write(`id: ${event.id}\n`)
      res.write(`event: ${event.type}\n`)
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    })
  }
  sendNewEvents()
  const poll = setInterval(sendNewEvents, 1000)
  const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 20_000)
  req.on('close', () => {
    clearInterval(poll)
    clearInterval(keepAlive)
  })
})

app.post('/mcp', requireAuth, async (req, res) => {
  const server = createMcpServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => server.close())
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
})

app.get('/mcp', requireAuth, async (req, res) => {
  const server = createMcpServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => server.close())
  await server.connect(transport)
  await transport.handleRequest(req, res)
})

app.delete('/mcp', requireAuth, (_req, res) => {
  res.status(405).json({ error: 'DELETE qo‘llanmaydi' })
})

const httpServer = app.listen(config.port, config.host, () => {
  console.log(`Agent Room: http://${config.host}:${config.port}`)
  console.log(`MCP: http://${config.host}:${config.port}/mcp`)
  console.log(`DB: ${config.dbPath}`)
  if (!config.token) {
    console.warn('Ogohlantirish: token yo‘q; server faqat loopback uchun ochiq.')
  }
})

function shutdown(signal: string): void {
  console.log(`${signal}: Agent Room to‘xtatilmoqda`)
  httpServer.close(() => {
    store.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 5_000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
