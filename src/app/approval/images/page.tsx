'use client';

import { useState, useEffect, useMemo } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, Timestamp, setDoc, writeBatch, getDoc, arrayUnion } from 'firebase/firestore';
import { ref, deleteObject } from "firebase/storage";
import Image from 'next/image';
import { Check, X, User, ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ARAYÜZLER
interface PendingPhoto { id: string; userId: string; userName: string; userCurrentPhotoUrl?: string | null; pendingPhotoUrl: string; status: 'pending'; timestamp: Timestamp; }
interface GroupedPendingPhotos { [userId: string]: { userName: string; userCurrentPhotoUrl?: string | null; photos: PendingPhoto[]; }; }

// Fareyi takip eden büyük önizleme bileşeni
const HoverPreview = ({ photo }: { photo: { url: string; x: number; y: number } | null }) => {
    if (!photo) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            // DEĞİŞİKLİK: Konumlandırma, büyük boyuta göre ayarlandı (y ekseninde -300)
            animate={{ opacity: 1, scale: 1, x: photo.x + 20, y: photo.y - 300 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            // DEĞİŞİKLİK: Boyutlar çok daha büyük hale getirildi
            className="fixed top-0 left-0 w-[600px] h-[600px] rounded-lg shadow-2xl bg-black overflow-hidden z-50 pointer-events-none"
        >
            <Image
                src={photo.url}
                alt="Büyük Önizleme"
                fill
                sizes="600px" // Yeni boyuta uygun olarak güncellendi
                className="object-contain"
            />
        </motion.div>
    );
};


export default function ImageApprovalPage() {
    const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectedPhotoIds, setRejectedPhotoIds] = useState<Set<string>>(new Set());
    const [hoveredPhoto, setHoveredPhoto] = useState<{ url: string; x: number; y: number } | null>(null);

    // Onay bekleyen fotoğrafları dinle
    useEffect(() => {
        const q = query(collection(db, 'pending_photos'), orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const photos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingPhoto));
            setPendingPhotos(photos); setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Veriyi kullanıcı ID'sine göre grupla
    const groupedPhotos: GroupedPendingPhotos = useMemo(() => {
        return pendingPhotos.reduce((acc, photo) => {
            if (!acc[photo.userId]) {
                acc[photo.userId] = { userName: photo.userName, userCurrentPhotoUrl: photo.userCurrentPhotoUrl, photos: [] };
            }
            acc[photo.userId].photos.push(photo);
            return acc;
        }, {} as GroupedPendingPhotos);
    }, [pendingPhotos]);

    // Fotoğrafı reddedilecekler listesine ekleme/çıkarma fonksiyonu
    const toggleRejection = (photoId: string) => {
        setRejectedPhotoIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(photoId)) newSet.delete(photoId);
            else newSet.add(photoId);
            return newSet;
        });
    };

    // Toplu Onay/Red Fonksiyonu
    const handleProcessUserPhotos = async (userId: string, photos: PendingPhoto[]) => {
    if (processingId) return;
    setProcessingId(userId);

    const batch = writeBatch(db);
    const userDocRef = doc(db, 'users', userId);

    try {
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) throw new Error("Kullanıcı bulunamadı!");
        
        let currentUserData = userDocSnap.data();
        let primaryPhotoUrl = currentUserData.photoUrl || "";
        
        const photosToApprove: string[] = [];
        const photosToReject: PendingPhoto[] = [];

        photos.forEach(photo => {
            if (rejectedPhotoIds.has(photo.id)) {
                photosToReject.push(photo);
            } else {
                photosToApprove.push(photo.pendingPhotoUrl);
            }
        });
        
        const finalOtherPhotos = [...(currentUserData.otherPhotoUrls || [])];
        photosToApprove.forEach(url => {
            if (!primaryPhotoUrl) primaryPhotoUrl = url;
            else finalOtherPhotos.push(url);
        });
        
        batch.update(userDocRef, { photoUrl: primaryPhotoUrl, otherPhotoUrls: finalOtherPhotos });

        photos.forEach(photo => {
            const pendingDocRef = doc(db, 'pending_photos', photo.id);
            batch.delete(pendingDocRef);
        });

        const rejectionPromises = photosToReject.map(photo => {
            const storageRef = ref(storage, photo.pendingPhotoUrl);
            return deleteObject(storageRef);
        });
        await Promise.all([batch.commit(), ...rejectionPromises]);
        


        try {
            let title = '';
            let body = '';
            
            if (photosToApprove.length > 0 && photosToReject.length > 0) {
                title = 'Fotoğrafların incelendi! ✅❌';
                body = `${photosToApprove.length} fotoğrafın onaylandı, ama ${photosToReject.length} tanesi kurallara uymadığı için reddedildi.`;
            } else if (photosToApprove.length > 0) {
                title = 'Harika haber! Fotoğrafların onaylandı! ✅';
                body = `Gönderdiğin ${photosToApprove.length} fotoğrafın da profilinde yayınlandı. Harika görünüyorsun!`;
            } else if (photosToReject.length > 0) {
                title = 'Fotoğrafların reddedildi ❌';
                body = `Gönderdiğin ${photosToReject.length} fotoğraf maalesef kurallarımıza uymadığı için reddedildi.`;
            }

            if (title && body) {
                await fetch('/api/send-system-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userId,
                        title: title,
                        body: body,
                        notificationType: 'PHOTO_APPROVAL',
                        actionTargetId: userId
                    }),
                });
            }
        } catch (error) {
            console.error("API'ye fotoğraf onay bildirimi gönderilirken hata oluştu:", error);
        }
        
        console.log(`Kullanıcı ${userId} için işlemler tamamlandı.`);
        setRejectedPhotoIds(prev => {
            const newSet = new Set(prev);
            photos.forEach(p => newSet.delete(p.id));
            return newSet;
        });

    } catch (error) {
        console.error("Fotoğraflar işlenirken hata:", error); 
        alert("İşlem sırasında bir hata oluştu.");
    } finally {
        setProcessingId(null);
    }
};

    return (
        <>
            <HoverPreview photo={hoveredPhoto} />
            
            <div className="p-4 md:p-8 h-full overflow-y-auto bg-gray-900 text-white custom-scrollbar">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-3xl font-bold mb-2">Resim Onay Paneli</h1>
                    <p className="text-gray-400 mb-8">{Object.keys(groupedPhotos).length} kullanıcının onayı bekleniyor.</p>

                    {loading ? ( <div className="text-center py-10"><p>Onaylar yükleniyor...</p></div> ) 
                    : (
                        <AnimatePresence>
                            {Object.keys(groupedPhotos).length === 0 ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 bg-gray-800 rounded-lg">
                                    <ImageIcon className="mx-auto h-12 w-12 text-gray-500" />
                                    <h3 className="mt-2 text-sm font-medium text-gray-300">Onay Bekleyen Fotoğraf Yok</h3>
                                </motion.div>
                            ) : (
                                <div className="space-y-8">
                                    {Object.entries(groupedPhotos).map(([userId, data]) => (
                                        <motion.div
                                            key={userId}
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className={`bg-gray-800 rounded-xl shadow-lg transition-opacity duration-300 ${processingId === userId ? 'opacity-50' : ''}`}
                                        >
                                            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden relative">
                                                        {data.userCurrentPhotoUrl ? (
                                                            <Image src={data.userCurrentPhotoUrl} alt="Mevcut" fill sizes="40px" className="object-cover" />
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full"><User className="w-5 h-5 text-gray-400"/></div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold">{data.userName}</p>
                                                        <p className="text-xs text-gray-500">{data.photos.length} yeni fotoğraf</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleProcessUserPhotos(userId, data.photos)} disabled={!!processingId} className="flex items-center justify-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded-md text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                                                    <Check className="w-4 h-4" /> Onayla
                                                </button>
                                            </div>

                                            <div className="p-4 flex flex-wrap gap-4">
                                                {data.photos.map(photo => {
                                                    const isRejected = rejectedPhotoIds.has(photo.id);
                                                    return (
                                                        <motion.div
                                                            key={photo.id}
                                                            onClick={() => toggleRejection(photo.id)}
                                                            onMouseMove={(e) => setHoveredPhoto({ url: photo.pendingPhotoUrl, x: e.pageX, y: e.pageY })}
                                                            onMouseLeave={() => setHoveredPhoto(null)}
                                                            className="relative w-48 h-60 rounded-md bg-black overflow-hidden cursor-pointer group"
                                                        >
                                                            <Image 
                                                                src={photo.pendingPhotoUrl} 
                                                                alt="Yeni" 
                                                                fill 
                                                                sizes="192px"
                                                                className="object-contain transition-transform duration-300"
                                                            />
                                                            
                                                            <AnimatePresence>
                                                            {isRejected && (
                                                                <motion.div 
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: 1 }}
                                                                    exit={{ opacity: 0 }}
                                                                    className="absolute inset-0 bg-red-800/70 border-4 border-red-500 flex items-center justify-center">
                                                                    <X className="w-8 h-8 text-white"/>
                                                                </motion.div>
                                                            )}
                                                            </AnimatePresence>

                                                            {!isRejected && (
                                                                <div className="absolute inset-0 bg-green-800/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                                                                    <Check className="w-8 h-8 text-white" />
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </>
    );
}