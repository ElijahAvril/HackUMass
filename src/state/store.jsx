// ---------------------------------------------------------------------------
// THE STORE
// ---------------------------------------------------------------------------
// One reducer, one context, one localStorage key. No Redux, no Zustand - for
// an app this size a reducer is less code and zero dependencies.
//
// WHY A REDUCER AND NOT useState EVERYWHERE:
//   Every mutation in PackPal is listed in ONE switch statement below. When a
//   teammate asks "what can change an item?", the answer is a single file they
//   can read in two minutes. Adding a feature = add a case + add a dispatcher.
//
// HOW TO ADD A NEW ACTION:
//   1. add a `case 'YOUR_ACTION':` to reducer()
//   2. add a matching function to the `actions` object at the bottom
//   3. call it from a component via `const { actions } = useStore()`
// ---------------------------------------------------------------------------
import React, {
  createContext, useContext, useEffect, useMemo, useReducer,
} from 'react'
import { seedEvents, seedKits, seedSettings, uid } from './seed.js'

const STORAGE_KEY = 'packpal.v1'

// --- Initial state ---------------------------------------------------------
// Tries localStorage first so your data survives a refresh (and works offline),
// falling back to the seed. The try/catch matters: a corrupted or
// schema-changed blob should never white-screen the app mid-demo.
function loadInitialState() {
  const fallback = {
    events: seedEvents,
    kits: seedKits,
    settings: seedSettings,
    // `ui` holds view state. Kept in the same store so the whole app state is
    // one serialisable object, which makes debugging a matter of one console.log
    ui: { tab: 'next', openEventId: null, packingEventId: null, announcement: '' },
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const saved = JSON.parse(raw)
    return {
      ...fallback,
      ...saved,
      // Merge settings rather than replace, so a setting added in a later
      // version still gets its default for users with an old saved blob.
      settings: { ...fallback.settings, ...(saved.settings || {}) },
      ui: { ...fallback.ui, ...(saved.ui || {}), packingEventId: null },
    }
  } catch (err) {
    console.warn('[PackPal] Could not read saved state, starting fresh.', err)
    return fallback
  }
}

// --- Small immutable helpers ----------------------------------------------
// These keep the reducer readable. Each returns a NEW object/array; never
// mutate state in place or React will skip the re-render.
const mapEvent = (state, eventId, fn) => ({
  ...state,
  events: state.events.map((e) => (e.id === eventId ? fn(e) : e)),
})

const mapCategory = (event, categoryId, fn) => ({
  ...event,
  categories: event.categories.map((c) => (c.id === categoryId ? fn(c) : c)),
})

// --- The reducer -----------------------------------------------------------
function reducer(state, action) {
  switch (action.type) {
    // ---- Navigation -------------------------------------------------------
    case 'SET_TAB':
      return { ...state, ui: { ...state.ui, tab: action.tab, openEventId: action.eventId ?? state.ui.openEventId } }

    case 'OPEN_EVENT':
      return { ...state, ui: { ...state.ui, tab: 'next', openEventId: action.eventId } }

    case 'START_PACKING':
      return { ...state, ui: { ...state.ui, packingEventId: action.eventId } }

    case 'STOP_PACKING':
      return { ...state, ui: { ...state.ui, packingEventId: null } }

    // ---- Events -----------------------------------------------------------
    case 'ADD_EVENT': {
      const event = {
        id: uid('evt'),
        title: action.title,
        startsAt: action.startsAt,
        location: action.location || '',
        reminders: action.reminders || [],
        // New events start with one general category plus any kits applied.
        categories: [
          { id: uid('cat'), name: 'Essentials', kitId: null, items: [] },
          ...(action.kits || []).map((kit) => ({
            id: uid('cat'),
            name: kit.name,
            kitId: kit.id,
            items: kit.items.map((i) => ({
              id: uid('it'), name: i.name, note: i.note || '', packed: false, flagged: false,
            })),
          })),
        ],
      }
      return { ...state, events: [...state.events, event], ui: { ...state.ui, openEventId: event.id, tab: 'next' } }
    }

    case 'REMOVE_EVENT':
      return {
        ...state,
        events: state.events.filter((e) => e.id !== action.eventId),
        ui: {
          ...state.ui,
          openEventId: state.ui.openEventId === action.eventId ? null : state.ui.openEventId,
          packingEventId: state.ui.packingEventId === action.eventId ? null : state.ui.packingEventId,
        },
      }

    case 'UPDATE_EVENT':
      return mapEvent(state, action.eventId, (event) => ({
        ...event,
        ...action.patch,
      }))

    // ---- Categories -------------------------------------------------------
    case 'ADD_CATEGORY':
      return mapEvent(state, action.eventId, (e) => ({
        ...e,
        categories: [...e.categories, { id: uid('cat'), name: action.name, kitId: action.kitId || null, items: action.items || [] }],
      }))

    case 'REMOVE_CATEGORY':
      return mapEvent(state, action.eventId, (e) => ({
        ...e, categories: e.categories.filter((c) => c.id !== action.categoryId),
      }))

    // ---- Items ------------------------------------------------------------
    case 'ADD_ITEM':
      return mapEvent(state, action.eventId, (e) =>
        mapCategory(e, action.categoryId, (c) => ({
          ...c,
          items: [...c.items, {
            id: action.itemId || uid('it'),
            name: action.name,
            note: action.note || '',       // the "where it's kept" line
            packed: false,
            flagged: action.flagged || false,
            flagReason: action.flagReason || '',
          }],
        })))

    case 'REMOVE_ITEM':
      return mapEvent(state, action.eventId, (e) =>
        mapCategory(e, action.categoryId, (c) => ({
          ...c, items: c.items.filter((i) => i.id !== action.itemId),
        })))

    case 'TOGGLE_ITEM':
      return mapEvent(state, action.eventId, (e) =>
        mapCategory(e, action.categoryId, (c) => ({
          ...c,
          items: c.items.map((i) =>
            i.id === action.itemId
              ? { ...i, packed: action.packed ?? !i.packed }
              : i),
        })))

    case 'TOGGLE_FLAG':
      return mapEvent(state, action.eventId, (e) =>
        mapCategory(e, action.categoryId, (c) => ({
          ...c,
          items: c.items.map((i) =>
            i.id === action.itemId
              ? { ...i, flagged: !i.flagged, flagReason: !i.flagged ? (action.reason || 'Marked as a priority') : '' }
              : i),
        })))

    case 'UPDATE_ITEM':
      return mapEvent(state, action.eventId, (e) =>
        mapCategory(e, action.categoryId, (c) => ({
          ...c,
          items: c.items.map((i) => (i.id === action.itemId ? { ...i, ...action.patch } : i)),
        })))

    // ---- Reminders --------------------------------------------------------
    case 'ADD_REMINDER':
      return mapEvent(state, action.eventId, (e) => ({
        ...e, reminders: [...e.reminders, { id: uid('rem'), offsetMinutes: action.offsetMinutes, fired: false }],
      }))

    case 'REMOVE_REMINDER':
      return mapEvent(state, action.eventId, (e) => ({
        ...e, reminders: e.reminders.filter((r) => r.id !== action.reminderId),
      }))

    case 'MARK_REMINDER_FIRED':
      return mapEvent(state, action.eventId, (e) => ({
        ...e, reminders: e.reminders.map((r) => (r.id === action.reminderId ? { ...r, fired: true } : r)),
      }))

    // ---- Kits -------------------------------------------------------------
    case 'SAVE_KIT': {
      // Snapshots a category's current items back into the reusable kit, so
      // next time this kit is applied the list is already filled in.
      const existing = state.kits.find((k) => k.id === action.kitId)
      const payload = { id: action.kitId || uid('kit'), name: action.name, items: action.items }
      return {
        ...state,
        kits: existing
          ? state.kits.map((k) => (k.id === payload.id ? payload : k))
          : [...state.kits, payload],
      }
    }

    case 'REMOVE_KIT':
      return { ...state, kits: state.kits.filter((k) => k.id !== action.kitId) }

    // ---- Settings & announcements ----------------------------------------
    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } }

    // `announcement` feeds a single aria-live region in App.jsx. Centralising
    // it means any action can speak to a screen reader without each component
    // needing its own live region (multiple live regions interrupt each other).
    case 'ANNOUNCE':
      return { ...state, ui: { ...state.ui, announcement: action.message } }

    case 'RESET_ALL':
      return { events: [], kits: state.kits, settings: state.settings,
               ui: { tab: 'events', openEventId: null, packingEventId: null, announcement: 'All events cleared' } }

    default:
      console.warn('[PackPal] Unknown action:', action.type)
      return state
  }
}

// --- Context plumbing ------------------------------------------------------
const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)

  // Persist on every change. Debouncing is unnecessary at this data size and
  // would add a failure mode (lost writes on a fast close).
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }
    catch (err) { console.warn('[PackPal] Could not save state.', err) }
  }, [state])

  // Push the accessibility settings onto <html> so tokens.css can react.
  // This is the ONLY bridge between React state and the theme - no component
  // ever reads `settings.palette` to decide a colour.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.palette = state.settings.palette
    root.dataset.textScale = state.settings.textScale
    root.dataset.reduceMotion = String(state.settings.reduceMotion)
  }, [state.settings])

  // Action creators. Components call these instead of dispatching raw objects,
  // which keeps action-type strings in this file only.
  const actions = useMemo(() => ({
    setTab: (tab, eventId) => dispatch({ type: 'SET_TAB', tab, eventId }),
    openEvent: (eventId) => dispatch({ type: 'OPEN_EVENT', eventId }),
    startPacking: (eventId) => dispatch({ type: 'START_PACKING', eventId }),
    stopPacking: () => dispatch({ type: 'STOP_PACKING' }),

    addEvent: (payload) => dispatch({ type: 'ADD_EVENT', ...payload }),
    removeEvent: (eventId) => dispatch({ type: 'REMOVE_EVENT', eventId }),
    updateEvent: (eventId, patch) => dispatch({ type: 'UPDATE_EVENT', eventId, patch }),

    addCategory: (eventId, name) => dispatch({ type: 'ADD_CATEGORY', eventId, name }),
    // Copies a kit's items into an event as a new category, in ONE dispatch.
    // Copy, not reference: editing the event list must never rewrite the kit.
    applyKit: (eventId, kit) => dispatch({
      type: 'ADD_CATEGORY',
      eventId,
      name: kit.name,
      kitId: kit.id,
      items: kit.items.map((i) => ({
        id: uid('it'), name: i.name, note: i.note || '', packed: false, flagged: false,
      })),
    }),
    removeCategory: (eventId, categoryId) => dispatch({ type: 'REMOVE_CATEGORY', eventId, categoryId }),

    addItem: (eventId, categoryId, name, note, itemId) =>
      dispatch({ type: 'ADD_ITEM', eventId, categoryId, name, note, itemId }),
    removeItem: (eventId, categoryId, itemId) =>
      dispatch({ type: 'REMOVE_ITEM', eventId, categoryId, itemId }),
    toggleItem: (eventId, categoryId, itemId, packed) =>
      dispatch({ type: 'TOGGLE_ITEM', eventId, categoryId, itemId, packed }),
    toggleFlag: (eventId, categoryId, itemId, reason) =>
      dispatch({ type: 'TOGGLE_FLAG', eventId, categoryId, itemId, reason }),
    updateItem: (eventId, categoryId, itemId, patch) =>
      dispatch({ type: 'UPDATE_ITEM', eventId, categoryId, itemId, patch }),

    addReminder: (eventId, offsetMinutes) => dispatch({ type: 'ADD_REMINDER', eventId, offsetMinutes }),
    removeReminder: (eventId, reminderId) => dispatch({ type: 'REMOVE_REMINDER', eventId, reminderId }),
    markReminderFired: (eventId, reminderId) => dispatch({ type: 'MARK_REMINDER_FIRED', eventId, reminderId }),

    saveKit: (kitId, name, items) => dispatch({ type: 'SAVE_KIT', kitId, name, items }),
    removeKit: (kitId) => dispatch({ type: 'REMOVE_KIT', kitId }),

    setSetting: (key, value) => dispatch({ type: 'SET_SETTING', key, value }),
    announce: (message) => dispatch({ type: 'ANNOUNCE', message }),
    resetAll: () => dispatch({ type: 'RESET_ALL' }),
  }), [])

  const value = useMemo(() => ({ state, actions }), [state, actions])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

/** The single hook every component uses to reach state. */
export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
