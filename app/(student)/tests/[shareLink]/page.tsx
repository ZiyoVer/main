import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db/prisma"
import TestTaker from "./TestTaker"

interface Props {
  params: { shareLink: string }
}

export const dynamic = 'force-dynamic'

export default async function TestPage({ params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const test = await prisma.test.findUnique({
    where: { shareLink: params.shareLink },
    include: { questions: { orderBy: { orderIndex: "asc" } }, subject: true },
  })

  if (!test) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-white text-xl mb-2">Test topilmadi</h1>
          <p className="text-slate-400">Bu havola noto&apos;g&apos;ri yoki muddati o&apos;tgan</p>
        </div>
      </div>
    )
  }

  return (
    <TestTaker
      test={{
        id: test.id,
        title: test.title,
        description: test.description || "",
        timeLimit: test.timeLimit,
        subject: test.subject.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        questions: test.questions.map((q: any) => ({
          id: q.id,
          type: q.type,
          questionText: q.questionText,
          options: q.options as string[] | null,
          orderIndex: q.orderIndex,
        })),
      }}
    />
  )
}
