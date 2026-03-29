import { initializeApp, getApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  browserSessionPersistence,
  setPersistence,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Enable emulator mode when VITE_USE_EMULATORS is set
const isEmulatorMode =
  import.meta.env.VITE_FIREBASE_USE_EMULATORS === "true";

// Production Firebase config
const productionConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Emulator config uses demo project (no real Firebase project needed)
const emulatorConfig = {
  apiKey: "demo-key",
  projectId: "demo-webhook",
  authDomain: "localhost",
};

const firebaseConfig = isEmulatorMode ? emulatorConfig : productionConfig;
const app = initializeApp(firebaseConfig);

// Connect to emulators in development
if (isEmulatorMode) {
  const emulatorHosts = {
    auth: { host: "localhost", port: 9099 },
    firestore: { host: "localhost", port: 8080 },
    functions: { host: "localhost", port: 5001 },
  };

  const auth = getAuth();
  const firestore = getFirestore();
  const functions = getFunctions(getApp(), "europe-west1");

  connectAuthEmulator(
    auth,
    `http://${emulatorHosts.auth.host}:${emulatorHosts.auth.port}`
  );
  connectFirestoreEmulator(
    firestore,
    emulatorHosts.firestore.host,
    emulatorHosts.firestore.port
  );
  connectFunctionsEmulator(
    functions,
    emulatorHosts.functions.host,
    emulatorHosts.functions.port
  );
}

export { app };
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const functions = getFunctions(app, "europe-west1");

// Use session persistence — auth state is cleared when browser tab closes.
// No data persists in localStorage/IndexedDB across sessions.
// This is the most secure option: forces re-authentication on each session.
setPersistence(auth, browserSessionPersistence).catch(console.error);
