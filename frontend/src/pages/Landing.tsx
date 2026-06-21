import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import './landing.css'

/* =========================================================================
   DtmMax — Premium landing (Kelviq aesthetic), ported from the approved mockup.
   White + faint technical grids + bold Hanken Grotesk headline with ONE
   italic-Fraunces accent word + sparing ORANGE accent + pixel-art icons.
   Tokens + landing font are scoped under `.lp-root` (see landing.css) so they
   never leak into the Amber app shell. Inline style objects use the spec's
   exact hex/values. All copy: Uzbek (Latin). TypeScript strict — no `any`.
   ========================================================================= */

const C = {
  bg: '#FFFFFF',
  bg2: '#FAFAFA',
  soft: '#FFF1EA',
  ink: '#0A0A0A',
  gray: '#5B5B66',
  gray2: '#8A8A95',
  line: '#E8E8EC',
  line2: '#DEDEE4',
  tex: '#DDE0E6',
  accent: '#F15A24',
  accentStrong: '#DA4A12',
  accent2: '#FF8A4C',
  accentGrad: 'linear-gradient(135deg, #F15A24 0%, #FF8A4C 100%)',
  /* pixel-target 3D shading: extruded side-shadow gray + top-left highlight */
  targetShade: '#B9BCC6',  /* darker ring-shadow for the extruded depth layer */
  targetHi: '#F3F4F7',     /* near-white highlight edge on the top-left rings */
} as const

const SHADOW = {
  card: '0 1px 2px rgba(10,10,16,.04), 0 1px 1px rgba(10,10,16,.03)',
  cta: '0 6px 20px rgba(241,90,36,.28)',
} as const

const SANS = "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif"
const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif"

/* Shared 1240px container (Kelviq generous gutters) */
const container: CSSProperties = { maxWidth: 1240, margin: '0 auto', padding: '0 56px' }

/* Where the CTAs lead in the real app */
const ROUTE_REGISTER = '/royxat'
const ROUTE_LOGIN = '/kirish'

/* ===================================================================== */
/* Atoms                                                                  */
/* ===================================================================== */

/* The signature mix: a Hanken headline with exactly ONE Fraunces italic word.
   The italic word stays ink-coloured (Kelviq keeps it in ink, not accent). */
function Em({ children }: { children: ReactNode }) {
  return (
    <i style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, color: C.ink }}>{children}</i>
  )
}

type EyebrowAlign = 'left' | 'center'
function Eyebrow({ children, align = 'left' }: { children: ReactNode; align?: EyebrowAlign }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: C.accent,
        lineHeight: 1,
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 2, background: C.accent, flexShrink: 0 }} />
      {children}
    </span>
  )
}

type BtnVariant = 'primary' | 'outline' | 'ghost'
type BtnSize = 'sm' | 'md' | 'lg'

const PAD: Record<BtnSize, string> = { sm: '9px 16px', md: '11px 20px', lg: '15px 28px' }
const FSZ: Record<BtnSize, number> = { sm: 14, md: 15, lg: 17 }

/* Button is rendered as a react-router <Link> so every CTA navigates. */
function Button({
  children,
  to,
  variant = 'primary',
  size = 'md',
  arrow = false,
}: {
  children: ReactNode
  to: string
  variant?: BtnVariant
  size?: BtnSize
  arrow?: boolean
}) {
  const base: CSSProperties = {
    fontFamily: SANS,
    fontWeight: 600,
    fontSize: FSZ[size],
    lineHeight: 1,
    padding: PAD[size],
    borderRadius: 11,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid transparent',
    textDecoration: 'none',
  }
  const variants: Record<BtnVariant, CSSProperties> = {
    primary: { background: C.accentGrad, color: '#fff', boxShadow: SHADOW.cta },
    outline: { background: '#fff', color: C.ink, border: `1px solid ${C.line}` },
    ghost: { background: 'transparent', color: C.ink, padding: '11px 8px' },
  }
  return (
    <Link
      to={to}
      className="lp-btn"
      style={{ ...base, ...variants[variant] }}
      onMouseEnter={(e) => {
        if (variant === 'primary') {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 10px 28px rgba(241,90,36,.38)'
        } else if (variant === 'outline') {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.borderColor = C.line2
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        if (variant === 'primary') e.currentTarget.style.boxShadow = SHADOW.cta
        else if (variant === 'outline') e.currentTarget.style.borderColor = C.line
      }}
    >
      {children}
      {arrow && (
        <span className="lp-arrow" aria-hidden="true" style={{ fontSize: '1.05em', lineHeight: 1 }}>
          →
        </span>
      )}
    </Link>
  )
}

/* Brand logo mark — DtmMax kitob + o'sish strelkasi (rasmiy logo) */
function LogoMark({ size = 34, radius = 9 }: { size?: number; radius?: number; glyph?: number }) {
  return (
    <img
      src="/dtmmax-logo.png"
      alt="DtmMax"
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: radius, objectFit: 'contain', display: 'block', flexShrink: 0 }}
    />
  )
}

function Wordmark({ size = 19 }: { size?: number }) {
  return <span style={{ fontSize: size, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink }}>DtmMax</span>
}

/* ===================================================================== */
/* Pixel-art icons — 16×16 grid of <rect>s, rendered at 40px, crispEdges  */
/* Monochrome ink with a small orange accent cluster (Kelviq look).        */
/* ===================================================================== */

type PixIconName = 'brain' | 'target' | 'chart' | 'cards'

function PixelIcon({ name, size = 40 }: { name: PixIconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    shapeRendering: 'crispEdges' as const,
  }
  if (name === 'brain') {
    return (
      <svg {...common} fill={C.accent} aria-hidden="true" className="lp-pixicon">
        <rect x="4" y="2" width="2" height="2" /><rect x="6" y="2" width="2" height="2" /><rect x="8" y="2" width="2" height="2" />
        <rect x="2" y="4" width="2" height="2" /><rect x="10" y="4" width="2" height="2" />
        <rect x="2" y="6" width="2" height="2" /><rect x="6" y="6" width="2" height="2" /><rect x="10" y="6" width="2" height="2" />
        <rect x="2" y="8" width="2" height="2" /><rect x="10" y="8" width="2" height="2" />
        <rect x="4" y="10" width="2" height="2" /><rect x="6" y="10" width="2" height="2" /><rect x="8" y="10" width="2" height="2" />
        <rect x="6" y="12" width="2" height="2" />
      </svg>
    )
  }
  if (name === 'target') {
    return (
      <svg {...common} fill={C.ink} aria-hidden="true" className="lp-pixicon">
        <rect x="6" y="2" width="4" height="2" /><rect x="4" y="4" width="2" height="2" /><rect x="10" y="4" width="2" height="2" />
        <rect x="2" y="6" width="2" height="2" /><rect x="12" y="6" width="2" height="2" />
        <rect x="6" y="6" width="4" height="4" fill={C.accent} />
        <rect x="2" y="8" width="2" height="2" /><rect x="12" y="8" width="2" height="2" />
        <rect x="4" y="10" width="2" height="2" /><rect x="10" y="10" width="2" height="2" /><rect x="6" y="12" width="4" height="2" />
      </svg>
    )
  }
  if (name === 'chart') {
    return (
      <svg {...common} fill={C.ink} aria-hidden="true" className="lp-pixicon">
        <rect x="2" y="2" width="2" height="12" /><rect x="2" y="12" width="12" height="2" />
        <rect x="5" y="9" width="2" height="3" fill={C.accent} /><rect x="8" y="6" width="2" height="6" fill={C.accent} /><rect x="11" y="3" width="2" height="9" fill={C.accent} />
      </svg>
    )
  }
  /* cards / flashcards */
  return (
    <svg {...common} fill={C.ink} aria-hidden="true" className="lp-pixicon">
      <rect x="4" y="2" width="9" height="2" /><rect x="4" y="2" width="2" height="9" /><rect x="11" y="2" width="2" height="9" /><rect x="4" y="9" width="9" height="2" />
      <rect x="2" y="5" width="2" height="9" fill={C.accent} /><rect x="2" y="12" width="9" height="2" fill={C.accent} /><rect x="9" y="5" width="2" height="9" fill={C.accent} />
    </svg>
  )
}

/* ===================================================================== */
/* Scroll-in reveal                                                        */
/* ===================================================================== */

function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setSeen(true)
            io.disconnect()
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={seen ? 'lp-reveal is-in' : 'lp-reveal'} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  )
}

/* ===================================================================== */
/* NAV                                                                     */
/* ===================================================================== */

const SUBJECTS = ['Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili', 'Ingliz tili', 'Tarix', 'Geografiya'] as const

/* Dependency-free "Fanlar" dropdown — reproduces the mockup's Radix dropdown
   look (white card, hairline border, accent shadow) without adding a package. */
function SubjectsDropdown() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="lp-btn lp-link"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ background: 'transparent', border: 'none', color: C.gray, fontSize: 15, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0 }}
      >
        Fanlar
        <span aria-hidden="true" style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 14px)',
            left: 0,
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${C.line}`,
            boxShadow: '0 18px 40px -14px rgba(241,90,36,.22), 0 4px 10px -4px rgba(10,10,16,.06)',
            padding: 12,
            minWidth: 200,
            zIndex: 60,
          }}
        >
          {SUBJECTS.map((s) => (
            <a
              key={s}
              role="menuitem"
              href="#imkoniyatlar"
              className="lp-link"
              onClick={() => setOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 10px',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                color: C.gray,
                textDecoration: 'none',
                outline: 'none',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.bg2; e.currentTarget.style.color = C.ink }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.gray }}
            >
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 2, background: C.accent, flexShrink: 0 }} />
              {s}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      aria-label="Asosiy navigatsiya"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255,255,255,.8)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${scrolled ? C.line : 'transparent'}`,
        transition: 'border-color 240ms ease',
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '20px 56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left — brand */}
        <a href="#main" className="lp-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
          <LogoMark />
          <Wordmark />
        </a>

        {/* Center — links */}
        <div className="lp-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 32, fontSize: 15, fontWeight: 500 }}>
          <a href="#imkoniyatlar" className="lp-link" style={{ color: C.gray, textDecoration: 'none' }}>Imkoniyatlar</a>

          <SubjectsDropdown />

          <a href="#natijalar" className="lp-link" style={{ color: C.gray, textDecoration: 'none' }}>Natijalar</a>
          <a href="#narxlar" className="lp-link" style={{ color: C.gray, textDecoration: 'none' }}>Narxlar</a>
          <a href="#faq" className="lp-link" style={{ color: C.gray, textDecoration: 'none' }}>FAQ</a>
        </div>

        {/* Right — actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Link to={ROUTE_LOGIN} className="lp-link" style={{ color: C.ink, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>Kirish</Link>
          <Button to={ROUTE_REGISTER} variant="primary" size="sm">Boshlash</Button>
        </div>
      </div>
    </nav>
  )
}

/* ===================================================================== */
/* HERO                                                                    */
/* ===================================================================== */

/* Floating math elements. `depth` (0=far/faint/small … 2=near/solid/large) drives
   size + opacity so the cluster reads with parallax depth. All entries are pure
   symbols (Fraunces italic). Each gets a staggered float `delay` (ms) so the drift
   never marches in lock-step. */
type GlyphDepth = 0 | 1 | 2
type Glyph = { ch: string; top: number; left: number; depth: GlyphDepth; delay: number }

const GLYPHS: Glyph[] = [
  /* pure-symbol signature set — numbers/equations removed per owner request.
     A few positions were nudged so the cluster stays airy around the enlarged
     3D target (which now sits ~top:22% / left:45% of the zone at 120px) and
     nothing overlaps it. */
  { ch: '√', top: 4, left: 2, depth: 2, delay: 0 },
  { ch: 'π', top: 2, left: 40, depth: 1, delay: 900 },
  { ch: '∫', top: 28, left: 88, depth: 2, delay: 1800 },
  { ch: 'Σ', top: 62, left: 6, depth: 2, delay: 600 },
  { ch: 'x²', top: 1, left: 76, depth: 1, delay: 2400 },
  { ch: '≈', top: 14, left: 24, depth: 0, delay: 3000 },
  { ch: '÷', top: 62, left: 74, depth: 0, delay: 1500 },
  { ch: '∞', top: 70, left: 40, depth: 1, delay: 300 },
  { ch: 'θ', top: 36, left: 12, depth: 0, delay: 2700 },
  { ch: 'Δ', top: 88, left: 22, depth: 1, delay: 1050 },
  { ch: '∠', top: 8, left: 62, depth: 0, delay: 3300 },
  { ch: '°', top: 44, left: 94, depth: 0, delay: 750 },
]

/* size (px) per depth — pure symbols only (Fraunces italic). */
const GLYPH_SIZE: Record<GlyphDepth, number> = { 0: 22, 1: 30, 2: 36 }
const GLYPH_OPACITY: Record<GlyphDepth, number> = { 0: 0.45, 1: 0.7, 2: 1 }

/* Pixel-art sparkle: a tiny <rect> grid that TWINKLES via steps() keyframes
   (choppy / 8-bit feel). Decorative only — sits between the glyphs. */
type Sparkle = { top: number; left: number; scale: number; delay: number }
const SPARKLES: Sparkle[] = [
  { top: 12, left: 20, scale: 1, delay: 0 },
  { top: 54, left: 58, scale: 0.8, delay: 700 },
  { top: 80, left: 34, scale: 1.1, delay: 1400 },
  { top: 36, left: 80, scale: 0.7, delay: 2100 },
  { top: 66, left: 72, scale: 0.9, delay: 350 },
]

function PixelSparkle({ s }: { s: Sparkle }) {
  /* a 5×5 plus/diamond sparkle built from <rect> cells, crispEdges */
  return (
    <svg
      aria-hidden="true"
      className="lp-pixel-sparkle"
      width={10 * s.scale}
      height={10 * s.scale}
      viewBox="0 0 10 10"
      shapeRendering="crispEdges"
      fill={C.accent}
      style={{
        position: 'absolute',
        top: `${s.top}%`,
        left: `${s.left}%`,
        animationDelay: `${s.delay}ms`,
      }}
    >
      <rect x="4" y="0" width="2" height="2" />
      <rect x="4" y="8" width="2" height="2" />
      <rect x="0" y="4" width="2" height="2" />
      <rect x="8" y="4" width="2" height="2" />
      <rect x="4" y="4" width="2" height="2" />
    </svg>
  )
}

/* Pixel-art TARGET + an orange pixel ARROW that flies in from the left and
   hits the bullseye on a 4s loop (impact flash / ripple synced in landing.css).
   Concentric crispEdges rings: outer faint gray (--lp-tex / --lp-line via the
   spec hexes), inner bullseye orange. Sits in a free spot in the math-zone with
   horizontal room to its LEFT for the arrow's flight. Decorative only. */
function PixelTarget() {
  return (
    <div className="lp-target-wrap" aria-hidden="true">
      {/* soft cast shadow beneath — sells the lift off the page */}
      <span className="lp-target-shadow" />

      {/* 16×16 grid rendered at 120px — pseudo-3D concentric pixel rings.
          240/16 = 15px per cell; the lit bullseye core (cells 6–10) is centred
          on cell (8,8) → 120px from the wrap's top-left = the impact point.
          Three stacked passes give genuine thickness:
            1) EXTRUSION: a darker copy of every ring offset +1/+1 (down-right)
               so the disc reads like it has an extruded side wall.
            2) RINGS: the real faint→gray concentric rings.
            3) HIGHLIGHT: a near-white edge on the top-left cells (lit from
               the upper-left) so the top of the disc catches the light. */}
      <svg className="lp-target" width={240} height={240} viewBox="0 0 16 16" shapeRendering="crispEdges">
        {/* 1 — EXTRUDED SIDE (dark, offset down-right by 1 cell) */}
        <g transform="translate(1 1)" fill={C.targetShade}>
          <rect x="6" y="0" width="4" height="2" />
          <rect x="0" y="6" width="2" height="4" />
          <rect x="14" y="6" width="2" height="4" />
          <rect x="6" y="14" width="4" height="2" />
          <rect x="4" y="2" width="8" height="2" />
          <rect x="2" y="4" width="2" height="8" />
          <rect x="12" y="4" width="2" height="8" />
          <rect x="4" y="12" width="8" height="2" />
          <rect x="4" y="4" width="8" height="8" />
        </g>

        {/* 2 — RINGS (the lit top face) */}
        {/* outer ring tips (faint) */}
        <rect x="6" y="0" width="4" height="2" fill={C.tex} />
        <rect x="0" y="6" width="2" height="4" fill={C.tex} />
        <rect x="14" y="6" width="2" height="4" fill={C.tex} />
        <rect x="6" y="14" width="4" height="2" fill={C.tex} />
        {/* mid ring (slightly stronger gray) */}
        <rect x="4" y="2" width="8" height="2" fill={C.line2} />
        <rect x="2" y="4" width="2" height="8" fill={C.line2} />
        <rect x="12" y="4" width="2" height="8" fill={C.line2} />
        <rect x="4" y="12" width="8" height="2" fill={C.line2} />
        {/* inner soft wash around the bullseye */}
        <rect x="4" y="4" width="8" height="8" fill={C.soft} />

        {/* 3 — TOP-LEFT HIGHLIGHT EDGE (near-white, catches the light) */}
        <g fill={C.targetHi}>
          <rect x="6" y="0" width="4" height="1" />
          <rect x="4" y="2" width="6" height="1" />
          <rect x="0" y="6" width="1" height="4" />
          <rect x="2" y="4" width="1" height="6" />
        </g>

        {/* BULLSEYE — beveled orange: hi top-left, dark bottom-right, accent core */}
        <g className="lp-bull">
          <rect className="lp-bull-core" x="6" y="6" width="4" height="4" fill={C.accent} />
          <rect className="lp-bull-hi" x="6" y="6" width="3" height="1" fill={C.accent2} />
          <rect className="lp-bull-hi" x="6" y="6" width="1" height="3" fill={C.accent2} />
          <rect className="lp-bull-lo" x="7" y="9" width="3" height="1" fill={C.accentStrong} />
          <rect className="lp-bull-lo" x="9" y="7" width="1" height="3" fill={C.accentStrong} />
        </g>
      </svg>

      {/* impact ripple rings — two offset rings for a richer shockwave */}
      <span className="lp-arrow-ripple" />
      <span className="lp-arrow-ripple lp-arrow-ripple-2" />

      {/* the flying pixel arrow — a slender spear (nayza): a long orange shaft,
          short swept-back accentStrong barbs, and a long acute body that
          converges into a needle POINT, accent2 bevel catching the light + a
          accent2 fletching at the tail, plus a pixel under-shadow so it reads
          as 3D in flight.
          viewBox 26×10 rendered at 208×80 ⇒ 8px/cell. Centre band straddles y=5
          (shaft = y4..y6). The needle's rightmost drawn cells (x=23..25) put the
          visible POINT TIP at viewBox x=25 → 25·8 = 200px, centre y=5 → 40px.
          The arrow is rotated 45° (origin pinned on the tip) so it plants
          diagonally with the tip on the bullseye centre (120,120). */}
      <svg className="lp-arrow-fly" width={208} height={80} viewBox="0 0 26 10" shapeRendering="crispEdges">
        {/* drop shadow — a soft copy of the whole spear, offset +1 down */}
        <g transform="translate(0 1)" fill={C.targetShade} opacity="0.5">
          <rect x="2" y="4" width="13" height="2" />
          <rect x="14" y="2" width="3" height="1" />
          <rect x="14" y="3" width="5" height="1" />
          <rect x="14" y="4" width="9" height="2" />
          <rect x="14" y="6" width="5" height="1" />
          <rect x="14" y="7" width="3" height="1" />
          <rect x="23" y="4" width="2" height="2" />
        </g>

        {/* SHAFT (orange) — long + slender, y4..y6 */}
        <rect x="2" y="4" width="13" height="2" fill={C.accent} />

        {/* HEAD (accentStrong) — short swept-back barbs (y2/y3 + y6/y7) that end
            early, and a long acute centre body (y4/y5) that runs out to a 2px
            needle tip (x=23..25). The point juts well past the barbs ⇒ sharp. */}
        <g fill={C.accentStrong}>
          {/* upper swept barb */}
          <rect x="14" y="2" width="3" height="1" />
          <rect x="14" y="3" width="5" height="1" />
          {/* long acute centre body */}
          <rect x="14" y="4" width="9" height="1" />
          <rect x="14" y="5" width="9" height="1" />
          {/* lower swept barb */}
          <rect x="14" y="6" width="5" height="1" />
          <rect x="14" y="7" width="3" height="1" />
          {/* converging 2px needle → POINT TIP, right edge viewBox x=25 */}
          <rect x="23" y="4" width="2" height="2" />
        </g>
        {/* a brighter top-left bevel on the head so the point catches light */}
        <g fill={C.accent2}>
          <rect x="14" y="2" width="3" height="1" />
          <rect x="14" y="4" width="6" height="1" />
        </g>

        {/* FLETCHING (accent2) at the tail */}
        <rect x="0" y="2" width="2" height="2" fill={C.accent2} />
        <rect x="0" y="6" width="2" height="2" fill={C.accent2} />
        <rect x="2" y="3" width="2" height="1" fill={C.accent2} />
        <rect x="2" y="6" width="2" height="1" fill={C.accent2} />
      </svg>
    </div>
  )
}

function MathGlyph({ g, i }: { g: Glyph; i: number }) {
  const size = GLYPH_SIZE[g.depth]
  /* expose depth opacity to CSS so the auto-glow can lift to full opacity uniformly */
  const styleVars = { '--lp-glyph-op': GLYPH_OPACITY[g.depth] } as CSSProperties
  return (
    <span
      className="lp-glyph"
      style={{
        ...styleVars,
        position: 'absolute',
        top: `${g.top}%`,
        left: `${g.left}%`,
        fontFamily: SERIF,
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: size,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        /* two delays: float (random stagger) , auto-glow (sequential cascade) */
        animationDelay: `${g.delay}ms, ${i * 420}ms`,
      }}
    >
      <span className="lp-glyph-ch">{g.ch}</span>
    </span>
  )
}

function MathZone() {
  return (
    <div
      aria-hidden="true"
      className="lp-math-zone"
      style={{ position: 'absolute', top: 92, right: 36, width: 512, height: 360, zIndex: 1 }}
    >
      {SPARKLES.map((s, i) => (
        <PixelSparkle key={`sp-${i}`} s={s} />
      ))}
      {GLYPHS.map((g, i) => (
        <MathGlyph key={g.ch} g={g} i={i} />
      ))}
      <PixelTarget />
    </div>
  )
}

/* Faint chat-bubble wireframe placeholder inside the screenshot well */
function ScreenshotWell() {
  const bubble = (align: 'start' | 'end', w: number, lines: number): CSSProperties => ({
    alignSelf: align === 'end' ? 'flex-end' : 'flex-start',
    width: `${w}%`,
    height: lines * 12 + (lines - 1) * 8,
    background: align === 'end' ? '#fff' : C.soft,
    border: `1px solid ${C.line}`,
    borderRadius: 12,
  })
  return (
    <div
      aria-hidden="true"
      style={{
        maxWidth: 900,
        margin: '48px auto 0',
        background: C.bg2,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        border: `1px solid ${C.line}`,
        borderBottom: 'none',
        height: 150,
        overflow: 'hidden',
        boxShadow: '0 -8px 30px rgba(10,10,16,.04)',
        padding: '24px 32px 0',
      }}
    >
      {/* window dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {[C.line2, C.line2, C.line2].map((c, i) => (
          <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={bubble('end', 38, 1)} />
        <div style={bubble('start', 64, 2)} />
        {/* faint formula chip */}
        <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 18, color: C.tex }}>x² − 5x + 6 = 0</span>
        </div>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <header style={{ ...container, padding: '64px 56px 0', position: 'relative', overflow: 'hidden' }} className="lp-container">
      {/* dotted grid, top-right */}
      <div
        aria-hidden="true"
        className="lp-tex-dots"
        style={{ position: 'absolute', top: 0, right: 0, width: 520, height: 300, zIndex: 0, pointerEvents: 'none' }}
      />
      {/* math glyph zone */}
      <MathZone />

      {/* content with left ruled margin */}
      <div className="lp-hero-content" style={{ position: 'relative', zIndex: 2, paddingLeft: 32, maxWidth: 760 }}>
        <div aria-hidden="true" className="lp-hero-rule" />

        <Reveal>
          <div style={{ marginBottom: 20 }}>
            <Eyebrow>AI REPETITOR</Eyebrow>
          </div>

          <h1
            className="lp-h1"
            style={{ fontFamily: SANS, fontSize: 72, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.04, margin: 0, color: C.ink, maxWidth: '14ch' }}
          >
            Orzuingizdagi universitet sari <Em>yo'l</Em>
          </h1>

          <p style={{ fontSize: 20, fontWeight: 400, lineHeight: 1.6, color: C.gray, maxWidth: '46ch', margin: '26px 0 0' }}>
            Katta maqsading bor — biz yo'lni aniq qilamiz. Shaxsiy AI repetitor har kuni yoningda: tushuntiradi, mashq beradi va seni qadam-baqadam o'sha orzuga yaqinlashtiradi.
          </p>

          <div style={{ display: 'flex', gap: 14, marginTop: 34, flexWrap: 'wrap' }} className="lp-cta-actions">
            <Button to={ROUTE_REGISTER} variant="primary" size="lg" arrow>Bepul boshlash</Button>
            <Button to={ROUTE_REGISTER} variant="outline" size="lg">Demo ko'rish</Button>
          </div>
        </Reveal>
      </div>

      {/* product screenshot peek */}
      <Reveal delay={120}>
        <ScreenshotWell />
      </Reveal>
    </header>
  )
}

/* ===================================================================== */
/* FEATURES — "Bitta platforma"                                            */
/* ===================================================================== */

type Feature = { icon: PixIconName; title: string; body: string }
const FEATURES: Feature[] = [
  { icon: 'brain', title: 'Tushunib ol', body: 'Har bir mavzuni AI soddadan murakkabga, tushunarli qilib ochib beradi.' },
  { icon: 'target', title: 'Mashq qil', body: "Cheksiz DTM uslubidagi testlar — darhol javob, darhol o'sish." },
  { icon: 'chart', title: "O'sishingni ko'r", body: "Qaysi mavzu kuchli, qaysi biri zaif — grafiklarda aniq ko'rinadi." },
  { icon: 'cards', title: 'Mustahkamla', body: 'Flashcardlar bilan formula va qoidalarni uzoq xotirada saqla.' },
]

function Features() {
  return (
    <section id="imkoniyatlar" style={{ ...container, padding: '96px 56px', position: 'relative' }} className="lp-container">
      {/* plus-grid texture */}
      <div
        aria-hidden="true"
        className="lp-tex-plus"
        style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Reveal>
          <div style={{ maxWidth: 680, margin: '0 auto 56px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <Eyebrow align="center">ORZU SARI YO'L</Eyebrow>
            </div>
            <h2 className="lp-h2" style={{ fontFamily: SANS, fontSize: 46, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, margin: 0, color: C.ink }}>
              Maqsadingga eltadigan <Em>hammasi</Em> shu yerda
            </h2>
            <p style={{ fontSize: 20, lineHeight: 1.6, color: C.gray, maxWidth: '42ch', margin: '20px auto 0' }}>
              Tushuntirish, mashq, tahlil va eslab qolish — har bir qadaming bitta joyda, chalkashliksiz.
            </p>
          </div>
        </Reveal>

        <div className="lp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div
                className="lp-card"
                style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 18, padding: 28, boxShadow: SHADOW.card, height: '100%' }}
              >
                <div style={{ marginBottom: 18 }}>
                  <PixelIcon name={f.icon} />
                </div>
                <h3 style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3, margin: 0, color: C.ink }}>{f.title}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: C.gray, margin: '10px 0 0' }}>{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ===================================================================== */
/* STATS                                                                   */
/* ===================================================================== */

type Stat = { value: number; suffix: string; label: string; literal?: string }
const STATS: Stat[] = [
  { value: 7000, suffix: '+', label: "o'quvchi tayyorlandi" },
  { value: 189, suffix: '', label: 'maksimal ball' },
  { value: 7, suffix: '+', label: 'fan' },
  { value: 0, suffix: '', label: 'AI yordamchi', literal: '24/7' },
]

function StatNumber({ stat }: { stat: Stat }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [display, setDisplay] = useState<string>(stat.literal ?? '0')

  useEffect(() => {
    if (stat.literal) return
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finalText = stat.value.toLocaleString('ru-RU').replace(/,/g, ' ') + stat.suffix
    if (reduce) {
      setDisplay(finalText)
      return
    }
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        obs.disconnect()
        const duration = 900
        const start = performance.now()
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1)
          const eased = 1 - Math.pow(1 - p, 3)
          const current = Math.round(stat.value * eased)
          setDisplay(current.toLocaleString('ru-RU').replace(/,/g, ' ') + stat.suffix)
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [stat])

  return (
    <div ref={ref} style={{ fontFamily: SANS, fontSize: 56, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: C.ink }}>
      {display}
    </div>
  )
}

function Stats() {
  return (
    <>
      <hr className="lp-divider" />
      <section style={{ ...container, padding: '64px 56px' }} className="lp-container">
        <div className="lp-stats lp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, textAlign: 'center' }}>
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className="lp-stat-col"
              style={{ borderLeft: i === 0 ? 'none' : `1px solid ${C.line}` }}
            >
              <StatNumber stat={s} />
              <div style={{ fontSize: 15, fontWeight: 500, color: C.gray, marginTop: 8 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>
      <hr className="lp-divider" />
    </>
  )
}

/* ===================================================================== */
/* TESTIMONIALS                                                            */
/* ===================================================================== */

type Testimonial = { quote: string; name: string; initial: string; meta: string }
const TESTIMONIALS: Testimonial[] = [
  { quote: 'Har kuni 30 daqiqa ishladim, ball 40 punktga oshdi.', name: 'Diyora A.', initial: 'D', meta: 'DTM 2025 · 178 ball' },
  { quote: 'Flashcardlar formula yodlashni osonlashtirdi.', name: 'Sardor M.', initial: 'S', meta: 'Milliy Sert. · B2' },
  { quote: 'Xatolarimni AI tushuntirgani uchun qaytarmadim.', name: 'Nilufar T.', initial: 'N', meta: 'DTM 2025 · 181 ball' },
]

function Testimonials() {
  return (
    <section id="natijalar" style={{ ...container, padding: '96px 56px' }} className="lp-container">
      <Reveal>
        <div style={{ maxWidth: 680, margin: '0 auto 56px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <Eyebrow align="center">ULAR ORZUSIGA YETDI</Eyebrow>
          </div>
          <h2 className="lp-h2" style={{ fontFamily: SANS, fontSize: 46, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, margin: 0, color: C.ink }}>
            Sendan oldin <Em>boshlaganlar</Em>
          </h2>
          <p style={{ fontSize: 20, lineHeight: 1.6, color: C.gray, maxWidth: '42ch', margin: '20px auto 0' }}>
            Bir vaqtlar ular ham xuddi sendek boshlagan edi — o'z so'zlari bilan.
          </p>
        </div>
      </Reveal>

      <div className="lp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} delay={i * 60}>
            <div className="lp-card" style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 18, padding: 28, boxShadow: SHADOW.card, height: '100%' }}>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: C.ink, margin: 0 }}>{t.quote}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
                <div
                  aria-hidden="true"
                  style={{ width: 44, height: 44, borderRadius: '50%', background: C.soft, color: C.accentStrong, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}
                >
                  {t.initial}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{t.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.gray2, marginTop: 2 }}>{t.meta}</div>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ===================================================================== */
/* FAQ — "Ko'p beriladigan savollar"                                       */
/* ===================================================================== */

type Faq = { q: string; a: string }
const FAQS: Faq[] = [
  {
    q: 'DtmMax nima?',
    a: "DtmMax — DTM va Milliy Sertifikat imtihonlariga tayyorlanish uchun sun'iy intellektli o'quv platformasi. U sizga mavzularni tushuntiradi, test tuzadi va natijangizni kuzatib boradi — xuddi shaxsiy repetitordek.",
  },
  {
    q: 'Platforma bepulmi?',
    a: "Ro'yxatdan o'tish va boshlash mutlaqo bepul, karta ma'lumotlari kerak emas. Kengaytirilgan imkoniyatlar uchun keyinchalik hamyonbop obuna rejalari ham bo'ladi.",
  },
  {
    q: "Qaysi fanlarni o'rganish mumkin?",
    a: "Hozir Matematika, Fizika, Kimyo, Biologiya, Ona tili, Ingliz tili, Tarix va Geografiya mavjud. Fanlar ro'yxati doimiy kengayib boradi.",
  },
  {
    q: 'AI repetitor qanday ishlaydi?',
    a: "Siz savol berasiz yoki mavzu tanlaysiz — AI uni soddadan murakkabga tushuntiradi, misollar ko'rsatadi, so'ng o'zlashtirganingizni tekshirish uchun test beradi va xatolaringizni izohlaydi. Hammasi 24/7 ishlaydi.",
  },
  {
    q: "DTM va Milliy Sertifikat o'rtasida farq bormi?",
    a: "Ha. DTM — oliygohga kirish imtihoni, Milliy Sertifikat esa alohida fan bo'yicha bilim darajangizni tasdiqlaydi. DtmMax ikkalasiga ham alohida tayyorlaydi va har biriga mos test uslubini qo'llaydi.",
  },
  {
    q: 'Platforma imtihon savollarini bashorat qiladimi?',
    a: "DtmMax kafolatlangan savollarni bermaydi. Lekin oldingi yillardagi imtihon tahlili asosida eng ko'p uchraydigan mavzular va savol turlariga urg'u berib, sizni aniq yo'nalishda tayyorlaydi.",
  },
  {
    q: 'Testlar va tahlil qanday tuzilgan?',
    a: "Har bir test DTM uslubida bo'lib, darhol baholanadi. Tizim qaysi mavzularda xato qilayotganingizni grafiklar bilan ko'rsatadi, shunda kuchni zaif joylarga qarata olasiz.",
  },
  {
    q: 'Qanday boshlayman?',
    a: "\"Bepul boshlash\" tugmasini bosib ro'yxatdan o'ting, fan va maqsadingizni tanlang — AI repetitor darhol birinchi darsni boshlaydi. Bir necha daqiqada o'qishga kirishasiz.",
  },
]

function FaqSection() {
  return (
    <section id="faq" style={{ ...container, padding: '96px 56px', position: 'relative' }} className="lp-container">
      <Reveal>
        <div style={{ maxWidth: 680, margin: '0 auto 56px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <Eyebrow align="center">KO'P BERILADIGAN SAVOLLAR</Eyebrow>
          </div>
          <h2 className="lp-h2" style={{ fontFamily: SANS, fontSize: 46, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, margin: 0, color: C.ink }}>
            Tez-tez so'raladigan <Em>savollar</Em>
          </h2>
          <p style={{ fontSize: 20, lineHeight: 1.6, color: C.gray, maxWidth: '42ch', margin: '20px auto 0' }}>
            DtmMax haqida eng ko'p so'raladigan savollarga javoblar.
          </p>
        </div>
      </Reveal>

      <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {FAQS.map((f, i) => (
          <Reveal key={f.q} delay={i * 60}>
            <details className="lp-faq-item">
              <summary
                className="lp-faq-q"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontFamily: SANS, fontSize: 17.5, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3, color: C.ink }}
              >
                {f.q}
                <svg
                  className="lp-faq-mark"
                  aria-hidden="true"
                  width={18}
                  height={18}
                  viewBox="0 0 16 16"
                  shapeRendering="crispEdges"
                  fill={C.accent}
                  style={{ flexShrink: 0 }}
                >
                  <rect x="6" y="2" width="4" height="12" />
                  <rect x="2" y="6" width="12" height="4" />
                </svg>
              </summary>
              <div className="lp-faq-a" style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.6, color: C.gray, margin: '14px 0 0' }}>
                {f.a}
              </div>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ===================================================================== */
/* PRICING — "Narxlar" (visible, NOT enforced — hammasi hozir bepul)       */
/* ===================================================================== */

/* Small orange pixel-check used inside the Pro feature list. Reuses the
   pixel-art language (16×16 crispEdges) of PixelIcon. */
function PixelCheck({ color = C.accent }: { color?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={16}
      height={16}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      fill={color}
      style={{ flexShrink: 0, marginTop: 3 }}
    >
      <rect x="12" y="3" width="2" height="2" />
      <rect x="10" y="5" width="2" height="2" />
      <rect x="8" y="7" width="2" height="2" />
      <rect x="6" y="9" width="2" height="2" />
      <rect x="4" y="11" width="2" height="2" />
      <rect x="2" y="9" width="2" height="2" />
    </svg>
  )
}

type Plan = {
  name: string
  price: string
  period?: string
  tagline: string
  features: string[]
  cta: string
  to?: string
  ctaDisabled?: boolean
  highlight?: boolean
  badge?: string
}

const PLANS: Plan[] = [
  {
    name: 'Bepul',
    price: '0',
    period: "so'm",
    tagline: "Hammaga to'liq ochiq — bugun va doimo.",
    features: [
      'AI repetitor bilan cheksiz suhbat',
      'Cheksiz DTM uslubidagi testlar',
      'Natija tahlili va progress kuzatuvi',
      'Flashcardlar bilan eslab qolish',
    ],
    cta: 'Bepul boshlash',
    to: ROUTE_REGISTER,
  },
  {
    name: 'Pro',
    price: '35 000',
    period: "so'm / oy",
    tagline: 'Orzuingga tezroq yetmoqchilar uchun qo\'shimcha kuch.',
    features: [
      'Thinking rejim — murakkab masalalarda AI chuqurroq fikrlaydi',
      'DTM savol-bashorati — 5 yillik tahlilga asoslangan eng ehtimoliy mavzu va savol turlari',
      'Chuqur analitika — kengaytirilgan zaiflik va progress tahlili',
      'Cheksiz va ustuvor yordam',
    ],
    cta: 'Tez kunda',
    ctaDisabled: true,
    highlight: true,
    badge: "Beta'da bepul ochiq",
  },
]

function PlanCard({ plan }: { plan: Plan }) {
  const card: CSSProperties = {
    position: 'relative',
    background: '#fff',
    border: plan.highlight ? `1.5px solid ${C.accent}` : `1px solid ${C.line}`,
    borderRadius: 18,
    padding: 32,
    boxShadow: plan.highlight ? '0 18px 40px -16px rgba(241,90,36,.24)' : SHADOW.card,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }
  return (
    <div className="lp-card" style={card}>
      {plan.badge && (
        <span
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: C.soft,
            color: C.accentStrong,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.02em',
            padding: '5px 11px',
            borderRadius: 999,
          }}
        >
          {plan.badge}
        </span>
      )}

      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: plan.highlight ? C.accent : C.gray2 }}>
        {plan.name}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '14px 0 0' }}>
        <span style={{ fontFamily: SANS, fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: C.ink }}>
          {plan.price}
        </span>
        {plan.period && <span style={{ fontSize: 15, fontWeight: 500, color: C.gray }}>{plan.period}</span>}
      </div>

      <p style={{ fontSize: 15, lineHeight: 1.55, color: C.gray, margin: '12px 0 0' }}>{plan.tagline}</p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'flex', flexDirection: 'column', gap: 14, flexGrow: 1 }}>
        {plan.features.map((f) => (
          <li key={f} style={{ display: 'flex', gap: 11, fontSize: 15, lineHeight: 1.5, color: C.ink }}>
            <PixelCheck color={plan.highlight ? C.accent : C.gray2} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 28 }}>
        {plan.ctaDisabled ? (
          <span
            aria-disabled="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              fontFamily: SANS,
              fontWeight: 600,
              fontSize: 15,
              lineHeight: 1,
              padding: '13px 20px',
              borderRadius: 11,
              border: `1px solid ${C.line}`,
              background: C.bg2,
              color: C.gray2,
              cursor: 'not-allowed',
            }}
          >
            {plan.cta}
          </span>
        ) : (
          <div style={{ display: 'flex' }}>
            <Button to={plan.to ?? ROUTE_REGISTER} variant={plan.highlight ? 'primary' : 'outline'} size="md" arrow>
              {plan.cta}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Pricing() {
  return (
    <section id="narxlar" style={{ ...container, padding: '96px 56px', position: 'relative' }} className="lp-container">
      <Reveal>
        <div style={{ maxWidth: 680, margin: '0 auto 56px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <Eyebrow align="center">NARXLAR</Eyebrow>
          </div>
          <h2 className="lp-h2" style={{ fontFamily: SANS, fontSize: 46, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, margin: 0, color: C.ink }}>
            Hozir <Em>hammasi</Em> bepul
          </h2>
          <p style={{ fontSize: 20, lineHeight: 1.6, color: C.gray, maxWidth: '44ch', margin: '20px auto 0' }}>
            Barcha asosiy imkoniyatlar hammaga ochiq. Pro reja — orzuingga tezroq yetmoqchilar uchun qo'shimcha kuch, tez kunda.
          </p>
        </div>
      </Reveal>

      <div className="lp-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, maxWidth: 880, margin: '0 auto' }}>
        {PLANS.map((p, i) => (
          <Reveal key={p.name} delay={i * 80}>
            <PlanCard plan={p} />
          </Reveal>
        ))}
      </div>

      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.gray2, textAlign: 'center', maxWidth: '60ch', margin: '28px auto 0' }}>
        DTM savol-bashorati — kafolat emas: 5 yillik DTM tahlillarimizga ko'ra eng ehtimoliy mavzu va savol turlari. To'lov hali ishga tushmagan — hozircha barcha imkoniyatlardan bepul foydalaning.
      </p>
    </section>
  )
}

/* ===================================================================== */
/* BIG CTA                                                                 */
/* ===================================================================== */

function CtaSection() {
  return (
    <>
      <hr className="lp-divider" />
      <section style={{ ...container, padding: '120px 56px', position: 'relative', textAlign: 'center' }} className="lp-container">
        <div aria-hidden="true" className="lp-tex-plus" style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Reveal>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <Eyebrow align="center">ORZUNG SHU YERDAN BOSHLANADI</Eyebrow>
            </div>
            <h2 className="lp-h2" style={{ fontFamily: SANS, fontSize: 46, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, margin: 0, color: C.ink }}>
              Birinchi qadamni <Em>bugun</Em> tashla
            </h2>
            <p style={{ fontSize: 20, lineHeight: 1.6, color: C.gray, maxWidth: '42ch', margin: '20px auto 0' }}>
              Orzuga eltadigan yo'l bitta qadamdan boshlanadi. Ro'yxatdan o'tish bepul, karta kerak emas.
            </p>
            <div style={{ marginTop: 34, display: 'flex', justifyContent: 'center' }} className="lp-cta-actions">
              <Button to={ROUTE_REGISTER} variant="primary" size="lg" arrow>Bepul boshlash</Button>
            </div>
          </Reveal>
        </div>
      </section>
      <hr className="lp-divider" />
    </>
  )
}

/* ===================================================================== */
/* FOOTER                                                                  */
/* ===================================================================== */

type FooterCol = { head: string; label: string; items: string[] }
const FOOTER_COLS: FooterCol[] = [
  { head: 'Mahsulot', label: 'Mahsulot havolalari', items: ['Imkoniyatlar', 'Fanlar', 'Narxlar'] },
  { head: 'Kompaniya', label: 'Kompaniya havolalari', items: ['Biz haqimizda', 'Aloqa', 'FAQ'] },
  { head: 'Huquqiy', label: 'Huquqiy havolalar', items: ['Maxfiylik', 'Shartlar', 'Oferta'] },
]

/* Footer yorliqlari → haqiqiy manzillar (anchor yoki sahifa) */
const FOOTER_HREF: Record<string, string> = {
  'Imkoniyatlar': '#imkoniyatlar', 'Fanlar': '#imkoniyatlar', 'Narxlar': '#narxlar', 'FAQ': '#faq',
  'Maxfiylik': '/maxfiylik', 'Shartlar': '/shartlar', 'Oferta': '/oferta',
}
const footerHref = (label: string): string => FOOTER_HREF[label] || '#'

function SocialDot({ initial }: { initial: string }) {
  return (
    <a
      href="#"
      className="lp-link"
      aria-label={initial}
      style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', color: C.gray2, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
    >
      {initial}
    </a>
  )
}

function Footer() {
  return (
    <footer>
      <hr className="lp-divider" />
      <div style={{ ...container, padding: '64px 56px 40px' }} className="lp-container">
        <div className="lp-footer-cols" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 32 }}>
          <div style={{ maxWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <LogoMark />
              <Wordmark />
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: C.gray, margin: '16px 0 0' }}>
              O'zbek abituriyentlari uchun AI repetitor.
            </p>
          </div>
          {FOOTER_COLS.map((col) => (
            <nav key={col.head} aria-label={col.label}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.gray2, marginBottom: 16 }}>{col.head}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {col.items.map((it) => (
                  <li key={it}>
                    <a href={footerHref(it)} className="lp-link" style={{ fontSize: 14, fontWeight: 500, color: C.gray, textDecoration: 'none' }}>{it}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 48, paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.gray2 }}>© 2026 DtmMax</span>
          <div style={{ display: 'flex', gap: 18 }}>
            <SocialDot initial="TG" />
            <SocialDot initial="IG" />
            <SocialDot initial="YT" />
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ===================================================================== */
/* PAGE                                                                    */
/* ===================================================================== */

export default function Landing() {
  const nav = useNavigate()
  const { token, user } = useAuthStore()

  /* Logged-in users skip the marketing page and land in their app shell
     (preserves the prior Landing behaviour so the Amber flow isn't broken). */
  useEffect(() => {
    if (token && user) {
      try {
        if (sessionStorage.getItem('dtmmax_skip_autoredirect') === '1') {
          sessionStorage.removeItem('dtmmax_skip_autoredirect')
          return
        }
      } catch { /* ignore */ }
      if (user.role === 'ADMIN') nav('/boshqaruv', { replace: true })
      else if (user.role === 'TEACHER') nav('/oqituvchi', { replace: true })
      else nav('/suhbat', { replace: true })
    }
  }, [nav, token, user])

  return (
    <div className="lp-root" style={{ fontFamily: SANS, color: C.ink, background: C.bg, minHeight: '100dvh' }}>
      <a
        href="#main"
        className="lp-btn"
        style={{ position: 'absolute', left: -9999, top: 0, background: C.ink, color: '#fff', padding: '10px 18px', borderRadius: 8, zIndex: 100, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}
        onFocus={(e) => { e.currentTarget.style.left = '16px'; e.currentTarget.style.top = '16px' }}
        onBlur={(e) => { e.currentTarget.style.left = '-9999px' }}
      >
        Asosiy kontentga o'tish
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Features />
        <Stats />
        <Testimonials />
        <Pricing />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  )
}
