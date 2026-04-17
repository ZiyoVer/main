# DTMMax Platform — Loyiha Tarixi va Rivojlanish Jurnali

Bu fayl DTMMax platformasining rivojlanish tarixi, qilingan ishlar va rejalashtirilgan o'zgarishlarni saqlaydi. Codex va boshqa agentlar bu faylni o'qib, kontekstni tushunishi kerak.

---

## Loyiha haqida
- **Nomi:** DTMMax (oldingi nomlar: msert → BallMax → DTMMax)
- **Maqsad:** O'zbekistonda DTM va Milliy Sertifikat imtihonlariga AI yordamida tayyorlanish platformasi
- **Domain:** dtmmax.pro
- **Deploy:** Railway (backend + frontend)
- **GitHub:** https://github.com/ZiyoVer/main
- **Asoschi:** O'ktam (uktamziyodullayev189@gmail.com)

---

## Foydalanuvchilar (2026-04-13 holatiga)
- 73 ro'yxatdan o'tgan foydalanuvchi
- ~68 o'quvchi (STUDENT roli)
- Bir nechta o'qituvchi (TEACHER roli)
- 1 admin (admin@dtmmax.uz / admin@msert.uz)
- Retention past — sababi: MVP sifat yetishmasligi

---

## Texnologiya
- **Frontend:** React 19 + Vite 7 + TypeScript + Tailwind CSS v4 + Zustand + KaTeX
- **Backend:** Express 5 + Prisma 5 + PostgreSQL + JWT (7 kun) + Resend email
- **AI:** DeepSeek API (deepseek-chat, deepseek-reasoner) + GPT-4o-mini (OCR/Vision)
- **Rollar:** STUDENT, TEACHER, ADMIN

---

## Qilingan ishlar tarixi

### Bosqich 1: MVP yaratish (2025-dekabr — 2026-mart)
- Student chat UI yaratildi (ChatLayout.tsx — 3243 qator monolith)
- AI streaming (SSE) — DeepSeek API orqali
- Ro'yxatdan o'tish + JWT autentifikatsiya
- Public testlar (o'qituvchi tuzadi, o'quvchi yechadi)
- AI-generated testlar (chat ichida)
- Flashcard panel (drag-to-resize, maximize)
- Profile auto-update via AI
- Dark/Light mode
- Email verification (Resend) — ixtiyoriy (banner)
- O'qituvchi paneli: test yaratish (manual + AI/PDF), statistika
- Admin paneli: foydalanuvchilar, testlar, AI sozlamalari
- Knowledge Base RAG (admin)
- Vision AI: GPT-4o-mini OCR → DeepSeek math

### Bosqich 2: Dizayn soddalashtirish (2026-aprel boshi)
- Intro animatsiyani yengillashtirish (commit: d3ad732)
- Suhbat UX ni soddalashtirish (commit: 9e3ca6d)
- P0 xavfsizlik va stream ishonchliligini tuzatish (commit: ccaf6f5)
- Yangi chatga avtomatik AI salomlashuv qo'shish (commit: f0bc6a9)
- Bo'sh chat greetingini oddiy AI xabarga o'tkazish (commit: 3217d78)
- Telegram rail/marquee butunlay olib tashlandi — chat header soddalashdi
- Sidebar 3 ta asosiy bo'limga tushirildi: Yangi suhbat, Testlar, Natijalar
- Natijalar panelidan XP va streak olib tashlandi, aniq ko'rsatkichlar qoldi
- Quick action chiplar 6 tadan 3 taga tushirildi
- Settings modal soddalashtirildi — asosiy fan, imtihon sanasi, maqsad ball, dark mode, logout
- Intro/empty state yumshatildi — qalin border o'rniga soft surface + shadow
- Global ranglar iliqroq cream palette ga o'tkazildi
- Teacher statistika modalida savol matnlari va variantlar uchun LaTeX render yaxshilandi
- Student test variantlari click maydoni kuchaytirildi — matn/formula ustiga bosish ham javobni tanlaydi
- Teacher paneldagi formula preview ko'rinishi aniqroq qilindi — "Formula preview" bloklari bilan
- Teacher panel uchun umumiy math render helper qo'shildi — sof LaTeX (`\\frac{a}{b}` kabi) ham preview chiqadigan qilindi
- Teacher statistika PDF exporti KaTeX CSS bilan yaxshilandi — formulali savollar print/exportda ham tozaroq ko'rinadi

### Bosqich 3: To'liq audit (2026-04-13)
- Platform to'liq audit qilindi (bug-finder, security, critic agentlar orqali)
- **21 bug** topildi
- **13 xavfsizlik zaiflik** topildi
- Kod sifati bahosi: **D** (refactoring kerak)
- Chrome orqali live manual test o'tkazildi
- CODEX_BUG_FIX_PROMPT.md yozildi — buglarni tuzatish uchun
- CODEX_UI_UX_PROMPT.md yozildi — UI/UX yaxshilash uchun
- CODEX_TEACHER_PANEL_PROMPT.md yozildi — ustoz paneli yaxshilash uchun

---

## Hozirgi holat va muammolar (2026-04-17)

### Kritik muammolar:
1. **ChatLayout monolith** — Student sahifa bitta katta faylda qolmoqda, refactor kerak
2. **Teacher panel chuqur polish tugamagan** — test cardlar, batafsil o'quvchi natijasi, export tekshiruvlari hali bor
3. **Email verification ixtiyoriy** — egasi qarori bilan hozircha majburiy qilinmaydi
4. **Admin/teacher operational UX** — error state, loading state va analytics ko'rinishi hali pishitiladi

### Dizayn muammolari:
5. Landing sahifada bo'sh joy muammosi qayta tekshirildi — footer bor, issue aniq reproduksiya qilinmadi
6. Empty state va student shell ancha tozalandi, lekin umumiy information architecture hali ham soddalashtirilishi mumkin
7. Teacher statistikadagi PDF/export oqimi yaxshilandi, lekin real formulali dataset bilan yana tekshirilib turishi kerak
8. AI avtomatik salomlashuv ishlaydi, lekin copy va contextual greeting keyin yana yaxshilanishi mumkin

### Xavfsizlik muammolari:
9. `auth.ts` middleware da user `any` tipida
10. JWT secret kuchsiz bo'lishi mumkin
11. Rate limiting yetarli emas
12. Input sanitization yetishmaydi

---

## Rejalar (keyingi qadam)

### Qisqa muddatli (1-2 hafta):
1. CODEX_BUG_FIX_PROMPT.md bo'yicha buglarni tuzatish
2. CODEX_UI_UX_PROMPT.md bo'yicha dizayn yaxshilash
3. CODEX_TEACHER_PANEL_PROMPT.md bo'yicha ustoz panelini yaxshilash
4. Email verification majburiy qilish — **hozircha deferred**, owner qarori bilan keyinga qoldirilgan

### O'rta muddatli (1 oy):
5. ChatLayout.tsx ni kichik komponentlarga bo'lish (refactoring)
6. Xavfsizlik zaifliklarni tuzatish
7. Test natijalarini PDF yuklab olish
8. O'qituvchi → o'quvchi aloqa tizimi yaxshilash

### Uzoq muddatli:
9. Mobile app (React Native)
10. Pullik obuna tizimi
11. Ko'proq fanlar qo'shish
12. O'qituvchilar uchun kengaytirilgan analytics

---

## Muhim fayllar xaritasi

```
frontend/
  src/
    pages/
      Student/ChatLayout.tsx     ← Asosiy UI (3243 qator) — REFACTOR KERAK
      Teacher/TeacherPanel.tsx   ← O'qituvchi paneli
      Admin/AdminPanel.tsx       ← Admin paneli
      Landing.tsx                ← Landing sahifa
    hooks/useTestPanel.ts        ← Test panel state
    store/authStore.ts           ← Zustand auth store
    index.css                    ← Global styles + CSS variables

backend/
  src/
    routes/
      chat.ts                    ← AI streaming (SSE) + buildSystemPrompt
      tests.ts                   ← Test CRUD + Rasch model
      auth.ts                    ← Auth + email verification
      profile.ts                 ← Student profile
      notifications.ts           ← Bildirishnomalar
      knowledge.ts               ← Knowledge base (RAG)
    middleware/auth.ts            ← JWT authentication
    utils/email.ts               ← Resend email utility
  prisma/schema.prisma           ← 16 Prisma model

Prompt fayllar:
  CODEX_BUG_FIX_PROMPT.md        ← Buglarni tuzatish instruktsiyasi
  CODEX_UI_UX_PROMPT.md          ← UI/UX yaxshilash instruktsiyasi
  CODEX_TEACHER_PANEL_PROMPT.md  ← Ustoz paneli yaxshilash instruktsiyasi
  DTMMAX_HISTORY.md              ← Shu fayl — loyiha tarixi
  CLAUDE.md                      ← Claude Code uchun kontekst
```

---

## Ish tartibi
- O'ktam (asoschi) — reja tuzish, tekshirish, foydalanuvchi bilan aloqa
- Claude Code (AI) — arxitektura, audit, reja tuzish, prompt yozish
- Codex (AI) — kod yozish, buglarni tuzatish, dizayn implementatsiya
- Ishchi tartib: Claude reja tuzadi → Codex kodini yozadi → Claude tekshiradi

---

## Claude spec bo'yicha amaldagi qarorlar

### Qabul qilinganlar
- Student shell ni soddalashtirish
- Empty state ni professionalroq qilish
- Natijalar panelini ma'noli qilish
- Settings modalni minimal holatga tushirish
- Iliqroq rang palitrasiga o'tish
- Teacher statistikada LaTeX renderni yaxshilash

### Qisman qabul qilinganlar
- Teacher panelni to'liq qayta dizayn qilish — bosqichma-bosqich qilinadi
- Landing polish — real reproduksiya qilingan muammo bo'lsa alohida qilinadi

### Hozircha qoldirilganlar
- Email verification ni majburiy qilish
- Monetizatsiya yoki premium gate
- Studentga ortiqcha gamification qaytarish

---

*Oxirgi yangilanish: 2026-04-17*
