'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, Timestamp, setDoc } from 'firebase/firestore';
import { Check, X, User, Clock, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Arayüz Tanımlaması
interface PendingDescription {
    id: string;
    userId: string;
    userName: string;
    currentDescription: string;
    pendingDescription: string;
    status: 'pending';
    timestamp: Timestamp;
}

// Zaman formatlama fonksiyonu
const formatTimeAgo = (timestamp: Timestamp | null): string => {
    if (!timestamp) return 'Bilinmiyor';
    const now = new Date();
    const requestDate = timestamp.toDate();
    const seconds = Math.floor((now.getTime() - requestDate.getTime()) / 1000);

    let interval = seconds / 86400;
    if (interval > 7) return requestDate.toLocaleDateString('tr-TR');
    if (interval > 1) return Math.floor(interval) + " gün önce";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " saat önce";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " dakika önce";
    return "az önce";
};

export default function AboutApprovalPage() {
    const [pendingDescriptions, setPendingDescriptions] = useState<PendingDescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // 1. Onay bekleyen açıklamaları gerçek zamanlı olarak dinle
    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, 'pending_descriptions'), orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const descriptions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingDescription));
            setPendingDescriptions(descriptions);
            setLoading(false);
        }, (error) => {
            console.error("Onay bekleyen açıklamaları dinlerken hata:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 2. Onaylama Fonksiyonu
    const handleApprove = async (request: PendingDescription) => {
        if (processingId) return;
        setProcessingId(request.id);

        try {
            const userDocRef = doc(db, 'users', request.userId);
            const pendingDocRef = doc(db, 'pending_descriptions', request.id);
            const notificationDocRef = doc(collection(db, `users/${request.userId}/notifications`));

            await Promise.all([
                updateDoc(userDocRef, { description: request.pendingDescription }),
                deleteDoc(pendingDocRef),
                setDoc(notificationDocRef, {
                    message: "Hakkında metniniz onaylandı.",
                    type: "description_approved",
                    read: false,
                    timestamp: Timestamp.now()
                })
            ]);
            console.log(`Açıklama onaylandı: UserID ${request.userId}`);
            try {
                await fetch('/api/send-notification', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId: request.userId,
                        title: 'Hakkında metnin onaylandı! ✅',
                        body: 'Profilindeki yeni hakkında metni artık herkes tarafından görülebilir. Harika!',
                        senderPhotoUrl: null,
                        imageUrl: null,
                        // chatPartnerId GÖNDERMİYORUZ Kİ, SADECE UYGULAMA AÇILSIN
                    }),
                });
            } catch (error) {
                console.error("API'ye hakkında onay bildirimi gönderilirken hata oluştu:", error);
            }
        } catch (error) {
            console.error("Açıklama onaylanırken hata:", error);
            alert("İşlem sırasında bir hata oluştu.");
        } finally {
            setProcessingId(null);
        }
    };

    // 3. Reddetme Fonksiyonu
    const handleReject = async (request: PendingDescription) => {
    if (processingId) return;
    setProcessingId(request.id);

    try {
        // 1. Önce bekleyen isteği veritabanından sil.
        const pendingDocRef = doc(db, 'pending_descriptions', request.id);
        await deleteDoc(pendingDocRef);

        // 2. Şimdi SADECE API üzerinden bildirim gönder.
        // Kayıt işlemini API'ın içindeki systemNotificationSender yapacak.
        await fetch('/api/send-system-notification', { // YENİ API YOLU
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: request.userId,
                title: 'Hakkında metnin reddedildi ❌',
                body: 'Yazdığın hakkında metni maalesef topluluk kurallarımıza uymadığı için onaylanmadı.',
                notificationType: 'ABOUT_REJECTED', // Özel bildirim tipi
                actionTargetId: request.userId // Tıklanınca profile gitmesi için
            }),
        });
        
        console.log(`Açıklama reddedildi: UserID ${request.userId}`);

    } catch (error) {
        console.error("Açıklama reddedilirken hata:", error);
        alert("İşlem sırasında bir hata oluştu.");
    } finally {
        setProcessingId(null);
    }
};

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-gray-900 text-white custom-scrollbar">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Hakkında Onay Paneli</h1>
                <p className="text-gray-400 mb-8">Onay bekleyen {pendingDescriptions.length} açıklama var.</p>

                {loading ? (
                    <div className="text-center py-10">
                        <p>Onaylar yükleniyor...</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {pendingDescriptions.length === 0 ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 bg-gray-800 rounded-lg">
                                <FileText className="mx-auto h-12 w-12 text-gray-500" />
                                <h3 className="mt-2 text-sm font-medium text-gray-300">Onay Bekleyen Açıklama Yok</h3>
                                <p className="mt-1 text-sm text-gray-500">Yeni bir açıklama onaya gönderildiğinde burada görünecek.</p>
                            </motion.div>
                        ) : (
                            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                                <div className="divide-y divide-gray-700">
                                    {pendingDescriptions.map((request) => (
                                        <motion.div
                                            key={request.id}
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0, x: -50 }}
                                            className={`p-4 transition-opacity duration-300 ${processingId === request.id ? 'opacity-40' : 'hover:bg-gray-700/50'}`}
                                        >
                                            <div className="flex flex-col md:flex-row md:items-start md:gap-6">
                                                {/* Kullanıcı Bilgisi ve İşlem Butonları */}
                                                <div className="w-full md:w-64 flex-shrink-0 mb-4 md:mb-0">
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4 text-gray-400" />
                                                        <span className="font-semibold text-white">{request.userName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{formatTimeAgo(request.timestamp)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-4">
                                                        <button
                                                            onClick={() => handleReject(request)}
                                                            disabled={!!processingId}
                                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-800 hover:bg-red-700 rounded-md text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                        >
                                                            <X className="w-4 h-4" /> Reddet
                                                        </button>
                                                        <button
                                                            onClick={() => handleApprove(request)}
                                                            disabled={!!processingId}
                                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-700 hover:bg-green-600 rounded-md text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                        >
                                                            <Check className="w-4 h-4" /> Onayla
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Açıklamalar */}
                                                <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-gray-400 mb-1">Mevcut Açıklama</h4>
                                                        <p className="p-3 bg-gray-900 rounded-md text-sm text-gray-300 min-h-[60px]">
                                                            {request.currentDescription || <span className="text-gray-500">Yok</span>}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-amber-400 mb-1">Yeni Açıklama</h4>
                                                        <p className="p-3 bg-gray-900 rounded-md text-sm text-white min-h-[60px]">
                                                            {request.pendingDescription}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}