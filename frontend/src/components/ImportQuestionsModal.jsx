import { useEffect, useRef, useState } from 'react'
import api, { errorMessage } from '../api/client.js'
import { IconAlert, IconCheck, IconImage, IconSparkle, IconTests } from './Icons.jsx'
import { Alert, Badge, Modal, Spinner } from './ui.jsx'
import { typeLabel } from '../utils/format.js'

const ACCEPTED = '.pdf,.docx,.txt,.md'

/**
 * Upload a PDF / Word document, let the server pull the questions out of it,
 * then review them before they join the test.
 */
export default function ImportQuestionsModal({ open, onClose, onImport }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [chosen, setChosen] = useState({})
  const [dragging, setDragging] = useState(false)
  const [capabilities, setCapabilities] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setFile(null)
    setResult(null)
    setError('')
    setChosen({})
    api
      .get('/admin/import-questions/')
      .then(({ data }) => setCapabilities(data))
      .catch(() => setCapabilities(null))
  }, [open])

  const pick = (selected) => {
    if (!selected) return
    setFile(selected)
    setError('')
    setResult(null)
  }

  const upload = async () => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post('/admin/import-questions/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
      setChosen(Object.fromEntries(data.questions.map((_, index) => [index, true])))
    } catch (err) {
      setError(errorMessage(err, 'That document could not be read.'))
    } finally {
      setBusy(false)
    }
  }

  const selectedCount = Object.values(chosen).filter(Boolean).length

  const confirm = () => {
    onImport(result.questions.filter((_, index) => chosen[index]))
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title="Import questions from a document"
      description="Upload a PDF or Word file and the questions are read out of it automatically."
      footer={
        result ? (
          <>
            <button
              onClick={() => {
                setResult(null)
                setFile(null)
              }}
              className="btn-ghost"
            >
              Choose another file
            </button>
            <button onClick={confirm} disabled={!selectedCount} className="btn-primary">
              <IconCheck size={16} /> Add {selectedCount} question
              {selectedCount === 1 ? '' : 's'}
            </button>
          </>
        ) : (
          <>
            <button onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button onClick={upload} disabled={!file || busy} className="btn-primary">
              {busy ? <Spinner size={16} /> : <IconSparkle size={16} />}
              {busy ? 'Reading document' : 'Extract questions'}
            </button>
          </>
        )
      }
    >
      {!result ? (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              pick(e.dataTransfer.files?.[0])
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-11 text-center transition ${
              dragging
                ? 'border-brand-400/60 bg-brand-500/10'
                : 'border-white/12 bg-white/2 hover:border-brand-400/35 hover:bg-white/4'
            }`}
          >
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-brand-300">
              <IconTests size={26} />
            </div>
            {file ? (
              <div>
                <p className="font-medium text-white">{file.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {(file.size / 1024).toFixed(0)} KB · click to choose a different file
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-white">Drop a document here, or click to browse</p>
                <p className="mt-1 text-xs text-slate-500">
                  PDF, Word (.docx), text or markdown · up to 10 MB
                </p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>

          {error && (
            <div className="mt-4">
              <Alert>{error}</Alert>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-white/8 bg-white/3 p-4">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              <IconAlert size={14} /> Layouts that read cleanly
            </p>
            <pre className="mt-2.5 overflow-x-auto whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-slate-400">
{`1. What is the capital of Nigeria?
A. Lagos
B. Abuja
C. Kano
Answer: B
Explanation: Abuja became the capital in 1991.`}
            </pre>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
              Also understood: an answer key at the end (“ANSWER KEY — 1. b, 2. c”), options marked
              with <span className="font-mono">*</span> or in <strong>bold</strong> in Word,
              True/False pairs, multi-answer keys (“Answer: A, C”), marks in brackets
              (“(2 marks)”), and questions with no options at all — those become typed short
              answers. Graphs and charts in the file are pulled out too and attached to the
              question they sit with.
            </p>
            {capabilities && (
              <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    capabilities.local_ai_available ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                />
                {capabilities.local_ai_available
                  ? 'A local AI model is running and will be used for messy documents.'
                  : 'Offline document reader — no paid service, nothing leaves this machine.'}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green">
                <IconCheck size={12} /> {result.stats.found} found
              </Badge>
              {result.stats.skipped > 0 && (
                <Badge tone="amber">{result.stats.skipped} skipped — no answer key</Badge>
              )}
              <Badge tone="brand">{result.stats.total_marks} marks</Badge>
              {result.stats.with_images > 0 && (
                <Badge tone="brand">
                  <IconImage size={12} /> {result.stats.with_images} with figures
                </Badge>
              )}
              <Badge tone="slate">
                {result.engine === 'local-ai' ? 'Local AI' : 'Document parser'}
              </Badge>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setChosen(Object.fromEntries(result.questions.map((_, i) => [i, true])))
                }
                className="btn-subtle px-2 py-1 text-xs"
              >
                Select all
              </button>
              <button
                onClick={() => setChosen({})}
                className="btn-subtle px-2 py-1 text-xs"
              >
                Clear
              </button>
            </div>
          </div>

          <p className="mb-3 truncate text-xs text-slate-500">From {result.source}</p>

          <div className="max-h-[44vh] space-y-2 overflow-y-auto pr-1">
            {result.questions.map((question, index) => (
              <label
                key={index}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition ${
                  chosen[index]
                    ? 'border-brand-400/35 bg-brand-500/8'
                    : 'border-white/8 bg-white/2 hover:border-white/16'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!chosen[index]}
                  onChange={(e) => setChosen({ ...chosen, [index]: e.target.checked })}
                  className="mt-1 h-4 w-4 shrink-0 accent-indigo-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[14px] leading-relaxed text-slate-100">
                      <span className="mr-1.5 font-semibold text-slate-500">{index + 1}.</span>
                      {question.text}
                    </p>
                    <div className="flex shrink-0 gap-1.5">
                      <Badge tone="slate">{typeLabel(question.type)}</Badge>
                      <Badge tone="brand">{question.points}pt</Badge>
                    </div>
                  </div>

                  {/* FIX: use the absolute image_url the backend now returns
                      for each parsed question, instead of hand-building
                      "/media/<path>" here. That manual prefix was a relative
                      URL, which the browser resolves against the FRONTEND's
                      own domain (Vercel) instead of the Django backend
                      (Render) — this was the third spot doing that, missed
                      earlier because it lives in this modal rather than in
                      TestEditor.jsx. */}
                  {question.image_url && (
                    <img
                      src={question.image_url}
                      alt="Figure found in the document"
                      className="mt-2 h-24 rounded-lg border border-white/10 bg-white object-contain p-1"
                    />
                  )}

                  {question.type === 'short_text' ? (
                    <p className="mt-2 text-xs text-emerald-300">
                      Accepted: {question.accepted_answers}
                    </p>
                  ) : (
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      {question.choices.map((choice, choiceIndex) => (
                        <p
                          key={choiceIndex}
                          className={`flex items-start gap-1.5 text-xs ${
                            choice.is_correct ? 'text-emerald-300' : 'text-slate-400'
                          }`}
                        >
                          <span className="font-semibold">
                            {String.fromCharCode(65 + choiceIndex)}.
                          </span>
                          {choice.text}
                          {choice.is_correct && <IconCheck size={12} className="mt-0.5 shrink-0" />}
                        </p>
                      ))}
                    </div>
                  )}

                  {question.explanation && (
                    <p className="mt-2 text-xs italic text-slate-500">{question.explanation}</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          <p className="mt-3 text-center text-xs text-slate-500">
            Questions are added to the editor — nothing is saved until you press{' '}
            <span className="text-slate-300">Save changes</span>.
          </p>
        </div>
      )}
    </Modal>
  )
}
