import { sendNotificationToUser } from '@/lib/notificationHelper';
import { NextResponse } from 'next/server';

export async function POST(req) { // veya req: NextRequest
  try {
    // 1. Gelen isteğin içeriğini bir görelim, anasını sikelim
    const bodyPayload = await req.json();
    console.log("---------- YENİ TOPLU BİLDİRİM İSTEĞİ GELDİ ----------");
    console.log("BULK API'ye gelen Payload:", JSON.stringify(bodyPayload, null, 2));

    const { userIds, title, body, senderPhotoUrl, imageUrl, chatPartnerId } = bodyPayload;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
      console.error("HATA: Toplu bildirim için eksik veya yanlış parametreler var!");
      return NextResponse.json({ message: 'Eksik veya yanlış parametreler.' }, { status: 400 });
    }

    console.log(`${userIds.length} kullanıcıya toplu bildirim gönderimi başlatıldı...`);

    // Bu işlemi `await` ile beklemiyoruz ki, Firebase Function boşuna beklemesin.
    // Ama her bir görevin sonucunu görmek için Promise.all kullanabiliriz.
    const notificationPromises = userIds.map(userId => {
        return sendNotificationToUser(userId, title, body, senderPhotoUrl, imageUrl, chatPartnerId)
            .catch(err => {
                // Her bir hata için ayrı ayrı log basıyoruz.
                console.error(`Kullanıcı ${userId} için bildirim gönderilirken HATA oluştu:`, err);
            });
    });

    // Bütün bildirim gönderme işlemlerinin bitmesini bekle
    await Promise.all(notificationPromises);
    
    console.log("Tüm toplu bildirim gönderme görevleri tamamlandı.");

    return NextResponse.json({ success: true, message: `${userIds.length} kullanıcı için bildirim gönderme işlemi tamamlandı.` }, { status: 200 }); // 202 yerine 200 dönelim ki sonucu bilelim.

  } catch (error) {
    console.error('AMINA KODUĞUMUN TOPLU BİLDİRİM API HATASI:', error);
    return NextResponse.json({ success: false, message: 'Sunucu hatası.' }, { status: 500 });
  }
}