import { auth } from "./firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// Opens the Google sign-in popup
export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());

// Signs the user out
export const logOut = () => signOut(auth);

// Calls `callback(user)` now and whenever the user signs in or out.
// `user` is null when nobody is signed in.
export const watchUser = (callback) => onAuthStateChanged(auth, callback);