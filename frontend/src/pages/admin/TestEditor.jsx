import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api, { errorMessage } from '../../api/client.js'
import ImportQuestionsModal from '../../components/ImportQuestionsModal.jsx'
import {
  IconAlert,
  IconArrowLeft,
  IconCalculator,
  IconCamera,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconImage,
  IconList,
  IconPlus,
  IconSave,
  IconSettings,
  IconSparkle,
  IconTrash,
} from '../../components/Icons.jsx'
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  LoadingScreen,
  Select,
  Spinner,
  StatusBadge,
  Textarea,
  Toggle,
} from '../../components/ui.jsx'
import { QUESTION_TYPES } from '../../utils/format.js'

let keyCounter = 0
const nextKey = () => `new-${++keyCounter}`

const blankChoice = (text = '') => ({ _key: nextKey(), text, is_correct: false })

const blankQuestion = () => ({
  _key: nextKey(),
  type: 'single',
  text: '',
  hint: '',
  points: 1,
  image: '',
  image_caption: '',
  image_url: '',
  accepted_answers: '',
  explanation: '',
  choices: [blankChoice(), blankChoice(), blankChoice(), blankChoice()],
})

const blankTest = {
  title: '',
  description: '',
  instructions: '',
  status: 'draft',
  duration_minutes: 30,
  question_count: 0,
  pass_mark: 50,
  max_attempts: 1,
  shuffle_questions: false,
  shuffle_choices: false,
  allow_backtracking: true,
  show_result_immediately: true,
  allow_calculator: false,
  proctoring_enabled: false,
  require_camera: false,
  require_fullscreen: false,
  flag_tab_switching: false,
  snapshot_interval_seconds: 30,
  questions: [],
}

const TABS = [
  { id: 'setup', label: 'Setup', icon: IconSettings },
  { id: 'questions', label: 'Questions', icon: IconList },
  { id: 'proctoring', label: 'Proctoring', icon: IconCamera },
]

export default function TestEditor() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const isNew = !testId

  const [test, setTest] = useState(isNew ? blankTest : null)
  const [loading, setLoading] = useState(!isNew)
  const [tab, setTab] = useState('setup')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (isNew) return
    api
      .get(`/admin/tests/${testId}/`)
      .then(({ data }) => {
        data.questions = data.questions.map((q) => ({
          ...q,
          _key: `q-${q.id}`,
          choices: q.choices.map((c) => ({ ...c, _key: `c-${c.id}` })),
        }))
        setTest(data)
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [testId, isNew])

  const set = (patch) => setTest((prev) => ({ ...prev, ...patch }))

  const setQuestion = (key, patch) =>
    setTest((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q._key === key ? { ...q, ...patch } : q)),
    }))

  const totals = useMemo(() => {
    if (!test) return { pool: 0, served: 0, marks: 0 }
    const pool = test.questions.length
    const served = test.question_count ? Math.min(test.question_count, pool) : pool
    const marks = test.questions
      .slice(0, served)
      .reduce((sum, q) => sum + (Number(q.points) || 0), 0)
    return { pool, served, marks }
  }, [test])

  // -- question operations ----------------------------------------------
  const addQuestion = () => {
    setTest((prev) => ({ ...prev, questions: [...prev.questions, blankQuestion()] }))
    setTab('questions')
    requestAnimationFrame(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }),
    )
  }

  const removeQuestion = (key) =>
    setTest((prev) => ({ ...prev, questions: prev.questions.filter((q) => q._key !== key) }))

  /** Append questions read out of an uploaded document. */
  const importQuestions = (incoming) => {
    const prepared = incoming.map((question) => ({
      _key: nextKey(),
      type: question.type,
      text: question.text,
      hint: question.hint || '',
      points: question.points || 1,
      image: question.image || '',
      image_caption: question.image_caption || '',
      // FIX: use the absolute image_url the backend now returns for each
      // imported question, instead of hand-building "/media/<path>" here.
      // That manual prefix was a relative URL, which the browser resolves
      // against the FRONTEND's own domain (Vercel) instead of the Django
      // backend (Render) — the root cause of the 404s and the
      // "media/media/..." duplication once it got saved and re-served.
      image_url: question.image_url || '',
      accepted_answers: question.accepted_answers || '',
      explanation: question.explanation || '',
      choices: (question.choices || []).map((choice) => ({
        _key: nextKey(),
        text: choice.text,
        is_correct: !!choice.is_correct,
      })),
    }))
    setTest((prev) => ({ ...prev, questions: [...prev.questions, ...prepared] }))
    setTab('questions')
    setNotice(
      `${prepared.length} question${prepared.length === 1 ? '' : 's'} added from your document — review them, then save.`,
    )
    setError('')
  }

  const moveQuestion = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= test.questions.length) return
    const questions = [...test.questions]
    ;[questions[index], questions[target]] = [questions[target], questions[index]]
    set({ questions })
  }

  const changeType = (question, type) => {
    let choices = question.choices
    if (type === 'true_false') {
      choices = [
        { ...blankChoice('True'), is_correct: question.choices[0]?.is_correct || false },
        { ...blankChoice('False'), is_correct: question.choices[1]?.is_correct || false },
      ]
    } else if (type === 'single' && question.type === 'multiple') {
      let seen = false
      choices = question.choices.map((c) => {
        const keep = c.is_correct && !seen
        if (keep) seen = true
        return { ...c, is_correct: keep }
      })
    } else if (
      (type === 'single' || type === 'multiple') &&
      (question.type === 'true_false' || question.type === 'short_text')
    ) {
      choices = [blankChoice(), blankChoice(), blankChoice(), blankChoice()]
    }
    setQuestion(question._key, { type, choices })
  }

  const toggleCorrect = (question, choiceKey) =>
    setQuestion(question._key, {
      choices: question.choices.map((c) => ({
        ...c,
        is_correct:
          question.type === 'multiple'
            ? c._key === choiceKey
              ? !c.is_correct
              : c.is_correct
            : c._key === choiceKey,
      })),
    })

  // -- persistence -------------------------------------------------------
  const validate = () => {
    if (!test.title.trim()) return 'Give the test a title before saving.'
    for (const [i, question] of test.questions.entries()) {
      if (!question.text.trim()) return `Question ${i + 1} has no text.`
      if (question.type === 'short_text') {
        if (!question.accepted_answers.trim())
          return `Question ${i + 1} needs at least one accepted answer.`
        continue
      }
      const filled = question.choices.filter((c) => c.text.trim())
      if (filled.length < 2) return `Question ${i + 1} needs at least two options.`
      if (!filled.some((c) => c.is_correct))
        return `Question ${i + 1} has no option marked as correct.`
    }
    return ''
  }

  const save = async ({ publish } = {}) => {
    const problem = validate()
    if (problem) {
      setError(problem)
      setNotice('')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      ...test,
      duration_minutes: Number(test.duration_minutes) || 1,
      question_count: Number(test.question_count) || 0,
      pass_mark: Number(test.pass_mark) || 0,
      max_attempts: Number(test.max_attempts) || 1,
      snapshot_interval_seconds: Number(test.snapshot_interval_seconds) || 30,
      questions: test.questions.map((question, order) => ({
        ...(String(question.id).match(/^\d+$/) ? { id: question.id } : {}),
        order,
        type: question.type,
        text: question.text,
        hint: question.hint || '',
        points: Number(question.points) || 1,
        image: question.image || '',
        image_caption: question.image_caption || '',
        accepted_answers: question.type === 'short_text' ? question.accepted_answers : '',
        explanation: question.explanation || '',
        choices:
          question.type === 'short_text'
            ? []
            : question.choices
                .filter((c) => c.text.trim())
                .map((choice, choiceOrder) => ({
                  ...(String(choice.id).match(/^\d+$/) ? { id: choice.id } : {}),
                  order: choiceOrder,
                  text: choice.text,
                  is_correct: !!choice.is_correct,
                })),
      })),
    }
    if (publish) payload.status = 'published'

    try {
      const { data } = isNew
        ? await api.post('/admin/tests/', payload)
        : await api.put(`/admin/tests/${testId}/`, payload)

      if (isNew) {
        navigate(`/admin/tests/${data.id}`, { replace: true })
        return
      }
      data.questions = data.questions.map((q) => ({
        ...q,
        _key: `q-${q.id}`,
        choices: q.choices.map((c) => ({ ...c, _key: `c-${c.id}` })),
      }))
      setTest(data)
      setNotice(publish ? 'Test published — candidates can now sit it.' : 'Changes saved.')
    } catch (err) {
      setError(errorMessage(err, 'The test could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  const unpublish = async () => {
    try {
      const { data } = await api.post(`/admin/tests/${testId}/unpublish/`)
      set({ status: data.status })
      setNotice('Test moved back to draft.')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (loading) return <LoadingScreen label="Loading test" />
  if (!test) return <Alert>{error || 'Test not found.'}</Alert>

  return (
    <div className="animate-rise">
      <Link to="/admin/tests" className="btn-subtle mb-4 -ml-2 px-2 py-1.5 text-xs">
        <IconArrowLeft size={15} /> All tests
      </Link>

      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[240px] flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {test.title || 'Untitled test'}
            </h1>
            <StatusBadge status={test.status} />
          </div>
          <p className="mt-1.5 text-sm text-slate-400">
            {totals.pool} question{totals.pool === 1 ? '' : 's'} in the pool · {totals.served}{' '}
            served per candidate · {totals.marks} mark{totals.marks === 1 ? '' : 's'} ·{' '}
            {test.duration_minutes} minutes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isNew && test.status === 'published' ? (
            <button onClick={unpublish} className="btn-ghost">
              Unpublish
            </button>
          ) : (
            !isNew && (
              <button onClick={() => save({ publish: true })} disabled={saving} className="btn-ghost">
                <IconSparkle size={16} /> Save &amp; publish
              </button>
            )
          )}
          <button onClick={() => save()} disabled={saving} className="btn-primary">
            {saving ? <Spinner size={16} /> : <IconSave size={16} />}
            {isNew ? 'Create test' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Alert tone="green">{notice}</Alert>
        </div>
      )}

      {/* tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-white/3 p-1">
        {TABS.map(({ id, label, icon: Glyph }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition ${
              tab === id
                ? 'bg-gradient-to-r from-brand-500/25 to-violet-glow/12 text-white shadow-[inset_0_0_0_1px_rgba(129,140,248,0.22)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Glyph size={16} />
            {label}
            {id === 'questions' && (
              <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[11px] tabular-nums">
                {totals.pool}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'setup' && <SetupTab test={test} set={set} totals={totals} />}

      {tab === 'questions' && (
        <QuestionsTab
          test={test}
          setQuestion={setQuestion}
          changeType={changeType}
          toggleCorrect={toggleCorrect}
          removeQuestion={removeQuestion}
          moveQuestion={moveQuestion}
          addQuestion={addQuestion}
          openImport={() => setImporting(true)}
        />
      )}

      {tab === 'proctoring' && <ProctoringTab test={test} set={set} />}

      <ImportQuestionsModal
        open={importing}
        onClose={() => setImporting(false)}
        onImport={importQuestions}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function SetupTab({ test, set, totals }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-4">
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
            Test details
          </h3>
          <div className="space-y-4">
            <Field label="Title">
              <Input
                placeholder="e.g. Graduate Trainee Aptitude Test"
                value={test.title}
                onChange={(e) => set({ title: e.target.value })}
              />
            </Field>
            <Field label="Short description" hint="Shown on the candidate's test card.">
              <Textarea
                rows={2}
                value={test.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </Field>
            <Field label="Instructions" hint="Shown on the briefing screen before the timer starts.">
              <Textarea
                rows={6}
                value={test.instructions}
                onChange={(e) => set({ instructions: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
            Timing &amp; scoring
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration (minutes)" hint="Total time for the whole paper.">
              <Input
                type="number"
                min="1"
                value={test.duration_minutes}
                onChange={(e) => set({ duration_minutes: e.target.value })}
              />
            </Field>
            <Field
              label="Questions per candidate"
              hint={`0 = serve all. Pool currently holds ${totals.pool}.`}
            >
              <Input
                type="number"
                min="0"
                value={test.question_count}
                onChange={(e) => set({ question_count: e.target.value })}
              />
            </Field>
            <Field label="Pass mark (%)">
              <Input
                type="number"
                min="0"
                max="100"
                value={test.pass_mark}
                onChange={(e) => set({ pass_mark: e.target.value })}
              />
            </Field>
            <Field label="Attempts allowed">
              <Input
                type="number"
                min="1"
                value={test.max_attempts}
                onChange={(e) => set({ max_attempts: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
            Behaviour
          </h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Toggle
              label="Shuffle questions"
              description="Randomise question order per candidate."
              checked={test.shuffle_questions}
              onChange={(v) => set({ shuffle_questions: v })}
            />
            <Toggle
              label="Shuffle options"
              description="Randomise the order of answer options."
              checked={test.shuffle_choices}
              onChange={(v) => set({ shuffle_choices: v })}
            />
            <Toggle
              label="Allow backtracking"
              description="Let candidates return to earlier questions."
              checked={test.allow_backtracking}
              onChange={(v) => set({ allow_backtracking: v })}
            />
            <Toggle
              label="Show results immediately"
              description="Reveal the score and review as soon as they submit."
              checked={test.show_result_immediately}
              onChange={(v) => set({ show_result_immediately: v })}
            />
            <Toggle
              label="On-screen calculator"
              description="Give candidates a calculator they can open during this test."
              checked={test.allow_calculator}
              onChange={(v) => set({ allow_calculator: v })}
            />
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="sticky top-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
            Summary
          </h3>
          <dl className="space-y-3 text-sm">
            <Row icon={<IconClock size={15} />} label="Duration" value={`${test.duration_minutes} min`} />
            <Row icon={<IconList size={15} />} label="Question pool" value={totals.pool} />
            <Row icon={<IconList size={15} />} label="Served per candidate" value={totals.served} />
            <Row icon={<IconCheck size={15} />} label="Total marks" value={totals.marks} />
            <Row icon={<IconCheck size={15} />} label="Pass mark" value={`${test.pass_mark}%`} />
            <Row
              icon={<IconCalculator size={15} />}
              label="Calculator"
              value={test.allow_calculator ? 'Allowed' : 'Not allowed'}
            />
            <Row
              icon={<IconCamera size={15} />}
              label="Proctoring"
              value={test.proctoring_enabled ? 'On' : 'Off'}
            />
          </dl>

          {totals.pool > 0 && (
            <p className="mt-5 rounded-xl border border-white/8 bg-white/3 px-3.5 py-3 text-xs leading-relaxed text-slate-400">
              Candidates get roughly{' '}
              <span className="font-semibold text-slate-200">
                {Math.round(((test.duration_minutes || 0) * 60) / Math.max(totals.served, 1))}s
              </span>{' '}
              per question at this setting.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2.5 last:border-0 last:pb-0">
      <dt className="flex items-center gap-2 text-slate-400">
        <span className="text-brand-300">{icon}</span>
        {label}
      </dt>
      <dd className="font-semibold text-white">{value}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function QuestionsTab({
  test,
  setQuestion,
  changeType,
  toggleCorrect,
  removeQuestion,
  moveQuestion,
  addQuestion,
  openImport,
}) {
  if (!test.questions.length) {
    return (
      <div className="surface flex flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-brand-300">
          <IconList size={26} />
        </div>
        <h3 className="text-base font-semibold text-white">No questions yet</h3>
        <p className="max-w-md text-sm text-slate-400">
          Write them here, or upload a PDF or Word paper and have the questions read out of it
          automatically. Candidates answer them in this order.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button onClick={openImport} className="btn-primary">
            <IconSparkle size={16} /> Import from document
          </button>
          <button onClick={addQuestion} className="btn-ghost">
            <IconPlus size={16} /> Add manually
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {test.questions.length} question{test.questions.length === 1 ? '' : 's'} in this paper
        </p>
        <button onClick={openImport} className="btn-ghost text-[13px]">
          <IconSparkle size={15} /> Import from document
        </button>
      </div>

      {test.questions.map((question, index) => (
        <QuestionCard
          key={question._key}
          question={question}
          index={index}
          total={test.questions.length}
          setQuestion={setQuestion}
          changeType={changeType}
          toggleCorrect={toggleCorrect}
          removeQuestion={removeQuestion}
          moveQuestion={moveQuestion}
        />
      ))}

      <button
        onClick={addQuestion}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/12 bg-white/2 py-5 text-sm font-semibold text-slate-400 transition hover:border-brand-400/40 hover:bg-brand-500/6 hover:text-brand-200"
      >
        <IconPlus size={17} /> Add question
      </button>
    </div>
  )
}

function QuestionCard({
  question,
  index,
  total,
  setQuestion,
  changeType,
  toggleCorrect,
  removeQuestion,
  moveQuestion,
}) {
  const isChoice = question.type !== 'short_text'
  const locked = question.type === 'true_false'

  const setChoice = (choiceKey, patch) =>
    setQuestion(question._key, {
      choices: question.choices.map((c) => (c._key === choiceKey ? { ...c, ...patch } : c)),
    })

  const addChoice = () =>
    setQuestion(question._key, { choices: [...question.choices, blankChoice()] })

  const removeChoice = (choiceKey) =>
    setQuestion(question._key, {
      choices: question.choices.filter((c) => c._key !== choiceKey),
    })

  return (
    <Card className="group">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-glow text-sm font-bold text-white">
            {index + 1}
          </span>
          <Badge tone="slate">
            {QUESTION_TYPES.find((t) => t.value === question.type)?.label}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => moveQuestion(index, -1)}
            disabled={index === 0}
            title="Move up"
            className="btn-ghost rotate-90 px-2 py-1.5"
          >
            <IconChevronLeft size={15} />
          </button>
          <button
            onClick={() => moveQuestion(index, 1)}
            disabled={index === total - 1}
            title="Move down"
            className="btn-ghost rotate-90 px-2 py-1.5"
          >
            <IconChevronRight size={15} />
          </button>
          <button
            onClick={() => removeQuestion(question._key)}
            title="Remove question"
            className="btn-danger px-2 py-1.5"
          >
            <IconTrash size={15} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_180px_110px]">
        <Field label="Question">
          <Textarea
            rows={2}
            placeholder="Type the question as candidates will read it…"
            value={question.text}
            onChange={(e) => setQuestion(question._key, { text: e.target.value })}
          />
        </Field>
        <Field label="Type">
          <Select value={question.type} onChange={(e) => changeType(question, e.target.value)}>
            {QUESTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Marks">
          <Input
            type="number"
            min="1"
            value={question.points}
            onChange={(e) => setQuestion(question._key, { points: e.target.value })}
          />
        </Field>
      </div>

      {isChoice ? (
        <div className="mt-2">
          <p className="label">
            Options —{' '}
            {question.type === 'multiple' ? 'tick every correct answer' : 'tick the correct answer'}
          </p>
          <div className="space-y-2">
            {question.choices.map((choice, choiceIndex) => (
              <div key={choice._key} className="flex items-center gap-2.5">
                <button
                  onClick={() => toggleCorrect(question, choice._key)}
                  title="Mark as correct"
                  className={`grid h-8 w-8 shrink-0 place-items-center border text-[11px] font-bold transition-all ${
                    question.type === 'multiple' ? 'rounded-lg' : 'rounded-full'
                  } ${
                    choice.is_correct
                      ? 'border-transparent bg-gradient-to-br from-emerald-500 to-emerald-400 text-white shadow-[0_8px_20px_-10px_rgba(52,211,153,0.9)]'
                      : 'border-white/15 text-slate-500 hover:border-white/30'
                  }`}
                >
                  {choice.is_correct ? (
                    <IconCheck size={14} />
                  ) : (
                    String.fromCharCode(65 + choiceIndex)
                  )}
                </button>

                <input
                  className="field"
                  readOnly={locked}
                  placeholder={`Option ${String.fromCharCode(65 + choiceIndex)}`}
                  value={choice.text}
                  onChange={(e) => setChoice(choice._key, { text: e.target.value })}
                />

                {!locked && question.choices.length > 2 && (
                  <button
                    onClick={() => removeChoice(choice._key)}
                    className="btn-subtle px-2 py-2 opacity-0 transition group-hover:opacity-100"
                    title="Remove option"
                  >
                    <IconTrash size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!locked && (
            <button onClick={addChoice} className="btn-subtle mt-2 px-2 py-1.5 text-xs">
              <IconPlus size={14} /> Add option
            </button>
          )}
        </div>
      ) : (
        <Field
          label="Accepted answers"
          hint="One per line. Matching ignores case and surrounding spaces."
        >
          <Textarea
            rows={3}
            placeholder={'key performance indicator\nkey performance indicators'}
            value={question.accepted_answers}
            onChange={(e) => setQuestion(question._key, { accepted_answers: e.target.value })}
          />
        </Field>
      )}

      <QuestionImage question={question} setQuestion={setQuestion} />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Hint" hint="Optional line shown under the question.">
          <Input
            value={question.hint}
            onChange={(e) => setQuestion(question._key, { hint: e.target.value })}
          />
        </Field>
        <Field label="Explanation" hint="Optional — shown in the review after marking.">
          <Input
            value={question.explanation}
            onChange={(e) => setQuestion(question._key, { explanation: e.target.value })}
          />
        </Field>
      </div>
    </Card>
  )
}

/** Attach a graph, chart or diagram to a question. */
function QuestionImage({ question, setQuestion }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    setProblem('')
    try {
      const form = new FormData()
      form.append('image', file)
      const { data } = await api.post('/admin/question-image/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setQuestion(question._key, { image: data.image, image_url: data.image_url })
    } catch (err) {
      setProblem(errorMessage(err, 'The image could not be uploaded.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4">
      <p className="label">Figure — graph, chart or diagram (optional)</p>

      {question.image_url ? (
        <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/3 p-3 sm:flex-row">
          <img
            src={question.image_url}
            alt="Question figure"
            className="h-28 w-full rounded-lg border border-white/10 bg-white object-contain p-1 sm:w-44"
          />
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
            <Input
              placeholder="Caption shown under the figure (optional)"
              value={question.image_caption}
              onChange={(e) => setQuestion(question._key, { image_caption: e.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="btn-ghost px-3 py-1.5 text-xs"
              >
                {busy ? <Spinner size={13} /> : <IconImage size={14} />} Replace
              </button>
              <button
                onClick={() =>
                  setQuestion(question._key, { image: '', image_url: '', image_caption: '' })
                }
                className="btn-danger px-3 py-1.5 text-xs"
              >
                <IconTrash size={14} /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/12 bg-white/2 py-4 text-xs font-semibold text-slate-400 transition hover:border-brand-400/40 hover:bg-brand-500/6 hover:text-brand-200"
        >
          {busy ? <Spinner size={14} /> : <IconImage size={16} />}
          {busy ? 'Uploading…' : 'Attach a figure (PNG, JPEG, GIF or WebP, up to 5 MB)'}
        </button>
      )}

      {problem && <p className="mt-1.5 text-xs text-rose-300">{problem}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ProctoringTab({ test, set }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/8 p-4">
          <IconAlert size={20} className="mt-0.5 shrink-0 text-amber-300" />
          <div className="text-[13px] leading-relaxed text-amber-100/85">
            <p className="font-semibold text-amber-200">Configuration only, for now</p>
            <p className="mt-1">
              These settings save against the test and are already exposed to the candidate
              briefing screen. Camera capture, streaming and the invigilator view are not wired up
              yet — that is the next piece of work.
            </p>
          </div>
        </div>

        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
            Live proctoring
          </h3>
          <div className="space-y-2.5">
            <Toggle
              label="Enable proctoring for this test"
              description="Candidates are told the assessment is invigilated."
              checked={test.proctoring_enabled}
              onChange={(v) =>
                set({
                  proctoring_enabled: v,
                  ...(v ? {} : { require_camera: false, require_fullscreen: false, flag_tab_switching: false }),
                })
              }
            />
            <Toggle
              label="Require camera"
              description="Block the start of the test until the webcam feed is granted."
              disabled={!test.proctoring_enabled}
              checked={test.require_camera}
              onChange={(v) => set({ require_camera: v })}
              badge={<Badge tone="amber">Pending</Badge>}
            />
            <Toggle
              label="Require full screen"
              description="Force the exam into full screen for the duration."
              disabled={!test.proctoring_enabled}
              checked={test.require_fullscreen}
              onChange={(v) => set({ require_fullscreen: v })}
              badge={<Badge tone="amber">Pending</Badge>}
            />
            <Toggle
              label="Flag tab switching"
              description="Record every time the candidate leaves the exam window."
              disabled={!test.proctoring_enabled}
              checked={test.flag_tab_switching}
              onChange={(v) => set({ flag_tab_switching: v })}
              badge={<Badge tone="amber">Pending</Badge>}
            />
          </div>

          <div className="mt-4 max-w-xs">
            <Field label="Snapshot interval (seconds)" hint="How often a camera still is captured.">
              <Input
                type="number"
                min="5"
                disabled={!test.proctoring_enabled}
                value={test.snapshot_interval_seconds}
                onChange={(e) => set({ snapshot_interval_seconds: e.target.value })}
              />
            </Field>
          </div>
        </Card>
      </div>

      <Card className="h-fit">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
          Candidate preview
        </h3>
        {test.proctoring_enabled ? (
          <div className="rounded-xl border border-rose-400/25 bg-rose-500/8 p-4">
            <div className="flex items-center gap-2 text-rose-200">
              <IconCamera size={18} />
              <p className="text-sm font-semibold">This test is proctored</p>
            </div>
            <ul className="mt-2.5 space-y-1 text-[13px] text-rose-200/70">
              {test.require_camera && <li>• Camera access is required to begin.</li>}
              {test.require_fullscreen && <li>• The exam runs in full screen.</li>}
              {test.flag_tab_switching && <li>• Leaving the window is recorded.</li>}
              <li>• Snapshots every {test.snapshot_interval_seconds}s.</li>
            </ul>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-slate-400">
            Proctoring is off. Candidates sit this test without any monitoring notice.
          </p>
        )}
      </Card>
    </div>
  )
}
