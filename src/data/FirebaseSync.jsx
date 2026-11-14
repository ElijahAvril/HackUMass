// ---------------------------------------------------------------------------
// FIREBASE SYNC - keeps the store and Firestore in step
// ---------------------------------------------------------------------------
// Sits between the signed-in user and the app. The rest of the app does NOT
// change: components still call actions.toggleItem(...) etc. This component
// notices the change and writes just that event to Firestore.
//
// FLOW
//   1. Sign in -> listen to the user's events, kits and settings.
//   2. Brand-new account (nothing in the cloud)? Upload what's on this device.
//      Existing account? Replace the device's data with the cloud's.
//   3. From then on:
//        store changes  -> write the changed documents
//        cloud changes  -> (from another device) load them into the store
//
// While step 1-2 runs, a "Loading your lists" screen shows, so nothing on the
// device can overwrite the cloud by accident.
// ---------------------------------------------------------------------------
import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store.jsx'
import {
  subscribeEvents, subscribeKits, subscribeProfile,
  saveEvent, deleteEvent, saveKit, deleteKit, saveSettings, uploadAll,
} from './db.js'
import { diffDocs, sameDocs, snapshotOf, stableStringify, syncedSettings } from './syncDiff.js'
import { Splash } from '../components/LoginScreen.jsx'

export function FirebaseSync({ uid, children }) {
  const { state, actions } = useStore()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  // What the cloud last had, so we only write real changes.
  const known = useRef({ events: new Map(), kits: new Map(), settings: '' })
  // Latest store state, readable inside listener callbacks.
  const latest = useRef(state)
  latest.current = state

  // ---- 1 + 2: listen, then either upload or load ---------------------------
  useEffect(() => {
    setReady(false)
    const first = { events: null, kits: null, profile: undefined }
    let started = false
    let cancelled = false

    const fail = (err) => {
      console.error('[PackPal] Sync error', err)
      setError(err?.code === 'permission-denied'
        ? 'Your lists could not be opened (permission denied). Check the Firestore security rules.'
        : 'Your lists could not be loaded. Check your connection and refresh the page.')
    }

    const start = async () => {
      if (started || first.events === null || first.kits === null || first.profile === undefined) return
      started = true
      try {
        const isNewAccount = first.events.length === 0 && first.kits.length === 0 && !first.profile
        if (isNewAccount) {
          const s = latest.current
          await uploadAll(uid, { events: s.events, kits: s.kits, settings: syncedSettings(s.settings) })
          known.current = {
            events: snapshotOf(s.events),
            kits: snapshotOf(s.kits),
            settings: stableStringify(syncedSettings(s.settings)),
          }
        } else {
          known.current = {
            events: snapshotOf(first.events),
            kits: snapshotOf(first.kits),
            settings: stableStringify(syncedSettings(first.profile?.settings || latest.current.settings)),
          }
          actions.loadRemote({ events: first.events, kits: first.kits, settings: first.profile?.settings })
        }
        if (!cancelled) setReady(true)
      } catch (err) { fail(err) }
    }

    // After start-up, a snapshot that differs from the store came from
    // somewhere else (another device) - load it in.
    const onEvents = (events) => {
      if (!started) { first.events = events; start(); return }
      known.current.events = snapshotOf(events)
      if (!sameDocs(events, latest.current.events)) actions.loadRemote({ events })
    }
    const onKits = (kits) => {
      if (!started) { first.kits = kits; start(); return }
      known.current.kits = snapshotOf(kits)
      if (!sameDocs(kits, latest.current.kits)) actions.loadRemote({ kits })
    }
    const onProfile = (profile) => {
      if (!started) { first.profile = profile; start(); return }
      if (!profile?.settings) return
      const json = stableStringify(syncedSettings(profile.settings))
      known.current.settings = json
      if (json !== stableStringify(syncedSettings(latest.current.settings))) {
        actions.loadRemote({ settings: profile.settings })
      }
    }

    const stops = [
      subscribeEvents(uid, onEvents, fail),
      subscribeKits(uid, onKits, fail),
      subscribeProfile(uid, onProfile, fail),
    ]
    return () => { cancelled = true; stops.forEach((stop) => stop()) }
  }, [uid, actions])

  // ---- 3: write local changes ---------------------------------------------
  useEffect(() => {
    if (!ready) return
    const k = known.current
    const report = (err) => {
      console.error('[PackPal] Save failed', err)
      actions.announce('Could not save to the cloud. Your change is kept on this device.')
    }

    const ev = diffDocs(k.events, state.events)
    ev.save.forEach((e) => { k.events.set(e.id, stableStringify(e)); saveEvent(uid, e).catch(report) })
    ev.remove.forEach((id) => { k.events.delete(id); deleteEvent(uid, id).catch(report) })

    const kt = diffDocs(k.kits, state.kits)
    kt.save.forEach((kit) => { k.kits.set(kit.id, stableStringify(kit)); saveKit(uid, kit).catch(report) })
    kt.remove.forEach((id) => { k.kits.delete(id); deleteKit(uid, id).catch(report) })

    const settingsJson = stableStringify(syncedSettings(state.settings))
    if (settingsJson !== k.settings) {
      k.settings = settingsJson
      saveSettings(uid, syncedSettings(state.settings)).catch(report)
    }
  }, [ready, uid, state.events, state.kits, state.settings, actions])

  if (error) return <Splash title="Something went wrong" message={error} />
  if (!ready) return <Splash title="Loading your lists…" />
  return children
}
