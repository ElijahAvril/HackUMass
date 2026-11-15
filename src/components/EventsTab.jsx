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
  formatEventTimeOf, formatRelativeOf, dayKey,
} from '../state/selectors.js'
import { suggestKits } from '../state/suggestKits.js'
import { TimeSelect, ALL_DAY, timeOf } from './TimeSelect.jsx'
import { DatePicker } from './DatePicker.jsx'
import './Views.css'

/** "2026-11-20" in the user's own timezone (not UTC). */
const dateOf = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * The event form. Two modes:
 *   <EventForm />               - "Add an event" (blank, with kit picker)
 *   <EventForm event={event} /> - "Edit event" (filled in; lists, items and
 *                                 reminders are kept exactly as they are)
 */
export function EventForm({ onDone, initialDate = '', event = null }) {
  const { state, actions } = useStore()
  const editing = !!event
  const [title, setTitle] = useState(event?.title || '')
  const [date, setDate] = useState(event ? dateOf(event.startsAt) : initialDate)
  const [time, setTime] = useState(event ? (event.allDay ? ALL_DAY : timeOf(event.startsAt)) : '09:00')
  const [location, setLocation] = useState(event?.location || '')
  const formId = event?.id || 'new'
  const [dateMissing, setDateMissing] = useState(false)
  // Kits chosen here are copied into the new event as ready-made lists.
  const [kitIds, setKitIds] = useState([])
    // Kits that fit this title go first and get a "Suggested" label
  const suggestedIds = suggestKits(title, state.kits, state.events).map((k) => k.id)
  const sortedKits = [...state.kits].sort(
    (a, b) => suggestedIds.includes(b.id) - suggestedIds.includes(a.id))

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    if (!date) { setDateMissing(true); actions.announce('Please choose a date'); return }
    // Build a local-time ISO string. `new Date('2026-11-20T10:00')` without a
    // Z suffix is parsed in the user's own timezone, which is what we want.
    // All-day events start at midnight and show "All day" instead of a time.
    const allDay = time === ALL_DAY
    const startsAt = new Date(`${date}T${allDay ? '00:00' : (time || '09:00')}`).toISOString()

    if (editing) {
      const patch = { title: title.trim(), startsAt, allDay, location: location.trim() }
      // New time = the reminders should be able to ring again.
      if (startsAt !== event.startsAt) {
        patch.reminders = event.reminders.map((r) => ({ ...r, fired: false }))
      }
      actions.updateEvent(event.id, patch)
      actions.announce(`${title.trim()} saved`)
      onDone?.()
      return
    }

    actions.addEvent({
      title: title.trim(),
      startsAt,
      allDay,
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
    <form className={`card eventform ${editing ? 'eventform--edit' : ''}`} onSubmit={submit}
          aria-label={editing ? `Edit ${event.title}` : 'Add an event'}>
      <h2 className="panel__title">{editing ? 'Edit event' : 'Add an event'}</h2>

      <label className="field">
        <span>What is it?</span>
        <input className="input" value={title} autoFocus placeholder="Job interview"
               onChange={(e) => setTitle(e.target.value)} required />
      </label>

      <div className="eventform__grid">
        <div className="field">
          <span id={`date-label-${formId}`}>Date</span>
          <DatePicker labelId={`date-label-${formId}`} value={date}
                      onChange={(d) => { setDate(d); setDateMissing(false) }}
                      markedDays={state.events.map((ev) => dayKey(ev.startsAt))} />
          {dateMissing ? <p className="field__error">Please choose a date.</p> : null}
        </div>
        <div className="field">
          <span id={`time-label-${formId}`}>Time</span>
          <TimeSelect labelId={`time-label-${formId}`} value={time} onChange={setTime} />
        </div>
      </div>

      <label className="field">
        <span>Where? (optional)</span>
        <input className="input" value={location} placeholder="Boston Regional Office"
               onChange={(e) => setLocation(e.target.value)} />
      </label>

      {/* Kit picker: checkboxes in a fieldset so screen readers announce the
          group name once instead of repeating it per option. */}
      {state.kits.length && !editing ? (
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
        <button type="submit" className="btn btn--primary">
          <Icon name={editing ? 'check' : 'plus'} size={18} /> {editing ? 'Save changes' : 'Add event'}
        </button>
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
  const [editingId, setEditingId] = useState(null)
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
              if (editingId === event.id) {
                return (
                  <li key={event.id}>
                    <EventForm event={event} onDone={() => setEditingId(null)} />
                  </li>
                )
              }
              return (
                <li key={event.id} className="card agrow">
                  <DateBlock iso={event.startsAt} tone={eventTone(event, state.events)} />

                  <div className="agrow__main">
                    <h3 className="agrow__title">{event.title}</h3>
                    <p className="agrow__meta">
                      <span><Icon name="clock" size={15} /> {formatEventTimeOf(event)} · {formatRelativeOf(event)}</span>
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
                      <button type="button" className="btn btn--ghost" onClick={() => setEditingId(event.id)}>
                        <Icon name="pencil" size={16} /> Edit<span className="sr-only"> {event.title}</span>
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
          <p className="eyebrow">Next up · {formatRelativeOf(next)}</p>
          <h2 className="nextup__title" id="nextup-heading">{next.title}</h2>
          <p className="nextup__when">
            {new Date(next.startsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {formatEventTimeOf(next)}
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
