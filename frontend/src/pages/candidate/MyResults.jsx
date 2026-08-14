import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { unwrap } from '../../api/client.js'
import { IconAward, IconChevronRight } from '../../components/Icons.jsx'
import {
  Badge,
  EmptyState,
  LoadingScreen,
  SectionTitle,
  StatusBadge,
} from '../../components/ui.jsx'
import { formatDate, formatDuration } from '../../utils/format.js'

export default function MyResults() {
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/attempts/')
      .then(({ data }) => setAttempts(unwrap(data)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingScreen label="Loading your results" />

  const graded = attempts.filter((a) => a.status !== 'in_progress')

  return (
    <div className="animate-rise">
      <SectionTitle
        eyebrow="History"
        title="My results"
        description="Every assessment you have sat, with the marks awarded."
      />

      {!graded.length ? (
        <EmptyState
          icon={<IconAward size={26} />}
          title="No completed assessments yet"
          description="Your scores will appear here as soon as you finish a test."
          action={
            <Link to="/tests" className="btn-primary mt-2">
              Browse available tests
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {graded.map((attempt) => (
            <Link
              key={attempt.id}
              to={`/results/${attempt.id}`}
              className="surface-raised group flex items-center gap-4 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-400/25"
            >
              <div
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl border text-sm font-bold tabular-nums ${
                  attempt.passed
                    ? 'border-emerald-400/25 bg-emerald-500/12 text-emerald-300'
                    : 'border-rose-400/25 bg-rose-500/12 text-rose-300'
                }`}
              >
                {Math.round(attempt.percentage)}%
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{attempt.test_title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDate(attempt.submitted_at)} · {formatDuration(attempt.duration_taken)} ·{' '}
                  {attempt.score}/{attempt.max_score} marks
                </p>
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                <StatusBadge status={attempt.status} />
                <Badge tone={attempt.passed ? 'green' : 'rose'}>
                  {attempt.passed ? 'Pass' : 'Fail'}
                </Badge>
              </div>

              <IconChevronRight
                size={18}
                className="shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
