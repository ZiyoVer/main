import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { assertSafeBranch } from './policy.js'
import type { TaskRecord } from './types.js'

interface GitResult {
  ok: boolean
  stdout: string
  stderr: string
}

function git(repoRoot: string, args: string[], cwd = repoRoot): GitResult {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
  return {
    ok: !result.error && result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.error?.message || result.stderr || '',
  }
}

function assertGit(result: GitResult, action: string): string {
  if (!result.ok) throw new Error(`${action}: ${result.stderr || result.stdout}`.trim())
  return result.stdout.trim()
}

export interface WorktreeInfo {
  path: string
  branch: string
}

export function prepareTaskWorktree(
  repoRoot: string,
  task: TaskRecord,
  agentId: string,
): WorktreeInfo {
  assertSafeBranch(task.baseBranch)
  const shortId = task.id.replace(/^task_/, '').slice(0, 8)
  const branch = `agent/${agentId}/${shortId}`
  assertSafeBranch(branch)
  const worktreesRoot = resolve(repoRoot, '.agent-room/worktrees')
  const worktreePath = resolve(worktreesRoot, `${agentId}-${shortId}`)
  mkdirSync(worktreesRoot, { recursive: true })

  if (existsSync(worktreePath)) return { path: worktreePath, branch }

  const branchExists = git(repoRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]).ok
  const args = branchExists
    ? ['worktree', 'add', worktreePath, branch]
    : ['worktree', 'add', '-b', branch, worktreePath, task.baseBranch]
  assertGit(git(repoRoot, args), 'Worktree yaratilmadi')
  return { path: worktreePath, branch }
}

function changedPaths(worktreePath: string): string[] {
  const tracked = assertGit(
    git(worktreePath, ['diff', '--name-only'], worktreePath),
    'Git diff o‘qilmadi',
  ).split('\n')
  const staged = assertGit(
    git(worktreePath, ['diff', '--cached', '--name-only'], worktreePath),
    'Staged diff o‘qilmadi',
  ).split('\n')
  const untracked = assertGit(
    git(worktreePath, ['ls-files', '--others', '--exclude-standard'], worktreePath),
    'Untracked fayllar o‘qilmadi',
  ).split('\n')
  return [...new Set([...tracked, ...staged, ...untracked].map(item => item.trim()).filter(Boolean))]
}

function isAllowed(path: string, allowedPaths: string[]): boolean {
  return allowedPaths.some(allowed => path === allowed || path.startsWith(`${allowed}/`))
}

export interface CommitResult {
  commitSha: string | null
  changedPaths: string[]
}

export function validateAndCommitTaskChanges(
  worktreePath: string,
  task: TaskRecord,
  agentId: string,
): CommitResult {
  const paths = changedPaths(worktreePath)
  const outside = paths.filter(path => !isAllowed(path, task.allowedPaths))
  if (outside.length) {
    throw new Error(`Task chegarasidan tashqari fayllar o‘zgardi: ${outside.join(', ')}`)
  }
  if (!paths.length) return { commitSha: null, changedPaths: [] }

  assertGit(git(worktreePath, ['diff', '--check'], worktreePath), 'git diff --check xato')
  assertGit(git(worktreePath, ['add', '--', ...task.allowedPaths], worktreePath), 'Fayllar stage qilinmadi')
  const message = `agent(${agentId}): ${task.title}`.slice(0, 200)
  assertGit(git(worktreePath, ['commit', '-m', message], worktreePath), 'Task commit yaratilmadi')
  const commitSha = assertGit(git(worktreePath, ['rev-parse', 'HEAD'], worktreePath), 'Commit SHA olinmadi')
  return { commitSha, changedPaths: paths }
}
