# DTMMax Preview Redesign — Living Handoff

> Oxirgi yangilanish: 2026-07-25
> Aktiv branch: `redesign/dtmmax-v2`  
> Preview: `https://main-main-pr-1.up.railway.app`

Bu hujjat Codex, Claude va boshqa AI agentlar DTMMax redesignini kontekstsiz
taxmin bilan davom ettirmasligi uchun yozildi. U bajarilgan ishlar, qarorlarning
sababi, xavfsizlik chegaralari va keyingi tekshiruvlarni bitta joyda saqlaydi.
Har katta qarordan keyin hujjatni yangilash kerak.

## 1. Git va deploy xavfsizligi

- Redesign faqat `redesign/dtmmax-v2` branchida bajariladi.
- `main` production branch va `reysh` tagi — redesigndan oldingi qaytish nuqtasi.
- Foydalanuvchi alohida tasdiqlamaguncha `main`ga merge yoki push qilinmaydi.
- Preview Railway muhiti productiondan ajratilgan bo‘lishi shart.
  Backend buni `PREVIEW_ISOLATION_CONFIRMED=true` bilan tekshiradi.
- `design/08-heuristic-evaluation.md` dagi mavjud dirty o‘zgarish foydalanuvchiga
  tegishli. Uni stage, reset yoki commit qilish mumkin emas.
- Paylov oqimi support rasmiy sandbox kartasi va kerakli payment flow’ni
  tasdiqlamaguncha funksional jihatdan o‘zgartirilmaydi.

## 2. Product maqsadi

DTMMax generic AI chat emas. U o‘quvchining:

1. boshlang‘ich darajasini aniqlaydi;
2. imtihongacha reja tuzadi;
3. kerakli prerequisite bilimlarni tekshiradi;
4. mavzuni bosqichma-bosqich tushuntiradi;
5. chat ichida matn to‘kib tashlamasdan interaktiv mashq va test beradi;
6. xatodan keyin keyingi aniq qadamni ko‘rsatadi.

Asosiy muvaffaqiyat mezoni: foydalanuvchi har kirganda “endi nima qilaman?” deb
qolmasligi.

## 3. Rollar bo‘yicha axborot arxitekturasi

### Student

`Bugun → O‘rganish → Testlar → AI ustoz → Progress`

- Bosh ekran vazifa va keyingi harakatni birinchi ko‘rsatadi.
- AI chat — alohida maqsad emas, o‘quv oqimini boshqaruvchi ustoz.
- Test natijasi ball bilan tugamaydi; zaif mavzu va keyingi mashqni beradi.

### Teacher

`Umumiy → O‘quvchilar → Test yaratish → Materiallar → Analitika`

- PDF, DOCX va rasmdan test yaratish tushunarli bitta oqim bo‘lishi kerak.
- AI yaratgan savollar publishdan oldin tahrir va tekshiruvdan o‘tadi.
- Rasmli savollar o‘qituvchi va o‘quvchi ekranida bir xil mazmunda ko‘rinadi.

### Admin

`Statistika → Foydalanuvchilar → Kontent → To‘lovlar → AI boshqaruvi → Audit`

- Admin operatsiyasi natijasi aniq status bilan qaytadi.
- Destruktiv, billing va permission amallari server tasdig‘isiz success
  ko‘rsatmaydi.

## 4. Dizayn yo‘nalishi va kreativ erkinlik

Design system ichki nomi — **Focus Rail**. To‘liq tokenlar `DESIGN.md` da.

AI agentga kreativ qaror qilishga ruxsat bor. Yangi kompozitsiya, navigatsiya,
micro-interaction, empty state, vizual ritm yoki komponent yaratishi mumkin.
Maqsad mavjud sahifani kosmetik ko‘chirish emas, vazifani eng ravshan usulda
yechishdir.

Kreativlik quyidagi natija chegaralari ichida erkin:

- DTMMax bir qarashda imtihon tayyorgarligi mahsuloti bo‘lib tanilsin;
- asosiy vazifa va keyingi qadam vizual jihatdan birinchi o‘rinda tursin;
- mobile va desktop bir xil funksional to‘liqlikka ega bo‘lsin;
- WCAG AA kontrast, ko‘rinadigan focus va 44×44 touch target saqlansin;
- body matni odatda 16 px dan kichik bo‘lmasin;
- rang holatning yagona belgisi bo‘lmasin;
- motion sababni tushuntirsin va `prefers-reduced-motion`ni hurmat qilsin.

Qat’iy anti-patternlar:

- generic AI SaaS/ChatGPT kloni;
- ma’nosiz gradient, glassmorphism va dekorativ grid;
- warm-paper jurnal ko‘rinishi, serif/italic display;
- ulkan yumaloq nested kartalar;
- faqat bezak uchun rang, badge yoki progress rail;
- bir sahifada bir xil og‘irlikdagi ko‘plab CTA.

Agent yangi yo‘nalish taklif qilsa, avval uch savolga javob yozadi:

1. Bu o‘quvchi/o‘qituvchi/adminning qaysi qarorini tezlashtiradi?
2. Mavjud Focus Rail tilini qanday rivojlantiradi?
3. Natijani qanday tekshiramiz?

Shundan keyin kodlaydi. Bu savollar kreativlikni cheklash uchun emas, qarorning
maqsadini yo‘qotmaslik uchun.

## 5. Joriy texnik arxitektura

- Frontend: React 19, Vite 7, TypeScript, Tailwind CSS v4.
- Backend: Express 5, TypeScript, Prisma 5, PostgreSQL.
- Auth: JWT, auth version va Redis blacklist.
- AI chat: DeepSeek `deepseek-v4-pro`; tezkor/fallback oqimlar
  `deepseek-v4-flash` va Gemini Flash.
- Vision/OCR: Gemini Flash.
- Math: KaTeX markdown pipeline.
- Fayl saqlash: S3-compatible object storage, signed URL.
- Deploy: Railway PR preview.

Yuqori riskli katta fayllar:

- `frontend/src/pages/Student/ChatLayout.tsx`
- `frontend/src/pages/Student/TestPage.tsx`
- `frontend/src/pages/Teacher/TeacherPanel.tsx`
- `frontend/src/pages/Admin/AdminPanel.tsx`
- `backend/src/routes/chat.ts`
- `backend/src/routes/tests.ts`

Bu fayllarda lokal o‘zgarishdan oldin bog‘langan state, API contract va boshqa
rollardagi consumerlarni qidirish kerak. Katta rewrite o‘rniga ajratiladigan
komponent va utilitylarni bosqichma-bosqich chiqarish afzal.

## 6. Previewda allaqachon bajarilgan ishlar

- Focus Rail student/teacher/admin workspace yo‘nalishi.
- Preview isolation, auth va migration hardening.
- Dependency yangilanishlari va 37 ta backend regression testi.
- Tabiiy o‘quv savolini sessiyaga aylantirish:
  prerequisite → reja → tushuntirish → mashq → natija.
- Model test blokini tashlab ketsa yoki buzsa, qat’iy JSON checkpoint recovery.
- Matnli PDF, skan PDF, DOCX va rasmdan AI test generatsiyasi.
- Rasmli testlarda oldindan joy rezervi, lazy decoding va signed URL.
- Paylov onboarding tokenidan OAuth2 access/refresh token aylanishi.
- Landing production ko‘rinishiga vaqtincha qaytarilgan.
- Tayyor CTA promptlari foydalanuvchi xabari sifatida chatga chiqarilmaydi.
- `Testlar` endi yarim overlay emas, alohida `/testlar` workspace sahifasiga
  o‘tadi. Birinchi darajali bo‘limlar: Milliy sertifikat, mavzuli testlar,
  blok testlar va natijalar.
- Milliy Sertifikat sinov urinishidan HMAC-imzoli `DMS1` verification kodi
  yaratiladi. Public `/sertifikat/:code` sahifasi QR, Code128 barcode va A4
  landscape print/PDF oqimini beradi.
- Productiondan oldin Railway’da barqaror, kamida 32 belgili
  `CERTIFICATE_SECRET` alohida qo‘yiladi. Keyinchalik bu qiymatni almashtirish
  eski verification kodlarini yaroqsiz qiladi.
- Sertifikat har doim `DTMMax sinov imtihoni` va davlat sertifikati emasligi
  haqidagi disclaimer bilan chiqadi; davlat ramzi yoki rasmiy tashkilot
  brendingi ishlatilmaydi.
- Admin grafiklari alohida lazy chunkka ajratilgan: AdminPanel shell
  taxminan 515 kB dan 140 kB ga tushgan.
- PostCSS `8.5.23`ga yangilanib, `<=8.5.17` source-map path traversal
  zaifligi yopilgan.

## 7. Jonli QA natijalari va qolgan tashqi blok

### Previewda tasdiqlangan

- Text PDF: lokal extraction orqali savollar generatsiyasi o‘tgan.
- Scan PDF: Gemini model fallback bilan 2 ta real savol, variant va correctIdx
  to‘g‘ri generatsiya qilingan.
- Katta rasm: 2200 px WebP optimizatsiya, private immutable cache va signed URL
  unit/live oqimi o‘tgan.
- AI tutor: integral so‘rovida 3 savolli prerequisite diagnostika, noto‘g‘ri
  natijada `REMEDIATION`, to‘g‘ri natijada `LESSON`, dars oxirida aynan 5
  savolli trusted checkpoint o‘tgan.
- Role E2E: teacher create → admin pending/approve → student open/submit/review
  → teacher analytics. Pre-submit answer-key leak yo‘q, duplicate submit `409`,
  student admin endpointida `403`.
- Backend test: 37/37. Frontend TypeScript + Vite production build: yashil.
- Barcha QA akkaunt/testlari preview bazasidan tekshiruvdan keyin o‘chirilgan.

### Paylov — tashqi javob kutilmoqda

- Railway static outbound IP’lar Paylov whitelistiga yuborilgan va qo‘shilgan.
- Onboard token OAuth2 access token yaratish uchun ishlatiladi.
- Yakuniy preview config (`/api/billing/config`) hozir
  `checkoutConfigured:false`, `paylovOAuthConfigured:false`,
  `sandboxTestMode:false`, `paylovOnboardingRequired:true` qaytarmoqda.
  Ya’ni preview muhitida payment hozir ishga tayyor emas va test to‘lov
  boshlanmasligi kerak.
- Supportdan DTMMax’ning 30 kunlik Pro xaridi uchun `Payment Without
  Registration` yoki `Subscription` contractidan qaysi biri kerakligi
  tasdiqlanishi kutilmoqda.
- Shu javob va rasmiy sandbox karta/OTP oqimi tasdiqlanmaguncha billing contracti
  o‘zgartirilmaydi hamda production payment yoqilmaydi.

### Dependency risk qarori

- `npm audit` React Router 7.12–8.2 uchun high ogohlantirish ko‘rsatadi, ammo
  advisory faqat unstable React Server Components API’larini ishlatadigan
  ilovalarga taalluqli.
- DTMMax `BrowserRouter` SPA; repo bo‘ylab RSC API importi/foydalanishi yo‘q.
  Shuning uchun audit tavsiya qilgan `react-router-dom@7.11.0` downgrade
  qilinmadi. 8.3 migratsiyasi alohida compatibility branchda ko‘riladi.

## 8. Verifikatsiya tartibi

Repo ichida:

```bash
cd backend && npm test
cd ../frontend && npm run build
git diff --check
git status --short --branch
```

Live preview:

```bash
curl -fsS https://main-main-pr-1.up.railway.app/api/health
```

Browser mavjud bo‘lsa role-based manual flow:

1. student login → Bugun → AI ustoz → interaktiv test → natija;
2. teacher login → fayldan test → review → publish/share;
3. public link → rasmli savol → submit;
4. admin login → users/content/AI/payment status.

Test data faqat previewda yaratiladi va tekshiruvdan keyin tozalanadi.

## 9. Qaror jurnali

| Sana | Qaror | Sabab |
| --- | --- | --- |
| 2026-07-24 | Redesign faqat preview branchda qoladi | Productionni sinov dizayndan himoya qilish |
| 2026-07-24 | `reysh` rollback nuqtasi saqlanadi | Yangi yo‘nalish ma’qul bo‘lmasa tez qaytish |
| 2026-07-24 | AI dizayn ijodkorligi natija chegaralari ichida erkin | Templated AI ko‘rinishidan chiqish, lekin product maqsadini saqlash |
| 2026-07-24 | Paylov flow support javobigacha muzlatiladi | Taxmin bilan billing contractini buzmaslik |
| 2026-07-24 | Bugun ekranida bitta dominant CTA: “Testlar” tugmasi `btn-primary`dan `btn-outline`ga tushirildi | Bir ekranda bitta asosiy harakat — “Bugungi fokus” CTA bilan raqobat yo‘qoladi |
| 2026-07-24 | “Yangi test” soni badge’i `danger`dan `brand`ga o‘tkazildi (sidebar `is-alert` bilan bir xil) | `danger` faqat xato/noto‘g‘ri holat uchun; yangi kontent xato emas |
| 2026-07-24 | `brand-light` ustidagi matn/ikon `brand`dan `brand-hover`ga o‘tkazildi (Bugun, test paneli, flashcard, Pro, badge’lar) | DESIGN.md’ning “pale tint ustida orange-600” qoidasi; #F15A24→#FFF1EB kontrasti ~2.7:1 AA talabidan past edi |
| 2026-07-24 | Orange to‘ldirilgan control matni oqdan `#171717`ga (test navigatori, A/B/C/D doirasi) | DESIGN.md: kichik oq matn `orange-500` ustida qo‘llanmaydi |
| 2026-07-24 | `alt="DtmMax"` → `alt="DTMMax"` (3 joy) | 09-landing auditidagi nom izchilligi qoidasi |
| 2026-07-24 | O‘quv checkpointi model ixtiyoriga qoldirilmaydi | DeepSeek bir jonli darsda 5 savolli blokni tashlab ketdi; server recovery va trusted validation qo‘shildi |
| 2026-07-24 | React Router audit ogohlantirishi hozircha accepted/not-applicable | Zaiflik faqat unstable RSC yo‘liga tegishli; DTMMax BrowserRouter SPA |
| 2026-07-24 | Paylov contracti support javobigacha muzlatildi | Payment turini taxmin qilish moliyaviy oqim va callback semantikasini buzishi mumkin |
| 2026-07-25 | Charon TTS previewdan olib tashlandi | Ovozli javob talabi boshqa loyiha bilan adashib berilgan; DTMMax’da audio funksiyasi kerak emas |
| 2026-07-25 | Test katalogi alohida `/testlar` sahifasiga ko‘chirildi | Yarim overlay axborot arxitekturasini siqardi; format va natijalar mustaqil workspace talab qiladi |
| 2026-07-25 | Milliy Sertifikat natijasi imzolangan DTMMax sinov hujjati sifatida beriladi | Natijani ulashish va tekshirish mumkin bo‘ladi, lekin rasmiy davlat sertifikati bilan adashmaydi |
| 2026-07-25 | AI ustozga sessiya raili: Diagnostika→Reja→Tushuntirish→Mashq→Natija, faqat real dalildan (struktur blok, test holati) | “ChatGPT klon” taassurufini yo‘qotish; o‘quvchi sessiyada qayerda ekanini biladi; dekorativ progress taqiqlangan |
| 2026-07-25 | 1200+ belgilik AI javoblari yig‘iladigan qatlamga o‘tdi (qattiq chegara + “To‘liq o‘qish”; gradient fade yo‘q) | Chat matn to‘kish emas; uzun tushuntirish ixtiyoriy o‘qiladi |
| 2026-07-25 | AI ustoz bo‘sh holati Bugun qadami bilan uzluksiz: diagnostika / tugallanmagan reja / zaif mavzu birinchi turadi | Onboarding continuity — generic promptlar o‘rniga real keyingi qadam |
| 2026-07-25 | Xabar osti chiplari: “Mashqga aylantir” + “Tekshirib ko‘ramiz” (comprehension check) | Handoff talabi: har tushuntirishdan keyin tushunishni tekshirish |
| 2026-07-25 | Sessiya raili FAQAT backend `LearningSession` dan: regex/uzunlik fevristikasi olib tashlandi; sessiya yo‘q chatda rail chizilmaydi | Soxta progress taqiqlangan — rail real DB holati (PREREQUISITE/LESSON/REMEDIATION/COMPLETED, stepIndex, lastCheckpoint) bilan ishlaydi |
| 2026-07-25 | `GET /api/chat/:chatId/learning-session` read-only endpoint qo‘shildi (additive, mavjud contract o‘zgarmadi) | Frontend real holatni o‘qishining yagona yo‘li; soxta frontend taxminidan yaxshiroq |
| 2026-07-25 | Rail effektiv `chatId ?? currentChat.id` dan o‘qiydi | `/suhbat` (ID’siz) holatda rail umuman chiqmasligi aniqlandi va tuzatildi |
| 2026-07-25 | Uzun javob qisqarishi faqat paragraf chegarasida; ` ``` ` blok yoki `$$`/`\[` formula bor xabar umuman qisqartirilmaydi | Formula, test va muhim tushuntirishlar yarmidan kesilmasligi/yashirinmasligi shart |
| 2026-07-25 | Bo‘sh holat tartibi: real reja → real zaif mavzu → diagnostika (faqat yangi o‘quvchi) | “Bugun davomi” real ma’lumotdan bo‘lishi kerak; diagnostika yangi akkaunt holati |
| 2026-07-25 | Preview vizual QA o‘tkazildi: test akkaunt yaratilib, mobil (375px) va desktop (1280px) screenshotlar tekshirilib, akkaunt o‘chirildi | Rail (PREREQUISITE: Diagnostika joriy, Reja check), qatlam toggle va Bugun ekrani real holatda tasdiqlandi |
| 2026-07-25 | Composer chip paneli: joriy fan, Tushuntir, Test, Reja, Rasm. Chip faqat rejim+placeholder o‘zgartiradi, bo‘sh inputda prompt YUBORMAYDI; texnik prompt `displayText` bilan yashirinadi | Tool discovery (recognition over recall); tayyor promptlar chatni ifloslamaydi. Rasm chipi mavjud fayl-tanlash oqimini ochadi; faqat real hook’lar |
| 2026-07-25 | `SendOptions.displayText` qo‘shildi — composer rejimi prompt o‘rashining yagona kanali | Fayl bilan yuborishda ham texnik prompt bubble’ga o‘tmaydi |
| 2026-07-25 | `O‘rganish` va `Progress` side overlay’dan to‘liq sahifaga ko‘chirildi: `/organish`, `/progress`; eski overlay render kodi butunlay o‘chirildi | Yarim overlay axborot arxitekturasini siqardi; Testlar bilan bir xil to‘liq-sahifa pattern. Flashcard navbati, SM-2 review, streak, natijalar va zaif mavzular real endpointlardan saqlandi |
| 2026-07-25 | Composer redesign: default 1px neutral border, focusda yagona 2px orange ring (qora qalin border + qo‘sha shadow yo‘qoldi); boshlang‘ich balandlik 64→40px; send 44×44; AI rail karta tashqarisida footer | Double-border vizual shovqin; professional minimal composer; keyboard focus-visible saqlangan |
| 2026-07-25 | `Rasm` chipi faqat `image/*`, paperclip esa hujjatlar (PDF/DOCX/TXT) ochadi — attachment rollari ajratildi | Bir xil ishni takrorlamaslik; vision kvotasi faqat rasmga |
