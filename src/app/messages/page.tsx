'use client';
import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp, where, addDoc, doc, deleteDoc, getDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { EmojiClickData } from 'emoji-picker-react';
import { MessageSquare, Send, Users, Search, Smile, Paperclip, X, AlertTriangle, Phone, Video, Mic, Image as ImageIcon, CheckCircle } from 'lucide-react';

import dynamic from 'next/dynamic';
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });
import NotesSection from './NotesSection';

// ARAYÜZLER
interface PendingConversation { 
    id: string; 
    lastMessage: string; 
    lastMessageType?: 'text' | 'image' | 'video' | 'voice' | 'song' | 'gift'; 
    lastMessageTimestamp: Timestamp; 
    originalSenderId: string; 
    originalSenderName: string; 
    originalSenderPhotoUrl: string; 
    ghostUserId: string; 
    ghostUserName: string; 
    ghostUserPhotoUrl: string; 
    originalSenderIsPremium?: boolean; 
    lastMessageSenderId?: string; 
    unreadCount?: number; 
    activeModerator?: { moderatorId: string; moderatorName: string; timestamp: Timestamp; } 
}
interface Message { id: string; senderId: string; timestamp: Timestamp; type: 'text' | 'image' | 'video' | 'voice' | 'song' | 'gift'; message?: string; mediaUrl?: string; }
interface UserProfile { id:string; name?: string; photoUrl?: string; age?: number; city?: string; about?: string; coins?: number; isPremium?: boolean; premiumEndDate?: Timestamp; civil?: string; description?: string; }

// UserInfoCard BİLEŞENİ
const UserInfoCard = ({ profile, loading, isOriginalUser }: { profile: UserProfile | null, loading: boolean, isOriginalUser: boolean }) => {
    if (loading) { return ( <div className="bg-[#2F3051] rounded-xl p-6 flex flex-col items-center text-center animate-pulse"> <div className="relative w-24 h-24 mb-4 bg-gray-700 rounded-full"></div> <div className="h-6 w-32 bg-gray-700 rounded-md mb-4"></div> <div className="w-full space-y-3 mt-4 border-t border-violet-500/20 pt-4"> <div className="h-4 w-full bg-gray-700 rounded-md"></div> <div className="h-4 w-3/4 bg-gray-700 rounded-md"></div> </div> </div> ); }
    if (!profile) return <div className="p-4 text-center text-red-500">Kullanıcı profili bulunamadı.</div>;
    const safePhoto = profile.photoUrl || '/default-avatar.png';
    return (
        <div className="bg-[#2F3051] rounded-xl p-6 flex flex-col items-center text-center">
            <div className="relative w-24 h-24 mb-4">
                <Image src={safePhoto} alt={profile.name || 'kullanıcı'} fill sizes="96px" className="rounded-full object-cover" />
                {isOriginalUser && profile.isPremium && ( <span className="absolute bottom-1 right-1 block h-4 w-4 rounded-full bg-amber-400 border-2 border-[#2F3051]" title="Premium Üye"></span> )}
            </div>
            <h3 className="text-xl font-bold text-gray-100">{profile.name || "İsimsiz"}</h3>
            <p className="text-sm text-violet-400 mb-4">{isOriginalUser ? "Gerçek Kullanıcı" : "Yönetilen Profil"}</p>
            <div className="w-full space-y-3 text-left text-sm mt-4 border-t border-violet-500/20 pt-4">
                {profile.age && <div><span className="text-gray-400">Yaş: </span><span className="font-semibold text-gray-100">{profile.age}</span></div>}
                {profile.city && <div><span className="text-gray-400">Şehir: </span><span className="font-semibold text-gray-100">{profile.city}</span></div>}
                {profile.civil && <div><span className="text-gray-400">Medeni Hal: </span><span className="font-semibold text-gray-100">{profile.civil}</span></div>}
                {profile.coins !== undefined && <div className="flex justify-between items-center"><span className="text-gray-400">Jado Coin:</span><span className="font-mono bg-gray-800 px-2 py-0.5 rounded text-amber-400 text-xs">{profile.coins}</span></div>}
                {isOriginalUser && <div className="flex justify-between items-center"><span className="text-gray-400">Premium:</span>{profile.isPremium ? (<span className="bg-emerald-900/50 text-emerald-300 text-xs font-medium px-2 py-0.5 rounded-full">EVET</span>) : (<span className="bg-orange-900/50 text-orange-300 text-xs font-medium px-2 py-0.5 rounded-full">HAYIR</span>)}</div>}
                {profile.premiumEndDate && profile.isPremium && <div><span className="text-gray-400">Premium Bitiş: </span><span className="font-semibold text-gray-100">{new Date(profile.premiumEndDate.seconds * 1000).toLocaleDateString('tr-TR')}</span></div>}
                {profile.description && (<div className="text-left mt-4 border-t border-violet-500/20 pt-4"><span className="text-gray-400 block mb-1">Hakkında:</span><p className="text-gray-200 text-sm leading-relaxed">{profile.description}</p></div>)}
            </div>
        </div>
    );
};

const ConversationPreview = ({ message, type, }: { message?: string; type?: string; }) => {
    const variantMap: Record<string, { icon: React.ReactNode; label: string; }> = {
      image: { icon: <ImageIcon className="w-4 h-4 flex-shrink-0" />, label: "Fotoğraf" },
      video: { icon: <Video className="w-4 h-4 flex-shrink-0" />, label: "Video" },
      voice: { icon: <Mic className="w-4 h-4 flex-shrink-0" />, label: "Ses Kaydı" },
      gift: { icon: <span>🎁</span>, label: "Hediye" },
      song: { icon: <span>🎵</span>, label: "Şarkı" },
    };
    const variant = type ? variantMap[type] : null;
  
    return (
        <div className="flex items-center gap-1.5 text-gray-400 text-xs mt-1">
            {variant ? (
                <>
                    {variant.icon}
                    <p className="truncate">{variant.label}</p>
                </>
            ) : (
                <p className="truncate">{message || "Mesaj içeriği yok"}</p>
            )}
        </div>
    );
};

// ANA SAYFA BİLEŞENİ
export default function MessagesPage() {
    const { user } = useAuth();
    const [pendingConversations, setPendingConversations] = useState<PendingConversation[]>([]);
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [selectedConversation, setSelectedConversation] = useState<PendingConversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const [userInfo, setUserInfo] = useState<{ ghost: UserProfile | null, original: UserProfile | null }>({ ghost: null, original: null });
    const [loadingUserInfo, setLoadingUserInfo] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [activeSearchTerm, setActiveSearchTerm] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileType, setFileType] = useState<Message['type'] | null>(null);
    const [moderatorName, setModeratorName] = useState<string | null>(null);
    const activeLockIdRef = useRef<string | null>(null);
    const [callNotification, setCallNotification] = useState<string | null>(null);
    const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!user?.firebaseUser?.uid) return;
        const currentUserId = user.firebaseUser.uid;
        const adminDocRef = doc(db, 'admins', currentUserId);
        const adminUnsubscribe = onSnapshot(adminDocRef, (docSnap) => {
            setModeratorName(docSnap.exists() ? docSnap.data().name : null);
        });
        setLoadingConversations(true);
        const q = query(collection(db, 'pending_chats'), orderBy('lastMessageTimestamp', 'desc'));
        const conversationsUnsubscribe = onSnapshot(q, (snapshot) => {
            const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingConversation));
            setPendingConversations(convs);
            setLoadingConversations(false);
        });
        return () => {
            adminUnsubscribe();
            conversationsUnsubscribe();
        };
    }, [user]);

    const unlockConversation = async (conversationId: string) => {
        if (!conversationId) return;
        const docRef = doc(db, 'pending_chats', conversationId);
        try {
            await updateDoc(docRef, { activeModerator: deleteField() });
        } catch (error) {
            console.log(`Sohbet kilidi bırakılamadı (ID: ${conversationId}, muhtemelen zaten silinmiş):`, error);
        }
    };

    const lockConversation = async (conversationId: string) => {
        if (!conversationId || !moderatorName || !user?.firebaseUser?.uid) return;
        const docRef = doc(db, 'pending_chats', conversationId);
        const moderatorData = {
            moderatorId: user.firebaseUser.uid,
            moderatorName: moderatorName,
            timestamp: Timestamp.now()
        };
        try {
            await updateDoc(docRef, { activeModerator: moderatorData });
            activeLockIdRef.current = conversationId;
        } catch (error) {
            console.error(`Sohbet kilitlenemedi (ID: ${conversationId}):`, error);
        }
    };

    const handleConversationSelect = async (conversation: PendingConversation) => {
        if (selectedConversation?.id === conversation.id) return;
        if (activeLockIdRef.current) {
            await unlockConversation(activeLockIdRef.current);
        }
        setSelectedConversation(conversation);
        await lockConversation(conversation.id);
    };

    const handleSendCall = async (callType: 'voice' | 'video') => {
        if (!selectedConversation) { alert("Arama göndermek için bir sohbet seçili olmalıdır."); return; }
        const callerProfile = userInfo.ghost;
        const targetUser = userInfo.original;
        if (!callerProfile || !targetUser) { alert("Kullanıcı bilgileri tam yüklenemedi. Lütfen bekleyin."); return; }
        const callData = {
            callerId: callerProfile.id,
            callerName: callerProfile.name || "Bilinmeyen",
            callerPhotoUrl: callerProfile.photoUrl || "",
            callTime: serverTimestamp(),
            callType: callType
        };
        try {
            const userDocRef = doc(db, 'users', targetUser.id);
            await updateDoc(userDocRef, { incomingCall: callData });
            
            const notificationMessage = `${callType === 'video' ? 'Görüntülü' : 'Sesli'} arama isteği gönderildi.`;
            setCallNotification(notificationMessage);

            if (notificationTimerRef.current) {
                clearTimeout(notificationTimerRef.current);
            }
            notificationTimerRef.current = setTimeout(() => {
                setCallNotification(null);
            }, 3000);

        } catch (error) {
            console.error("Arama gönderilirken hata:", error);
            alert("Arama gönderilirken bir hata oluştu.");
        }
    };

    useEffect(() => {
        const unlockOnUnload = () => {
            if (activeLockIdRef.current) {
                unlockConversation(activeLockIdRef.current);
            }
        };
        window.addEventListener('beforeunload', unlockOnUnload);
        return () => {
            window.removeEventListener('beforeunload', unlockOnUnload);
            unlockOnUnload();
        };
    }, []);

     const handleSendMessage = async (content: { text?: string; type: Message['type']; mediaUrl?: string }) => {
        if (!user?.firebaseUser?.uid || !selectedConversation) return;
        const conversationIdToDelete = selectedConversation.id;
        const senderId = selectedConversation.ghostUserId; 
        try {
            const messageData: any = { 
                chatId: conversationIdToDelete, 
                senderId: senderId,
                receiverId: selectedConversation.originalSenderId, 
                timestamp: Timestamp.now(), 
                type: content.type 
            };
            if (content.text) messageData.message = content.text;
            if (content.mediaUrl) messageData.mediaUrl = content.mediaUrl;
            
            const pendingDocRef = doc(db, 'pending_chats', conversationIdToDelete);
            
            // ... handleSendMessage fonksiyonunun içi

            await Promise.all([
                addDoc(collection(db, 'messages'), messageData),
                deleteDoc(pendingDocRef)
            ]);
            
            activeLockIdRef.current = null;
            try {
                const recipientUserId = selectedConversation.originalSenderId;
                
                // Mesajı gönderen kişi (yönetilen ghost profil)
                // Bildirim başlığında onun adını kullanacağız
                const senderName = selectedConversation.ghostUserName || 'Biri';

                // Bildirim içeriğini hazırlıyoruz
                let notificationBody = '';
                if (content.type === 'text' && content.text) {
                    // Eğer mesaj çok uzunsa, ilk 100 karakterini alalım ki bildirim ekranına sığsın
                    notificationBody = content.text.length > 100 ? content.text.substring(0, 97) + '...' : content.text;
                } else {
                    // Medya mesajları için standart metinler
                    const typeLabels = { 
                        'image': 'bir fotoğraf gönderdi', 
                        'video': 'bir video gönderdi', 
                        'voice': 'bir sesli mesaj gönderdi', 
                        'gift': 'bir hediye gönderdi', 
                        'song': 'bir şarkı gönderdi'
                    };
                    notificationBody = typeLabels[content.type as keyof typeof typeLabels] || 'yeni bir mesaj gönderdi';
                }

                // YENİ AÇTIĞIMIZ API KAPISINI ÇALIYORUZ
                console.log(`Bildirim gönderiliyor: Kime=${recipientUserId}, Kimden=${senderName}`);
                await fetch('/api/send-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                userId: recipientUserId,
                title: `${senderName} sana yeni bir mesaj gönderdi!`,
                body: notificationBody,
                senderPhotoUrl: selectedConversation.ghostUserPhotoUrl || '',
                imageUrl: content.type === 'image' ? content.mediaUrl : null,
              
                chatPartnerId: selectedConversation.ghostUserId 
}),
            });
            console.log("Bildirim isteği API'ye başarıyla gönderildi.");
            } catch (error) {
                // Bu hata, sadece fetch işlemi başarısız olursa çalışır. 
                // Asıl bildirim gönderme hatası sunucu loglarında görünür.
                console.error("API'ye bildirim isteği gönderilirken bir frontend hatası oluştu:", error);
            }
        } catch (error) {
            console.error("Mesaj gönderme veya sohbet silme hatası:", error);
        }
    };

    useEffect(() => { if (!selectedConversation) { setUserInfo({ ghost: null, original: null }); setMessages([]); return; } setLoadingMessages(true); const messagesQuery = query(collection(db, 'messages'), where('chatId', '==', selectedConversation.id), orderBy('timestamp', 'asc')); const messagesUnsubscribe = onSnapshot(messagesQuery, (snapshot) => { setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message))); setLoadingMessages(false); }); const fetchUserInfos = async () => { setLoadingUserInfo(true); try { const originalDocRef = doc(db, 'users', selectedConversation.originalSenderId); const originalDocSnap = await getDoc(originalDocRef); const originalData = originalDocSnap.exists() ? { id: originalDocSnap.id, ...originalDocSnap.data() } as UserProfile : null; const ghostDocRef = doc(db, 'profiles', selectedConversation.ghostUserId); const ghostDocSnap = await getDoc(ghostDocRef); const ghostData = ghostDocSnap.exists() ? { id: ghostDocSnap.id, ...ghostDocSnap.data() } as UserProfile : null; setUserInfo({ original: originalData, ghost: ghostData }); } catch (error) { console.error("Kullanıcı profilleri çekilirken hata oluştu:", error); } setLoadingUserInfo(false); }; fetchUserInfos(); return () => messagesUnsubscribe(); }, [selectedConversation]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    useEffect(() => { return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }; }, [previewUrl]);

    const handleTextSubmit = (e: React.FormEvent) => { e.preventDefault(); const msgToSend = newMessage.trim(); if (msgToSend === '') return; setNewMessage(''); if (showEmojiPicker) setShowEmojiPicker(false); handleSendMessage({ text: msgToSend, type: 'text' }); };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; let detectedType: Message['type']; if (file.type.startsWith('image/')) detectedType = 'image'; else if (file.type.startsWith('audio/')) detectedType = 'voice'; else if (file.type.startsWith('video/')) detectedType = 'video'; else { alert("Desteklenmeyen dosya türü."); return; } setSelectedFile(file); setFileType(detectedType); setPreviewUrl(URL.createObjectURL(file)); if (fileInputRef.current) fileInputRef.current.value = ""; };
    const handleSendMedia = async () => { if (!selectedFile || !fileType) return; setIsUploading(true); try { const downloadURL = await uploadFile(selectedFile); await handleSendMessage({ type: fileType, mediaUrl: downloadURL }); } catch (error) { console.error("Medya gönderme hatası:", error); } finally { setIsUploading(false); handleCancelPreview(); } };
    const uploadFile = async (file: File): Promise<string> => { return new Promise(async (resolve, reject) => { const storageRef = ref(storage, `chat_media/${Date.now()}_${file.name}`); const uploadTask = uploadBytesResumable(storageRef, file); uploadTask.on('state_changed', null, (error) => reject(error), async () => { resolve(await getDownloadURL(uploadTask.snapshot.ref)); }); }); };
    const handleCancelPreview = () => { setSelectedFile(null); setPreviewUrl(null); setFileType(null); };
    const onEmojiClick = (emojiData: EmojiClickData) => { setNewMessage(prev => prev + emojiData.emoji); };
    
    const handleSearch = () => { setActiveSearchTerm(searchInput); };
    const filteredConversations = pendingConversations.filter(convo =>
        (convo.ghostUserName?.toLowerCase() || '').includes(activeSearchTerm.toLowerCase()) ||
        (convo.originalSenderName?.toLowerCase() || '').includes(activeSearchTerm.toLowerCase())
    );

    const formatShortTime = (timestamp: Timestamp | null) => { if (!timestamp) return ''; return new Date(timestamp.seconds * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); };
    const formatFullDateTime = (timestamp: Timestamp | null) => { if (!timestamp) return ''; return new Date(timestamp.seconds * 1000).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + new Date(timestamp.seconds * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); };
    
    const renderMessageContent = (msg: Message) => {
        const textContent = msg.message ? <p className="leading-relaxed px-4 py-2">{msg.message}</p> : null;
        const mediaContent = (() => {
            if (!msg.mediaUrl) return null;
            switch (msg.type) {
                case 'image': return <Image src={msg.mediaUrl} alt="Gönderilen resim" width={250} height={250} className="rounded-lg object-cover cursor-pointer" onClick={() => window.open(msg.mediaUrl, '_blank')}/>;
                case 'voice': return <audio controls src={msg.mediaUrl} className="w-64 h-12 p-2">Tarayıcınız desteklemiyor.</audio>;
                case 'video': return <video controls src={msg.mediaUrl} className="rounded-lg w-full max-w-xs" />;
                default: return null;
            }
        })();
        if (textContent && mediaContent) { return ( <div className="space-y-2">{mediaContent}{textContent}</div> ); }
        return mediaContent || textContent || <p className="leading-relaxed px-4 py-2 text-gray-500 italic">[Boş Mesaj]</p>;
    };
    
    return (
        <div className="w-full h-full flex items-center justify-center p-4 md:p-8">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: "easeOut" }} className="flex w-full h-full max-w-7xl max-h-[90vh] rounded-2xl bg-[#23243D] text-gray-200 overflow-hidden shadow-2xl shadow-black/50 border border-violet-500/30">
                
                <div className="w-[280px] bg-[#2a2b47]/50 border-r border-violet-500/20 flex flex-col flex-shrink-0">
                    <div className="p-4 border-b border-violet-500/20">
                        <div className="relative mb-4">
                            <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }} placeholder="Sohbetlerde ara..." className="w-full rounded-md bg-[#23243D] py-2 pl-10 pr-4 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                            <button onClick={handleSearch} className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 hover:text-white"><Search className="w-5 h-5"/></button>
                        </div>
                        <h2 className="text-xl font-bold text-white">Mesajlar ({loadingConversations ? '...' : filteredConversations.length})</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {loadingConversations ? ( <div className="p-3 space-y-3"> {[...Array(10)].map((_, i) => ( <div key={i} className="flex items-center gap-3 animate-pulse"> <div className="w-12 h-12 rounded-full bg-gray-700"></div> <div className="flex-1 space-y-2"> <div className="h-4 bg-gray-700 rounded w-3/4"></div> <div className="h-3 bg-gray-700 rounded w-1/2"></div> </div> </div> ))} </div> ) 
                        : filteredConversations.length === 0 ? ( <p className='text-center text-gray-400 py-4'>{activeSearchTerm ? 'Arama sonucu bulunamadı.' : 'Bekleyen mesaj bulunmuyor.'}</p> ) 
                        : (
                            filteredConversations.map(convo => {
                                const now = Timestamp.now();
                                const isStale = convo.activeModerator ? (now.seconds - convo.activeModerator.timestamp.seconds) > 120 : false;
                                const isLockedByOther = convo.activeModerator && convo.activeModerator.moderatorId !== user?.firebaseUser?.uid;
                                const isClickable = !isLockedByOther || isStale;
                                return (
                                <div key={convo.id} onClick={() => { if (isClickable) { handleConversationSelect(convo); } else { console.log("Bu sohbet şu anda başka bir moderatör tarafından aktif olarak kullanılıyor: " + convo.activeModerator?.moderatorName); } }} className={`p-3 relative ${!isClickable ? 'cursor-not-allowed' : 'cursor-pointer border-l-4 ' + (selectedConversation?.id === convo.id ? 'border-violet-500 bg-violet-900/30' : 'border-transparent hover:bg-violet-900/20')}`}>
                                    <div className={`transition-all duration-300 ${!isClickable ? 'filter blur-sm pointer-events-none' : ''}`}>
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 flex items-center -space-x-4"><Image src={convo.ghostUserPhotoUrl || '/default-avatar.png'} alt={convo.ghostUserName} width={48} height={48} className="w-12 h-12 rounded-full object-cover ring-2 ring-[#23243D]" /><Image src={convo.originalSenderPhotoUrl || '/default-avatar.png'} alt={convo.originalSenderName} width={48} height={48} className={`w-12 h-12 rounded-full object-cover ring-2 ${convo.originalSenderIsPremium ? 'ring-amber-400' : 'ring-[#23243D]'}`} /></div>
                                            <div className="flex-1 min-w-0 ml-4">
                                                <p className="font-semibold text-white truncate text-sm">{`${convo.ghostUserName} - ${convo.originalSenderName}`}</p>
                                                <ConversationPreview message={convo.lastMessage} type={convo.lastMessageType} />
                                            </div>
                                            <div className="flex flex-col items-end text-xs ml-2">
                                                <p className="text-gray-500 mb-1">{formatShortTime(convo.lastMessageTimestamp)}</p>
                                                {convo.unreadCount && convo.unreadCount > 0 && convo.lastMessageSenderId !== user?.firebaseUser?.uid && ( <span className="bg-red-500 text-white w-5 h-5 flex items-center justify-center rounded-full font-bold text-[10px]"> {convo.unreadCount} </span> )}
                                            </div>
                                        </div>
                                    </div>
                                    {!isClickable && (
                                        <div className="absolute inset-0 m-1.5 flex flex-col items-center justify-center bg-gray-900/70 rounded-lg text-center p-2">
                                            <p className="text-white text-sm font-bold tracking-wider">{convo.activeModerator?.moderatorName}</p>
                                            {isStale && ( <div className="mt-1 flex items-center gap-1 text-xs text-amber-400"> <AlertTriangle className="w-3 h-3"/> <span>Eski Kilit - Devralabilirsiniz</span> </div> )}
                                        </div>
                                    )}
                                </div>
                                )
                            })
                        )}
                    </div>
                </div>
                
                <div className="flex-1 flex flex-col relative" style={{ backgroundImage: `url('/chat-bg.png')`, backgroundSize: '300px', backgroundRepeat: 'repeat' }}>
                    <AnimatePresence>
                        {callNotification && (
                            <motion.div
                                className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg z-20 flex items-center gap-2"
                                initial={{ y: -50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -50, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            >
                                <CheckCircle className="w-5 h-5" />
                                <span>{callNotification}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {selectedConversation ? (
                            <motion.div key={selectedConversation.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full bg-[#1E202A]/50">
                                <header className="p-4 flex items-center justify-between gap-4 border-b border-violet-500/20 bg-[#23243D]/80 backdrop-blur-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-shrink-0 flex items-center -space-x-4">
                                            <Image src={userInfo.ghost?.photoUrl || '/default-avatar.png'} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover ring-2 ring-[#23243D]" />
                                            <Image src={userInfo.original?.photoUrl || '/default-avatar.png'} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover ring-2 ring-[#23243D]" />
                                        </div>
                                        <p className="font-semibold text-white">{`${userInfo.ghost?.name || '...'} - ${userInfo.original?.name || '...'}`}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleSendCall('voice')} className="p-2 rounded-full bg-green-600/80 hover:bg-green-600 transition-colors" title="Sesli Arama Gönder"><Phone className="w-5 h-5 text-white" /></button>
                                        <button onClick={() => handleSendCall('video')} className="p-2 rounded-full bg-blue-600/80 hover:bg-blue-600 transition-colors" title="Görüntülü Arama Gönder"><Video className="w-5 h-5 text-white" /></button>
                                    </div>
                                </header>
                                <div className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar">
                                    {loadingMessages ? <p className='text-center text-gray-400'>Yükleniyor...</p> : messages.map((msg) => { 
                                        const isSenderGhost = msg.senderId === selectedConversation.ghostUserId; 
                                        const profile = isSenderGhost ? userInfo.ghost : userInfo.original; 
                                        return (
                                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex items-end gap-3 ${isSenderGhost ? 'justify-end' : 'justify-start'}`}>
                                            {!isSenderGhost && <Image src={profile?.photoUrl || '/default-avatar.png'} alt="" width={28} height={28} className={`self-start rounded-full object-cover flex-shrink-0 ${profile?.isPremium ? 'ring-2 ring-amber-400' : ''}`}/>}
                                            <div className="flex flex-col">
                                                <div className={`rounded-xl max-w-lg ${isSenderGhost ? 'bg-violet-700 text-white rounded-br-none' : 'bg-[#2F3051] text-gray-200 rounded-bl-none'} ${msg.type !== 'text' || !msg.message ? 'p-0 overflow-hidden' : ''}`}>
                                                    {renderMessageContent(msg)}
                                                </div>
                                                <span className={`text-xs text-gray-500 mt-1 px-1 ${isSenderGhost ? 'self-end' : 'self-start'}`}>{formatFullDateTime(msg.timestamp)}</span>
                                            </div>
                                        </motion.div>
                                        ); 
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>
                                <div className="p-4 bg-[#23243D]/80 backdrop-blur-sm relative">
                                    <AnimatePresence>{showEmojiPicker && (<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-20 right-0 z-10"><EmojiPicker onEmojiClick={onEmojiClick} theme="dark" /></motion.div>)}</AnimatePresence>
                                    <div className="relative">
                                        {isUploading && ( <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full z-10"> <p className="text-white font-semibold">Yükleniyor...</p> </div> )}
                                        {selectedFile && previewUrl ? (
                                            <div className="bg-[#2F3051] rounded-full p-2 flex items-center justify-between">
                                                <div className="flex items-center gap-3"><button onClick={handleCancelPreview} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><X className="w-5 h-5"/></button>{fileType === 'image' && <Image src={previewUrl} alt="Önizleme" width={40} height={40} className="rounded-md object-cover"/>}{fileType === 'video' && <video src={previewUrl} className="w-24 h-10 rounded-md object-cover"/>}{fileType === 'voice' && <audio src={previewUrl} controls className="h-10"/>}<p className="text-sm text-gray-300 truncate max-w-[12rem] md:max-w-xs">{selectedFile.name}</p></div>
                                                <button onClick={handleSendMedia} disabled={isUploading} className="p-2 rounded-full bg-violet-700 disabled:bg-gray-500 hover:bg-violet-600 transition-colors"><Send className="w-5 h-5 text-white" /></button>
                                            </div>
                                        ) : (
                                            <form onSubmit={handleTextSubmit} className="flex items-center bg-[#2F3051] rounded-full px-2">
                                                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="p-2 text-gray-400 hover:text-violet-400 transition-colors"> <Paperclip className="w-5 h-5"/> </button>
                                                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} disabled={isUploading} className="p-2 text-gray-400 hover:text-violet-400 transition-colors"> <Smile className="w-5 h-5"/> </button>
                                                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Bir mesaj yazın..." disabled={isUploading} className="w-full p-3 bg-transparent focus:outline-none text-gray-200 placeholder-gray-400" />
                                                <button type="submit" disabled={!newMessage.trim() || isUploading} className="p-2 rounded-full bg-violet-700 disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-violet-600 transition-colors"><Send className="w-5 h-5 text-white" /></button>
                                            </form>
                                        )}
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,audio/*,video/*" className="hidden"/>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="bg-violet-900/30 p-6 rounded-full mb-4"><MessageSquare className="w-12 h-12 text-violet-400"/></div>
                                <h3 className="text-xl font-semibold text-white">Bir Mesaj Seç</h3>
                                <p className="text-gray-400 mt-1">Detayları görüntülemek için soldaki listeden bir konuşma seçin.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* SAĞ SÜTUN */}
                <AnimatePresence>
                    {selectedConversation && (
                        <motion.div 
                            initial={{ x: '100%' }} 
                            animate={{ x: 0 }} 
                            exit={{ x: '100%' }} 
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }} 
                            className="w-[280px] bg-[#2a2b47]/80 backdrop-blur-sm border-l border-violet-500/20 flex-shrink-0 p-4 overflow-y-auto space-y-4 custom-scrollbar">
                            
                            <UserInfoCard profile={userInfo.original} loading={loadingUserInfo} isOriginalUser={true} />
                            <UserInfoCard profile={userInfo.ghost} loading={loadingUserInfo} isOriginalUser={false} />
                            <NotesSection chatId={selectedConversation.id} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}