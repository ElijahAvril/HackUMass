import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";

const requiredConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.projectId,
  firebaseConfig.appId
];

export const firebaseConfigured = requiredConfig.every(
  (value) => value && !value.startsWith("YOUR_")
);

let auth;
let db;

export function initializeFirebase(onUserChanged) {
  if (!firebaseConfigured) {
    return false;
  }

  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, onUserChanged);
  return true;
}

export async function signInWithGoogle() {
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signOutUser() {
  await signOut(auth);
}

export function watchReminders(user, onReminders, onError) {
  const reminders = collection(db, "users", user.uid, "reminders");
  return onSnapshot(
    query(reminders, orderBy("createdAt", "desc")),
    (snapshot) => {
      onReminders(snapshot.docs.map((reminder) => ({
        id: reminder.id,
        ...reminder.data()
      })));
    },
    onError
  );
}

export async function saveReminder(user, reminder) {
  await addDoc(collection(db, "users", user.uid, "reminders"), {
    title: reminder.title,
    notes: reminder.notes,
    dueAt: Timestamp.fromDate(new Date(reminder.dueAt)),
    timeZone: reminder.timeZone,
    sourceTranscript: reminder.sourceTranscript,
    status: "open",
    createdAt: serverTimestamp()
  });
}

export async function completeReminder(user, reminderId) {
  await updateDoc(doc(db, "users", user.uid, "reminders", reminderId), {
    status: "done"
  });
}

export async function removeReminder(user, reminderId) {
  await deleteDoc(doc(db, "users", user.uid, "reminders", reminderId));
}
