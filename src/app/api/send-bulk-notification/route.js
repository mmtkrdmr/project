// app/api/send-bulk-notification/route.js

import { NextResponse } from 'next/server';
import { sendStandardizedChatMessageNotification } from '@/lib/notificationServerLogic';

export async function POST(req) {
  try {
    
    const { userIds, title, body, chatPartnerId, senderPhotoUrl, imageUrl } = await req.json();

    if (!userIds || !Array.isArray(userIds) || !title || !body || !chatPartnerId) {
      return NextResponse.json({ message: 'Eksik veya yanlış parametreler.' }, { status: 400 });
    }

    const senderName = title.split(' sana yeni bir mesaj gönderdi!')[0] || "Biri";

    
    const notificationPromises = userIds.map(userId => 
      sendStandardizedChatMessageNotification(
        userId,
        senderName,
        body,
        chatPartnerId,
        senderPhotoUrl, 
        imageUrl        
      )
    );

    
    await Promise.all(notificationPromises);

    return NextResponse.json({ success: true, message: `${userIds.length} kullanıcı için bildirim gönderme işlemi başlatıldı.` }, { status: 200 });
  } catch (error) {
    console.error("send-bulk-notification API hatası:", error);
    return NextResponse.json({ success: false, message: 'Sunucu hatası.' }, { status: 500 });
  }
}