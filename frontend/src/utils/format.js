export function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function formatDuration(totalSeconds) {
  if (totalSeconds == null) return '—'
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export const QUESTION_TYPES = [
  { value: 'single', label: 'Single choice', hint: 'One correct option' },
  { value: 'multiple', label: 'Multiple choice', hint: 'Several correct options' },
  { value: 'true_false', label: 'True / False', hint: 'Two fixed options' },
  { value: 'short_text', label: 'Short answer', hint: 'Typed, auto-marked' },
]

export const typeLabel = (value) =>
  QUESTION_TYPES.find((t) => t.value === value)?.label || value
