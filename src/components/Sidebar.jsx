// ---------------------------------------------------------------------------
// SIDEBAR / PRIMARY NAVIGATION
// ---------------------------------------------------------------------------
// One component renders BOTH the desktop left rail and the mobile bottom bar.
// The difference is entirely CSS (see Sidebar.css) - same markup, same tab
// order, same ARIA. Two separate nav components would mean two places to add a
// tab and two places to get the focus order wrong.
//
// TO ADD A TAB: add an entry to TABS below and a case to renderTab() in App.jsx.
// ---------------------------------------------------------------------------
import React from 'react'
import { Icon } from './Icon.jsx'
import { useStore } from '../state/store.jsx'
import './Sidebar.css'

const TABS = [
  { id: 'next',     label: 'Next up', icon: 'bag' },
  { id: 'events',   label: 'Events',  icon: 'calendar' },
  { id: 'calendar', label: 'Calendar', icon: 'grid' },
  { id: 'kits',     label: 'My kits', icon: 'star' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

export function Sidebar() {
  const { state, actions } = useStore()
  const current = state.ui.tab

  return (
    <nav className="sidebar" aria-label="Main">
      {/* Wordmark is hidden on mobile where the bottom bar has no room. */}
      <div className="sidebar__brand">
        <span className="sidebar__mark" aria-hidden="true"><Icon name="bag" size={22} /></span>
        <span className="sidebar__name">PackPal</span>
      </div>

      <ul className="sidebar__list">
        {TABS.map((tab) => {
          const active = current === tab.id
          return (
            <li key={tab.id}>
              <button
                type="button"
                className={`sidebar__link ${active ? 'is-active' : ''}`}
                onClick={() => actions.setTab(tab.id)}
                // aria-current is how a screen reader announces "this is the
                // page you're on". Colour alone would not convey it.
                aria-current={active ? 'page' : undefined}
              >
                <Icon name={tab.icon} size={20} />
                <span>{tab.label}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Dashed "new" button: always one click from anywhere in the app. */}
      <button type="button" className="sidebar__new" onClick={() => actions.openNewEvent()} title="New event">
        <Icon name="plus" size={20} strokeWidth={2.2} />
        <span className="sidebar__newlabel">New event</span>
      </button>
    </nav>
  )
}
