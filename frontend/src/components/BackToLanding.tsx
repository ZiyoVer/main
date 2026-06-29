import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Login/Register sahifasi burchagidagi "asosiy sahifaga qaytish" tugmasi.
// Tashqi konteyner position:relative bo'lishi kerak (Login/Register'da shunday).
export default function BackToLanding() {
    return (
        <Link
            to="/"
            aria-label="Asosiy sahifaga qaytish"
            className="back-to-landing"
            style={{
                position: 'absolute', top: '1rem', left: '1rem', zIndex: 5,
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.8rem', borderRadius: '10px',
                fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                color: 'var(--text-secondary)', background: 'var(--bg-surface)',
                border: '1px solid var(--border)', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-muted)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
        >
            <ArrowLeft style={{ width: 15, height: 15 }} />
            <span>Bosh sahifa</span>
        </Link>
    )
}
