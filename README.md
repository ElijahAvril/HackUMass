# Packuroo

Packuroo is an accessible, installable packing-checklist PWA. Each event has
its own packing list, and repeat lists can be saved as reusable kits. Events
can be scheduled for a specific time or marked all day. Checklist data is
stored locally in the browser.
https://packuroo.web.app/

## Run locally

Requires Node.js 20 or later and a Gemini API key.

```powershell
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Set `GEMINI_API_KEY` in `.env`, then start the production server:

```powershell
npm start
```

Open `http://localhost:3000`. To develop the frontend with Vite, run `npm start`
in one terminal and `npm run dev` in another; Vite proxies speech and API
requests to the backend on port 3000.

Keep the Gemini API key in `.env` on the server. Never put it in browser code
or commit `.env`. Microphone access requires permission and a secure browser
context; localhost is supported.

## Voice input and assistant

The browser uses the Gemini Live speech service for dictation and packing voice
commands. The browser streams mono PCM16 audio at 16 kHz to the
`/speech-to-text` WebSocket endpoint. The backend proxies it to Gemini and
returns interim and finalized transcripts. The reusable browser client is in
`src/speech-to-text-client.js`.

On an event page, **Talk to Packuroo** records a conversation until you say
**“I’m done”** or press **Submit now**. Gemini can:

| Say | Action |
|---|---|
| “Pack my passport. I’m done.” | Mark a matching existing item packed. |
| “Unpack the dress shoes. I’m done.” | Mark a matching item unpacked. |
| “Add a document called nationalization. I’m done.” | Add an item to an existing list. |
| “Remove the reference letter from Documents. I’m done.” | Remove a matching item. |
| “Create a list called Toiletries. I’m done.” | Create a list for the current event. |
| “Delete the Toiletries list. I’m done.” | Delete that event list and its items. |
| “Remind me 3 hours before the event. I’m done.” | Add a reminder three hours before the event. |
| “Set the event location to the student center. I’m done.” | Update the current event location. |
| “Move the event to 3 PM tomorrow. I’m done.” | Update the current event start time. |

Item and list requests are matched against the current event. Unmatched or
ambiguous requests are skipped rather than applied to an uncertain target.
Singular/plural differences are supported when the match remains unambiguous.
Reminder offsets can be given in minutes, hours, days, or weeks; the default is
one day before the event. A reminder must be in the future and before the event
starts. Silence submission is disabled for this assistant; use the explicit end
phrase or manual submit button.

On the Events screen, you can say “Remove the Documents kit from Doctor’s
appointment. I’m done.” This removes only that kit from the event; the saved kit
stays in My Kits. You can also say “Delete the Dentist event. I’m done.” The
assistant asks for a separate yes/no confirmation before deleting an event.

## Development

```powershell
npm run dev       # Vite frontend at http://localhost:5173
npm run build     # Production frontend in dist/
npm test          # Build and run the test suite
npm start         # Build and serve the app and backend at http://localhost:3000
```

## Firebase status

Firebase client helper files and backend reminder interpretation support are
present, but the current Packuroo checklist UI stores its data locally and does
not yet sync checklist data or saved reminders through Firebase. The Gemini
speech and packing assistant work with `GEMINI_API_KEY`; Firebase is not needed
for those features.

## Project layout

```text
src/
  components/           Packuroo screens and controls
  hooks/                Speech, dictation, and reminder hooks
  state/                Checklist state, seed data, and selectors
  styles/               Shared styles and design tokens
  speech-to-text-client.js
server.js                Express server and Gemini endpoints
test/                    Server, speech, and packing assistant tests
```

## Accessibility and limitations

- Optional OpenDyslexic font (SIL Open Font License; see
  `public/OpenDyslexic-LICENSE.txt`), text scaling, and reduced-motion settings
- Text-to-speech for reading packing lists aloud
- Keyboard-accessible controls, visible focus, and screen-reader announcements
- Reminder notifications fire while the app is open; background delivery needs
  a push service.
- Browser audio processing varies by browser and device.
