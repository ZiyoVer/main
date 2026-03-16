// Yuklanish davomida ko'rsatiladigan skeleton komponentlar
import { CSSProperties } from 'react'

interface SkeletonProps {
    width?: string | number
    height?: string | number
    borderRadius?: string
    className?: string
    style?: CSSProperties
}

export function Skeleton({ width = '100%', height = '16px', borderRadius = '6px', className = '', style }: SkeletonProps) {
    return (
        <div
            className={className}
            style={{
                width,
                height,
                borderRadius,
                background: 'var(--border)',
                backgroundImage: 'linear-gradient(90deg, var(--border) 0%, var(--bg-card) 50%, var(--border) 100%)',
                backgroundSize: '200% 100%',
                animation: 'skeleton-shimmer 1.5s infinite',
                ...style
            }}
        />
    )
}

export function SkeletonText({ lines = 3, lastLineWidth = '60%' }: { lines?: number; lastLineWidth?: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    width={i === lines - 1 ? lastLineWidth : '100%'}
                    height="14px"
                />
            ))}
        </div>
    )
}

export function SkeletonCard({ height = '80px' }: { height?: string }) {
    return (
        <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
        }}>
            <Skeleton width="40%" height="16px" />
            <Skeleton width="100%" height={height} borderRadius="8px" />
        </div>
    )
}

// Global CSS animation
const skeletonStyles = `
@keyframes skeleton-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}
`

// Style tag qo'shish (bir marta)
if (typeof document !== 'undefined' && !document.getElementById('skeleton-styles')) {
    const styleEl = document.createElement('style')
    styleEl.id = 'skeleton-styles'
    styleEl.textContent = skeletonStyles
    document.head.appendChild(styleEl)
}

export default Skeleton
