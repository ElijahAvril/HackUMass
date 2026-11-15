import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatEventTime, selectEventsOnDay, selectNextEvent, selectSortedEvents,
} from '../src/state/selectors.js'

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

test('sorts an all-day event before timed events on the same day', () => {
  const events = [
    { id: 'afternoon', startsAt: '2026-11-14T15:00:00' },
    { id: 'timed-morning', startsAt: '2026-11-14T08:00:00' },
    { id: 'all-day', startsAt: '2026-11-14T00:00:00', isAllDay: true },
    { id: 'next-day', startsAt: '2026-11-15T00:00:00', isAllDay: true },
  ]

  assert.deepEqual(
    selectSortedEvents(events).map((event) => event.id),
    ['all-day', 'timed-morning', 'afternoon', 'next-day'],
  )
})

test('keeps today’s all-day event as the next event for the whole day', () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const allDay = {
    id: 'all-day',
    startsAt: today.toISOString(),
    isAllDay: true,
  }
  const timedLater = {
    id: 'timed-later',
    startsAt: new Date(today.getTime() + 23 * 60 * 60 * 1000).toISOString(),
  }

  assert.equal(selectNextEvent([timedLater, allDay]).id, allDay.id)
})

test('labels all-day events without showing a clock time', () => {
  assert.equal(formatEventTime('2026-11-14T00:00:00.000Z', true), 'All day')
})
