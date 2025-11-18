import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase configuration - same as web app
const firebaseConfig = {
  apiKey: "AIzaSyCSd5mCl6xsuG5Xis5OkrUQQNZOD8-H_VI",
  authDomain: "plex-seller-id.firebaseapp.com",
  projectId: "plex-seller-id",
  storageBucket: "plex-seller-id.appspot.com",
  messagingSenderId: "227685404880",
  appId: "1:227685404880:web:7b5e542ef193a3c0c34ed5",
  measurementId: "G-VHTWFT4DER"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase Auth
// For React Native, Firebase automatically uses AsyncStorage for persistence
// when @react-native-async-storage/async-storage is installed
// This auth instance is used by:
// - context/AuthContext.tsx: onAuthStateChanged listener and signOut
// - components/AuthTest.tsx: checking currentUser
// - services/api.ts: getting Firebase ID token for API requests
// - services/googleAuth.ts: signInWithCustomToken (imported dynamically from 'firebase/auth')
const auth = getAuth(firebaseApp);

// Export only what's actually used by the mobile app
// Note: Other Firebase auth functions (signInWithCustomToken, onAuthStateChanged, etc.)
// are imported directly from 'firebase/auth' where needed
export {
  auth,
  firebaseConfig
};

export default firebaseApp;

