import { spawn, spawnSync } from 'node:child_process'
import { redactLikelySecrets } from './policy.js'
import type { AgentRuntime } from './types.js'

export interface RuntimeHealth {
  runtime: Exclude<AgentRuntime, 'human' | 'other'>
  command: string
  available: boolean
  version: string
  error?: string
}

export interface AgentRunOptions {
  runtime: Exclude<AgentRuntime, 'human' | 'other'>
  command: string
  cwd: string
  prompt: string
  readOnly: boolean
  timeoutMs: number
  maxBudgetUsd: number
  forwardAuthEnv: boolean
}

export interface AgentRunResult {
  ok: boolean
  exitCode: number | null
  output: string
  stderr: string
  durationMs: number
  timedOut: boolean
}

const MAX_OUTPUT_BYTES = 512 * 1024

function safeBaseEnvironment(): NodeJS.ProcessEnv {
  const allowedKeys = [
    'PATH',
    'HOME',
    'USER',
    'LOGNAME',
    'SHELL',
    'TMPDIR',
    'LANG',
    'LC_ALL',
    'TERM',
    'COLORTERM',
    'XDG_CONFIG_HOME',
    'XDG_CACHE_HOME',
    'XDG_DATA_HOME',
    'CODEX_HOME',
    'CLAUDE_CONFIG_DIR',
  ]
  return Object.fromEntries(
    allowedKeys
      .map(key => [key, process.env[key]])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function agentEnvironment(options: AgentRunOptions): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...safeBaseEnvironment(),
    NO_COLOR: '1',
    CI: '1',
    AGENT_ROOM_AGENT_ID: options.runtime,
  }
  if (!options.forwardAuthEnv) return env
  const authKeys: Record<AgentRunOptions['runtime'], string[]> = {
    claude: ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'],
    kimi: ['KIMI_API_KEY', 'MOONSHOT_API_KEY'],
    codex: ['OPENAI_API_KEY'],
  }
  authKeys[options.runtime].forEach(key => {
    if (process.env[key]) env[key] = process.env[key]
  })
  return env
}

function compactVersion(value: string): string {
  return value.trim().split('\n').slice(0, 2).join(' · ').slice(0, 300)
}

export function runtimeHealth(
  runtime: Exclude<AgentRuntime, 'human' | 'other'>,
  command: string,
): RuntimeHealth {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    timeout: 15_000,
    env: { ...safeBaseEnvironment(), NO_COLOR: '1' },
  })
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout || `exit ${result.status}`
    return {
      runtime,
      command,
      available: false,
      version: '',
      error: redactLikelySecrets(String(detail).trim()).slice(0, 1000),
    }
  }
  return {
    runtime,
    command,
    available: true,
    version: compactVersion(result.stdout || result.stderr),
  }
}

function runtimeArgs(options: AgentRunOptions): string[] {
  switch (options.runtime) {
    case 'claude':
      return [
        '-p',
        '--output-format',
        'json',
        '--permission-mode',
        options.readOnly ? 'plan' : 'acceptEdits',
        '--max-budget-usd',
        String(options.maxBudgetUsd),
        options.prompt,
      ]
    case 'kimi':
      return [
        ...(options.readOnly ? [] : ['--auto']),
        '--prompt',
        options.prompt,
        '--output-format',
        'text',
      ]
    case 'codex':
      return [
        'exec',
        '--json',
        '--sandbox',
        options.readOnly ? 'read-only' : 'workspace-write',
        options.prompt,
      ]
  }
}

function extractClaudeResult(stdout: string): string {
  try {
    const parsed: unknown = JSON.parse(stdout)
    if (parsed && typeof parsed === 'object' && 'result' in parsed) {
      const result = (parsed as { result?: unknown }).result
      if (typeof result === 'string') return result
    }
  } catch {
    // Raw output foydaliroq; parse xatosini yashiramiz.
  }
  return stdout
}

export async function runAgent(options: AgentRunOptions): Promise<AgentRunResult> {
  const startedAt = Date.now()
  const args = runtimeArgs(options)
  return await new Promise(resolve => {
    const child = spawn(options.command, args, {
      cwd: options.cwd,
      env: agentEnvironment(options),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let outputBytes = 0
    let timedOut = false
    let settled = false

    const finish = (exitCode: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      const rawOutput = options.runtime === 'claude' ? extractClaudeResult(stdout) : stdout
      resolve({
        ok: exitCode === 0 && !timedOut,
        exitCode,
        output: redactLikelySecrets(rawOutput.trim()).slice(0, MAX_OUTPUT_BYTES),
        stderr: redactLikelySecrets(stderr.trim()).slice(0, 50_000),
        durationMs: Date.now() - startedAt,
        timedOut,
      })
    }

    const append = (target: 'stdout' | 'stderr', chunk: Buffer) => {
      outputBytes += chunk.byteLength
      if (outputBytes > MAX_OUTPUT_BYTES) {
        stderr += '\nAgent output limiti oshdi; process to‘xtatildi.'
        child.kill('SIGTERM')
        return
      }
      if (target === 'stdout') stdout += chunk.toString('utf8')
      else stderr += chunk.toString('utf8')
    }

    child.stdout.on('data', (chunk: Buffer) => append('stdout', chunk))
    child.stderr.on('data', (chunk: Buffer) => append('stderr', chunk))
    child.on('error', error => {
      stderr += `\n${error.message}`
      finish(null)
    })
    child.on('close', code => finish(code))

    const timeout = setTimeout(() => {
      timedOut = true
      stderr += `\nTimeout: ${options.timeoutMs} ms`
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 5_000).unref()
    }, options.timeoutMs)
    timeout.unref()
  })
}
