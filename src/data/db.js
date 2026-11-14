import { db } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
} from "firebase/firestore";

// Where data lives:  users/{uid}/events/{eventId}  and  users/{uid}/kits/{kitId}
const eventsCol = (uid) => collection(db, "users", uid, "events");
const kitsCol = (uid) => collection(db, "users", uid, "kits");

// ---------- events ----------
// Live listener: runs `callback(events)` now and every time events change.
// Returns a function that stops listening.
export function subscribeEvents(uid, callback) {
  return onSnapshot(eventsCol(uid), (snap) =>
    callback(snap.docs.map((d) => d.data()))
  );
}

// Creates or replaces a whole event (including its sections and items)
export function saveEvent(uid, event) {
  return setDoc(doc(eventsCol(uid), event.id), event);
}

export function deleteEvent(uid, eventId) {
  return deleteDoc(doc(eventsCol(uid), eventId));
}

// ---------- kits ----------
export function subscribeKits(uid, callback) {
  return onSnapshot(kitsCol(uid), (snap) =>
    callback(snap.docs.map((d) => d.data()))
  );
}

export function saveKit(uid, kit) {
  return setDoc(doc(kitsCol(uid), kit.id), kit);
}

export function deleteKit(uid, kitId) {
  return deleteDoc(doc(kitsCol(uid), kitId));
}

// ---------- "forgotten before" counts ----------
// Stored on the user's own document: { forgotten: { "laptop charger": { name, count } } }
export function subscribeForgotten(uid, callback) {
  return onSnapshot(doc(db, "users", uid), (snap) =>
    callback(snap.data()?.forgotten || {})
  );
}

export function saveForgotten(uid, forgotten) {
  return setDoc(doc(db, "users", uid), { forgotten }, { merge: true });
}

// ---------- first sign-in: add sample data so the app isn't empty ----------
export async function seedIfEmpty(uid, events, kits, forgotten = {}) {
  const snap = await getDocs(eventsCol(uid));
  if (!snap.empty) return; // user already has data, so don't overwrite

  const batch = writeBatch(db);
  events.forEach((e) => batch.set(doc(eventsCol(uid), e.id), e));
  kits.forEach((k) => batch.set(doc(kitsCol(uid), k.id), k));
  batch.set(doc(db, "users", uid), { forgotten }, { merge: true });
  await batch.commit();
}

// ---------- helper for new IDs ----------
export const newId = () => crypto.randomUUID();