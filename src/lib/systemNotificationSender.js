import { admin } from './firebaseAdmin';

let logoUrlCache = null;

async function getLogoUrl() {
    if (logoUrlCache) {
        return logoUrlCache;
    }

    try {
        const docRef = admin.firestore().doc('app_assets/media_urls');
        const docSnap = await docRef.get();
        
    
        if (docSnap.exists && docSnap.data().logo2k_url) {
            logoUrlCache = docSnap.data().logo2k_url;
            console.log("Logo URL'si Firestore'dan başarıyla çekildi ve önbelleğe alındı.");
            return logoUrlCache;
        }
        return '';
    } catch (error) {
        console.error("Firestore'dan logo URL'si çekilirken hata:", error);
        return '';
    }
}

export async function sendSystemNotification(
    targetUserId, 
    title, 
    messageBody,
    notificationType,
    actionTargetId
) {
  const db = admin.firestore();
  
  try {
    const logoUrl = await getLogoUrl();

    const userDoc = await db.collection('users').doc(targetUserId).get();
    if (!userDoc.exists) {
      console.warn(`Sistem Bildirimi: Kullanıcı bulunamadı: ${targetUserId}`);
      return;
    }

    const actionData = {
        route: 'myProfile',
        targetId: actionTargetId || targetUserId
    };
    
    const notificationForDb = {
        title: title,
        body: messageBody,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        type: notificationType,
        isRead: false,
        senderPhotoUrl: logoUrl,
        actionData: actionData
    };

    await db.collection('users').doc(targetUserId).collection('notifications').add(notificationForDb);

    const tokens = userDoc.data().fcmTokens;
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return;
    }

    const payload = {
      data: {
        title: title,
        body: messageBody,
        senderPhotoUrl: logoUrl,
        notificationType: notificationType,
        ...actionData 
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { 'content-available': 1 } } }
    };

    const sendPromises = tokens.map(token => admin.messaging().send({ ...payload, token }));
    await Promise.all(sendPromises);

  } catch (error) {
    console.error(`Sistem Bildirimi gönderilirken hata:`, error);
  }
}