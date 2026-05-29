import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCwp8KhisgZ64tdYHAq27k-_3O76MFNijQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "polla-austrogas.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "polla-austrogas",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "polla-austrogas.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "352531542943",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:352531542943:web:0b5d45ded7fc46bfac43aa"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
