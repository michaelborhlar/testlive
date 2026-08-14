import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client.js'
import { IconAward, IconClock, IconShield } from '../components/Icons.jsx'
import { Alert, Field, Input, Spinner } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const highlights = [
  { icon: IconClock, title: 'Timed, server-enforced', text: 'The clock runs on the server, so a refresh never buys extra time.' },
  { icon: IconAward, title: 'Instant, consistent marking', text: 'Every answer is graded against the same key the moment you submit.' },
  { icon: IconShield, title: 'Proctoring ready', text: 'Live camera invigilation can be switched on per test by an administrator.' },
]

export default function Login() {
  const { user, login, booting, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!booting && user) return <Navigate to={isAdmin ? '/admin' : '/tests'} replace />

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const account = await login(form.username.trim(), form.password)
      navigate(account.is_exam_admin ? '/admin' : '/tests', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Those credentials were not recognised.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden border-r border-white/6 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-brand-500/25 blur-[110px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-violet-glow/20 blur-[110px]" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-glow shadow-[0_12px_32px_-12px_rgba(99,102,241,0.9)]">
            <span className="text-sm font-bold text-white">GT</span>
          </div>
          <div className="leading-tight">
            <p className="font-semibold tracking-tight text-white">Graduate Trainee</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Assessment Platform</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight text-white">
            Screen your next intake with{' '}
            <span className="bg-gradient-to-r from-brand-300 to-violet-glow bg-clip-text text-transparent">
              one fair, timed test.
            </span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            Build the paper, set the clock, publish it — and watch scored results land as
            candidates finish.
          </p>

          <div className="mt-9 space-y-3.5">
            {highlights.map(({ icon: Glyph, title, text }) => (
              <div key={title} className="flex gap-3.5">
                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-brand-300">
                  <Glyph size={17} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">{title}</p>
                  <p className="text-[13px] leading-relaxed text-slate-500">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-slate-600">
          © {new Date().getFullYear()} Graduate Trainee Assessments
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="animate-rise w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-glow">
              <span className="text-sm font-bold text-white">GT</span>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-white">Sign in</h2>
          <p className="mt-1.5 text-sm text-slate-400">
            Use the username or email address issued to you.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="Username or email">
              <Input
                autoFocus
                required
                autoComplete="username"
                placeholder="you@example.com"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </Field>

            <Field label="Password">
              <Input
                required
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>

            <Alert>{error}</Alert>

            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy ? <Spinner size={17} /> : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            No account yet?{' '}
            <Link to="/register" className="font-medium text-brand-300 hover:text-brand-200">
              Register as a candidate
            </Link>
          </p>

          <div className="surface mt-8 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Demo accounts
            </p>
            <div className="mt-2.5 space-y-1.5 font-mono text-[12px] text-slate-400">
              <p>
                <span className="text-slate-500">admin</span> · admin / admin12345
              </p>
              <p>
                <span className="text-slate-500">candidate</span> · candidate / candidate12345
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
