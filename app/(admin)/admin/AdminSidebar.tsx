"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { LayoutDashboard, Settings, Users, FileText, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/ai-settings", label: "AI Sozlamalar", icon: Settings },
  { href: "/admin/teachers", label: "O'qituvchilar", icon: Users },
  { href: "/admin/rag", label: "RAG Hujjatlar", icon: FileText },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <div className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <h1 className="text-white font-semibold text-sm">Admin Panel</h1>
        <p className="text-slate-400 text-xs mt-1">Milliy Sertifikat AI</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === item.href
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <item.icon size={16} />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-slate-400 hover:text-white hover:bg-slate-800 justify-start"
        >
          <LogOut size={14} className="mr-2" />
          Chiqish
        </Button>
      </div>
    </div>
  )
}
