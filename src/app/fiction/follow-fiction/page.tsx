'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
// ##### HATA DÜZELTMESİ: Gerekli tüm importlar eklendi. #####
import { collection, query, where, onSnapshot, orderBy, doc as firestoreDoc, updateDoc, Timestamp, getDoc, deleteField, getCountFromServer } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, Clock, User, Users, FileText, XCircle, PauseCircle, PlayCircle, Loader2, Info, CheckCircle } from 'lucide-react';
import Image from 'next/image';

// VERİ TİPLERİ VE YARDIMCI FONKSİYONLAR
type MediaType = 'image' | 'video' | 'voice';
interface MessageInFiction { textTemplate: string; attachedMediaUrl: string | null; attachedMediaType: MediaType | null; }
interface Fiction {
    id: string;
    senderProfileId: string;
    senderProfileName: string;
    senderProfilePhotoUrl?: string;
    targetFilters: { gender: string; city: string; dateRange: string; };
    messages: MessageInFiction[];
    schedule: { startTime: Timestamp; intervalMinutes: number; };
    progress?: { sentCount: number; totalTarget: number; status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled'; lastSentMessageIndex: number; };
    createdAt: Timestamp;
    status: 'depoda' | 'takipte' | 'tamamlandı' | 'iptal edildi';
}

const CountdownTimer = ({ targetDate }: { targetDate: Timestamp }) => {
    const calculateTimeLeft = () => {
        if (!targetDate) return {};
        const difference = targetDate.toMillis() - new Date().getTime();
        let timeLeft: { [key: string]: number } = {};
        if (difference > 0) { timeLeft = { gün: Math.floor(difference / (1000 * 60 * 60 * 24)), saat: Math.floor((difference / (1000 * 60 * 60)) % 24), dakika: Math.floor((difference / 1000 / 60) % 60), saniye: Math.floor((difference / 1000) % 60) }; }
        return timeLeft;
    };
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);
    useEffect(() => {
        const timer = setTimeout(() => { setTimeLeft(calculateTimeLeft()); }, 1000);
        return () => clearTimeout(timer);
    });
    const timerComponents = Object.entries(timeLeft).filter(([_, value]) => value > 0).map(([unit, value]) => ( <span key={unit}>{`${value} ${unit}`}</span> ));
    return ( <div className="text-sm font-mono text-amber-400"> {timerComponents.length ? timerComponents.join(' ') : <span>Başlıyor...</span>} </div> );
};


export default function FollowFictionPage() {
    const [fictions, setFictions] = useState<Fiction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedFictionId, setExpandedFictionId] = useState<string | null>(null);

    useEffect(() => {
        const q = query(
            collection(db, "fictions"), 
            where("status", "==", "takipte"),
            orderBy("schedule.startTime", "asc")
        );
        
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const fictionsDataPromises = querySnapshot.docs.map(async (docData) => {
                const data = docData.data();
                const profileDocRef = firestoreDoc(db, "profiles", data.senderProfileId);
                const profileDocSnap = await getDoc(profileDocRef);
                const profilePhotoUrl = profileDocSnap.exists() ? profileDocSnap.data().photoUrl : null;

                return {
                    id: docData.id,
                    ...data,
                    senderProfilePhotoUrl: profilePhotoUrl
                } as Fiction;
            });

            const fictionsData = await Promise.all(fictionsDataPromises);
            setFictions(fictionsData);
            setLoading(false);
        }, (err) => {
            console.error("Takipteki kurguları dinlerken hata:", err);
            setError("Kurgular yüklenemedi.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleUpdateStatus = async (fictionId: string, newStatus: 'paused' | 'running' | 'cancelled') => {
        const docRef = firestoreDoc(db, 'fictions', fictionId);
        try {
            if (newStatus === 'paused' || newStatus === 'running') {
                await updateDoc(docRef, { "progress.status": newStatus });
            } else if (newStatus === 'cancelled') {
                await updateDoc(docRef, {
                    status: 'depoda',
                    schedule: deleteField(),
                    progress: deleteField()
                });
            }
        } catch (err) {
            console.error(`Kurgu durumu güncellenirken hata: ${newStatus}`, err);
            alert("İşlem başarısız oldu.");
        }
    };

    const getStatusChip = (status: string | undefined) => {
        switch (status) {
            case 'running': return <span className="px-2 py-1 text-xs font-semibold text-green-300 bg-green-900/50 rounded-full">Gönderiliyor</span>;
            case 'paused': return <span className="px-2 py-1 text-xs font-semibold text-orange-300 bg-orange-900/50 rounded-full">Durduruldu</span>;
            default: return <span className="px-2 py-1 text-xs font-semibold text-yellow-300 bg-yellow-900/50 rounded-full">Bekliyor</span>;
        }
    };

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#1E1E2F] text-white">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                     <Eye className="w-8 h-8 text-purple-400"/>
                    <h1 className="text-2xl font-bold">Kurgu Takip</h1>
                </div>

                {loading && <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-purple-400"/></div>}
                {error && <p className="text-center text-red-500">{error}</p>}
                
                {!loading && fictions.length === 0 && (
                    <div className="text-center py-16 px-6 bg-[#2D2D42] rounded-lg">
                        <Info className="w-12 h-12 mx-auto text-gray-500 mb-4"/>
                        <h2 className="text-xl font-semibold mb-2">Takip Edilen Kurgu Yok</h2>
                        <p className="text-gray-400">"Kurgu Deposu" sayfasından bir kurguyu zamanlayarak buraya ekleyebilirsiniz.</p>
                    </div>
                )}
                
                {!loading && fictions.length > 0 && (
                    <div className="space-y-6">
                        {fictions.map(fiction => {
                            const lastSentIndex = fiction.progress?.lastSentMessageIndex ?? -1;
                            const totalMessages = fiction.messages.length;
                            const progressPercent = totalMessages > 0 ? ((lastSentIndex + 1) / totalMessages) * 100 : 0;
                            
                            return (
                            <motion.div key={fiction.id} layout className="bg-[#2D2D42] rounded-lg shadow-lg">
                                <div className="p-5 cursor-pointer" onClick={() => setExpandedFictionId(expandedFictionId === fiction.id ? null : fiction.id)}>
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1">
                                            <Image src={fiction.senderProfilePhotoUrl || '/default-avatar.png'} alt={fiction.senderProfileName} width={48} height={48} className="w-12 h-12 rounded-full object-cover"/>
                                            <div>
                                                <p className="font-bold text-lg text-white">{fiction.senderProfileName}</p>
                                                <p className="text-xs text-gray-400">Başlangıç: {new Date(fiction.schedule.startTime.seconds * 1000).toLocaleString('tr-TR')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-300"><Users className="w-4 h-4"/> {fiction.targetFilters.city} / {fiction.targetFilters.gender}</div>
                                            {getStatusChip(fiction.progress?.status)}
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <div className="flex justify-between items-center mb-1 text-sm">
                                            <span className="text-gray-400">İlerleme ({lastSentIndex + 1} / {totalMessages} Mesaj)</span>
                                            <span className="font-semibold text-white">{progressPercent.toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${progressPercent}%` }}></div></div>
                                    </div>
                                </div>

                                <AnimatePresence>
                                {expandedFictionId === fiction.id && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                        <div className="px-5 pb-5 pt-4 border-t border-gray-700">
                                             <div className="space-y-3">
                                                {fiction.messages.map((msg, index) => {
                                                    const isSent = lastSentIndex >= index;
                                                    const isSending = lastSentIndex + 1 === index && fiction.progress?.status === 'running';
                                                    return(
                                                    <div key={index} className="bg-[#1E1E2F] p-3 rounded-md flex items-center justify-between gap-4">
                                                         <p className="text-gray-300 whitespace-pre-wrap flex-1"><strong>{index + 1}.</strong> "{msg.textTemplate}"</p>
                                                         {isSent && <span className="flex items-center gap-1.5 text-xs text-green-400"><CheckCircle className="w-4 h-4"/>Gönderildi</span>}
                                                         {isSending && <span className="flex items-center gap-1.5 text-xs text-yellow-400 animate-pulse"><Loader2 className="w-4 h-4 animate-spin"/>Gönderiliyor</span>}
                                                         {!isSent && !isSending && <span className="flex items-center gap-1.5 text-xs text-gray-500"><Clock className="w-4 h-4"/>Bekliyor</span>}
                                                    </div>
                                                )})}
                                            </div>
                                            <div className="mt-4 flex justify-between items-center">
                                                <div>
                                                    {(!fiction.progress || fiction.progress?.status !== 'running' && fiction.progress?.status !== 'paused') && <CountdownTimer targetDate={fiction.schedule.startTime} />}
                                                    {fiction.progress?.status === 'running' && <p className="text-sm text-green-400">Gönderim aktif...</p>}
                                                    {fiction.progress?.status === 'paused' && <p className="text-sm text-orange-400">Gönderim durduruldu.</p>}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {(fiction.progress?.status === 'running' || fiction.progress?.status === 'pending') && <button onClick={() => handleUpdateStatus(fiction.id, 'paused')} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-yellow-600 rounded-lg hover:bg-yellow-700"><PauseCircle className="w-4 h-4"/> Durdur</button>}
                                                    {(fiction.progress?.status === 'paused') && <button onClick={() => handleUpdateStatus(fiction.id, 'running')} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-green-600 rounded-lg hover:bg-green-700"><PlayCircle className="w-4 h-4"/> Devam Et</button>}
                                                    <button onClick={() => handleUpdateStatus(fiction.id, 'cancelled')} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-red-800 rounded-lg hover:bg-red-900"><XCircle className="w-4 h-4"/> İptal Et & Depoya Gönder</button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                </AnimatePresence>
                            </motion.div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}