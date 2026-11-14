// ---------------------------------------------------------------------------
// FIRESTORE READS AND WRITES
// ---------------------------------------------------------------------------
// Layout (matches the security rules: each user can only reach their own):
//
//   users/{uid}                 { settings }
//   users/{uid}/events/{id}     one whole event: reminders, categories, items
//   users/{uid}/kits/{id}       one kit: { id, name, items: [{ name, note }] }
//
// One document per event keeps loading simple: opening an event is one read.
// Components never call these directly - FirebaseSync.jsx does, so the rest of
// the app keeps using the store exactly as before.
// ---------------------------------------------------------------------------
import { db } from './firebase'
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch,
} from 'firebase/firestore'

const eventsCol = (uid) => collection(db, 'users', uid, 'events')
const kitsCol = (uid) => collection(db, 'users', uid, 'kits')
const userDoc = (uid) => doc(db, 'users', uid)

/** Firestore rejects `undefined` values; a JSON round-trip drops them. */
const clean = (value) => JSON.parse(JSON.stringify(value))

// Live listeners: call back now and on every change (including changes made
// on another device). Each returns a function that stops listening.
export const subscribeEvents = (uid, callback, onError) =>
  onSnapshot(eventsCol(uid), (snap) => callback(snap.docs.map((d) => d.data())), onError)

export const subscribeKits = (uid, callback, onError) =>
  onSnapshot(kitsCol(uid), (snap) => callback(snap.docs.map((d) => d.data())), onError)

export const subscribeProfile = (uid, callback, onError) =>
  onSnapshot(userDoc(uid), (snap) => callback(snap.exists() ? snap.data() : null), onError)

export const saveEvent = (uid, event) => setDoc(doc(eventsCol(uid), event.id), clean(event))
export const deleteEvent = (uid, eventId) => deleteDoc(doc(eventsCol(uid), eventId))
export const saveKit = (uid, kit) => setDoc(doc(kitsCol(uid), kit.id), clean(kit))
export const deleteKit = (uid, kitId) => deleteDoc(doc(kitsCol(uid), kitId))
export const saveSettings = (uid, settings) =>
  setDoc(userDoc(uid), { settings: clean(settings) }, { merge: true })

/** First sign-in: copy everything on this device up to the new account. */
export async function uploadAll(uid, { events, kits, settings }) {
  const batch = writeBatch(db)
  events.forEach((e) => batch.set(doc(eventsCol(uid), e.id), clean(e)))
  kits.forEach((k) => batch.set(doc(kitsCol(uid), k.id), clean(k)))
  batch.set(userDoc(uid), { settings: clean(settings), createdAt: new Date().toISOString() }, { merge: true })
  await batch.commit()
}
