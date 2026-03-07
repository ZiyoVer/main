import { Component, ErrorInfo, ReactNode } from 'react'
import { BrainCircuit } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false }
    static getDerivedStateFromError(error: Error): State { return { hasError: true, error } }
    componentDidCatch(error: Error, info: ErrorInfo) { console.error('ErrorBoundary:', error, info) }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', padding: '20px' }}>
                    <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <BrainCircuit style={{ width: '28px', height: '28px', color: 'white' }} />
                        </div>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Xatolik yuz berdi</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
                            Kutilmagan xatolik. Sahifani yangilab ko'ring.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            style={{ background: 'var(--brand)', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 28px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                        >
                            Sahifani yangilash
                        </button>
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}
