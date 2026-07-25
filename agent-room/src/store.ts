import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import {
  assertMessageSafe,
  assertSafeBranch,
  classifyPaths,
  normalizeRepoPath,
  pathsConflict,
} from './policy.js'
import type {
  ActivityRecord,
  AgentRecord,
  AgentRuntime,
  AgentStatus,
  ApprovalRecord,
  ApprovalStatus,
  CreateTaskInput,
  FileLockRecord,
  MessageRecord,
  ReviewRecord,
  ReviewVerdict,
  RiskLevel,
  SendMessageInput,
  TaskRecord,
  TaskStatus,
} from './types.js'

type DbRow = Record<string, unknown>

const RISK_RANK: Record<RiskLevel, number> = {
  read_only: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

const TASK_TRANSITIONS: Record<TaskStatus, ReadonlySet<TaskStatus>> = {
  queued: new Set(['claimed', 'blocked', 'cancelled']),
  claimed: new Set(['queued', 'in_progress', 'blocked', 'cancelled']),
  in_progress: new Set(['review', 'completed', 'blocked', 'cancelled']),
  review: new Set(['in_progress', 'completed', 'blocked', 'cancelled']),
  blocked: new Set(['queued', 'claimed', 'cancelled']),
  completed: new Set(),
  cancelled: new Set(),
}

function nowIso(): string {
  return new Date().toISOString()
}

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function asBoolean(value: unknown): boolean {
  return value === 1 || value === true
}

function mapAgent(row: DbRow): AgentRecord {
  return {
    id: asString(row.id),
    name: asString(row.name),
    runtime: asString(row.runtime) as AgentRuntime,
    status: asString(row.status) as AgentStatus,
    capabilities: parseJsonArray(row.capabilities),
    currentTaskId: asNullableString(row.current_task_id),
    lastSeenAt: asString(row.last_seen_at),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapTask(row: DbRow): TaskRecord {
  return {
    id: asString(row.id),
    title: asString(row.title),
    description: asString(row.description),
    status: asString(row.status) as TaskStatus,
    priority: asNumber(row.priority),
    riskLevel: asString(row.risk_level) as RiskLevel,
    createdBy: asString(row.created_by),
    assignedTo: asNullableString(row.assigned_to),
    preferredAgent: asNullableString(row.preferred_agent),
    baseBranch: asString(row.base_branch),
    taskBranch: asNullableString(row.task_branch),
    worktreePath: asNullableString(row.worktree_path),
    allowedPaths: parseJsonArray(row.allowed_paths),
    acceptanceCriteria: parseJsonArray(row.acceptance_criteria),
    maxTurns: asNumber(row.max_turns),
    turnsUsed: asNumber(row.turns_used),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapMessage(row: DbRow): MessageRecord {
  return {
    id: asString(row.id),
    taskId: asNullableString(row.task_id),
    sender: asString(row.sender),
    recipient: asString(row.recipient),
    kind: asString(row.kind) as MessageRecord['kind'],
    body: asString(row.body),
    replyTo: asNullableString(row.reply_to),
    requiresResponse: asBoolean(row.requires_response),
    readAt: asNullableString(row.read_at),
    createdAt: asString(row.created_at),
  }
}

function mapLock(row: DbRow): FileLockRecord {
  return {
    path: asString(row.path),
    agentId: asString(row.agent_id),
    taskId: asString(row.task_id),
    acquiredAt: asString(row.acquired_at),
    expiresAt: asString(row.expires_at),
  }
}

function mapReview(row: DbRow): ReviewRecord {
  return {
    id: asString(row.id),
    taskId: asString(row.task_id),
    reviewer: asString(row.reviewer),
    verdict: asString(row.verdict) as ReviewVerdict,
    summary: asString(row.summary),
    commitSha: asNullableString(row.commit_sha),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapApproval(row: DbRow): ApprovalRecord {
  return {
    id: asString(row.id),
    taskId: asString(row.task_id),
    action: asString(row.action),
    requestedBy: asString(row.requested_by),
    status: asString(row.status) as ApprovalStatus,
    resolvedBy: asNullableString(row.resolved_by),
    reason: asString(row.reason),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapActivity(row: DbRow): ActivityRecord {
  return {
    id: asNumber(row.id),
    actor: asString(row.actor),
    type: asString(row.type),
    taskId: asNullableString(row.task_id),
    payload: parsePayload(row.payload),
    createdAt: asString(row.created_at),
  }
}

function assertIdentifier(value: string, label: string): string {
  const normalized = value.trim()
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(normalized)) {
    throw new Error(`${label} formati noto‘g‘ri`)
  }
  return normalized
}

export interface RoomStoreOptions {
  dbPath: string
  repoRoot: string
}

export class RoomStore extends EventEmitter {
  readonly dbPath: string
  readonly repoRoot: string
  private readonly db: DatabaseSync

  constructor(options: RoomStoreOptions) {
    super()
    this.dbPath = resolve(options.dbPath)
    this.repoRoot = resolve(options.repoRoot)
    mkdirSync(dirname(this.dbPath), { recursive: true })
    this.db = new DatabaseSync(this.dbPath)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA foreign_keys = ON')
    this.db.exec('PRAGMA busy_timeout = 5000')
    this.migrate()
  }

  close(): void {
    this.db.close()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        runtime TEXT NOT NULL,
        status TEXT NOT NULL,
        capabilities TEXT NOT NULL DEFAULT '[]',
        current_task_id TEXT,
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL,
        risk_level TEXT NOT NULL,
        created_by TEXT NOT NULL,
        assigned_to TEXT,
        preferred_agent TEXT,
        base_branch TEXT NOT NULL,
        task_branch TEXT,
        worktree_path TEXT,
        allowed_paths TEXT NOT NULL DEFAULT '[]',
        acceptance_criteria TEXT NOT NULL DEFAULT '[]',
        max_turns INTEGER NOT NULL DEFAULT 6,
        turns_used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status_priority
        ON tasks(status, priority DESC, created_at ASC);

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        sender TEXT NOT NULL,
        recipient TEXT NOT NULL,
        kind TEXT NOT NULL,
        body TEXT NOT NULL,
        reply_to TEXT,
        requires_response INTEGER NOT NULL DEFAULT 0,
        read_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY(reply_to) REFERENCES messages(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_inbox
        ON messages(recipient, read_at, created_at);

      CREATE TABLE IF NOT EXISTS file_locks (
        path TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        acquired_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        reviewer TEXT NOT NULL,
        verdict TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        commit_sha TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(task_id, reviewer),
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        action TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        status TEXT NOT NULL,
        resolved_by TEXT,
        reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(task_id, action),
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT NOT NULL,
        type TEXT NOT NULL,
        task_id TEXT,
        payload TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_activity_id ON activity(id);
    `)
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = operation()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  private activity(
    actor: string,
    type: string,
    taskId: string | null,
    payload: Record<string, unknown> = {},
  ): ActivityRecord {
    const createdAt = nowIso()
    const result = this.db.prepare(`
      INSERT INTO activity(actor, type, task_id, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(actor, type, taskId, JSON.stringify(payload), createdAt)
    const record: ActivityRecord = {
      id: Number(result.lastInsertRowid),
      actor,
      type,
      taskId,
      payload,
      createdAt,
    }
    queueMicrotask(() => this.emit('activity', record))
    return record
  }

  registerAgent(input: {
    id: string
    name: string
    runtime: AgentRuntime
    capabilities?: string[]
  }): AgentRecord {
    const id = assertIdentifier(input.id, 'Agent ID')
    const name = input.name.trim()
    if (!name || name.length > 120) throw new Error('Agent nomi noto‘g‘ri')
    const timestamp = nowIso()
    const capabilities = [...new Set(input.capabilities ?? [])].slice(0, 30)
    this.db.prepare(`
      INSERT INTO agents(
        id, name, runtime, status, capabilities, current_task_id,
        last_seen_at, created_at, updated_at
      )
      VALUES (?, ?, ?, 'idle', ?, NULL, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        runtime = excluded.runtime,
        capabilities = excluded.capabilities,
        last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at
    `).run(id, name, input.runtime, JSON.stringify(capabilities), timestamp, timestamp, timestamp)
    this.activity(id, 'agent.registered', null, { runtime: input.runtime })
    return this.getAgent(id)
  }

  getAgent(id: string): AgentRecord {
    const row = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as DbRow | undefined
    if (!row) throw new Error(`Agent topilmadi: ${id}`)
    return mapAgent(row)
  }

  listAgents(): AgentRecord[] {
    const rows = this.db.prepare('SELECT * FROM agents ORDER BY name').all() as DbRow[]
    return rows.map(mapAgent)
  }

  heartbeat(agentId: string, status: AgentStatus = 'idle'): AgentRecord {
    const id = assertIdentifier(agentId, 'Agent ID')
    const timestamp = nowIso()
    const result = this.db.prepare(`
      UPDATE agents SET status = ?, last_seen_at = ?, updated_at = ? WHERE id = ?
    `).run(status, timestamp, timestamp, id)
    if (result.changes === 0) throw new Error(`Agent topilmadi: ${id}`)
    return this.getAgent(id)
  }

  createTask(input: CreateTaskInput): TaskRecord {
    const title = input.title.trim()
    const description = input.description.trim()
    if (!title || title.length > 240) throw new Error('Task sarlavhasi noto‘g‘ri')
    assertMessageSafe(description)
    const createdBy = assertIdentifier(input.createdBy, 'Task yaratuvchi')
    const baseBranch = input.baseBranch?.trim() || 'redesign/dtmmax-v2'
    assertSafeBranch(baseBranch)
    const allowedPaths = [...new Set((input.allowedPaths ?? []).map(path => (
      normalizeRepoPath(this.repoRoot, path)
    )))]
    const pathRisk = classifyPaths(allowedPaths)
    const requestedRisk = input.riskLevel ?? pathRisk
    const riskLevel = RISK_RANK[pathRisk] > RISK_RANK[requestedRisk] ? pathRisk : requestedRisk
    if (riskLevel !== 'read_only' && allowedPaths.length === 0) {
      throw new Error('Yozuvchi task uchun allowedPaths majburiy')
    }
    const priority = Math.max(0, Math.min(Math.trunc(input.priority ?? 50), 100))
    const maxTurns = Math.max(1, Math.min(Math.trunc(input.maxTurns ?? 6), 20))
    const preferredAgent = input.preferredAgent
      ? assertIdentifier(input.preferredAgent, 'Preferred agent')
      : null
    const acceptanceCriteria = (input.acceptanceCriteria ?? [])
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 30)
    const id = `task_${randomUUID()}`
    const timestamp = nowIso()

    this.db.prepare(`
      INSERT INTO tasks(
        id, title, description, status, priority, risk_level, created_by,
        assigned_to, preferred_agent, base_branch, task_branch, worktree_path,
        allowed_paths, acceptance_criteria, max_turns, turns_used, created_at, updated_at
      )
      VALUES (?, ?, ?, 'queued', ?, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      title,
      description,
      priority,
      riskLevel,
      createdBy,
      preferredAgent,
      baseBranch,
      JSON.stringify(allowedPaths),
      JSON.stringify(acceptanceCriteria),
      maxTurns,
      timestamp,
      timestamp,
    )
    this.activity(createdBy, 'task.created', id, { title, priority, riskLevel, preferredAgent })
    return this.getTask(id)
  }

  getTask(id: string): TaskRecord {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as DbRow | undefined
    if (!row) throw new Error(`Task topilmadi: ${id}`)
    return mapTask(row)
  }

  listTasks(options: { status?: TaskStatus; assignedTo?: string; limit?: number } = {}): TaskRecord[] {
    const clauses: string[] = []
    const values: SQLInputValue[] = []
    if (options.status) {
      clauses.push('status = ?')
      values.push(options.status)
    }
    if (options.assignedTo) {
      clauses.push('assigned_to = ?')
      values.push(options.assignedTo)
    }
    const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 100), 500))
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = this.db.prepare(`
      SELECT * FROM tasks ${where}
      ORDER BY priority DESC, created_at ASC
      LIMIT ?
    `).all(...values, limit) as DbRow[]
    return rows.map(mapTask)
  }

  claimTask(agentId: string, taskId?: string): TaskRecord | null {
    const agent = this.getAgent(agentId)
    return this.transaction(() => {
      const row = taskId
        ? this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as DbRow | undefined
        : this.db.prepare(`
            SELECT * FROM tasks
            WHERE status = 'queued'
              AND (preferred_agent IS NULL OR preferred_agent = ?)
            ORDER BY priority DESC, created_at ASC
            LIMIT 1
          `).get(agent.id) as DbRow | undefined
      if (!row) return null
      const task = mapTask(row)
      if (task.status !== 'queued') throw new Error(`Task claim qilib bo‘lmaydi: ${task.status}`)
      if (task.preferredAgent && task.preferredAgent !== agent.id) {
        throw new Error(`Task ${task.preferredAgent} agentiga ajratilgan`)
      }
      const timestamp = nowIso()
      const result = this.db.prepare(`
        UPDATE tasks
        SET status = 'claimed', assigned_to = ?, updated_at = ?
        WHERE id = ? AND status = 'queued'
      `).run(agent.id, timestamp, task.id)
      if (result.changes !== 1) throw new Error('Taskni boshqa agent claim qildi')
      this.db.prepare(`
        UPDATE agents
        SET status = 'busy', current_task_id = ?, last_seen_at = ?, updated_at = ?
        WHERE id = ?
      `).run(task.id, timestamp, timestamp, agent.id)
      this.activity(agent.id, 'task.claimed', task.id)
      return this.getTask(task.id)
    })
  }

  updateTaskStatus(taskId: string, actor: string, nextStatus: TaskStatus, note = ''): TaskRecord {
    const task = this.getTask(taskId)
    if (task.status !== nextStatus && !TASK_TRANSITIONS[task.status].has(nextStatus)) {
      throw new Error(`Task holati ${task.status} → ${nextStatus} o‘ta olmaydi`)
    }
    if (note) assertMessageSafe(note)
    const timestamp = nowIso()
    this.transaction(() => {
      this.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?')
        .run(nextStatus, timestamp, taskId)
      if (nextStatus === 'completed' || nextStatus === 'blocked' || nextStatus === 'cancelled') {
        this.db.prepare(`
          UPDATE agents
          SET status = ?, current_task_id = NULL, updated_at = ?
          WHERE current_task_id = ?
        `).run(nextStatus === 'blocked' ? 'blocked' : 'idle', timestamp, taskId)
        this.db.prepare('DELETE FROM file_locks WHERE task_id = ?').run(taskId)
      }
      this.activity(actor, `task.${nextStatus}`, taskId, note ? { note } : {})
    })
    return this.getTask(taskId)
  }

  requeueTask(taskId: string, actor: string, note: string, preferredAgent?: string): TaskRecord {
    assertMessageSafe(note)
    const task = this.getTask(taskId)
    if (!['claimed', 'in_progress', 'review', 'blocked'].includes(task.status)) {
      throw new Error(`Task ${task.status} holatidan requeue qilib bo‘lmaydi`)
    }
    const nextPreferred = preferredAgent
      ? assertIdentifier(preferredAgent, 'Preferred agent')
      : task.assignedTo ?? task.preferredAgent
    const timestamp = nowIso()
    this.transaction(() => {
      this.db.prepare(`
        UPDATE tasks
        SET status = 'queued', assigned_to = NULL, preferred_agent = ?, updated_at = ?
        WHERE id = ?
      `).run(nextPreferred, timestamp, taskId)
      this.db.prepare(`
        UPDATE agents
        SET status = 'idle', current_task_id = NULL, updated_at = ?
        WHERE current_task_id = ?
      `).run(timestamp, taskId)
      this.db.prepare('DELETE FROM file_locks WHERE task_id = ?').run(taskId)
      this.activity(actor, 'task.requeued', taskId, { note, preferredAgent: nextPreferred })
    })
    return this.getTask(taskId)
  }

  setTaskWorkspace(taskId: string, actor: string, taskBranch: string, worktreePath: string): TaskRecord {
    assertSafeBranch(taskBranch)
    const normalizedWorktree = resolve(worktreePath)
    const timestamp = nowIso()
    const result = this.db.prepare(`
      UPDATE tasks SET task_branch = ?, worktree_path = ?, updated_at = ? WHERE id = ?
    `).run(taskBranch, normalizedWorktree, timestamp, taskId)
    if (result.changes !== 1) throw new Error(`Task topilmadi: ${taskId}`)
    this.activity(actor, 'task.workspace_prepared', taskId, {
      taskBranch,
      worktreePath: normalizedWorktree,
    })
    return this.getTask(taskId)
  }

  incrementTaskTurn(taskId: string, actor: string): TaskRecord {
    const task = this.getTask(taskId)
    if (task.turnsUsed >= task.maxTurns) {
      throw new Error(`Task turn limiti tugagan: ${task.turnsUsed}/${task.maxTurns}`)
    }
    const timestamp = nowIso()
    this.db.prepare(`
      UPDATE tasks SET turns_used = turns_used + 1, updated_at = ? WHERE id = ?
    `).run(timestamp, taskId)
    this.activity(actor, 'task.turn_used', taskId, { turn: task.turnsUsed + 1, maxTurns: task.maxTurns })
    return this.getTask(taskId)
  }

  sendMessage(input: SendMessageInput): MessageRecord {
    const sender = assertIdentifier(input.sender, 'Sender')
    const recipient = assertIdentifier(input.recipient, 'Recipient')
    assertMessageSafe(input.body)
    if (input.taskId) this.getTask(input.taskId)
    if (input.replyTo) {
      const parent = this.db.prepare('SELECT id FROM messages WHERE id = ?').get(input.replyTo)
      if (!parent) throw new Error(`Reply xabari topilmadi: ${input.replyTo}`)
    }
    const id = `msg_${randomUUID()}`
    const createdAt = nowIso()
    this.db.prepare(`
      INSERT INTO messages(
        id, task_id, sender, recipient, kind, body, reply_to,
        requires_response, read_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `).run(
      id,
      input.taskId ?? null,
      sender,
      recipient,
      input.kind ?? 'note',
      input.body.trim(),
      input.replyTo ?? null,
      input.requiresResponse ? 1 : 0,
      createdAt,
    )
    this.activity(sender, 'message.sent', input.taskId ?? null, {
      messageId: id,
      recipient,
      kind: input.kind ?? 'note',
      requiresResponse: input.requiresResponse ?? false,
    })
    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as DbRow
    return mapMessage(row)
  }

  readInbox(agentId: string, options: { taskId?: string; markRead?: boolean; limit?: number } = {}): MessageRecord[] {
    const recipient = assertIdentifier(agentId, 'Agent ID')
    const clauses = ['recipient = ?', 'read_at IS NULL']
    const values: SQLInputValue[] = [recipient]
    if (options.taskId) {
      clauses.push('task_id = ?')
      values.push(options.taskId)
    }
    const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 50), 200))
    const rows = this.db.prepare(`
      SELECT * FROM messages
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at ASC
      LIMIT ?
    `).all(...values, limit) as DbRow[]
    if (options.markRead !== false && rows.length) {
      const timestamp = nowIso()
      const mark = this.db.prepare('UPDATE messages SET read_at = ? WHERE id = ? AND read_at IS NULL')
      this.transaction(() => {
        rows.forEach(row => mark.run(timestamp, asString(row.id)))
      })
      rows.forEach(row => { row.read_at = timestamp })
    }
    return rows.map(mapMessage)
  }

  listPendingQuestions(agentId?: string): MessageRecord[] {
    const clauses = ['read_at IS NULL', 'requires_response = 1']
    const values: SQLInputValue[] = []
    if (agentId) {
      clauses.push('recipient = ?')
      values.push(agentId)
    }
    const rows = this.db.prepare(`
      SELECT * FROM messages
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at ASC
      LIMIT 100
    `).all(...values) as DbRow[]
    return rows.map(mapMessage)
  }

  markMessageRead(messageId: string): MessageRecord {
    const timestamp = nowIso()
    const result = this.db.prepare(`
      UPDATE messages SET read_at = COALESCE(read_at, ?) WHERE id = ?
    `).run(timestamp, messageId)
    if (result.changes !== 1) throw new Error(`Xabar topilmadi: ${messageId}`)
    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as DbRow
    return mapMessage(row)
  }

  acquireLocks(input: {
    taskId: string
    agentId: string
    paths: string[]
    ttlMinutes?: number
  }): FileLockRecord[] {
    const task = this.getTask(input.taskId)
    const agentId = assertIdentifier(input.agentId, 'Agent ID')
    if (task.assignedTo && task.assignedTo !== agentId) {
      throw new Error(`Task ${task.assignedTo} agentiga tegishli`)
    }
    const paths = [...new Set(input.paths.map(path => normalizeRepoPath(this.repoRoot, path)))]
    if (!paths.length) throw new Error('Kamida bitta fayl yoki papka yo‘li kerak')
    if (task.allowedPaths.length && paths.some(path => (
      !task.allowedPaths.some(allowed => path === allowed || path.startsWith(`${allowed}/`))
    ))) {
      throw new Error('Lock taskning allowedPaths chegarasidan tashqarida')
    }
    const ttlMinutes = Math.max(1, Math.min(Math.trunc(input.ttlMinutes ?? 30), 240))
    const acquiredAt = nowIso()
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString()

    return this.transaction(() => {
      this.db.prepare('DELETE FROM file_locks WHERE expires_at <= ?').run(acquiredAt)
      const activeRows = this.db.prepare('SELECT * FROM file_locks').all() as DbRow[]
      const active = activeRows.map(mapLock)
      for (const path of paths) {
        const conflict = active.find(lock => (
          pathsConflict(path, lock.path)
          && !(lock.agentId === agentId && lock.taskId === task.id)
        ))
        if (conflict) {
          throw new Error(`${path} band: ${conflict.agentId} / ${conflict.taskId}`)
        }
      }
      const upsert = this.db.prepare(`
        INSERT INTO file_locks(path, agent_id, task_id, acquired_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          agent_id = excluded.agent_id,
          task_id = excluded.task_id,
          acquired_at = excluded.acquired_at,
          expires_at = excluded.expires_at
      `)
      paths.forEach(path => upsert.run(path, agentId, task.id, acquiredAt, expiresAt))
      this.activity(agentId, 'lock.acquired', task.id, { paths, expiresAt })
      return paths.map(path => ({ path, agentId, taskId: task.id, acquiredAt, expiresAt }))
    })
  }

  releaseLocks(input: { agentId: string; taskId: string; paths?: string[] }): number {
    const agentId = assertIdentifier(input.agentId, 'Agent ID')
    let changes = 0
    this.transaction(() => {
      if (input.paths?.length) {
        const remove = this.db.prepare(`
          DELETE FROM file_locks WHERE path = ? AND agent_id = ? AND task_id = ?
        `)
        input.paths.forEach(path => {
          changes += Number(remove.run(
            normalizeRepoPath(this.repoRoot, path),
            agentId,
            input.taskId,
          ).changes)
        })
      } else {
        changes = Number(this.db.prepare(`
          DELETE FROM file_locks WHERE agent_id = ? AND task_id = ?
        `).run(agentId, input.taskId).changes)
      }
      this.activity(agentId, 'lock.released', input.taskId, { count: changes })
    })
    return changes
  }

  listLocks(): FileLockRecord[] {
    this.db.prepare('DELETE FROM file_locks WHERE expires_at <= ?').run(nowIso())
    const rows = this.db.prepare('SELECT * FROM file_locks ORDER BY path').all() as DbRow[]
    return rows.map(mapLock)
  }

  requestReview(input: {
    taskId: string
    requestedBy: string
    reviewer: string
    commitSha?: string
    note?: string
  }): ReviewRecord {
    const task = this.getTask(input.taskId)
    const reviewer = assertIdentifier(input.reviewer, 'Reviewer')
    if (input.note) assertMessageSafe(input.note)
    const id = `review_${randomUUID()}`
    const timestamp = nowIso()
    this.db.prepare(`
      INSERT INTO reviews(
        id, task_id, reviewer, verdict, summary, commit_sha, created_at, updated_at
      )
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
      ON CONFLICT(task_id, reviewer) DO UPDATE SET
        verdict = 'pending',
        summary = excluded.summary,
        commit_sha = excluded.commit_sha,
        updated_at = excluded.updated_at
    `).run(
      id,
      task.id,
      reviewer,
      input.note ?? '',
      input.commitSha ?? null,
      timestamp,
      timestamp,
    )
    this.activity(input.requestedBy, 'review.requested', task.id, {
      reviewer,
      commitSha: input.commitSha ?? null,
    })
    this.sendMessage({
      taskId: task.id,
      sender: input.requestedBy,
      recipient: reviewer,
      kind: 'question',
      body: input.note?.trim() || `${task.title} taskini review qiling.`,
      requiresResponse: true,
    })
    return this.getReview(task.id, reviewer)
  }

  submitReview(input: {
    taskId: string
    reviewer: string
    verdict: Exclude<ReviewVerdict, 'pending'>
    summary: string
  }): ReviewRecord {
    assertMessageSafe(input.summary)
    const timestamp = nowIso()
    const result = this.db.prepare(`
      UPDATE reviews
      SET verdict = ?, summary = ?, updated_at = ?
      WHERE task_id = ? AND reviewer = ?
    `).run(input.verdict, input.summary.trim(), timestamp, input.taskId, input.reviewer)
    if (result.changes !== 1) throw new Error('Review so‘rovi topilmadi')
    this.activity(input.reviewer, `review.${input.verdict}`, input.taskId)
    return this.getReview(input.taskId, input.reviewer)
  }

  getReview(taskId: string, reviewer: string): ReviewRecord {
    const row = this.db.prepare(`
      SELECT * FROM reviews WHERE task_id = ? AND reviewer = ?
    `).get(taskId, reviewer) as DbRow | undefined
    if (!row) throw new Error('Review topilmadi')
    return mapReview(row)
  }

  listReviews(taskId: string): ReviewRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM reviews WHERE task_id = ? ORDER BY created_at
    `).all(taskId) as DbRow[]
    return rows.map(mapReview)
  }

  requestApproval(input: {
    taskId: string
    action: string
    requestedBy: string
    reason: string
  }): ApprovalRecord {
    const task = this.getTask(input.taskId)
    const action = assertIdentifier(input.action, 'Approval action')
    assertMessageSafe(input.reason)
    const id = `approval_${randomUUID()}`
    const timestamp = nowIso()
    this.db.prepare(`
      INSERT INTO approvals(
        id, task_id, action, requested_by, status, resolved_by, reason, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 'pending', NULL, ?, ?, ?)
      ON CONFLICT(task_id, action) DO UPDATE SET
        requested_by = excluded.requested_by,
        status = 'pending',
        resolved_by = NULL,
        reason = excluded.reason,
        updated_at = excluded.updated_at
    `).run(id, task.id, action, input.requestedBy, input.reason.trim(), timestamp, timestamp)
    this.activity(input.requestedBy, 'approval.requested', task.id, { action })
    return this.getApproval(task.id, action)
  }

  resolveApproval(input: {
    taskId: string
    action: string
    resolvedBy: string
    status: Exclude<ApprovalStatus, 'pending'>
    reason?: string
  }): ApprovalRecord {
    const resolver = this.getAgent(input.resolvedBy)
    if (resolver.runtime !== 'human') {
      throw new Error('Approvalni faqat human agent hal qila oladi')
    }
    const timestamp = nowIso()
    const result = this.db.prepare(`
      UPDATE approvals
      SET status = ?, resolved_by = ?, reason = ?, updated_at = ?
      WHERE task_id = ? AND action = ?
    `).run(
      input.status,
      input.resolvedBy,
      input.reason?.trim() ?? '',
      timestamp,
      input.taskId,
      input.action,
    )
    if (result.changes !== 1) throw new Error('Approval so‘rovi topilmadi')
    this.activity(input.resolvedBy, `approval.${input.status}`, input.taskId, {
      action: input.action,
    })
    return this.getApproval(input.taskId, input.action)
  }

  getApproval(taskId: string, action: string): ApprovalRecord {
    const row = this.db.prepare(`
      SELECT * FROM approvals WHERE task_id = ? AND action = ?
    `).get(taskId, action) as DbRow | undefined
    if (!row) throw new Error('Approval topilmadi')
    return mapApproval(row)
  }

  hasApprovedAction(taskId: string, action: string): boolean {
    const row = this.db.prepare(`
      SELECT 1 AS ok FROM approvals
      WHERE task_id = ? AND action = ? AND status = 'approved'
    `).get(taskId, action) as DbRow | undefined
    return row?.ok === 1
  }

  getActivity(options: { afterId?: number; limit?: number } = {}): ActivityRecord[] {
    const afterId = Math.max(0, Math.trunc(options.afterId ?? 0))
    const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 200), 1000))
    const rows = this.db.prepare(`
      SELECT * FROM activity
      WHERE id > ?
      ORDER BY id ASC
      LIMIT ?
    `).all(afterId, limit) as DbRow[]
    return rows.map(mapActivity)
  }

  getSnapshot(): {
    agents: AgentRecord[]
    tasks: TaskRecord[]
    locks: FileLockRecord[]
    pendingApprovals: ApprovalRecord[]
  } {
    const approvalRows = this.db.prepare(`
      SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at
    `).all() as DbRow[]
    return {
      agents: this.listAgents(),
      tasks: this.listTasks({ limit: 200 }),
      locks: this.listLocks(),
      pendingApprovals: approvalRows.map(mapApproval),
    }
  }
}
