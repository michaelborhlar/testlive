import axios from 'axios'

const ACCESS_KEY = 'gta.access'
const REFRESH_KEY = 'gta.refresh'

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set({ access, refresh }) {
    if (access) localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = tokens.access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const isAuthCall = original?.url?.includes('/auth/')

    if (error.response?.status === 401 && !original._retried && !isAuthCall && tokens.refresh) {
      original._retried = true
      try {
        refreshing =
          refreshing ||
          axios.post(`${api.defaults.baseURL}/auth/refresh/`, { refresh: tokens.refresh })
        const { data } = await refreshing
        refreshing = null
        tokens.set(data)
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch {
        refreshing = null
        tokens.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

/** Pull a readable message out of a DRF error response. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data
  if (!data) return error?.message || fallback
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  const first = Object.entries(data)[0]
  if (!first) return fallback
  const [field, value] = first
  const text = Array.isArray(value) ? value[0] : value
  return field === 'non_field_errors' ? text : `${field}: ${text}`
}

/** DRF pagination returns {results: []}; plain lists come back bare. */
export const unwrap = (data) => (Array.isArray(data) ? data : (data?.results ?? []))

export default api
