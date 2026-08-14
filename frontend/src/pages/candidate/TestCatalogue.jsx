import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { unwrap } from '../../api/client.js'
import { IconAward, IconCamera, IconClock, IconList, IconPlay } from '../../components/Icons.jsx'
import { Badge, EmptyState, LoadingScreen, SectionTitle } from '../../components/ui.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

export default function TestCatalogue() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/tests/')
      .then(({ data }) => setTests(unwrap(data)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingScreen label="Loading your assessments" />

  const firstName = (user?.full_name || user?.username || '').split(' ')[0]

  return (
    <div className="animate-rise">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300/80">
          Welcome back
        </p>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-white">
          Hello{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
          These are the assessments currently open to you. Read the briefing before you begin —
          once the timer starts it does not pause.
        </p>
      </div>

      <SectionTitle eyebrow="Assessments" title="Available tests" />

      {!tests.length ? (
        <EmptyState
          icon={<IconList size={26} />}
          title="No tests are open right now"
          description="When an administrator publishes an assessment for your cohort it will appear here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tests.map((test) => {
            const attemptsLeft = test.max_attempts - test.attempts_used
            return (
              <article
                key={test.id}
                className="surface-raised group relative flex flex-col overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-400/25"
              >
                <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-500/12 blur-3xl transition-opacity duration-500 group-hover:bg-brand-500/20" />

                <div className="relative flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold leading-snug tracking-tight text-white">
                    {test.title}
                  </h3>
                  {test.proctoring_enabled && (
                    <Badge tone="rose">
                      <IconCamera size={13} /> Proctored
                    </Badge>
                  )}
                </div>

                {test.description && (
                  <p className="relative mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">
                    {test.description}
                  </p>
                )}

                <div className="relative mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/8 bg-white/3 p-3">
                  <Metric icon={<IconClock size={15} />} value={`${test.duration_minutes}m`} label="Duration" />
                  <Metric icon={<IconList size={15} />} value={test.served_question_count} label="Questions" />
                  <Metric icon={<IconAward size={15} />} value={`${test.pass_mark}%`} label="Pass mark" />
                </div>

                <div className="relative mt-4 flex items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-slate-500">
                    {attemptsLeft > 0
                      ? `${attemptsLeft} of ${test.max_attempts} attempt${test.max_attempts > 1 ? 's' : ''} remaining`
                      : 'No attempts remaining'}
                  </p>
                  <button
                    disabled={!test.can_start}
                    onClick={() => navigate(`/tests/${test.id}`)}
                    className="btn-primary px-4 py-2 text-[13px]"
                  >
                    <IconPlay size={14} />
                    {test.attempts_used > 0 ? 'Retake' : 'Start'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Metric({ icon, value, label }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5 text-brand-300">{icon}</div>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </div>
  )
}
