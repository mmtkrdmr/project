// src/lib/firebaseAdmin.js
import admin from 'firebase-admin';

// Önce anahtar dosyamızı import ediyoruz.
// DİKKAT: Bu yol, dosyanın projenin KÖK dizininde olduğunu varsayar.
import serviceAccount from '../../serviceAccountKey.json'; 

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      // Bu sefer JSON.parse'a falan gerek yok, direkt dosyayı veriyoruz.
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK dosyadan başarıyla bağlandı.');
  } catch (error) {
    console.error('Firebase Admin SDK bağlanırken anasının amı gibi bir hata oluştu:', error);
  }
}

export { admin };