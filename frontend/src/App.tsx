import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { fetchApi } from './lib/api'
import ErrorBoundary from './components/ErrorBoundary'

// Lazy loading — katta komponentlar kerak bo'lgandagina yuklanadi (bundle size -40%)
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Auth/Login'))
const Register = lazy(() => import('./pages/Auth/Register'))
const AdminLogin = lazy(() => import('./pages/Auth/AdminLogin'))
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'))
const EmailVerify = lazy(() => import('./pages/Auth/EmailVerify'))
const ChatLayout = lazy(() => import('./pages/Student/ChatLayout'))
const TestPage = lazy(() => import('./pages/Student/TestPage'))
const AdminPanel = lazy(() => import('./pages/Admin/AdminPanel'))
const TeacherPanel = lazy(() => import('./pages/Teacher/TeacherPanel'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Terms = lazy(() => import('./pages/Terms'))
const Privacy = lazy(() => import('./pages/Privacy'))

function PageLoader() {
    return (
        <div className="h-screen w-full flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
            <div style={{
                width: '36px', height: '36px', border: '3px solid var(--border)',
                borderTopColor: 'var(--brand)', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

function ProtectedRoute({ children, roles }: { children: React.ReactNode, roles?: string[] }) {
    const { user, token, login } = useAuthStore()
    const location = useLocation()

    // Token bor lekin user store da yo'q — /auth/me orqali tiklaymiz
    const storedToken = localStorage.getItem('token')
    const [checking, setChecking] = useState(!user && !!storedToken)

    useEffect(() => {
        if (!user && storedToken) {
            fetchApi('/auth/me')
                .then(data => { login(storedToken, data); setChecking(false) })
                .catch(() => {
                    localStorage.removeItem('token')
                    localStorage.removeItem('user')
                    setChecking(false)
                })
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Tekshiruv davomida bo'sh sahifa — login flicker oldini oladi
    if (checking) return <div className="h-screen w-full" style={{ background: 'var(--bg-main)' }} />
    if (!token || !user) return <Navigate to="/kirish" state={{ from: location.pathname }} replace />
    if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
    return <>{children}</>
}

// Route o'zgarganda ErrorBoundary ni reset qilish — "Sahifani yangilash" ekranidan
// avtomatik chiqish uchun. resetKey pathname o'zgarganda boundary tozalanadi.
function AppContent() {
    const location = useLocation()
    return (
        <ErrorBoundary resetKey={location.pathname}>
            <Toaster
                position="top-center"
                toastOptions={{
                    style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
                    error: { style: { background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)' } }
                }}
            />
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/kirish" element={<Login />} />
                    <Route path="/royxat" element={<Register />} />
                    <Route path="/parolni-tiklash" element={<ForgotPassword />} />
                    <Route path="/parol-tiklash/:token" element={<ResetPassword />} />
                    <Route path="/email-tasdiqlash/:token" element={<EmailVerify />} />
                    {/* O'zbek tilidagi asosiy routelar */}
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
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Suspense>
        </ErrorBoundary>
    )
}

export default function App() {
    return <AppContent />
}
