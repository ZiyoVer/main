# Kimi Frontend Brief — DTMMax Preview

## Kirish

Siz faqat `redesign/dtmmax-v2` branchidagi preview frontend ustida ishlaysiz.
`main` va `reysh`ga tegmang. Ish boshlashdan oldin quyidagi fayllarni to‘liq
o‘qing:

1. `AGENTS.md`
2. `PRODUCT.md`
3. `DESIGN.md`
4. `docs/PREVIEW-REDESIGN-HANDOFF.md`

Preview URL:

`https://main-main-pr-1.up.railway.app`

## Sizning asosiy mas’uliyatingiz

- frontend dizayn va UI/UX;
- student, teacher va admin axborot arxitekturasi;
- responsive/mobile holatlar;
- typography, spacing, hierarchy va component states;
- loading, empty, error va success holatlari;
- keyboard, focus, touch target va reduced-motion accessibility;
- frontend performance va perceived performance;
- mavjud UI’ni generic AI ko‘rinishidan chiqarish.

Backend contractni taxmin bilan o‘zgartirmang. API contract yoki yangi backend
field kerak bo‘lsa, `docs/PREVIEW-REDESIGN-HANDOFF.md` qaror jurnaliga talab va
sababini yozing; backend egasi uni amalga oshiradi.

## Kreativ erkinlik

Mavjud ekranlarni pikselma-piksel ko‘chirish shart emas. Yangi layout,
kompozitsiya, navigation pattern, micro-interaction, empty state va product
motiflar taklif qilishingiz mumkin. DTMMax bir qarashda O‘zbekiston imtihon
tayyorgarligi mahsuloti bo‘lib tanilishi kerak.

Focus Rail — boshlanish nuqtasi, qamoq emas. Uni rivojlantirish mumkin, agar:

- keyingi foydali vazifa ravshanroq bo‘lsa;
- o‘quvchi kamroq qaror qilsa;
- test yechish jarayoni tezroq va sokinroq bo‘lsa;
- teacher/admin ishlarida murakkablik kamaytirilsa;
- mobile va accessibility yomonlashmasa.

Yangi vizual qaror oldidan qisqa rationale yozing:

1. qaysi user muammosini yechadi;
2. nima uchun bu DTMMaxga xos;
3. qaysi state va breakpointlarda tekshiriladi.

## Birinchi navbatdagi ekranlar

1. Student `Bugun` va `AI ustoz` o‘rtasidagi o‘quv oqimi.
2. Rasmli public test runner va answer sheet.
3. Teacher fayldan test yaratish → AI review → publish.
4. Test katalogi, kategoriyalar va limit/progress rail.
5. Admin’ning content, AI va payment operatsion holatlari.
6. Login/register va onboarding continuity.

## Muhim UX talablari

- Tayyor CTA bosilganda ichki prompt user xabari sifatida chatda ko‘rinmaydi.
- AI mashq/testni uzun chat matni qilib bermaydi; interaktiv panel ochadi.
- Rasm yuklanayotganda joy oldindan rezerv qilinadi; layout sakramaydi.
- Error matni foydalanuvchiga keyingi tuzatiladigan qadamni aytadi.
- Bir ekranda bitta dominant CTA.
- Asosiy body matni odatda 16 px; touch target kamida 44×44 px.
- Status faqat rang bilan ifodalanmaydi.

## Anti-patternlar

- generic AI SaaS yoki ChatGPT kloni;
- ma’nosiz gradient/glass/grid;
- serif/italic editorial hero;
- nested ulkan yumaloq kartalar;
- har elementga pill;
- dekorativ progress;
- rangli metric kartalar dengizi;
- hover uchun layout siljishi;
- mobile’da desktop’ni shunchaki siqish.

## Ish usuli

- Mavjud frontendni audit qilib, takroriy component va tokenlardan foydalaning.
- Katta `ChatLayout.tsx`, `TeacherPanel.tsx`, `AdminPanel.tsx` fayllarini imkon
  qadar kichik, nomlangan componentlarga ajrating.
- Backendga tegmasdan ishlay oladigan joyda mock data emas, mavjud API
  contractdan foydalaning.
- Har batchdan keyin:

```bash
cd frontend
npm run build
cd ..
git diff --check
```

- Faqat `redesign/dtmmax-v2` branchga commit/push qiling.
- `design/08-heuristic-evaluation.md`dagi mavjud dirty o‘zgarishga tegmang.
- Bajarilgan ish va yangi qarorni
  `docs/PREVIEW-REDESIGN-HANDOFF.md` qaror jurnaliga qo‘shing.

