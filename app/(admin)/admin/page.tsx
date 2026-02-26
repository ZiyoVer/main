import { prisma } from "@/lib/db/prisma"
import { Users, GraduationCap, FileText, BookOpen } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const [students, teachers, tests, docs] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "TEACHER" } }),
    prisma.test.count(),
    prisma.rAGDocument.count(),
  ])

  const recentAttempts = await prisma.testAttempt.findMany({
    take: 5,
    orderBy: { startedAt: "desc" },
    include: { user: true, test: true },
  })

  const stats = [
    { label: "O'quvchilar", value: students, icon: GraduationCap, color: "text-blue-400" },
    { label: "O'qituvchilar", value: teachers, icon: Users, color: "text-green-400" },
    { label: "Testlar", value: tests, icon: FileText, color: "text-purple-400" },
    { label: "RAG Hujjatlar", value: docs, icon: BookOpen, color: "text-orange-400" },
  ]

  return (
    <div className="p-6">
      <h1 className="text-white text-2xl font-semibold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">{s.label}</span>
              <s.icon size={18} className={s.color} />
            </div>
            <div className="text-3xl font-bold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-white font-medium">So&apos;nggi test urinishlari</h2>
        </div>
        {recentAttempts.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">Hozircha yo&apos;q</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {recentAttempts.map((a: any) => (
              <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm">{a.user.name}</p>
                  <p className="text-slate-400 text-xs">{a.test.title}</p>
                </div>
                <div className="text-right">
                  <span className="text-blue-400 font-medium text-sm">
                    {a.score != null ? `${Math.round(a.score * 100)}%` : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
