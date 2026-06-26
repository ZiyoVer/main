# DTMMax Platform — AGENTS.md
# Codex va boshqa AI toollar uchun loyiha konteksti

## Loyiha haqida
DTMMax — O'zbekistonda DTM (Davlat Test Markazi) va Milliy Sertifikat
imtihonlariga tayyorlaydigan AI-platformasi. Foydalanuvchilar DeepSeek AI
bilan o'zbek tilida suhbatlashib, testlar yechadi, flashcardlar ishlaydi.

**Domain:** www.dtmmax.uz
**Deploy:** Railway
**Til:** O'zbek (barcha UI, AI javoblar, commit messagelar)

---

## Tech Stack

| Qism | Texnologiya |
|------|-------------|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS v4 |
| Backend | Node.js, Express 5, TypeScript, Prisma 5 |
| Database | PostgreSQL (Railway) |
| AI (chat) | DeepSeek API — deepseek-chat, deepseek-reasoner |
| AI (vision) | GPT-4o-mini (OCR) → DeepSeek (math tahlil) |
| Auth | JWT 7 kun, rollar: STUDENT / TEACHER / ADMIN |
| Email | Resend (noreply@dtmmax.uz) |
| State | Zustand (auth), localStorage (test natijalar) |
| Math | KaTeX + remark-math + rehype-katex |

---

## Papka tuzilishi

```
main platforma/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Student/
│   │   │   │   ├── ChatLayout.tsx     ← ASOSIY fayl (2900+ qator)
│   │   │   │   └── TestPage.tsx       ← Ommaviy test sahifasi
│   │   │   ├── Teacher/
│   │   │   │   └── TeacherPanel.tsx   ← Test yaratish + analytics
│   │   │   ├── Admin/
│   │   │   │   └── AdminPanel.tsx     ← Boshqaruv paneli
│   │   │   └── Auth/                  ← Login, Register, Reset
│   │   ├── hooks/
│   │   │   ├── useTestPanel.ts        ← Test panel state
│   │   │   └── useFlashPanel.ts       ← Flashcard panel state
│   │   ├── store/authStore.ts         ← Zustand auth store
│   │   └── lib/api.ts                 ← fetchApi() wrapper
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── app.ts                     ← Express app + routes
│   │   ├── routes/
│   │   │   ├── chat.ts                ← AI streaming (SSE)
│   │   │   ├── tests.ts               ← Test CRUD + Rasch scoring
│   │   │   ├── auth.ts                ← Auth + email
│   │   │   ├── profile.ts             ← Student profil
│   │   │   ├── notifications.ts       ← Bildirishnomalar
│   │   │   ├── analytics.ts           ← Statistikalar
│   │   │   ├── knowledge.ts           ← Knowledge base (RAG)
│   │   │   └── aiSettings.ts          ← AI sozlamalari
│   │   ├── middleware/auth.ts         ← JWT middleware
│   │   └── utils/
│   │       ├── rasch.ts               ← Rasch model (adaptiv baholash)
│   │       ├── email.ts               ← Resend email
│   │       └── db.ts                  ← Prisma client
│   └── prisma/schema.prisma           ← 16 ta model
├── mcp-server/                        ← MCP server (Claude+Codex uchun)
│   └── src/index.ts
├── .mcp.json                          ← Claude Code MCP config
├── AGENTS.md                          ← BU FAYL (Codex uchun)
└── CLAUDE.md                          ← Claude Code uchun
```

---

## Database modellari (asosiylar)

- **User** — foydalanuvchi (STUDENT/TEACHER/ADMIN)
- **StudentProfile** — subject, examDate, abilityLevel (Rasch)
- **Chat** + **Message** — suhbat tarixi
- **Test** + **TestQuestion** + **TestAttempt** — test tizimi
- **Flashcard** — SM-2 algoritmi bilan
- **Notification** — o'qituvchi → student
- **KnowledgeItem** — RAG knowledge base
- **AISetting** — AI sozlamalari (admin)

---

## MCP Server (lokal)

Bu loyihada MCP server mavjud — Claude Code va Codex birga ishlashi uchun.

**Ishga tushirish:**
```bash
cd mcp-server
npm install
npm run build
npm start
# → http://localhost:3100
```

**Codex da ulash:**
Settings → MCP Servers → Add → `http://localhost:3100/mcp`

**Mavjud toollar:**
- `read_file` — istalgan faylni o'qish
- `list_directory` — papka tarkibi
- `search_code` — kodda qidirish (grep)
- `get_schema` — Prisma schema
- `get_routes` — barcha API endpointlar
- `get_project_info` — loyiha haqida to'liq ma'lumot
- `get_env_vars` — environment variable nomlari
- `run_safe_command` — tsc check, git status/log/diff
- `get_recent_changes` — so'nggi commitlar

---

## Muhim qoidalar

1. **Git:** Har o'zgarishdan keyin `git add → commit → push origin main`
2. **Til:** O'zbek tilida — UI matnlar, commit messagelar, izohlar
3. **TypeScript:** strict mode — `any` ishlatma
4. **Error handling:** Har bir `async` funksiyada `try/catch` bo'lsin
5. **State:** `setX(prev => ...)` funksional update ishlat — stale closure oldini ol
6. **Auth:** Har doim rolni tekshir (STUDENT/TEACHER/ADMIN)
7. **Backend:** Har route da `authenticate` middleware bo'lsin (agar kerak bo'lsa)

---

## API endpointlar (asosiylar)

```
POST   /api/auth/login              ← Login
POST   /api/auth/register           ← Ro'yxatdan o'tish
POST   /api/chat/messages           ← AI streaming (SSE)
GET    /api/tests/by-link/:link     ← Ommaviy test
POST   /api/tests/:id/submit        ← Test topshirish
POST   /api/tests/generate-ai       ← AI test generatsiya
PUT    /api/profile                 ← Profil yangilash
GET    /api/analytics/stats         ← Statistikalar (admin)
POST   /api/notifications/send      ← Bildirishnoma yuborish
```

---

## Custom markdown bloklari (ChatLayout da)

AI javoblarida maxsus bloklari bor:

````
```test [...]```           ← Interaktiv test panel (o'ng tomonda)
```flashcard [...]```      ← Flashcard panel
```profile-update {...}``` ← Profil yangilash taklifi
```essay {...}```          ← Insho yozish panel
```todo [...]```           ← Vazifalar ro'yxati
````

---

## Environment variables (backend/.env.example dan)

```
DATABASE_URL=postgresql://...
JWT_SECRET=... (min 32 belgi)
DEEPSEEK_API_KEY=sk-...
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
EMAIL_FROM=DTMMax <noreply@dtmmax.uz>
FRONTEND_URL=https://www.dtmmax.uz
ALLOWED_ORIGINS=https://www.dtmmax.uz
PORT=8080
ADMIN_EMAIL=admin@dtmmax.uz
ADMIN_PASSWORD=...
```
