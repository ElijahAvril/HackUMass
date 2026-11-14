// ---------------------------------------------------------------------------
// SIGN-IN
// ---------------------------------------------------------------------------
// Google sign-in: no separate sign-up. The first time someone signs in,
// Firebase creates their account automatically; after that the same Google
// account always opens the same lists. Firebase remembers the login in the
// browser, so people stay signed in until they press Sign out.
//
// Guest mode ("Try it without an account") uses anonymous sign-in. A guest can
// later attach a Google account and keep everything they made.
// Turn it on in Firebase: Authentication -> Sign-in method -> Anonymous.
// ---------------------------------------------------------------------------
import { auth } from './firebase'
import {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, signInAnonymously,
  linkWithPopup, signOut, onAuthStateChanged,
} from 'firebase/auth'

function googleProvider() {
  const provider = new GoogleAuthProvider()
  // Always show the account chooser, so a shared laptop doesn't silently
  // sign in as whoever used it last.
  provider.setCustomParameters({ prompt: 'select_account' })
  return provider
}

/** Popup first; if the browser blocks popups, fall back to a full-page redirect. */
export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider())
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
      return signInWithRedirect(auth, googleProvider())
    }
    throw err
  }
}

export const signInAsGuest = () => signInAnonymously(auth)

/** Turns a guest account into a Google one. Same user id, so no data moves. */
export const linkGuestToGoogle = () => linkWithPopup(auth.currentUser, googleProvider())

export const logOut = () => signOut(auth)

/** Calls back with the user (or null) now and on every sign-in / sign-out. */
export const watchUser = (callback) => onAuthStateChanged(auth, callback)

/** Plain-language versions of Firebase's error codes, for the login screen. */
export function friendlyAuthError(err) {
  const messages = {
    'auth/popup-closed-by-user': 'The sign-in window was closed before finishing. Please try again.',
    'auth/cancelled-popup-request': 'The sign-in window was closed before finishing. Please try again.',
    'auth/network-request-failed': 'No internet connection. Check your Wi-Fi and try again.',
    'auth/operation-not-allowed': 'This sign-in option is turned off in Firebase (Authentication → Sign-in method).',
    'auth/configuration-not-found': 'Sign-in is not set up yet in Firebase (Authentication → Get started).',
    'auth/unauthorized-domain': 'This website address is not allowed to sign in yet (Authentication → Settings → Authorized domains).',
    'auth/credential-already-in-use': 'That Google account already has PackPal lists. Sign out, then sign in with Google to open them.',
    'auth/too-many-requests': 'Too many tries in a row. Wait a minute and try again.',
  }
  return messages[err?.code] || 'Something went wrong signing in. Please try again.'
}
