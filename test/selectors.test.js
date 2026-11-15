import assert from 'node:assert/strict'
import test from 'node:test'
import { selectEventsOnDay } from '../src/state/selectors.js'

test('selects same-day events in chronological order', () => {
  const events = [
    { id: 'later-day', startsAt: '2026-11-16T09:00:00' },
    { id: 'afternoon', startsAt: '2026-11-14T15:00:00' },
    { id: 'morning', startsAt: '2026-11-14T09:00:00' },
  ]

  assert.deepEqual(
    selectEventsOnDay(events, events[1]).map((event) => event.id),
    ['morning', 'afternoon'],
  )
})

test('returns no events when there is no reference event', () => {
  assert.deepEqual(selectEventsOnDay([{ id: 'event', startsAt: '2026-11-14T09:00:00' }]), [])
})
