## Heuristic Evaluation: DTMMax student chat

**Baholangan sana:** 2026-07-11
**Framework:** Nielsen's 10 Usability Heuristics
**Scope:** student chat shell, bo'sh holat, conversation, composer, sidebar va mobile navigation.

> Eslatma: live browser sessiyasi mavjud bo'lmagani uchun bu report kodga asoslangan UI audit. Real qurilmadagi contrast, scroll, soft-keyboard va touch holatlari alohida tekshirilishi kerak.

### Summary

- Critical issues: 0
- Major issues: 5
- Minor issues: 5

Chatning hozirgi yo'nalishi yaxshi: iliq paper palette, aniq CTA ranglari, streaming holati, fayl preview va mobil tab-bar mavjud. Asosiy muammo — bitta ekranga chat, dashboard, progress, gamification, Pro va turli panellar bir-biri bilan raqobat qilishi. Studentning asosiy savoli "hozir nima qilay?" bo'lishi kerak; hozir esa bir vaqtning o'zida bir nechta javob ko'rinadi.

### Major Issues (Fix Soon)

#### M1 — Bo'sh chat "Bugun" dashboardiga haddan ko'p vazifa yuklangan

- **Heuristic:** #8 — Aesthetic and minimalist design; #6 — Recognition over recall
- **Location:** `ChatLayout.tsx`, bo'sh chat / "Bugun" ekrani
- **Problem:** Greeting, streak, XP, DTM progress, diagnostika, daily plan, oldingi natija va weak-topic CTA bir markaziy ustunda joylashadi.
- **Impact:** Yangi o'quvchi qaysi tugma eng to'g'ri birinchi qadam ekanini bilmay qolishi mumkin. Mavjud o'quvchi ham chat ochish o'rniga dashboardni skan qiladi.
- **Recommendation:** Bitta **Next best action** card qoldiring. Masalan: `1. Diagnostik testni boshlang — 8 daqiqa` yoki `Bugungi rejadan 2/3 vazifa qoldi`. Qolgan progress/reja/natijani compact link yoki Natijalar ekraniga o'tkazing.
- **Severity:** 3

#### M2 — Composer bir vaqtning o'zida to'rtta turli ishni ko'rsatadi

- **Heuristic:** #8 — Aesthetic and minimalist design
- **Location:** file attach, Thinking/Pro, daily quota va Send bitta toolbar ichida
- **Problem:** Xabar yozish, fayl biriktirish, thinking mode, monetizatsiya va limit ma'lumoti bitta fokus qatorida turadi.
- **Impact:** Mobile kenglikda composerning vizual markazi yo'qoladi; ayniqsa yangi foydalanuvchi `PRO` nimani o'zgartirishini tushunmaydi.
- **Recommendation:** Composerni uch qatlamga ajrating: chapda attach, markazda matn, o'ngda Send. `Chuqur javob`ni `⋯` ichidagi aniq modega o'tkazing; quota faqat 20% qolganda composer ustida kichik alert bo'lsin. Pro badge ni composer ichidan olib tashlang.
- **Severity:** 3

#### M3 — Conversation ichida ta'limga xos keyingi qadamlar yetarlicha ko'rinmaydi

- **Heuristic:** #7 — Flexibility and efficiency; #6 — Recognition over recall
- **Location:** AI javobi tagi
- **Problem:** Hozir doimiy action faqat `Nusxalash`; tezkor chiplar esa compose ustida umumiy va har javob mazmuniga bog'liq emas.
- **Impact:** O'quvchi uzun AI javobidan keyin nima qilishini o'zi xulosalashi kerak: qisqartirishmi, misol so'rashmi yoki test boshlashmi.
- **Recommendation:** Har javob oxirida ko'pi bilan 2–3 context action qo'ying: `Misol bilan tushuntir`, `3 ta mashq ber`, `Qisqartir`. Test/todo/flashcard yaratgan javobda faqat shu blokka mos action ko'rinsin.
- **Severity:** 3

#### M4 — Headerning information hierarchy-si chat vazifasini aniq bermaydi

- **Heuristic:** #1 — Visibility of system status; #8 — Aesthetic and minimalist design
- **Location:** top header
- **Problem:** Current chat title juda xira; doimiy imtihon countdown chipi esa birinchi ko'zga tushadi. Kichik ekranda sarlavha, countdown va yangi chat tugmasi bir qatorni bo'lishadi.
- **Impact:** Foydalanuvchi hozir qaysi fan, mavzu yoki o'quv oqimida ekanini tez anglamaydi.
- **Recommendation:** Header formatini `Fan • mavzu` va ikkinchi qatorda `Bugungi maqsad`ga o'tkazing. Countdownni faqat Today/Progressda ko'rsating yoki 420px dan pastda icon-only qiling. Chat title emas, o'quv konteksti asosiy bo'lsin.
- **Severity:** 3

#### M5 — Chat va ish panellari o'rtasidagi o'tish modeli notekis

- **Heuristic:** #3 — User control and freedom; #4 — Consistency and standards
- **Location:** test, essay, flashcard va todo panels
- **Problem:** Desktopda ular side panel, mobileda fullscreen. Har birining return-to-chat affordance'i va ish holati bitta umumiy modelga ega emas.
- **Impact:** Student testdan chatga qaytganda qaysi joyda qolganini yo'qotishi yoki chat siqilib qolganini his qilishi mumkin.
- **Recommendation:** Barcha o'quv asboblari uchun bir xil `Learning workspace` shell yarating: aniq title, progress, `Suhbatga qaytish`, `Minimallashtirish` va yakunlanganda `Natijani tahlil qilish` CTA.
- **Severity:** 3

### Minor Issues (Fix Later)

| Issue | Heuristic | Evidence | Recommendation | Severity |
|---|---|---|---|---|
| Mobile o'qish matni kichik | #8 | AI markdown 13px | Mobile AI matnini kamida 14px, line-height 1.65 qiling; matematik savol uchun bu qulayroq. | 2 |
| Vaqt faqat hover title'da | #1 | Message row | Har message group ostida xira `14:32` vaqtini ko'rsating; hoverga bog'lamang. | 2 |
| Chat history mouse-only | #7, #4 | Chat row `div` | `button` semantikasiga o'tkazing, keyboard focus va visible active state qo'shing. | 2 |
| Chuqur fikrlash UI'i noaniq | #1, #2 | Thinking details | Raw reasoning o'rniga `Murakkab masalani tahlil qilmoqda` kabi umumiy progress ko'rsating. | 2 |
| Quick actionlar takrorlanadi | #8 | Composer chips | Har payt 4 chip emas, oxirgi o'quv holatiga mos 2–3 chip ko'rsating. | 2 |

### Tavsiya etilgan chat wireframe

```
┌ Sidebar ──────────────┐  ┌ Fan: Matematika · Kvadrat tenglama ─────────┐
│ + Yangi suhbat        │  │ Bugungi maqsad: 10 daqiqa mashq        [⋯] │
│ Suhbatlar             │  ├─────────────────────────────────────────────┤
│                       │  │ AI javobi                                │
│ O'rganish             │  │ [Misol] [3 ta mashq] [Qisqartir]         │
│  • Testlar            │  │                                          │
│  • Natijalar          │  │ Sizning xabaringiz                       │
└───────────────────────┘  ├─────────────────────────────────────────────┤
                           │ [＋]  Mavzuni yozing...                 [↑] │
                           └─────────────────────────────────────────────┘
```

Qoidasi: bir ekranda bitta asosiy qaror bo'lsin. Empty holatda `Next best action`; conversation holatida `AI javobi + keyingi kichik qadam`; composerda `yozish`.

### Strengths Observed

- Warm orange/paper palette va Hanken/Fraunces kombinatsiyasi brendga mos va yetarli darajada o'ziga xos.
- Composer focus ring, optimistic upload preview, retryda inputni qaytarish va stop tugmasi foydalanuvchi nazoratini yaxshilaydi.
- Streaming cursor, task-specific generating label va scroll-to-bottom tugmasi system statusni aniq qiladi.
- Mobile bottom navigation asosiy bo'limlarni barqaror joyda saqlaydi.
- Date separators uzoq chatlarda orientatsiyani yaxshilaydi.

### Next Steps

1. Empty stateni 1 ta `Next best action` va 1 ta secondary linkka qisqartiring.
2. Composerni minimal qiling; Thinking/Pro/quota'ni asosiy inputdan ajrating.
3. AI javoblari uchun context action component yarating.
4. Barcha test/essay/flashcard/todo panellarini yagona workspace shellga o'tkazing.
5. Keyin real iPhone va Android qurilmada 5 foydalanuvchi bilan 3 flowni tekshiring: birinchi chat, weak-topic mashq, testdan tahlilga qaytish.
