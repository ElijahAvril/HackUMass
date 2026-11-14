# PackPal

PackPal is an accessible, installable packing-checklist app. Each event has its
own packing list, and repeat lists can be saved as reusable kits. Speech input
uses the app's Gemini Live transcription service for item dictation and packing
voice commands. The Talk to PackPal button records a request, sends the
transcription to Gemini, and applies clear packing-list actions; transcripts
are not shown in a separate transcript panel.

## Run

Requires Node.js 20 or later and a Gemini API key.

```powershell
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Set GEMINI_API_KEY in .env.
npm start
```

Open `http://localhost:3000`. The app needs microphone access, a secure browser
context (localhost is allowed), and an active connection to the speech backend
for voice input. The Gemini API key stays on the server and must never be put
in browser code.

For frontend development, run `npm start` in one terminal and `npm run dev` in
another. Vite proxies `/speech-to-text` and `/api` requests to the server on
port 3000.

## Browser and speech service

The finalized PackPal browser lives in `src/`. Its checklists, kits, and
settings are saved in local storage and remain usable offline. The microphone
controls send audio to the `/speech-to-text` WebSocket endpoint, where the
server securely proxies it to Gemini's `gemini-3.5-transcribe-live` model.
Finalized speech is used by the active dictation or packing command; the app
does not display a separate transcript or record/play back audio.

The browser client converts microphone audio to mono PCM16 at 16 kHz and sends
it to the backend. The backend emits `speech_to_text.interim_transcript` and
`speech_to_text.transcript` events. The HTTP health endpoint is `GET /health`.

The backend also includes authenticated reminder interpretation endpoints. To
use those endpoints, configure `FIREBASE_PROJECT_ID` in `.env`, enable Google
sign-in and Firestore in Firebase, and publish the included
[Firestore security rules](./firestore.rules). The current PackPal browser
stores its checklist data locally and does not expose those reminder endpoints.

On an event page, **Talk to PackPal** records one conversation until you finish
it. Gemini can mark existing items packed or unpacked, add an item to an
existing category (such as Clothes or Documents), remove an existing item,
create or delete a list, add an event-relative reminder, or update the current
event's location or start time. Requested item/list actions are applied only
when their category and item names match the current event; ambiguous or
duplicate changes are skipped. The assistant speaks its reply when browser
speech synthesis is available.
Say **“I’m done”** to submit a voice request automatically. The end phrase is
removed before the request is interpreted. Silence detection is disabled for
this conversation flow because background noise made it unreliable; use
**Submit now** as a manual fallback.

### Voice assistant command examples

| Say | Action |
|---|---|
| “Pack my passport. I’m done.” | Check off the matching existing item as packed. |
| “Unpack the dress shoes. I’m done.” | Uncheck the matching item as unpacked. |
| “Add a nationalization document to Documents. I’m done.” | Add an item to the existing Documents list. |
| “Remove the reference letters from Documents. I’m done.” | Remove the matching item from Documents. |
| “Create a new list called Toiletries. I’m done.” | Add an empty Toiletries list to the current event. |
| “Delete the Toiletries list. I’m done.” | Delete that list and all its event items. |
| “Remind me 3 hours and 20 minutes before the event. I’m done.” | Add a reminder 200 minutes before the event. |
| “Remind me 2 weeks before the event. I’m done.” | Add a reminder 20,160 minutes before the event. |
| “Remind me about this event. I’m done.” | Add the default reminder one day (1,440 minutes) before the event. |
| “The location is the Boston Garden. I’m done.” | Set the current event location to Boston Garden. |
| “The event starts at 7 PM on May 12. I’m done.” | Update the current event start date and time. |

Reminder offsets can be specified in minutes, hours, days, or weeks, including
combinations such as “1 day and 3 hours.” They must fall after now and before
the event start; if no offset is stated, the default is one day before. A
reminder whose time has already passed, or a duplicate offset, is not added.
Deleting a list removes its items from this event but does not delete a saved
kit. Spoken location and time edits update the currently open event; they do
not create a separate event.

## Project layout

- `src/components/` contains the browser's screens and controls.
- `src/state/` contains the checklist state and local persistence.
- `src/hooks/useDictation.js` connects microphone controls to speech-to-text.
- `src/speech-to-text-client.js` and `public/audio-capture-worklet.js`
  capture and stream microphone audio.
- `server.js` serves the production build and handles speech and API requests.

Build the browser with `npm run build`, run tests with `npm test`, and serve a
production build with `npm start`.
