import { useCallback, useEffect, useRef, useState } from 'react'
import { IconX } from './Icons.jsx'

const MAX_DIGITS = 14

const compute = (a, b, op) => {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '×':
      return a * b
    case '÷':
      return b === 0 ? NaN : a / b
    default:
      return b
  }
}

const present = (value) => {
  if (Number.isNaN(value)) return 'Error'
  if (!Number.isFinite(value)) return '∞'
  const rounded = Math.round(value * 1e10) / 1e10
  const text = String(rounded)
  return text.length > MAX_DIGITS ? rounded.toPrecision(10).replace(/\.?0+e/, 'e') : text
}

/**
 * On-screen calculator for candidates, shown only when the admin has
 * enabled it for the test. Draggable, keyboard-driven, no dependencies.
 */
const INITIAL = { display: '0', expression: '', prev: null, op: null, fresh: true }

export default function Calculator({ onClose }) {
  // One state object updated functionally, so a burst of fast key presses
  // can never read a stale value.
  const [state, setState] = useState(INITIAL)
  const [position, setPosition] = useState(null)
  const { display, expression } = state

  const panelRef = useRef(null)
  const dragRef = useRef(null)

  const digit = useCallback((char) => {
    setState((s) => {
      let next
      if (s.fresh || s.display === 'Error') next = char === '.' ? '0.' : char
      else if (char === '.' && s.display.includes('.')) next = s.display
      else if (s.display.replace(/[-.]/g, '').length >= MAX_DIGITS) next = s.display
      else if (s.display === '0' && char !== '.') next = char
      else next = s.display + char
      return { ...s, display: next, fresh: false }
    })
  }, [])

  const applyOperator = useCallback((op) => {
    setState((s) => {
      const current = parseFloat(s.display) || 0
      if (s.op && !s.fresh) {
        const result = compute(s.prev, current, s.op)
        return {
          display: present(result),
          expression: `${present(result)} ${op}`,
          prev: result,
          op,
          fresh: true,
        }
      }
      return {
        ...s,
        expression: `${present(current)} ${op}`,
        prev: current,
        op,
        fresh: true,
      }
    })
  }, [])

  const equals = useCallback(() => {
    setState((s) => {
      if (!s.op) return s
      const current = parseFloat(s.display) || 0
      const result = compute(s.prev, current, s.op)
      return {
        display: present(result),
        expression: `${present(s.prev)} ${s.op} ${present(current)} =`,
        prev: null,
        op: null,
        fresh: true,
      }
    })
  }, [])

  const clearAll = useCallback(() => setState(INITIAL), [])

  const backspace = useCallback(() => {
    setState((s) => {
      if (s.fresh || s.display.length <= 1 || s.display === 'Error') {
        return { ...s, display: '0' }
      }
      return { ...s, display: s.display.slice(0, -1) }
    })
  }, [])

  const negate = () =>
    setState((s) => ({
      ...s,
      display: s.display.startsWith('-')
        ? s.display.slice(1)
        : s.display === '0'
          ? s.display
          : `-${s.display}`,
    }))

  const percent = () =>
    setState((s) => ({
      ...s,
      display: present((parseFloat(s.display) || 0) / 100),
      fresh: false,
    }))

  // -- keyboard ----------------------------------------------------------
  useEffect(() => {
    const onKey = (event) => {
      // Never steal keystrokes from a candidate typing an answer.
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return

      const { key } = event
      if (/^[0-9]$/.test(key)) digit(key)
      else if (key === '.' || key === ',') digit('.')
      else if (key === '+' || key === '-') applyOperator(key)
      else if (key === '*' || key === 'x') applyOperator('×')
      else if (key === '/') applyOperator('÷')
      else if (key === 'Enter' || key === '=') equals()
      else if (key === 'Backspace') backspace()
      else if (key === 'Escape') clearAll()
      else if (key === '%') percent()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [digit, applyOperator, equals, backspace, clearAll])

  // -- dragging ----------------------------------------------------------
  useEffect(() => {
    const onMove = (event) => {
      if (!dragRef.current) return
      const { offsetX, offsetY } = dragRef.current
      const width = panelRef.current?.offsetWidth || 268
      const height = panelRef.current?.offsetHeight || 380
      setPosition({
        left: Math.min(Math.max(8, event.clientX - offsetX), window.innerWidth - width - 8),
        top: Math.min(Math.max(8, event.clientY - offsetY), window.innerHeight - height - 8),
      })
    }
    const onUp = () => {
      dragRef.current = null
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const startDrag = (event) => {
    const rect = panelRef.current.getBoundingClientRect()
    dragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }
    document.body.style.userSelect = 'none'
  }

  const keys = [
    { label: 'C', onPress: clearAll, tone: 'accent' },
    { label: '±', onPress: negate, tone: 'accent' },
    { label: '%', onPress: percent, tone: 'accent' },
    { label: '÷', onPress: () => applyOperator('÷'), tone: 'op' },
    { label: '7', onPress: () => digit('7') },
    { label: '8', onPress: () => digit('8') },
    { label: '9', onPress: () => digit('9') },
    { label: '×', onPress: () => applyOperator('×'), tone: 'op' },
    { label: '4', onPress: () => digit('4') },
    { label: '5', onPress: () => digit('5') },
    { label: '6', onPress: () => digit('6') },
    { label: '−', onPress: () => applyOperator('-'), tone: 'op' },
    { label: '1', onPress: () => digit('1') },
    { label: '2', onPress: () => digit('2') },
    { label: '3', onPress: () => digit('3') },
    { label: '+', onPress: () => applyOperator('+'), tone: 'op' },
    { label: '0', onPress: () => digit('0'), wide: true },
    { label: '.', onPress: () => digit('.') },
    { label: '=', onPress: equals, tone: 'equals' },
  ]

  const toneClass = {
    op: 'bg-brand-500/15 text-brand-200 hover:bg-brand-500/25 border-brand-400/25',
    accent: 'bg-white/8 text-slate-300 hover:bg-white/14 border-white/10',
    equals:
      'bg-gradient-to-br from-brand-500 to-violet-glow text-white border-transparent hover:brightness-110',
    default: 'bg-white/5 text-slate-100 hover:bg-white/12 border-white/8',
  }

  return (
    <div
      ref={panelRef}
      style={
        position
          ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' }
          : undefined
      }
      className="animate-rise fixed inset-x-3 bottom-24 z-40 mx-auto max-w-[300px] select-none rounded-2xl border border-white/12 bg-ink-850/95 shadow-[0_28px_70px_-24px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:inset-x-auto sm:bottom-28 sm:right-6 sm:mx-0 sm:w-[268px]"
    >
      <div
        onMouseDown={startDrag}
        className="flex cursor-grab items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5 active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Calculator
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-500 transition hover:bg-white/8 hover:text-white"
          aria-label="Close calculator"
        >
          <IconX size={15} />
        </button>
      </div>

      <div className="px-3.5 pb-2 pt-3 text-right">
        <p className="h-4 truncate font-mono text-[11px] text-slate-500">{expression}</p>
        <p className="mt-0.5 truncate font-mono text-[27px] font-semibold leading-tight tracking-tight text-white">
          {display}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1.5 p-3">
        {keys.map((key) => (
          <button
            key={key.label}
            onClick={key.onPress}
            className={`h-11 rounded-xl border text-[15px] font-semibold transition-all duration-150 active:scale-95 ${
              toneClass[key.tone || 'default']
            } ${key.wide ? 'col-span-2' : ''}`}
          >
            {key.label}
          </button>
        ))}
      </div>

      <p className="px-3.5 pb-3 text-center text-[10px] text-slate-600">
        Keyboard enabled · Esc clears
      </p>
    </div>
  )
}
