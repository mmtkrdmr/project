// app/api/send-notification/route.js

import { NextResponse } from 'next/server';
import { sendStandardizedChatMessageNotification } from '@/lib/notificationServerLogic'; 

export async function POST(req) {
  try {
   
    const { userId, title, body, chatPartnerId, senderPhotoUrl, imageUrl } = await req.json();

    
    if (!userId || !title || !body || !chatPartnerId) {
      return NextResponse.json({ message: 'Eksik parametreler: userId, title, body, chatPartnerId gerekli.' }, { status: 400 });
    }

    
    await sendStandardizedChatMessageNotification(
      userId,
      title.split(' sana yeni bir mesaj gönderdi!')[0] || "Biri", 
      body,
      chatPartnerId,
      senderPhotoUrl, 
      imageUrl        
    );
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("send-notification API hatası:", error);
    return NextResponse.json({ success: false, message: 'Sunucu hatası.' }, { status: 500 });
  }
}