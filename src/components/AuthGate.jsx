// ---------------------------------------------------------------------------
// AUTH GATE - decides what to show before the app itself
// ---------------------------------------------------------------------------
//   Firebase keys missing      -> the app, saving in this browser only
//   checking who's signed in   -> "Opening Packuroo…"
//   nobody signed in           -> the login screen
//   signed in                  -> FirebaseSync, then the app
//
// The signed-in user is shared through useUser(), so Settings can show the
// account and a Sign out button.
// ---------------------------------------------------------------------------
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { firebaseReady } from '../data/firebase.js'
import { watchUser } from '../data/auth.js'
import { FirebaseSync } from '../data/FirebaseSync.jsx'
import { LoginScreen, Splash } from './LoginScreen.jsx'
import { useStore } from '../state/store.jsx'

const UserContext = createContext(null)
/** The Firebase user, or null (signed out, or Firebase not set up). */
export const useUser = () => useContext(UserContext)

export function AuthGate({ children }) {
  const { actions } = useStore()
  const [user, setUser] = useState(firebaseReady ? undefined : null) // undefined = still checking
  const wasSignedIn = useRef(false)

  useEffect(() => (firebaseReady ? watchUser(setUser) : undefined), [])

  // After signing out, clear this device back to the demo data, so the next
  // person on a shared computer can't see the previous person's lists.
  // This runs only AFTER sync has stopped, so nothing is deleted in the cloud.
  useEffect(() => {
    if (user) wasSignedIn.current = true
    else if (user === null && wasSignedIn.current) {
      wasSignedIn.current = false
      actions.resetToSeed()
    }
  }, [user, actions])

  if (!firebaseReady) return children
  if (user === undefined) return <Splash title="Opening Packuroo…" />
  if (!user) return <LoginScreen />

  return (
    <UserContext.Provider value={user}>
      <FirebaseSync key={user.uid} uid={user.uid}>{children}</FirebaseSync>
    </UserContext.Provider>
  )
}
