import { useNavigate } from 'react-router-dom'

export default function NotFound() {
    const navigate = useNavigate()
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
            <div className="text-8xl font-bold text-gray-200 mb-4">404</div>
            <h1 className="text-2xl font-semibold text-gray-700 mb-2">Sahifa topilmadi</h1>
            <p className="text-gray-500 mb-8">Siz izlayotgan sahifa mavjud emas yoki o'chirib yuborilgan.</p>
            <button
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
                Bosh sahifaga qaytish
            </button>
        </div>
    )
}
