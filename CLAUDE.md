# DTMMax Platform — CLAUDE.md
# Claude Code uchun loyiha konteksti va qoidalar

## Loyiha
DTMMax — O'zbekistonda DTM va Milliy Sertifikat imtihonlariga tayyorlaydigan
AI-ta'lim platformasi. React + Express + PostgreSQL + DeepSeek AI.

**Domain:** www.dtmmax.uz | **Deploy:** Railway | **Aktiv preview branch:** `redesign/dtmmax-v2`
**GitHub:** https://github.com/ZiyoVer/main

---

## MUHIM QOIDALAR (har doim amal qil)

1. **Git xavfsizligi:** `main` va `reysh` himoyalangan. Foydalanuvchining alohida
   ruxsatisiz ularga merge yoki push qilma. Redesign ishlari faqat
   `redesign/dtmmax-v2` preview branchida yoki Agent Room yaratgan
   `agent/<agent>/<task>` worktree branchida bajariladi. Agent task branchini
   hech qachon remote'ga o'zi push qilmaydi.
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
frontend/src/pages/Student/ChatLayout.tsx     ← Asosiy UI (5000+ qator, yuqori risk)
frontend/src/pages/Teacher/TeacherPanel.tsx   ← O'qituvchi paneli
frontend/src/pages/Admin/AdminPanel.tsx       ← Admin paneli
frontend/src/hooks/useTestPanel.ts            ← Test panel state
backend/src/routes/chat.ts                    ← AI streaming (SSE)
backend/src/routes/tests.ts                   ← Test CRUD + Rasch
backend/src/routes/auth.ts                    ← Auth + email
backend/prisma/schema.prisma                  ← 24 model
mcp-server/src/index.ts                       ← MCP server
```

---

## Tech Stack

- **Frontend:** React 19 + Vite 7 + TypeScript + Tailwind v4 + Zustand + KaTeX
- **Backend:** Express 5 + Prisma 5 + JWT + Resend + DeepSeek/OpenAI SDK
- **Database:** PostgreSQL — 24 Prisma model
- **AI:** `deepseek-v4-pro` asosiy, `deepseek-v4-flash` tezkor fallback,
  `gemini-3.5-flash` zaxira; vision/OCR Gemini orqali
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
DATABASE_URL, JWT_SECRET, DEEPSEEK_API_KEY, GEMINI_API_KEY,
RESEND_API_KEY, EMAIL_FROM, FRONTEND_URL, ALLOWED_ORIGINS,
PORT, ADMIN_EMAIL, ADMIN_PASSWORD, GOOGLE_CLIENT_ID,
# Rasm saqlash (SAVOL + CHAT RASMLARI) — Railway Bucket "sorted-toolbox" (S3-mos):
S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_ENDPOINT, S3_REGION=auto,
# To'lov (Paylov OAuth2 karta + OTP):
merchant_id, Token, PAYLOV_CONSUMER_KEY, PAYLOV_CONSUMER_SECRET,
PAYLOV_USERNAME, PAYLOV_PASSWORD,
PAYLOV_CALLBACK_LOGIN, PAYLOV_CALLBACK_PASSWORD,
BILLING_PROVIDER=paylov, PAYLOV_FLOW=oauth2,
PAYLOV_ENVIRONMENT=sandbox, PRO_ENFORCED=false, BILLING_SANDBOX_TEST=false
```

> **Paylov:** `Token` Bearer token emas — bir martalik merchant onboarding tokeni.
> U orqali yaratilgan consumer key/secret va username/password OAuth2 access
> tokenini avtomatik olish uchun backendga qo‘yiladi. Sandbox faqat
> `BILLING_SANDBOX_TEST=true` va `ADMIN` akkauntida ochiladi.
>
> **Rasm saqlash:** Railway Bucket (S3-mos, private). Kod `s3.ts` env'ni bir nechta
> nom variantida o'qiydi (S3_* | Railway ACCESS_KEY_ID/... | AWS_*). Region = `auto`.
> Eski Wasabi o'lik (hisob inactive) — qaytib ishlatma. Rasmlar o'quvchiga signed URL bilan beriladi.
