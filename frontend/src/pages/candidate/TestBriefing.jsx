import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api, { errorMessage } from '../../api/client.js'
import {
  IconAlert,
  IconArrowLeft,
  IconAward,
  IconCamera,
  IconClock,
  IconList,
  IconPlay,
} from '../../components/Icons.jsx'
import { Alert, Card, LoadingScreen, Spinner } from '../../components/ui.jsx'

export default function TestBriefing() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const [test, setTest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get(`/tests/${testId}/`)
      .then(({ data }) => setTest(data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [testId])

  const begin = async () => {
    setStarting(true)
    setError('')
    try {
      const { data } = await api.post(`/tests/${testId}/start/`)
      navigate(`/exam/${data.id}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'This test could not be started.'))
      setStarting(false)
    }
  }

  if (loading) return <LoadingScreen label="Loading briefing" />
  if (!test) return <Alert>{error || 'Test not found.'}</Alert>

  const facts = [
    { icon: <IconClock size={18} />, label: 'Time limit', value: `${test.duration_minutes} minutes` },
    { icon: <IconList size={18} />, label: 'Questions', value: test.served_question_count },
    { icon: <IconAward size={18} />, label: 'Pass mark', value: `${test.pass_mark}%` },
    { icon: <IconAward size={18} />, label: 'Total marks', value: test.total_points },
  ]

  return (
    <div className="animate-rise mx-auto max-w-3xl">
      <Link to="/tests" className="btn-subtle mb-5 -ml-2 px-2 py-1.5 text-xs">
        <IconArrowLeft size={15} /> All tests
      </Link>

      <div className="surface-raised relative overflow-hidden p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />

        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300/80">
          Assessment briefing
        </p>
        <h1 className="relative mt-2 text-3xl font-semibold leading-tight tracking-tight text-white">
          {test.title}
        </h1>
        {test.description && (
          <p className="relative mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-400">
            {test.description}
          </p>
        )}

        <div className="relative mt-6 grid gap-3 sm:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="rounded-xl border border-white/8 bg-white/3 p-3.5">
              <div className="text-brand-300">{fact.icon}</div>
              <p className="mt-2 text-lg font-semibold tracking-tight text-white">{fact.value}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{fact.label}</p>
            </div>
          ))}
        </div>
      </div>

      {test.instructions && (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
            Instructions
          </h2>
          <div className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-slate-300">
            {test.instructions}
          </div>
        </Card>
      )}

      {test.proctoring_enabled && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-400/25 bg-rose-500/8 p-4">
          <IconCamera size={20} className="mt-0.5 shrink-0 text-rose-300" />
          <div>
            <p className="text-sm font-semibold text-rose-200">Live proctoring is enabled</p>
            <p className="mt-1 text-[13px] leading-relaxed text-rose-200/70">
              This assessment is invigilated. Camera capture is not active in this build — the
              monitoring layer is still being fitted.
            </p>
          </div>
        </div>
      )}

      <Card className="mt-4">
        <div className="flex items-start gap-3">
          <IconAlert size={20} className="mt-0.5 shrink-0 text-amber-300" />
          <div className="text-[13px] leading-relaxed text-slate-400">
            <p className="mb-1.5 font-semibold text-slate-200">Before you begin</p>
            <ul className="list-inside list-disc space-y-1">
              <li>The timer starts the moment you press begin and does not pause.</li>
              <li>Your answers save automatically as you work.</li>
              <li>
                {test.allow_backtracking
                  ? 'You may move freely between questions using the numbered list.'
                  : 'You cannot return to a previous question once you move on.'}
              </li>
              <li>
                {test.allow_calculator
                  ? 'An on-screen calculator is available from the toolbar during this test.'
                  : 'No calculator is provided for this test.'}
              </li>
              <li>The test submits itself automatically when the time runs out.</li>
              <li>
                You have used {test.attempts_used} of {test.max_attempts} permitted attempt
                {test.max_attempts > 1 ? 's' : ''}.
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button onClick={begin} disabled={starting || !test.can_start} className="btn-primary px-7 py-3">
          {starting ? <Spinner size={17} /> : <IconPlay size={16} />}
          {starting ? 'Preparing your paper' : 'Begin test'}
        </button>
      </div>
    </div>
  )
}
