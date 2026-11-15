// ---------------------------------------------------------------------------
// EVENT VIEW - the "first thing you see": the next event and its lists
// ---------------------------------------------------------------------------
// Composed of small pieces rather than written as one big component:
//   EventHeader  - title, date, location (also reused by the Events tab)
//   PriorityBanner - the flagged-items summary
//   CategoryCard - repeated per list
// Each is independently editable, and the header can move without dragging
// the checklist logic along with it.
// ---------------------------------------------------------------------------
import React, { useState } from 'react'
import { Icon } from './Icon.jsx'
import { CategoryCard } from './CategoryCard.jsx'
import { PackingAssistantButton } from './PackingAssistantButton.jsx'
import { EventForm } from './EventsTab.jsx'
import { useStore } from '../state/store.jsx'
import { useSpeech } from '../hooks/useSpeech.js'
import {
  formatEventDate, formatEventTime, formatRelative,
  selectFlaggedItems, selectRemainingItems,
} from '../state/selectors.js'
import './Views.css'

/** Reused in both the event view and each row of the Events tab. */
export function EventHeader({ event, compact = false }) {
  return (
    <div className={`evhead ${compact ? 'evhead--compact' : ''}`}>
      {!compact ? <span className="tape tape--left" aria-hidden="true" /> : null}
      <h1 className="evhead__title">{event.title}</h1>
      <p className="evhead__meta">
        <span className="evhead__chunk">
          <Icon name="clock" size={16} />
          <span className="evhead__mono">
            {formatEventDate(event.startsAt)} · {formatEventTime(event.startsAt, event.isAllDay)}
          </span>
        </span>
        {event.location ? (
          <span className="evhead__chunk"><Icon name="pin" size={16} />{event.location}</span>
        ) : null}
        <span className="evhead__rel">{formatRelative(event.startsAt, event.isAllDay)}</span>
      </p>
    </div>
  )
}

/** Summary of everything flagged, so priorities are visible before scrolling. */
function PriorityBanner({ items, onJump }) {
  if (!items.length) return null
  return (
    <aside className="priority" aria-labelledby="priority-heading">
      <h2 className="priority__title" id="priority-heading">
        <Icon name="warning" size={18} />
        Don&apos;t forget {items.length === 1 ? 'this' : `these ${items.length}`}
      </h2>
      <ul className="priority__list">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className="priority__item" onClick={() => onJump(item.categoryId)}>
              <strong>{item.name}</strong>
              {item.note ? <span> — {item.note}</span> : null}
              <span className="priority__cat">in {item.categoryName}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}

export function EventView({ event }) {
  const { actions } = useStore()
  const speech = useSpeech()
  const [addingList, setAddingList] = useState(false)
  const [listName, setListName] = useState('')
  const [editingEvent, setEditingEvent] = useState(false)

  const flagged = selectFlaggedItems(event)
  const remaining = selectRemainingItems(event)

  /**
   * READ LIST ALOUD.
   * Builds one line per item, flagged first, including the location note -
   * which is the whole point: "Laptop charger. Kept in the top drawer."
   */
  const readAloud = () => {
    if (!remaining.length) {
      speech.speak(`Everything is packed for ${event.title}.`)
      return
    }
    const lines = [
      `${remaining.length} item${remaining.length === 1 ? '' : 's'} still to pack for ${event.title}.`,
      ...remaining.map((item) => {
        const priority = item.flagged ? 'Priority. ' : ''
        const where = item.note ? `. Kept: ${item.note}` : ''
        return `${priority}${item.name}${where}`
      }),
    ]
    speech.speakSequence(lines)
  }

  return (
    <div className="stack">
      <header className="card evhead__card">
        <EventHeader event={event} />

        <div className="evhead__tools">
          {speech.supported ? (
            <button
              type="button"
              className="btn"
              onClick={speech.speaking ? speech.stop : readAloud}
            >
              <Icon name={speech.speaking ? 'stop' : 'speaker'} size={18} />
              {speech.speaking ? 'Stop reading' : 'Read list aloud'}
            </button>
          ) : null}
          <button type="button" className="btn" onClick={() => setEditingEvent((v) => !v)}
                  aria-expanded={editingEvent}>
            <Icon name="pencil" size={18} /> Edit event
          </button>
          <PackingAssistantButton event={event} />
          <button type="button" className="btn" onClick={() => actions.setTab('events')}>
            <Icon name="calendar" size={18} /> All events
          </button>
        </div>
      </header>

      {editingEvent ? (
        <EventForm key={event.id} event={event} onDone={() => setEditingEvent(false)} />
      ) : null}

      <PriorityBanner
        items={flagged}
        onJump={(categoryId) => {
          // Scroll + focus, so keyboard users land where sighted users look.
          const el = document.getElementById(`cat-${categoryId}`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el?.focus?.()
        }}
      />

      {event.categories.map((category, index) => (
        <CategoryCard key={category.id} event={event} category={category} index={index} />
      ))}

      {/* Adding a list is a progressive disclosure: a single button until you
          need it, so the page isn't permanently carrying an empty form. */}
      {addingList ? (
        <form
          className="card newlist"
          onSubmit={(e) => {
            e.preventDefault()
            if (!listName.trim()) return
            actions.addCategory(event.id, listName.trim())
            actions.announce(`${listName.trim()} list added`)
            setListName(''); setAddingList(false)
          }}
        >
          <label className="field">
            <span>Name this list (for example: Toiletries, Day bag)</span>
            <input className="input" value={listName} autoFocus
                   onChange={(e) => setListName(e.target.value)} />
          </label>
          <div className="row" style={{ marginTop: 'var(--sp-3)' }}>
            <button type="submit" className="btn btn--primary"><Icon name="plus" size={18} /> Add list</button>
            <button type="button" className="btn btn--ghost" onClick={() => setAddingList(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn newlist__trigger" onClick={() => setAddingList(true)}>
          <Icon name="plus" size={18} /> Add another list
        </button>
      )}
    </div>
  )
}
