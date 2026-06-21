# DtmMax — Design Knowledge Pack

> Reference for the `ui-ux-designer` agent. Read this before every task.
> **Ground truth note:** The live codebase (`frontend/src/index.css`) uses an **Amber brand (`#D97706`) on warm Stone neutrals**, font **Plus Jakarta Sans**, light-default with a `.dark` class. This is the source of truth — NOT the "blue→cyan + emerald" language in older briefs. Where this doc references AI-accent color, it means Amber (the assistant accent already in use), not emerald. Match what ships.

---

## Design philosophy

DtmMax is a calm, trustworthy study companion for stressed 16–18-year-olds preparing for high-stakes DTM / Milliy Sertifikat exams, used overwhelmingly one-handed on low-end Android phones. Every screen should reduce cognitive load, never add to it: a single obvious next action, generous whitespace doing the hierarchy work, warm-neutral surfaces that feel like paper rather than a cold dashboard, and motion that confirms rather than decorates. Premium here means *restraint and polish* — consistent spacing, hue-matched depth, instant feedback, legible math — not effects. The AI tutor is the heartbeat of the product: it must stay rock-stable while streaming, recoverable when it goes wrong, and readable like a document. When in doubt, choose the quieter, faster, more reachable option.

---

## 1. Visual craft & spacing

- **One 4/8pt scale, no off-scale px.** Use only `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96` (Tailwind `p-1 p-2 p-3 p-4 p-6 p-8 p-12 p-16 p-24`). Never `5/7/13/18px`. Tighter gaps *inside* a group, bigger steps *between* groups.
- **Separate with space, not lines.** Group with proximity + a subtle `--bg-surface`/`--bg-muted` tint first; a 1px `--border` divider is the last resort. Replace divider lines between chat turns / list rows with whitespace.
- **5-level elevation, all two-part shadows (point down only).** Resting card `0 1px 2px rgb(0 0 0/.06), 0 1px 1px rgb(0 0 0/.04)`; raised card `0 4px 6px -1px rgb(0 0 0/.07), 0 10px 24px -4px rgb(0 0 0/.10)`; map: sm=inputs/static cards, md=hover, lg=flashcards/active test card, xl=popovers/dropdowns, 2xl=modals/bottom-sheet. (Codebase currently uses single `0 4px 16px rgba(0,0,0,.08)` on `.card-hover` — upgrade to the two-part form.)
- **Tinted shadows on brand/interactive surfaces.** Brand CTA gets an amber-tinted shadow (`shadow-amber-500/20` equiv), e.g. the existing `.empty-state-cta` `0 12px 30px rgba(224,123,57,.22)`. Keep neutral gray shadows for white/paper reading surfaces.
- **3–4 radius tokens by element size, never random.** Already defined: `--radius-sm .375rem`, `-md .5rem`, `-lg .75rem`, `-xl 1rem`, `-2xl 1.5rem`. Inputs/badges→sm/md, buttons/cards→lg/xl, modals/sheets→2xl. Nested element radius < container radius.
- **Glassmorphism only for floating chrome**, never reading content. Use for bottom-sheet/mobile nav and pinned composer over scrolling chat: `bg-[--bg-card]/70 backdrop-blur-md border border-[--border] shadow-lg`, only over a textured/tinted backdrop. Keep test questions and long AI answers on **opaque** `--bg-card`.

## 2. Color, tokens & typography (concrete values)

**Tokens live in `frontend/src/index.css` as CSS custom properties + `@theme inline` (Tailwind v4 CSS-first). One source of truth — do not add a `tailwind.config.js` palette.** Components consume semantic vars; dark mode = override ~20 vars under `html.dark`.

Light-mode core values (current):
- Backgrounds: page `#F7F5F2`, card `#FEFDFB`, surface `#F2EFEB`, muted `#ECE6DF`
- Text: primary `#1C1917`, secondary `#78716C`, muted `#8A8580`, inverse `#FAFAF9`
- Border: `#DDD8D0`, strong `#CFC6BC`
- Brand (Amber): `#D97706`, hover `#B45309`, light `#FEF3C7`, muted `#FDE68A`
- Status: success `#16A34A`, danger `#DC2626`, info `#2563EB` (each with a `-light` tint)
- Dark: page `#111110`, card `#1A1918`, text `#FAFAF9`, brand `#F59E0B`. Elevate via lighter surfaces, not shadows (shadows vanish on dark).

**Contrast (WCAG AA) — verify per surface with a checker, not by eye:**
- Body ≥ 4.5:1, large text (≥24px or ≥18.66px bold) ≥ 3:1, UI components/icons ≥ 3:1.
- ✅ White on brand `#D97706` ≈ 4.6:1 (use `#FFFFFF` text on `.btn-brand`, already correct).
- ⚠️ Amber `#D97706` text on white ≈ 3.6:1 — **fails for body**; OK only for large/bold (section labels, headings). For amber body text use `--brand-hover` `#B45309` (≈ 5.0:1).
- ⚠️ `--text-muted #8A8580` on white ≈ 2.9:1 — **fails 4.5:1**. Use only for ≥18.66px bold / decorative, never body or form hints. Prefer `--text-secondary #78716C` (≈ 4.6:1) for readable secondary text.
- Never put white text/icons on `--brand-light`/`--brand-muted` (pale amber) — fails badly.

**Type:** Font is **Plus Jakarta Sans** (`@import` at top of index.css), 16px root. Body ≥ 15px on mobile chat is acceptable but **inputs must be ≥16px** to block iOS zoom-on-focus (the chat `<textarea>` and all auth fields). Line-height ~1.6–1.7 for chat/body (already set), 1.1–1.25 for headings. Apply `tracking-tight` (≈ −0.01 to −0.03em) to titles ≥ 28px and the landing hero; never letter-space body. Limit to 3 weights (400/600/700). Cap reading measure ~45–75 chars: constrain AI answer column to `max-w-[720px]` on desktop/tablet.

## 3. Component system (React 19 + Tailwind v4 + shadcn-style)

- **Tokens in CSS only** via `@theme` / custom props (done). Do not reintroduce JS theme config.
- **Variants via `cva` + `cn` (tailwind-merge)** — both already installed. Keep variants minimal: `Button` = `brand | primary | ghost | outline | sm | lg` (mirror existing `.btn-*` classes). Over-variant-ing is the top anti-pattern; compose over boolean props.
- **React 19 conventions:** `ref` is a normal prop (no `forwardRef`); use `use()` for context in compound components. Strict TS, no `any` (per project CLAUDE.md). State updates use `setX(prev => …)` to avoid stale closures.
- **Adopt shadcn components by copy-in, tiered** (`ui/` primitives, `blocks/` composed like the chat bubble, `features/`). Only pull what's needed: Button, Input, Dialog, Tabs, Card, Sheet. The chat message renderer stays a project-owned block.
- **Headless a11y layer** (Radix/React Aria/Base UI) for dropdowns, dialogs, the mobile Sheet, and the answer radiogroup — do **not** hand-roll `div` menus; you get focus/keyboard/ARIA for free.
- **State placement:** filters/active tab/subject in the **URL**; only session/ephemeral UI in Zustand (installed); forms on React Hook Form + Zod (validate teacher uploads).
- **Icons:** Lucide (installed) only, one stroke width, 20–24px grid, optically aligned to text. Never upscale a 16–24px glyph 3–4×; use an illustration for empty states.

## 4. AI chat UX — the core surface (be thorough)

Main file: `frontend/src/pages/Student/ChatLayout.tsx`. The bar in 2026 is not "does it stream" but "is it stable, recoverable, trustworthy while streaming," and it renders **KaTeX math mid-stream**.

**Layout & roles**
- Differentiate by structure + label, not color alone: **user** = right-aligned tinted bubble (`.bubble-user`, `#EDE8DA`, max-w 68% desktop / 86% mobile); **AI** = full-width, **bubble-less** open text (`.bubble-ai`) so long explanations read like a document. Add text labels (`Siz` / `DtmMax`), not only color.
- 16px inside-bubble padding, 24px (`gap-y-6`) between turns, AI column `max-w-[720px] mx-auto` desktop, full-width mobile.

**Streaming (highest-leverage, math-aware)**
- **Batch DOM writes with `requestAnimationFrame`**, not per-token: buffer chars, flush once per frame, append into the current text node. Decouples token rate from layout.
- **Buffer incomplete markdown/math/code.** Hold a half-open `**`, an unclosed ``` fence, or an unterminated `$$…$$` as plain text + a blinking caret until the closing delimiter arrives, then render. A half-streamed `\frac{a}{b` must show as raw text, never a KaTeX parse error. Only re-run KaTeX once a math span's closing `$`/`$$` has arrived.
- **Stable layout:** reserve container space so growing text never shifts surrounding UI; strip the per-token animation wrappers once the message completes (keeps long transcripts cheap).
- **Token reveal:** ~150ms fade-in per word (subtle), honoring reduced-motion (see §5). Current `.streaming-cursor` blink + `.typing-dots` are good; keep them.

**Status ladder & recovery**
- Show a thinking indicator before the first token, then phases (`O'ylayapman` → `Manbalarni tekshiryapman` → streaming) in plain Uzbek (no jargon). Transition seamlessly into streamed text.
- **Stop is first-class:** swap Send → Stop while generating (same thumb-zone button). On stop: clear buffer, cancel timers, remove caret, mark message `to'xtatildi`, **preserve the original prompt** for one-tap retry.
- **Regenerate preserves prior answers** via a pager (`1 / 2` with arrows) — never destroy a good answer. Offer a **`Soddaroq tushuntir`** (explain-simpler) regenerate variant for students who didn't get it.
- **Edit last message in place** (no confirm dialog), discard the now-invalid reply; fade/collapse discarded downstream turns. Skip full branching (clutter on small screens).
- **Differentiated errors** with matching recovery, never one generic toast: (a) network → inline `Qayta urinish` chip, (b) safety/policy → explain + rephrase, (c) length → shorten/new chat, (d) bad input. **Always keep the typed prompt in the composer on failure** (flaky mobile networks are the norm here).

**Smart auto-scroll**
- Auto-scroll only while within ~60px of the bottom; the instant the user scrolls up, stop and show a thumb-friendly `Eng so'nggi` ↓ pill. Reset the scrolled flag at the start of each new response.

**Composer (mobile keyboard — make-or-break)**
- Dock to bottom, never float over the last message. Give the transcript bottom padding = composer height. Ride the keyboard via `env(safe-area-inset-bottom)` (already in `.chat-input-area`). Auto-resize textarea to ~5–6 lines then scroll internally. Send/Stop ≥ 44×44px in the thumb zone.
- **Enter behavior by device:** desktop Enter submits / Shift+Enter newline; **touch: Enter inserts newline, dedicated Send button submits** (never hijack the mobile return key — students write multi-part questions).
- Affordances: attach/camera (photograph diagram-based DTM problems — supported via OCR pipeline), optional voice.

**Trust, guided entry, a11y**
- Inline trust signals: when citing a textbook/rule, render a source; thumbs up/down per AI message routed to the teacher panel (correctness is everything for an exam tutor).
- Empty chat = 3–5 tappable subject starters (`Matematika misolini yechib ber`, `Ona tili qoidasini tushuntir`, `Tarix testiga tayyorlan`), not a bare field.
- Wrap the streaming message in `role="log"` / `aria-live="polite"` `aria-atomic="false"`, set `aria-busy` while generating, announce `Javob tugadi` on completion. Under `prefers-reduced-motion: reduce`, skip token animation and render the finished answer at once. **(Currently missing — add it.)**

## 5. Motion

- **Duration scale (tokens):** micro-feedback (press/toggle) **100–150ms**, standard (hover/fade/dropdown) **200–250ms**, medium (modal/sheet/tab) **300ms**, entrance cap **400ms**, never > 500ms. Define `--duration-fast:150ms / -base:250ms / -slow:350ms`; use `duration-150 / duration-300`.
- **Easing by direction:** enter `cubic-bezier(0,0,.2,1)` (ease-out); exit ease-in + shorter; move `cubic-bezier(.4,0,.2,1)`. Reserve overshoot spring `cubic-bezier(.34,1.56,.64,1)` ONLY for positive confirmations (correct answer tick, streak/XP increment) — ration it.
- **Animate only `transform` + `opacity`** (GPU compositor). Never animate width/height/top/left/margin/padding; avoid animating box-shadow/background/border-radius/gradients in loops. For hover lift use `transform: scale`/`translateY` (the `.btn`/`.card-hover` `translateY(-1px)` pattern is correct) or fade a pre-rendered shadow layer.
- **`will-change` only on elements about to animate, removed after.** During streaming, only the message area should be promoted. **Profile on a real mid/low Android (120Hz panel = ~8.3ms/frame budget), not desktop Chrome.**
- **CSS-first.** Do transitions/`@starting-style`/view transitions in CSS (0KB JS). Only reach for Motion/Framer for the chat enter/exit lifecycle (`AnimatePresence`), the flashcard flip, and shared-element (test card → detail) transitions; import via `LazyMotion` (~6KB not ~34KB) for this bandwidth-sensitive audience.
- **Skeletons, not spinners.** `components/Skeleton.tsx` exists — use it for test/flashcard lists, dashboards, chat history; match the real card shape/position. Spinner only for indeterminate < 2s actions; suppress any loader that would flash < 300ms.
- **Reduced motion is mandatory and currently absent.** Add a global rule: `@media (prefers-reduced-motion: reduce){ *,::before,::after{ animation-duration:.01ms!important; transition-duration:.01ms!important } }`, then re-enable short opacity fades where motion is meaningful. The flashcard **3D flip must cross-fade (not rotate)** under reduce; keep correct/incorrect color + focus feedback intact.

## 6. Accessibility — WCAG 2.2 AA checklist

Legally load-bearing in 2026 (EAA in force, ADA litigation). Semantic HTML first, ARIA only to fill gaps ("no ARIA > bad ARIA").

- [ ] **Contrast** 4.5:1 body / 3:1 large & UI — audit per surface. Fix the `--text-muted` and amber-on-white body cases (see §2).
- [ ] **Visible focus on every interactive element** (2.4.7). Add `focus-visible:outline-2 focus-visible:outline-offset-2` with a high-contrast color; on amber buttons use a dark ring + light offset so it doesn't vanish. **(Codebase sets `outline:none` on `.btn` with no replacement — fix.)**
- [ ] **Target size** ≥ 24×24 (2.5.8 AA); ≥ 44–48px for primary mobile controls, ≥ 8px apart. Icon-only buttons (copy/regenerate/close/bookmark, flashcard flip) need `min-h-11 min-w-11` hit-padding even if the glyph is 16px. Test answer rows = full-width ≥ 48px.
- [ ] **Keyboard:** everything tab-reachable & activatable, logical order = visual order, no traps; modals trap focus + restore to trigger on close + Esc-dismiss; add a "Skip to main content" link as first focusable.
- [ ] **Native widgets first.** Answer choices = real `radiogroup` (`<input type=radio>` or roving tabindex + Arrow keys + `aria-checked`); dropdowns/dialogs via Radix/React Aria, not div menus.
- [ ] **Forms:** every input has a visible `<label for>`; on error set `aria-invalid="true"` (omit when valid, never `"false"`), link message via `aria-describedby`, specific corrective Uzbek text (`Parol kamida 8 belgidan iborat bo'lsin`), red border + icon + text (not color alone), move focus to first error on submit. Satisfy 3.3.7 Redundant Entry & 3.3.8 Accessible Authentication (allow paste / password-manager / OTP, no cognitive CAPTCHA).
- [ ] **Live regions:** streaming AI in `aria-live="polite"`; toasts polite; urgent errors assertive; `aria-busy` during load. **(Missing — add.)**
- [ ] **Never color alone** (1.4.1): correct/incorrect = icon + word (`To'g'ri`/`Noto'g'ri`) + color; AI accent backed by an `AI` label/sparkle.
- [ ] **Structure & lang:** `<html lang="uz">` (switch to `ru`/`en` on mixed passages), single `<h1>`, no skipped levels, `<main>/<nav>` landmarks, unique page `<title>`, `aria-label` (Uzbek) on icon-only buttons.
- [ ] **Math:** keep KaTeX MathML output (don't `aria-hidden` formulas); equations must wrap/scroll and stay ≥4.5:1 at 200% zoom / 320px width (`.katex-display` already scrolls on mobile — verify reflow, not horizontal page scroll).
- [ ] **Reduced motion** honored everywhere (§5).
- [ ] **CI gate:** add `eslint-plugin-jsx-a11y` + an axe pass; manually VoiceOver-test (iOS) the chat flow, a full test attempt, and registration each release. Automated passing is necessary, not sufficient.

## 7. Mobile-first (the default surface, low-end Android)

- **Design at 360–375px single-column first**, enhance up; cap reading/content width (`max-w-screen-sm` ~640px) on tablet+ instead of full-bleed.
- **Touch targets** ≥ 44px (`min-h-11`), prefer 48px, ≥ 8px gaps. Test answer options are highest-risk (a mis-tap submits a wrong answer) → full-width ≥ 48px rows, not tiny radios.
- **Thumb zone:** primary actions (composer+send, `Keyingi`/`Yakunlash`, `Submit`) in the bottom third, full-width, sticky/fixed. Secondary/destructive/nav up top or behind a menu.
- **Bottom sheets > centered modals** for contextual choices (subject picker, "explain differently", test-list filters, share) — grab handle + explicit `X` (don't make stressed teens discover swipe-to-dismiss), scrim for modal variant, never stack two, never for multi-step flows (use a full route). The `TestPage` `max-h-[78dvh]` rounded-top sheet is the right pattern.
- **Dynamic viewport units:** use `h-dvh`/`100dvh` for full-height shells (already used in ChatLayout/TestPage/Landing) so the composer never slides under the address bar. Plain `100vh` only as fallback.
- **Safe-area insets:** bottom bars `padding-bottom: calc(.75rem + env(safe-area-inset-bottom))` (composer has it — extend to the sticky test submit bar), top bar `env(safe-area-inset-top)`; add `viewport-fit=cover` to the viewport meta.
- **Keyboard handling:** focused input + its submit button must scroll into view above the keyboard; add `interactive-widget=resizes-content` to viewport meta; `scrollIntoView` the active field on focus.
- **Inputs/keyboards:** `type=email`/`tel`, `inputmode=numeric` for OTP / `decimal` for numeric math answers, `autocomplete="one-time-code"`. Never block paste/autofill. **(No `inputMode` in codebase yet — add to auth + numeric answer fields.)**
- **Container queries for reused components** (cards/bubbles/flashcards rendered in chat, side panels, sheets, teacher columns): `container-type: inline-size` + Tailwind v4 `@container` (`@sm:`/`@md:`), zero JS, Baseline-supported. **(Not used yet — adopt to avoid duplicated breakpoint CSS.)**
- **Performance budget on a throttled mid/low Android, not your machine:** LCP < 2.5s, INP < 200ms. Code-split admin/teacher panels and KaTeX out of the student bundle; lazy-load KaTeX only on math screens; virtualize long chat transcripts & result lists; rAF-batch streaming so the composer stays responsive.
- **Forms short + inline-validated:** ask only essentials (phone + name) at registration, step the rest; top-aligned persistent labels (not placeholder-as-label); validate on blur.

## 8. Timeless heuristics (Laws of UX / Refactoring UI, distilled)

- **Hierarchy = size → weight → color**, in that order. ~5 sizes, 2–3 weights, grayscale-first; color is the last lever. (Flashcard term 24/700, hint 14/400.)
- **Proximity over borders.** Group related things with space + a tint; reach for a 1px line last.
- **One primary action per view.** Single solid brand button (`.btn-brand`); Skip/Back/secondary as `.btn-ghost`/`.btn-outline`; never two competing solid CTAs. Cuts hesitation for stressed students.
- **Jakob's Law:** keep the chat shaped like ChatGPT/Claude, tests like familiar quizzes — don't reinvent known patterns.
- **Hick's / Miller's:** fewer, chunked choices. Chunk the test/subject picker; one card per question.
- **Doherty (~400ms) + Nielsen #1 (visibility of status):** stream tokens, flip states < 200ms, progress bar over ~1s waits, skeletons on load.
- **Error prevention & recovery (Nielsen #3/#5/#9):** confirm before final test submit; plain-language Uzbek retry on failure; undo where feasible.
- **Peak–End:** invest in the moments students remember — the correct-answer confirmation and the results screen — to lift perceived quality.
- **Fitts's Law:** big, close, bottom-anchored targets for frequent actions; small/far for rare destructive ones.
- **Aesthetic–Usability + consistency:** ship as tokens, kill one-off values — visual drift reads as "untrustworthy" to anxious users.

---

## Pre-handoff checklist (run before giving a spec to frontend-engineer)

1. **Tokens only** — every color/space/radius/shadow/duration maps to a CSS var or the 4pt scale; zero stray hex or off-scale px.
2. **Palette is real** — Amber/Stone/Plus Jakarta, light + `.dark` both specified; no leftover blue/cyan/emerald.
3. **Contrast passes** per surface (body 4.5:1, large/UI 3:1); muted-gray and amber-on-white body cases avoided.
4. **One primary action** per screen; secondary/tertiary weighted down; labels in Uzbek.
5. **Targets** ≥ 44px (≥48 primary) with ≥8px gaps; icon-only buttons have hit-padding + Uzbek `aria-label`.
6. **Mobile shell** — 360px single-column, `dvh` height, safe-area insets on top/bottom bars, thumb-zone primary actions, correct `inputmode`/`autocomplete`.
7. **Focus + keyboard** — visible `focus-visible` ring (not `outline:none`), logical order, modal focus trap + Esc, skip link.
8. **Chat (if touched)** — rAF-batched streaming, incomplete markdown/math buffered, stable layout, Stop preserves prompt, regenerate pager, smart 60px auto-scroll, docked composer, `aria-live` + `aria-busy`.
9. **Motion** — durations on the scale, transform/opacity only, overshoot rationed, `prefers-reduced-motion` fallback specified (flashcard cross-fades under reduce).
10. **Non-color cues** for every status (correct/incorrect/required/AI) = icon + word + color.
11. **States enumerated** — default / hover / focus / active / disabled / loading (skeleton) / empty / error, each with concrete values.
12. **KaTeX** reflows/scrolls without page overflow at 320px & 200% zoom; MathML not suppressed.
