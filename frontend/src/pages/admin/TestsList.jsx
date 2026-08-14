import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { errorMessage, unwrap } from '../../api/client.js'
import {
  IconCamera,
  IconCopy,
  IconEye,
  IconPlus,
  IconResults,
  IconSearch,
  IconTests,
  IconTrash,
} from '../../components/Icons.jsx'
import {
  Alert,
  Badge,
  EmptyState,
  LoadingScreen,
  Modal,
  SectionTitle,
  StatusBadge,
} from '../../components/ui.jsx'
import { formatDate } from '../../utils/format.js'

const filters = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
]

export default function TestsList() {
  const navigate = useNavigate()
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)

  const load = () => {
    setLoading(true)
    api
      .get('/admin/tests/', { params: { status: status || undefined, search: search || undefined } })
      .then(({ data }) => setTests(unwrap(data)))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search])

  const duplicate = async (test) => {
    try {
      const { data } = await api.post(`/admin/tests/${test.id}/duplicate/`)
      navigate(`/admin/tests/${data.id}`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const remove = async () => {
    try {
      await api.delete(`/admin/tests/${pendingDelete.id}/`)
      setPendingDelete(null)
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="animate-rise">
      <SectionTitle
        eyebrow="Library"
        title="Tests"
        description="Create, configure and publish assessments."
        action={
          <Link to="/admin/tests/new" className="btn-primary">
            <IconPlus size={16} /> New test
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            className="field pl-10"
            placeholder="Search tests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-white/8 bg-white/3 p-1">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatus(filter.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                status === filter.value
                  ? 'bg-gradient-to-r from-brand-500/25 to-violet-glow/15 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {loading ? (
        <LoadingScreen label="Loading tests" />
      ) : !tests.length ? (
        <EmptyState
          icon={<IconTests size={26} />}
          title={search || status ? 'No tests match that filter' : 'No tests yet'}
          description="Build your first assessment: set a title, a time limit and the questions candidates will answer."
          action={
            <Link to="/admin/tests/new" className="btn-primary mt-2">
              <IconPlus size={16} /> Create a test
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <div
              key={test.id}
              className="surface-raised group flex flex-wrap items-center gap-4 p-4 transition-all duration-200 hover:border-brand-400/20"
            >
              <div className="min-w-[220px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/admin/tests/${test.id}`}
                    className="font-medium text-white transition hover:text-brand-300"
                  >
                    {test.title}
                  </Link>
                  <StatusBadge status={test.status} />
                  {test.proctoring_enabled && (
                    <Badge tone="rose">
                      <IconCamera size={12} /> Proctored
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {test.duration_minutes} min · {test.served_question_count} of {test.pool_size}{' '}
                  question{test.pool_size === 1 ? '' : 's'} served · pass {test.pass_mark}% ·
                  updated {formatDate(test.updated_at)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="mr-1 hidden text-right sm:block">
                  <p className="text-sm font-semibold text-white">{test.attempt_count}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">attempts</p>
                </div>

                <Link
                  to={`/admin/tests/${test.id}/results`}
                  title="Results"
                  className="btn-ghost px-2.5 py-2"
                >
                  <IconResults size={16} />
                </Link>
                <button onClick={() => duplicate(test)} title="Duplicate" className="btn-ghost px-2.5 py-2">
                  <IconCopy size={16} />
                </button>
                <Link to={`/admin/tests/${test.id}`} className="btn-ghost px-3 py-2 text-[13px]">
                  <IconEye size={15} /> Edit
                </Link>
                <button
                  onClick={() => setPendingDelete(test)}
                  title="Delete"
                  className="btn-danger px-2.5 py-2"
                >
                  <IconTrash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete this test?"
        description={pendingDelete?.title}
        footer={
          <>
            <button onClick={() => setPendingDelete(null)} className="btn-ghost">
              Cancel
            </button>
            <button onClick={remove} className="btn-danger">
              Delete permanently
            </button>
          </>
        }
      >
        <Alert tone="rose">
          This removes the test, all of its questions and every candidate attempt recorded against
          it. This cannot be undone.
        </Alert>
      </Modal>
    </div>
  )
}
