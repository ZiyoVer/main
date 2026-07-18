import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore, type AuthUser } from './store/authStore'
import ErrorBoundary from './components/ErrorBoundary'
import EmailVerifyBanner from './components/EmailVerifyBanner'

// Lazy loading — katta komponentlar kerak bo'lgandagina yuklanadi (bundle size -40%)
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Auth/Login'))
const Register = lazy(() => import('./pages/Auth/Register'))
const AdminLogin = lazy(() => import('./pages/Auth/AdminLogin'))
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'))
const EmailVerify = lazy(() => import('./pages/Auth/EmailVerify'))
const VerifyEmailNotice = lazy(() => import('./pages/Auth/VerifyEmailNotice'))
const ProResult = lazy(() => import('./pages/ProResult'))
const GoogleCallback = lazy(() => import('./pages/Auth/GoogleCallback'))
const ChatLayout = lazy(() => import('./pages/Student/ChatLayout'))
const TestPage = lazy(() => import('./pages/Student/TestPage'))
const AdminPanel = lazy(() => import('./pages/Admin/AdminPanel'))
const TeacherPanel = lazy(() => import('./pages/Teacher/TeacherPanel'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Terms = lazy(() => import('./pages/Terms'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Oferta = lazy(() => import('./pages/Oferta'))

function PageLoader() {
    // Spinner 250ms KECHIKIB chiqadi: tez sahifa almashishlarda (chunk keshda)
    // spinner "milt" etmaydi — sahifalar orasida g'alati qimirlash yo'qoladi.
    // Sekin yuklanishda (birinchi kirish, sust tarmoq) spinner baribir ko'rinadi.
    const [show, setShow] = useState(false)
    useEffect(() => {
        const t = setTimeout(() => setShow(true), 250)
        return () => clearTimeout(t)
    }, [])
    return (
        <div className="h-screen w-full flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
            {show && (
                <>
                    <div style={{
                        width: '36px', height: '36px', border: '3px solid var(--border)',
                        borderTopColor: 'var(--brand)', borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
            )}
        </div>
    )
}

function ProtectedRoute({ children, roles }: { children: React.ReactNode, roles?: string[] }) {
    const { user, token } = useAuthStore()
    const location = useLocation()
    if (!token || !user) return <Navigate to="/kirish" state={{ from: location.pathname }} replace />
    if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
    // SOFT-GATE: email tasdiqlamagan o'quvchini ENDI BLOKLAMAYMIZ — platformaga kiradi,
    // ichkarida diqqat tortuvchi banner (EmailVerifyBanner) tasdiqlashga undaydi (odam qotib qolmaydi).
    return <><EmailVerifyBanner />{children}</>
}

/**
 * localStorage faqat kesh. Har bir yangi tab/refreshda token `/auth/me` orqali
 * tekshirilmaguncha hech qanday role-based route render qilinmaydi.
 */
function SessionBootstrap({ children }: { children: React.ReactNode }) {
    const token = useAuthStore(s => s.token)
    const hydrated = useAuthStore(s => s.hydrated)
    const restore = useAuthStore(s => s.restore)
    const beginHydration = useAuthStore(s => s.beginHydration)
    const markHydrated = useAuthStore(s => s.markHydrated)
    const clearSession = useAuthStore(s => s.clearSession)
    const syncFromStorage = useAuthStore(s => s.syncFromStorage)
    const [retryKey, setRetryKey] = useState(0)
    const [serviceError, setServiceError] = useState<string | null>(null)

    useEffect(() => {
        const sync = (event: StorageEvent) => {
            if (event.key === 'token' || event.key === 'user' || event.key === null) {
                syncFromStorage()
            }
        }
        window.addEventListener('storage', sync)
        return () => window.removeEventListener('storage', sync)
    }, [syncFromStorage])

    useEffect(() => {
        let active = true
        setServiceError(null)

        if (!token) {
            markHydrated()
            return () => { active = false }
        }

        beginHydration()
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 10_000)
        fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async response => {
                const body = await response.json().catch(() => ({}))
                if (!active) return
                if (response.ok) {
                    restore(token, body as AuthUser)
                    return
                }
                // Token/user yaroqsiz yoki bloklangan — lokal sessionni ham tugatamiz.
                if (response.status === 401 || response.status === 403) {
                    clearSession()
                    return
                }
                setServiceError(body?.error || 'Sessiyani tekshirish xizmati vaqtincha ishlamayapti.')
            })
            .catch((error: unknown) => {
                if (!active) return
                const timedOut = error instanceof DOMException && error.name === 'AbortError'
                setServiceError(timedOut
                    ? 'Server 10 soniyada javob bermadi. Qayta urinib ko‘ring yoki sessiyani tugating.'
                    : 'Server bilan aloqa o‘rnatilmadi. Internetni tekshirib, qayta urinib ko‘ring.')
            })
            .finally(() => window.clearTimeout(timeoutId))

        return () => {
            active = false
            controller.abort()
            window.clearTimeout(timeoutId)
        }
    }, [beginHydration, clearSession, markHydrated, restore, retryKey, token])

    if (serviceError) {
        return (
            <div className="kelviq min-h-screen flex items-center justify-center p-5" style={{ background: 'var(--bg-page)' }}>
                <div className="card w-full max-w-sm text-center" style={{ padding: '1.75rem' }}>
                    <h1 className="text-lg font-bold mb-2">Sessiyani tekshirib bo‘lmadi</h1>
                    <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{serviceError}</p>
                    <div className="flex flex-col gap-2">
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setRetryKey(key => key + 1)}>
                            Qayta urinish
                        </button>
                        <button
                            className="btn"
                            style={{ width: '100%' }}
                            onClick={() => {
                                clearSession()
                                window.location.assign('/kirish')
                            }}
                        >
                            Sessiyani tugatib, kirish
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (!hydrated) return <PageLoader />
    return <>{children}</>
}

// Kirgan foydalanuvchi "/" ga kelsa, landing CHIZILISHIDAN OLDIN (sinxron) o'z
// paneliga yo'naltiramiz. authStore token/user'ni localStorage'dan sinxron o'qiydi,
// shuning uchun bu yerda darrov hal qilamiz — landing bir lahza miltillab ko'rinmaydi.
// (Landing lazy bo'lgani uchun yo'naltirilganda uning chunki ham yuklanmaydi.)
function LandingRoute() {
    const { token, user } = useAuthStore()
    if (token && user) {
        const to = user.role === 'ADMIN' ? '/boshqaruv' : user.role === 'TEACHER' ? '/oqituvchi' : '/bugun'
        return <Navigate to={to} replace />
    }
    return <Landing />
}

// Route o'zgarganda ErrorBoundary ni reset qilish — "Sahifani yangilash" ekranidan
// avtomatik chiqish uchun. resetKey pathname o'zgarganda boundary tozalanadi.
function AppContent() {
    const location = useLocation()
    return (
        <ErrorBoundary resetKey={`${location.pathname}${location.search}`}>
            <Toaster
                position="top-center"
                toastOptions={{
                    style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
                    error: { style: { background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)' } }
                }}
            />
            <SessionBootstrap>
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                    <Route path="/" element={<LandingRoute />} />
                    <Route path="/kirish" element={<Login />} />
                    <Route path="/royxat" element={<Register />} />
                    <Route path="/parolni-tiklash" element={<ForgotPassword />} />
                    <Route path="/parol-tiklash/:token" element={<ResetPassword />} />
                    <Route path="/email-tasdiqlash/:token" element={<EmailVerify />} />
                    <Route path="/email-tasdiqlang" element={<VerifyEmailNotice />} />
                    <Route path="/auth/google/callback" element={<GoogleCallback />} />
                    {/* O'zbek tilidagi asosiy routelar */}
                    <Route path="/pro/natija" element={<ProtectedRoute><ProResult /></ProtectedRoute>} />
                    <Route path="/bugun" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
                    <Route path="/suhbat" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
                    <Route path="/suhbat/:chatId" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
                    <Route path="/oqituvchi" element={<ProtectedRoute roles={['TEACHER', 'ADMIN']}><TeacherPanel /></ProtectedRoute>} />
                    <Route path="/boshqaruv" element={<ProtectedRoute roles={['ADMIN']}><AdminPanel /></ProtectedRoute>} />
                    {/* Legacy routes — backward compat */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/admin-login" element={<AdminLogin />} />
                    <Route path="/chat" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
                    <Route path="/chat/:chatId" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
                    <Route path="/test/:shareLink" element={<TestPage />} />
                    <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminPanel /></ProtectedRoute>} />
                    <Route path="/teacher" element={<ProtectedRoute roles={['TEACHER', 'ADMIN']}><TeacherPanel /></ProtectedRoute>} />
                    <Route path="/shartlar" element={<Terms />} />
                    <Route path="/maxfiylik" element={<Privacy />} />
                    <Route path="/oferta" element={<Oferta />} />
                    <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            </SessionBootstrap>
        </ErrorBoundary>
    )
}

export default function App() {
    return <AppContent />
}
