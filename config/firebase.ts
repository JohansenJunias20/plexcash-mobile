import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithCredential,
  initializeAuth,
  getReactNativePersistence
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Initialize Firebase Auth with AsyncStorage persistence for React Native
const auth = initializeAuth(firebaseApp, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

export { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithCredential,
  googleProvider,
  firebaseConfig 
};

export default firebaseApp;

