import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Auth/Login'
import Register from './pages/Auth/Register'
import Dashboard from './pages/Student/Dashboard'
import Onboarding from './pages/Student/Onboarding'
import TestTaker from './pages/Student/TestTaker'
import Chat from './pages/Student/Chat'
import TeacherDashboard from './pages/Teacher/TeacherDashboard'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/test-taker" element={<TestTaker />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/teacher" element={<TeacherDashboard />} />
    </Routes>
  )
}

export default App
