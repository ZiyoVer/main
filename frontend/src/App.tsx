import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import Landing from './pages/Landing'
import Login from './pages/Auth/Login'
import Register from './pages/Auth/Register'
import AdminLogin from './pages/Auth/AdminLogin'
import ChatLayout from './pages/Student/ChatLayout'
import TestPage from './pages/Student/TestPage'
import AdminPanel from './pages/Admin/AdminPanel'
import TeacherPanel from './pages/Teacher/TeacherPanel'
import NotFound from './pages/NotFound'

function ProtectedRoute({ children, roles }: { children: React.ReactNode, roles?: string[] }) {
    const { user, token } = useAuthStore()
    const location = useLocation()
    if (!token || !user) return <Navigate to="/kirish" state={{ from: location.pathname }} replace />
    if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
    return <>{children}</>
}

export default function App() {
    return (
        <>
            <Toaster
                position="top-center"
                toastOptions={{
                    style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
                    error: { style: { background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)' } }
                }}
            />
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/kirish" element={<Login />} />
                <Route path="/royxat" element={<Register />} />
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
                <Route path="/test/:shareLink" element={<ProtectedRoute><TestPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminPanel /></ProtectedRoute>} />
                <Route path="/teacher" element={<ProtectedRoute roles={['TEACHER', 'ADMIN']}><TeacherPanel /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </>
    )
}
