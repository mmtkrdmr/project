const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");
try {
  admin.initializeApp();
} catch (e) {
  console.error("initializeApp hatası (muhtemelen zaten başlatılmış):", e);
}
const db = admin.firestore();

// YARDIMCI DİL FONKSİYONLARI
const getLocativeSuffix = (city) => { if (!city) return ''; const vowels = 'aeıioöuü'; const backVowels = 'aıou'; const hardConsonants = 'fstkçşhp'; const lowerCity = city.toLowerCase(); const lastChar = lowerCity.charAt(city.length - 1); let lastVowel = ''; for (let i = city.length - 1; i >= 0; i--) { if (vowels.includes(lowerCity.charAt(i))) { lastVowel = lowerCity.charAt(i); break; } } const consonant = hardConsonants.includes(lastChar) ? 't' : 'd'; const vowel = backVowels.includes(lastVowel) ? 'a' : 'e'; return `${city}'${consonant}${vowel}`; };
const getGenitiveSuffix = (city) => { if (!city) return ''; const vowels = 'aeıioöuü'; const lastChar = city.slice(-1).toLowerCase(); const needsN = vowels.includes(lastChar); let lastVowel = ''; for (let i = city.length - 1; i >= 0; i--) { const char = city.charAt(i).toLowerCase(); if (vowels.includes(char)) { lastVowel = char; break; } } let suffixBase = ''; switch (lastVowel) { case 'a': case 'ı': suffixBase = 'ın'; break; case 'e': case 'i': suffixBase = 'in'; break; case 'o': case 'u': suffixBase = 'un'; break; case 'ö': case 'ü': suffixBase = 'ün'; break; default: suffixBase = 'in'; } const connector = needsN ? 'n' : ''; return `${city}'${connector}${suffixBase}`; };

// ANA ZAMANLAYICI FONKSİYON (HER 1 DAKİKADA BİR ÇALIŞIR)
exports.fictionScheduler = onSchedule({
    schedule: "every 1 minutes",
    region: "europe-west1",
    timeZone: "Europe/Istanbul",
    timeoutSeconds: 540, // Uzun sürebilecek işlemler için
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
    if (fiction.progress?.status === 'paused' || fiction.progress?.status === 'completed' || fiction.progress?.status === 'cancelled') {
        return;
    }
    const startTimeMillis = fiction.schedule.startTime.toMillis();
    if (now.toMillis() < startTimeMillis) {
        return;
    }
    if (!fiction.progress) {
        fiction.progress = { status: 'running', sentCount: 0, totalTarget: 0, lastSentMessageIndex: -1 };
        await db.collection('fictions').doc(fiction.id).update({ progress: fiction.progress });
    }
    const lastSentIndex = fiction.progress.lastSentMessageIndex ?? -1;
    const nextMessageIndex = lastSentIndex + 1;
    if (nextMessageIndex >= fiction.messages.length) {
        return finalizeFiction(fiction.id);
    }
    const intervalMillis = (fiction.schedule.intervalMinutes || 3) * 60 * 1000;
    const nextMessageSendTime = startTimeMillis + (nextMessageIndex * intervalMillis);
    if (now.toMillis() < nextMessageSendTime) {
        return;
    }
    console.log(`Kurgu ${fiction.id} için ${nextMessageIndex + 1}. mesajın gönderim zamanı geldi.`);
    let usersQuery = db.collection('users');
    if (fiction.targetFilters.gender !== 'Tümü') usersQuery = usersQuery.where('gender', '==', fiction.targetFilters.gender);
    if (fiction.targetFilters.city !== 'Tümü') usersQuery = usersQuery.where('city', '==', fiction.targetFilters.city);
    
    const targetUsersSnapshot = await usersQuery.get();
    if (targetUsersSnapshot.empty) {
        return finalizeFiction(fiction.id);
    }
    
    const messageToSend = fiction.messages[nextMessageIndex];
    const batch = db.batch();
    const notificationPromises = []; // Bildirim görevlerini burada toplayacağız

    for (const userDoc of targetUsersSnapshot.docs) {
        const user = { id: userDoc.id, ...userDoc.data() };
        const userResponded = await checkIfUserResponded(fiction, user);
        if (userResponded) {
            continue;
        }

        // BİLDİRİM GÖNDERME GÖREVİNİ LİSTEYE EKLE
        notificationPromises.push(sendFictionNotification(fiction, messageToSend, user));

        const messageRef = db.collection('messages').doc();
        const textToSend = messageToSend.textTemplate
            .replace(/{isim}/g, user.name || '')
            .replace(/{sehir}/g, user.city || '')
            .replace(/{sehirde}/g, getLocativeSuffix(user.city || ''))
            .replace(/{sehrin}/g, getGenitiveSuffix(user.city || ''));
        const sendUserPhoto = textToSend.includes('{resim}') && user.photoUrl;
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
    await Promise.all(notificationPromises); // Bütün bildirimlerin gönderilmesini bekle

    await db.collection('fictions').doc(fiction.id).update({
        "progress.lastSentMessageIndex": nextMessageIndex,
        "progress.sentCount": targetUsersSnapshot.size,
        "progress.totalTarget": targetUsersSnapshot.size
    });
}

// BİLDİRİM GÖNDEREN YARDIMCI FONKSİYON (Bunu da ekliyoruz)
async function sendFictionNotification(fiction, message, targetUser) {
    const tokens = targetUser.fcmTokens;
    if (!tokens || tokens.length === 0) {
        console.log(`Kullanıcı ${targetUser.id} için token yok, bildirim atlanıyor.`);
        return;
    }
    try {
        const textBody = message.textTemplate.replace(/{isim}|{sehir}|{sehirde}|{sehrin}|{resim}/g, '').trim();
        const sendUserPhoto = message.textTemplate.includes('{resim}') && targetUser.photoUrl;
        let notificationBody = '';
        if (textBody) {
            notificationBody = textBody.length > 100 ? textBody.substring(0, 97) + '...' : textBody;
        } else if (message.attachedMediaUrl || sendUserPhoto) {
            notificationBody = 'sana bir medya dosyası gönderdi';
        }
        const payload = {
            data: {
                title: `${fiction.senderProfileName} sana yeni bir mesaj gönderdi!`,
                body: notificationBody,
                senderPhotoUrl: fiction.senderProfilePhotoUrl || '',
                imageUrl: message.attachedMediaUrl || (sendUserPhoto ? targetUser.photoUrl : ''),
                chatPartnerId: fiction.senderProfileId
            }
        };
        await admin.messaging().sendToDevice(tokens, payload);
        console.log(`Kullanıcı ${targetUser.id} için bildirim başarıyla gönderildi.`);
    } catch (error) {
        console.error(`Kullanıcı ${targetUser.id} için bildirim gönderilirken hata:`, error);
    }
}


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
