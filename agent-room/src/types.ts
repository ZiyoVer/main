export const AGENT_RUNTIMES = ['claude', 'codex', 'kimi', 'human', 'other'] as const
export type AgentRuntime = (typeof AGENT_RUNTIMES)[number]

export const AGENT_STATUSES = ['idle', 'busy', 'offline', 'blocked'] as const
export type AgentStatus = (typeof AGENT_STATUSES)[number]

export const TASK_STATUSES = [
  'queued',
  'claimed',
  'in_progress',
  'review',
  'completed',
  'blocked',
  'cancelled',
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const RISK_LEVELS = ['read_only', 'low', 'medium', 'high', 'critical'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

export const MESSAGE_KINDS = [
  'note',
  'question',
  'answer',
  'proposal',
  'evidence',
  'result',
  'warning',
  'decision',
] as const
export type MessageKind = (typeof MESSAGE_KINDS)[number]

export const REVIEW_VERDICTS = ['pending', 'approved', 'changes_requested'] as const
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number]

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

export interface AgentRecord {
  id: string
  name: string
  runtime: AgentRuntime
  status: AgentStatus
  capabilities: string[]
  currentTaskId: string | null
  lastSeenAt: string
  createdAt: string
  updatedAt: string
}

export interface TaskRecord {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: number
  riskLevel: RiskLevel
  createdBy: string
  assignedTo: string | null
  preferredAgent: string | null
  baseBranch: string
  taskBranch: string | null
  worktreePath: string | null
  allowedPaths: string[]
  acceptanceCriteria: string[]
  maxTurns: number
  turnsUsed: number
  createdAt: string
  updatedAt: string
}

export interface MessageRecord {
  id: string
  taskId: string | null
  sender: string
  recipient: string
  kind: MessageKind
  body: string
  replyTo: string | null
  requiresResponse: boolean
  readAt: string | null
  createdAt: string
}

export interface FileLockRecord {
  path: string
  agentId: string
  taskId: string
  acquiredAt: string
  expiresAt: string
}

export interface ReviewRecord {
  id: string
  taskId: string
  reviewer: string
  verdict: ReviewVerdict
  summary: string
  commitSha: string | null
  createdAt: string
  updatedAt: string
}

export interface ApprovalRecord {
  id: string
  taskId: string
  action: string
  requestedBy: string
  status: ApprovalStatus
  resolvedBy: string | null
  reason: string
  createdAt: string
  updatedAt: string
}

export interface ActivityRecord {
  id: number
  actor: string
  type: string
  taskId: string | null
  payload: Record<string, unknown>
  createdAt: string
}

export interface CreateTaskInput {
  title: string
  description: string
  createdBy: string
  priority?: number
  riskLevel?: RiskLevel
  preferredAgent?: string | null
  baseBranch?: string
  allowedPaths?: string[]
  acceptanceCriteria?: string[]
  maxTurns?: number
}

export interface SendMessageInput {
  taskId?: string | null
  sender: string
  recipient: string
  kind?: MessageKind
  body: string
  replyTo?: string | null
  requiresResponse?: boolean
}
