// ---------------------------------------------------------------------------
// EMPTY STATE - what you see when there are no events at all
// ---------------------------------------------------------------------------
// The requirement: "Always a Start packing button; if there are no events it
// is bigger and the only thing you see."
//
// So this screen hides the rail, the progress card and the month strip, and
// shows one enormous button. Pressing it doesn't dead-end into "please create
// an event first" - it creates a quick unscheduled list for today and drops
// you straight into it. Getting someone packing in one tap is the whole point
// of the product; making them fill in a date form first would betray it.
// ---------------------------------------------------------------------------
import React from 'react'
import { Icon } from './Icon.jsx'
import { useStore } from '../state/store.jsx'
import './Views.css'

export function EmptyState() {
  const { state, actions } = useStore()

  const startQuickList = () => {
    const startsAt = new Date()
    startsAt.setHours(startsAt.getHours() + 3, 0, 0, 0)
    actions.addEvent({
      title: 'Quick packing list',
      startsAt: startsAt.toISOString(),
      location: '',
      reminders: [],
      // Pre-load every saved kit, so a returning user's quick list is already
      // useful rather than an empty page.
      kits: state.kits,
    })
    actions.announce('Quick packing list started')
  }

  return (
    <div className="empty">
      <span className="tape tape--left" aria-hidden="true" />

      <h1 className="empty__title">Nothing to pack yet</h1>
      <p className="empty__sub">
        Start a list now, or add an event and Packuroo will remind you before it.
      </p>

      {/* The oversized, single, obvious action. */}
      <button type="button" className="btn btn--primary empty__cta" onClick={startQuickList}>
        <Icon name="bag" size={34} strokeWidth={2} />
        Start packing
      </button>

      <button type="button" className="btn empty__secondary" onClick={() => actions.setTab('events')}>
        <Icon name="calendar" size={18} /> Add an event instead
      </button>
    </div>
  )
}
