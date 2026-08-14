import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { tokens } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    if (!tokens.access) {
      setBooting(false)
      return
    }
    api
      .get('/auth/me/')
      .then(({ data }) => setUser(data))
      .catch(() => tokens.clear())
      .finally(() => setBooting(false))
  }, [])

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login/', { username, password })
    tokens.set(data)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register/', payload)
    tokens.set(data)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    tokens.clear()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, booting, login, register, logout, isAdmin: !!user?.is_exam_admin }),
    [user, booting, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
