import { spawnSync } from 'node:child_process'
import { loadConfig } from './config.js'
import { runtimeHealth } from './runtimes.js'
import { RoomStore } from './store.js'

const config = loadConfig()
const store = new RoomStore({ dbPath: config.dbPath, repoRoot: config.repoRoot })

function git(args: string[]): { ok: boolean; output: string } {
  const result = spawnSync('git', args, {
    cwd: config.repoRoot,
    encoding: 'utf8',
    timeout: 20_000,
  })
  return {
    ok: !result.error && result.status === 0,
    output: (result.stdout || result.stderr || result.error?.message || '').trim(),
  }
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}

function ensureBuiltinAgents(): void {
  const agents = [
    { id: 'lead', name: 'Agent Room Lead', runtime: 'other' as const },
    { id: 'user', name: 'Foydalanuvchi', runtime: 'human' as const },
    { id: 'claude', name: 'Claude', runtime: 'claude' as const },
    { id: 'codex', name: 'Codex', runtime: 'codex' as const },
    { id: 'kimi', name: 'Kimi', runtime: 'kimi' as const },
  ]
  agents.forEach(agent => store.registerAgent({ ...agent, capabilities: [] }))
}

function doctor(): void {
  ensureBuiltinAgents()
  const branch = git(['branch', '--show-current'])
  const status = git(['status', '--short'])
  const checks = [
    runtimeHealth('claude', config.commands.claude),
    runtimeHealth('kimi', config.commands.kimi),
    runtimeHealth('codex', config.commands.codex),
  ]
  print({
    ok: branch.ok && branch.output !== 'main' && branch.output !== 'reysh',
    repoRoot: config.repoRoot,
    branch: branch.output,
    protectedBranches: ['main', 'reysh'],
    workingTreeDirty: Boolean(status.output),
    dbPath: config.dbPath,
    supervisorMode: config.supervisorMode,
    writesEnabled: config.allowWrites,
    runtimes: checks,
    notes: [
      'Supervisor hech qachon push yoki merge qilmaydi.',
      'Write tasklar alohida worktree va task branchda bajariladi.',
      'High-risk task uchun human approval talab qilinadi.',
    ],
  })
}

function status(): void {
  print(store.getSnapshot())
}

function createReadOnlyTask(args: string[]): void {
  const [preferredAgent, title, ...descriptionParts] = args
  const description = descriptionParts.join(' ')
  if (!preferredAgent || !title || !description) {
    throw new Error('Foydalanish: task-create <agent> <title> <description>')
  }
  ensureBuiltinAgents()
  print(store.createTask({
    title,
    description,
    createdBy: 'user',
    preferredAgent,
    riskLevel: 'read_only',
    baseBranch: 'redesign/dtmmax-v2',
    maxTurns: 6,
  }))
}

function createDemoTask(): void {
  ensureBuiltinAgents()
  print(store.createTask({
    title: 'Agent Room xavfsizlik smoke auditi',
    description: [
      'Repo va Agent Room konfiguratsiyasini read-only tekshir.',
      'main/reysh himoyasi, joriy branch va agent-room README mavjudligini dalil bilan ayt.',
      'Hech qanday faylni o‘zgartirma va test ishga tushirma.',
    ].join(' '),
    createdBy: 'user',
    preferredAgent: 'claude',
    riskLevel: 'read_only',
    priority: 90,
    maxTurns: 3,
    acceptanceCriteria: [
      'Joriy branch dalili bor',
      'Himoyalangan branchlar ko‘rsatilgan',
      'Fayl o‘zgarishi yo‘q',
    ],
  }))
}

function resolveApproval(args: string[], statusValue: 'approved' | 'rejected'): void {
  const [taskId, action, ...reasonParts] = args
  if (!taskId || !action) {
    throw new Error(`${statusValue === 'approved' ? 'approve' : 'reject'} <taskId> <action> [reason]`)
  }
  ensureBuiltinAgents()
  print(store.resolveApproval({
    taskId,
    action,
    resolvedBy: 'user',
    status: statusValue,
    reason: reasonParts.join(' '),
  }))
}

function inbox(args: string[]): void {
  const [agentId = 'lead'] = args
  print(store.readInbox(agentId, { markRead: false, limit: 200 }))
}

function requestReview(args: string[]): void {
  const [taskId, requestedBy, reviewer, ...noteParts] = args
  if (!taskId || !requestedBy || !reviewer) {
    throw new Error('review-request <taskId> <requestedBy> <reviewer> [note]')
  }
  print(store.requestReview({
    taskId,
    requestedBy,
    reviewer,
    note: noteParts.join(' ') || 'Task natijasini acceptance criteria bo‘yicha review qiling. Birinchi qatorda VERDICT yozing.',
  }))
}

function summary(): void {
  const snapshot = store.getSnapshot()
  const grouped = snapshot.tasks.reduce<Record<string, number>>((result, task) => {
    result[task.status] = (result[task.status] ?? 0) + 1
    return result
  }, {})
  print({
    generatedAt: new Date().toISOString(),
    tasks: grouped,
    agents: snapshot.agents.map(agent => ({
      id: agent.id,
      status: agent.status,
      currentTaskId: agent.currentTaskId,
      lastSeenAt: agent.lastSeenAt,
    })),
    pendingApprovals: snapshot.pendingApprovals,
    recentActivity: store.getActivity({ afterId: 0, limit: 50 }).slice(-20),
  })
}

function help(): void {
  console.log(`DTMMax Agent Room CLI

  npm run doctor
  npm run status
  node build/cli.js task-create <agent> <title> <description>
  node build/cli.js demo
  node build/cli.js inbox [agent]
  node build/cli.js review-request <taskId> <requestedBy> <reviewer> [note]
  node build/cli.js approve <taskId> <action> [reason]
  node build/cli.js reject <taskId> <action> [reason]
  node build/cli.js summary
`)
}

try {
  const [command = 'help', ...args] = process.argv.slice(2)
  switch (command) {
    case 'doctor':
      doctor()
      break
    case 'status':
      status()
      break
    case 'task-create':
      createReadOnlyTask(args)
      break
    case 'demo':
      createDemoTask()
      break
    case 'inbox':
      inbox(args)
      break
    case 'review-request':
      requestReview(args)
      break
    case 'approve':
      resolveApproval(args, 'approved')
      break
    case 'reject':
      resolveApproval(args, 'rejected')
      break
    case 'summary':
      summary()
      break
    default:
      help()
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Noma’lum CLI xatosi')
  process.exitCode = 1
} finally {
  store.close()
}
