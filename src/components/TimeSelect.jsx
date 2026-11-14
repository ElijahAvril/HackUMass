// ---------------------------------------------------------------------------
// TIME SELECT - "All day" or a time, in the app's own dropdown style
// ---------------------------------------------------------------------------
// Replaces <input type="time">. The browser's clock picker looks different in
// every browser and can be fiddly with a keyboard or screen reader; a plain
// list ("All day", "9:00 AM", "9:15 AM"...) is the same everywhere and lets
// you jump by typing ("9" then "3" lands on 9:30).
//
// Value is "HH:MM" (24-hour, like the old input) or ALL_DAY.
// ---------------------------------------------------------------------------
import React, { useMemo } from 'react'

export const ALL_DAY = 'all-day'

const pad = (n) => String(n).padStart(2, '0')
const label = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Every 15 minutes, midnight to 11:45 PM. */
const QUARTER_HOURS = Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`)

export function TimeSelect({ id, value, onChange }) {
  // If an event was set to, say, 9:10, keep that exact time in the list.
  const times = useMemo(
    () => (value && value !== ALL_DAY && !QUARTER_HOURS.includes(value)
      ? [...QUARTER_HOURS, value].sort()
      : QUARTER_HOURS),
    [value],
  )

  return (
    <select id={id} className="select timeselect" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value={ALL_DAY}>All day</option>
      <option disabled>──────────</option>
      {times.map((t) => <option key={t} value={t}>{label(t)}</option>)}
    </select>
  )
}
