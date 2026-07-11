## Heuristic Evaluation: DTMMax test workspace

**Baholangan sana:** 2026-07-11
**Framework:** Nielsen's 10 Usability Heuristics + conversion-oriented visual review
**Scope:** chat ichidagi Test markazi, test katalogi, savol yechish va natija holati.

> Eslatma: audit kodga asoslangan. Lokal Vite preview Rollup'ning macOS optional paketi yo'qligi sababli ochilmadi; mobil touch va kontrastni real qurilmada ham tekshirish kerak.

### Summary

- Critical issues: 0
- Major issues: 3
- Minor issues: 3

Oldingi oqim texnik jihatdan to'liq edi: qidiruv, filtrlash, manba badge'lari va natijani saqlash bor. Ammo katalog hissi kuchli, “hozir qaysi testni boshlayman?” savoliga vizual javob zaif edi. Ranglar ham har testga ma'no bermasdi.

### Major Issues (Fix Soon)

#### T1 — Test katalogi keyingi eng yaxshi qadamni ko'rsatmaydi

- **Heuristic:** #6 — Recognition over recall; #8 — Aesthetic and minimalist design
- **Location:** Testlar overlay'i
- **Problem:** Progress, tavsiya va to'liq ro'yxat bir xil og'irlikda ko'rinadi; foydalanuvchi test tanlashni skan qilishi kerak.
- **Impact:** Birinchi testni boshlash kechikadi, ayniqsa mobil ekranda.
- **Recommendation:** Yuqoriga profil fanlariga mos, ishlanmagan bitta “Bugungi tanlov” kartasi qo'yish.
- **Severity:** 3

#### T2 — Test kartalari bir-birini esda qoldirmaydi

- **Heuristic:** #4 — Consistency and standards; #8 — Aesthetic and minimalist design
- **Location:** public test list
- **Problem:** Avval barcha testlar deyarli bir xil oq karta edi; fan, savollar soni va vaqt vizual iyerarxiyasi sust.
- **Impact:** Katalog fayl ro'yxatidek tuyuladi, mashq boshlash hissi past bo'ladi.
- **Recommendation:** Fanlar uchun cheklangan semantic rang tizimi, savol soni uchun anchori va ko'rinadigan “Boshlash” affordance'i.
- **Severity:** 3

#### T3 — Natija holati ballni ko'rsatadi, lekin keyingi hissiy qadamni bermaydi

- **Heuristic:** #1 — Visibility of system status; #9 — Help users recognize and recover from errors
- **Location:** test submit footer
- **Problem:** Oldin natija faqat `x/y — z%` va “panelni yopish” bilan tugardi.
- **Impact:** Past natija jazodek, yuqori natija esa yutuqdek sezilmaydi; tahlilga qaytish konteksti noaniq.
- **Recommendation:** Natijaga qarab neytral-rag'batlantiruvchi message, rangli result card va “Chatdagi tahlilga qaytish” CTA.
- **Severity:** 3

### Minor Issues (Fix Later)

| Issue | Heuristic | Recommendation | Severity |
|---|---|---|---|
| “Zaif mavzularni o'rganish” tugmasi progress karta ichida tor ekranda ikkinchi darajali bo'lib qoladi | #8 | Uni progress ostidagi to'liq qator CTAga o'tkazing. | 2 |
| Test turini va manbasini tushuntiruvchi legend yo'q | #6 | Birinchi ochilganda 1 qatorli tooltip/legend bering. | 2 |
| Test paneli bo'ylab next-question navigatsiyasi yo'q | #7 | Uzun testlarda “Keyingi javobsiz savol” tugmasini qo'shing. | 2 |

### First-pass implementation

1. Fanga mos “Bugungi tanlov” kartasi qo'shildi; u ishlanmagan testlarni profil fanlari va mashhurligiga qarab tartiblaydi.
2. Test kartalariga limited semantic palette qo'shildi: aniq fan signalini beradi, lekin brand rangini bosib ketmaydi.
3. Test yechish paneli progress copy, savol labeli, kuchli tanlangan variant va javob sanog'i bilan boyitildi.
4. Natija yakuni 80%+, 60%+ va o'rganish kerak bo'lgan holatlar uchun alohida, rag'batlantiruvchi copyga o'tdi.

### Follow-up validation

1. 5 nafar abituriyent bilan “Test markazini oching va sizga mos testni boshlang” taskini o'lchang.
2. “Bugungi tanlov” CTR va test submit rate'ini eski katalog bilan A/B solishtiring.
3. iPhone/Androidda subject ranglari, sticky filter va natija footerini tekshiring.
