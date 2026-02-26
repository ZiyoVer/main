import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db/prisma"
import Link from "next/link"
import { Clock, ChevronRight, ArrowLeft } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function StudentTestsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const userId = (session.user as { id: string }).id
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    include: { subject: true },
  })

  if (!profile) redirect("/onboarding")

  const tests = await prisma.test.findMany({
    where: { isPublic: true, subjectId: profile.subjectId },
    include: {
      teacher: { include: { user: true } },
      _count: { select: { questions: true, attempts: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-slate-400 hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-white text-xl font-semibold">Ochiq testlar</h1>
            <p className="text-slate-400 text-sm">{profile.subject.name} fani bo&apos;yicha</p>
          </div>
        </div>

        {tests.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p>Hozircha ochiq testlar yo&apos;q</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {tests.map((test: any) => (
              <Link
                key={test.id}
                href={`/tests/${test.shareLink}`}
                className="block bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{test.title}</h3>
                    {test.description && (
                      <p className="text-slate-400 text-sm mt-1 line-clamp-2">{test.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {test.timeLimit} daqiqa
                      </span>
                      <span>{test._count.questions} ta savol</span>
                      <span>{test._count.attempts} ta urinish</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-600 mt-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
