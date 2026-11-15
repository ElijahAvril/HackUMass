// ---------------------------------------------------------------------------
// WHERE THE SPEECH SERVER LIVES
// ---------------------------------------------------------------------------
// The website (Firebase Hosting) and the speech server (server.js on Render)
// are two separate places. Set VITE_SPEECH_SERVER_URL to the Render address,
// e.g. https://packuroo-speech.onrender.com, in .env.production.
//
// Left empty, the app uses its own address - which is what you want for
// `npm run dev` (Vite forwards to localhost:3000) and `npm start`.
// ---------------------------------------------------------------------------
const base = (import.meta.env.VITE_SPEECH_SERVER_URL || '').trim().replace(/\/+$/, '')

/** Full address for a speech-server route, e.g. speechHttpUrl('/api/packing/interpret'). */
export const speechHttpUrl = (path) => `${base}${path}`

/** WebSocket address for live transcription. */
export function speechSocketUrl() {
  if (base) return `${base.replace(/^http/, 'ws')}/speech-to-text`
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/speech-to-text`
}
