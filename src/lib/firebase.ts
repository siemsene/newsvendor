import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Prefer .env values, but fall back to a baked-in config so the app runs out of the box.
// You can remove the fallback if you prefer not to commit config values.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyAc39l6xYMg3K_fYksvKdEw-pZ0mTma7eg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "the-beer-game-37777398-4d5fb.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "the-beer-game-37777398-4d5fb",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:719771955560:web:171d7ce2015d05e9ca26dd",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "the-beer-game-37777398-4d5fb.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "719771955560",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-M0VP3BE637",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
