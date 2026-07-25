import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { RoomStore } from './store.js'

function fixture(): { root: string; store: RoomStore } {
  const root = mkdtempSync(join(tmpdir(), 'agent-room-'))
  return {
    root,
    store: new RoomStore({
      dbPath: join(root, 'room.sqlite'),
      repoRoot: root,
    }),
  }
}

function cleanup(root: string, store: RoomStore): void {
  store.close()
  rmSync(root, { recursive: true, force: true })
}

test('main va reysh branchlarda task yaratishni bloklaydi', () => {
  const { root, store } = fixture()
  try {
    assert.throws(() => store.createTask({
      title: 'Xavfli task',
      description: 'Main branchni o‘zgartirishga urinish.',
      createdBy: 'user',
      baseBranch: 'main',
      riskLevel: 'read_only',
    }), /Himoyalangan branch/)
  } finally {
    cleanup(root, store)
  }
})

test('taskni faqat bitta agent atomik claim qiladi', () => {
  const { root, store } = fixture()
  try {
    store.registerAgent({ id: 'claude', name: 'Claude', runtime: 'claude' })
    store.registerAgent({ id: 'kimi', name: 'Kimi', runtime: 'kimi' })
    const task = store.createTask({
      title: 'Read-only audit',
      description: 'Faqat mavjud holatni dalil bilan tekshirish.',
      createdBy: 'user',
      riskLevel: 'read_only',
    })
    assert.equal(store.claimTask('claude', task.id)?.assignedTo, 'claude')
    assert.throws(() => store.claimTask('kimi', task.id), /claim qilib bo‘lmaydi/)
  } finally {
    cleanup(root, store)
  }
})

test('hierarchical file-lock parallel konfliktni bloklaydi', () => {
  const { root, store } = fixture()
  try {
    store.registerAgent({ id: 'claude', name: 'Claude', runtime: 'claude' })
    store.registerAgent({ id: 'kimi', name: 'Kimi', runtime: 'kimi' })
    const first = store.createTask({
      title: 'Progress UI',
      description: 'Progress sahifasini xavfsiz tuzatish.',
      createdBy: 'user',
      riskLevel: 'low',
      allowedPaths: ['frontend/src/pages/Student'],
    })
    const second = store.createTask({
      title: 'Progress CSS',
      description: 'Progress sahifasi CSS qismini tuzatish.',
      createdBy: 'user',
      riskLevel: 'low',
      allowedPaths: ['frontend/src/pages/Student/ProgressPage.tsx'],
    })
    store.claimTask('claude', first.id)
    store.claimTask('kimi', second.id)
    store.acquireLocks({
      taskId: first.id,
      agentId: 'claude',
      paths: ['frontend/src/pages/Student'],
    })
    assert.throws(() => store.acquireLocks({
      taskId: second.id,
      agentId: 'kimi',
      paths: ['frontend/src/pages/Student/ProgressPage.tsx'],
    }), /band/)
  } finally {
    cleanup(root, store)
  }
})

test('agent maxfiy tokenni inboxga yubora olmaydi', () => {
  const { root, store } = fixture()
  try {
    assert.throws(() => store.sendMessage({
      sender: 'claude',
      recipient: 'kimi',
      body: 'Bearer abcdefghijklmnopqrstuvwxyz123456',
    }), /maxfiy token/)
  } finally {
    cleanup(root, store)
  }
})

test('high-risk approvalni faqat human agent tasdiqlaydi', () => {
  const { root, store } = fixture()
  try {
    store.registerAgent({ id: 'user', name: 'User', runtime: 'human' })
    store.registerAgent({ id: 'claude', name: 'Claude', runtime: 'claude' })
    const task = store.createTask({
      title: 'Migration review',
      description: 'Migration faylini review qilish va xavfini yozish.',
      createdBy: 'user',
      riskLevel: 'high',
      allowedPaths: ['backend/prisma/migrations/example/migration.sql'],
    })
    store.requestApproval({
      taskId: task.id,
      action: 'high_risk_work',
      requestedBy: 'claude',
      reason: 'Migration production ma’lumotlariga ta’sir qilishi mumkin.',
    })
    assert.throws(() => store.resolveApproval({
      taskId: task.id,
      action: 'high_risk_work',
      resolvedBy: 'claude',
      status: 'approved',
    }), /faqat human/)
    assert.equal(store.resolveApproval({
      taskId: task.id,
      action: 'high_risk_work',
      resolvedBy: 'user',
      status: 'approved',
    }).status, 'approved')
  } finally {
    cleanup(root, store)
  }
})
