import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { errorMessage, unwrap } from '../../api/client.js'
import { IconArrowLeft, IconEye, IconResults } from '../../components/Icons.jsx'
import {
  Alert,
  Badge,
  EmptyState,
  LoadingScreen,
  Modal,
  SectionTitle,
  StatCard,
  StatusBadge,
} from '../../components/ui.jsx'
import { formatDate, formatDuration, initials } from '../../utils/format.js'

export default function TestResults() {
  const { testId } = useParams()
  const [attempts, setAttempts] = useState([])
  const [tests, setTests] = useState([])
  const [filter, setFilter] = useState(testId || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    api.get('/admin/tests/').then(({ data }) => setTests(unwrap(data)))
  }, [])

  useEffect(() => {
    setLoading(true)
    api
      .get('/admin/attempts/', { params: { test: filter || undefined } })
      .then(({ data }) => setAttempts(unwrap(data)))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [filter])

  const openDetail = async (attempt) => {
    setDetail({ loading: true })
    try {
      const { data } = await api.get(`/admin/attempts/${attempt.id}/`)
      setDetail(data)
    } catch (err) {
      setDetail(null)
      setError(errorMessage(err))
    }
  }

  const summary = useMemo(() => {
    const graded = attempts.filter((a) => a.status !== 'in_progress')
    const passed = graded.filter((a) => a.passed).length
    const average = graded.length
      ? graded.reduce((sum, a) => sum + a.percentage, 0) / graded.length
      : 0
    return {
      total: graded.length,
      passed,
      passRate: graded.length ? Math.round((passed / graded.length) * 100) : 0,
      average: Math.round(average * 10) / 10,
      inProgress: attempts.filter((a) => a.status === 'in_progress').length,
    }
  }, [attempts])

  return (
    <div className="animate-rise">
      {testId && (
        <Link to="/admin/tests" className="btn-subtle mb-4 -ml-2 px-2 py-1.5 text-xs">
          <IconArrowLeft size={15} /> All tests
        </Link>
      )}

      <SectionTitle
        eyebrow="Reporting"
        title="Candidate results"
        description="Every attempt recorded, with the marks awarded per candidate."
        action={
          <select
            className="field w-auto min-w-[200px]"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All tests</option>
            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.title}
              </option>
            ))}
          </select>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Completed" value={summary.total} sub={`${summary.inProgress} in progress`} />
        <StatCard label="Passed" value={summary.passed} tone="green" />
        <StatCard
          label="Pass rate"
          value={`${summary.passRate}%`}
          tone={summary.passRate >= 50 ? 'green' : 'rose'}
        />
        <StatCard label="Average score" value={`${summary.average}%`} tone="amber" />
      </div>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {loading ? (
        <LoadingScreen label="Loading results" />
      ) : !attempts.length ? (
        <EmptyState
          icon={<IconResults size={26} />}
          title="No attempts recorded"
          description="Results appear here as soon as candidates start sitting this assessment."
        />
      ) : (
        <div className="surface-raised overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-5 py-3 font-semibold">Candidate</th>
                  <th className="px-5 py-3 font-semibold">Test</th>
                  <th className="px-5 py-3 font-semibold">Score</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Time</th>
                  <th className="px-5 py-3 font-semibold">Submitted</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr
                    key={attempt.id}
                    className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/3"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500/70 to-violet-glow/60 text-[11px] font-bold text-white">
                          {initials(attempt.candidate.full_name || attempt.candidate.username)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-100">
                            {attempt.candidate.full_name || attempt.candidate.username}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {attempt.candidate.cohort || attempt.candidate.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">{attempt.test_title}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-slate-200">
                          {attempt.score}/{attempt.max_score}
                        </span>
                        <Badge tone={attempt.passed ? 'green' : 'rose'}>
                          {Math.round(attempt.percentage)}%
                        </Badge>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={attempt.status} />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {formatDuration(attempt.duration_taken)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {formatDate(attempt.submitted_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openDetail(attempt)}
                        className="btn-ghost px-2.5 py-1.5 text-xs"
                        title="View answers"
                      >
                        <IconEye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.candidate_name || 'Attempt detail'}
        description={detail?.test_title}
        width="max-w-2xl"
      >
        {detail?.loading ? (
          <LoadingScreen label="Loading answers" />
        ) : (
          detail && (
            <div>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <Tile label="Score" value={`${detail.score}/${detail.max_score}`} />
                <Tile label="Percentage" value={`${Math.round(detail.percentage)}%`} />
                <Tile label="Time taken" value={formatDuration(detail.duration_taken)} />
              </div>

              <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                {(detail.review || []).map((item) => (
                  <div
                    key={item.question_id}
                    className={`rounded-xl border p-3.5 ${
                      item.is_correct
                        ? 'border-emerald-400/20 bg-emerald-500/5'
                        : 'border-rose-400/20 bg-rose-500/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[13px] leading-relaxed text-slate-200">
                        <span className="mr-1.5 font-semibold text-slate-400">{item.number}.</span>
                        {item.text}
                      </p>
                      <Badge tone={item.is_correct ? 'green' : 'rose'}>
                        {item.points_awarded}/{item.points}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      <span className="text-slate-500">Answered: </span>
                      {item.your_answer || <span className="text-rose-300">no answer</span>}
                    </p>
                    {!item.is_correct && (
                      <p className="mt-0.5 text-xs text-emerald-300/80">
                        <span className="text-slate-500">Correct: </span>
                        {item.correct_answer}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </Modal>
    </div>
  )
}

function Tile({ label, value }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3 text-center">
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </div>
  )
}
