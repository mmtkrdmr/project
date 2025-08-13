import { NextResponse } from 'next/server';
import { sendSystemNotification } from '@/lib/systemNotificationSender';

export async function POST(req) {
  try {
    const { 
        userId, 
        title, 
        body, 
        notificationType,
        actionTargetId
    } = await req.json();

    // Sadece sistem bildirimleri için gerekli olanları kontrol et
    if (!userId || !title || !body) {
      return NextResponse.json({ message: 'Eksik parametreler: userId, title, body gerekli.' }, { status: 400 });
    }
    
    await sendSystemNotification(
      userId,
      title,
      body,
      notificationType,
      actionTargetId
    );
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("send-system-notification API hatası:", error);
    return NextResponse.json({ success: false, message: 'Sunucu hatası.' }, { status: 500 });
  }
}