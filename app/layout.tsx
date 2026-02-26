import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Milliy Sertifikat AI Platforma",
  description: "AI yordamida Milliy Sertifikatga tayyorlanish platformasi",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  )
}
