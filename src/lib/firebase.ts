// src/lib/firebase.ts (DOĞRU VE HATASIZ HALİ)

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
// lib/firebaseAdmin.js

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,           // <<< HATA BURADAYDI (FIREBASE olmalı)
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,     // <<< HATA BURADAYDI (FIREBASE olmalı)
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,       // <<< HATA BURADAYDI (FIREBASE olmalı)
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, // <<< HATA BURADAYDI (FIREBASE olmalı)
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, // <<< HATA BURADAYDI (FIREBASE olmalı)
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,             // <<< HATA BURADAYDI (FIREBASE olmalı)
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
export const functions = getFunctions(app, 'europe-west1'); // Sunucu fonksiyonlarının olduğu bölgeyi yaz