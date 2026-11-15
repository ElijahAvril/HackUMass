// ---------------------------------------------------------------------------
// DROPDOWN - the app's own dropdown, styled to match Packuroo
// ---------------------------------------------------------------------------
// A browser <select> can only be styled while closed; the open list is drawn
// by the operating system. This component draws the whole thing itself: a
// rounded button, and a soft card of choices with a pastel highlight and a
// check mark on the selected one.
//
// ACCESSIBILITY (please keep if you restyle) - follows the WAI-ARIA
// "select-only combobox" pattern, the same one screen readers expect from a
// native <select>:
//   * The button is role="combobox"; the list is role="listbox".
//   * Focus stays on the button; aria-activedescendant points at the
//     highlighted choice, so screen readers announce it as you move.
//   * Keys: Enter / Space / Alt+Down to open; Up / Down / Home / End /
//     Page Up / Page Down to move; Enter or Space to choose; Escape to close
//     without changing; Tab chooses the highlighted one and moves on.
//     Typing letters or numbers jumps to a match ("9", "3" -> 9:30 AM).
//
// USAGE
//   <span id="time-label">Time</span>
//   <Dropdown labelId="time-label" value={time} onChange={setTime}
//     options={[{ value: 'a', label: 'All day', icon: 'sun' },
//               { divider: true },
//               { value: '09:00', label: '9:00 AM', hint: 'morning' }]} />
//   For "action" dropdowns (pick one to do something, then reset), pass
//   value="" and a placeholder.
// ---------------------------------------------------------------------------
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import './Dropdown.css'

export function Dropdown({
  options, value, onChange, labelId, ariaLabel, placeholder = 'Choose…', disabled = false, className = '',
}) {
  const uid = useId().replace(/:/g, '')
  const listId = `dd-list-${uid}`
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const rootRef = useRef(null)
  const typed = useRef({ text: '', timer: null })

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)       // index into `choices`
  const [openUp, setOpenUp] = useState(false)    // flip above when near the bottom

  // Only real choices can be highlighted; dividers are skipped.
  const choices = useMemo(() => options.filter((o) => !o.divider), [options])
  const selectedIndex = choices.findIndex((o) => o.value === value)
  const selected = choices[selectedIndex]
  const optionId = (i) => `dd-opt-${uid}-${i}`

  const nextEnabled = (from, step) => {
    let i = from
    for (let n = 0; n < choices.length; n++) {
      i = Math.min(Math.max(i + step, 0), choices.length - 1)
      if (!choices[i]?.disabled) return i
      if (i === 0 || i === choices.length - 1) break
    }
    return from
  }

  const openList = (startAt) => {
    if (disabled) return
    const rect = buttonRef.current.getBoundingClientRect()
    setOpenUp(window.innerHeight - rect.bottom < 300 && rect.top > 300)
    const start = startAt ?? (selectedIndex >= 0 ? selectedIndex : nextEnabled(-1, 1))
    setActive(start)
    setOpen(true)
  }
  const closeList = () => { setOpen(false); setActive(-1) }
  const choose = (i) => {
    const option = choices[i]
    if (!option || option.disabled) return
    closeList()
    buttonRef.current?.focus()
    if (option.value !== value) onChange(option.value)
  }

  // Keep the highlighted choice scrolled into view.
  useEffect(() => {
    if (!open || active < 0) return
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
  }, [open, active]) // eslint-disable-line react-hooks/exhaustive-deps

  // Click anywhere else closes it.
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) closeList() }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Type-to-jump: matches the start of a label, then anywhere in it.
  const typeahead = (char) => {
    clearTimeout(typed.current.timer)
    typed.current.text += char.toLowerCase()
    typed.current.timer = setTimeout(() => { typed.current.text = '' }, 700)
    const q = typed.current.text
    const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ')
    const compact = (s) => norm(s).replace(/[^a-z0-9]/g, '')
    let i = choices.findIndex((o) => !o.disabled && norm(o.label).startsWith(q))
    if (i < 0) i = choices.findIndex((o) => !o.disabled && compact(o.label).startsWith(compact(q)))
    if (i < 0) i = choices.findIndex((o) => !o.disabled && norm(o.label).includes(q))
    if (i >= 0) { if (!open) openList(i); else setActive(i) }
  }

  const onKeyDown = (e) => {
    const k = e.key
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(k)) { e.preventDefault(); openList() }
      else if (k.length === 1 && /\S/.test(k) && !e.metaKey && !e.ctrlKey) typeahead(k)
      return
    }
    if (k === 'Escape') { e.preventDefault(); closeList() }
    else if (k === 'ArrowDown') { e.preventDefault(); setActive((i) => nextEnabled(i, 1)) }
    else if (k === 'ArrowUp') { e.preventDefault(); setActive((i) => nextEnabled(i, -1)) }
    else if (k === 'Home') { e.preventDefault(); setActive(nextEnabled(-1, 1)) }
    else if (k === 'End') { e.preventDefault(); setActive(nextEnabled(choices.length, -1)) }
    else if (k === 'PageDown') { e.preventDefault(); setActive((i) => Math.min(i + 8, choices.length - 1)) }
    else if (k === 'PageUp') { e.preventDefault(); setActive((i) => Math.max(i - 8, 0)) }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(active) }
    else if (k === 'Tab') { choose(active) }
    else if (k.length === 1 && /\S/.test(k) && !e.metaKey && !e.ctrlKey) typeahead(k)
  }

  let choiceIndex = -1
  return (
    <div className={`dropdown ${open ? 'is-open' : ''} ${className}`} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="dropdown__button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-label={labelId ? undefined : ariaLabel}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onKeyDown}
      >
        {selected?.icon ? <Icon name={selected.icon} size={18} /> : null}
        <span className={`dropdown__value ${selected ? '' : 'is-placeholder'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="dropdown__chevron" aria-hidden="true"><Icon name="forward" size={14} strokeWidth={2.4} /></span>
      </button>

      <ul
        id={listId}
        ref={listRef}
        role="listbox"
        aria-labelledby={labelId}
        aria-label={labelId ? undefined : ariaLabel}
        className={`dropdown__list ${openUp ? 'dropdown__list--up' : ''}`}
        hidden={!open}
        tabIndex={-1}
      >
        {options.map((option, n) => {
          if (option.divider) return <li key={`d${n}`} role="separator" className="dropdown__divider" />
          choiceIndex += 1
          const i = choiceIndex
          const isSelected = option.value === value
          return (
            <li
              key={String(option.value)}
              id={optionId(i)}
              role="option"
              aria-selected={isSelected}
              aria-disabled={option.disabled || undefined}
              className={`dropdown__option ${i === active ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''} ${option.disabled ? 'is-disabled' : ''}`}
              onPointerMove={() => !option.disabled && setActive(i)}
              onPointerDown={(e) => e.preventDefault()} // keep focus on the button
              onClick={() => choose(i)}
            >
              {option.icon ? <span className="dropdown__icon"><Icon name={option.icon} size={16} /></span> : null}
              <span className="dropdown__label">{option.label}</span>
              {option.hint ? <span className="dropdown__hint">{option.hint}</span> : null}
              <span className="dropdown__check" aria-hidden="true">
                {isSelected ? <Icon name="check" size={16} strokeWidth={2.6} /> : null}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
