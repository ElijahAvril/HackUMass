// ---------------------------------------------------------------------------
// CALENDAR TAB - a full month grid plus a "selected day" card
// ---------------------------------------------------------------------------
// Custom rather than FullCalendar: FullCalendar is ~200kB and brings its own
// DOM and focus behaviour that we would have to re-audit for accessibility.
// This is one grid of real <button>s, each with a full spoken label
// ("Saturday, November 14, today, 1 event: Job interview").
//
// On narrow screens the coloured event labels collapse into dots (CSS only),
// so the grid stays readable on a phone.
// ---------------------------------------------------------------------------
import React, { useMemo, useState } from 'react'
import { Icon } from './Icon.jsx'
import { useStore } from '../state/store.jsx'
import {
  selectSortedEvents, selectProgress, eventTone, dayKey, formatEventTime,
} from '../state/selectors.js'
import './Views.css'

const longDay = (d) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

export function CalendarTab() {
  const { state, actions } = useStore()
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState(dayKey(today))
  const events = selectSortedEvents(state.events)

  // Group events by local day once per render of the month.
  const byDay = useMemo(() => {
    const map = new Map()
    events.forEach((e) => {
      const key = dayKey(e.startsAt)
      map.set(key, [...(map.get(key) || []), e])
    })
    return map
  }, [events])

  const first = new Date(cursor.y, cursor.m, 1)
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const leading = first.getDay()
  const trailing = (7 - ((leading + daysInMonth) % 7)) % 7
  const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const move = (delta) => setCursor(({ y, m }) => {
    const d = new Date(y, m + delta, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const selectedDate = new Date(`${selected}T12:00`)
  const selectedEvents = byDay.get(selected) || []

  return (
    <div className="stack">
      <header className="card evhead__card cal__head">
        <span className="tape tape--left" aria-hidden="true" />
        <div>
          <p className="eyebrow">Month view</p>
          <h1 className="page__title">Calendar</h1>
        </div>
        <div className="cal__nav">
          <button type="button" className="btn" onClick={() => move(-1)}>
            <Icon name="back" size={18} /><span className="sr-only">Previous month</span>
          </button>
          <h2 className="cal__month" aria-live="polite">{monthLabel}</h2>
          <button type="button" className="btn" onClick={() => move(1)}>
            <Icon name="forward" size={18} /><span className="sr-only">Next month</span>
          </button>
          <button
            type="button" className="btn"
            onClick={() => { setCursor({ y: today.getFullYear(), m: today.getMonth() }); setSelected(dayKey(today)) }}
          >
            Today
          </button>
        </div>
      </header>

      <div className="split">
        <section className="card cal__card" aria-label={`Days of ${monthLabel}`}>
          <div className="cal">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <span key={d} className="cal__dow" aria-hidden="true">{d}</span>
            ))}
            {Array.from({ length: leading }, (_, i) => <span key={`a${i}`} className="cal__blank" aria-hidden="true" />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const date = new Date(cursor.y, cursor.m, i + 1)
              const key = dayKey(date)
              const dayEvents = byDay.get(key) || []
              const isToday = key === dayKey(today)
              const label = `${longDay(date)}${isToday ? ', today' : ''}, ${
                dayEvents.length ? `${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}: ${dayEvents.map((e) => e.title).join(', ')}` : 'no events'}`
              return (
                <button
                  key={key} type="button"
                  className={`cal__day ${isToday ? 'is-today' : ''}`}
                  aria-pressed={selected === key}
                  aria-label={label}
                  onClick={() => setSelected(key)}
                >
                  <span className="cal__num" aria-hidden="true">{i + 1}</span>
                  {dayEvents.slice(0, 2).map((e) => (
                    <span key={e.id} className="cal__chip" style={{ background: eventTone(e, state.events) }} aria-hidden="true">
                      {formatEventTime(e.startsAt, e.isAllDay).replace(':00', '')} {e.title}
                    </span>
                  ))}
                  {dayEvents.length > 2 ? <span className="cal__more" aria-hidden="true">+{dayEvents.length - 2} more</span> : null}
                  {dayEvents.length ? (
                    <span className="cal__dots" aria-hidden="true">
                      {dayEvents.slice(0, 3).map((e) => (
                        <span key={e.id} className="cal__dot" style={{ background: eventTone(e, state.events) }} />
                      ))}
                    </span>
                  ) : null}
                </button>
              )
            })}
            {Array.from({ length: trailing }, (_, i) => <span key={`b${i}`} className="cal__blank" aria-hidden="true" />)}
          </div>
        </section>

        <aside className="card panel" aria-labelledby="day-heading">
          <span className="tape tape--right" aria-hidden="true" />
          <p className="eyebrow">{selected === dayKey(today) ? 'Today' : 'Selected day'}</p>
          <h2 className="nextup__title" id="day-heading">{longDay(selectedDate)}</h2>

          {selectedEvents.length ? (
            <ul className="dayevents">
              {selectedEvents.map((e) => {
                const p = selectProgress(e)
                return (
                  <li key={e.id}>
                    <button
                      type="button" className="dayevents__btn"
                      style={{ borderLeftColor: eventTone(e, state.events) }}
                      onClick={() => actions.openEvent(e.id)}
                    >
                      <strong>{e.title}</strong>
                      <span>{formatEventTime(e.startsAt, e.isAllDay)} · {p.packed} of {p.total} packed</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : <p className="panel__empty">Nothing planned.</p>}

          <button type="button" className="btn panel__action" onClick={() => actions.openNewEvent(selected)}>
            <Icon name="plus" size={18} /> Add event on this day
          </button>
        </aside>
      </div>
    </div>
  )
}
