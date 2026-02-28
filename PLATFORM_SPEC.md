# msert — Platforma To'liq Spetsifikatsiyasi

## Maqsad

O'zbekistonda **Milliy Sertifikat** imtihonlariga tayyorlanayotgan o'quvchilar uchun **AI-ga asoslangan aqlli ta'lim platformasi**. Platforma minimalistik, murakkab emas, lekin juda chiroyli dizaynga ega bo'lishi kerak.

---

## Texnologik Stek

| Qism | Texnologiya |
|------|-------------|
| Backend | Node.js + Express + TypeScript |
| Frontend | React + Vite + Tailwind CSS + Shadcn UI |
| Database | PostgreSQL (Railway) |
| ORM | Prisma |
| AI | Deepseek API (OpenAI client orqali) |
| RAG | Fayllar yuklash (PDF, Word, rasm) + vektorli qidiruv |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Deploy | Railway (monolith — Express static serve) |
| Shrift | Inter (Google Fonts) |

---

## Rollar va Huquqlar

### 1. Admin (Asosiy Boshqaruvchi)
- Platformadagi **hamma narsani** boshqaradi
- O'qituvchilarga login/parol **yaratib beradi**
- AI API kalitlarini boshqaradi
- Deepseek API key sozlaydi
- RAG uchun fayllar yuklaydi (Milliy Sertifikat materiallari — PDF, Word)
- **Statistikalarni ko'radi:**
  - Hozir platformada nechta foydalanuvchi online
  - Oxirgi 24 soatda nechta kishi kirdi
  - Oxirgi 1 haftada nechta kishi kirdi
  - Oxirgi 1 oyda nechta kishi kirdi
  - Umumiy ro'yxatdan o'tganlar soni
- Admin akkaunt tizim tomonidan avtomatik yaratiladi (seed)
- Admin ro'yxatdan o'tish sahifasida ko'rinmaydi — faqat `/admin` orqali kiradi

### 2. O'qituvchi (Ustoz)
- Admin tomonidan yaratilgan login/parol bilan kiradi
- **O'zining AI assistanti bor** — test tuzishda yordam beradi
- Test tuzish dashboardi:
  - Testni **private** yoki **public** qilishi mumkin
  - Public test → O'quvchilar dashboardida testlar bo'limida ko'rinadi
  - Private test → Faqat **link** orqali tashlanadi, link orqali kirgan odamlarga ko'rinadi
  - Har ikki holda ham foydalanuvchi platformaga **kirgan bo'lishi shart**
- Har bir test **Rasch modeli** bo'yicha baholanadi

### 3. O'quvchi (Talaba)
- Ro'yxatdan o'tish va kirish orqali platformaga kiradi
- Ro'yxatdan o'tishda **faqat talaba** sifatida ro'yxatdan o'tadi (rol tanlanmaydi)

---

## O'quvchi Oqimi (Student Flow)

### 1-qadam: Birinchi marta kirish — AI bilan tanishuv (Onboarding)

O'quvchi birinchi marta kirganida **AI suhbat** ochiladi va quyidagilarni so'raydi:

> ⚠️ Bu majburiy emas — AI o'quvchiga: "Keling, sizning bilimingizni baholab ko'ramiz. Shunda yaxshiroq ishlashimiz mumkin bo'ladi" deb taklif qiladi.

- Qaysi fandan Milliy Sertifikat topshirmoqchi?
- Nechchi ball kutayapsiz?
- Qaysi mavzularda **qiynalasiz**?
- Qaysi mavzularni **yaxshi bilasiz**?
- Milliy sertifikatga tayyorlanishda nimalar **tashvishlantirayapti**?
- Imtihonga **nechchi kun** vaqt qolgan?

Agar rozi bo'lsa → AI shu fan bo'yicha **boshlang'ich test** beradi va natijalar asosida statslarni saqlaydi.

### 2-qadam: Asosiy Chat Oynasi (ChatGPT-ga o'xshash)

- **Yangi chat ochish** mumkin — har bir fan uchun alohida chat
- Chat oynasida o'sha fanga tegishli **statslar** ko'rinib turadi
- AI xususiyatlari:
  - **Agentic skills** — vaqtni hisobga oladi (imtihongacha qolgan kunlarni eslab, muhokama paytida ham hisoblaydi)
  - **Qattiq ishlaydi** — o'quvchini doimiy rag'batlantiradi va rejaga qaytaradi
  - **Mavzudan chiqmaslik** — agar o'quvchi dasturchilik haqida gaplashsa, AI javob berib: "Davom ettiramiz, asosiy maqsadimizga qaytamiz" deydi
  - **Reja tuzadi** — o'quv rejalarini tuzadi va progress bo'yicha kuzatadi
  - **Boshidan oxirigacha ko'radi** — chat tarixini o'qib, aniq, toza javob beradi
  - **Fayl qabul qiladi** — PDF, Word, rasm, screenshot yuklash mumkin
  - **Token ayamaydi** — batafsil tushuntirish beradi

### 3-qadam: Testlar Bo'limi

- Chat oynasida AI test tuzib beradi
- AI o'zi **taklif qiladi**: "Keling, shu mavzudan test ishlaymiz"
- Test chat ichida yangi oyna sifatida ochiladi
- O'quvchi yechganidan keyin AI **tahlil qiladi**:
  - "Keling, manashu testni ko'rib chiqamiz, birga tahlil qilamiz"
  - Har bir xatoni tushuntiradi
- O'qituvchi qilgan **public testlar** ham ko'rinadi
- Barcha testlar **Rasch modeli** bo'yicha baholanadi
- O'quvchi yechgan testlarining **natijalarini** olishi kerak

### Dashboard

- ChatGPT / Claude kabi chat interfeysi
- Chap panelda chatlar ro'yxati
- Testlar bo'limi
- Progress va statslar

---

## O'qituvchi Oqimi (Teacher Flow)

- Admin yaratgan login/parol bilan kiradi
- **O'z AI assistanti bor** — savollar tuzishda yordam beradi
- Test tuzish dashboardi:
  - Test nomi, savollar, javob variantlari
  - Testni **public** yoki **private** qilish
  - Public → o'quvchilar dashboardida ko'rinadi
  - Private → faqat **link** orqali ulashiladi
  - Ikkala holda ham — foydalanuvchi **kirgan bo'lishi shart**
- Testlar natijalari va statistikasi

---

## Admin Oqimi (Admin Flow)

- `/admin` yo'li orqali kiradi
- Boshqaruv imkoniyatlari:
  - O'qituvchilarga **login/parol yaratish**
  - **AI API** sozlamalari (Deepseek API key)
  - **RAG materiallari** yuklash (PDF, Word — Milliy Sertifikat materiallari)
  - **Platformaga statistikalar**:
    - Hozirgi online foydalanuvchilar
    - 24 soat / 1 hafta / 1 oy / umumiy kirganlar
    - Ro'yxatdan o'tganlar soni
  - Barcha testlarni ko'rish va boshqarish
  - Barcha foydalanuvchilarni ko'rish

---

## AI Xulq-atvori (AI Behavior Rules)

1. **Fan bo'yicha ishlaydi** — o'quvchi tanlagan fanga to'liq moslashadi
2. **Mavzudan chiqarmaydi** — bo'lmagan mavzularda javob berib, asosiy maqsadga qaytaradi
3. **Vaqtni hisobga oladi** — imtihongacha qolgan vaqtni eslab, har gal hisoblaydi
4. **Reja tuzadi** — kunlik, haftalik o'quv rejalari
5. **Progressni kuzatadi** — qaysi mavzular o'zlashtirilgan, qaysilari yo'q
6. **Batafsil tushuntiradi** — token tejamaydi, misollar bilan ishlaydi
7. **Test taklif qiladi** — mavzu tayyorlanganida o'zi test tuzib beradi
8. **Natijalarni tahlil qiladi** — xatolarni birma-bir ko'rib chiqadi
9. **Fayllar bilan ishlaydi** — PDF, Word, rasm, screenshot qabul qiladi
10. **Deepseek API** orqali ishlaydi

---

## Rasch Modeli

Barcha testlar Rasch modeli bo'yicha baholanadi:
- Har bir savolning **qiyinlik darajasi** (difficulty) bor
- Har bir o'quvchining **qobiliyat darajasi** (ability) bor
- `P(to'g'ri) = 1 / (1 + exp(-(ability - difficulty)))`
- O'quvchi to'g'ri/noto'g'ri javob berganida ikkala parametr ham yangilanadi
- MLE (Maximum Likelihood Estimation) usulida hisoblanadi

> Web search orqali Rasch model haqida to'liq ma'lumot olingan va utility funksiyalari yozilgan.

---

## Dizayn Prinsiplari

- **Minimalistik** — ortiqcha element yo'q
- **Premium** — gradientlar, glassmorphism, micro-animatsiyalar
- **Inter shrift** — Google Fonts
- **Rang sxemasi** — ko'k-cyan gradient (asosiy), emerald (AI), qora mesh (hero)
- **Responsive** — mobil va desktop uchun moslashgan

---

## Dastlabki Fan

Hozircha platforma **Matematika** fani bo'yicha sinab ko'riladi. Keyinchalik boshqa fanlar qo'shiladi.

---

## Fayl Tuzilmasi

```
main platforma/
├── package.json          # Root — build va start skriptlar
├── backend/
│   ├── prisma/schema.prisma  # Ma'lumotlar bazasi sxemasi
│   ├── src/
│   │   ├── app.ts            # Express server
│   │   ├── routes/           # API endpointlar
│   │   ├── middlewares/      # Auth middleware
│   │   └── utils/            # Rasch, DB, yordamchi funksiyalar
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/            # Barcha sahifalar
│   │   ├── components/ui/    # Shadcn UI komponentlar
│   │   ├── lib/              # API utility
│   │   ├── store/            # Zustand (auth state)
│   │   └── index.css         # Global stillar
│   └── package.json
└── PLATFORM_SPEC.md          # Shu hujjat
```

---

## Deploy

- Railway serverda **bitta servis** sifatida deploy qilinadi
- Express backend React frontendning `dist` papkasini statik ravishda serve qiladi
- Environment variables: `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`
- GitHub push → Railway avtomatik build → deploy
