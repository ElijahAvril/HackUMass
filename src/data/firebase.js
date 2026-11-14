// ---------------------------------------------------------------------------
// FIREBASE CONNECTION
// ---------------------------------------------------------------------------
// Reads the project keys from .env.local (top-level folder, never committed).
//
// If the keys are missing - for example a teammate who hasn't been sent
// .env.local yet - `firebaseReady` is false and the app runs exactly as before:
// no login, data saved in this browser only. Nobody gets a blank screen.
// ---------------------------------------------------------------------------
import { initializeApp } from 'firebase/app'
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseReady = Boolean(config.apiKey && config.projectId)

const app = firebaseReady ? initializeApp(config) : null

/**
 * Firestore with an offline cache, so lists still open with no signal (in a
 * basement, on a bus) and any changes upload when the connection comes back.
 * Falls back to the plain in-memory version if the browser blocks storage.
 */
function makeDb(firebaseApp) {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (err) {
    console.warn('[PackPal] Offline cache unavailable, using online-only mode.', err)
    return getFirestore(firebaseApp)
  }
}

export const db = app ? makeDb(app) : null
export const auth = app ? getAuth(app) : null
