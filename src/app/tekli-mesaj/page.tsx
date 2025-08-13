'use client';

import { useState, useEffect, useCallback } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, Timestamp, doc, arrayUnion, getDoc, limit, startAt, orderBy, endAt, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useDropzone } from 'react-dropzone';
import { User, ChevronDown, Send, RefreshCw, UploadCloud, X, Loader2, MessageSquare, Search, Heart, Phone, Video, UserPlus, Eye, Users, Mic } from 'lucide-react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useCombobox } from 'downshift';
// --- YARDIMCI FONKSİYONLAR ---
const getLocativeSuffix = (city: string): string => {
    if (!city) return ''; const vowels = 'aeıioöuü'; const backVowels = 'aıou'; const hardConsonants = 'fstkçşhp'; const lowerCity = city.toLowerCase(); const lastChar = lowerCity.charAt(city.length - 1); let lastVowel = ''; for (let i = city.length - 1; i >= 0; i--) { if (vowels.includes(lowerCity.charAt(i))) { lastVowel = lowerCity.charAt(i); break; } } const consonant = hardConsonants.includes(lastChar) ? 't' : 'd'; const vowel = backVowels.includes(lastVowel) ? 'a' : 'e'; return `${city}'${consonant}${vowel}`;
};
const getGenitiveSuffix = (city: string): string => {
    if (!city) return ''; const vowels = 'aeıioöuü'; const lastChar = city.slice(-1).toLowerCase(); const needsN = vowels.includes(lastChar); let lastVowel = ''; for (let i = city.length - 1; i >= 0; i--) { const char = city.charAt(i).toLowerCase(); if (vowels.includes(char)) { lastVowel = char; break; } } let suffixBase = ''; switch (lastVowel) { case 'a': case 'ı': suffixBase = 'ın'; break; case 'e': case 'i': suffixBase = 'in'; break; case 'o': case 'u': suffixBase = 'un'; break; case 'ö': case 'ü': suffixBase = 'ün'; break; default: suffixBase = 'in'; } const connector = needsN ? 'n' : ''; return `${city}'${connector}${suffixBase}`;
};
const turkiyeIlleri = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin', 'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkâri', 'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce'
].sort((a, b) => a.localeCompare(b, 'tr'));

// --- ARAYÜZLER ---

interface Profile {
    id: string;
    name: string;
    photoUrl?: string;
    age?: number;
    city?: string;
    civil?: string; // <-- BU SATIRI EKLE
}

interface TargetUser extends Profile {}

// --- ALT BİLEŞENLER ---
const SelectInput = ({ label, value, onChange, options, placeholder }: { label:string; value:string; onChange:(e:React.ChangeEvent<HTMLSelectElement>)=>void; options:{value:string;label:string}[]; placeholder?:string }) => ( <div><label className="text-xs text-gray-400">{label}</label><div className="relative mt-1"><select value={value} onChange={onChange} className="w-full bg-[#1E1E2F] p-2 rounded-md border border-gray-600 appearance-none focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px]">{placeholder && <option value="" disabled>{placeholder}</option>}{options.map(opt => <option key={opt.value} value={opt.value} className="bg-[#2D2D42]">{opt.label}</option>)}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" /></div></div> );const CheckboxInput = ({ label, checked, onChange, icon, disabled }: { label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; icon?: React.ReactNode; disabled?: boolean; }) => ( <label className={`flex items-center space-x-2 text-gray-300 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:text-white'}`}> <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 rounded text-purple-600 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed" /> {icon} <span className="text-sm">{label}</span> </label> );

const SearchableSelect = ({ label, items, selectedItem, onSelectedItemChange, placeholder }: {
    label: string;
    items: Profile[];
    selectedItem: Profile | null;
    onSelectedItemChange: (selection: Profile | null) => void;
    placeholder: string;
}) => {
    const [inputItems, setInputItems] = useState<Profile[]>([]);
    useEffect(() => {
        setInputItems(items);
    }, [items]); 
    const {
        isOpen,
        getToggleButtonProps,
        getLabelProps,
        getMenuProps,
        getInputProps,
        highlightedIndex,
        getItemProps,
        setInputValue,
    } = useCombobox({
            items: inputItems,
            itemToString: (item) => (item ? item.name : ''),
            selectedItem,
            onSelectedItemChange: ({ selectedItem: newSelectedItem }) => {
                onSelectedItemChange(newSelectedItem);
            },
            onInputValueChange: ({ inputValue }) => {
                // --- DÜZELTME BURADA ---
                if (!inputValue) {
                    // Eğer input boşsa, tüm orijinal listeyi göster
                    setInputItems(items);
                } else {
                    // Eğer input doluysa, filtrele
                    setInputItems(
                        items.filter((item) =>
                            item.name.toLowerCase().includes(inputValue.toLowerCase())
                        )
                    );
                }
            },
        });
    
    // Seçim yapıldığında input'u temizle
    useEffect(() => {
        if (selectedItem) {
            setInputValue('');
        }
    }, [selectedItem, setInputValue]);

    return (
        <div>
            <label {...getLabelProps()} className="text-xs text-gray-400">{label}</label>
            <div className="relative mt-1">
                <div className="flex items-center bg-[#1E1E2F] rounded-md border border-gray-600 focus-within:ring-1 focus-within:ring-purple-500">
                    {selectedItem && (
                        <div className="flex items-center pl-3">
                           
                            <div className="relative w-6 h-6 rounded-full overflow-hidden"> 
                                <Image 
                                    src={selectedItem.photoUrl || '/default-avatar.png'} 
                                    alt={selectedItem.name} 
                                    fill 
                                    className="object-cover" 
                                />
                            </div>
                        </div>
                    )}
                    <input
                        {...getInputProps()}
                        placeholder={selectedItem ? selectedItem.name : placeholder}
                        className="w-full bg-transparent p-2 appearance-none focus:outline-none h-[40px]"
                    />
                    <button {...getToggleButtonProps()} aria-label="toggle menu" className="p-2">
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                <ul
                    {...getMenuProps()}
                    className={`absolute z-10 w-full bg-[#2D2D42] mt-1 max-h-60 overflow-auto rounded-md shadow-lg border border-gray-600 ${
                        !isOpen && 'hidden'
                    }`}
                >
                    {isOpen &&
                        inputItems.map((item, index) => (
                            <li
                                key={`${item.id}${index}`}
                                {...getItemProps({ item, index })}
                                className={`p-3 cursor-pointer text-sm flex items-center gap-3 ${
                                    highlightedIndex === index ? 'bg-purple-600' : ''
                                }`}
                            >
                                <div className="relative w-8 h-8 rounded-full overflow-hidden">
                                    <Image 
                                        src={item.photoUrl || '/default-avatar.png'} 
                                        alt={item.name}
                                        fill 
                                        className="object-cover" 
                                    />
                                </div>
                                <span>{item.name}</span>
                            </li>
                        ))}
                </ul>
            </div>
        </div>
    );
};

const DirectMessageModal = ({ isOpen, onClose, senderProfiles }: { isOpen: boolean; onClose: () => void; senderProfiles: Profile[] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<TargetUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedUser, setSelectedUser] = useState<TargetUser | null>(null);
    const [selectedSenderId, setSelectedSenderId] = useState('');
    const [selectedSender, setSelectedSender] = useState<Profile | null>(null);
    const [selectedAction, setSelectedAction] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

    const handleActionChange = (actionName: string) => {
        setSelectedAction(prev => prev === actionName ? null : actionName);
    };

    const isMessageMode = message.trim() !== '' || files.length > 0;
    const isActionSelected = selectedAction !== null;

    useEffect(() => {
        const handler = setTimeout(async () => {
            if (searchTerm.trim().length > 2) {
                setIsSearching(true);
                const usersRef = collection(db, "users");
                const q = query(usersRef, orderBy("name"), startAt(searchTerm), endAt(searchTerm + '\uf8ff'), limit(10));
                const querySnapshot = await getDocs(q);
                const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TargetUser));
                setSearchResults(users);
                setIsSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (isActionSelected) return;
        setFiles(prev => [...prev, ...acceptedFiles].slice(0, 3));
    }, [isActionSelected]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
            'video/*': ['.mp4', '.mov', '.avi'],
            'audio/*': ['.mp3', '.wav', '.m4a']
        },
        maxFiles: 3,
        disabled: isActionSelected
    });

    const removeFile = (fileToRemove: File) => {
        setFiles(prev => prev.filter(file => file !== fileToRemove));
    };

    const handleTagClick = (tagValue: string) => {
        if(isActionSelected) return;
        setMessage(prev => prev + tagValue);
    };

    const handleSendDirectMessage = async () => {
        if (!selectedSenderId || !selectedUser) {
            setStatusMessage({ type: 'error', text: 'Gönderen ve alıcı seçilmelidir.' });
            return;
        }
        if (!isActionSelected && !isMessageMode) {
            setStatusMessage({ type: 'error', text: 'Göndermek için bir mesaj yazın veya bir eylem seçin.' });
            return;
        }
        setIsLoading(true);
        setStatusMessage({ type: 'info', text: 'İşlem gönderiliyor...' });
        try {
            const senderProfile = senderProfiles.find(p => p.id === selectedSenderId);
            if (!senderProfile) throw new Error("Gönderen profili bulunamadı.");
            const targetUserId = selectedUser.id;
            const notificationPromises: Promise<Response>[] = [];
            const batch = writeBatch(db);
            
            if (isActionSelected) {
                switch (selectedAction) {
                    case 'like':
                        batch.update(doc(db, 'users', targetUserId), { likers: arrayUnion(senderProfile.id) });
                        notificationPromises.push(fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: targetUserId, title: ` Beğenilerin Artıyor! 💖`, body: `🔥 ${senderProfile.name} profilini çok beğendi! Hemen göz at ve karşılık ver.`, senderPhotoUrl: senderProfile.photoUrl || '', notificationType: 'LIKE', chatPartnerId: senderProfile.id }) }));
                        break;
                    case 'friendRequest':
                        notificationPromises.push(fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: targetUserId, title: ` Yeni Arkadaşın Var! 🤝`, body: `✨ ${senderProfile.name} seninle tanışmak istiyor! Gir ve sohbete başla.`, senderPhotoUrl: senderProfile.photoUrl || '', notificationType: 'FRIEND_REQUEST', chatPartnerId: senderProfile.id }) }));
                        break;
                    case 'profileVisit':
                        notificationPromises.push(fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: targetUserId, title: ` Gizemli Bir Ziyaretçi! 👀`, body: `💫 ${senderProfile.name} profilini inceledi. Belki de sana yazmak istiyor...`, senderPhotoUrl: senderProfile.photoUrl || '', notificationType: 'PROFILE_VISIT', chatPartnerId: senderProfile.id }) }));
                        break;
                    case 'match':
                        const newMatchData = { matchedProfileId: senderProfile.id, matchedProfileName: senderProfile.name || '', matchedProfilePhotoUrl: senderProfile.photoUrl || '', timestamp: Timestamp.now() };
                        batch.update(doc(db, 'users', targetUserId), { newMatch: newMatchData });
                        notificationPromises.push(fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: targetUserId, title: ` Eşleşme! 💘`, body: `🎉 ${senderProfile.name} ile eşleştiniz! Şimdi konuşma zamanı.`, senderPhotoUrl: senderProfile.photoUrl || '', notificationType: 'MATCH', chatPartnerId: senderProfile.id }) }));
                        break;
                    case 'voiceCall':
                    case 'videoCall':
                        const callType = selectedAction === 'videoCall' ? 'video' : 'voice';
                        const callData = { callerId: senderProfile.id, callerName: senderProfile.name || "Bilinmeyen", callerPhotoUrl: senderProfile.photoUrl || "", callTime: serverTimestamp(), callType: callType };
                        batch.update(doc(db, 'users', targetUserId), { incomingCall: callData });
                        notificationPromises.push(fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: targetUserId, title: `${callType === 'video' ? '📹 Görüntülü' : '📞 Sesli'} Arama`, body: ` ${senderProfile.name} seni ${callType === 'video' ? 'görüntülü' : 'sesli'} arıyor!`, senderPhotoUrl: senderProfile.photoUrl || '', notificationType: 'INCOMING_CALL', chatPartnerId: senderProfile.id }) }));
                        break;
                }
            } else if (isMessageMode) {
                setStatusMessage({ type: 'info', text: `${files.length} medya dosyası yükleniyor...` });
                const uploadPromises = files.map(file => {
                    let type = 'image';
                    if (file.type.startsWith('video/')) type = 'video';
                    else if (file.type.startsWith('audio/')) type = 'voice';
                    const storageRef = ref(storage, `chat_media/${Date.now()}_${file.name}`);
                    return uploadBytes(storageRef, file).then(uploadResult => getDownloadURL(uploadResult.ref)).then(url => ({ url, type }));
                });
                const uploadedMedia = await Promise.all(uploadPromises);
                const baseMessageData = { chatId: [senderProfile.id, selectedUser.id].sort().join('-'), senderId: senderProfile.id, receiverId: selectedUser.id, isRead: false, participants: [senderProfile.id, selectedUser.id], senderName: senderProfile.name || "Bilinmeyen", senderPhotoUrl: senderProfile.photoUrl || "", receiverName: selectedUser.name || "Bilinmeyen", receiverPhotoUrl: selectedUser.photoUrl || "" };
                const personalizedBody = message.replace(/{isim}/g, selectedUser.name || '').replace(/{sehir}/g, selectedUser.city || '').replace(/{sehirde}/g, getLocativeSuffix(selectedUser.city || '')).replace(/{sehrin}/g, getGenitiveSuffix(selectedUser.city || '')).replace(/{resim}/g, '').trim();
                if (personalizedBody) {
                    batch.set(doc(collection(db, 'messages')), { ...baseMessageData, message: personalizedBody, type: 'text', timestamp: Timestamp.now() });
                }
                uploadedMedia.forEach((media, index) => {
                    batch.set(doc(collection(db, 'messages')), { ...baseMessageData, message: '', mediaUrl: media.url, type: media.type, timestamp: Timestamp.fromMillis(Timestamp.now().toMillis() + index + 1) });
                });
                if (message.includes('{resim}') && selectedUser.photoUrl) {
                    batch.set(doc(collection(db, 'messages')), { ...baseMessageData, message: '', mediaUrl: selectedUser.photoUrl, type: 'image', timestamp: Timestamp.fromMillis(Timestamp.now().toMillis() + uploadedMedia.length + 1) });
                }
                let notificationBody = personalizedBody;
                if (!notificationBody) {
                    if (uploadedMedia.length > 1) {
                        notificationBody = `Sana ${uploadedMedia.length} medya dosyası gönderdi.`;
                    } else if (uploadedMedia.length === 1) {
                        const type = uploadedMedia[0].type;
                        if (type === 'video') notificationBody = 'Sana bir video gönderdi.';
                        else if (type === 'voice') notificationBody = 'Sana bir sesli mesaj gönderdi.';
                        else notificationBody = 'Sana bir fotoğraf gönderdi.';
                    } else {
                         notificationBody = 'Sana yeni bir mesaj gönderdi.';
                    }
                }
                if (notificationBody.length > 100) {
                    notificationBody = notificationBody.substring(0, 97) + '...';
                }
                notificationPromises.push(fetch('/api/send-notification', { 
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: targetUserId, title: `${senderProfile.name} sana yeni bir mesaj gönderdi!`, body: notificationBody,
                        senderPhotoUrl: senderProfile.photoUrl || '', imageUrl: uploadedMedia.find(m => m.type === 'image')?.url || null,
                        chatPartnerId: senderProfile.id, notificationType: 'MESSAGE'
                    }),
                }));
            }
            await batch.commit();
            await Promise.all(notificationPromises);
            setStatusMessage({ type: 'success', text: 'İşlem başarıyla gönderildi!' });
            setMessage(''); setFiles([]); setSelectedUser(null); setSearchTerm(''); setSelectedAction(null);
        } catch (error) {
            console.error("Direkt mesaj/eylem gönderilirken hata:", error);
            setStatusMessage({ type: 'error', text: 'İşlem gönderilemedi.' });
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const actionsList = [
        { id: 'like', label: 'Beğeni', icon: Heart },
        { id: 'friendRequest', label: 'Arkadaşlık', icon: UserPlus },
        { id: 'profileVisit', label: 'Ziyaret', icon: Eye },
        { id: 'match', label: 'Match', icon: Users },
        { id: 'voiceCall', label: 'Sesli Arama', icon: Phone },
        { id: 'videoCall', label: 'Görüntülü', icon: Video },
    ];

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="bg-[#2D2D42] w-full max-w-2xl rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <header className="p-4 flex items-center justify-between border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white">Kişiye Özel Mesaj & Eylem</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white"><X className="w-5 h-5"/></button>
                </header>
                
                <div className="p-6 space-y-4 overflow-y-auto">
                    <SearchableSelect
                        label="Gönderici Profil"
                        items={senderProfiles}
                        selectedItem={selectedSender}
                        onSelectedItemChange={(selection) => {
                            setSelectedSenderId(selection ? selection.id : '');
                            setSelectedSender(selection);
                        }}
                        placeholder="Gönderici Ara..."
                    />
                    
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
                    
                    <TextAreaInput 
                        label="Mesaj" 
                        value={message} 
                        onChange={e => { if (!isActionSelected) setMessage(e.target.value); }}
                        placeholder={isActionSelected ? "Bir eylem seçiliyken mesaj gönderilemez." : "Mesajınızı yazın..."}
                        disabled={isActionSelected}
                        tags={[{name: 'isim', value: '{isim}'}, {name: 'şehir', value: '{sehir}'}, {name: 'şehirde', value: '{sehirde}'}, {name: 'şehrin', value: '{sehrin}'}, {name: 'resim', value: '{resim}'}]}
                        onTagClick={handleTagClick}
                    />
                    
                    <div>
                        <label className="text-sm text-gray-400 mb-2 block">Veya Bir Eylem Seç</label>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            {actionsList.map((action) => (
                                <ActionButton
                                    key={action.id}
                                    icon={action.icon}
                                    label={action.label}
                                    isSelected={selectedAction === action.id}
                                    onClick={() => handleActionChange(action.id)}
                                    disabled={isMessageMode}
                                />
                            ))}
                        </div>
                    </div>

                     <div {...getRootProps()} className={`p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isActionSelected ? 'opacity-50 cursor-not-allowed' : isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600 hover:border-gray-500'}`}>
                        <input {...getInputProps()} disabled={isActionSelected} />
                        <div className="flex items-center justify-center gap-3">
                            <UploadCloud className="w-6 h-6 text-gray-500" />
                            <p className="text-sm text-gray-400">Medya Dosyalarını Buraya Sürükle</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">En fazla 3 adet (Resim, Video, Ses)</p>
                    </div>

                    {files.length > 0 && (
                        <div className="mt-2 space-y-2">
                            <p className="text-xs font-medium text-gray-400">Gönderilecek Medyalar ({files.length}/3):</p>
                            {files.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-700/50 rounded-md">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {file.type.startsWith('image/') && <Image src={URL.createObjectURL(file)} alt={file.name} width={40} height={40} className="w-10 h-10 rounded object-cover flex-shrink-0" />}
                                        {file.type.startsWith('video/') && <video src={URL.createObjectURL(file)} className="w-10 h-10 rounded object-cover bg-black flex-shrink-0" />}
                                        {file.type.startsWith('audio/') && <div className="w-10 h-10 rounded bg-gray-600 flex items-center justify-center flex-shrink-0"><Mic className="w-5 h-5 text-white" /></div>}
                                        <p className="text-sm text-gray-300 truncate">{file.name}</p>
                                    </div>
                                    <button onClick={() => removeFile(file)} className="p-1 rounded-full text-gray-400 hover:bg-gray-600 hover:text-white flex-shrink-0">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
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


const TextAreaInput = ({ label, value, onChange, placeholder, tags, onTagClick, disabled }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder: string; tags?: {name: string; value: string}[]; onTagClick?: (tagValue: string) => void; disabled?: boolean; }) => (
    <div>
        <label className="text-sm text-gray-400 mb-2 block">{label}</label>
        <textarea
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full h-32 bg-[#1E1E2F] p-3 rounded-md border border-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {tags && onTagClick && (
            <div className={`flex flex-wrap gap-2 mt-2 ${disabled ? 'opacity-50' : ''}`}>
                {tags.map(tag => (
                    <button
                        key={tag.name}
                        type="button"
                        disabled={disabled}
                        onClick={() => onTagClick(tag.value)}
                        className="bg-purple-500/20 text-purple-300 text-xs font-medium px-2.5 py-1 rounded-full hover:bg-purple-500/40 transition-colors disabled:cursor-not-allowed"
                    >
                        {tag.name}
                    </button>
                ))}
            </div>
        )}
    </div>
);

const ActionButton = ({ icon: Icon, label, isSelected, onClick, disabled }: { icon: React.ElementType, label: string, isSelected: boolean, onClick: () => void, disabled?: boolean }) => {
const baseClasses = "flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-20 h-20 text-center";    const selectedClasses = "bg-purple-500/20 border-purple-500 ring-2 ring-purple-500 shadow-lg shadow-purple-900/50";
    const defaultClasses = "bg-gray-700/50 border-gray-600 hover:bg-gray-700/80 hover:border-gray-500";
    const disabledClasses = "opacity-50 cursor-not-allowed !bg-gray-700/50 !border-gray-600"; // ! ile hover efektini ezer

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${isSelected ? selectedClasses : defaultClasses} ${disabled ? disabledClasses : ''}`}
        >
            <Icon className={`w-6 h-6 mb-2 ${isSelected ? 'text-purple-300' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>{label}</span>
        </button>
    );
};


// --- ANA SAYFA BİLEŞENİ ---
export default function SingleMessagePage() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [targetGender, setTargetGender] = useState('Tümü');
    const [targetCity, setTargetCity] = useState('Tümü');
    const [targetDateRange, setTargetDateRange] = useState('Tümü');
    const [message, setMessage] = useState('');
    const [selectedAction, setSelectedAction] = useState<string | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
    const [isDirectMessageModalOpen, setIsDirectMessageModalOpen] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const profilesSnapshot = await getDocs(collection(db, 'profiles'));
                const profilesList = profilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile));
                setProfiles(profilesList);
            } catch (error) { console.error("Başlangıç verileri çekilirken hata:", error); }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (!selectedProfileId) { setSelectedProfile(null); return; }
        const fetchProfileDetails = async () => {
            const docRef = doc(db, 'profiles', selectedProfileId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) { setSelectedProfile({ id: docSnap.id, ...docSnap.data() } as Profile); }
        };
        fetchProfileDetails();
    }, [selectedProfileId]);
   
    const handleTagClick = (tagValue: string) => {
        if (isActionSelected) return;
        setMessage(prevMessage => prevMessage + tagValue);
    };

    const handleActionChange = (actionName: string) => {
        setSelectedAction(prevAction => prevAction === actionName ? null : actionName);
    };

    const handleReset = () => {
        setSelectedProfileId('');
        setTargetGender('Tümü');
        setTargetCity('Tümü');
        setTargetDateRange('Tümü');
        setMessage('');
        setSelectedAction(null);
        setFiles([]);
        setStatusMessage({ type: '', text: '' });
    };

    const isMessageMode = message.trim() !== '' || files.length > 0;
    const isActionSelected = selectedAction !== null;

    const onDrop = useCallback((acceptedFiles: File[]) => {
    if (isActionSelected) return;
    setFiles(prev => [...prev, ...acceptedFiles].slice(0, 3));
}, [isActionSelected]);

const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
        'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
        'video/*': ['.mp4', '.mov', '.avi', '.mkv'],
        'audio/*': ['.mp3', '.wav', '.m4a']
    },
    maxFiles: 3,
    disabled: isActionSelected
});

const removeFile = (fileToRemove: File) => {
    setFiles(prev => prev.filter(file => file !== fileToRemove));
};

const handleSend = async () => {
    if (!selectedProfileId || !selectedProfile) { setStatusMessage({ type: 'error', text: 'Lütfen gönderici bir kullanıcı seçin.' }); return; }
    if (!isActionSelected && !isMessageMode) { setStatusMessage({ type: 'error', text: 'Göndermek için bir mesaj yazın veya bir eylem seçin.' }); return; }
    
    setIsLoading(true);
    setStatusMessage({ type: 'info', text: 'Hedef kullanıcılar belirleniyor...' });
    
    try {
        let usersQuery = query(collection(db, 'users'));
        if (targetGender !== 'Tümü') usersQuery = query(usersQuery, where('gender', '==', targetGender));
        if (targetCity !== 'Tümü') usersQuery = query(usersQuery, where('city', '==', targetCity));
        if (targetDateRange !== 'Tümü') {
            const now = new Date();
            let startTime;
            switch (targetDateRange) {
                case '24saat': startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
                case '7gun': startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
                case '1ay': startTime = new Date(new Date().setMonth(now.getMonth() - 1)); break;
                case '3ay': startTime = new Date(new Date().setMonth(now.getMonth() - 3)); break;
                case '6ay': startTime = new Date(new Date().setMonth(now.getMonth() - 6)); break;
            }
            if (startTime) {
                usersQuery = query(usersQuery, where('createdAt', '>=', Timestamp.fromDate(startTime)));
            }
        }
        
        const targetUsersSnapshot = await getDocs(usersQuery);
        if (targetUsersSnapshot.empty) { setStatusMessage({ type: 'error', text: 'Bu filtrelere uyan hiç kullanıcı bulunamadı.' }); setIsLoading(false); return; }

        const notificationPromises: Promise<Response>[] = [];
        const batch = writeBatch(db);

        if (isActionSelected) {
                const targetUserIds = targetUsersSnapshot.docs.map(doc => doc.id);
                switch (selectedAction) {

                    case 'like':
                    targetUsersSnapshot.forEach(userDoc => {
                        batch.update(doc(db, 'users', userDoc.id), { likers: arrayUnion(selectedProfileId) });
                    });
                    notificationPromises.push(fetch('/api/send-bulk-notification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userIds: targetUserIds,
                            title: ` Beğenilerin Artıyor! 💖`,
                            body: `🔥 ${selectedProfile.name} profilini çok beğendi! Hemen göz at ve karşılık ver.`,
                            senderPhotoUrl: selectedProfile.photoUrl || '',
                            notificationType: 'LIKE',
                            chatPartnerId: selectedProfileId
                        })
                    }));
                    break;

                case 'friendRequest':
                    notificationPromises.push(fetch('/api/send-bulk-notification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userIds: targetUserIds,
                            title: ` Yeni Arkadaşın Var! 🤝`,
                            body: `✨ ${selectedProfile.name} seninle tanışmak istiyor! Gir ve sohbete başla.`,
                            senderPhotoUrl: selectedProfile.photoUrl || '',
                            notificationType: 'FRIEND_REQUEST',
                            chatPartnerId: selectedProfileId
                        })
                    }));
                    break;

                case 'profileVisit':
                    notificationPromises.push(fetch('/api/send-bulk-notification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userIds: targetUserIds,
                            title: ` Gizemli Bir Ziyaretçi! 👀`,
                            body: `💫 ${selectedProfile.name} profilini inceledi. Belki de sana yazmak istiyor...`,
                            senderPhotoUrl: selectedProfile.photoUrl || '',
                            notificationType: 'PROFILE_VISIT',
                            chatPartnerId: selectedProfileId
                        })
                    }));
                    break;

                case 'match':
                    const newMatchData = {
                        matchedProfileId: selectedProfile.id,
                        matchedProfileName: selectedProfile.name || '',
                        matchedProfilePhotoUrl: selectedProfile.photoUrl || '',
                        timestamp: Timestamp.now()
                    };
                    targetUsersSnapshot.forEach(userDoc => {
                        batch.update(doc(db, 'users', userDoc.id), { newMatch: newMatchData });
                    });
                    notificationPromises.push(fetch('/api/send-bulk-notification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userIds: targetUserIds,
                            title: ` Eşleşme! 💘`,
                            body: `🎉 ${selectedProfile.name} ile eşleştiniz! Şimdi konuşma zamanı.`,
                            senderPhotoUrl: selectedProfile.photoUrl || '',
                            notificationType: 'MATCH',
                            chatPartnerId: selectedProfileId
                        })
                    }));
                    break;

                case 'voiceCall':
                case 'videoCall':
                    const callType = selectedAction === 'videoCall' ? 'video' : 'voice';
                    const callData = {
                        callerId: selectedProfile.id,
                        callerName: selectedProfile.name || "Bilinmeyen",
                        callerPhotoUrl: selectedProfile.photoUrl || "",
                        callTime: serverTimestamp(),
                        callType: callType
                    };
                    targetUsersSnapshot.forEach(userDoc => {
                        batch.update(doc(db, 'users', userDoc.id), { incomingCall: callData });
                    });
                    notificationPromises.push(fetch('/api/send-bulk-notification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userIds: targetUserIds,
                            title: `${callType === 'video' ? '📹  Görüntülü' : '📞  Sesli'} Arama`,
                            body: ` ${selectedProfile.name} seni ${callType === 'video' ? 'görüntülü' : 'sesli'} arıyor!`,
                            senderPhotoUrl: selectedProfile.photoUrl || '',
                            notificationType: 'INCOMING_CALL',
                            chatPartnerId: selectedProfileId
                        })
                    }));
                    break;

                }
            }  else if (isMessageMode) {
            setStatusMessage({ type: 'info', text: `${files.length} medya dosyası yükleniyor...` });
            
            const uploadPromises = files.map(file => {
                let type = 'image';
                if (file.type.startsWith('video/')) type = 'video';
                else if (file.type.startsWith('audio/')) type = 'voice';
                
                const storageRef = ref(storage, `chat_media/${Date.now()}_${file.name}`);
                return uploadBytes(storageRef, file).then(uploadResult => getDownloadURL(uploadResult.ref)).then(url => ({ url, type }));
            });
            
            const uploadedMedia = await Promise.all(uploadPromises);
            
            for (const userDoc of targetUsersSnapshot.docs) {
                const userData = userDoc.data();
                const userId = userDoc.id;
                const baseMessageData = { chatId: [selectedProfileId, userId].sort().join('-'), senderId: selectedProfileId, receiverId: userId, isRead: false, participants: [selectedProfileId, userId], senderName: selectedProfile?.name || "Bilinmeyen", senderPhotoUrl: selectedProfile?.photoUrl || "", receiverName: userData.name || "Bilinmeyen", receiverPhotoUrl: userData.photoUrl || "" };
                
                const textMessageContent = message.replace(/{isim}/g, userData.name || '').replace(/{sehir}/g, userData.city || '').replace(/{sehirde}/g, getLocativeSuffix(userData.city || '')).replace(/{sehrin}/g, getGenitiveSuffix(userData.city || '')).replace(/{resim}/g, '').trim();
                if (textMessageContent) {
                    batch.set(doc(collection(db, 'messages')), { ...baseMessageData, message: textMessageContent, type: 'text', timestamp: Timestamp.now() });
                }

                uploadedMedia.forEach((media, index) => {
                    batch.set(doc(collection(db, 'messages')), { ...baseMessageData, message: '', mediaUrl: media.url, type: media.type, timestamp: Timestamp.fromMillis(Timestamp.now().toMillis() + index + 1) });
                });

                if (message.includes('{resim}') && userData.photoUrl) {
                     batch.set(doc(collection(db, 'messages')), { ...baseMessageData, message: '', mediaUrl: userData.photoUrl, type: 'image', timestamp: Timestamp.fromMillis(Timestamp.now().toMillis() + uploadedMedia.length + 1) });
                }
            }
            
            await batch.commit();
            setStatusMessage({ type: 'info', text: 'Veritabanı güncellendi, bildirimler gönderiliyor...' });

            for (const userDoc of targetUsersSnapshot.docs) {
                const userData = userDoc.data();
                const userId = userDoc.id;

                let personalizedBody = '';
                if (message) {
                    personalizedBody = message.replace(/{isim}/g, userData.name || '').replace(/{sehir}/g, userData.city || '').replace(/{sehirde}/g, getLocativeSuffix(userData.city || '')).replace(/{sehrin}/g, getGenitiveSuffix(userData.city || '')).replace(/{resim}/g, '').trim();
                }

                let notificationBody = personalizedBody;
                if (!notificationBody) {
                    if (uploadedMedia.length > 1) {
                        notificationBody = `Sana ${uploadedMedia.length} medya dosyası gönderdi.`;
                    } else if (uploadedMedia.length === 1) {
                        const type = uploadedMedia[0].type;
                        if (type === 'video') notificationBody = 'Sana bir video gönderdi.';
                        else if (type === 'voice') notificationBody = 'Sana bir sesli mesaj gönderdi.';
                        else notificationBody = 'Sana bir fotoğraf gönderdi.';
                    } else {
                         notificationBody = 'Sana yeni bir mesaj gönderdi.';
                    }
                }
                
                if (notificationBody.length > 100) {
                    notificationBody = notificationBody.substring(0, 97) + '...';
                }

                notificationPromises.push(fetch('/api/send-notification', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userId,
                        title: `${selectedProfile.name}`,
                        body: notificationBody,
                        senderPhotoUrl: selectedProfile.photoUrl || '',
                        imageUrl: uploadedMedia.find(m => m.type === 'image')?.url || null, // Sadece ilk resmi bildirimde göster
                        chatPartnerId: selectedProfileId,
                        notificationType: 'MESSAGE'
                    }),
                }));
            }
        }

        if(!isMessageMode) { // Sadece eylem varsa batch'i burada commit et
            await batch.commit();
        }

        await Promise.all(notificationPromises);
        setStatusMessage({ type: 'success', text: 'Seçilen tüm işlemler başarıyla gerçekleştirildi.' });

    } catch (error: any) {
        console.error("Toplu işlem sırasında HATA:", error);
        if (error.code === 'failed-precondition') {
            setStatusMessage({ type: 'error', text: 'Veritabanı index\'i eksik. Lütfen tarayıcı konsolundaki linke tıklayın.' });
        } else {
            setStatusMessage({ type: 'error', text: 'İşlem sırasında bir hata oluştu.' });
        }
    } finally {
        setIsLoading(false);
    }
};
    
    // --- YENİ AKSİYON LİSTESİ ---
    const actionsList = [
        { id: 'like', label: 'Beğeni', icon: Heart },
        { id: 'friendRequest', label: 'Arkadaşlık', icon: UserPlus },
        { id: 'profileVisit', label: 'Ziyaret', icon: Eye },
        { id: 'match', label: 'Match', icon: Users },
        { id: 'voiceCall', label: 'Sesli Arama', icon: Phone },
        { id: 'videoCall', label: 'Görüntülü', icon: Video },
    ];

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#1E1E2F] text-white">
            <div className="max-w-5xl mx-auto space-y-8 relative">
                <div className="absolute top-0 right-0">
                    <button onClick={() => setIsDirectMessageModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold">
                        <MessageSquare className="w-4 h-4" /> Tekli Mesaj Gönder
                    </button>
                </div>
                <div>
                    <h1 className="text-2xl font-bold mb-4">Toplu Mesaj Paneli</h1>
                    <div className="bg-[#2D2D42] p-4 rounded-lg flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-24 h-24 rounded-lg bg-purple-600 flex-shrink-0 flex items-center justify-center overflow-hidden">
                            {selectedProfile?.photoUrl ? <Image src={selectedProfile.photoUrl} alt={selectedProfile.name || 'Profil'} width={96} height={96} className="object-cover w-full h-full" /> : <User className="w-12 h-12 text-white" />}
                        </div>
                        <div className="flex-grow w-full text-center sm:text-left">
                            <h2 className="font-bold text-lg text-white">
                                {selectedProfile ? `${selectedProfile.name}, ${selectedProfile.age || ''}` : "Gönderen Seçilmedi"}
                            </h2>
                            <p className="text-sm text-gray-400">
                                {selectedProfile 
                                    ? `${selectedProfile.city || 'Şehir Yok'} • ${selectedProfile.civil || 'Medeni Hal Belirtilmemiş'}`
                                    : "Lütfen bir gönderici profil seçin."
                                }
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-[#2D2D42] p-6 rounded-lg space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <SearchableSelect
                        label="Kullanıcı Seçimi"
                        items={profiles}
                        selectedItem={selectedProfile}
                        onSelectedItemChange={(selection) => {
                            setSelectedProfileId(selection ? selection.id : '');
                            setSelectedProfile(selection);
                        }}
                        placeholder="Gönderici Ara..."
                    />                        <SelectInput label="Cinsiyet Seçimi" value={targetGender} onChange={e => setTargetGender(e.target.value)} options={[{ value: 'Tümü', label: 'Tümü' }, { value: 'Erkek', label: 'Erkek' }, { value: 'Kadın', label: 'Kadın' }]} placeholder=''/>
                        <SelectInput label="Şehir Seçimi" value={targetCity} onChange={e => setTargetCity(e.target.value)} options={[{ value: 'Tümü', label: 'Tüm İller' }, ...turkiyeIlleri.map(il => ({ value: il, label: il }))]} placeholder=''/>
                        <SelectInput label="Tarih Seçimi" value={targetDateRange} onChange={e => setTargetDateRange(e.target.value)} options={[{ value: 'Tümü', label: 'Tüm Zamanlar' }, { value: '24saat', label: 'Son 24 Saat' }, { value: '7gun', label: 'Son 7 Gün' }, { value: '1ay', label: 'Son 1 Ay' }, { value: '3ay', label: 'Son 3 Ay' }, { value: '6ay', label: 'Son 6 Ay' }]} placeholder=''/>
                    </div>
                    
                    <TextAreaInput 
                        label="Mesaj" 
                        value={message} 
                        onChange={e => { if (!isActionSelected) { setMessage(e.target.value); } }}
                        placeholder={isActionSelected ? "Bir eylem seçiliyken mesaj gönderilemez." : "Mesajınızı buraya yazın..."}
                        disabled={isActionSelected}
                        tags={[{name: 'isim', value: '{isim}'}, {name: 'şehir', value: '{sehir}'}, {name: 'şehirde', value: '{sehirde}'}, {name: 'şehrin', value: '{sehrin}'}, {name: 'resim', value: '{resim}'}]}
                        onTagClick={handleTagClick}
                    />

                    <div>
                        <label className="text-sm text-gray-400 mb-2 block">Eylemler</label>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                            {actionsList.map((action) => (
                                <ActionButton
                                    key={action.id}
                                    icon={action.icon}
                                    label={action.label}
                                    isSelected={selectedAction === action.id}
                                    onClick={() => handleActionChange(action.id)}
                                    disabled={isMessageMode}
                                />
                            ))}
                        </div>
                    </div>
                    
                    <div {...getRootProps()} className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isActionSelected ? 'opacity-50 cursor-not-allowed' : isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600 hover:border-gray-500'}`}>
                            <input {...getInputProps()} />
                            <div className="flex flex-col items-center">
                                <UploadCloud className="w-10 h-10 text-gray-500 mb-2" />
                                <p className="text-gray-400">Medya dosyalarını buraya sürükle veya tıkla</p>
                                <p className="text-xs text-gray-500 mt-1">En fazla 3 adet (Resim, Video, Ses)</p>
                            </div>
                        </div>

                        {/* YENİ VE PROFESYONEL ÖNİZLEME ALANI */}
                        {files.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <p className="text-sm font-medium text-gray-300">Gönderilecek Medyalar ({files.length}/3):</p>
                                {files.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-700/50 rounded-md animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {file.type.startsWith('image/') && (
                                                <Image src={URL.createObjectURL(file)} alt={file.name} width={40} height={40} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                                            )}
                                            {file.type.startsWith('video/') && (
                                                <video src={URL.createObjectURL(file)} className="w-10 h-10 rounded object-cover bg-black flex-shrink-0" />
                                            )}
                                            {file.type.startsWith('audio/') && (
                                                <div className="w-10 h-10 rounded bg-gray-600 flex items-center justify-center flex-shrink-0">
                                                    <Mic className="w-5 h-5 text-white" />
                                                </div>
                                            )}
                                            <p className="text-sm text-gray-300 truncate">{file.name}</p>
                                        </div>
                                        <button onClick={() => removeFile(file)} className="p-1 rounded-full text-gray-400 hover:bg-gray-600 hover:text-white flex-shrink-0">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        </div>

                    
                <div className="flex items-center justify-end gap-4">
                    {statusMessage.text && <p className={`text-sm ${statusMessage.type === 'error' ? 'text-red-400' : statusMessage.type === 'success' ? 'text-green-400' : 'text-gray-400'}`}>{statusMessage.text}</p>}
                    <button onClick={handleReset} disabled={isLoading} className="flex items-center gap-2 px-6 py-2 border border-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                        <RefreshCw className="w-4 h-4" /> Sıfırla
                    </button>
                    <button onClick={handleSend} disabled={isLoading} className="flex items-center gap-2 px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait">
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />} Gönder
                    </button>
                </div>
            </div>
            <AnimatePresence>
                {isDirectMessageModalOpen && <DirectMessageModal isOpen={isDirectMessageModalOpen} onClose={() => setIsDirectMessageModalOpen(false)} senderProfiles={profiles} />}
            </AnimatePresence>
        </div>
    );
}