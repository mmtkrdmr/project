// src/lib/firebaseAdmin.js
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // Ortam değişkeninden JSON verisini alıyoruz
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK başarıyla bağlandı.');
  } catch (error) {
    console.error('Firebase Admin SDK bağlanırken bir hata oluştu:', error);
  }
}

export { admin };
