
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseSetupMessage =
  "Sign-in and account creation are unavailable. To enable them locally, " +
  "copy frontend/.env.example to frontend/.env.local, enter your Firebase " +
  "web app settings, and restart the frontend.";

export function isFirebaseSetupError(code) {
  return [
    "auth/invalid-api-key",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.",
    "auth/app-not-authorized",
    "auth/configuration-not-found",
    "auth/operation-not-allowed",
  ].includes(code);
}

function initializeAuth() {
  const hasConfig = Object.values(firebaseConfig).every(
    (value) => value && !value.startsWith("your-") && !/\s/.test(value)
  );

  if (!hasConfig || !/^AIza[\w-]{35}$/.test(firebaseConfig.apiKey)) {
    return null;
  }

  try {
    return getAuth(initializeApp(firebaseConfig));
  } catch (error) {
    console.error("Unable to initialize Firebase Authentication:", error.code);
    return null;
  }
}

export const auth = initializeAuth();
