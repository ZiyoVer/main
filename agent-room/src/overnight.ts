import { spawn, type ChildProcess } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const buildDir = dirname(fileURLToPath(import.meta.url))
const agentRoomRoot = dirname(buildDir)
const children = new Set<ChildProcess>()
let stopping = false

function start(name: string, file: string): ChildProcess {
  const child = spawn(process.execPath, [file], {
    cwd: agentRoomRoot,
    env: { ...process.env, NO_COLOR: '1' },
    stdio: 'inherit',
  })
  children.add(child)
  child.on('exit', (code, signal) => {
    children.delete(child)
    if (!stopping) {
      console.error(`${name} kutilmaganda to‘xtadi: code=${code} signal=${signal}`)
      shutdown('child-exit', code ?? 1)
    }
  })
  return child
}

function shutdown(signal: string, exitCode = 0): void {
  if (stopping) return
  stopping = true
  console.log(`${signal}: Agent Room processlari to‘xtatilmoqda`)
  children.forEach(child => child.kill('SIGTERM'))
  const hardStop = setTimeout(() => {
    children.forEach(child => child.kill('SIGKILL'))
    process.exit(exitCode)
  }, 5_000)
  hardStop.unref()
  const wait = setInterval(() => {
    if (children.size === 0) {
      clearInterval(wait)
      clearTimeout(hardStop)
      process.exit(exitCode)
    }
  }, 100)
  wait.unref()
}

start('server', `${buildDir}/server.js`)
setTimeout(() => {
  if (!stopping) start('supervisor', `${buildDir}/supervisor.js`)
}, 750)

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
