import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/auth"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-slate-50">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-blue-600">msert</CardTitle>
          <CardDescription className="text-lg">Milliy Sertifikatga Aqlli Tayyorlov</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button asChild className="w-full h-12 text-lg">
            <a href="/login">Tizimga Kirish</a>
          </Button>
          <Button variant="outline" asChild className="w-full h-12 text-lg">
            <a href="/register">Ro'yxatdan O'tish</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
