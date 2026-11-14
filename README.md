# HackUMass Speech-to-Text Backend

A Node.js/Express application that serves a temporary live microphone demo and
securely proxies audio to Gemini Live transcription. The Gemini API key stays
on the server.

## Run

Requires Node.js 20 or later.

```powershell
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env and add FIREBASE_PROJECT_ID without replacing your Gemini key.
npm start
```

The server loads `GEMINI_API_KEY` and `FIREBASE_PROJECT_ID` from `.env` or the
process environment. `.env` is ignored by Git; do not commit or share it. Each
person running the project should use their own Gemini key. Never put the Gemini
key in browser code.

Open `http://localhost:3000` for the microphone demo. The HTTP health endpoint
is `GET /health`. The reusable browser client connects to
`ws://localhost:3000/speech-to-text` (use `wss://` when deployed with TLS).

## Firebase-free live assistant

The demo's live assistant works without Firebase. With **Interpret speech with
the live assistant** enabled, it waits 1.5 seconds after the latest finalized
speech before sending the conversation to Gemini. It updates a temporary
checklist draft with any stated check-off dates. Say **“I'm done”** to mark the
thought complete; keep speaking to add a follow-up or correction. Checklist
checkboxes are only local to the current page and are not saved. Reloading or
closing the page clears the transcript and draft. No actions are run
automatically.

The assistant endpoint is limited to 8 requests per client IP per minute to
reduce accidental Gemini usage. Because it does not require sign-in, this demo
endpoint should not be exposed publicly without production-grade authentication
and rate limiting.

## WebSocket protocol

Wait for the server event `speech_to_text.ready` before sending audio. Send
mono, signed PCM16 audio at 16 kHz, base64-encoded in JSON. Commit each audio
turn when speech ends. The backend emits `speech_to_text.interim_transcript`
updates while you speak and a `speech_to_text.transcript` event when Gemini
finalizes the text.

```json
{"type":"input_audio_buffer.append","audio":"<base64 PCM16 audio>"}
{"type":"input_audio_buffer.commit"}
```

The backend does not accept session configuration from clients. The demo
captures microphone audio, converts it to mono PCM16 at 16 kHz, and signals the
end of the audio stream when you press **Stop**. The demo also saves those
captured samples as a standard WAV file for browser playback, so you can review
the same audio sent for transcription.

The backend uses Gemini's `gemini-3.5-transcribe-live` model. Create a Gemini
API key in Google AI Studio and put it in your local `.env` file as
`GEMINI_API_KEY`.

## Firebase reminders

The demo can turn the latest finalized transcript into a reminder proposal.
You review and edit its title, details, and date/time before confirming; it
does not schedule or save anything based only on speech. After saving, the
reminder and source transcript are stored in Firestore under your signed-in
Firebase account.

1. Create a Firebase project and register a Web app in the Firebase console.
2. Enable **Authentication → Google** as a sign-in provider.
3. Create a **Cloud Firestore** database.
4. Copy the Firebase Web app configuration into `public/firebase-config.js`.
   That config is visible in the browser by design; it is not a private key.
5. Add the Firebase project ID to `.env` as `FIREBASE_PROJECT_ID`, then restart
   the server. Keep `GEMINI_API_KEY` in `.env` only.
6. Publish the included [Firestore security rules](./firestore.rules) in
   **Firestore → Rules**. They restrict reminders to their owner's account.
7. In **Authentication → Settings → Authorized domains**, ensure `localhost`
   is allowed for local development.

On the page, sign in with Google, record and finish a transcript, choose
**Interpret latest transcript as a reminder**, review the suggested details,
and press **Confirm and save reminder**. Saved reminders appear in the list and
can be marked done or deleted. The backend verifies Firebase ID tokens before
calling Gemini to interpret transcript text.

For production, serve the site over HTTPS, restrict Firebase API key usage to
your app's domains, review Firebase's usage limits, and add appropriate
authentication/rate limits for the deployed backend.

The microphone client is implemented as a reusable module in
`public/speech-to-text-client.js`; the demo UI is kept separate in
`public/app.js` and `public/index.html`. This lets an eventual application
reuse the audio/WebSocket client while replacing the temporary UI.

The demo requires microphone permission and a secure browser context (localhost
is allowed). Protect `/speech-to-text` with your application's existing
authentication and authorization before exposing it publicly. The health
endpoint does not require authentication. Never put `GEMINI_API_KEY` in client
code.
