## Heuristic Evaluation: DTMMax landing page

**Baholangan sana:** 2026-07-11
**Framework:** Nielsen's 10 Usability Heuristics
**Scope:** birinchi tashrif, ro'yxatdan o'tishga o'tish, ishonch bloklari, narxlar va mobil navigatsiya.

> Eslatma: bu kodga asoslangan audit. Lokal Vite build Rollup'ning macOS optional paketi yo'qligi sababli ochilmadi, shuning uchun real qurilmadagi visual QA keyin alohida o'tkazilishi kerak.

### Summary

- Critical issues: 0
- Major issues: 4
- Minor issues: 3

Landingning vizual tili yaxshi: warm-paper palitra, bitta kuchli rang, DTM maqsadiga mos yo'l grafikasi va aniq CTA. Asosiy imkoniyat — uslubni almashtirish emas, ishonch hamda ro'yxatdan o'tish oqimini aniqroq qilish.

### Major Issues (Fix Soon)

#### L1 — Hero mahsulotni emas, placeholderni ko'rsatadi

- **Heuristic:** #6 — Recognition over recall; #8 — Aesthetic and minimalist design
- **Location:** `ScreenshotWell`, hero osti
- **Problem:** Hero'dagi preview dekorativ chat wireframe; unda haqiqiy DTMMax testi, AI tushuntirishi yoki progress ko'rinmaydi.
- **Impact:** Tashrifchi nima sotib olayotganini emas, umumiy va'dani ko'radi. AI repetitor mahsulotida bu ishonch va konversiyani pasaytiradi.
- **Recommendation:** Bitta haqiqiy, sanitizatsiya qilingan product screenshot qo'ying: “diagnostik test → zaif mavzu → 10 daqiqalik reja” oqimi. Undagi uchta annotatsiya yetarli.
- **Severity:** 3

#### L2 — Ijtimoiy isbot va natija da'volari manbasiz ko'rinadi

- **Heuristic:** #4 — Consistency and standards; #9 — Help users recognize and recover from errors
- **Location:** `STATS`, `TESTIMONIALS`
- **Problem:** `7 000+ o'quvchi`, 178/181 ball va “40 punktga oshdi” kabi natijalar bor, lekin qaysi davr, qaysi metod yoki isbot manbasi ko'rsatilmagan.
- **Impact:** Abituriyent va ota-ona buning reklama da'vosi ekanini his qilishi, ayniqsa yangi brendga ishonmasligi mumkin.
- **Recommendation:** Faqat tasdiqlangan raqamlarni qoldiring. Har natijaga kichik kontekst bering: yil, fan, anonimlashtirish/rozilik. Agar hozir dalil bo'lmasa, stats blokini “Nima olasiz?” formatidagi product proof bilan almashtiring.
- **Severity:** 3

#### L3 — “Bepul boshlash” va haqiqiy keyingi qadam o'rtasida kutish nomuvofiqligi bor

- **Heuristic:** #1 — Visibility of system status; #2 — Match between system and real world
- **Location:** hero CTA va `/royxat`
- **Problem:** Hero “1 daqiqada boshlanadi” va diagnostikani va'da qiladi, ammo CTA avval ism, email, parol hamda ehtimol email tasdiqlashga olib boradi; fan va maqsad keyingi onboardingda olinadi.
- **Impact:** Birinchi bosishdan keyin foydalanuvchi kutgan “testni boshlash” o'rniga account formni ko'radi. Bu drop-off uchun sezilarli nuqta.
- **Recommendation:** CTA ostiga haqiqiy 3 qadamni yozing: `1. Akkaunt yarating → 2. Faningizni tanlang → 3. Diagnostik test`. Yoki guest diagnostic flow yarating va natijani saqlashda ro'yxatdan o'tishni so'rang.
- **Severity:** 3

#### L4 — Narxlar bo'limi “hammasi bepul” va Pro narxini bir vaqtning o'zida urg'ulaydi

- **Heuristic:** #4 — Consistency and standards; #8 — Aesthetic and minimalist design
- **Location:** `Pricing`
- **Problem:** Sarlavha “Hozir hammasi bepul”, lekin yonida 35 000 so'mlik Pro, “tez kunda” va “beta'da bepul” xabarlari bor.
- **Impact:** Foydalanuvchi hozir to'lov bormi, keyin to'lov bormi yoki qaysi funksiya bepul ekanini qayta o'qishi kerak bo'ladi.
- **Recommendation:** Beta davrida bitta pricing card qoldiring: `Barcha funksiyalar beta davomida bepul`. Pro'ni faqat haqiqiy paywall, feature gate va boshlanish sanasi bo'lganda qaytaring.
- **Severity:** 3

### Minor Issues (Fix Later)

| Issue | Heuristic | Evidence | Recommendation | Severity |
|---|---|---|---|---|
| Fanlar dropdowni hamma fanni bir xil `#imkoniyatlar`ga yuboradi | #2, #6 | `SubjectsDropdown` | Har fan uchun landing anchor yoki `/royxat?subject=...` deep-link bering; aks holda oddiy statik fanlar ro'yxatini qoldiring. | 2 |
| 1023px dan pastda navigatsiya birdan yo'qoladi | #7 | `.lp-nav-links { display: none }` | Mobil menu yoki “Fanlar / Narxlar” uchun bitta secondary action qo'shing. | 2 |
| “DTMMax” va “DtmMax” yozilishi aralash | #4 | logo, FAQ, footer | Bitta mahsulot nomi qoidasi: `DTMMax`. | 1 |

### Strengths Observed

- Hero bitta asosiy CTA bilan yaxshi fokuslangan; karta va email haqidagi microcopy xavfni kamaytiradi.
- Accessibility bazasi yaxshi: skip-link, focus-visible, native FAQ `<details>` va reduced-motion variantlari bor.
- Mobil layout bir ustunli oqimga o'zgaradi; hero dekoratsiyasi mobilda yashirinib, mazmunni saqlaydi.
- CTAlar haqiqiy React router manzillariga ulangan.

### Recommended first pass

1. `ScreenshotWell`ni haqiqiy product proof bilan almashtirish va hero ostiga ro'yxatdan o'tishning 3 qadamini qo'yish.
2. Tasdiqlanmagan stats/testimoniallarni olib tashlash yoki ular uchun ishonchli kontekst qo'shish.
3. Beta davrida pricingni bir aniq, bepul taklifga qisqartirish.
4. Fanlar dropdownini mavzuga mos deep-link yoki aniq subject sectionlarga ulash.
