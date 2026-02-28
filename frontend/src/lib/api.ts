export const API_URL = import.meta.env.VITE_API_URL || "/api"

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem("token")

    const headers = new Headers(options.headers || {})
    headers.set("Content-Type", "application/json")
    if (token) {
        headers.set("Authorization", `Bearer ${token}`)
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    })

    // Parse JSON seamlessly if available
    let data
    const text = await response.text()
    try {
        data = text ? JSON.parse(text) : {}
    } catch (e) {
        data = text
    }

    if (!response.ok) {
        throw new Error(data?.error || "Server xatoligi")
    }
    return data
}
