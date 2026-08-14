import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client.js'
import { Alert, Field, Input, Spinner } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const blank = {
  full_name: '',
  username: '',
  email: '',
  cohort: '',
  password: '',
  password_confirm: '',
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await register(form)
      navigate('/tests', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Registration failed. Please review the details.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="animate-rise w-full max-w-[520px]">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-glow shadow-[0_12px_32px_-12px_rgba(99,102,241,0.9)]">
            <span className="text-sm font-bold text-white">GT</span>
          </div>
          <div className="leading-tight">
            <p className="font-semibold tracking-tight text-white">Candidate registration</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Graduate Trainee Assessments
            </p>
          </div>
        </div>

        <div className="surface-raised p-6 sm:p-7">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Full name">
              <Input required autoFocus value={form.full_name} onChange={set('full_name')} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Username">
                <Input required autoComplete="username" value={form.username} onChange={set('username')} />
              </Field>
              <Field label="Email">
                <Input required type="email" value={form.email} onChange={set('email')} />
              </Field>
            </div>

            <Field label="Cohort" hint="Optional — e.g. 2026 Graduate Intake">
              <Input value={form.cohort} onChange={set('cohort')} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password">
                <Input
                  required
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set('password')}
                />
              </Field>
              <Field label="Confirm password">
                <Input
                  required
                  type="password"
                  autoComplete="new-password"
                  value={form.password_confirm}
                  onChange={set('password_confirm')}
                />
              </Field>
            </div>

            <Alert>{error}</Alert>

            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy ? <Spinner size={17} /> : 'Create account'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-brand-300 hover:text-brand-200">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
