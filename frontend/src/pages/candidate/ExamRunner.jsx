import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api, { errorMessage } from '../../api/client.js'
import Calculator from '../../components/Calculator.jsx'
import {
  IconAlert,
  IconCalculator,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconFlag,
} from '../../components/Icons.jsx'
import { Alert, LoadingScreen, Modal, Spinner } from '../../components/ui.jsx'
import { formatClock } from '../../utils/format.js'

const emptyAnswer = { selected: [], text: '', flagged: false }

export default function ExamRunner() {
  const { attemptId } = useParams()
  const navigate = useNavigate()

  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [remaining, setRemaining] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState('idle')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [zoomed, setZoomed] = useState(null)

  const deadlineRef = useRef(null)
  const textTimers = useRef({})
  const submittedRef = useRef(false)

  // -- load the attempt --------------------------------------------------
  useEffect(() => {
    let cancelled = false
    api
      .get(`/attempts/${attemptId}/`)
      .then(({ data }) => {
        if (cancelled) return
        if (data.status && data.status !== 'in_progress') {
          navigate(`/results/${attemptId}`, { replace: true })
          return
        }
        setAttempt(data)
        const saved = {}
        for (const answer of data.answers || []) {
          saved[answer.question] = {
            selected: answer.selected_choices || [],
            text: answer.text_answer || '',
            flagged: answer.flagged || false,
          }
        }
        setAnswers(saved)
        deadlineRef.current = Date.now() + (data.remaining_seconds ?? 0) * 1000
        setRemaining(data.remaining_seconds ?? 0)
      })
      .catch((err) => setError(errorMessage(err, 'This attempt could not be opened.')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [attemptId, navigate])

  // -- countdown ---------------------------------------------------------
  const finish = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return
      submittedRef.current = true
      setSubmitting(true)
      try {
        await api.post(`/attempts/${attemptId}/submit/`)
        navigate(`/results/${attemptId}`, { replace: true, state: { auto } })
      } catch (err) {
        submittedRef.current = false
        setSubmitting(false)
        setError(errorMessage(err, 'Submission failed. Check your connection and retry.'))
      }
    },
    [attemptId, navigate],
  )

  useEffect(() => {
    if (!attempt) return
    const tick = () => {
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) finish(true)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [attempt, finish])

  // warn on accidental close
  useEffect(() => {
    const guard = (event) => {
      if (submittedRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [])

  useEffect(() => () => Object.values(textTimers.current).forEach(clearTimeout), [])

  // -- saving ------------------------------------------------------------
  const persist = useCallback(
    async (questionId, payload) => {
      setSaveState('saving')
      try {
        await api.post(`/attempts/${attemptId}/answer/`, { question: questionId, ...payload })
        setSaveState('saved')
      } catch (err) {
        setSaveState('error')
        setError(errorMessage(err, 'An answer could not be saved.'))
      }
    },
    [attemptId],
  )

  const questions = attempt?.questions || []
  const current = questions[index]
  const answerFor = (id) => answers[id] || emptyAnswer

  const isAnswered = useCallback(
    (question) => {
      const answer = answers[question.id]
      if (!answer) return false
      return question.type === 'short_text'
        ? Boolean(answer.text.trim())
        : answer.selected.length > 0
    },
    [answers],
  )

  const answeredCount = useMemo(
    () => questions.filter(isAnswered).length,
    [questions, isAnswered],
  )
  const flaggedCount = useMemo(
    () => questions.filter((q) => answers[q.id]?.flagged).length,
    [questions, answers],
  )

  const chooseOption = (question, choiceId) => {
    const existing = answerFor(question.id)
    let selected
    if (question.type === 'multiple') {
      selected = existing.selected.includes(choiceId)
        ? existing.selected.filter((id) => id !== choiceId)
        : [...existing.selected, choiceId]
    } else {
      selected = existing.selected[0] === choiceId ? [] : [choiceId]
    }
    setAnswers((prev) => ({ ...prev, [question.id]: { ...existing, selected } }))
    persist(question.id, { selected_choices: selected })
  }

  const typeAnswer = (question, text) => {
    const existing = answerFor(question.id)
    setAnswers((prev) => ({ ...prev, [question.id]: { ...existing, text } }))
    setSaveState('saving')
    clearTimeout(textTimers.current[question.id])
    textTimers.current[question.id] = setTimeout(
      () => persist(question.id, { text_answer: text }),
      650,
    )
  }

  const toggleFlag = (question) => {
    const existing = answerFor(question.id)
    const flagged = !existing.flagged
    setAnswers((prev) => ({ ...prev, [question.id]: { ...existing, flagged } }))
    persist(question.id, { flagged })
  }

  if (loading) return <LoadingScreen label="Opening your paper" />
  if (!attempt)
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <Alert>{error || 'Attempt not found.'}</Alert>
      </div>
    )

  const backtracking = attempt.test.allow_backtracking
  const total = questions.length
  const progress = total ? (answeredCount / total) * 100 : 0
  const urgent = remaining !== null && remaining <= 60
  const warning = remaining !== null && remaining <= 300 && !urgent

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* ---- top bar ---- */}
      <header className="z-20 shrink-0 border-b border-white/8 bg-ink-950/85 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
          <div className="min-w-0 flex-1">
            <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-300/80 sm:block">
              Assessment in progress
            </p>
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-white sm:text-base">
              {attempt.test.title}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <SaveIndicator state={saveState} />

            {attempt.test.allow_calculator && (
              <button
                onClick={() => setCalculatorOpen((open) => !open)}
                title="On-screen calculator"
                className={`btn px-2.5 py-2 text-[13px] sm:px-3 ${
                  calculatorOpen
                    ? 'border border-brand-400/45 bg-brand-500/18 text-brand-200'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <IconCalculator size={16} />
                <span className="hidden sm:inline">Calculator</span>
              </button>
            )}

            <div
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 font-mono text-sm font-semibold tabular-nums transition-colors sm:gap-2 sm:px-3 sm:text-lg ${
                urgent
                  ? 'animate-pulse-ring border-rose-400/40 bg-rose-500/15 text-rose-200'
                  : warning
                    ? 'border-amber-400/35 bg-amber-500/12 text-amber-200'
                    : 'border-white/10 bg-white/5 text-slate-100'
              }`}
            >
              <IconClock size={16} />
              {formatClock(remaining)}
            </div>

            <button
              onClick={() => setConfirming(true)}
              className="btn-primary px-3 py-2 text-[13px] sm:px-4"
            >
              Submit
            </button>
          </div>
        </div>

        <div className="h-[3px] w-full bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-violet-glow transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---- question panel ---- */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-3 py-5 sm:px-8 sm:py-9">
            {error && (
              <div className="mb-5">
                <Alert>{error}</Alert>
              </div>
            )}

            {current && (
              <div key={current.id} className="animate-rise">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-glow text-sm font-bold text-white shadow-[0_10px_26px_-12px_rgba(99,102,241,0.9)]">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Question {index + 1} of {total}
                      </p>
                      <p className="text-xs text-slate-400">
                        {current.points} mark{current.points > 1 ? 's' : ''} ·{' '}
                        {current.type === 'multiple'
                          ? 'Select all that apply'
                          : current.type === 'short_text'
                            ? 'Type your answer'
                            : 'Select one answer'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleFlag(current)}
                    className={`btn px-3 py-2 text-xs ${
                      answerFor(current.id).flagged
                        ? 'border border-amber-400/35 bg-amber-500/15 text-amber-200'
                        : 'border border-white/10 bg-white/4 text-slate-300 hover:bg-white/8'
                    }`}
                  >
                    <IconFlag size={14} />
                    <span className="hidden sm:inline">
                      {answerFor(current.id).flagged ? 'Flagged' : 'Flag'}
                    </span>
                  </button>
                </div>

                <div className="surface-raised mt-4 p-4 sm:mt-5 sm:p-7">
                  <p className="whitespace-pre-line text-[16px] leading-relaxed text-slate-100 sm:text-[17px]">
                    {current.text}
                  </p>
                  {current.hint && (
                    <p className="mt-2.5 text-[13px] italic text-slate-500">{current.hint}</p>
                  )}

                  {current.image_url && (
                    <figure className="mt-4">
                      <img
                        src={current.image_url}
                        alt={current.image_caption || 'Figure for this question'}
                        onClick={() => setZoomed(current.image_url)}
                        className="max-h-[46vh] w-full cursor-zoom-in rounded-xl border border-white/10 bg-white object-contain p-2"
                      />
                      <figcaption className="mt-1.5 text-center text-xs text-slate-500">
                        {current.image_caption || 'Tap the figure to enlarge'}
                      </figcaption>
                    </figure>
                  )}

                  <div className="mt-6 space-y-2.5">
                    {current.type === 'short_text' ? (
                      <input
                        className="field text-base"
                        placeholder="Type your answer here"
                        value={answerFor(current.id).text}
                        onChange={(e) => typeAnswer(current, e.target.value)}
                      />
                    ) : (
                      current.choices.map((choice, i) => {
                        const selected = answerFor(current.id).selected.includes(choice.id)
                        const multiple = current.type === 'multiple'
                        return (
                          <button
                            key={choice.id}
                            onClick={() => chooseOption(current, choice.id)}
                            className={`flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-all duration-200 ${
                              selected
                                ? 'border-brand-400/55 bg-gradient-to-r from-brand-500/18 to-violet-glow/8 shadow-[0_0_0_1px_rgba(129,140,248,0.25)]'
                                : 'border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/6'
                            }`}
                          >
                            <span
                              className={`grid h-6 w-6 shrink-0 place-items-center border text-[11px] font-bold transition-all ${
                                multiple ? 'rounded-md' : 'rounded-full'
                              } ${
                                selected
                                  ? 'border-transparent bg-gradient-to-br from-brand-500 to-violet-glow text-white'
                                  : 'border-white/20 bg-transparent text-slate-500'
                              }`}
                            >
                              {selected ? <IconCheck size={13} /> : String.fromCharCode(65 + i)}
                            </span>
                            <span
                              className={`text-[15px] leading-relaxed ${
                                selected ? 'text-white' : 'text-slate-300'
                              }`}
                            >
                              {choice.text}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    disabled={index === 0 || !backtracking}
                    className="btn-ghost px-4 py-2.5 text-[13px]"
                  >
                    <IconChevronLeft size={16} /> Previous
                  </button>

                  {index === total - 1 ? (
                    <button onClick={() => setConfirming(true)} className="btn-primary px-5 py-2.5 text-[13px]">
                      Review &amp; submit
                    </button>
                  ) : (
                    <button
                      onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                      className="btn-primary px-5 py-2.5 text-[13px]"
                    >
                      Next <IconChevronRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ---- question navigator: fixed strip along the bottom ---- */}
      <footer className="z-20 shrink-0 border-t border-white/8 bg-ink-900/70 backdrop-blur-xl">
        <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-3">
          <div className="flex shrink-0 items-center gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Progress
              </p>
              <p className="text-[13px] font-semibold text-white sm:text-sm">
                {answeredCount}
                <span className="text-slate-500">/{total} answered</span>
              </p>
            </div>
            <div className="hidden gap-3 text-[10px] text-slate-500 lg:flex">
              <Legend className="bg-emerald-400" label={`${answeredCount} done`} />
              <Legend className="bg-slate-600" label={`${total - answeredCount} open`} />
              <Legend className="bg-amber-400" label={`${flaggedCount} flagged`} />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 sm:justify-center">
            {questions.map((question, i) => {
              const answered = isAnswered(question)
              const flagged = answers[question.id]?.flagged
              const active = i === index
              const locked = !backtracking && i < index

              return (
                <button
                  key={question.id}
                  disabled={locked}
                  onClick={() => setIndex(i)}
                  title={
                    locked
                      ? 'Going back is disabled for this test'
                      : `Question ${i + 1} — ${answered ? 'answered' : 'not answered'}`
                  }
                  className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-[13px] font-bold tabular-nums transition-all duration-200 sm:h-10 sm:w-10 ${
                    active
                      ? 'scale-105 border-transparent bg-gradient-to-br from-brand-500 to-violet-glow text-white shadow-[0_10px_24px_-10px_rgba(99,102,241,0.95)]'
                      : answered
                        ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200 hover:border-emerald-400/60'
                        : 'border-white/10 bg-white/4 text-slate-400 hover:border-white/25 hover:text-slate-100'
                  } ${locked ? 'cursor-not-allowed opacity-35' : ''}`}
                >
                  {i + 1}
                  {flagged && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-amber-400 text-ink-950">
                      <IconFlag size={9} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0 || !backtracking}
              className="btn-ghost px-2.5 py-2"
              title="Previous question"
            >
              <IconChevronLeft size={16} />
            </button>
            <button
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
              disabled={index === total - 1}
              className="btn-ghost px-2.5 py-2"
              title="Next question"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>
      </footer>

      {attempt.test.allow_calculator && calculatorOpen && (
        <Calculator onClose={() => setCalculatorOpen(false)} />
      )}

      {zoomed && (
        <div
          onClick={() => setZoomed(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-ink-950/90 p-4 backdrop-blur-sm"
        >
          <img
            src={zoomed}
            alt="Enlarged figure"
            className="max-h-full max-w-full rounded-xl bg-white object-contain p-2"
          />
        </div>
      )}

      <Modal
        open={confirming}
        onClose={() => !submitting && setConfirming(false)}
        title="Submit your assessment?"
        description="Once submitted you cannot change your answers."
        footer={
          <>
            <button onClick={() => setConfirming(false)} disabled={submitting} className="btn-ghost">
              Keep working
            </button>
            <button onClick={() => finish(false)} disabled={submitting} className="btn-primary">
              {submitting ? <Spinner size={16} /> : 'Submit now'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-3 gap-3">
          <SummaryTile value={answeredCount} label="Answered" tone="text-emerald-300" />
          <SummaryTile value={total - answeredCount} label="Unanswered" tone="text-rose-300" />
          <SummaryTile value={flaggedCount} label="Flagged" tone="text-amber-300" />
        </div>
        {total - answeredCount > 0 && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-3 text-[13px] text-amber-100">
            <IconAlert size={17} className="mt-0.5 shrink-0" />
            <span>
              {total - answeredCount} question{total - answeredCount > 1 ? 's are' : ' is'} still
              unanswered. Unanswered questions score zero.
            </span>
          </div>
        )}
        <p className="mt-4 text-center text-xs text-slate-500">
          Time remaining: <span className="font-mono text-slate-300">{formatClock(remaining)}</span>
        </p>
      </Modal>
    </div>
  )
}

function Legend({ className, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${className}`} />
      <span className="truncate">{label}</span>
    </div>
  )
}

function SummaryTile({ value, label, tone }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3.5 text-center">
      <p className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </div>
  )
}

function SaveIndicator({ state }) {
  if (state === 'idle') return null
  const map = {
    saving: ['text-slate-400', 'Saving…'],
    saved: ['text-emerald-300', 'Saved'],
    error: ['text-rose-300', 'Not saved'],
  }
  const [tone, label] = map[state]
  return (
    <span className={`hidden items-center gap-1.5 text-xs font-medium sm:flex ${tone}`}>
      {state === 'saving' ? <Spinner size={12} /> : <IconCheck size={14} />}
      {label}
    </span>
  )
}
