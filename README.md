# PackPal

An accessible, installable packing-checklist PWA. Each event has its own packing list, and lists you reuse can be saved as kits.

## Run locally

Requires Node.js 20 or later.

```powershell
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Add your Gemini API key to `.env`, then start the app:

```powershell
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`). To run the production server instead:

```powershell
npm run build
npm start
```

The production server serves the built app, usually at `http://localhost:3000`. Microphone access requires permission; `localhost` is supported as a secure browser context.

Keep `GEMINI_API_KEY` in `.env` on the server. Never put it in browser code or commit your `.env` file. Each person running the app should use their own key.

## Voice assistant

Use **Talk to PackPal** to give spoken instructions. The assistant sends the recognized transcript to Gemini for interpretation. Say **“I’m done”** to submit what you said. A transcript preview is available while testing.

The assistant can:

| Say something like… | Action |
|---|---|
| “Pack my reference letter” | Mark a matching item as packed |
| “Unpack my reference letter” | Mark a matching item as unpacked |
| “Add a charger to clothes” | Add an item to an existing list |
| “Remove the charger from clothes” | Remove a matching item |
| “Create a list called Documents” | Create a list |
| “Delete the Documents list” | Delete a list |
| “Remind me one hour before the event to print my ticket” | Add an event reminder |
| “Set the event location to the student center” | Update the event location |
| “Move the event to 3 PM tomorrow” | Update the event start time |

The assistant matches actions against the current event and its lists. Unmatched or ambiguous item/list names may not be applied, so check the app afterward. Reminders default to one day before the event when no offset is specified.

## Firebase reminders

Firebase setup is needed for account-based reminder storage. Firebase web configuration is used by the browser and is not a private key; keep `GEMINI_API_KEY` server-side.

1. Create a Firebase project and register a Web app in the Firebase console.
2. Enable **Authentication → Google**.
3. Create a **Cloud Firestore** database.
4. Add the Firebase web app configuration to the project’s Firebase client configuration.
5. Set `FIREBASE_PROJECT_ID` in `.env` and restart the server.
6. Publish the included Firestore security rules in **Firestore → Rules**.
7. Ensure `localhost` is an authorized domain under **Authentication → Settings → Authorized domains**.

Sign in, create or interpret a reminder, review its details, and save it. Saved reminders are associated with your Firebase account. Do not expose the backend publicly without appropriate authentication and rate limiting.

## Project structure

```text
src/
  App.jsx               App shell and views
  components/           Packing, event, reminder, and settings UI
  hooks/                Speech, dictation, and reminder hooks
  state/                App state, seed data, and selectors
  styles/               Shared styles and design tokens
server.js               Express server and Gemini endpoints
```

## Accessibility

- Colour-blind palette option in Settings
- Text-to-speech for reading lists aloud
- Speech-to-text for dictation and voice commands
- Keyboard-accessible controls and visible focus indicators
- Screen-reader announcements and accessible progress indicators
- Minimum touch-target sizing for mobile controls

## Notes

- Microphone access and browser audio processing depend on the browser and device.
- Reminder notifications may require the app to remain open.
- The speech assistant uses Gemini and requires a valid server-side API key.