// ---------------------------------------------------------------------------
// APP - shell, routing and the shared live region
// ---------------------------------------------------------------------------
// Routing is a switch on state.ui.tab rather than React Router. For four
// screens with no URLs to share, a router is a dependency and a build-size
// cost for nothing. If you later want deep links, swap renderTab() for routes
// and nothing else in the app has to change - no component reads the tab.
//
// WHAT THIS FILE OWNS:
//   * which screen is showing
//   * the single aria-live region every component announces through
//   * the reminder scheduler (needs to run app-wide, not per screen)
//   * the empty-state takeover
// ---------------------------------------------------------------------------
import React, { useCallback, useState } from 'react'
import { Sidebar } from './components/Sidebar.jsx'
import { EventView } from './components/EventView.jsx'
import { EventsTab } from './components/EventsTab.jsx'
import { KitsTab } from './components/KitsTab.jsx'
import { SettingsTab } from './components/SettingsTab.jsx'
import { CalendarTab } from './components/CalendarTab.jsx'
import { ProgressCard } from './components/ProgressCard.jsx'
import { RemindersCard } from './components/RemindersCard.jsx'
import { PackingMode } from './components/PackingMode.jsx'
import { EmptyState } from './components/EmptyState.jsx'
import { Icon } from './components/Icon.jsx'
import { useStore } from './state/store.jsx'
import { useReminders } from './hooks/useReminders.js'
import { useSpeech } from './hooks/useSpeech.js'
import {
  formatEventDate, formatEventTime, selectEventsOnDay, selectNextEvent, selectProgress,
} from './state/selectors.js'
import './styles/global.css'

export default function App() {
  const { state, actions } = useStore()
  const speech = useSpeech()
  // In-page banner for a reminder that fires while the app is open - a
  // notification the user might have missed shouldn't vanish silently.
  const [banner, setBanner] = useState(null)

  // ---- Which event are we looking at? ------------------------------------
  // The user may have opened a specific event; otherwise it's the next one up.
  // This is the "first thing you see is the next event" rule, in one line.
  const nextEvent = selectNextEvent(state.events)
  const openEvent =
    state.events.find((e) => e.id === state.ui.openEventId) || nextEvent
  const sameDayEvents = selectEventsOnDay(state.events, openEvent)
  const packingEvent = state.events.find((e) => e.id === state.ui.packingEventId)

  const handleReminder = useCallback((event, reminder, body) => {
    actions.markReminderFired(event.id, reminder.id)
    actions.announce(`Reminder for ${event.title}. ${body}`)
    setBanner({ title: event.title, body, eventId: event.id })
    if (state.settings.speakOnToggle) speech.speak(`Reminder for ${event.title}. ${body}`)
  }, [actions, speech, state.settings.speakOnToggle])

  useReminders(state.events, state.settings.notifications, handleReminder)

  // ---- EMPTY STATE TAKEOVER ----------------------------------------------
  // No events means no rail, no nav clutter - just the oversized button.
  // Settings stays reachable so accessibility options are never locked away.
  if (state.events.length === 0 && state.ui.tab !== 'settings' && state.ui.tab !== 'events') {
    return (
      <>
        <LiveRegion message={state.ui.announcement} />
        <main id="main">
          <EmptyState />
          <p style={{ textAlign: 'center', marginTop: 'var(--sp-5)' }}>
            <button type="button" className="btn btn--ghost" onClick={() => actions.setTab('settings')}>
              <Icon name="settings" size={16} /> Accessibility settings
            </button>
          </p>
        </main>
      </>
    )
  }

  // ---- PACKING MODE TAKEOVER ---------------------------------------------
  // Rendered instead of the shell, not on top of it, so there is nothing
  // behind it for a screen reader or a stray tab press to reach.
  if (packingEvent) {
    return (
      <>
        <LiveRegion message={state.ui.announcement} />
        <main id="main"><PackingMode event={packingEvent} /></main>
      </>
    )
  }

  const renderTab = () => {
    switch (state.ui.tab) {
      case 'events':   return <EventsTab />
      case 'calendar': return <CalendarTab />
      case 'kits':     return <KitsTab />
      case 'settings': return <SettingsTab />
      case 'next':
      default:
        return openEvent
          ? (
            <>
              {sameDayEvents.length > 1 ? (
                <details className="card nextday" open>
                  <summary className="nextday__summary">
                    <strong>{formatEventDate(openEvent.startsAt)} · {sameDayEvents.length} events</strong>
                    <span>Show events on this day</span>
                  </summary>
                  <ul className="dayevents">
                    {sameDayEvents.map((event) => {
                      const progress = selectProgress(event)
                      const selected = event.id === openEvent.id
                      return (
                        <li key={event.id}>
                          <button
                            type="button"
                            className="dayevents__btn"
                            aria-current={selected ? 'true' : undefined}
                            onClick={() => actions.openEvent(event.id)}
                          >
                            <strong>{event.title}{selected ? ' · Currently open' : ''}</strong>
                            <span>
                              {formatEventTime(event.startsAt)}
                              {event.location ? ` · ${event.location}` : ''}
                              {` · ${progress.packed} of ${progress.total} packed`}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </details>
              ) : null}
              <EventView event={openEvent} />
            </>
          )
          : <EmptyState />
    }
  }

  // The rail only makes sense beside a specific event's list.
  const showRail = openEvent && (state.ui.tab === 'next')

  return (
    <>
      <LiveRegion message={state.ui.announcement} />

      {banner ? (
        <div className="reminderbanner" role="status">
          <Icon name="bell" size={18} />
          <span><strong>{banner.title}</strong> — {banner.body}</span>
          <button type="button" className="icon-btn" onClick={() => setBanner(null)}>
            <Icon name="close" size={16} /><span className="sr-only">Dismiss reminder</span>
          </button>
        </div>
      ) : null}

      <div className={`shell ${showRail ? '' : 'shell--norail'}`}>
        <div className="shell__nav"><Sidebar /></div>

        <main className="shell__main" id="main">{renderTab()}</main>

        {showRail ? (
          <aside className="shell__rail" aria-label="Packing summary">
            <ProgressCard progress={selectProgress(openEvent)} title={openEvent.title} />

            {/* The always-present Start packing button. */}
            <button
              type="button"
              className="btn btn--primary startbtn"
              onClick={() => actions.startPacking(openEvent.id)}
            >
              <Icon name="bag" size={22} /> Start packing
            </button>

            <RemindersCard event={openEvent} />

            {/* Contextual tip, shown only when there is actually a kit in play
                - a tip about a feature you aren't using is just noise. */}
            {openEvent.categories.some((c) => c.kitId) ? (
              <section className="panel card tip">
                <h2 className="tip__title">These lists come from kits</h2>
                <p>
                  Anything you add here can be saved back, so the next event of
                  the same kind starts already filled in.
                </p>
                <button type="button" className="btn" onClick={() => actions.setTab('kits')}>
                  <Icon name="star" size={16} /> Open My kits
                </button>
              </section>
            ) : null}
          </aside>
        ) : null}
      </div>
    </>
  )
}

/**
 * THE SINGLE LIVE REGION.
 * Screen readers announce changes inside an aria-live element. Having exactly
 * one, here at the root, means announcements queue politely instead of several
 * regions talking over each other. Any component can speak to it with
 * actions.announce('…').
 */
function LiveRegion({ message }) {
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  )
}
