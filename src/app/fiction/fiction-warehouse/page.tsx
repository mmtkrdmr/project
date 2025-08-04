'use client';

import { useState, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
// ##### HATA DÜZELTMESİ BURADA: 'doc' fonksiyonuna 'firestoreDoc' olarak yeni bir isim veriyoruz. #####
import { collection, query, where, onSnapshot, orderBy, doc as firestoreDoc, deleteDoc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Clock, User, Users, Trash2, Pencil, CalendarPlus, X, Loader2, Info, ChevronDown, Search } from 'lucide-react';
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
    schedule?: { startTime: Timestamp; intervalMinutes: number; };
    createdAt: Timestamp;
    status: 'depoda' | 'takipte' | 'tamamlandı';
}

const formatDateTime = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return "Zamanlanmadı";
    return new Date(timestamp.seconds * 1000).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

// ALT BİLEŞENLER
const DeleteConfirmModal = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void; }) => ( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}> <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[#2D2D42] rounded-lg p-6 w-96 text-white shadow-lg" onClick={e => e.stopPropagation()}> <h2 className="mb-4 text-xl font-semibold">Kurguyu Sil</h2> <p className="text-gray-400 mb-6">Bu kurguyu kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p> <div className="flex justify-end gap-4"> <button onClick={onCancel} className="rounded-md border border-gray-500 px-4 py-2 hover:bg-gray-700">İptal</button> <button onClick={onConfirm} className="rounded-md bg-red-600 px-4 py-2 hover:bg-red-700 text-white">Evet, Sil</button> </div> </motion.div> </motion.div> );
const ScheduleModal = ({ fiction, onConfirm, onCancel }: { fiction: Fiction; onConfirm: (startTime: string, interval: string) => void; onCancel: () => void; }) => {
    const [startTime, setStartTime] = useState('');
    const [interval, setInterval] = useState(fiction.schedule?.intervalMinutes.toString() || '3');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!startTime) { setError('Lütfen bir başlangıç zamanı seçin.'); return; }
        if (new Date(startTime) < new Date()) { setError('Başlangıç zamanı geçmiş bir tarih olamaz.'); return; }
        setError('');
        onConfirm(startTime, interval);
    };
    
    return ( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}> <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[#2D2D42] rounded-lg p-6 w-[450px] text-white shadow-lg" onClick={e => e.stopPropagation()}> <h2 className="mb-2 text-xl font-semibold">Kurguyu Zamanla</h2> <p className="text-gray-400 mb-6">"{fiction.senderProfileName}" profilinden gönderilecek bu kurgu için bir başlangıç zamanı belirleyin.</p> <div className="space-y-4"> <div> <label className="text-sm text-gray-400">Başlangıç Tarihi ve Saati</label> <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-[#1E1E2F] p-2 mt-1 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px] text-white" /> </div> <div> <label className="text-sm text-gray-400">Mesajlar Arası Süre (Dakika)</label> <input type="number" value={interval} onChange={e => setInterval(e.target.value)} min="1" className="w-full bg-[#1E1E2F] p-2 mt-1 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px]" /> </div> </div> {error && <p className="text-red-500 text-sm mt-4">{error}</p>} <div className="flex justify-end gap-4 mt-8"> <button onClick={onCancel} className="rounded-md border border-gray-500 px-4 py-2 hover:bg-gray-700">İptal</button> <button onClick={handleSubmit} className="rounded-md bg-purple-600 px-4 py-2 hover:bg-purple-700 text-white flex items-center gap-2"><CalendarPlus className="w-4 h-4"/> Takibe Al</button> </div> </motion.div> </motion.div> );
};

const EditFictionModal = ({ fiction, onSave, onCancel }: { fiction: Fiction; onSave: (updatedFictionData: Partial<Fiction>) => void; onCancel: () => void; }) => {
    const [messages, setMessages] = useState<MessageInFiction[]>(fiction.messages);
    const [schedule, setSchedule] = useState({
        startTime: fiction.schedule ? new Date(fiction.schedule.startTime.seconds * 1000).toISOString().slice(0, 16) : '',
        intervalMinutes: fiction.schedule?.intervalMinutes || 3
    });
    const [error, setError] = useState('');

    const handleMessageChange = (index: number, newText: string) => {
        const updatedMessages = [...messages];
        updatedMessages[index] = { ...updatedMessages[index], textTemplate: newText };
        setMessages(updatedMessages);
    };

    const handleSave = () => {
        if (schedule.startTime && new Date(schedule.startTime) < new Date()) {
             setError('Başlangıç zamanı geçmiş bir tarih olamaz.');
             return;
        }
        setError('');
        const updatedData: Partial<Fiction> = {
            messages,
            schedule: {
                startTime: Timestamp.fromDate(new Date(schedule.startTime)),
                intervalMinutes: Number(schedule.intervalMinutes)
            }
        };
        onSave(updatedData);
    };

    return ( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}> <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[#2D2D42] rounded-lg p-6 w-full max-w-2xl text-white shadow-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}> <h2 className="mb-4 text-xl font-semibold">Kurguyu Düzenle</h2> <div className="space-y-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-4"> <div> <label className="text-sm text-gray-400">Başlangıç Tarihi ve Saati</label> <input type="datetime-local" value={schedule.startTime} onChange={e => setSchedule(s => ({...s, startTime: e.target.value}))} className="w-full bg-[#1E1E2F] p-2 mt-1 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px] text-white" /> </div> <div> <label className="text-sm text-gray-400">Mesajlar Arası Süre (Dakika)</label> <input type="number" value={schedule.intervalMinutes} onChange={e => setSchedule(s => ({...s, intervalMinutes: Number(e.target.value)}))} min="1" className="w-full bg-[#1E1E2F] p-2 mt-1 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px]" /> </div> </div> {error && <p className="text-red-500 text-sm mb-4">{error}</p>} <div className="flex-1 overflow-y-auto space-y-3 pr-2"> {messages.map((msg, index) => ( <div key={index} className="bg-[#1E1E2F] p-3 rounded-md"> <label className="text-xs text-purple-400">Mesaj {index + 1}</label> <textarea value={msg.textTemplate} onChange={(e) => handleMessageChange(index, e.target.value)} className="w-full bg-transparent p-1 mt-1 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none h-20"/> {msg.attachedMediaUrl && <span className="text-xs text-gray-400">Medya Eki: {msg.attachedMediaType}</span>} </div> ))} </div> <div className="flex justify-end gap-4 mt-6"> <button onClick={onCancel} className="rounded-md border border-gray-500 px-4 py-2 hover:bg-gray-700">İptal</button> <button onClick={handleSave} className="rounded-md bg-purple-600 px-4 py-2 hover:bg-purple-700 text-white">Değişiklikleri Kaydet</button> </div> </motion.div> </motion.div> );
};


export default function FictionWarehousePage() {
    const [fictions, setFictions] = useState<Fiction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [fictionToDelete, setFictionToDelete] = useState<Fiction | null>(null);
    const [fictionToSchedule, setFictionToSchedule] = useState<Fiction | null>(null);
    const [fictionToEdit, setFictionToEdit] = useState<Fiction | null>(null);
    const [expandedFictionId, setExpandedFictionId] = useState<string | null>(null);

    useEffect(() => {
        const q = query(
            collection(db, "fictions"), 
            where("status", "==", "depoda"),
            orderBy("createdAt", "desc")
        );
        
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const fictionsDataPromises = querySnapshot.docs.map(async (docData) => {
                const data = docData.data();
                // ##### HATA DÜZELTMESİ BURADA: 'doc' yerine 'firestoreDoc' kullanıyoruz. #####
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
            console.error("Kurguları dinlerken hata:", err);
            setError("Kurgular yüklenemedi.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleDeleteFiction = async () => {
        if (!fictionToDelete) return;

        const fictionId = fictionToDelete.id;
        // ##### HATA DÜZELTMESİ BURADA #####
        const docRef = firestoreDoc(db, 'fictions', fictionId);

        try {
            const deletePromises = fictionToDelete.messages.map(msg => {
                if (msg.attachedMediaUrl) {
                    try {
                        const fileRef = ref(storage, msg.attachedMediaUrl);
                        return deleteObject(fileRef);
                    } catch (storageError) {
                        console.error(`Storage dosyası silinemedi: ${msg.attachedMediaUrl}`, storageError);
                        return Promise.resolve();
                    }
                }
                return Promise.resolve();
            });
            await Promise.all(deletePromises);
            await deleteDoc(docRef);
            setFictionToDelete(null);
        } catch (err) {
            console.error("Kurgu silinirken hata:", err);
            alert("Kurgu silinirken bir hata oluştu.");
        }
    };
    
    const handleScheduleFiction = async (startTime: string, interval: string) => {
        if (!fictionToSchedule) return;
        // ##### HATA DÜZELTMESİ BURADA #####
        const docRef = firestoreDoc(db, 'fictions', fictionToSchedule.id);
        try {
            await updateDoc(docRef, {
                status: 'takipte',
                schedule: {
                    startTime: Timestamp.fromDate(new Date(startTime)),
                    intervalMinutes: Number(interval)
                }
            });
            setFictionToSchedule(null);
        } catch (err) {
             console.error("Kurgu takibe alınırken hata:", err);
             alert("Kurgu takibe alınırken bir hata oluştu.");
        }
    };
    
    const handleUpdateFiction = async (updatedData: Partial<Fiction>) => {
        if (!fictionToEdit) return;
        // ##### HATA DÜZELTMESİ BURADA #####
        const docRef = firestoreDoc(db, 'fictions', fictionToEdit.id);
        try {
            await updateDoc(docRef, updatedData);
            setFictionToEdit(null);
        } catch(err) {
            console.error("Kurgu güncellenirken hata:", err);
            alert("Kurgu güncellenemedi.");
        }
    };

    const filteredFictions = fictions.filter(f => 
        f.senderProfileName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#1E1E2F] text-white">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                    <h1 className="text-2xl font-bold">Kurgu Deposu</h1>
                    <div className="relative w-full md:w-72">
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Gönderen profilde ara..." className="w-full bg-[#2D2D42] py-2 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search className="w-5 h-5"/></span>
                    </div>
                </div>
                
                {loading && <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-purple-400"/></div>}
                {error && <p className="text-center text-red-500">{error}</p>}

                {!loading && filteredFictions.length === 0 && (
                    <div className="text-center py-16 px-6 bg-[#2D2D42] rounded-lg">
                        <Info className="w-12 h-12 mx-auto text-gray-500 mb-4"/>
                        <h2 className="text-xl font-semibold mb-2">{searchTerm ? 'Arama Sonucu Bulunamadı' : 'Depo Boş'}</h2>
                        <p className="text-gray-400">{searchTerm ? 'Aradığınız kritere uygun bir kurgu bulunmuyor.' : '"Kurgu Ekle" sayfasından yeni bir kurgu oluşturabilirsiniz.'}</p>
                    </div>
                )}
                
                {!loading && filteredFictions.length > 0 && (
                    <div className="space-y-4">
                        {filteredFictions.map(fiction => (
                            <div key={fiction.id} className="bg-[#2D2D42] rounded-lg overflow-hidden transition-all duration-300">
                                <div className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer" onClick={() => setExpandedFictionId(expandedFictionId === fiction.id ? null : fiction.id)}>
                                    <div className="flex items-center gap-4 flex-1">
                                        <Image src={fiction.senderProfilePhotoUrl || '/default-avatar.png'} alt={fiction.senderProfileName} width={48} height={48} className="w-12 h-12 rounded-full object-cover"/>
                                        <div>
                                            <p className="font-bold text-lg text-white">{fiction.senderProfileName}</p>
                                            <p className="text-xs text-gray-400 flex items-center gap-1.5"><Clock className="w-3 h-3"/> {formatDateTime(fiction.schedule?.startTime)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-300 bg-[#1E1E2F] px-3 py-1 rounded-full"><Users className="w-4 h-4"/> Hedef: {fiction.targetFilters.gender}, {fiction.targetFilters.city}</div>
                                    <div className="flex items-center gap-2 text-sm text-gray-300 bg-[#1E1E2F] px-3 py-1 rounded-full"><FileText className="w-4 h-4"/> {fiction.messages.length} Mesaj</div>
                                    <ChevronDown className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${expandedFictionId === fiction.id ? 'rotate-180' : ''}`} />
                                </div>
                                
                                <AnimatePresence>
                                {expandedFictionId === fiction.id && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                        <div className="px-6 pb-6 pt-4 border-t border-gray-700">
                                            <h4 className="font-semibold mb-3 text-white">Mesaj Paketi Detayları:</h4>
                                            <div className="space-y-3 pl-4 border-l-2 border-purple-800">
                                                {fiction.messages.map((msg, index) => {
                                                    const interval = fiction.schedule?.intervalMinutes || 0;
                                                    const messageTime = fiction.schedule ? new Date(fiction.schedule.startTime.toMillis() + (index * interval * 60000)) : null;
                                                    return(
                                                    <div key={index} className="bg-[#1E1E2F] p-3 rounded-md">
                                                         <div className="flex justify-between items-start">
                                                            <p className="text-gray-300 whitespace-pre-wrap flex-1"><strong>{index + 1}. Mesaj:</strong> "{msg.textTemplate}"</p>
                                                            {messageTime && <span className="text-xs font-mono bg-gray-700 px-2 py-1 rounded text-purple-300 ml-4">{messageTime.toLocaleString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</span>}
                                                         </div>
                                                         {msg.attachedMediaUrl && <span className="text-xs text-purple-400 mt-1 block">Medya Eki: {msg.attachedMediaType}</span>}
                                                    </div>
                                                )})}
                                            </div>
                                            <div className="flex items-center justify-end gap-3 mt-6">
                                                <button onClick={() => setFictionToEdit(fiction)} className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-600 rounded-lg hover:bg-gray-700"><Pencil className="w-4 h-4"/> Düzenle</button>
                                                <button onClick={() => setFictionToDelete(fiction)} className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 rounded-lg hover:bg-red-700"><Trash2 className="w-4 h-4"/> Sil</button>
                                                <button onClick={() => setFictionToSchedule(fiction)} className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 rounded-lg hover:bg-purple-700"><CalendarPlus className="w-4 h-4"/> Takibe Al</button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {fictionToDelete && <DeleteConfirmModal onConfirm={handleDeleteFiction} onCancel={() => setFictionToDelete(null)} />}
                {fictionToSchedule && <ScheduleModal fiction={fictionToSchedule} onConfirm={handleScheduleFiction} onCancel={() => setFictionToSchedule(null)} />}
                {fictionToEdit && <EditFictionModal fiction={fictionToEdit} onSave={handleUpdateFiction} onCancel={() => setFictionToEdit(null)} />}
            </AnimatePresence>
        </div>
    );
}