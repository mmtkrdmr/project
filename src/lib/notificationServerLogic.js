// src/lib/notificationServerLogic.js

import { admin } from './firebaseAdmin';

/**
 * Next.js API rotaları tarafından kullanılan standart bildirim fonksiyonu.
 * Artık hem bildirim gönderiyor hem de Firestore'a kaydediyor.
 */
export async function sendStandardizedChatMessageNotification(targetUserId, senderName, messageBody, chatPartnerId, senderPhotoUrl = null, imageUrl = null) {
  const db = admin.firestore();
  console.log(`--- API Rotası: Bildirim gönderiliyor ve kaydediliyor: Kullanıcı ${targetUserId} ---`);
  
  try {
    const userDoc = await db.collection('users').doc(targetUserId).get();
    if (!userDoc.exists) {
      console.warn(`API Rotası: Kullanıcı bulunamadı: ${targetUserId}`);
      return;
    }

    // <-- EKSİK OLAN KISIM BURASIYDI: BİLDİRİMİ VERİTABANINA KAYDETME -->
    const notificationForDb = {
        title: `${senderName}`,
        body: messageBody,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        type: 'MESSAGE',
        isRead: false,
        senderPhotoUrl: senderPhotoUrl || '',
        actionData: {
            route: 'chat',
            partnerId: chatPartnerId
        }
    };
    await db.collection('users').doc(targetUserId).collection('notifications').add(notificationForDb);
    console.log(`API Rotası: Kullanıcı ${targetUserId} için bildirim Firestore'a başarıyla kaydedildi.`);
    // <-- YENİ EKLENEN KISIM SONU -->


    const tokens = userDoc.data().fcmTokens;
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      console.log(`API Rotası: Kullanıcı ${targetUserId} için FCM token yok, anlık bildirim atlanıyor.`);
      return;
    }

    // Data-Only anlık bildirim gönderme kısmı
    const payload = {
      data: {
        title: notificationForDb.title, // Kaydedilen veriden alıyoruz
        body: notificationForDb.body,   // Kaydedilen veriden alıyoruz
        chatPartnerId: chatPartnerId,
        senderPhotoUrl: senderPhotoUrl || '',
        imageUrl: imageUrl || ''
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { 'content-available': 1 } } }
    };

    const sendPromises = tokens.map(token => {
      const messageForToken = { ...payload, token };
      return admin.messaging().send(messageForToken);
    });

    await Promise.all(sendPromises);
    console.log(`API Rotası: Kullanıcı ${targetUserId} için Data-Only bildirim başarıyla gönderildi.`);
  } catch (error) {
    console.error(`API Rotası: Kullanıcı ${targetUserId} için hata oluştu:`, error);
  }
}