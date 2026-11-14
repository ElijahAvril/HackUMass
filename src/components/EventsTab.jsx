// ---------------------------------------------------------------------------
// EVENTS TAB - every event, plus the form to add one
// ---------------------------------------------------------------------------
// This tab replaces the "Agenda" idea from the first sketch. The difference is
// not cosmetic: an agenda implies a fixed time grid, whereas PackPal cares
// about the ORDER of what's coming and how ready each one is. So each row
// carries a progress summary, which a calendar grid has no room for.
//
// The month strip at the top is a lightweight custom calendar rather than
// FullCalendar: FullCalendar is ~200kB and brings its own DOM and focus
// behaviour that we would have to re-audit for accessibility. A list of dates
// that marks which days have events is enough for this product, and it is
// 40 lines we fully control.
// ---------------------------------------------------------------------------
import React, { useMemo, useState } from 'react'
import { Icon } from './Icon.jsx'
import { EventHeader } from './EventView.jsx'
import { useStore } from '../state/store.jsx'
import { selectSortedEvents, selectProgress } from '../state/selectors.js'
import { suggestKits } from '../state/suggestKits.js'
import './Views.css'

/** Mini month view. Days with events get a dot AND the day number bolded. */
function MonthStrip({ events, onPick }) {
  const [offset, setOffset] = useState(0) // months away from the current one

  const { label, cells } = useMemo(() => {
    const base = new Date()
    base.setDate(1)
    base.setMonth(base.getMonth() + offset)

    const year = base.getFullYear()
    const month = base.getMonth()
    const first = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    // Pad the grid so the 1st lands under the right weekday column.
    const pad = first.getDay()

    const byDay = new Map()
    events.forEach((event) => {
      const d = new Date(event.startsAt)
      if (d.getFullYear() === year && d.getMonth() === month) {
        byDay.set(d.getDate(), [...(byDay.get(d.getDate()) || []), event])
      }
    })

    return {
      label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      cells: [
        ...Array.from({ length: pad }, () => null),
        ...Array.from({ length: daysInMonth }, (_, i) => ({
          day: i + 1,
          events: byDay.get(i + 1) || [],
          isToday:
            new Date().toDateString() === new Date(year, month, i + 1).toDateString(),
        })),
      ],
    }
  }, [events, offset])

  return (
    <section className="card month" aria-labelledby="month-heading">
      <div className="month__bar">
        <button type="button" className="icon-btn" onClick={() => setOffset((o) => o - 1)}>
          <Icon name="back" size={18} /><span className="sr-only">Previous month</span>
        </button>
        <h2 className="month__label" id="month-heading">{label}</h2>
        <button type="button" className="icon-btn" onClick={() => setOffset((o) => o + 1)}>
          <Icon name="forward" size={18} /><span className="sr-only">Next month</span>
        </button>
      </div>

      <div className="month__grid" role="grid" aria-labelledby="month-heading">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="month__dow" aria-hidden="true">{d}</span>
        ))}
        {cells.map((cell, i) =>
          cell === null ? (
            <span key={`pad-${i}`} />
          ) : cell.events.length ? (
            <button
              key={cell.day}
              type="button"
              className={`month__day has-event ${cell.isToday ? 'is-today' : ''}`}
              onClick={() => onPick(cell.events[0].id)}
            >
              {cell.day}
              <span className="month__dot" aria-hidden="true" />
              <span className="sr-only">
                {cell.events.length} event{cell.events.length === 1 ? '' : 's'}: {cell.events.map((e) => e.title).join(', ')}
              </span>
            </button>
          ) : (
            <span key={cell.day} className={`month__day ${cell.isToday ? 'is-today' : ''}`}>{cell.day}</span>
          )
        )}
      </div>
    </section>
  )
}

/** The add-an-event form. Collapsed by default to keep the list scannable. */
function EventForm({ onDone }) {
  const { state, actions } = useStore()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [location, setLocation] = useState('')
  // Kits chosen here are copied into the new event as ready-made lists.
  const [kitIds, setKitIds] = useState([])
    // Kits that fit this title go first and get a "Suggested" label
  const suggestedIds = suggestKits(title, state.kits, state.events).map((k) => k.id)
  const sortedKits = [...state.kits].sort(
    (a, b) => suggestedIds.includes(b.id) - suggestedIds.includes(a.id))

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim() || !date) return
    // Build a local-time ISO string. `new Date('2026-11-20T10:00')` without a
    // Z suffix is parsed in the user's own timezone, which is what we want.
    const startsAt = new Date(`${date}T${time || '09:00'}`).toISOString()
    actions.addEvent({
      title: title.trim(),
      startsAt,
      location: location.trim(),
      reminders: [
        { id: `rem_${Date.now()}_a`, offsetMinutes: 1440, fired: false },
        { id: `rem_${Date.now()}_b`, offsetMinutes: 120, fired: false },
      ],
      kits: state.kits.filter((k) => kitIds.includes(k.id)),
    })
    actions.announce(`${title.trim()} added`)
    onDone?.()
  }

  return (
    <form className="card eventform" onSubmit={submit}>
      <h2 className="panel__title">Add an event</h2>

      <label className="field">
        <span>What is it?</span>
        <input className="input" value={title} autoFocus placeholder="Job interview"
               onChange={(e) => setTitle(e.target.value)} required />
      </label>

      <div className="eventform__grid">
        <label className="field">
          <span>Date</span>
          <input className="input" type="date" value={date}
                 onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field">
          <span>Time</span>
          <input className="input" type="time" value={time}
                 onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Where? (optional)</span>
        <input className="input" value={location} placeholder="Boston Regional Office"
               onChange={(e) => setLocation(e.target.value)} />
      </label>

      {/* Kit picker: checkboxes in a fieldset so screen readers announce the
          group name once instead of repeating it per option. */}
      {state.kits.length ? (
        <fieldset className="eventform__kits">
          <legend>Start from a saved kit</legend>
          {sortedKits.map((kit) => (
            <label key={kit.id} className="eventform__kit">
              <input
                type="checkbox"
                checked={kitIds.includes(kit.id)}
                onChange={(e) =>
                  setKitIds((ids) => (e.target.checked ? [...ids, kit.id] : ids.filter((id) => id !== kit.id)))
                }
              />
              <span>{kit.name} <span className="eventform__kitcount">({kit.items.length} items)</span>{suggestedIds.includes(kit.id) ? <strong> · Suggested</strong> : null}</span>            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="row" style={{ marginTop: 'var(--sp-4)' }}>
        <button type="submit" className="btn btn--primary"><Icon name="plus" size={18} /> Add event</button>
        <button type="button" className="btn btn--ghost" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

export function EventsTab() {
  const { state, actions } = useStore()
  const [adding, setAdding] = useState(false)
  const events = selectSortedEvents(state.events)

  return (
    <div className="stack">
      <div className="row">
        <h1 className="page__title">Events</h1>
        <span className="spacer" />
        <button type="button" className="btn btn--primary" onClick={() => setAdding((v) => !v)}
                aria-expanded={adding}>
          <Icon name="plus" size={18} /> Add an event
        </button>
      </div>

      {adding ? <EventForm onDone={() => setAdding(false)} /> : null}

      <MonthStrip events={events} onPick={(id) => actions.openEvent(id)} />

      {events.length === 0 ? (
        <p className="card panel__empty">No events yet. Add one above to start a packing list.</p>
      ) : (
        <ul className="eventlist">
          {events.map((event) => {
            const progress = selectProgress(event)
            return (
              <li key={event.id} className="card eventlist__row">
                <EventHeader event={event} compact />

                <p className="eventlist__progress">
                  <span className="eventlist__bar" aria-hidden="true">
                    <span style={{ width: `${progress.percent}%` }} />
                  </span>
                  <span className="eventlist__count">
                    {progress.packed} of {progress.total} packed
                  </span>
                </p>

                <div className="eventlist__actions">
                  <button type="button" className="btn" onClick={() => actions.openEvent(event.id)}>
                    <Icon name="bag" size={16} /> Open list
                  </button>
                  <button type="button" className="btn btn--primary" onClick={() => actions.startPacking(event.id)}>
                    <Icon name="check" size={16} /> Start packing
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--danger"
                    onClick={() => {
                      // A destructive action gets a confirm. Native confirm() is
                      // keyboard and screen-reader accessible for free; a custom
                      // modal would need focus trapping to match it.
                      if (window.confirm(`Delete "${event.title}" and its packing list?`)) {
                        actions.removeEvent(event.id)
                        actions.announce(`${event.title} deleted`)
                      }
                    }}
                  >
                    <Icon name="trash" size={16} /> Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
