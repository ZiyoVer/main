import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, message: '' }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, message: error.message }
    }

    componentDidCatch(error: Error, info: { componentStack: string }) {
        console.error('ErrorBoundary:', error, info)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
                    <div className="text-5xl mb-4">⚠️</div>
                    <h1 className="text-xl font-semibold text-gray-700 mb-2">Xatolik yuz berdi</h1>
                    <p className="text-gray-500 mb-6 text-sm max-w-md">{this.state.message || 'Kutilmagan xatolik.'}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                        Sahifani yangilash
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}
