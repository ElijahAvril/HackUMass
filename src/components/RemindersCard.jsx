// ---------------------------------------------------------------------------
// REMINDERS CARD
// ---------------------------------------------------------------------------
// Lists the reminders attached to an event and lets the user add or remove
// them. Offsets are stored in MINUTES in state and turned into human labels by
// describeReminder() in selectors.js - so adding a "1 week before" option is
// one entry in PRESETS below, with no parsing code to write.
// ---------------------------------------------------------------------------
import React, { useState } from 'react'
import { Icon } from './Icon.jsx'
import { Dropdown } from './Dropdown.jsx'
import { useStore } from '../state/store.jsx'
import { describeReminder } from '../state/selectors.js'
import { requestNotificationPermission } from '../hooks/useReminders.js'
import './Panels.css'

const PRESETS = [
  { label: '1 week before', minutes: 10080 },
  { label: '1 day before', minutes: 1440 },
  { label: '2 hours before', minutes: 120 },
  { label: '45 minutes before', minutes: 45 },
  { label: '15 minutes before', minutes: 15 },
]

export function RemindersCard({ event }) {
  const { state, actions } = useStore()
  const [editing, setEditing] = useState(false)

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission()
    actions.setSetting('notifications', granted)
    actions.announce(granted ? 'Reminders switched on' : 'Notification permission was refused')
  }

  const sorted = [...event.reminders].sort((a, b) => b.offsetMinutes - a.offsetMinutes)

  return (
    <section className="panel card" aria-labelledby="reminders-heading">
      <h2 className="panel__title" id="reminders-heading">Reminders</h2>

      {sorted.length === 0 ? (
        <p className="panel__empty">No reminders set for this event.</p>
      ) : (
        <ul className="reminders">
          {sorted.map((reminder) => {
            const { label, when } = describeReminder(reminder, event.startsAt)
            return (
              <li key={reminder.id} className="reminders__row">
                <Icon name="bell" size={18} />
                <span className="reminders__text">
                  <strong>{label}</strong>
                  <span className="reminders__when">{when}</span>
                </span>
                {editing ? (
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    onClick={() => {
                      actions.removeReminder(event.id, reminder.id)
                      actions.announce(`${label} reminder removed`)
                    }}
                  >
                    <Icon name="trash" size={16} />
                    <span className="sr-only">Remove the {label} reminder</span>
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <p className="panel__hint">Every reminder lists the items themselves.</p>

      {editing ? (
        <div className="reminders__add">
          <div className="field">
            <span id={`rem-add-${event.id}`}>Add a reminder</span>
            <Dropdown
              labelId={`rem-add-${event.id}`}
              value=""
              placeholder="Choose a time…"
              options={PRESETS.map((preset) => ({ value: preset.minutes, label: preset.label, icon: 'bell' }))}
              onChange={(minutes) => {
                actions.addReminder(event.id, minutes)
                const preset = PRESETS.find((p) => p.minutes === minutes)
                actions.announce(`${preset?.label || 'Reminder'} added`)
              }}
            />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="btn panel__action"
        onClick={() => setEditing((v) => !v)}
        aria-expanded={editing}
      >
        <Icon name="pencil" size={16} /> {editing ? 'Done' : 'Change reminders'}
      </button>

      {/* Only shown until permission is granted, then it disappears for good. */}
      {!state.settings.notifications ? (
        <button type="button" className="btn btn--ghost panel__action panel__action--sub" onClick={enableNotifications}>
          <Icon name="bell" size={16} /> Turn on notifications
        </button>
      ) : null}
    </section>
  )
}
