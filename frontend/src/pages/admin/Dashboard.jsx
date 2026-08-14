import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/client.js'
import {
  IconAward,
  IconPlus,
  IconResults,
  IconTests,
  IconUsers,
} from '../../components/Icons.jsx'
import {
  Badge,
  EmptyState,
  LoadingScreen,
  SectionTitle,
  StatCard,
} from '../../components/ui.jsx'
import { formatDate } from '../../utils/format.js'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/admin/stats/')
      .then(({ data }) => setStats(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingScreen label="Loading dashboard" />
  if (!stats) return null

  return (
    <div className="animate-rise">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300/80">
            Administration
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-400">
            Assessment activity across every published test.
          </p>
        </div>
        <Link to="/admin/tests/new" className="btn-primary">
          <IconPlus size={16} /> New test
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tests"
          value={stats.tests_total}
          sub={`${stats.tests_published} published`}
          icon={<IconTests size={19} />}
        />
        <StatCard
          label="Questions"
          value={stats.questions_total}
          sub="across all papers"
          icon={<IconResults size={19} />}
          tone="amber"
        />
        <StatCard
          label="Candidates"
          value={stats.candidates_total}
          sub={`${stats.attempts_in_progress} sitting now`}
          icon={<IconUsers size={19} />}
          tone="green"
        />
        <StatCard
          label="Pass rate"
          value={`${stats.pass_rate}%`}
          sub={`avg score ${stats.average_score}%`}
          icon={<IconAward size={19} />}
          tone={stats.pass_rate >= 50 ? 'green' : 'rose'}
        />
      </div>

      <div className="mt-10">
        <SectionTitle
          eyebrow="Latest activity"
          title="Recent submissions"
          description={`${stats.attempts_total} completed attempt${stats.attempts_total === 1 ? '' : 's'} in total.`}
          action={
            <Link to="/admin/results" className="btn-ghost text-[13px]">
              View all results
            </Link>
          }
        />

        {!stats.recent_attempts.length ? (
          <EmptyState
            icon={<IconResults size={26} />}
            title="No submissions yet"
            description="Once candidates start completing your published tests, their results will land here."
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
                    <th className="px-5 py-3 font-semibold">Outcome</th>
                    <th className="px-5 py-3 font-semibold">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_attempts.map((attempt) => (
                    <tr
                      key={attempt.id}
                      className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/3"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-100">
                          {attempt.candidate.full_name || attempt.candidate.username}
                        </p>
                        <p className="text-xs text-slate-500">{attempt.candidate.email}</p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">{attempt.test_title}</td>
                      <td className="px-5 py-3.5 font-mono tabular-nums text-slate-200">
                        {attempt.score}/{attempt.max_score}
                        <span className="ml-1.5 text-xs text-slate-500">
                          ({Math.round(attempt.percentage)}%)
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={attempt.passed ? 'green' : 'rose'}>
                          {attempt.passed ? 'Pass' : 'Fail'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">
                        {formatDate(attempt.submitted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
