'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, Timestamp, doc, arrayUnion, getDoc, limit, startAt, orderBy, endAt } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useDropzone } from 'react-dropzone';
import { User, ChevronDown, Send, RefreshCw, UploadCloud, X, Loader2, MessageSquare, Search } from 'lucide-react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';


// YARDIMCI FONKSİYONLAR: Türkçe ekleri getiren mantık
const getLocativeSuffix = (city: string) => {
    if (!city) return ''; const vowels = 'aeıioöuü'; const backVowels = 'aıou'; const hardConsonants = 'fstkçşhp'; const lowerCity = city.toLowerCase(); const lastChar = lowerCity.charAt(city.length - 1); let lastVowel = ''; for (let i = city.length - 1; i >= 0; i--) { if (vowels.includes(lowerCity.charAt(i))) { lastVowel = lowerCity.charAt(i); break; } } const consonant = hardConsonants.includes(lastChar) ? 't' : 'd'; const vowel = backVowels.includes(lastVowel) ? 'a' : 'e'; return `${city}'${consonant}${vowel}`;
};
const getGenitiveSuffix = (city: string) => {
    if (!city) return ''; const vowels = 'aeıioöuü'; const lastChar = city.slice(-1).toLowerCase(); const needsN = vowels.includes(lastChar); let lastVowel = ''; for (let i = city.length - 1; i >= 0; i--) { const char = city.charAt(i).toLowerCase(); if (vowels.includes(char)) { lastVowel = char; break; } } let suffixBase = ''; switch (lastVowel) { case 'a': case 'ı': suffixBase = 'ın'; break; case 'e': case 'i': suffixBase = 'in'; break; case 'o': case 'u': suffixBase = 'un'; break; case 'ö': case 'ü': suffixBase = 'ün'; break; default: suffixBase = 'in'; } const connector = needsN ? 'n' : ''; return `${city}'${connector}${suffixBase}`;
};

const turkiyeIlleri = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
    'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale',
    'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir',
    'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkâri', 'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir',
    'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya',
    'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya',
    'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak',
    'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak',
    'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce'
].sort((a, b) => a.localeCompare(b, 'tr'));

interface Profile {
    id: string;
    name: string;
    photoUrl?: string;
    age?: number;
    city?: string;
}
interface TargetUser extends Profile {}


// ALT BİLEŞENLERDE DEĞİŞİKLİK YOK
const SelectInput = ({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: string, label: string }[]; placeholder?: string }) => ( <div> <label className="text-xs text-gray-400">{label}</label> <div className="relative mt-1"> <select value={value} onChange={onChange} className="w-full bg-[#1E1E2F] p-2 rounded-md border border-gray-600 appearance-none focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px]"> {placeholder && <option value="" disabled>{placeholder}</option>} {options.map(opt => <option key={opt.value} value={opt.value} className="bg-[#2D2D42]">{opt.label}</option>)} </select> <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" /> </div> </div> );
const TextAreaInput = ({ label, value, onChange, placeholder, tags, onTagClick }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder: string; tags?: {name: string, value: string}[]; onTagClick?: (tagValue: string) => void; }) => ( <div> <label className="text-sm text-gray-400 mb-2 block">{label}</label> <textarea value={value} onChange={onChange} placeholder={placeholder} className="w-full h-32 bg-[#1E1E2F] p-3 rounded-md border border-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500" /> {tags && onTagClick && ( <div className="flex flex-wrap gap-2 mt-2"> {tags.map(tag => ( <button key={tag.name} type="button" onClick={() => onTagClick(tag.value)} className="bg-purple-500/20 text-purple-300 text-xs font-medium px-2.5 py-1 rounded-full hover:bg-purple-500/40 transition-colors"> {tag.name} </button> ))} </div> )} </div> );
const CheckboxInput = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }) => ( <label className="flex items-center space-x-2 cursor-pointer text-gray-300 hover:text-white"> <input type="checkbox" checked={checked} onChange={onChange} className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 rounded text-purple-600 focus:ring-purple-500" /> <span className="text-sm">{label}</span> </label> );


// ##### YENİ BİLEŞEN: KİŞİYE ÖZEL MESAJ GÖNDERME PENCERESİ #####
const DirectMessageModal = ({ isOpen, onClose, senderProfiles }: { isOpen: boolean; onClose: () => void; senderProfiles: Profile[] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<TargetUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedUser, setSelectedUser] = useState<TargetUser | null>(null);
    
    // Gönderme formunun state'leri
    const [selectedSenderId, setSelectedSenderId] = useState('');
    const [message, setMessage] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

    // Kullanıcı arama mantığı
    useEffect(() => {
        const handler = setTimeout(async () => {
            if (searchTerm.trim().length > 2) {
                setIsSearching(true);
                const usersRef = collection(db, "users");
                const q = query(usersRef, 
                    orderBy("name"), 
                    startAt(searchTerm), 
                    endAt(searchTerm + '\uf8ff'),
                    limit(10)
                );
                const querySnapshot = await getDocs(q);
                const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TargetUser));
                setSearchResults(users);
                setIsSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 500); // Debounce
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Dosya yükleme
    const onDrop = useCallback((acceptedFiles: File[]) => { setFiles(prev => [...prev, ...acceptedFiles].slice(0, 1)); }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, maxFiles: 1 });

    const handleTagClick = (tagValue: string) => setMessage(prev => prev + tagValue);

    // Tekli mesaj gönderme mantığı (Toplu göndermenin basitleştirilmiş hali)
    const handleSendDirectMessage = async () => {
        if (!selectedSenderId || !selectedUser) {
            setStatusMessage({ type: 'error', text: 'Gönderen ve alıcı seçilmelidir.' });
            return;
        }
        if (!message && files.length === 0) {
            setStatusMessage({ type: 'error', text: 'Lütfen bir mesaj yazın veya dosya ekleyin.' });
            return;
        }
        setIsLoading(true);
        setStatusMessage({ type: 'info', text: 'Mesaj gönderiliyor...' });

        try {
            const senderProfile = senderProfiles.find(p => p.id === selectedSenderId);
            if (!senderProfile) throw new Error("Gönderen profili bulunamadı.");

            let panelUploadedPhotoUrl: string | null = null;
            if (files.length > 0) {
                const file = files[0];
                const storageRef = ref(storage, `direct_messages/${Date.now()}_${file.name}`);
                panelUploadedPhotoUrl = await getDownloadURL(await uploadBytes(storageRef, file));
            }

            const batch = writeBatch(db);
            const chatId = [selectedSenderId, selectedUser.id].sort().join('-');
            const baseMessageData = {
                chatId,
                senderId: selectedSenderId,
                receiverId: selectedUser.id,
                isRead: false,
                participants: [selectedSenderId, selectedUser.id],
                senderName: senderProfile.name || "Bilinmeyen",
                senderPhotoUrl: senderProfile.photoUrl || "",
                receiverName: selectedUser.name || "Bilinmeyen",
                receiverPhotoUrl: selectedUser.photoUrl || ""
            };

            const sendUserPhoto = message.includes('{resim}') && selectedUser.photoUrl;
            const textMessageContent = message.replace(/{isim}/g, selectedUser.name || '').replace(/{sehir}/g, selectedUser.city || '').replace(/{sehirde}/g, getLocativeSuffix(selectedUser.city || '')).replace(/{sehrin}/g, getGenitiveSuffix(selectedUser.city || '')).replace(/{resim}/g, '').trim();

            if (textMessageContent) {
                batch.set(doc(collection(db, 'messages')), { ...baseMessageData, message: textMessageContent, mediaUrl: null, type: 'text', timestamp: Timestamp.now() });
            }
            if (sendUserPhoto) {
                batch.set(doc(collection(db, 'messages')), { ...baseMessageData, message: '', mediaUrl: selectedUser.photoUrl, type: 'image', timestamp: Timestamp.fromMillis(Timestamp.now().toMillis() + 1) });
            }
            if (panelUploadedPhotoUrl) {
                batch.set(doc(collection(db, 'messages')), { ...baseMessageData, message: '', mediaUrl: panelUploadedPhotoUrl, type: 'image', timestamp: Timestamp.fromMillis(Timestamp.now().toMillis() + 2) });
            }

            await batch.commit();
            try {
                // Mesajı alan kişi (gerçek kullanıcı)
                const recipientUser = selectedUser;
                // Mesajı gönderen kişi (yönetilen ghost profil)
                const senderProfile = senderProfiles.find(p => p.id === selectedSenderId);

                if (recipientUser && senderProfile) {
                    // Bildirim içeriğini hazırlıyoruz
                    let notificationBody = '';
                    if (textMessageContent) {
                        notificationBody = textMessageContent.length > 100 ? textMessageContent.substring(0, 97) + '...' : textMessageContent;
                    } else if (panelUploadedPhotoUrl) {
                        notificationBody = 'bir fotoğraf gönderdi';
                    } else if (sendUserPhoto) {
                        notificationBody = 'bir fotoğraf gönderdi';
                    } else {
                        notificationBody = 'yeni bir mesaj gönderdi';
                    }

                    // API kapımızı çalıyoruz
                    console.log(`Tekli mesaj bildirimi gönderiliyor: Kime=${recipientUser.id}, Kimden=${senderProfile.name}`);
                    await fetch('/api/send-notification', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            userId: recipientUser.id,
                            title: `${senderProfile.name} sana yeni bir mesaj gönderdi!`,
                            body: notificationBody,
                            senderPhotoUrl: senderProfile.photoUrl || '',
                            imageUrl: panelUploadedPhotoUrl || (sendUserPhoto ? selectedUser.photoUrl : null),
                            // İŞTE O AMINA KODUĞUMUN HEDEF BİLGİSİ
                            chatPartnerId: senderProfile.id
                        }),
                    });
                    console.log("Tekli mesaj bildirim isteği API'ye başarıyla gönderildi.");
                }
            } catch (error) {
                console.error("API'ye tekli mesaj bildirim isteği gönderilirken hata oluştu:", error);
            }
            setStatusMessage({ type: 'success', text: 'Mesaj başarıyla gönderildi!' });
            // Formu temizle ve başka bir mesaj göndermeye hazır ol
            setMessage('');
            setFiles([]);
            setSelectedUser(null);
            setSearchTerm('');
        } catch (error) {
            console.error("Direkt mesaj gönderilirken hata:", error);
            setStatusMessage({ type: 'error', text: 'Mesaj gönderilemedi.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="bg-[#2D2D42] w-full max-w-2xl rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <header className="p-4 flex items-center justify-between border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white">Kişiye Özel Mesaj Gönder</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white"><X className="w-5 h-5"/></button>
                </header>
                
                <div className="p-6 space-y-4 overflow-y-auto">
                    <SelectInput label="Gönderici Profil" value={selectedSenderId} onChange={e => setSelectedSenderId(e.target.value)} options={senderProfiles.map(p => ({ value: p.id, label: p.name }))} placeholder="Gönderici Seçin..." />
                    
                    {!selectedUser ? (
                        <div>
                            <label className="text-xs text-gray-400">Alıcı Kullanıcı</label>
                            <div className="relative mt-1">
                                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Alıcı kullanıcı adını yazın..." className="w-full bg-[#1E1E2F] p-2 pl-10 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500"/>
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search className="w-5 h-5"/></span>
                            </div>
                            {isSearching && <p className="text-sm text-gray-400 mt-2">Aranıyor...</p>}
                            {searchResults.length > 0 && (
                                <div className="mt-2 border border-gray-700 rounded-md max-h-48 overflow-y-auto">
                                    {searchResults.map(user => (
                                        <div key={user.id} onClick={() => setSelectedUser(user)} className="flex items-center gap-3 p-2 hover:bg-purple-900/50 cursor-pointer border-b border-gray-700 last:border-b-0">
                                            <Image src={user.photoUrl || '/default-avatar.png'} alt={user.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover"/>
                                            <div>
                                                <p className="font-semibold text-white">{user.name}</p>
                                                <p className="text-xs text-gray-400">{user.city || 'Şehir belirtilmemiş'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            <label className="text-xs text-gray-400">Alıcı</label>
                            <div className="mt-1 flex items-center justify-between p-2 bg-[#1E1E2F] rounded-md border border-gray-600">
                                <div className="flex items-center gap-3">
                                    <Image src={selectedUser.photoUrl || '/default-avatar.png'} alt={selectedUser.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover"/>
                                    <p className="font-semibold text-white">{selectedUser.name}</p>
                                </div>
                                <button onClick={() => { setSelectedUser(null); setSearchTerm(''); }} className="p-1 text-gray-400 hover:text-white"><RefreshCw className="w-4 h-4"/></button>
                            </div>
                        </div>
                    )}
                    
                    <TextAreaInput label="Mesaj" value={message} onChange={e => setMessage(e.target.value)} placeholder="Mesajınızı yazın..." tags={[{name: 'isim', value: '{isim}'}, {name: 'şehir', value: '{sehir}'}, {name: 'şehirde', value: '{sehirde}'}, {name: 'şehrin', value: '{sehrin}'}, {name: 'resim', value: '{resim}'}]} onTagClick={handleTagClick}/>
                    
                     <div {...getRootProps()} className={`p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600 hover:border-gray-500'}`}>
                        <input {...getInputProps()} />
                        <div className="flex items-center justify-center gap-3">
                            <UploadCloud className="w-6 h-6 text-gray-500" />
                            <p className="text-sm text-gray-400">Fotoğraf Yükle</p>
                        </div>
                    </div>
                    {files.length > 0 && ( <div className="flex items-center justify-between p-2 bg-gray-700 rounded-md"> <span className="text-sm text-gray-300">{files[0].name}</span> <button onClick={() => setFiles([])} className="p-1 rounded-full hover:bg-gray-600"><X className="w-4 h-4" /></button> </div> )}
                </div>

                <footer className="p-4 flex items-center justify-end gap-4 border-t border-gray-700 bg-[#23243D]">
                     {statusMessage.text && ( <p className={`text-sm ${statusMessage.type === 'error' ? 'text-red-400' : statusMessage.type === 'success' ? 'text-green-400' : 'text-gray-400'}`}>{statusMessage.text}</p> )}
                    <button onClick={handleSendDirectMessage} disabled={isLoading || !selectedUser || !selectedSenderId} className="flex items-center gap-2 px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />} Gönder
                    </button>
                </footer>
            </motion.div>
        </motion.div>
    );
};


export default function SingleMessagePage() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [targetGender, setTargetGender] = useState('Tümü');
    const [targetCity, setTargetCity] = useState('Tümü');
    const [targetDateRange, setTargetDateRange] = useState('Tümü');
    const [message, setMessage] = useState('');
    const [actions, setActions] = useState({ like: false, friendRequest: false });
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

    // YENİ STATE: Modal'ın açık/kapalı durumunu tutar
    const [isDirectMessageModalOpen, setIsDirectMessageModalOpen] = useState(false);


    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const profilesSnapshot = await getDocs(collection(db, 'profiles'));
                const profilesList = profilesSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name, photoUrl: doc.data().photoUrl, age: doc.data().age } as Profile));
                setProfiles(profilesList);
            } catch (error) {
                console.error("Başlangıç verileri çekilirken hata:", error);
                setStatusMessage({ type: 'error', text: 'Veriler yüklenemedi.' });
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (!selectedProfileId) {
            setSelectedProfile(null);
            return;
        }
        const fetchProfileDetails = async () => {
            const docRef = doc(db, 'profiles', selectedProfileId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setSelectedProfile({ id: docSnap.id, ...docSnap.data() } as Profile);
            } else {
                console.error("Seçilen profil bulunamadı!");
                setSelectedProfile(null);
            }
        };
        fetchProfileDetails();
    }, [selectedProfileId]);
   
    const handleTagClick = (tagValue: string) => {
        setMessage(prevMessage => prevMessage + tagValue);
    };

    const handleReset = () => {
        setSelectedProfileId('');
        setTargetGender('Tümü');
        setTargetCity('Tümü');
        setTargetDateRange('Tümü');
        setMessage('');
        setActions({ like: false, friendRequest: false });
        setFiles([]);
        setStatusMessage({ type: '', text: '' });
    };

    const onDrop = useCallback((acceptedFiles: File[]) => { setFiles(prev => [...prev, ...acceptedFiles].slice(0, 1)); }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, maxFiles: 1 });

    // TOPLU MESAJ GÖNDERME MANTIĞI (DEĞİŞİKLİK YOK)
        const handleSend = async () => {
        if (!selectedProfileId || !selectedProfile) {
            setStatusMessage({ type: 'error', text: 'Lütfen gönderici bir kullanıcı seçin.' });
            return;
        }
        if (!message && files.length === 0 && !Object.values(actions).some(Boolean)) {
            setStatusMessage({ type: 'error', text: 'Göndermek için bir mesaj yazın, dosya ekleyin veya bir eylem seçin.' });
            return;
        }
        setIsLoading(true);
        setStatusMessage({ type: 'info', text: 'Hedef kullanıcılar belirleniyor...' });
        
        // BU, BİLDİRİM GÖNDERECEĞİMİZ KULLANICILARIN ID LİSTESİDİR
        const targetUserIds: string[] = [];

        try {
            let panelUploadedPhotoUrl: string | null = null;
            if (files.length > 0) {
                setStatusMessage({ type: 'info', text: 'Panel fotoğrafı yükleniyor...' });
                const file = files[0];
                const storageRef = ref(storage, `bulk_messages/${Date.now()}_${file.name}`);
                panelUploadedPhotoUrl = await getDownloadURL(await uploadBytes(storageRef, file));
            }
            
            let usersQuery = query(collection(db, 'users'));
            if (targetGender !== 'Tümü') usersQuery = query(usersQuery, where('gender', '==', targetGender));
            if (targetCity !== 'Tümü') usersQuery = query(usersQuery, where('city', '==', targetCity));
            if (targetDateRange !== 'Tümü') {
                const now = new Date();
                let startTime;
                if (targetDateRange === '24saat') startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                else if (targetDateRange === '7gun') startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                else if (targetDateRange === '1ay') { const d = new Date(); d.setMonth(d.getMonth() - 1); startTime = d; }
                else if (targetDateRange === '3ay') { const d = new Date(); d.setMonth(d.getMonth() - 3); startTime = d; }
                else if (targetDateRange === '6ay') { const d = new Date(); d.setMonth(d.getMonth() - 6); startTime = d; }
                if (startTime) {
                    usersQuery = query(usersQuery, where('createdAt', '>=', Timestamp.fromDate(startTime)));
                }
            }
            
            const targetUsersSnapshot = await getDocs(usersQuery);
            if (targetUsersSnapshot.empty) {
                setStatusMessage({ type: 'error', text: 'Bu filtrelere uyan hiç kullanıcı bulunamadı.' });
                setIsLoading(false);
                return;
            }

            // Her bir hedef kullanıcının ID'sini listemize ekliyoruz
            targetUsersSnapshot.forEach(doc => {
                targetUserIds.push(doc.id);
            });
            
            const totalUsers = targetUsersSnapshot.size;
            let successCount = 0;
            const chunks = [];
            for (let i = 0; i < targetUsersSnapshot.docs.length; i += 500) {
                chunks.push(targetUsersSnapshot.docs.slice(i, i + 500));
            }
            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(userDoc => {
                    const userData = userDoc.data();
                    const userId = userDoc.id;
                    const chatId = [selectedProfileId, userId].sort().join('-');
                    const baseMessageData = {
                        chatId,
                        senderId: selectedProfileId,
                        receiverId: userId,
                        isRead: false,
                        participants: [selectedProfileId, userId],
                        senderName: selectedProfile?.name || "Bilinmeyen",
                        senderPhotoUrl: selectedProfile?.photoUrl || "",
                        receiverName: userData.name || "Bilinmeyen",
                        receiverPhotoUrl: userData.photoUrl || ""
                    };

                    const sendUserPhoto = message.includes('{resim}') && userData.photoUrl;
                    
                    const textMessageContent = message
                        .replace(/{isim}/g, userData.name || '')
                        .replace(/{sehir}/g, userData.city || '')
                        .replace(/{sehirde}/g, getLocativeSuffix(userData.city || ''))
                        .replace(/{sehrin}/g, getGenitiveSuffix(userData.city || ''))
                        .replace(/{resim}/g, '')
                        .trim();

                    if (textMessageContent) {
                        batch.set(doc(collection(db, 'messages')), { ...baseMessageData, message: textMessageContent, mediaUrl: null, type: 'text', timestamp: Timestamp.now() });
                    }
                    if (sendUserPhoto) {
                        batch.set(doc(collection(db, 'messages')), { ...baseMessageData, message: '', mediaUrl: userData.photoUrl, type: 'image', timestamp: Timestamp.fromMillis(Timestamp.now().toMillis() + 1) });
                    }
                    if (panelUploadedPhotoUrl) {
                        batch.set(doc(collection(db, 'messages')), { ...baseMessageData, message: '', mediaUrl: panelUploadedPhotoUrl, type: 'image', timestamp: Timestamp.fromMillis(Timestamp.now().toMillis() + 2) });
                    }
                    if (actions.friendRequest) {
                        batch.update(doc(db, 'users', userId), { friendRequests: arrayUnion(selectedProfileId) });
                    }
                    if (actions.like) {
                        batch.update(doc(db, 'users', userId), { likers: arrayUnion(selectedProfileId) });
                    }
                });
                await batch.commit();
                successCount += chunk.length;
                setStatusMessage({ type: 'info', text: `${successCount}/${totalUsers} kullanıcıya işlem yapıldı...` });
            }

            //---------------------------------------------------------------------
            // İŞTE O AMINA KODUĞUMUN TOPLU BİLDİRİM TETİĞİ
            //---------------------------------------------------------------------
            setStatusMessage({ type: 'info', text: 'Bildirimler gönderiliyor...' });
            
            const sendUserPhoto = message.includes('{resim}');
            const textMessageContent = message.replace(/{isim}|{sehir}|{sehirde}|{sehrin}|{resim}/g, '').trim();
            let notificationBody = '';

            if (textMessageContent) {
                notificationBody = textMessageContent.length > 100 ? textMessageContent.substring(0, 97) + '...' : textMessageContent;
            } else if (panelUploadedPhotoUrl || sendUserPhoto) {
                // {resim} tag'i toplu mesajda her kullanıcı için farklı olacağından, genel bir metin yolluyoruz.
                // Sadece panelden yüklenen resim varsa, onu yolluyoruz.
                notificationBody = 'bir fotoğraf gönderdi';
            } else {
                notificationBody = 'yeni bir mesaj gönderdi';
            }
            
            // API kapımızı, bu sefer farklı bir payload ile çalıyoruz
            await fetch('/api/send-bulk-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userIds: targetUserIds, // <<< TEK BİR ID YERİNE, TÜM ID LİSTESİ
                    title: `${selectedProfile?.name || 'Biri'} sana yeni bir mesaj gönderdi!`,
                    body: notificationBody,
                    senderPhotoUrl: selectedProfile?.photoUrl || '',
                    imageUrl: panelUploadedPhotoUrl, // Sadece panelden yüklenen resmi yolluyoruz
                    chatPartnerId: selectedProfileId 
                }),
            });
            //---------------------------------------------------------------------

            setStatusMessage({ type: 'success', text: `${successCount} kullanıcıya başarıyla işlem yapıldı ve bildirimler gönderildi.` });
            
        } catch (error: any) {
            console.error("Toplu işlem sırasında HATA:", error);
            if (error.code === 'permission-denied') { setStatusMessage({ type: 'error', text: 'Firestore izinleri yetersiz. Güvenlik kurallarını kontrol edin.' }); }
            else if (error.code === 'failed-precondition') { setStatusMessage({ type: 'error', text: 'Gerekli veritabanı index\'i eksik. Konsoldaki linke tıklayın.' }); }
            else { setStatusMessage({ type: 'error', text: 'İşlem sırasında bir hata oluştu. Konsolu kontrol edin.' }); }
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#1E1E2F] text-white">
            <div className="max-w-5xl mx-auto space-y-8 relative">
                
                {/* YENİ EKLENEN BUTON */}
                <div className="absolute top-0 right-0">
                    <button 
                        onClick={() => setIsDirectMessageModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold">
                        <MessageSquare className="w-4 h-4" />
                        Tekli Mesaj Gönder
                    </button>
                </div>


                <div>
                    <h1 className="text-2xl font-bold mb-4">Toplu Mesaj Paneli</h1>
                    <div className="bg-[#2D2D42] p-4 rounded-lg flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-24 h-24 rounded-lg bg-purple-600 flex-shrink-0 flex items-center justify-center overflow-hidden">
                            {selectedProfile?.photoUrl ? (
                                <Image src={selectedProfile.photoUrl} alt={selectedProfile.name || 'Profil'} width={96} height={96} className="object-cover w-full h-full" />
                            ) : (
                                <User className="w-12 h-12 text-white" />
                            )}
                        </div>
                        <div className="flex-grow w-full">
                            <h2 className="font-bold text-lg text-white text-center sm:text-left">{selectedProfile ? `${selectedProfile.name}, ${selectedProfile.age || ''}` : "Gönderen Seçilmedi"}</h2>
                            <p className="text-sm text-gray-400 text-center sm:text-left">{selectedProfile ? `ID: ${selectedProfile.id}` : "Lütfen bir gönderici profil seçin."}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-[#2D2D42] p-6 rounded-lg space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <SelectInput label="Kullanıcı Seçimi" value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)} options={profiles.map(p => ({ value: p.id, label: p.name }))} placeholder="Gönderici Seçin..." />
                        <SelectInput label="Cinsiyet Seçimi" value={targetGender} onChange={e => setTargetGender(e.target.value)} options={[{ value: 'Tümü', label: 'Tümü' }, { value: 'Erkek', label: 'Erkek' }, { value: 'Kadın', label: 'Kadın' }]} placeholder=''/>
                        <SelectInput label="Şehir Seçimi" value={targetCity} onChange={e => setTargetCity(e.target.value)} options={[{ value: 'Tümü', label: 'Tüm İller' }, ...turkiyeIlleri.map(il => ({ value: il, label: il }))]} placeholder=''/>
                        <SelectInput label="Tarih Seçimi" value={targetDateRange} onChange={e => setTargetDateRange(e.target.value)} options={[{ value: 'Tümü', label: 'Tüm Zamanlar' }, { value: '24saat', label: 'Son 24 Saat' }, { value: '7gun', label: 'Son 7 Gün' }, { value: '1ay', label: 'Son 1 Ay' }, { value: '3ay', label: 'Son 3 Ay' }, { value: '6ay', label: 'Son 6 Ay' }]} placeholder=''/>
                    </div>
                    
                    <TextAreaInput 
                        label="Mesaj" 
                        value={message} 
                        onChange={e => setMessage(e.target.value)} 
                        placeholder="Mesajınızı buraya yazın..." 
                        tags={[
                            {name: 'isim', value: '{isim}'}, 
                            {name: 'şehir', value: '{sehir}'},
                            {name: 'şehirde', value: '{sehirde}'},
                            {name: 'şehrin', value: '{sehrin}'},
                            {name: 'resim', value: '{resim}'}
                        ]}
                        onTagClick={handleTagClick}
                    />

                    <div className="flex flex-wrap gap-x-6 gap-y-4">
                        <CheckboxInput label="Beğeni" checked={actions.like} onChange={e => setActions(p => ({ ...p, like: e.target.checked }))} />
                        <CheckboxInput label="Arkadaşlık" checked={actions.friendRequest} onChange={e => setActions(p => ({ ...p, friendRequest: e.target.checked }))} />
                    </div>
                    
                    <div {...getRootProps()} className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600 hover:border-gray-500'}`}>
                        <input {...getInputProps()} />
                        <div className="flex flex-col items-center">
                            <UploadCloud className="w-10 h-10 text-gray-500 mb-2" />
                            <p className="text-gray-400">Fotoğrafı buraya sürükle veya tıkla</p>
                            <p className="text-xs text-gray-500 mt-1">Sadece 1 adet resim dosyası</p>
                        </div>
                    </div>
                    {files.length > 0 && (
                        <div className="flex items-center justify-between p-2 bg-gray-700 rounded-md">
                            <span className="text-sm text-gray-300">{files[0].name}</span>
                            <button onClick={() => setFiles([])} className="p-1 rounded-full hover:bg-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-4">
                    {statusMessage.text && (
                        <p className={`text-sm ${statusMessage.type === 'error' ? 'text-red-400' : statusMessage.type === 'success' ? 'text-green-400' : 'text-gray-400'}`}>
                            {statusMessage.text}
                        </p>
                    )}
                    <button onClick={handleReset} disabled={isLoading} className="flex items-center gap-2 px-6 py-2 border border-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                        <RefreshCw className="w-4 h-4" /> Sıfırla
                    </button>
                    <button onClick={handleSend} disabled={isLoading} className="flex items-center gap-2 px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait">
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />} Gönder
                    </button>
                </div>
            </div>

            {/* YENİ EKLENEN PENCERE */}
            <AnimatePresence>
                {isDirectMessageModalOpen && (
                    <DirectMessageModal 
                        isOpen={isDirectMessageModalOpen}
                        onClose={() => setIsDirectMessageModalOpen(false)}
                        senderProfiles={profiles}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}