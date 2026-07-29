import { basename } from 'node:path'
import { canSupervisorWrite } from './policy.js'
import { loadConfig } from './config.js'
import { prepareTaskWorktree, validateAndCommitTaskChanges } from './gitWorktree.js'
import { runAgent, runtimeHealth, type RuntimeHealth } from './runtimes.js'
import { RoomStore } from './store.js'
import type { AgentRecord, MessageRecord, TaskRecord } from './types.js'

const config = loadConfig()
const store = new RoomStore({ dbPath: config.dbPath, repoRoot: config.repoRoot })

const AGENT_DEFINITIONS = [
  {
    id: 'claude',
    name: 'Claude',
    runtime: 'claude' as const,
    command: config.commands.claude,
    capabilities: ['audit', 'diagnostics', 'review', 'frontend', 'backend'],
  },
  {
    id: 'kimi',
    name: 'Kimi',
    runtime: 'kimi' as const,
    command: config.commands.kimi,
    capabilities: ['ui', 'ux', 'frontend', 'visual-qa'],
  },
  {
    id: 'codex',
    name: 'Codex',
    runtime: 'codex' as const,
    command: config.commands.codex,
    capabilities: ['architecture', 'backend', 'integration', 'review'],
  },
]

type AgentDefinition = (typeof AGENT_DEFINITIONS)[number]

const healthByAgent = new Map<string, RuntimeHealth>()
let stopping = false
let activeAgentId: string | null = null

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

function initializeAgents(): void {
  store.registerAgent({
    id: 'lead',
    name: 'Agent Room Lead',
    runtime: 'other',
    capabilities: ['routing', 'integration'],
  })
  store.registerAgent({
    id: 'user',
    name: 'Foydalanuvchi',
    runtime: 'human',
    capabilities: ['approval'],
  })
  for (const definition of AGENT_DEFINITIONS) {
    const health = runtimeHealth(definition.runtime, definition.command)
    healthByAgent.set(definition.id, health)
    store.registerAgent({
      id: definition.id,
      name: definition.name,
      runtime: definition.runtime,
      capabilities: definition.capabilities,
    })
    store.heartbeat(definition.id, health.available ? 'idle' : 'offline')
    log(
      health.available
        ? `${definition.name} tayyor: ${health.version}`
        : `${definition.name} ishlamaydi: ${health.error}`,
    )
  }
}

function scoreAgent(task: TaskRecord, agent: AgentDefinition): number {
  if (task.preferredAgent) return task.preferredAgent === agent.id ? 10_000 : -10_000
  const text = `${task.title} ${task.description} ${task.allowedPaths.join(' ')}`.toLowerCase()
  let score = 0
  const keywords: Record<string, string[]> = {
    kimi: ['ui', 'ux', 'css', 'design', 'frontend', 'layout', 'responsive', 'mobile'],
    claude: ['audit', 'diagnos', 'xato', 'error', 'review', 'console', 'network', 'read-only'],
    codex: ['backend', 'architecture', 'integrats', 'mcp', 'agent room', 'database', 'api'],
  }
  keywords[agent.id]?.forEach(keyword => {
    if (text.includes(keyword)) score += 5
  })
  if (task.riskLevel === 'read_only' && agent.id === 'claude') score += 2
  if (task.allowedPaths.some(path => path.endsWith('.css')) && agent.id === 'kimi') score += 4
  return score
}

function chooseAgent(task: TaskRecord): AgentDefinition | null {
  return AGENT_DEFINITIONS
    .filter(agent => healthByAgent.get(agent.id)?.available)
    .map(agent => ({ agent, score: scoreAgent(task, agent) }))
    .sort((left, right) => right.score - left.score)
    .at(0)?.agent ?? null
}

function chooseReviewer(authorId: string): AgentDefinition | null {
  const preference = authorId === 'kimi' ? ['claude', 'codex'] : ['claude', 'kimi', 'codex']
  return preference
    .filter(id => id !== authorId)
    .map(id => AGENT_DEFINITIONS.find(agent => agent.id === id))
    .find((agent): agent is AgentDefinition => Boolean(
      agent && healthByAgent.get(agent.id)?.available,
    )) ?? null
}

function taskPrompt(task: TaskRecord, agent: AgentDefinition, writeEnabled: boolean): string {
  const allowed = task.allowedPaths.length ? task.allowedPaths.map(path => `- ${path}`).join('\n') : '- read-only'
  const acceptance = task.acceptanceCriteria.length
    ? task.acceptanceCriteria.map(item => `- ${item}`).join('\n')
    : '- Task tavsifidagi natijani dalil bilan topshirish'
  return `Siz DTMMax Agent Room ichidagi ${agent.name} agentsiz.

TASK ID: ${task.id}
SARLAVHA: ${task.title}
RISK: ${task.riskLevel}
BASE BRANCH: ${task.baseBranch}

VAZIFA:
${task.description}

RUXSAT ETILGAN FAYLLAR:
${allowed}

QABUL MEZONLARI:
${acceptance}

QAT'IY QOIDALAR:
- main va reysh branchlariga tegmang.
- Hech qachon push, merge, deploy yoki production o'zgarishi qilmang.
- .env, token, credential va real foydalanuvchi ma'lumotini o'qimang yoki xabarga yozmang.
- Paylov va billing oqimiga taskda aniq ruxsat bo'lmasa tegmang.
- Boshqa agent fayl-lock qilgan yo'lga tegmang.
- ${writeEnabled
    ? 'Faqat yuqoridagi allowedPaths ichida tahrir qiling. Git commit qilmang; supervisor tekshiradi va task branchda commit qiladi.'
    : 'Bu read-only turn. Hech qanday faylni o‘zgartirmang, test data yaratmang va git holatini mutatsiya qilmang.'}
- Aniqlik yetmasa Agent Room orqali savol yuboring; taxmin bilan xavfli o'zgarish qilmang.

YAKUNIY JAVOB:
1. Natija
2. Dalil
3. O'zgargan fayllar yoki "o'zgarish yo'q"
4. Verifikatsiya
5. Qolgan blocker
`
}

function responseBody(result: Awaited<ReturnType<typeof runAgent>>): string {
  const output = result.output || '(agent matnli natija qaytarmadi)'
  // Ba'zi CLI'lar reasoning/tool trace'ni stderrga yozadi. Muvaffaqiyatli
  // turnlarda uni inboxga saqlamaymiz; faqat real process xatosida kerak.
  const stderr = !result.ok && result.stderr ? `\n\nSTDERR:\n${result.stderr}` : ''
  return `${output}${stderr}`.slice(0, 49_000)
}

function taskCanRun(task: TaskRecord): { runnable: boolean; writeEnabled: boolean; reason?: string } {
  if (task.riskLevel === 'read_only') return { runnable: true, writeEnabled: false }
  if (config.supervisorMode !== 'execute') {
    return { runnable: false, writeEnabled: false, reason: 'Supervisor plan rejimida' }
  }
  const hasApproval = store.hasApprovedAction(task.id, 'high_risk_work')
  const decision = canSupervisorWrite(task, config.allowWrites, hasApproval)
  return {
    runnable: decision.allowed,
    writeEnabled: decision.allowed,
    reason: decision.reason,
  }
}

async function executeTask(task: TaskRecord, agent: AgentDefinition, writeEnabled: boolean): Promise<void> {
  activeAgentId = agent.id
  let claimed: TaskRecord | null = null
  try {
    claimed = store.claimTask(agent.id, task.id)
    if (!claimed) return
    let cwd = config.repoRoot
    if (writeEnabled) {
      const worktree = prepareTaskWorktree(config.repoRoot, claimed, agent.id)
      claimed = store.setTaskWorkspace(claimed.id, 'lead', worktree.branch, worktree.path)
      store.acquireLocks({
        taskId: claimed.id,
        agentId: agent.id,
        paths: claimed.allowedPaths,
        ttlMinutes: Math.ceil(config.agentTimeoutMs / 60_000) + 10,
      })
      cwd = worktree.path
    }
    store.updateTaskStatus(claimed.id, agent.id, 'in_progress')
    claimed = store.incrementTaskTurn(claimed.id, agent.id)
    log(`${agent.name} taskni boshladi: ${claimed.title}`)

    const result = await runAgent({
      runtime: agent.runtime,
      command: agent.command,
      cwd,
      prompt: taskPrompt(claimed, agent, writeEnabled),
      readOnly: !writeEnabled,
      timeoutMs: config.agentTimeoutMs,
      maxBudgetUsd: config.maxBudgetUsd,
      forwardAuthEnv: config.forwardAuthEnv,
    })
    if (!result.ok) {
      store.sendMessage({
        taskId: claimed.id,
        sender: agent.id,
        recipient: 'lead',
        kind: 'warning',
        body: responseBody(result),
      })
      store.updateTaskStatus(
        claimed.id,
        agent.id,
        'blocked',
        result.timedOut ? 'Agent timeout bo‘ldi' : `Agent exit code: ${result.exitCode}`,
      )
      log(`${agent.name} taskda bloklandi: ${claimed.title}`)
      return
    }

    let commitSha: string | null = null
    let changedPaths: string[] = []
    if (writeEnabled && claimed.worktreePath) {
      const committed = validateAndCommitTaskChanges(claimed.worktreePath, claimed, agent.id)
      commitSha = committed.commitSha
      changedPaths = committed.changedPaths
    }
    store.sendMessage({
      taskId: claimed.id,
      sender: agent.id,
      recipient: 'lead',
      kind: 'result',
      body: [
        responseBody(result),
        '',
        `Agent: ${agent.name}`,
        `Worktree: ${claimed.worktreePath ?? 'read-only root'}`,
        `Commit: ${commitSha ?? 'yo‘q'}`,
        `Fayllar: ${changedPaths.join(', ') || 'o‘zgarish yo‘q'}`,
        `Davomiylik: ${result.durationMs} ms`,
      ].join('\n').slice(0, 49_000),
    })
    store.updateTaskStatus(claimed.id, agent.id, 'review')

    const reviewer = chooseReviewer(agent.id)
    if (reviewer) {
      store.requestReview({
        taskId: claimed.id,
        requestedBy: agent.id,
        reviewer: reviewer.id,
        commitSha: commitSha ?? undefined,
        note: `${claimed.title} natijasini dalil va task mezonlari bo‘yicha review qiling. Birinchi qatorda VERDICT: approved yoki VERDICT: changes_requested yozing.`,
      })
    }
    log(`${agent.name} taskni reviewga topshirdi: ${claimed.title}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Noma’lum supervisor xatosi'
    log(`${agent.name}: ${message}`)
    if (claimed) {
      try {
        store.updateTaskStatus(claimed.id, 'lead', 'blocked', message.slice(0, 1000))
      } catch {
        // Dastlabki xatoni saqlaymiz.
      }
    }
  } finally {
    if (claimed) {
      try {
        store.releaseLocks({ taskId: claimed.id, agentId: agent.id })
      } catch {
        // Expired yoki allaqachon bo‘shatilgan lock xavf emas.
      }
    }
    try {
      store.heartbeat(agent.id, healthByAgent.get(agent.id)?.available ? 'idle' : 'offline')
    } catch {
      // Supervisor loop keyingi heartbeatda tiklaydi.
    }
    activeAgentId = null
  }
}

function extractVerdict(output: string): 'approved' | 'changes_requested' | null {
  const match = output.match(/^\s*VERDICT:\s*(approved|changes_requested)\b/im)
  return match?.[1] === 'approved' || match?.[1] === 'changes_requested' ? match[1] : null
}

async function answerQuestion(message: MessageRecord, agent: AgentDefinition): Promise<void> {
  activeAgentId = agent.id
  try {
    store.markMessageRead(message.id)
    const task = message.taskId ? store.getTask(message.taskId) : null
    if (task && task.turnsUsed >= task.maxTurns) {
      if (!['completed', 'cancelled', 'blocked'].includes(task.status)) {
        store.updateTaskStatus(task.id, 'lead', 'blocked', 'Agentlararo turn limiti tugadi')
      }
      return
    }
    const cwd = task?.worktreePath ?? config.repoRoot
    if (task) store.incrementTaskTurn(task.id, agent.id)
    const prompt = `Siz DTMMax Agent Room ichidagi ${agent.name} agentsiz.
Bu faqat agentlararo read-only muhokama turni. Kodni o‘zgartirmang.

${task ? `TASK: ${task.id} — ${task.title}\n${task.description}\n` : ''}
YUBORUVCHI: ${message.sender}
XABAR:
${message.body}

Dalil bilan qisqa javob bering. Agar bu review bo‘lsa, birinchi qatorda aynan:
VERDICT: approved
yoki
VERDICT: changes_requested
yozing.`
    const result = await runAgent({
      runtime: agent.runtime,
      command: agent.command,
      cwd,
      prompt,
      readOnly: true,
      timeoutMs: config.agentTimeoutMs,
      maxBudgetUsd: config.maxBudgetUsd,
      forwardAuthEnv: config.forwardAuthEnv,
    })
    const body = responseBody(result)
    store.sendMessage({
      taskId: message.taskId,
      sender: agent.id,
      recipient: message.sender,
      kind: result.ok ? 'answer' : 'warning',
      body,
      replyTo: message.id,
    })
    if (task) {
      const verdict = extractVerdict(body)
      if (verdict) {
        try {
          store.submitReview({
            taskId: task.id,
            reviewer: agent.id,
            verdict,
            summary: body,
          })
          if (verdict === 'approved') {
            store.updateTaskStatus(task.id, agent.id, 'completed', 'Ikkinchi agent reviewdan o‘tkazdi')
            store.sendMessage({
              taskId: task.id,
              sender: agent.id,
              recipient: 'lead',
              kind: 'decision',
              body: `${task.title}: review tasdiqlandi.`,
            })
          } else {
            const requeued = store.requeueTask(
              task.id,
              agent.id,
              'Reviewer o‘zgarish so‘radi',
              task.assignedTo ?? undefined,
            )
            store.sendMessage({
              taskId: task.id,
              sender: agent.id,
              recipient: requeued.preferredAgent ?? 'lead',
              kind: 'warning',
              body: `${task.title}: reviewer o‘zgarish so‘radi.\n\n${body}`,
            })
          }
        } catch {
          // Bu oddiy savol bo‘lishi mumkin; review yozuvi majburiy emas.
        }
      }
      log(`${agent.name} ${task.title} bo‘yicha javob berdi${verdict ? `: ${verdict}` : ''}`)
    }
  } catch (error) {
    log(`${agent.name} inbox xatosi: ${error instanceof Error ? error.message : 'noma’lum'}`)
  } finally {
    store.heartbeat(agent.id, 'idle')
    activeAgentId = null
  }
}

async function tick(): Promise<void> {
  if (activeAgentId || stopping) return

  const pendingQuestions = store.listPendingQuestions()
  for (const question of pendingQuestions) {
    const agent = AGENT_DEFINITIONS.find(candidate => candidate.id === question.recipient)
    if (agent && healthByAgent.get(agent.id)?.available) {
      await answerQuestion(question, agent)
      return
    }
  }

  const queued = store.listTasks({ status: 'queued', limit: 100 })
  for (const task of queued) {
    const decision = taskCanRun(task)
    if (!decision.runnable) continue
    const agent = chooseAgent(task)
    if (!agent) continue
    await executeTask(task, agent, decision.writeEnabled)
    return
  }
}

async function main(): Promise<void> {
  initializeAgents()
  log(`Repo: ${config.repoRoot}`)
  log(`DB: ${config.dbPath}`)
  log(`Supervisor: ${config.supervisorMode}; writes=${config.allowWrites}`)
  while (!stopping) {
    await tick()
    await new Promise(resolve => setTimeout(resolve, config.pollMs))
  }
}

function shutdown(signal: string): void {
  stopping = true
  log(`${signal}: supervisor to‘xtatilmoqda${activeAgentId ? `; active=${activeAgentId}` : ''}`)
  if (!activeAgentId) {
    store.close()
    process.exit(0)
  }
  setTimeout(() => {
    store.close()
    process.exit(0)
  }, 3_000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

main().catch(error => {
  console.error(`${basename(import.meta.filename)}:`, error)
  store.close()
  process.exit(1)
})
