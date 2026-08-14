import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { initials } from '../utils/format.js'
import {
  IconAward,
  IconDashboard,
  IconList,
  IconLogout,
  IconResults,
  IconTests,
} from './Icons.jsx'

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/admin/tests', label: 'Tests', icon: IconTests },
  { to: '/admin/results', label: 'Results', icon: IconResults },
]

const candidateNav = [
  { to: '/tests', label: 'Available tests', icon: IconList, end: true },
  { to: '/my-results', label: 'My results', icon: IconAward },
]

function Brand() {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-glow shadow-[0_10px_28px_-10px_rgba(99,102,241,0.9)]">
        <span className="text-sm font-bold text-white">GT</span>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight text-white">Graduate Trainee</p>
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Assessments</p>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const nav = isAdmin ? adminNav : candidateNav

  const signOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-white/6 bg-ink-900/50 px-4 py-6 backdrop-blur-xl lg:flex">
        <Brand />

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          <p className="mb-2 px-3.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            {isAdmin ? 'Administration' : 'Assessment'}
          </p>
          {nav.map(({ to, label, icon: Glyph, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <Glyph size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 rounded-xl border border-white/8 bg-white/3 p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500/80 to-violet-glow/70 text-xs font-bold text-white">
              {initials(user?.full_name || user?.username)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {user?.full_name || user?.username}
              </p>
              <p className="truncate text-[11px] capitalize text-slate-500">{user?.role}</p>
            </div>
          </div>
          <button onClick={signOut} className="btn-subtle mt-2 w-full justify-start px-2 py-1.5 text-xs">
            <IconLogout size={15} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/6 bg-ink-950/70 px-5 py-3.5 backdrop-blur-xl lg:hidden">
          <Brand />
          <button onClick={signOut} className="btn-ghost px-3 py-2">
            <IconLogout size={16} />
          </button>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-white/6 bg-ink-900/40 px-3 py-2 lg:hidden">
          {nav.map(({ to, label, icon: Glyph, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `nav-link shrink-0 py-2 text-xs ${isActive ? 'nav-link-active' : ''}`
              }
            >
              <Glyph size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-5 py-7 lg:px-9 lg:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
