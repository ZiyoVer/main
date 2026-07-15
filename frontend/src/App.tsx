import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { fetchApi } from './lib/api'
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
        <div className="h-screen w-full flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
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
    const { user, token, login } = useAuthStore()
    const location = useLocation()

    // Token bor lekin user store da yo'q — /auth/me orqali tiklaymiz
    const [storedToken, setStoredToken] = useState(() => localStorage.getItem('token'))
    const [checking, setChecking] = useState(!user && !!storedToken)
    // STUDENT emailVerified===false localStorage'dan o'qilgan bo'lsa — bloklashdan oldin
    // serverdan bir marta qayta tekshiramiz (mobil cross-browser tasdiq holatini ko'rish uchun).
    const [verifyChecked, setVerifyChecked] = useState(false)

    useEffect(() => {
        const syncToken = () => setStoredToken(localStorage.getItem('token'))
        window.addEventListener('storage', syncToken)
        return () => window.removeEventListener('storage', syncToken)
    }, [])

    useEffect(() => {
        if (!storedToken || user) {
            setChecking(false)
            return
        }

        let active = true
        if (!user && storedToken) {
            fetchApi('/auth/me')
                .then(data => {
                    if (!active) return
                    login(storedToken, data)
                    setChecking(false)
                })
                .catch(() => {
                    if (!active) return
                    localStorage.removeItem('token')
                    localStorage.removeItem('user')
                    setStoredToken(null)
                    setChecking(false)
                })
        }
        return () => { active = false }
    }, [user, storedToken, login])

    // Stale localStorage himoyasi: STUDENT'da emailVerified===false bo'lsa, darhol
    // /email-tasdiqlang'ga otmaymiz — avval /auth/me bilan yangi holatni olamiz.
    // Bir martalik (verifyChecked) — verified bo'lsa store yangilanadi, aks holsa bloklanadi.
    const needsVerifyRecheck = !!token && !!user && user.role === 'STUDENT' && user.emailVerified === false && !verifyChecked
    useEffect(() => {
        if (!needsVerifyRecheck || !token) {
            return
        }
        let active = true
        fetchApi('/auth/me', { silent: true })
            .then(data => {
                if (!active) return
                login(token, data)
            })
            .catch(() => { /* tarmoq xatosi — eski holatda bloklanadi */ })
            .finally(() => { if (active) setVerifyChecked(true) })
        return () => { active = false }
    }, [needsVerifyRecheck, token, login])

    if (checking) return <PageLoader />
    if (!token || !user) return <Navigate to="/kirish" state={{ from: location.pathname }} replace />
    if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
    // SOFT-GATE: email tasdiqlamagan o'quvchini ENDI BLOKLAMAYMIZ — platformaga kiradi,
    // ichkarida diqqat tortuvchi banner (EmailVerifyBanner) tasdiqlashga undaydi (odam qotib qolmaydi).
    // Avval serverdan holatni yangilaymiz (needsVerifyRecheck) — banner to'g'ri ko'rinishi uchun.
    if (needsVerifyRecheck) return <PageLoader />
    return <><EmailVerifyBanner />{children}</>
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
        </ErrorBoundary>
    )
}

export default function App() {
    return <AppContent />
}
