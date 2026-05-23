/**
 * Firebase initialization with graceful degradation.
 *
 * Why graceful: the diagnostic experience must keep working for judges
 * even if Firebase env vars are missing — the app falls back to
 * localStorage in that case. `isFirebaseConfigured()` lets callers
 * branch cleanly.
 *
 * Only the frontend talks to Firebase. The Python serverless API does
 * not depend on it, so audio analysis works without sign-in.
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  type Firestore,
} from "firebase/firestore";

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

function readConfig(): FirebaseConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) return null;

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  };
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function bootstrap(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  if (_app && _auth && _db) return { app: _app, auth: _auth, db: _db };
  const config = readConfig();
  if (!config) return null;
  _app = initializeApp(config);
  _auth = getAuth(_app);
  _db = getFirestore(_app);
  return { app: _app, auth: _auth, db: _db };
}

export function isFirebaseConfigured(): boolean {
  return readConfig() !== null;
}

export function getFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  return bootstrap();
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function signInWithGoogle(): Promise<User> {
  const fb = bootstrap();
  if (!fb) {
    throw new Error("Firebase is not configured. Add VITE_FIREBASE_* to your .env.");
  }
  const result = await signInWithPopup(fb.auth, googleProvider);
  return result.user;
}

export async function signOut(): Promise<void> {
  const fb = bootstrap();
  if (!fb) return;
  await fbSignOut(fb.auth);
}

export function onUserChanged(cb: (user: User | null) => void): () => void {
  const fb = bootstrap();
  if (!fb) {
    cb(null);
    return () => undefined;
  }
  return onAuthStateChanged(fb.auth, cb);
}

/* ----- Firestore: attempts collection -------------------------------------- */

export interface FirestoreAttempt {
  id: string;
  ts: number;
  pinyin: string;
  intendedTone: number;
  toneScore: number;
  initialScore: number;
  finalScore: number;
  overall: number;
  detectedTone: number;
}

/** Upload one attempt to /users/{uid}/attempts/{attemptId}. */
export async function pushAttemptRemote(uid: string, attempt: FirestoreAttempt): Promise<void> {
  const fb = bootstrap();
  if (!fb) return;
  await setDoc(
    doc(collection(fb.db, "users", uid, "attempts"), attempt.id),
    { ...attempt, createdAt: Timestamp.fromMillis(attempt.ts) },
    { merge: true }
  );
}

/** Fetch the 200 most recent attempts for the signed-in user. */
export async function fetchAttemptsRemote(uid: string): Promise<FirestoreAttempt[]> {
  const fb = bootstrap();
  if (!fb) return [];
  const snap = await getDocs(
    query(collection(fb.db, "users", uid, "attempts"), orderBy("ts", "desc"), limit(200))
  );
  return snap.docs.map((d) => d.data() as FirestoreAttempt);
}

/** Best-effort wrapper: never let a Firestore failure block the UI. */
export async function tryRemote<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.warn("Firebase call failed; falling back to local state.", err);
    return null;
  }
}

export type { User };
