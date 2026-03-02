import { Router } from 'express'
import multer from 'multer'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import prisma from '../utils/db'
import { authenticate, AuthRequest } from '../middleware/auth'
import OpenAI from 'openai'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })

const router = Router()

// Rasmlar uchun vaqtinchalik xotira (chatId -> dataUrl)
const pendingImages = new Map<string, string>()

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.OPENAI_API_KEY || ''
})

async function getAISettings(): Promise<{ temperature: number; maxTokens: number; extraRules: string; promptOverrides: Record<string, string> }> {
    const defaults = { temperature: 0.7, maxTokens: 4096, extraRules: '', promptOverrides: {} as Record<string, string> }
    try {
        const settings = await prisma.aISetting.findMany()
        for (const s of settings) {
            if (s.key === 'temperature') defaults.temperature = parseFloat(s.value) || 0.7
            if (s.key === 'max_tokens') defaults.maxTokens = parseInt(s.value) || 4096
            if (s.key === 'extra_rules') defaults.extraRules = s.value
            if (s.key.startsWith('prompt_')) defaults.promptOverrides[s.key] = s.value
        }
    } catch { }
    return defaults
}

function getExamSection(subject?: string): string {
    if (subject === 'Ingliz tili') {
        return `# 🏆 MILLIY SERTIFIKAT IMTIHONI (Ingliz tili — CEFR)

## Umumiy ma'lumot:
- **Daraja**: B1 / B2 / C1 (CEFR standartlari asosida)
- **Jami ball**: 150 ball (har bir bo'lim 30 ball)
- **Umumiy vaqt**: ~3 soat 35 daqiqa (yozma), Speaking alohida kun
- **Sertifikat muddati**: 2 yil
- **Natij**: Rasch modeli asosida baholanadi

---

## 5 ta bo'lim (Section):

### 1️⃣ LISTENING — Eshitib tushunish
- **Vaqt**: ~35 daqiqa | **Qismlar**: 4 ta | **Savollar**: 30 ta | **Ball**: 30
- Har bir matn 2 marta o'qiladi; savollar oldin beriladi (30 soniya)
- **Savol turlari**:
  - Multiple choice (A/B/C/D)
  - True / False / Not Given
  - Gap filling (bo'sh joyni to'ldirish)
  - Matching (juftlashtirish)
- **Matn turlari**: monolog (yangiliklar, e'lon, taqdimot), dialog (suhbat, intervyu)
- **Tekshiriladi**: asosiy g'oya, tafsilot, nuqtai nazar, maqsad, kayfiyat

### 2️⃣ READING — O'qib tushunish
- **Vaqt**: ~70 daqiqa | **Qismlar**: 4–5 ta | **Savollar**: 30 ta | **Ball**: 30
- **Savol turlari**:
  - Multiple choice (A/B/C/D)
  - True / False / Not Given
  - Matching headings (sarlavha moslashtirish)
  - Gap filling (gapni to'ldirish)
  - Paragraph matching (ma'lumotni topish)
- **Matn turlari**: gazeta/jurnal maqolalari, entsiklopediya, reklama, e'lon, hikoya
- **Tekshiriladi**: asosiy fikr, tafsilot, muallif nuqtai nazari, mantiqiy bog'lanish

### 3️⃣ LEXICAL & GRAMMATICAL — Leksik-grammatik qobiliyat
- **Vaqt**: ~30 daqiqa | **Qismlar**: 3 ta | **Savollar**: 30 ta | **Ball**: 30
- **Savol turlari**:
  - Gap filling — gapga to'g'ri so'z/shakl tanlash (A/B/C/D)
  - Word formation — berilgan so'zdan to'g'ri shakl yasash
  - Error correction — xato topish va to'g'rilash
  - Sentence transformation — bir xil ma'noda qayta yozish

#### 📌 Grammatika mavzulari (B1/B2):
**Zamonlar (Tenses):**
| Zamon | Misol |
|-------|-------|
| Present Simple | I work every day. |
| Present Continuous | She is working now. |
| Present Perfect | I have finished. |
| Present Perfect Continuous | He has been studying for 2 hours. |
| Past Simple | They went yesterday. |
| Past Continuous | It was raining when I arrived. |
| Past Perfect | She had left before I came. |
| Past Perfect Continuous | He had been waiting for an hour. |
| Future Simple | I will call you. |
| Future Continuous | I will be waiting. |
| Future Perfect | By 5 PM, she will have finished. |
| Used to / Would | I used to play football. |

**Murakkab grammatika:**
- **Conditionals**: Zero (if+V1→V1) | First (if+V1→will+V) | Second (if+V2→would+V) | Third (if+had+V3→would have+V3) | Mixed
- **Passive Voice**: barchа zamonlarda — is/was/will be/has been/had been + done
- **Modal verbs**: can/could, may/might, must/have to, should/ought to, need to, dare, had better, would rather
- **Reported Speech**: "I am tired" → He said he was tired | tense backshift + pronoun change
- **Relative clauses**: who (shaxs), which (narsa), that, whose (egalik), where (joy), when (vaqt) — defining vs non-defining
- **Gerund vs Infinitive**: enjoy+Ving, want+to V, stop+Ving/to V, remember+Ving/to V
- **Comparatives & Superlatives**: -er/-est, more/most, as…as, not as…as, the more…the more
- **Articles**: a/an/the/zero — qoidalari va istisnolari
- **Prepositions of time**: in/on/at + vaqt; **of place**: in/on/at + joy
- **Question tags**: She is happy, isn't she? / He didn't go, did he?
- **Inversion**: Never have I seen… / Rarely does he…
- **Emphasis (cleft)**: It was John who called. / What I need is rest.
- **Wish / If only**: I wish I knew. / If only he had come.
- **Subjunctive**: I suggest that he be present. / It's important that she study.
- **Participle clauses**: Having finished, he left. / Written in 1890, the book…

#### 📌 Leksika mavzulari:
**Phrasal verbs (eng ko'p chiqadiganlar):**
- look: up (qidirmoq), after (qaramoq), forward to (intizorlik), out (ehtiyot bo'lmoq)
- give: up (voz kechmoq), in (taslim bo'lmoq), away (berib yubormoq)
- take: off (uchmoq/yechmoq), over (egallamoq), on (qabul qilmoq), up (boshlamoq)
- put: off (kechiktirmoq), on (kiymoq), up with (chidamoq), away (yig'ishtirib qo'ymoq)
- carry: out (bajarmoq), on (davom etmoq), away (olib ketmoq)
- come: across (uchramoq), up with (taklif qilmoq), out (chiqmoq)
- bring: up (tarbiyalamoq), about (sabab bo'lmoq), out (chiqarmoq)
- go: off (portlamoq/o'chmoq), through (boshdan o'tkazmoq), on (davom etmoq)

**Collocations:**
- make: a decision, an effort, progress, a mistake, friends, a difference
- do: homework, research, exercise, damage, business, a favor
- have: a meal, a break, fun, a conversation, an impact, time
- take: notes, a photo, a risk, a step, action, part, care

**Confusing word pairs:**
- affect (ta'sir qilmoq — fe'l) vs effect (ta'sir — ot)
- accept (qabul qilmoq) vs except (bundan tashqari)
- advice (maslahat — ot) vs advise (maslahat bermoq — fe'l)
- rise (ko'tarilmoq — o'zlik) vs raise (ko'tarmoq — o'timli)
- lay (qo'ymoq — o'timli) vs lie (yotmoq — o'zlik)
- quite (ancha) vs quiet (jim)
- lend (qarz bermoq) vs borrow (qarz olmoq)
- say vs tell: say something / tell someone something

**So'z yasalishi (Word Formation):**
- Suffixes (ot): -tion/-sion, -ment, -ness, -ity/-ty, -er/-or/-ist, -ance/-ence, -ship, -hood
- Suffixes (sifat): -ful, -less, -ous/-ious, -able/-ible, -al/-ial, -ic, -ive, -ish
- Suffixes (ravish): -ly
- Prefixes: un-, dis-, im-/in-/ir-/il- (inkor), re- (qayta), over- (ortiqcha), under- (kam), mis- (noto'g'ri), pre- (oldin), post- (keyin)

### 4️⃣ WRITING — Yozish
- **Vaqt**: ~45 daqiqa | **Vazifalar**: 2 ta | **Ball**: 30
- **Task 1** (~15 daqiqa, 12–15 ball): Qisqa yozma — elektron xat (formal/informal email), xabar yoki izoh
- **Task 2** (~30 daqiqa, 15–18 ball): Esse — fikr bildirish (opinion essay), muammo-yechim (problem-solution), ikki tomonlama (discuss both views)
- **Baholash mezoni**:
  - Vazifani bajarish (Task achievement)
  - Uyg'unlik va bog'liqlik (Coherence & Cohesion)
  - Leksik boylik (Lexical Resource)
  - Grammatik to'g'rilik va xilma-xillik

**Esse tuzilmasi:**
- Introduction: mavzuni kiritish + thesis statement
- Body paragraph 1: asosiy fikr + misol + izohlash
- Body paragraph 2: ikkinchi fikr + qarshi nuqtai nazar (discuss essays uchun)
- Conclusion: xulosalash + muallif pozitsiyasi

**Foydali linking words:**
- Qo'shish: Furthermore, Moreover, In addition, Besides
- Qarama-qarshi: However, Nevertheless, On the other hand, Although, Despite
- Sabab: Because, Since, Due to, As a result of
- Natija: Therefore, Thus, Consequently, As a result
- Misol: For example, For instance, Such as, In particular

### 5️⃣ SPEAKING — Gapirish
- **Vaqt**: ~15 daqiqa | **Qismlar**: 3 ta | **Ball**: 30 | (alohida kun)
- **Part 1** (4–5 daqiqa): O'zingiz haqida, kundalik hayot, qiziqishlar — oddiy savollar
- **Part 2** (3–4 daqiqa): Karta (cue card) asosida monolog — 1 daqiqa tayyorlanish, 2 daqiqa gapirish
- **Part 3** (4–5 daqiqa): Part 2 mavzusiga bog'liq chuqur muhokama — fikr bildirish, solishtirishlar
- **Baholash mezoni**:
  - Ravonlik (Fluency & Coherence)
  - Leksik boylik (Lexical Resource)
  - Grammatik to'g'rilik (Grammatical Range & Accuracy)
  - Talaffuz (Pronunciation)

**Foydali speaking iboralari:**
- Fikr bildirishda: In my opinion, I believe, From my perspective, As far as I'm concerned
- Rozi bo'lishda: I completely agree, That's a good point, Absolutely
- Rozi bo'lmaslikda: I'm not sure about that, I see it differently, To some extent
- Vaqt olishda: Let me think about that, That's an interesting question, Well…
- Misol keltirishda: For example, For instance, A good example of this is…

---

## Baholash tizimi (Rasch modeli):
| Daraja | Ball (%) | Ma'no |
|--------|----------|-------|
| **A+** | 70.0+ | Eng yuqori — C1 ga yaqin |
| **A** | 65.0–69.9 | Yuqori B2 |
| **B+** | 60.0–64.9 | O'rta B2 |
| **B** | 55.0–59.9 | Quyi B2 |
| **C+** | 50.0–54.9 | Yuqori B1 |
| **C** | 46.0–49.9 | O'rta B1 |

- OTMga kirish uchun B2 sertifikati maksimal ball beradi
- Magistratura uchun filologiya ixtisosliklarida C1 talab qilinadi
- Sertifikat 2 yil amal qiladi

---

## O'qitish uslubi (Ingliz tili uchun):
- Grammatika qoidasini avval O'ZBEK TILIDA tushuntir → keyin inglizcha formula → keyin 3+ misol
- Zamonlarni qiyoslab o'rgat: "Present Perfect vs Past Simple" — farqini O'zbek tilida izohlа
- Xatoni shunday to'g'irla: "❌ He go school → ✅ He goes to school (Present Simple: he/she/it + V+s)"
- O'quvchi inglizcha yozsa — xatolarni sanab chiqma, 2–3 eng muhimini tushuntir
- Yangi so'z: tarjima + misol + sinonim/antonim + word family (act → action → active → actively)
- Speaking uchun: javobni kengaytirish usulini o'rgat (1 so'z emas, 2–3 gap)

## Mock test strategiyasi:
- **Grammatika/Leksika testida**: gap filling (60%), word formation (20%), error correction (20%)
- **Reading testida**: True/False/Not Given savollari eng ko'p chiqadi — "Not Given" ni to'g'ri ajratishni o'rgat
- **Listening testida**: savollarni OLDIN o'qib chiqishni mashq qildir
- **Writing testida**: vaqtni taqsimlashni o'rgat — Task 1 (15 min) + Task 2 (30 min)
- Test natijasida: qaysi section zaifligini aniqla va o'sha bo'limdan qo'shimcha mashq ber`
    }

    // Default: Matematika
    return `# 🏆 MILLIY SERTIFIKAT IMTIHONI (Matematika)

## Savol turlari:
- **Y-1** (Yagona tanlov): To'g'ri bir javob tanlanadi. 1–3 ball.
- **Y-2** (Moslashtirish): Ikkita ustunni moslashtirish. 2.2 ball.
- **O** (Ochiq javob): a) va b) qismlar, 1.5–3.2 ball.

## 7 ta mavzu bloki (5–9-sinf dasturi asosida):
1. **Sonlar va amallar** — natural, butun, ratsional, irratsional, haqiqiy sonlar; darajalar, ildizlar
2. **Algebraik ifodalar** — ko'paytmalar formulalari, algebraik kasrlar, ko'phadlar
3. **Tenglamalar va tengsizliklar** — chiziqli, kvadrat, tizimlar, modul, parametr
4. **Funksiyalar** — grafik o'qish, xossalar, o'zgarish, kvadrat funksiya, darajali
5. **Matematik analiz** — limitlar, hosilalar, integrallar (asosiy formulalar)
6. **Geometriya** — planimetriya (uchburchak, to'rtburchak, aylana), stereometriya, trigonometriya
7. **To'plamlar, mantiq, kombinatorika, ehtimollik** — kesishma, birlashma, permutatsiya, kombinatsiya

## Baholash (Rasch modeli → ball):
- **A+** — 70.0 va undan yuqori
- **A** — 65.0–69.9
- **B+** — 60.0–64.9
- **B** — 55.0–59.9
- **C+** — 50.0–54.9
- **C** — 46.0–49.9

## Mock test strategiyasi:
- 7 blokdan aralashtir: har blokdan kamida 1–3 ta savol
- Y-1 formatida ber (A/B/C/D variantlar)
- Test natijalari kelganda — qaysi blokda xato ko'p ekanini aniqlat va o'sha blokdan qo'shimcha mashq ber
- O'quvchi maqsad balliga yetishi uchun qaysi mavzular muhimroq ekanini doim hisobga ol`
}

function buildSystemPrompt(profile: any, subject?: string, extraRules?: string, ov: Record<string, string> = {}): string {
    const now = new Date()
    const get = (key: string, def: string) => ov[key]?.trim() || def

    let daysLeft = ''
    if (profile?.examDate) {
        const diff = Math.ceil((new Date(profile.examDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (diff > 0) daysLeft = `Imtihon sanasi: ${new Date(profile.examDate).toLocaleDateString('uz')} (${diff} kun qoldi).`
        else daysLeft = 'Imtihon sanasi o\'tgan.'
    }

    let weakTopics: string[] = []
    let strongTopics: string[] = []
    try { weakTopics = profile?.weakTopics ? JSON.parse(profile.weakTopics) : [] } catch { }
    try { strongTopics = profile?.strongTopics ? JSON.parse(profile.strongTopics) : [] } catch { }

    const roleSection = get('prompt_role', `Sen — do'stona, professional ustoz. Oddiy tilda gapir. O'quvchi nima so'rasa — shuni ber, ortiqcha narsa qo'shma. Xulosa, jadval, tekshiruv savollari — FAQAT so'ralganda.`)

    const teachSection = get('prompt_teaching', `# ASOSIY QOIDA: O'QUVCHI NIMA SO'RASA — FAQAT SHUNI QIL

⚠️ BU ENG MUHIM QOIDA. Quyidagi jadvalga QATTIQ amal qil:

| O'quvchi so'rovi | Sening harakating |
|---|---|
| "Tushuntir" / "Bu nima?" / oddiy savol | DARHOL tushuntir, 3-10 satr. Test BERMA. Diagnostika QILMA. |
| "Test ber" / "Mock test" / "Bilimimni tekshir" | \`\`\`test formatida 15-20 ta savol ber. Kamida 15 ta! |
| "Flashcard" / "Kartochka" | \`\`\`flashcard formatida 8-15 ta kartochka |
| Fayl/rasm yuklasa | Rasmdagi/fayldagi narsani tahlil qil. Chat mavzusini EMAS, RASMDAGI mavzuni tahlil qil! |
| Xato qilsa | Qisqa tuzat, 2-3 satr izoh |

## DIAGNOSTIKA — TAQIQLANGAN (3 istisno bilan)

❌ HECH QACHON o'zing diagnostika boshla!
❌ Oddiy savolga javob berib keyin "bilimingizni tekshiramiz" dema!
❌ Har javobdan keyin "endi test qilib ko'ramiz" dema!
❌ 3-5 ta savol bilan baholab "siz buni bilmasekansiz" dema!

✅ Diagnostika FAQAT 3 holatda:
1. O'quvchi O'ZI "bilmayapman, qiynalayapman, aniqla" desa
2. O'quvchi 3+ marta bir xil xatoni qaytarsa (tabiiy aytib o't)
3. O'quvchi O'ZI diagnostika so'rasa

## TEST QOIDALARI (MAJBURIY)

O'quvchi test so'rasa:
- **Oddiy "test ber"** → 15-20 ta savol, osondan qiyinga (progressive difficulty)
- **"Mock test" / "sinov test" / "to'liq test"** → 25-30 ta savol, to'liq imtihon formati
- **Mavzuga oid test** → 10-15 ta savol, faqat shu mavzudan

⚠️ HECH QACHON 3-5 ta savol bilan test berma! Minimum 10 ta!

Test tuzilishi:
1. Dastlabki 30% — oson savollar (asosiy tushunchalar)
2. O'rtadagi 40% — o'rta qiyinlik
3. Oxirgi 30% — qiyin savollar (amaliy, trap questionlar)

Ingliz tilida test berganingda:
- Grammar: dastlab Present Simple → Present Continuous → Past Simple → Present Perfect → Past Perfect → Mixed Tenses tartibida
- Vocabulary: oson so'zlardan murakkab so'zlarga
- HECH QACHON random mavzudan olma — osondan qiyinga tartibda ber

## JAVOB HAJMI

- Oddiy savol → 2-5 satr
- Murakkab mavzu → 10-20 satr, kerak bo'lsa misol
- Test → faqat \`\`\`test JSON, oldida/keyinida matn yozma
- Bitta xabarda 30 satrdan oshmasin

O'quvchiga keraksiz savollar berma: "Tushunarlimi?", "Yana nimani tushuntiray?", "Tayyor bo'lsangiz..." — bularni QILMA.`)

    const formatSection = get('prompt_format', `## Matematik formulalar — LaTeX (MAJBURIY)

Barcha matematik ifodalarni LaTeX da yoz:
- Inline: $f(x) = x^2$
- Alohida qatorda: $$\\int_a^b f(x)\\,dx = F(b) - F(a)$$

**LaTeX qoidalari:**
- Kasr: DOIMO \\frac{}{} — HECH QACHON / belgisi
- Integral: $\\int x^2\\,dx$
- Limit: $\\lim_{x \\to \\infty}$
- Ildiz: $\\sqrt{x}$, $\\sqrt[3]{x}$
- Trigonometriya: $\\sin x$, $\\cos x$

## Test formati (MAJBURIY)

Test so'ralganda FAQAT \`\`\`test JSON formatida ber — kamida 15 ta savol:
\`\`\`test
[{"q":"Savol?","a":"A variant","b":"B variant","c":"C variant","d":"D variant","correct":"a"}]
\`\`\`
- correct: to'g'ri javob harfi (a/b/c/d)
- Test JSON dan keyin matn yozma — o'quvchi interaktiv yechadi
- HECH QACHON oddiy A) B) C) D) formatda test berma
- Minimum 15 ta savol! 3-5 ta savol bilan test berish TAQIQLANGAN!

## Flashcard formati

\`\`\`flashcard
[{"front":"Savol yoki formula?","back":"Javob yoki izoh"}]
\`\`\`

## Jadval formati

Jadvaldan oldin va keyin bo'sh qator bo'lsin.`)

    const fileSection = get('prompt_file', `## FAYL / RASM TAHLILI QOIDALARI

⚠️ MUHIM: Rasm yoki fayl yuklansa — RASMDAGI/FAYLDAGI mavzuni tahlil qil, chat mavzusini EMAS!

Masalan:
- Chat ingliz tilida, lekin rasm MATEMATIKA haqida → MATEMATIKA tahlil qil
- Chat matematikada, lekin rasm INGLIZ TILI haqida → INGLIZ TILI tahlil qil
- Rasmda test savollar bo'lsa → DARHOL yech, "tahlil qilaymi?" DEMA

Qoidalar:
- DARHOL tahlil qil, ruxsat so'rama
- Barcha savollarni yech — birontasini o'tkazib ketma
- Har savol: savol matni → to'g'ri javob → qisqa izoh
- \`\`\`test formatini ishlatma — savollar allaqachon mavjud
- Oxirida qisqa xulosa: qaysi mavzular bo'lgani

Agar rasm matnini o'qib bo'lmasa yoki ko'ra olmasang — foydalanuvchiga ayt: "Rasmni aniq ko'ra olmadim, iltimos savol matnini yozib bering"`)

    const examSection = subject === 'Ingliz tili'
        ? get('prompt_english', getExamSection('Ingliz tili'))
        : get('prompt_math', getExamSection(subject))

    const dontsSection = get('prompt_donts', `# ❌ TAQIQLANGAN HARAKATLAR

Bu harakatlarni HECH QACHON qilma:

1. ❌ O'quvchi so'ramasdan diagnostika/test boshlash
2. ❌ 3-5 ta savol bilan "bilimingizni tekshirdim" deb xulosa chiqarish
3. ❌ Har javob oxirida "Tushunarlimi?", "Yana savollaringiz bormi?" deb so'rash
4. ❌ Oddiy savolga javob berib keyin "keling bilimingizni tekshiramiz" deyish
5. ❌ O'quvchi savolga javob berganda darhol yangi savol berish
6. ❌ Skript iboralar qaytarish (har safar bir xil kirish so'zi)
7. ❌ Ingliz tili darsida INGLIZCHA javob berish (izohlar O'ZBEK tilida!)
8. ❌ Fayl yuklanganda "yechishni xohlaysizmi?" deb so'rash
9. ❌ RAG materiallarini aynan nusxalash
10. ❌ profile-update blokini o'quvchi rozilik bildirmagan holda yuborish
11. ❌ "📋 Xulosa" jadvalni har javobda qo'shish
12. ❌ Random mavzudan 3-5 ta test berib keyin "bu mavzuni bilmaysiz" deb xulosa chiqarish
13. ❌ Chat mavzusidagi narsalarni gapirish — agar rasm/fayl boshqa mavzuda bo'lsa`)

    return `Sen msert platformasining AI o'qituvchisan.

TIL: DOIMO VA FAQAT O'ZBEK TILIDA javob ber. Ingliz tili darsida ham tushuntirishlar O'ZBEK TILIDA bo'lsin — inglizcha misollar ko'rsatish mumkin, lekin izoh O'ZBEK TILIDA.

## Sening xaraktering
${roleSection}

## O'quvchi haqida
${[
            subject ? `**Fan:** ${subject}` : '',
            daysLeft ? `**Imtihon:** ${daysLeft}` : '',
            weakTopics.length > 0 ? `**Zaif deb o'ylaydi:** ${weakTopics.join(', ')} (bu o'quvchining o'z fikri — hali tekshirilmagan)` : '',
            strongTopics.length > 0 ? `**Kuchli deb o'ylaydi:** ${strongTopics.join(', ')}` : '',
            profile?.targetScore ? `**Maqsad:** ${profile.targetScore} ball` : '',
            profile?.concerns ? `**Tashvishi:** ${profile.concerns}` : '',
        ].filter(Boolean).join('\n')}

## Qanday ishlaysan
${teachSection}

## Formatlash
${formatSection}

${examSection}

## Fayl / Rasm tahlili
${fileSection}

## Profil yangilash
Suhbat davomida o'quvchining zaif/kuchli tomonlarini ANIQLAB OLSANG (kamida 3-4 ta test/mashqdan keyin):
"Shu mavzularda qiynalyapsiz, profilingizni yangilasam maylimi?"
O'quvchi rozi bo'lsa:
\`\`\`profile-update
{"weakTopics": ["mavzu1"], "strongTopics": ["mavzu2"]}
\`\`\`
Tez-tez taklif qilma — faqat aniq bilib olganingda.

${dontsSection}

Sana: ${now.toLocaleDateString('uz-UZ')}.${extraRules ? '\n\n## Admin qo\'shimcha qoidalari\n' + extraRules : ''}`
}

// Yangi chat ochish (yoki mavjud fan chatini qaytarish)
router.post('/new', authenticate, async (req: AuthRequest, res) => {
    try {
        const { subject, title } = req.body
        // Fan ko'rsatilgan bo'lsa — mavjud chatni qaytaramiz (bitta fan = bitta chat)
        if (subject) {
            const existing = await prisma.chat.findFirst({
                where: { userId: req.user.id, subject },
                orderBy: { updatedAt: 'desc' }
            })
            if (existing) return res.status(200).json(existing)
        }
        const chat = await prisma.chat.create({
            data: {
                userId: req.user.id,
                title: title || `${subject || 'Umumiy'} suhbat`,
                subject: subject || null
            }
        })
        res.status(201).json(chat)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Barcha chatlar ro'yxati
router.get('/list', authenticate, async (req: AuthRequest, res) => {
    try {
        const chats = await prisma.chat.findMany({
            where: { userId: req.user.id },
            orderBy: { updatedAt: 'desc' },
            select: { id: true, title: true, subject: true, updatedAt: true }
        })
        res.json(chats)
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// Chat xabarlarini olish
router.get('/:chatId/messages', authenticate, async (req: AuthRequest, res) => {
    try {
        const chat = await prisma.chat.findFirst({
            where: { id: (req.params.chatId as string), userId: req.user.id }
        })
        if (!chat) return res.status(404).json({ error: 'Chat topilmadi' })

        const messages = await prisma.message.findMany({
            where: { chatId: chat.id },
            orderBy: { createdAt: 'asc' }
        })
        res.json({ chat, messages })
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

// RAG: content-based relevant chunks search
async function searchRAGContext(query: string, subject?: string): Promise<string> {
    try {
        // Search relevant chunks by content similarity (keyword matching)
        const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3)
        if (keywords.length === 0) return ''

        const allChunks = await prisma.documentChunk.findMany({
            where: {
                document: subject ? { subject } : undefined
            },
            include: { document: { select: { fileName: true, subject: true } } },
            take: 100 // get more chunks for relevance scoring
        })

        // Score chunks by keyword match relevance
        const scored = allChunks.map(chunk => {
            const lower = chunk.content.toLowerCase()
            let score = 0
            for (const kw of keywords) {
                const matches = lower.split(kw).length - 1
                score += matches
            }
            return { chunk, score }
        })
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5) // top 5 most relevant

        if (scored.length === 0) return ''

        return '\n\n📚 TEGISHLI O\'QUV MATERIALLARI (RAG):\n' +
            scored.map(s => `[${s.chunk.document.fileName}]: ${s.chunk.content} `).join('\n---\n') +
            '\n\nYuqoridagi materiallarni o\'z so\'zlaring bilan qayta tushuntir, aynan nusxalama.'
    } catch {
        return ''
    }
}

// Chat uchun fayl yuklash va matn extraction
router.post('/:chatId/upload-file', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        const chat = await prisma.chat.findFirst({ where: { id: req.params.chatId as string, userId: req.user.id } })
        if (!chat) return res.status(404).json({ error: 'Chat topilmadi' })
        if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' })

        const { mimetype, originalname, buffer } = req.file
        let extractedText = ''
        let fileType = 'other'

        if (mimetype === 'application/pdf') {
            fileType = 'pdf'
            const data = await pdfParse(buffer)
            extractedText = data.text.trim()
        } else if (mimetype.includes('word') || originalname.endsWith('.docx') || originalname.endsWith('.doc')) {
            fileType = 'word'
            const result = await mammoth.extractRawText({ buffer })
            extractedText = result.value.trim()
        } else if (mimetype.startsWith('text/')) {
            fileType = 'text'
            extractedText = buffer.toString('utf-8').trim()
        } else if (mimetype.startsWith('image/')) {
            fileType = 'image'
            // Rasmni base64 sifatida vaqtinchalik saqlaymiz — stream routeda AI ga yuboramiz
            const dataUrl = `data:${mimetype};base64,${buffer.toString('base64')}`
            pendingImages.set(chat.id, dataUrl)
            extractedText = `[Rasm: ${originalname}] — AI rasmni ko'radi va tahlil qiladi`
        } else {
            extractedText = `[Fayl: ${originalname}]`
        }

        if (extractedText.length > 15000) {
            extractedText = extractedText.substring(0, 15000) + '\n...(fayl qisqartirildi)'
        }

        res.json({ text: extractedText, fileName: originalname, fileType })
    } catch (e: any) {
        console.error('File upload error:', e.message)
        res.status(500).json({ error: 'Fayl o\'qib bo\'lmadi' })
    }
})

// Streaming xabar yuborish (SSE)
router.post('/:chatId/stream', authenticate, async (req: AuthRequest, res) => {
    try {
        const { content, thinking, displayText } = req.body
        if (!content?.trim()) return res.status(400).json({ error: 'Xabar bo\'sh' })

        const chat = await prisma.chat.findFirst({
            where: { id: (req.params.chatId as string), userId: req.user.id }
        })
        if (!chat) return res.status(404).json({ error: 'Chat topilmadi' })

        // Foydalanuvchi xabarini saqlash (displayText — foydalanuvchiga ko'rinadigan matn)
        const savedUserContent = displayText?.trim() || content
        await prisma.message.create({
            data: { chatId: chat.id, role: 'user', content: savedUserContent }
        })

        // Oldingi xabarlar (ko'proq kontekst)
        const history = await prisma.message.findMany({
            where: { chatId: chat.id },
            orderBy: { createdAt: 'asc' },
            take: 80
        })

        // Profile olish
        const profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })

        // AI settings
        const aiSettings = await getAISettings()

        // RAG kontekst — relevance based
        const ragContext = await searchRAGContext(content, chat.subject || undefined)

        const systemPrompt = buildSystemPrompt(profile, chat.subject || undefined, aiSettings.extraRules, aiSettings.promptOverrides) + ragContext

        // Rasm bormi tekshir (upload-file dan saqlangan)
        const pendingImg = pendingImages.get(chat.id)
        if (pendingImg) pendingImages.delete(chat.id) // bir marta ishlatamiz

        // History: oxirgi user xabar (hozir saqlanganini) alohida olamiz
        const historyWithoutLast = history.slice(0, -1)
        const currentUserContent: any = pendingImg
            ? [
                { type: 'image_url', image_url: { url: pendingImg } },
                { type: 'text', text: content }
            ]
            : content

        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            ...historyWithoutLast.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: currentUserContent }
        ]

        // Model tanlash: thinking=true -> deepseek-reasoner (R1), aks holda deepseek-chat (V3)
        const model = thinking ? 'deepseek-reasoner' : 'deepseek-chat'

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.flushHeaders()

        let fullReply = ''
        let aborted = false

        // Client disconnect detection
        req.on('close', () => { aborted = true })

        const streamOptions: any = {
            model,
            messages,
            max_tokens: thinking ? 8192 : aiSettings.maxTokens,
            stream: true
        }
        // deepseek-reasoner doesn't support temperature
        if (!thinking) {
            streamOptions.temperature = aiSettings.temperature
        }

        const stream = await openai.chat.completions.create(streamOptions) as any

        for await (const chunk of stream) {
            if (aborted) break
            const delta = chunk.choices[0]?.delta?.content || ''
            // Reasoning tokens (thinking process)
            const reasoning = (chunk.choices[0]?.delta as any)?.reasoning_content || ''
            if (reasoning) {
                res.write(`data: ${JSON.stringify({ thinking: reasoning })}\n\n`)
            }
            if (delta) {
                fullReply += delta
                res.write(`data: ${JSON.stringify({ content: delta })}\n\n`)
            }
        }

        if (aborted) {
            // Save partial response
            if (fullReply.trim()) {
                await prisma.message.create({
                    data: { chatId: chat.id, role: 'assistant', content: fullReply }
                })
            }
            return res.end()
        }

        // Stream tugagandan keyin bazaga saqlash
        const saved = await prisma.message.create({
            data: { chatId: chat.id, role: 'assistant', content: fullReply }
        })

        // Chat title yangilash (birinchi xabar bo'lsa)
        if (history.length <= 2) {
            const titleSrc = displayText?.trim() || content
            const shortTitle = titleSrc.substring(0, 40) + (titleSrc.length > 40 ? '...' : '')
            await prisma.chat.update({ where: { id: chat.id }, data: { title: shortTitle } })
        }

        res.write(`data: ${JSON.stringify({ done: true, id: saved.id })}\n\n`)
        res.end()
    } catch (e: any) {
        console.error('AI stream error:', e.message)
        if (!res.headersSent) {
            res.status(500).json({ error: 'AI javob bera olmadi' })
        } else {
            res.write(`data: ${JSON.stringify({ error: 'AI xatoligi' })}\n\n`)
            res.end()
        }
    }
})

// Eski non-streaming endpoint (fallback)
router.post('/:chatId/send', authenticate, async (req: AuthRequest, res) => {
    try {
        const { content } = req.body
        if (!content?.trim()) return res.status(400).json({ error: 'Xabar bo\'sh' })

        const chat = await prisma.chat.findFirst({
            where: { id: (req.params.chatId as string), userId: req.user.id }
        })
        if (!chat) return res.status(404).json({ error: 'Chat topilmadi' })

        await prisma.message.create({
            data: { chatId: chat.id, role: 'user', content }
        })

        const history = await prisma.message.findMany({
            where: { chatId: chat.id },
            orderBy: { createdAt: 'asc' },
            take: 80
        })

        const profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id }
        })

        const aiSettings = await getAISettings()
        const ragContext = await searchRAGContext(content, chat.subject || undefined)
        const systemPrompt = buildSystemPrompt(profile, chat.subject || undefined, aiSettings.extraRules, aiSettings.promptOverrides) + ragContext

        // Pending image ni tozalash (send route ishlatilsa)
        pendingImages.delete(chat.id)

        const msgs: any[] = [
            { role: 'system', content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: m.content }))
        ]

        const completion = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: msgs,
            max_tokens: aiSettings.maxTokens,
            temperature: aiSettings.temperature
        })

        const reply = completion.choices[0]?.message?.content || 'Javob olinmadi'
        const saved = await prisma.message.create({
            data: { chatId: chat.id, role: 'assistant', content: reply }
        })

        if (history.length <= 2) {
            const shortTitle = content.substring(0, 40) + (content.length > 40 ? '...' : '')
            await prisma.chat.update({ where: { id: chat.id }, data: { title: shortTitle } })
        }

        res.json(saved)
    } catch (e: any) {
        console.error('AI error:', e.message)
        res.status(500).json({ error: 'AI javob bera olmadi' })
    }
})

// Chat o'chirish
router.delete('/:chatId', authenticate, async (req: AuthRequest, res) => {
    try {
        await prisma.chat.deleteMany({
            where: { id: (req.params.chatId as string), userId: req.user.id }
        })
        res.json({ message: 'Chat o\'chirildi' })
    } catch (e) {
        res.status(500).json({ error: 'Server xatoligi' })
    }
})

export default router
