// ---------------------------------------------------------------------------
// DATE PICKER - a little month calendar in the same style as Dropdown
// ---------------------------------------------------------------------------
// Replaces <input type="date">, whose pop-up calendar is drawn by the browser
// and can't be styled. Value is "YYYY-MM-DD" (same as the old input).
//
// ACCESSIBILITY (please keep if you restyle) - WAI-ARIA "date picker dialog":
//   * The field is a button showing the full date ("Friday, November 20").
//   * It opens a small dialog with a role="grid" of day buttons. Focus moves
//     to the chosen day (or today) so keyboard users start where they look.
//   * Keys in the grid: arrows = a day / a week; Home / End = start / end of
//     the week; Page Up / Page Down = a month (with Shift: a year);
//     Enter or Space = choose; Escape = close without changing.
//   * Each day button has a full spoken label ("Friday, November 20, 2026"),
//     plus "today" / "has an event" when they apply.
//   * "Today" and "Tomorrow" chips cover the most common choices in one tap.
// ---------------------------------------------------------------------------
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import './Dropdown.css'
import './DatePicker.css'

const pad = (n) => String(n).padStart(2, '0')
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const addMonths = (d, n) => {
  // Keep the day, but don't spill over (Jan 31 + 1 month = Feb 28, not Mar 3).
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate()
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last))
}
const fullLabel = (d) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

export function DatePicker({ labelId, value, onChange, markedDays = [], placeholder = 'Choose a date…' }) {
  const uid = useId().replace(/:/g, '')
  const dialogId = `dp-${uid}`
  const titleId = `dp-title-${uid}`
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const gridRef = useRef(null)

  const todayKey = toKey(new Date())
  const marked = useMemo(() => new Set(markedDays), [markedDays])
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const [focusKey, setFocusKey] = useState(value || todayKey)
  const focusDate = fromKey(focusKey)

  const openPicker = () => {
    const rect = buttonRef.current.getBoundingClientRect()
    setOpenUp(window.innerHeight - rect.bottom < 420 && rect.top > 420)
    setFocusKey(value || todayKey)
    setOpen(true)
  }
  const close = (returnFocus = true) => { setOpen(false); if (returnFocus) buttonRef.current?.focus() }
  const choose = (key) => { onChange(key); close() }

  // Move real keyboard focus onto the focused day whenever it changes.
  useEffect(() => {
    if (open) gridRef.current?.querySelector(`[data-day="${focusKey}"]`)?.focus()
  }, [open, focusKey])

  // Click elsewhere closes it.
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) close(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Six rows of seven days, starting on the Sunday on/before the 1st.
  const first = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)
  const gridStart = addDays(first, -first.getDay())
  const weeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)))
  const weekdayNames = weeks[0].map((d) => ({
    short: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
    long: d.toLocaleDateString(undefined, { weekday: 'long' }),
  }))

  const onGridKey = (e) => {
    const moves = {
      ArrowLeft: () => addDays(focusDate, -1),
      ArrowRight: () => addDays(focusDate, 1),
      ArrowUp: () => addDays(focusDate, -7),
      ArrowDown: () => addDays(focusDate, 7),
      Home: () => addDays(focusDate, -focusDate.getDay()),
      End: () => addDays(focusDate, 6 - focusDate.getDay()),
      PageUp: () => addMonths(focusDate, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focusDate, e.shiftKey ? 12 : 1),
    }
    if (moves[e.key]) { e.preventDefault(); setFocusKey(toKey(moves[e.key]())) }
  }
  const onDialogKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() } }

  const selected = value ? fromKey(value) : null
  const tomorrowKey = toKey(addDays(new Date(), 1))

  return (
    <div className={`dropdown datepicker ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="dropdown__button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        aria-labelledby={`${labelId} ${dialogId}-value`}
        onClick={() => (open ? close() : openPicker())}
      >
        <span id={`${dialogId}-value`} className={`dropdown__value ${selected ? '' : 'is-placeholder'}`}>
          {selected
            ? selected.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
            : placeholder}
        </span>
        <span className="dropdown__chevron datepicker__bubble" aria-hidden="true"><Icon name="calendar" size={15} strokeWidth={2.2} /></span>
      </button>

      {open ? (
        <div
          id={dialogId}
          role="dialog"
          aria-labelledby={titleId}
          className={`datepicker__card ${openUp ? 'datepicker__card--up' : ''}`}
          onKeyDown={onDialogKey}
        >
          <div className="datepicker__head">
            <button type="button" className="datepicker__nav" onClick={() => setFocusKey(toKey(addMonths(focusDate, -1)))}>
              <Icon name="back" size={16} strokeWidth={2.4} /><span className="sr-only">Previous month</span>
            </button>
            <h3 className="datepicker__title" id={titleId} aria-live="polite">
              {focusDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </h3>
            <button type="button" className="datepicker__nav" onClick={() => setFocusKey(toKey(addMonths(focusDate, 1)))}>
              <Icon name="forward" size={16} strokeWidth={2.4} /><span className="sr-only">Next month</span>
            </button>
          </div>

          <table role="grid" className="datepicker__grid" aria-labelledby={titleId} ref={gridRef} onKeyDown={onGridKey}>
            <thead>
              <tr>
                {weekdayNames.map((w) => (
                  <th key={w.long} scope="col" abbr={w.long}><span aria-hidden="true">{w.short}</span><span className="sr-only">{w.long}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, i) => (
                <tr key={i}>
                  {week.map((d) => {
                    const key = toKey(d)
                    const outside = d.getMonth() !== focusDate.getMonth()
                    const isSel = key === value
                    const isToday = key === todayKey
                    const hasEvent = marked.has(key)
                    return (
                      <td key={key} role="gridcell" aria-selected={isSel}>
                        <button
                          type="button"
                          data-day={key}
                          tabIndex={key === focusKey ? 0 : -1}
                          className={`datepicker__day ${outside ? 'is-outside' : ''} ${isSel ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                          aria-label={`${fullLabel(d)}${isToday ? ', today' : ''}${hasEvent ? ', has an event' : ''}`}
                          aria-pressed={isSel}
                          onClick={() => choose(key)}
                        >
                          {d.getDate()}
                          {hasEvent ? <span className="datepicker__dot" aria-hidden="true" /> : null}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="datepicker__foot">
            <button type="button" className="datepicker__chip" onClick={() => choose(todayKey)}>
              <Icon name="sun" size={15} /> Today
            </button>
            <button type="button" className="datepicker__chip" onClick={() => choose(tomorrowKey)}>
              <Icon name="forward" size={15} /> Tomorrow
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
