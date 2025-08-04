// src/lib/notificationHelper.js
import { admin } from './firebaseAdmin';

export async function sendNotificationToUser(userId, title, body, senderPhotoUrl, imageUrl, chatPartnerId) {
  console.log("---------- notificationHelper ÇALIŞIYOR ----------");
  console.log("Alınan Parametreler:", { userId, title, body, senderPhotoUrl, imageUrl, chatPartnerId });

  try {
    // ... geri kalan kod aynı
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) throw new Error('Kullanıcı bulunamadı');

    const userData = userDoc.data();
    const tokens = userData.fcmTokens;
    console.log(`Kullanıcının token'ları bulundu: ${tokens ? tokens.length : 0} adet.`);

    if (!tokens || tokens.length === 0) {
      console.log(`Token yok, bildirim gönderilmiyor.`);
      return;
    }
    
    // ... geri kalan kod aynı
    const message = {
      
      data: {
        title,
        body,
        senderPhotoUrl: senderPhotoUrl || '',
        imageUrl: imageUrl || '',
        chatPartnerId: chatPartnerId || ''
      },
      tokens: tokens,
    };
    
    console.log("Firebase'e gönderilecek olan son PAYLOAD:", JSON.stringify(message, null, 2));

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Firebase'den gelen cevap: ${response.successCount} başarılı, ${response.failureCount} başarısız.`);

  } catch (error) {
    console.error(`AMINA KODUĞUMUN notificationHelper HATASI:`, error);
  }
}