import { isAbsolute, normalize, relative, resolve, sep } from 'node:path'
import type { RiskLevel, TaskRecord } from './types.js'

export const DEFAULT_BASE_BRANCH = 'redesign/dtmmax-v2'
export const PROTECTED_BRANCHES = new Set(['main', 'reysh'])

const HIGH_RISK_PATHS = [
  /^backend\/src\/routes\/billing\.ts$/,
  /^backend\/prisma\/schema\.prisma$/,
  /^backend\/prisma\/migrations\//,
  /(^|\/)\.env(?:\.|$)/,
  /^nixpacks\.toml$/,
  /^backend\/start\.sh$/,
  /^\.github\/workflows\//,
]

const CRITICAL_PATHS = [
  /^\.git\//,
  /^backend\/\.env/,
  /^frontend\/\.env/,
]

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk|re)_[A-Za-z0-9_-]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/i,
  /\b(?:JWT_SECRET|DATABASE_URL|S3_SECRET_KEY|PAYLOV_CALLBACK_PASSWORD)\s*=\s*\S+/i,
]

export function assertSafeBranch(branch: string): void {
  const normalized = branch.trim()
  if (!normalized) throw new Error('Branch bo‘sh bo‘lishi mumkin emas')
  if (PROTECTED_BRANCHES.has(normalized)) {
    throw new Error(`Himoyalangan branchga agent taski ochilmaydi: ${normalized}`)
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(normalized) || normalized.includes('..')) {
    throw new Error(`Branch nomi xavfsiz emas: ${normalized}`)
  }
}

export function normalizeRepoPath(repoRoot: string, input: string): string {
  const trimmed = input.trim().replaceAll('\\', '/')
  if (!trimmed || isAbsolute(trimmed) || trimmed.includes('\0')) {
    throw new Error(`Repo-relative yo‘l kutilgan: ${input}`)
  }
  const absolute = resolve(repoRoot, normalize(trimmed))
  const rel = relative(repoRoot, absolute)
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) {
    throw new Error(`Repo tashqarisidagi yo‘l bloklandi: ${input}`)
  }
  return rel.split(sep).join('/')
}

export function pathsConflict(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`)
}

export function classifyPaths(paths: string[]): RiskLevel {
  if (paths.some(path => CRITICAL_PATHS.some(pattern => pattern.test(path)))) return 'critical'
  if (paths.some(path => HIGH_RISK_PATHS.some(pattern => pattern.test(path)))) return 'high'
  return paths.length === 0 ? 'read_only' : 'low'
}

export function containsLikelySecret(value: string): boolean {
  return SECRET_PATTERNS.some(pattern => pattern.test(value))
}

export function redactLikelySecrets(value: string): string {
  return SECRET_PATTERNS.reduce((result, pattern) => result.replace(pattern, '[REDACTED]'), value)
}

export function assertMessageSafe(body: string): void {
  if (!body.trim()) throw new Error('Xabar bo‘sh bo‘lishi mumkin emas')
  if (body.length > 50_000) throw new Error('Xabar 50 000 belgidan oshmasligi kerak')
  if (containsLikelySecret(body)) {
    throw new Error('Xabarda maxfiy token yoki credentialga o‘xshash qiymat bor')
  }
}

export function taskNeedsHumanApproval(task: Pick<TaskRecord, 'riskLevel'>): boolean {
  return task.riskLevel === 'high' || task.riskLevel === 'critical'
}

export function canSupervisorWrite(
  task: Pick<TaskRecord, 'riskLevel'>,
  allowWrites: boolean,
  hasApproval: boolean,
): { allowed: boolean; reason?: string } {
  if (!allowWrites) return { allowed: false, reason: 'AGENT_ROOM_ALLOW_WRITES=false' }
  if (task.riskLevel === 'read_only') return { allowed: false, reason: 'Task read-only deb belgilangan' }
  if (task.riskLevel === 'critical') {
    return { allowed: false, reason: 'Critical tasklar supervisor tomonidan avtomatik bajarilmaydi' }
  }
  if (taskNeedsHumanApproval(task) && !hasApproval) {
    return { allowed: false, reason: 'High-risk task uchun foydalanuvchi tasdig‘i yo‘q' }
  }
  return { allowed: true }
}
