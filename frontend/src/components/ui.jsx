import { useEffect } from 'react'
import { IconAlert, IconCheck, IconX } from './Icons.jsx'

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`surface-raised p-5 ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function SectionTitle({ eyebrow, title, description, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300/80">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Field({ label, hint, error, children }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-rose-300">{error}</p>}
    </div>
  )
}

export function Input(props) {
  return <input className="field" {...props} />
}

export function Textarea({ rows = 3, ...props }) {
  return <textarea rows={rows} className="field resize-y leading-relaxed" {...props} />
}

export function Select({ children, ...props }) {
  return (
    <select className="field appearance-none pr-8" {...props}>
      {children}
    </select>
  )
}

export function Toggle({ checked, onChange, label, description, disabled, badge }) {
  return (
    <label
      className={`flex items-start justify-between gap-4 rounded-xl border border-white/8 bg-white/3 p-3.5 transition ${
        disabled ? 'opacity-55' : 'cursor-pointer hover:border-white/15 hover:bg-white/6'
      }`}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
          {label}
          {badge}
        </span>
        {description && <span className="mt-0.5 block text-xs text-slate-400">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${
          checked ? 'bg-gradient-to-r from-brand-500 to-violet-glow' : 'bg-ink-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  )
}

const badgeTones = {
  brand: 'border-brand-400/30 bg-brand-500/12 text-brand-300',
  green: 'border-emerald-400/30 bg-emerald-500/12 text-emerald-300',
  amber: 'border-amber-400/30 bg-amber-500/12 text-amber-300',
  rose: 'border-rose-400/30 bg-rose-500/12 text-rose-300',
  slate: 'border-white/12 bg-white/6 text-slate-300',
}

export function Badge({ tone = 'slate', children, className = '' }) {
  return <span className={`chip ${badgeTones[tone]} ${className}`}>{children}</span>
}

export function StatusBadge({ status }) {
  const map = {
    published: ['green', 'Published'],
    draft: ['amber', 'Draft'],
    archived: ['slate', 'Archived'],
    in_progress: ['brand', 'In progress'],
    submitted: ['green', 'Submitted'],
    expired: ['rose', 'Timed out'],
  }
  const [tone, label] = map[status] || ['slate', status]
  return <Badge tone={tone}>{label}</Badge>
}

export function Spinner({ size = 22, className = '' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-white/15 border-t-brand-400 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

export function LoadingScreen({ label = 'Loading' }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4">
      <Spinner size={30} />
      <p className="text-sm text-slate-400">{label}…</p>
    </div>
  )
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="surface flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-brand-300">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description && <p className="max-w-md text-sm text-slate-400">{description}</p>}
      {action}
    </div>
  )
}

export function Alert({ tone = 'rose', children }) {
  if (!children) return null
  const tones = {
    rose: 'border-rose-400/25 bg-rose-500/10 text-rose-200',
    green: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
    amber: 'border-amber-400/25 bg-amber-500/10 text-amber-100',
    brand: 'border-brand-400/25 bg-brand-500/10 text-brand-200',
  }
  const Glyph = tone === 'green' ? IconCheck : IconAlert
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${tones[tone]}`}>
      <Glyph size={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export function Modal({ open, onClose, title, description, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`surface-raised animate-rise relative max-h-[90dvh] w-full overflow-y-auto ${width} p-5 sm:p-6`}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/8 hover:text-white"
          aria-label="Close"
        >
          <IconX size={18} />
        </button>
        {title && <h3 className="pr-8 text-lg font-semibold text-white">{title}</h3>}
        {description && <p className="mt-1.5 text-sm text-slate-400">{description}</p>}
        <div className="mt-5">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function StatCard({ label, value, sub, icon, tone = 'brand' }) {
  const glow = {
    brand: 'from-brand-500/20 to-violet-glow/10 text-brand-300',
    green: 'from-emerald-500/20 to-emerald-400/5 text-emerald-300',
    amber: 'from-amber-500/20 to-amber-400/5 text-amber-300',
    rose: 'from-rose-500/20 to-rose-400/5 text-rose-300',
  }[tone]

  return (
    <div className="surface-raised group relative overflow-hidden p-5">
      <div
        className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br blur-2xl transition-opacity duration-500 group-hover:opacity-90 ${glow} opacity-60`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        {icon && (
          <div className={`rounded-xl border border-white/10 bg-white/5 p-2.5 ${glow.split(' ').pop()}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

export function ScoreRing({ percentage = 0, passed, size = 132 }) {
  const radius = size / 2 - 10
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference
  const stroke = passed ? '#34d399' : '#fb7185'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight text-white">
          {Math.round(percentage)}%
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {passed ? 'Passed' : 'Not passed'}
        </span>
      </div>
    </div>
  )
}
