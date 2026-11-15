// ---------------------------------------------------------------------------
// EVENTS TAB - every event, plus the form to add one
// ---------------------------------------------------------------------------
// This tab replaces the "Agenda" idea from the first sketch. The difference is
// not cosmetic: an agenda implies a fixed time grid, whereas Packuroo cares
// about the ORDER of what's coming and how ready each one is. So each row
// carries a progress summary, which a calendar grid has no room for.
//
// The month grid lives in its own Calendar tab (CalendarTab.jsx). Each row
// here leads with a coloured date block, so the list scans like an agenda.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react'
import { Icon } from './Icon.jsx'
import { useStore } from '../state/store.jsx'
import {
  selectSortedEvents, selectProgress, selectNextEvent, eventTone,
  formatEventTime, formatRelative,
} from '../state/selectors.js'
import { suggestKits } from '../state/suggestKits.js'
import './Views.css'

/** The add-an-event form. Collapsed by default to keep the list scannable. */
function EventForm({ onDone, initialDate = '' }) {
  const { state, actions } = useStore()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState('09:00')
  const [allDay, setAllDay] = useState(false)
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
    // Keep the selected local date stable when converting it to the stored ISO time.
    const startsAt = new Date(`${date}T${allDay ? '00:00' : time || '09:00'}`).toISOString()
    actions.addEvent({
      title: title.trim(),
      startsAt,
      isAllDay: allDay,
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
        <div className="eventform__time">
          <label className="field">
            <span>Time</span>
            <input className="input" type="time" value={time} disabled={allDay}
                   onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="eventform__all-day">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            <span>All day</span>
          </label>
          {allDay ? <span className="eventform__all-day-note">Reminders use 9 AM as the reference time.</span> : null}
        </div>
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

/** The coloured date block: weekday, day number, month. */
export function DateBlock({ iso, tone }) {
  const d = new Date(iso)
  return (
    <span className="dateblock" style={{ background: tone }} aria-hidden="true">
      <span className="dateblock__small">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
      <span className="dateblock__big">{d.getDate()}</span>
      <span className="dateblock__small">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
    </span>
  )
}

/** Row of little tick boxes - the same paper metaphor as the progress card. */
export function TickRow({ packed, total, max = 10 }) {
  const shown = Math.min(total, max)
  const on = total > max ? Math.round((packed / total) * max) : packed
  return (
    <span className="progress__ticks tickrow" aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={`progress__tick ${i < on ? 'is-on' : ''}`}>
          {i < on ? <Icon name="check" size={12} strokeWidth={3} /> : null}
        </span>
      ))}
      {total > max ? <span className="progress__more">+{total - max}</span> : null}
    </span>
  )
}

export function EventsTab() {
  const { state, actions } = useStore()
  const [adding, setAdding] = useState(false)
  const [prefillDate, setPrefillDate] = useState('')
  const events = selectSortedEvents(state.events)
  const next = selectNextEvent(state.events)
  const nextProgress = selectProgress(next)

  // "New event" pressed in the sidebar or on the Calendar: open the form.
  useEffect(() => {
    if (!state.ui.newEvent) return
    setPrefillDate(state.ui.newEvent.date || '')
    setAdding(true)
    actions.clearNewEvent()
  }, [state.ui.newEvent, actions])

  return (
    <div className="split">
      <div className="stack">
        <header className="card evhead__card">
          <span className="tape tape--left" aria-hidden="true" />
          <p className="eyebrow">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="page__title">Events</h1>
          <p className="panel__hint" style={{ margin: 'var(--sp-1) 0 var(--sp-4)' }}>
            Your upcoming events and what to bring to each one.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => setAdding((v) => !v)}
                  aria-expanded={adding}>
            <Icon name="plus" size={18} /> Add an event
          </button>
        </header>

        {adding ? (
          <EventForm key={prefillDate} initialDate={prefillDate} onDone={() => setAdding(false)} />
        ) : null}

        <h2 className="list__heading"><Icon name="calendar" size={20} /> Coming up</h2>

        {events.length === 0 ? (
          <p className="card panel__empty">No events yet. Add one above to start a packing list.</p>
        ) : (
          <ul className="eventlist">
            {events.map((event) => {
              const progress = selectProgress(event)
              return (
                <li key={event.id} className="card agrow">
                  <DateBlock iso={event.startsAt} tone={eventTone(event, state.events)} />

                  <div className="agrow__main">
                    <h3 className="agrow__title">{event.title}</h3>
                    <p className="agrow__meta">
                      <span><Icon name="clock" size={15} /> {formatEventTime(event.startsAt, event.isAllDay)} · {formatRelative(event.startsAt, event.isAllDay)}</span>
                      {event.location ? <span><Icon name="pin" size={15} /> {event.location}</span> : null}
                    </p>
                    <p className="agrow__progress">
                      <TickRow packed={progress.packed} total={progress.total} />
                      <span className="eventlist__count"><strong>{progress.packed} of {progress.total}</strong> packed</span>
                    </p>

                    <div className="eventlist__actions">
                      <button type="button" className="btn" onClick={() => actions.openEvent(event.id)}>
                        <Icon name="bag" size={16} /> Open list<span className="sr-only"> for {event.title}</span>
                      </button>
                      <button type="button" className="btn btn--primary" onClick={() => actions.startPacking(event.id)}>
                        <Icon name="check" size={16} /> Start packing<span className="sr-only"> for {event.title}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--danger"
                        onClick={() => {
                          // A destructive action gets a confirm. Native confirm() is
                          // keyboard and screen-reader accessible for free.
                          if (window.confirm(`Delete "${event.title}" and its packing list?`)) {
                            actions.removeEvent(event.id)
                            actions.announce(`${event.title} deleted`)
                          }
                        }}
                      >
                        <Icon name="trash" size={16} /> Delete<span className="sr-only"> {event.title}</span>
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Side card: the next event and one big button to start packing it. */}
      {next ? (
        <aside className="card panel nextup" aria-labelledby="nextup-heading">
          <span className="tape tape--right" aria-hidden="true" />
          <p className="eyebrow">Next up · {formatRelative(next.startsAt, next.isAllDay)}</p>
          <h2 className="nextup__title" id="nextup-heading">{next.title}</h2>
          <p className="nextup__when">
            {new Date(next.startsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {formatEventTime(next.startsAt, next.isAllDay)}
          </p>
          <p className="progress__headline">
            <strong className="progress__big">{nextProgress.packed}</strong>
            <span className="progress__of">of {nextProgress.total} items</span>
          </p>
          <TickRow packed={nextProgress.packed} total={nextProgress.total} />
          <p className="progress__caption" style={{ marginBottom: 'var(--sp-4)' }}>
            {nextProgress.remaining} still to pack
          </p>
          <button type="button" className="btn btn--primary startbtn" onClick={() => actions.startPacking(next.id)}>
            <Icon name="bag" size={22} /> Start packing
          </button>
        </aside>
      ) : null}
    </div>
  )
}
