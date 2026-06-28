import type { ReactElement } from 'react'
import { parseStructuredJson } from '@/lib/structuredJson'

// Geometriya chizmasi — AI ```geometry JSON bloki orqali keladi, SVG'ga aylanadi.
// Koordinatalar "matematik" (y yuqoriga) — biz SVG'ga (y pastga) o'giramiz va
// figurani avtomatik markazlab, viewBox'ga sig'diramiz. Hech qanday innerHTML yo'q:
// bu toza React SVG, shuning uchun rehypeSanitize/DOMPurify muammosi bo'lmaydi.

type Ref = string | number[]

interface GeoData {
    points?: Record<string, number[]>
    segments?: Array<{ from: Ref; to: Ref; label?: string }>
    polygons?: Array<{ vertices: Ref[]; fill?: boolean }>
    circles?: Array<{ center?: Ref; cx?: number; cy?: number; r: number; label?: string }>
    angles?: Array<{ at: Ref; type?: string; label?: string; value?: string }>
    labels?: Array<{ at: Ref; text: string }>
    title?: string
}

type P2 = [number, number]

const num = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
    return Number.isFinite(n) ? n : null
}

const PAD = 30
const MAXW = 340
const MAXH = 260

export default function GeometryFigure({ raw }: { raw: string }) {
    const data = parseStructuredJson<GeoData>(raw)
    if (!data || typeof data !== 'object') return null

    // 1) Nomli nuqtalar
    const named: Record<string, P2> = {}
    if (data.points && typeof data.points === 'object') {
        for (const [k, v] of Object.entries(data.points)) {
            if (Array.isArray(v)) {
                const x = num(v[0]); const y = num(v[1])
                if (x !== null && y !== null) named[k] = [x, y]
            }
        }
    }

    const resolve = (ref: Ref | undefined): P2 | null => {
        if (typeof ref === 'string') return named[ref] || null
        if (Array.isArray(ref)) {
            const x = num(ref[0]); const y = num(ref[1])
            if (x !== null && y !== null) return [x, y]
        }
        return null
    }

    // 2) Bounding box uchun barcha nuqtalarni yig'amiz
    const all: P2[] = Object.values(named).slice()
    const segs = Array.isArray(data.segments) ? data.segments : []
    const polys = Array.isArray(data.polygons) ? data.polygons : []
    const circs = Array.isArray(data.circles) ? data.circles : []

    segs.forEach(s => { const a = resolve(s.from); const b = resolve(s.to); if (a) all.push(a); if (b) all.push(b) })
    polys.forEach(p => (Array.isArray(p.vertices) ? p.vertices : []).forEach(v => { const r = resolve(v); if (r) all.push(r) }))
    circs.forEach(c => {
        const ctr = c.center ? resolve(c.center) : (num(c.cx) !== null && num(c.cy) !== null ? [num(c.cx)!, num(c.cy)!] as P2 : null)
        const r = num(c.r)
        if (ctr && r !== null) { all.push([ctr[0] - r, ctr[1]], [ctr[0] + r, ctr[1]], [ctr[0], ctr[1] - r], [ctr[0], ctr[1] + r]) }
    })

    if (all.length === 0) return null

    const xs = all.map(p => p[0]); const ys = all.map(p => p[1])
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const wMath = (maxX - minX) || 1
    const hMath = (maxY - minY) || 1
    const scale = Math.min((MAXW - 2 * PAD) / wMath, (MAXH - 2 * PAD) / hMath)
    if (!Number.isFinite(scale) || scale <= 0) return null

    const svgW = Math.round(wMath * scale + 2 * PAD)
    const svgH = Math.round(hMath * scale + 2 * PAD)
    const tx = (x: number) => PAD + (x - minX) * scale
    const ty = (y: number) => svgH - PAD - (y - minY) * scale // y-flip

    const S = (ref: Ref | undefined): P2 | null => {
        const p = resolve(ref)
        return p ? [tx(p[0]), ty(p[1])] : null
    }

    // SVG markazi — yorliqlarni "tashqariga" surish yo'nalishi uchun
    const cx = all.reduce((a, p) => a + tx(p[0]), 0) / all.length
    const cy = all.reduce((a, p) => a + ty(p[1]), 0) / all.length
    const outward = (px: number, py: number, dist: number): P2 => {
        let dx = px - cx, dy = py - cy
        const len = Math.hypot(dx, dy) || 1
        dx /= len; dy /= len
        return [px + dx * dist, py + dy * dist]
    }

    // Barcha qirralar (segment + ko'pburchak tomonlari) — burchak/to'g'ri burchak uchun
    const edges: Array<[P2, P2]> = []
    segs.forEach(s => { const a = resolve(s.from); const b = resolve(s.to); if (a && b) edges.push([a, b]) })
    polys.forEach(p => {
        const vs = (Array.isArray(p.vertices) ? p.vertices : []).map(resolve).filter((v): v is P2 => !!v)
        for (let i = 0; i < vs.length; i++) edges.push([vs[i], vs[(i + 1) % vs.length]])
    })
    const eq = (a: P2, b: P2) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6
    const neighborsOf = (vertex: P2): P2[] => {
        const out: P2[] = []
        for (const [a, b] of edges) {
            if (eq(a, vertex) && !out.some(o => eq(o, b))) out.push(b)
            else if (eq(b, vertex) && !out.some(o => eq(o, a))) out.push(a)
        }
        return out.slice(0, 2)
    }

    const stroke = 'var(--text-primary)'
    const accent = 'var(--brand)'

    const els: ReactElement[] = []
    let key = 0

    // Ko'pburchaklar (avval — orqa fonda)
    polys.forEach(p => {
        const pts = (Array.isArray(p.vertices) ? p.vertices : []).map(S).filter((v): v is P2 => !!v)
        if (pts.length < 3) return
        els.push(<polygon key={`pg${key++}`} points={pts.map(p => `${p[0]},${p[1]}`).join(' ')}
            fill="color-mix(in srgb, var(--brand) 12%, transparent)" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" />)
    })

    // Aylanalar
    circs.forEach(c => {
        const ctr = c.center ? resolve(c.center) : (num(c.cx) !== null && num(c.cy) !== null ? [num(c.cx)!, num(c.cy)!] as P2 : null)
        const r = num(c.r)
        if (!ctr || r === null) return
        els.push(<circle key={`ci${key++}`} cx={tx(ctr[0])} cy={ty(ctr[1])} r={r * scale}
            fill="none" stroke={stroke} strokeWidth={1.6} />)
    })

    // Segmentlar
    segs.forEach(s => {
        const a = S(s.from); const b = S(s.to)
        if (!a || !b) return
        els.push(<line key={`ln${key++}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />)
        if (s.label) {
            const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
            // Kesmaga PERPENDIKULYAR, markazdan tashqari tomonga sur (kesma ustiga tushmasin)
            let px = -(b[1] - a[1]), py = (b[0] - a[0])
            const plen = Math.hypot(px, py) || 1
            px /= plen; py /= plen
            if (px * (mx - cx) + py * (my - cy) < 0) { px = -px; py = -py }
            const lx = mx + px * 13, ly = my + py * 13
            els.push(<text key={`ll${key++}`} x={lx} y={ly} fontSize={12} fontWeight={600} fill="var(--text-secondary)"
                textAnchor="middle" dominantBaseline="middle">{s.label}</text>)
        }
    })

    // To'g'ri burchak belgisi + burchak yorliqlari
    const angs = Array.isArray(data.angles) ? data.angles : []
    angs.forEach(ag => {
        const v = resolve(ag.at)
        if (!v) return
        const nb = neighborsOf(v).map(n => S(n)!).filter(Boolean)
        const vs = S(ag.at)
        if (!vs || nb.length < 2) return
        const u = (p: P2): P2 => { const dx = p[0] - vs[0], dy = p[1] - vs[1]; const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l] }
        const u1 = u(nb[0]); const u2 = u(nb[1])
        const isRight = (ag.type || '').toLowerCase().startsWith('right') || ag.label === '90' || ag.label === '90°'
        if (isRight) {
            const d = 11
            const c1: P2 = [vs[0] + u1[0] * d, vs[1] + u1[1] * d]
            const c2: P2 = [vs[0] + (u1[0] + u2[0]) * d, vs[1] + (u1[1] + u2[1]) * d]
            const c3: P2 = [vs[0] + u2[0] * d, vs[1] + u2[1] * d]
            els.push(<polyline key={`ra${key++}`} points={`${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${c3[0]},${c3[1]}`}
                fill="none" stroke={stroke} strokeWidth={1.3} />)
        } else if (ag.label || ag.value) {
            const bis: P2 = [u1[0] + u2[0], u1[1] + u2[1]]
            const bl = Math.hypot(bis[0], bis[1]) || 1
            const lx = vs[0] + (bis[0] / bl) * 22, ly = vs[1] + (bis[1] / bl) * 22
            els.push(<text key={`al${key++}`} x={lx} y={ly} fontSize={11} fontWeight={600} fill={accent}
                textAnchor="middle" dominantBaseline="middle">{ag.label || ag.value}</text>)
        }
    })

    // Nuqtalar + nomlari
    for (const [name, mp] of Object.entries(named)) {
        const sx = tx(mp[0]), sy = ty(mp[1])
        els.push(<circle key={`pt${key++}`} cx={sx} cy={sy} r={2.6} fill={stroke} />)
        const [lx, ly] = outward(sx, sy, 13)
        els.push(<text key={`pl${key++}`} x={lx} y={ly} fontSize={12.5} fontWeight={700} fill="var(--text-primary)"
            textAnchor="middle" dominantBaseline="middle">{name}</text>)
    }

    // Qo'shimcha erkin yorliqlar
    const extraLabels = Array.isArray(data.labels) ? data.labels : []
    extraLabels.forEach(lb => {
        const p = S(lb.at)
        if (!p || !lb.text) return
        const [lx, ly] = outward(p[0], p[1], 15)
        els.push(<text key={`xl${key++}`} x={lx} y={ly} fontSize={11.5} fontWeight={600} fill="var(--text-secondary)"
            textAnchor="middle" dominantBaseline="middle">{lb.text}</text>)
    })

    return (
        <div className="my-3 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
            {data.title && (
                <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{data.title}</span>
                </div>
            )}
            <div className="flex justify-center p-3 overflow-x-auto">
                <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ maxWidth: '100%', height: 'auto' }}
                    xmlns="http://www.w3.org/2000/svg">
                    {els}
                </svg>
            </div>
        </div>
    )
}
