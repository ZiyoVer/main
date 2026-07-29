---
name: dtmmax-redesign
description: DTMMax preview redesign (redesign/dtmmax-v2 branch) uchun to'liq ish jarayoni — hujjatlarni o'qish, Focus Rail dizayn tizimi, audit, rationale, implementatsiya va verifikatsiya. Student/teacher/admin ekranlarini qayta dizayn qilish, UI/UX yaxshilash, generic AI ko'rinishidan chiqarish kerak bo'lganda ishlatiladi.
whenToUse: DTMMax frontendida dizayn, UI/UX, responsive, accessibility yoki vizual sifat ustida ishlaganda; redesign/dtmmax-v2 branchidagi har qanday frontend vazifada
type: prompt
---

# DTMMax Preview Redesign — Ish Jarayoni

## 0. Xavfsizlik (har doim birinchi)

- Faqat `redesign/dtmmax-v2` branchida ishla. `main` va `reysh` himoyalangan —
  foydalanuvchi alohida tasdiqlamaguncha merge/push qilma.
- `design/08-heuristic-evaluation.md` dagi dirty o'zgarish foydalanuvchiniki —
  stage, reset yoki commit qilma.
- Paylov flow funksional jihatdan muzlatilgan — tegma.
- Backend contractni taxmin bilan o'zgartirma. Yangi API field kerak bo'lsa,
  `docs/PREVIEW-REDESIGN-HANDOFF.md` qaror jurnaliga talab + sabab yoz.

## 1. Kontekst (ish boshlashdan oldin o'qi)

Tartib muhim: `AGENTS.md` → `PRODUCT.md` → `DESIGN.md` →
`docs/PREVIEW-REDESIGN-HANDOFF.md` → `docs/KIMI-FRONTEND-BRIEF.md`.

## 2. Audit

- O'zgartiriladigan ekranni va unga bog'langan state/API consumerlarni top
  (`ChatLayout.tsx`, `TestPage.tsx`, `TeacherPanel.tsx`, `AdminPanel.tsx` —
  yuqori riskli fayllar).
- Mavjud token va komponentlarni qayta ishlat; yangi token kiritishdan oldin
  `DESIGN.md` palette/spacing/radius jadvaliga qara.
- `redesign-existing-projects`, `web-design-guidelines` va `accessibility`
  skilllari bilan generic AI patternlar va WCAG muammolarini belgilab ol.

## 3. Rationale (kod yozishdan oldin, qisqa)

Har yangi vizual qaror uchun 3 savolga javob yoz:

1. O'quvchi/o'qituvchi/adminning qaysi qarorini tezlashtiradi?
2. Focus Rail tilini qanday rivojlantiradi (yoki nima uchun DTMMaxga xos)?
3. Qaysi state va breakpointlarda tekshiriladi?

## 4. Implementatsiya qoidalari

- Focus Rail: sokin neytral sirt, `orange-500 #F15A24` faqat ~10% maydonda,
  Exam Progress Rail faqat real holat uchun. To'liq tokenlar `DESIGN.md` da.
- Anti-patternlar taqiqlangan: gradient/glass/grid bezak, serif/italic display,
  warm-paper, nested ulkan yumaloq kartalar, dekorativ progress, faqat rang
  bilan status, bir ekranda bir necha dominant CTA.
- Holatlar: har interaktiv componentda `default/hover/focus-visible/active/
  disabled/loading/error/success`. Focus ring 2px, tashqarida, ≥3:1 kontrast.
- Responsive: `<768px` bottom nav + 1 column; `768–1099px` compact sidebar;
  `>=1100px` sidebar + 2 column workspace. Touch target ≥44×44px, body ≥16px.
- Motion: 150–220ms ease-out; faqat state o'zgarishini tushuntiradi;
  `prefers-reduced-motion` hurmat qilinadi.
- Katta fayllarni rewrite qilma — nomlangan kichik komponentlarga bosqichma-
  bosqich ajrat. Til: o'zbek (UI matnlar, izohlar, commitlar).

## 5. Verifikatsiya (har batchdan keyin)

```bash
cd frontend && npm run build && cd ..
git diff --check
git status --short --branch
curl -fsS https://main-main-pr-1.up.railway.app/api/health
```

Playwright MCP (`mcp__playwright__*`) bilan previewni ochib, o'zgargan ekranni
desktop (1280) va mobile (375) viewportda ko'zdan kechir: kontrast, focus
holati, layout shift, bitta dominant CTA. Backend o'zgargan bo'lsa
`cd backend && npm test`.

## 6. Jurnal

Har katta qarordan keyin `docs/PREVIEW-REDESIGN-HANDOFF.md` dagi qaror
jurnaliga qator qo'sh: sana, qaror, sabab.
