# PackPal

An accessible, installable packing-checklist PWA. Every event carries its own
packing list; lists you repeat become reusable **kits**.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build (needed to test "Install app")
```

Install prompt appears in Chrome/Edge desktop and "Add to Home Screen" on
mobile once you serve over https or localhost.

## Where things live

```
src/
  main.jsx              Mounts React, wraps everything in the store.
  App.jsx               Shell, tab switching, the single aria-live region,
                        reminder scheduling, empty-state + packing takeovers.
  state/
    seed.js             Demo data + the data-shape contract. Empty the events
                        array to test the "no events" screen.
    store.jsx           ONE reducer. Every mutation in the app is a case here.
    selectors.js        Derived data: next event, progress, item ordering,
                        date formatting. Nothing here is stored in state.
  hooks/
    useSpeech.js        Text to speech (read list aloud).
    useDictation.js     Speech to text (dictate items, voice commands).
    useReminders.js     Schedules notifications before an event.
  styles/
    tokens.css          Every colour/size/font as a variable. Colour-blind
                        mode is a palette override at the bottom of this file.
    global.css          Layout, .card, .btn, focus rings, shared primitives.
  components/           One file per component, CSS beside it.
```

## The three rules that keep this editable

1. **No component hard-codes a colour or a font size.** They use tokens.
   Theming happens in `tokens.css` keyed off `<html data-palette>`.
2. **No component computes a derived value.** Progress, ordering and "which
   event is next" come from `selectors.js`, so every screen agrees.
3. **No component mutates state directly.** They call an action from
   `store.jsx`, so there is one list of everything the app can do.

## Accessibility

| Requirement | Where |
|---|---|
| Colour-blind mode | `tokens.css` palette override + Settings |
| Never colour-only | "PACKED" word, "Priority" badge, hatched progress fill |
| Text to speech | `useSpeech.js`, "Read list aloud", packing mode |
| Speech to text | `useDictation.js`, mic on Add fields, voice commands |
| Flagged items prioritised | `selectOrderedItems()` in `selectors.js` |
| Where items are kept | `item.note`, shown inline and read aloud |
| Reminders | `useReminders.js` + `RemindersCard.jsx` |
| Progress bar | `ProgressCard.jsx`, `role="progressbar"` |
| 44px touch targets | `--target-min` in `tokens.css` |
| Keyboard | Native controls throughout, skip link, visible focus ring |
| Screen readers | One `aria-live` region in `App.jsx`, `actions.announce()` |

## Known limits (worth saying out loud at the demo)

- Reminders fire only while the app is open — real background delivery needs
  the Push API and a server. See the note at the top of `useReminders.js`.
- Speech recognition is Chrome/Edge/Safari only. The mic buttons hide
  themselves where it is unsupported rather than failing silently.
- Data is localStorage on the device. No account, no sync, works offline.
