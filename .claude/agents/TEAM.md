# DtmMax Agent Jamoasi — Logika va Ish Tartibi

Bu hujjat agentlar **qaysi tartibda** ishlashini va bir-biriga **qanday bog'liqligini** belgilaydi.
Hammasi **Fable Mode** intizomida ishlaydi (`/Users/abc/.claude/skills/fable-mode`): bosqich xaritasi →
delegatsiya → yiqilishi mumkin bo'lgan tekshiruv → skeptik self-review.

## Agentlar

| Agent | Roli | Tuzatadi? |
|-------|------|-----------|
| `tech-lead` | Koordinator — rejalashtiradi, tartibni belgilaydi, mutaxassislarni chaqiradi, gate qo'yadi | yo'q (boshqaradi) |
| `ui-ux-designer` | Dizayn spetsifikatsiyasi (layout/holatlar/tokenlar/microcopy) | dizayn yozadi |
| `backend-engineer` | API kontrakti, Prisma, route, baholash | ha (backend) |
| `ai-engineer` | DeepSeek/SSE/RAG/prompt/Rasch-AI | ha (AI qism) |
| `frontend-engineer` | React UI — dizayn + kontraktni amalga oshiradi | ha (frontend) |
| `judge` | Har bir natijani PASS/FAIL qiladi (adversarial) | yo'q (faqat hukm) |
| *audit:* `bug-finder`, `security`, `critic` | Mavjud read-only auditorlar | yo'q |

## Asosiy oqim (feature/o'zgarish uchun)

```
        ┌─────────────┐
        │  FOYDALANUVCHI vazifasi
        └──────┬──────┘
               ▼
        ┌─────────────┐   0. Aniqlik yetishmasa 2-3 savol
        │  tech-lead  │   1. Bosqich xaritasi + kim kerakligini hal qiladi
        └──────┬──────┘
               ▼
   ┌───── UI/foydalanuvchi o'zgarishimi? ─────┐
   │ ha                                        │ yo'q
   ▼                                           │
┌──────────────┐  dizayn spec                  │
│ ui-ux-designer│──────────────┐               │
└──────────────┘               │               │
                               ▼               ▼
              ┌──────────────────────────────────────┐
              │  SHARTNOMA BOSQICHI (parallel mumkin) │
              │  ┌────────────────┐  ┌──────────────┐ │
              │  │ backend-engineer│  │  ai-engineer │ │
              │  │ (API kontrakti) │  │ (AI/SSE/RAG) │ │
              │  └───────┬────────┘  └──────┬───────┘ │
              └──────────┼──────────────────┼─────────┘
                         ▼ kontrakt + dizayn ▼
                  ┌──────────────────┐
                  │ frontend-engineer│  (dizayn + kontrakt TAYYOR bo'lgach)
                  └────────┬─────────┘
                           ▼
                  ┌──────────────────┐   FAIL → tegishli mutaxassisga qaytar (maks 2x)
                  │      judge       │───────────────┐
                  └────────┬─────────┘               │
                           ▼ PASS                     ▼ 2x FAIL → tech-lead eskalatsiya
                  ┌──────────────────┐
                  │ tech-lead: GATE  │  tsc + build + test, keyin self-critique
                  └────────┬─────────┘
                           ▼
                       YETKAZISH
```

## Bog'liqlik qoidalari (qat'iy)

1. **Ma'lumotlar modeli (Prisma) eng birinchi** — agar schema o'zgarsa, hamma shunga tayanadi.
2. **`frontend-engineer`** HECH QACHON `ui-ux-designer` dizayni VA `backend-engineer` API kontrakti
   tayyor bo'lmasdan boshlamaydi.
3. **`backend-engineer`** va **`ai-engineer`** odatda parallel; lekin AI endpoint route'ga tegsa,
   kontraktni backend belgilaydi.
4. Har bir mutaxassis natijasi **`judge`dan PASS** olmaguncha "tugadi" deyilmaydi.
5. **`judge` FAIL** bersa → aniq sabab bilan tegishli mutaxassisga qaytadi (maks 2 marta),
   keyin `tech-lead`ga eskalatsiya.

## Qachon qaysi oqim

- **Faqat dizayn so'rovi** ("sahifani chiroyliroq qil"): `ui-ux-designer` → `frontend-engineer` → `judge`.
- **Faqat backend/API** ("endpoint qo'sh"): `backend-engineer` → `judge`.
- **AI/chat/baholash** ("tutor promptini yaxshila", "scoring bug"): `ai-engineer` → `judge`.
- **To'liq feature** ("yangi test rejimi qo'sh"): `tech-lead` to'liq oqimni boshqaradi.
- **Audit** ("bug top", "xavfsizlik", "kod sifati"): mavjud `bug-finder`/`security`/`critic`
  (yoki `orchestrator`) — bu read-only auditorlar.

## Qanday ishga solish (Claude Code'da)

- To'g'ridan-to'g'ri: `@tech-lead yangi flashcard rejimi qo'sh` — Tech Lead butun oqimni boshqaradi.
- Yoki bitta mutaxassisni: `@backend-engineer /api/streaks endpoint qo'sh`.
- Tech Lead `Agent` tooli orqali boshqalarni chaqiradi va `judge`ni gate sifatida ishlatadi.

## Oltin qoida
Har bir bosqich **yiqilishi mumkin bo'lgan tekshiruv** bilan tugaydi (tsc/test/preview-render),
"ishlayotgandek" emas. Dalil yo'q bo'lsa — ish tugamagan.
