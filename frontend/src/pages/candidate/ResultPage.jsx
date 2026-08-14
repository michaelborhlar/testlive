import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import api, { errorMessage } from '../../api/client.js'
import { IconArrowLeft, IconCheck, IconClock, IconX } from '../../components/Icons.jsx'
import {
  Alert,
  Badge,
  Card,
  LoadingScreen,
  ScoreRing,
  SectionTitle,
  StatusBadge,
} from '../../components/ui.jsx'
import { formatDate, formatDuration } from '../../utils/format.js'

export default function ResultPage() {
  const { attemptId } = useParams()
  const location = useLocation()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get(`/attempts/${attemptId}/result/`)
      .then(({ data }) => setResult(data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [attemptId])

  if (loading) return <LoadingScreen label="Marking your paper" />
  if (!result) return <Alert>{error || 'Result not found.'}</Alert>

  const autoSubmitted = location.state?.auto || result.status === 'expired'

  return (
    <div className="animate-rise mx-auto max-w-4xl">
      <Link to="/my-results" className="btn-subtle mb-5 -ml-2 px-2 py-1.5 text-xs">
        <IconArrowLeft size={15} /> My results
      </Link>

      {autoSubmitted && (
        <div className="mb-4">
          <Alert tone="amber">
            Your time ran out, so the assessment was submitted automatically with the answers saved
            at that point.
          </Alert>
        </div>
      )}

      <div className="surface-raised relative overflow-hidden p-7">
        <div
          className={`pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full blur-3xl ${
            result.passed ? 'bg-emerald-500/15' : 'bg-rose-500/12'
          }`}
        />

        <div className="relative flex flex-col items-center gap-7 sm:flex-row sm:items-center sm:gap-9">
          <ScoreRing percentage={result.percentage} passed={result.passed} />

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300/80">
              Assessment complete
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight text-white">
              {result.test_title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <StatusBadge status={result.status} />
              <Badge tone={result.passed ? 'green' : 'rose'}>
                {result.passed ? 'Above pass mark' : 'Below pass mark'}
              </Badge>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <Figure value={`${result.score}/${result.max_score}`} label="Marks" />
              <Figure value={formatDuration(result.duration_taken)} label="Time taken" />
              <Figure value={formatDate(result.submitted_at).split(',')[0]} label="Submitted" />
            </div>
          </div>
        </div>
      </div>

      {!result.results_visible ? (
        <Card className="mt-5">
          <div className="flex items-start gap-3">
            <IconClock size={20} className="mt-0.5 shrink-0 text-brand-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Results are being held</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                Your answers were recorded. The recruitment team will release the outcome for this
                assessment.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="mt-8">
          <SectionTitle
            eyebrow="Breakdown"
            title="Question review"
            description="How each of your answers was marked."
          />

          <div className="space-y-3">
            {result.review.map((item) => (
              <div
                key={item.question_id}
                className={`surface-raised p-5 ${
                  item.is_correct ? 'border-emerald-400/20' : 'border-rose-400/20'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold ${
                      item.is_correct
                        ? 'bg-emerald-500/18 text-emerald-300'
                        : 'bg-rose-500/18 text-rose-300'
                    }`}
                  >
                    {item.number}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-[15px] leading-relaxed text-slate-100">{item.text}</p>
                      <Badge tone={item.is_correct ? 'green' : 'rose'}>
                        {item.is_correct ? <IconCheck size={12} /> : <IconX size={12} />}
                        {item.points_awarded}/{item.points}
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-1.5 text-[13px]">
                      <p className="text-slate-400">
                        <span className="text-slate-500">Your answer: </span>
                        <span className={item.is_correct ? 'text-emerald-300' : 'text-rose-300'}>
                          {item.your_answer || 'Not answered'}
                        </span>
                      </p>
                      {!item.is_correct && (
                        <p className="text-slate-400">
                          <span className="text-slate-500">Correct answer: </span>
                          <span className="text-emerald-300">{item.correct_answer}</span>
                        </p>
                      )}
                      {item.explanation && (
                        <p className="mt-2 rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-[13px] leading-relaxed text-slate-400">
                          {item.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Figure({ value, label }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3">
      <p className="text-base font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </div>
  )
}
