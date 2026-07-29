import { resolve } from 'node:path'

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export interface RoomConfig {
  port: number
  host: string
  repoRoot: string
  dbPath: string
  token: string | null
  pollMs: number
  agentTimeoutMs: number
  maxBudgetUsd: number
  forwardAuthEnv: boolean
  allowWrites: boolean
  supervisorMode: 'plan' | 'execute'
  commands: {
    claude: string
    kimi: string
    codex: string
  }
}

export function loadConfig(): RoomConfig {
  const repoRoot = resolve(process.env.AGENT_ROOM_REPO_ROOT ?? '..')
  const dbPath = resolve(
    process.env.AGENT_ROOM_DB
      ? process.env.AGENT_ROOM_DB
      : resolve(repoRoot, '.agent-room/room.sqlite'),
  )
  const mode = process.env.AGENT_ROOM_SUPERVISOR_MODE === 'execute' ? 'execute' : 'plan'
  return {
    port: positiveInt(process.env.AGENT_ROOM_PORT, 3101),
    host: process.env.AGENT_ROOM_HOST?.trim() || '127.0.0.1',
    repoRoot,
    dbPath,
    token: process.env.AGENT_ROOM_TOKEN?.trim() || null,
    pollMs: Math.max(500, positiveInt(process.env.AGENT_ROOM_POLL_MS, 2500)),
    agentTimeoutMs: positiveInt(process.env.AGENT_ROOM_AGENT_TIMEOUT_MS, 900_000),
    maxBudgetUsd: positiveNumber(process.env.AGENT_ROOM_MAX_BUDGET_USD, 2),
    forwardAuthEnv: bool(process.env.AGENT_ROOM_FORWARD_AUTH_ENV),
    allowWrites: bool(process.env.AGENT_ROOM_ALLOW_WRITES),
    supervisorMode: mode,
    commands: {
      claude: process.env.AGENT_ROOM_CLAUDE_COMMAND?.trim() || 'claude',
      kimi: process.env.AGENT_ROOM_KIMI_COMMAND?.trim() || 'kimi',
      codex: process.env.AGENT_ROOM_CODEX_COMMAND?.trim()
        || resolve(repoRoot, 'agent-room/bin/codex-local'),
    },
  }
}

export function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === '::1' || host === 'localhost'
}
