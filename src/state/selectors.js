// ---------------------------------------------------------------------------
// SELECTORS - derived data
// ---------------------------------------------------------------------------
// Nothing in this file is stored in state. Progress counts, "which event is
// next", and item ordering are all COMPUTED from the raw events array.
//
// WHY: derived values that are also stored go stale. If `packedCount` lived in
// state, every single action that touches an item would have to remember to
// update it, and one missed case is a bug you'll chase at 3am during the
// hackathon. Computing on render is free at this data size.
// ---------------------------------------------------------------------------

/**
 * The event the user sees first: the soonest one that hasn't finished.
 * Returns undefined when there are no upcoming events - that undefined is what
 * triggers the big empty-state screen.
 */
export function selectNextEvent(events) {
  const now = Date.now()
  return [...events]
    .filter((e) => new Date(e.startsAt).getTime() >= now - 2 * 60 * 60 * 1000) // 2h grace
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0]
}

/** All events, soonest first. Used by the Events tab. */
export function selectSortedEvents(events) {
  return [...events].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
}

/** { packed, total, percent, remaining } across every category of an event. */
export function selectProgress(event) {
  if (!event) return { packed: 0, total: 0, percent: 0, remaining: 0 }
  const items = event.categories.flatMap((c) => c.items)
  const packed = items.filter((i) => i.packed).length
  const total = items.length
  return {
    packed,
    total,
    remaining: total - packed,
    percent: total === 0 ? 0 : Math.round((packed / total) * 100),
  }
}

/** Same shape, for one category - drives the "1 of 4 packed" caption. */
export function selectCategoryProgress(category) {
  const packed = category.items.filter((i) => i.packed).length
  return { packed, total: category.items.length }
}

/**
 * ITEM ORDERING - the "flagged items get priority" requirement.
 *
 * Sort key, highest priority first:
 *   1. flagged and not yet packed  -> the thing you keep forgetting
 *   2. not packed
 *   3. packed (sinks to the bottom, it's done)
 * Within a tier the original author order is preserved, because a stable sort
 * on equal keys keeps input order - so the list doesn't jump around as you tick
 * things off, which would be disorienting for screen-reader users.
 */
export function selectOrderedItems(items) {
  const tier = (i) => (i.flagged && !i.packed ? 0 : i.packed ? 2 : 1)
  return [...items].sort((a, b) => tier(a) - tier(b))
}

/** Every unpacked flagged item across an event - feeds the priority banner. */
export function selectFlaggedItems(event) {
  if (!event) return []
  return event.categories.flatMap((c) =>
    c.items.filter((i) => i.flagged && !i.packed).map((i) => ({ ...i, categoryId: c.id, categoryName: c.name })))
}

/**
 * Flat list used by packing mode and by read-aloud: everything still to pack,
 * flagged first, with its category attached.
 */
export function selectRemainingItems(event) {
  if (!event) return []
  return event.categories
    .flatMap((c) => c.items.map((i) => ({ ...i, categoryId: c.id, categoryName: c.name })))
    .filter((i) => !i.packed)
    .sort((a, b) => Number(b.flagged) - Number(a.flagged))
}

// ---- Presentation helpers -------------------------------------------------
// Formatting lives here rather than inline in components so that date style is
// consistent app-wide and changeable in one place.

export const formatEventDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  })

export const formatEventTime = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/** "in 6 days" / "tomorrow" / "today" - friendlier than a raw date. */
export function formatRelative(iso) {
  const diffMs = new Date(iso).getTime() - Date.now()
  const diffDays = Math.round(diffMs / 86400000)
  if (diffMs < 0) return 'happening now'
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays < 7) return `in ${diffDays} days`
  return `in ${Math.round(diffDays / 7)} week${diffDays >= 14 ? 's' : ''}`
}

/** Turns a reminder offset into both a label and the clock time it will fire. */
export function describeReminder(reminder, eventIso) {
  const mins = reminder.offsetMinutes
  const label =
    mins >= 1440 ? `${Math.round(mins / 1440)} day${mins >= 2880 ? 's' : ''} before`
    : mins >= 60 ? `${Math.round(mins / 60)} hour${mins >= 120 ? 's' : ''} before`
    : `${mins} minutes before`
  const at = new Date(new Date(eventIso).getTime() - mins * 60000)
  return {
    label,
    when: at.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
  }
}

/**
 * Maps a category to one of the five pastel tints by its position, so a new
 * category automatically gets a colour without anyone picking one. Cycles.
 */
export const categoryTone = (index) => `var(--tone-${(index % 5) + 1})`

/** Events get a tint too, by their position in date order, so an event keeps
 *  the same colour on the Events list and the Calendar. */
export const eventTone = (event, events) =>
  categoryTone(Math.max(0, selectSortedEvents(events).findIndex((e) => e.id === event.id)))

/** Local YYYY-MM-DD for a date, used to group events by calendar day. */
export const dayKey = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
