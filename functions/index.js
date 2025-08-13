const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");
try {
  admin.initializeApp();
} catch (e) {
  // console.error("initializeApp hatası (muhtemelen zaten başlatılmış):", e);
}
const db = admin.firestore();

// YARDIMCI DİL FONKSİYONLARI (DEĞİŞİKLİK YOK)
const getLocativeSuffix = (city) => { if (!city) return ''; const vowels = 'aeıioöuü'; const backVowels = 'aıou'; const hardConsonants = 'fstkçşhp'; const lowerCity = city.toLowerCase(); const lastChar = lowerCity.charAt(city.length - 1); let lastVowel = ''; for (let i = city.length - 1; i >= 0; i--) { if (vowels.includes(lowerCity.charAt(i))) { lastVowel = lowerCity.charAt(i); break; } } const consonant = hardConsonants.includes(lastChar) ? 't' : 'd'; const vowel = backVowels.includes(lastVowel) ? 'a' : 'e'; return `${city}'${consonant}${vowel}`; };
const getGenitiveSuffix = (city) => { if (!city) return ''; const vowels = 'aeıioöuü'; const lastChar = city.slice(-1).toLowerCase(); const needsN = vowels.includes(lastChar); let lastVowel = ''; for (let i = city.length - 1; i >= 0; i--) { const char = city.charAt(i).toLowerCase(); if (vowels.includes(char)) { lastVowel = char; break; } } let suffixBase = ''; switch (lastVowel) { case 'a': case 'ı': suffixBase = 'ın'; break; case 'e': case 'i': suffixBase = 'in'; break; case 'o': case 'u': suffixBase = 'un'; break; case 'ö': case 'ü': suffixBase = 'ün'; break; default: suffixBase = 'in'; } const connector = needsN ? 'n' : ''; return `${city}'${connector}${suffixBase}`; };


// <-- YENİ: STANDART BİLDİRİM FONKSİYONUNU BURAYA TANIMLIYORUZ -->
/**
 * Tüm mesaj türleri için standart bir FCM bildirimi gönderir.
 * @param {string} targetUserId Bildirimi alacak kullanıcının ID'si.
 * @param {string} senderName Bildirim başlığında görünecek gönderici adı.
 * @param {string} messageBody Bildirim gövdesinde görünecek mesaj metni.
 * @param {string} chatPartnerId Uygulama açıldığında doğru sohbet ekranına yönlendirmek için gönderen profilin ID'si.
 * @param {string|null} senderPhotoUrl Bildirim verisine eklenecek gönderen fotoğrafı URL'si.
 * @param {string|null} imageUrl Bildirimde büyük resim olarak gösterilecek medya URL'si (isteğe bağlı).
 */
async function sendStandardizedChatMessageNotification(targetUserId, senderName, messageBody, chatPartnerId, senderPhotoUrl = null, imageUrl = null) {
  // Mevcut debug loglarınız aynı kalıyor
  console.log(`--- Bildirim gönderiliyor (Data-Only Stratejisi): Kullanıcı ${targetUserId} ---`);
  console.log(`Gönderen Avatar URL: ${senderPhotoUrl}`);
  console.log(`İçerik Resim URL: ${imageUrl}`);
  
  try {
    const userDoc = await db.collection('users').doc(targetUserId).get();
    if (!userDoc.exists) {
      console.warn(`Bildirim gönderilecek kullanıcı bulunamadı: ${targetUserId}`);
      return;
    }
    
    // <-- YENİ EKLENEN KISIM BAŞLANGICI -->
    // Anlık bildirim göndermeden ÖNCE, bu bilgileri Firestore'a kaydediyoruz.
    const notificationForDb = {
        title: `${senderName} sana yeni bir mesaj gönderdi!`,
        body: messageBody.length > 100 ? `${messageBody.substring(0, 97)}...` : messageBody, // Body'nin kısaltılmamış halini de saklayabiliriz. Hatta daha iyi olur.
        // body: messageBody, // Bildirime kaydedilecek metnin tam hali.
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        type: 'MESSAGE',
        isRead: false,
        senderPhotoUrl: senderPhotoUrl || '',
        actionData: {
            route: 'chat',
            partnerId: chatPartnerId
        }
    };

    // Kullanıcının altındaki 'notifications' koleksiyonuna yeni belgeyi ekliyoruz.
    // 'await' kullanıyoruz ki bu işlem bitmeden devam etmesin.
    await db.collection('users').doc(targetUserId).collection('notifications').add(notificationForDb);
    console.log(`Kullanıcı ${targetUserId} için bildirim Firestore'a başarıyla kaydedildi.`);
    // <-- YENİ EKLENEN KISIM SONU -->

    const tokens = userDoc.data().fcmTokens;
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      console.log(`Kullanıcı ${targetUserId} için FCM token yok, anlık bildirim atlanıyor. (Kayıt yapıldı)`);
      return; // Token olmasa bile veritabanına kaydettik.
    }

    // Payload kısmı aynı kalıyor, zaten doğru.
    const payload = {
      data: {
        title: `${senderName} sana yeni bir mesaj gönderdi!`,
        body: messageBody.length > 100 ? `${messageBody.substring(0, 97)}...` : messageBody,
        chatPartnerId: chatPartnerId,
        senderPhotoUrl: senderPhotoUrl || '',
        imageUrl: imageUrl || ''
      },
      android: {
          priority: 'high'
      },
      apns: {
          payload: {
              aps: {
                  'content-available': 1
              }
          }
      }
    };

    // Anlık bildirim gönderme kısmı aynı kalıyor
    const sendPromises = tokens.map(token => {
      const messageForToken = { ...payload, token };
      return admin.messaging().send(messageForToken);
    });

    await Promise.all(sendPromises);
    console.log(`Kullanıcı ${targetUserId} için Data-Only anlık bildirim başarıyla gönderildi.`);

  } catch (error) {
    // Hata mesajını daha detaylı hale getirelim
    console.error(`Kullanıcı ${targetUserId} için bildirim sürecinde (kayıt veya gönderme) bir hata oluştu:`, error);
  }
}


// ANA ZAMANLAYICI FONKSİYON (DEĞİŞİKLİK YOK)
exports.fictionScheduler = onSchedule({
    schedule: "every 1 minutes",
    region: "europe-west1",
    timeZone: "Europe/Istanbul",
    timeoutSeconds: 540,
}, async (event) => {
    console.log("Kurgu denetleyicisi çalışıyor...");
    const now = admin.firestore.Timestamp.now();
    const query = db.collection('fictions').where('status', '==', 'takipte');
    const snapshot = await query.get();
    if (snapshot.empty) {
        console.log("Takipte kurgu bulunamadı.");
        return null;
    }
    const processingPromises = snapshot.docs.map(doc => {
        const fiction = { id: doc.id, ...doc.data() };
        return processSingleFiction(fiction, now);
    });
    await Promise.all(processingPromises);
    console.log("Kurgu denetleyicisi tamamlandı.");
    return null;
});

async function processSingleFiction(fiction, now) {
    if (fiction.progress?.status === 'paused' || fiction.progress?.status === 'completed' || fiction.progress?.status === 'cancelled') { return; }
    const startTimeMillis = fiction.schedule.startTime.toMillis();
    if (now.toMillis() < startTimeMillis) { return; }
    if (!fiction.progress) {
        fiction.progress = { status: 'running', sentCount: 0, totalTarget: 0, lastSentMessageIndex: -1 };
        await db.collection('fictions').doc(fiction.id).update({ progress: fiction.progress });
    }
    const lastSentIndex = fiction.progress.lastSentMessageIndex ?? -1;
    const nextMessageIndex = lastSentIndex + 1;
    if (nextMessageIndex >= fiction.messages.length) { return finalizeFiction(fiction.id); }
    const intervalMillis = (fiction.schedule.intervalMinutes || 3) * 60 * 1000;
    const nextMessageSendTime = startTimeMillis + (nextMessageIndex * intervalMillis);
    if (now.toMillis() < nextMessageSendTime) { return; }

    console.log(`Kurgu ${fiction.id} için ${nextMessageIndex + 1}. mesajın gönderim zamanı geldi.`);
    let usersQuery = db.collection('users');
    if (fiction.targetFilters.gender !== 'Tümü') usersQuery = usersQuery.where('gender', '==', fiction.targetFilters.gender);
    if (fiction.targetFilters.city !== 'Tümü') usersQuery = usersQuery.where('city', '==', fiction.targetFilters.city);
    
    const targetUsersSnapshot = await usersQuery.get();
    if (targetUsersSnapshot.empty) { return finalizeFiction(fiction.id); }
    
    const messageToSend = fiction.messages[nextMessageIndex];
    const batch = db.batch();
    const notificationPromises = [];

    for (const userDoc of targetUsersSnapshot.docs) {
        const user = { id: userDoc.id, ...userDoc.data() };
        const userResponded = await checkIfUserResponded(fiction, user);
        if (userResponded) {
            continue;
        }

        const textToSend = messageToSend.textTemplate
            .replace(/{isim}/g, user.name || '')
            .replace(/{sehir}/g, user.city || '')
            .replace(/{sehirde}/g, getLocativeSuffix(user.city || ''))
            .replace(/{sehrin}/g, getGenitiveSuffix(user.city || ''));
        
        const notificationBody = textToSend.replace(/{resim}/g, '').trim() || 'Sana bir medya dosyası gönderdi.';
        
        // <-- DÜZELTME: {resim} tag'ini ve mesaja ekli medyayı kontrol edip bildirime gönderiyoruz. -->
        const sendUserPhoto = textToSend.includes('{resim}') && user.photoUrl;
        const imageUrlForNotification = messageToSend.attachedMediaUrl 
            ? messageToSend.attachedMediaUrl 
            : (sendUserPhoto ? user.photoUrl : null);

        notificationPromises.push(sendStandardizedChatMessageNotification(
            user.id,
            fiction.senderProfileName,
            notificationBody,
            fiction.senderProfileId,
            fiction.senderProfilePhotoUrl, // Bu, bildirimdeki küçük yuvarlak avatar (largeIcon) içindir
            imageUrlForNotification       // Bu, bildirimin içindeki büyük resim (BigPicture) içindir
        ));

        const messageRef = db.collection('messages').doc();
        const finalMessageText = textToSend.replace(/{resim}/g, '').trim();
        const baseMessageData = {
            chatId: [fiction.senderProfileId, user.id].sort().join('-'),
            senderId: fiction.senderProfileId,
            receiverId: user.id,
            isRead: false,
            participants: [fiction.senderProfileId, user.id],
            senderName: fiction.senderProfileName,
            senderPhotoUrl: fiction.senderProfilePhotoUrl || "",
            receiverName: user.name || "Bilinmeyen",
            receiverPhotoUrl: user.photoUrl || ""
        };
        if (finalMessageText || messageToSend.attachedMediaUrl) {
            batch.set(messageRef, { ...baseMessageData, message: finalMessageText, mediaUrl: messageToSend.attachedMediaUrl, type: messageToSend.attachedMediaUrl ? messageToSend.attachedMediaType : 'text', timestamp: admin.firestore.Timestamp.now() });
        }
        if (sendUserPhoto) {
            const imageMessageRef = db.collection('messages').doc();
            batch.set(imageMessageRef, { ...baseMessageData, message: '', mediaUrl: user.photoUrl, type: 'image', timestamp: admin.firestore.Timestamp.fromMillis(Date.now() + 1000) });
        }
    }

    await batch.commit();
    await Promise.all(notificationPromises);

    await db.collection('fictions').doc(fiction.id).update({
        "progress.lastSentMessageIndex": nextMessageIndex,
        "progress.sentCount": targetUsersSnapshot.size,
        "progress.totalTarget": targetUsersSnapshot.size
    });
}
// <-- SİLİNDİ: Eski `sendFictionNotification` fonksiyonunu buradan tamamen kaldırdık. -->

async function checkIfUserResponded(fiction, user) {
    const chatId = [fiction.senderProfileId, user.id].sort().join('-');
    const lastMessageQuery = db.collection('messages')
        .where('chatId', '==', chatId)
        .where('senderId', '==', user.id)
        .where('timestamp', '>', fiction.schedule.startTime)
        .limit(1);
    
    const snapshot = await lastMessageQuery.get();
    return !snapshot.empty;
}

async function finalizeFiction(fictionId) {
    const docRef = db.collection('fictions').doc(fictionId);
    console.log(`Kurgu ${fictionId} tamamlandı, depoya geri taşınıyor.`);
    await docRef.update({
        status: 'depoda',
        schedule: admin.firestore.FieldValue.delete(),
        progress: admin.firestore.FieldValue.delete()
    });
}
// YENİ FONKSİYON 1: Yeni moderatör oluşturur.
exports.createModerator = onCall({ region: "europe-west1" }, async (request) => {
    // Sadece 'superadmin' rolüne sahip birisi bu fonksiyonu çağırabilir.
    if (request.auth?.token?.role !== 'superadmin') {
        throw new functions.https.HttpsError('permission-denied', 'Bu işlemi yapmak için yetkiniz yok.');
    }

    const { email, password, name, permissions } = request.data;

    try {
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: name,
        });

        const claims = { ...permissions, role: 'moderator' };
        await admin.auth().setCustomUserClaims(userRecord.uid, claims);

        await db.collection('admins').doc(userRecord.uid).set({
            name: name,
            email: email,
            uid: userRecord.uid,
            permissions: permissions
        });

        return { result: `Moderator ${name} başarıyla oluşturuldu.` };
    } catch (error) {
        console.error("Moderator oluşturma hatası:", error);
        throw new functions.https.HttpsError('internal', 'Moderator oluşturulurken bir hata oluştu.', error.message);
    }
});

// YENİ FONKSİYON 2: Mevcut moderatörün izinlerini günceller.
exports.updateModeratorPermissions = onCall({ region: "europe-west1" }, async (request) => {
    if (request.auth?.token?.role !== 'superadmin') {
        throw new functions.https.HttpsError('permission-denied', 'Bu işlemi yapmak için yetkiniz yok.');
    }

    const { uid, permissions } = request.data;

    try {
        const claims = { ...permissions, role: 'moderator' };
        await admin.auth().setCustomUserClaims(uid, claims);
        await db.collection('admins').doc(uid).update({ permissions: permissions });
        
        return { result: `İzinler başarıyla güncellendi.` };
    } catch (error) {
        console.error("İzin güncelleme hatası:", error);
        throw new functions.https.HttpsError('internal', 'İzinler güncellenirken bir hata oluştu.', error.message);
    }
});

// YENİ FONKSİYON 3: Moderatörü siler.
exports.deleteModerator = onCall({ region: "europe-west1" }, async (request) => {
    if (request.auth?.token?.role !== 'superadmin') {
        throw new functions.https.HttpsError('permission-denied', 'Bu işlemi yapmak için yetkiniz yok.');
    }

    const { uid } = request.data;
    try {
        await admin.auth().deleteUser(uid);
        await db.collection('admins').doc(uid).delete();
        return { result: `Moderator başarıyla silindi.` };
    } catch (error) {
        console.error("Moderator silme hatası:", error);
        throw new functions.https.HttpsError('internal', 'Moderator silinirken bir hata oluştu.', error.message);
    }
});

exports.performAdminCleanup = onCall({ region: "europe-west1" }, async (request) => {
    // 1. Kullanıcının kimliğini ve rolünü doğrula
    if (request.auth?.token?.role !== 'superadmin') {
        throw new functions.https.HttpsError(
            'permission-denied', 
            'Bu işlemi yapmak için Super Admin yetkisine sahip olmalısınız.'
        );
    }

    const adminId = request.auth.uid;
    const task = request.data.task;
    console.log(`Super Admin [${adminId}] tarafından [${task}] görevi başlatıldı.`);

    // 2. Gelen göreve göre ilgili temizlik işlemini yap
    try {
        if (task === "deleteOldMessages") {
            const days = 30;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

            // Ana 'messages' koleksiyonundaki eski mesajları sil
            const messagesQuery = db.collection("messages").where("timestamp", "<", cutoffTimestamp);
            const messagesDeleted = await deleteCollectionBatch(db, messagesQuery);
            
            console.log(`${messagesDeleted} adet eski mesaj 'messages' koleksiyonundan silindi.`);
            return { success: true, message: `${messagesDeleted} adet eski mesaj başarıyla silindi.` };

        } else if (task === "clearStuckPendingChats") {
            const hours = 24;
            const cutoffDate = new Date();
            cutoffDate.setHours(cutoffDate.getHours() - hours);
            const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

            const pendingQuery = db.collection("pending_chats").where("lastMessageTimestamp", "<", cutoffTimestamp);
            const pendingDeleted = await deleteCollectionBatch(db, pendingQuery);
            
            console.log(`${pendingDeleted} adet sıkışmış sohbet 'pending_chats' koleksiyonundan silindi.`);
            return { success: true, message: `${pendingDeleted} adet sıkışmış bekleyen sohbet silindi.` };
        } else {
            throw new functions.https.HttpsError("invalid-argument", "Geçersiz görev adı.");
        }
    } catch (error) {
        console.error(`Görev [${task}] çalıştırılırken hata:`, error);
        throw new functions.https.HttpsError(
            "internal",
            "Sunucu tarafında görev çalıştırılırken bir hata oluştu. Lütfen logları kontrol edin.",
            error.message
        );
    }
});

// <-- YENİ: TOPLU SİLME İÇİN YARDIMCI FONKSİYON -->
async function deleteCollectionBatch(db, query, resolve = () => {}, reject = () => {}) {
    const snapshot = await query.limit(500).get();
  
    if (snapshot.size === 0) {
      // Silinecek başka bir şey kalmadı.
      return 0;
    }
  
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  
    // Silinen döküman sayısını döndür ve eğer daha fazla varsa kendini tekrar çağır.
    return snapshot.size + (await deleteCollectionBatch(db, query));
}