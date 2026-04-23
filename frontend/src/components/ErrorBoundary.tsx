import { Component, ErrorInfo, ReactNode } from 'react'
import { BrainCircuit } from 'lucide-react'

interface Props { children: ReactNode; resetKey?: string }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false }

    private openHomeWithoutRedirect = () => {
        try {
            sessionStorage.setItem('dtmmax_skip_autoredirect', '1')
        } catch { /* ignore */ }
        window.location.href = '/'
    }

    private logoutAndOpenLogin = () => {
        try {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
        } catch { /* ignore */ }
        window.location.href = '/kirish'
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('ErrorBoundary:', error, info)
    }

    // Route o'zgarganda xatoni tozalaymiz — foydalanuvchi boshqa sahifaga o'tganda
    // "Sahifani yangilash" ko'rsatilmasdan shu sahifa ochiladi
    componentDidUpdate(prevProps: Props) {
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false, error: undefined })
        }
    }

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
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => this.setState({ hasError: false, error: undefined })}
                                style={{ background: 'var(--brand)', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 28px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                            >
                                Qayta urinish
                            </button>
                            <button
                                onClick={this.openHomeWithoutRedirect}
                                style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 28px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                            >
                                Bosh sahifa
                            </button>
                            <button
                                onClick={this.logoutAndOpenLogin}
                                style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 28px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                            >
                                Chiqish
                            </button>
                        </div>
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}
