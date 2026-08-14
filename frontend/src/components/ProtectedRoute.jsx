import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { LoadingScreen } from './ui.jsx'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, booting, isAdmin } = useAuth()
  const location = useLocation()

  if (booting) return <LoadingScreen label="Checking your session" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (adminOnly && !isAdmin) return <Navigate to="/tests" replace />
  return children
}
