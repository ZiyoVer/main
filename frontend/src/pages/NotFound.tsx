import { useNavigate } from 'react-router-dom'

export default function NotFound() {
    const navigate = useNavigate()
    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center text-center px-4"
            style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}
        >
            <div className="text-8xl font-bold mb-4" style={{ color: 'var(--border)' }}>404</div>
            <h1 className="text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Sahifa topilmadi</h1>
            <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>Siz izlayotgan sahifa mavjud emas yoki o'chirib yuborilgan.</p>
            <button
                onClick={() => navigate('/')}
                className="btn btn-primary"
                style={{ padding: '0.75rem 1.5rem' }}
            >
                Bosh sahifaga qaytish
            </button>
        </div>
    )
}
