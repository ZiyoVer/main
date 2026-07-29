# DTMMax Design System

## Direction

Ichki nomi **Focus Rail**. Product UI stress ostidagi o‘quvchi uchun tartibli imtihon stoli kabi ishlaydi: sokin neytral sirt, aniq tipografiya, kam ishlatilgan orange va real DTM javob/progress motivi. Marketing yuzasi shu tizimni dadilroq orange bloklar va real product oqimi bilan namoyish qiladi.

## Color

### Primitive palette

| Token | Value | Use |
| --- | --- | --- |
| `orange-500` | `#F15A24` | Brand, primary action, active progress |
| `orange-600` | `#C94718` | Dark accent and text on pale brand tint |
| `orange-050` | `#FFF1EB` | Selected or informative brand tint |
| `ink-950` | `#171717` | Primary text |
| `neutral-700` | `#4F4F4F` | Secondary text |
| `neutral-600` | `#626262` | Muted readable text |
| `neutral-300` | `#DEDEDE` | Borders and dividers |
| `neutral-100` | `#F0F0F0` | Sunken surface |
| `neutral-050` | `#F7F7F7` | Page canvas |
| `white` | `#FFFFFF` | Working surface |
| `success-600` | `#18864B` | Correct/success |
| `danger-600` | `#C9362B` | Error/incorrect |
| `info-600` | `#2F63D8` | Informational state |

Product rang strategiyasi restrained: orange ko‘rinadigan product yuzasining taxminan 10 foizidan oshmaydi. Marketing committed bo‘lishi mumkin, ammo gradient, glass va rangli matn ishlatilmaydi. Semantik ranglar doim ikon yoki matn bilan birga keladi.

Orange filled control `#171717` matn bilan ishlaydi; kichik oq matn `orange-500` ustida qo‘llanmaydi. Hover holati fill’ni biroz yengillashtiradi, focus esa alohida yuqori-kontrast ink ring bilan ko‘rsatiladi.

### Dark mode

Dark mode invert qilingan light theme emas. Page `#111111`, working surface `#191919`, elevated surface `#222222`, primary text `#F5F5F5`, secondary text `#B8B8B8`, border `#343434`; orange dark fonda biroz yengilroq `#FF7442`. Chuqurlik shadow bilan emas, surface lightness bilan beriladi.

## Typography

Product UI bitta oiladan foydalanadi: `Hanken Grotesk`, fallback `system-ui, -apple-system, "Segoe UI", sans-serif`.

| Role | Size / line-height | Weight |
| --- | --- | --- |
| Display/marketing | fluid `clamp(2.75rem, 6vw, 5.5rem)` / `1.02` | 750–800 |
| Page title | `1.75rem / 1.15` | 700 |
| Section title | `1.25rem / 1.25` | 650–700 |
| Body | `1rem / 1.5` | 400–500 |
| UI label | `0.9375rem / 1.35` | 600 |
| Metadata | `0.8125rem / 1.4` | 500 |

App ichida fluid type, display serif va italic ishlatilmaydi. Uzun matnlar `65–75ch` bilan cheklanadi. Raqamlar va vaqt uchun tabular numerals ishlatiladi.

## Spacing and Layout

4pt asosli scale: `4, 8, 12, 16, 24, 32, 48, 64, 96` px. Tegishli elementlar 8–12 px, component ichi 16–24 px, mustaqil sectionlar 32–48 px bilan ajraladi.

- Desktop sidebar: `232–248px`; content max-width: `1160–1200px`.
- Student asosiy grid: keng task column + tor progress/insight column.
- Mobile: sidebar o‘rniga besh elementli bottom navigation; safe-area insets saqlanadi.
- Card faqat chegaralangan va mustaqil action uchun. Oddiy guruhlar ochiq section, alignment va divider bilan tuziladi. Nested card ishlatilmaydi.

## Shape and Elevation

- Input/button radius: `8–10px`.
- Bounded panel radius: `12–16px` maksimum.
- Pill faqat tag, status yoki segment control uchun.
- Bir elementda keng shadow va to‘liq border birga ishlatilmaydi.
- Asosiy depth 1px divider va surface kontrasti bilan beriladi.

## Signature Motif

**Exam Progress Rail** — savol raqamlari, A/B/C/D doiralari va ingichka progress chizig‘i. U quyidagilarni ifodalaydi:

- joriy vazifa yoki savol — orange;
- yechilgan/to‘g‘ri — success va check/label;
- belgilangan — info va bookmark/label;
- yechilmagan — neutral;
- xato — danger va tushuntiruvchi label.

Motiv faqat haqiqiy ketma-ketlik yoki holat bor joyda ishlatiladi.

## Navigation Architecture

### Student

`Bugun`, `O‘rganish`, `Testlar`, `AI ustoz`, `Progress`.

### Teacher

`Umumiy`, `O‘quvchilar`, `Test yaratish`, `Materiallar`, `Analitika`.

### Admin

`Statistika`, `Foydalanuvchilar`, `Kontent`, `To‘lovlar`, `AI boshqaruvi`, `Audit`.

Mavjud imkoniyatlar yo‘qolmaydi; ko‘p sonli past darajadagi tablar shu yuqori guruhlar ostida joylashadi.

## Components and States

Har interaktiv component `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `error` va `success` holatiga ega. Focus ring 2px, control tashqarisida va kamida 3:1 kontrastda. Content loading uchun skeleton, payment va destruktiv ishlar uchun real server natijasi kutiladi.

## Motion

Product transitionlari `150–220ms`, ease-out-quart/expo. Motion faqat state, loading, selection yoki panel o‘zgarishini tushuntiradi. Layout-property animatsiyasi, bounce, elastic va har section uchun scroll reveal yo‘q. `prefers-reduced-motion` barcha harakatni crossfade yoki instant holatga tushiradi.

## Responsive Behavior

- `< 768px`: bottom navigation, bir column, full-width controls, 16px form text.
- `768–1099px`: compact sidebar yoki drawer, stacked insight sections.
- `>= 1100px`: doimiy sidebar va ikki columnli student workspace.
- Test runner har o‘lchamda chalg‘itmaydigan alohida workspace; rasmlar joy egallashidan oldin o‘lcham rezerv qilinadi.

## Marketing Register Override

Landing product UI’dan dadilroq: orange katta solid maydonlarda ishlatilishi mumkin. Hero real `reja → dars → test → tahlil` oqimini ko‘rsatadi. Warm paper, Fraunces, italic accent, pixel-art, dotted/grid texture, tiny uppercase eyebrow, fake screenshot, gradient text va uchta bir xil feature card ishlatilmaydi.
