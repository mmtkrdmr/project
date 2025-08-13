import admin from 'firebase-admin';

// Projenin ana dizinindeki serviceAccountKey.json dosyasını import ediyoruz.
// '..' iki nokta, bir üst klasöre çık demektir.
// src/lib/ -> src/ -> / (ana dizin)
import serviceAccount from '../../serviceAccountKey.json';

// Bu kontrol, Next.js'in geliştirme modunda (hot reload)
// sürekli yeni uygulama başlatmasını engelleyerek hatayı önler.
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      // credential'ı import ettiğimiz serviceAccount nesnesi ile ayarlıyoruz.
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    
  }
}

// Kolay kullanım için başlatılmış admin nesnesini ve diğer servisleri dışa aktaralım.
const db = admin.firestore();
const messaging = admin.messaging();

export { admin, db, messaging };