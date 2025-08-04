// app/api/send-notification/route.js

import { sendNotificationToUser } from '@/lib/notificationHelper';
import { NextResponse } from 'next/server';

export async function POST(req) { // veya req: NextRequest
  try {
    // 1. Gelen isteğin içeriğini bir görelim
    const bodyPayload = await req.json();
    

    const { userId, title, body, senderPhotoUrl, imageUrl, chatPartnerId  } = bodyPayload;

    // 2. Parametreleri doğru alabilmiş miyiz, bir kontrol edelim
  

    if (!userId || !title || !body) {
     
      return NextResponse.json({ message: 'Eksik parametreler' }, { status: 400 });
    }

    // 3. Yardımcı fonksiyona göndermeden hemen önce son bir kontrol
    
    await sendNotificationToUser(userId, title, body, senderPhotoUrl, imageUrl, chatPartnerId );
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Sunucu hatası.' }, { status: 500 });
  }
}