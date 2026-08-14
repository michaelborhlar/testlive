import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/admin/Dashboard.jsx'
import TestEditor from './pages/admin/TestEditor.jsx'
import TestResults from './pages/admin/TestResults.jsx'
import TestsList from './pages/admin/TestsList.jsx'
import ExamRunner from './pages/candidate/ExamRunner.jsx'
import MyResults from './pages/candidate/MyResults.jsx'
import ResultPage from './pages/candidate/ResultPage.jsx'
import TestBriefing from './pages/candidate/TestBriefing.jsx'
import TestCatalogue from './pages/candidate/TestCatalogue.jsx'

function Home() {
  const { user, booting, isAdmin } = useAuth()
  if (booting) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={isAdmin ? '/admin' : '/tests'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Home />} />

      {/* The live exam runs full-screen, outside the app chrome. */}
      <Route
        path="/exam/:attemptId"
        element={
          <ProtectedRoute>
            <ExamRunner />
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/tests" element={<TestCatalogue />} />
        <Route path="/tests/:testId" element={<TestBriefing />} />
        <Route path="/my-results" element={<MyResults />} />
        <Route path="/results/:attemptId" element={<ResultPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute adminOnly>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/tests" element={<TestsList />} />
        <Route path="/admin/tests/new" element={<TestEditor />} />
        <Route path="/admin/tests/:testId" element={<TestEditor />} />
        <Route path="/admin/tests/:testId/results" element={<TestResults />} />
        <Route path="/admin/results" element={<TestResults />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
