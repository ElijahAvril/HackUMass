// ---------------------------------------------------------------------------
// MY KITS - the reusable templates
// ---------------------------------------------------------------------------
// A kit is just { id, name, items: [{name, note}] }. It has no packed state,
// because a template is never "packed" - packed-ness belongs to an event.
// Keeping those two shapes separate is what stops last week's ticks leaking
// into next week's interview.
// ---------------------------------------------------------------------------
import React, { useState } from 'react'
import { Icon } from './Icon.jsx'
import { Dropdown } from './Dropdown.jsx'
import { useStore } from '../state/store.jsx'
import { selectSortedEvents } from '../state/selectors.js'
import './Views.css'

/** Small form to add one item to a saved kit. */
function KitItemForm({ kit }) {
  const { actions } = useStore()
  const [name, setName] = useState('')
  const [note, setNote] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    if (kit.items.some((i) => i.name.trim().toLowerCase() === clean.toLowerCase())) {
      actions.announce(`${clean} is already in ${kit.name}`)
      return
    }
    actions.editKit(kit.id, [...kit.items, { name: clean, note: note.trim() }])
    actions.announce(`${clean} added to ${kit.name}`)
    setName('')
    setNote('')
  }

  return (
    <form onSubmit={submit}>
      <div className="row">
        <label className="field">
          <span>Add an item to {kit.name}</span>
          <input className="input" value={name} placeholder="Water bottle"
                 onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Where it's kept (optional)</span>
          <input className="input" value={note} placeholder="Kitchen counter"
                 onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          <Icon name="plus" size={18} /> Add
        </button>
      </div>
    </form>
  )
}

export function KitsTab() {
  const { state, actions } = useStore()
  const [newKit, setNewKit] = useState('')
  const events = selectSortedEvents(state.events)

  return (
    <div className="stack">
      <div className="row">
        <h1 className="page__title">My kits</h1>
      </div>

      <p className="card panel__hint" style={{ margin: 0 }}>
        A kit is a list you reuse. Apply one to an event and it arrives already
        filled in, notes and all — then tick things off without retyping them.
      </p>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          if (!newKit.trim()) return
          actions.saveKit(null, newKit.trim(), [])
          actions.announce(`${newKit.trim()} kit created`)
          setNewKit('')
        }}
      >
        <label className="field">
          <span>Create an empty kit</span>
          <div className="row">
            <input className="input" value={newKit} placeholder="Gym bag"
                   onChange={(e) => setNewKit(e.target.value)} />
            <button type="submit" className="btn btn--primary" disabled={!newKit.trim()}>
              <Icon name="plus" size={18} /> Create
            </button>
          </div>
        </label>
      </form>

      {state.kits.length === 0 ? (
        <p className="card panel__empty">No kits yet.</p>
      ) : (
        state.kits.map((kit) => (
          <section key={kit.id} className="card kit" aria-labelledby={`kit-${kit.id}`}>
            <div className="row">
              <h2 className="kit__name" id={`kit-${kit.id}`}>
                <Icon name="star" size={18} /> {kit.name}
              </h2>
              <span className="spacer" />
              <span className="category__count">{kit.items.length} items</span>
            </div>

            {kit.items.length ? (
              <ul className="kit__items">
                {kit.items.map((item, i) => (
                  <li key={`${kit.id}-${i}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ flex: 1 }}>
                      <strong>{item.name}</strong>
                      {item.note ? <span className="item__note"> — {item.note}</span> : null}
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--danger"
                      onClick={() => {
                        actions.editKit(kit.id, kit.items.filter((_, index) => index !== i))
                        actions.announce(`${item.name} removed from ${kit.name}`)
                      }}
                    >
                      <Icon name="trash" size={16} /> Remove<span className="sr-only"> {item.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel__empty">
                Empty for now. Add your first item below.                “Save these back to the kit”.
              </p>
            )}

            <KitItemForm kit={kit} />

            <div className="kit__actions">
              {events.length ? (
                <div className="field kit__apply">
                  <Dropdown
                    ariaLabel={`Add ${kit.name} to an event`}
                    value=""
                    placeholder="Add to an event…"
                    options={events.map((event) => ({ value: event.id, label: event.title, icon: 'calendar' }))}
                    onChange={(eventId) => {
                      const event = state.events.find((ev) => ev.id === eventId)
                      // One dispatch builds the category AND its items.
                      actions.applyKit(eventId, kit)
                      actions.announce(`${kit.name} added to ${event?.title || 'the event'}`)
                    }}
                  />
                </div>
              ) : null}

              <button
                type="button"
                className="btn btn--ghost btn--danger"
                onClick={() => {
                  if (window.confirm(`Delete the "${kit.name}" kit? This is permanent and can't be undone. Lists already added to events will stay.`)) {                    actions.removeKit(kit.id)
                    actions.announce(`${kit.name} kit deleted`)
                  }
                }}
              >
                <Icon name="trash" size={16} /> Delete kit
              </button>
            </div>
          </section>
        ))
      )}
    </div>
  )
}
