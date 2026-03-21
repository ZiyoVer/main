# DTMMax Platform — CLAUDE.md
# Claude Code uchun loyiha konteksti va qoidalar

## Loyiha
DTMMax — O'zbekistonda DTM va Milliy Sertifikat imtihonlariga tayyorlaydigan
AI-ta'lim platformasi. React + Express + PostgreSQL + DeepSeek AI.

**Domain:** dtmmax.pro | **Deploy:** Railway | **Branch:** main
**GitHub:** https://github.com/ZiyoVer/main

---

## MUHIM QOIDALAR (har doim amal qil)

1. **Git push:** Har qanday o'zgarishdan keyin `git add → commit → push origin main`
2. **Til:** O'zbek tilida javob ber va yoz
3. **To'liq qil:** Yuzaki qilma — boshlagan narsani oxirigacha yetkazib qo'y
4. **TypeScript:** strict, `any` ishlatma
5. **try/catch:** Har async funksiyada bo'lsin
6. **State updates:** `setX(prev => ...)` ishlat — stale closure oldini ol

---

## MCP Server

Loyihada lokal MCP server bor (Claude Code + Codex uchun):

```bash
cd mcp-server && npm start   # → localhost:3100
```

**Toollar:** read_file, list_directory, search_code, get_schema,
get_routes, get_project_info, get_env_vars, run_safe_command, get_recent_changes

---

## Muhim fayllar

```
frontend/src/pages/Student/ChatLayout.tsx     ← Asosiy UI (2900+ qator)
frontend/src/pages/Teacher/TeacherPanel.tsx   ← O'qituvchi paneli
frontend/src/pages/Admin/AdminPanel.tsx       ← Admin paneli
frontend/src/hooks/useTestPanel.ts            ← Test panel state
backend/src/routes/chat.ts                    ← AI streaming (SSE)
backend/src/routes/tests.ts                   ← Test CRUD + Rasch
backend/src/routes/auth.ts                    ← Auth + email
backend/prisma/schema.prisma                  ← 16 model
mcp-server/src/index.ts                       ← MCP server
```

---

## Tech Stack

- **Frontend:** React 19 + Vite 7 + TypeScript + Tailwind v4 + Zustand + KaTeX
- **Backend:** Express 5 + Prisma 5 + JWT + Resend + DeepSeek/OpenAI SDK
- **Database:** PostgreSQL — 16 Prisma model
- **AI:** deepseek-chat (matn), deepseek-reasoner (murakkab), gpt-4o-mini (OCR)
- **Auth:** JWT 7 kun | Rollar: STUDENT, TEACHER, ADMIN

---

## Custom AI bloklari (ChatLayout da render qilinadi)

````
```test [...]```            ← Interaktiv test (o'ng panel)
```flashcard [...]```       ← Flashcard panel
```profile-update {...}```  ← Profil yangilash
```essay {...}```           ← Insho panel
```todo [...]```            ← Vazifalar
````

---

## localStorage kalitlari

```
token                    ← JWT
dtmmax_done_tests        ← Yechilgan public test IDlari
dtmmax_done_ai_tests     ← Yechilgan AI test kalitlari
dtmmax_ans_<key>         ← AI test javoblari (500 belgi kalit)
dtmmax_correct_<id>      ← Public test to'g'ri javoblari
dtmmax_pub_ans_<id>      ← Public test foydalanuvchi javoblari
```

---

## Agents (sub-agentlar)

- `orchestrator` — to'liq platform audit
- `bug-finder` — bug qidirish
- `security` — xavfsizlik tekshiruvi
- `critic` — kod sifati

---

## Environment (Railway da keraklilar)

```
DATABASE_URL, JWT_SECRET, DEEPSEEK_API_KEY, OPENAI_API_KEY,
RESEND_API_KEY, EMAIL_FROM, FRONTEND_URL, ALLOWED_ORIGINS,
PORT, ADMIN_EMAIL, ADMIN_PASSWORD
```
