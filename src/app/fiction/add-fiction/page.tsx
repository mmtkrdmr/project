'use client';

import { useState, useEffect, useCallback } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, Timestamp, doc, getDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useDropzone } from 'react-dropzone';
import { User, ChevronDown, RefreshCw, UploadCloud, X, Loader2, Save, Plus, Trash2, Video, Mic } from 'lucide-react';
import Image from 'next/image';
import { getFunctions, httpsCallable } from "firebase/functions";
import { functions } from '@/lib/firebase'; // Bu satır zaten varsa, tekrar ekleme.
// YARDIMCI FONKSİYONLAR, TİPLER VE BİLEŞENLER (DEĞİŞİKLİK YOK)
const getLocativeSuffix = (city: string) => { if (!city) return ''; const vowels = 'aeıioöuü'; const backVowels = 'aıou'; const hardConsonants = 'fstkçşhp'; const lowerCity = city.toLowerCase(); const lastChar = lowerCity.charAt(city.length - 1); let lastVowel = ''; for (let i = city.length - 1; i >= 0; i--) { if (vowels.includes(lowerCity.charAt(i))) { lastVowel = lowerCity.charAt(i); break; } } const consonant = hardConsonants.includes(lastChar) ? 't' : 'd'; const vowel = backVowels.includes(lastVowel) ? 'a' : 'e'; return `${city}'${consonant}${vowel}`; };
const getGenitiveSuffix = (city: string) => { if (!city) return ''; const vowels = 'aeıioöuü'; const lastChar = city.slice(-1).toLowerCase(); const needsN = vowels.includes(lastChar); let lastVowel = ''; for (let i = city.length - 1; i >= 0; i--) { const char = city.charAt(i).toLowerCase(); if (vowels.includes(char)) { lastVowel = char; break; } } let suffixBase = ''; switch (lastVowel) { case 'a': case 'ı': suffixBase = 'ın'; break; case 'e': case 'i': suffixBase = 'in'; break; case 'o': case 'u': suffixBase = 'un'; break; case 'ö': case 'ü': suffixBase = 'ün'; break; default: suffixBase = 'in'; } const connector = needsN ? 'n' : ''; return `${city}'${connector}${suffixBase}`; };
const turkiyeIlleri = [ 'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin', 'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkâri', 'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce' ].sort((a, b) => a.localeCompare(b, 'tr'));

interface Profile { id: string; name: string; photoUrl?: string; age?: number; city?: string; }
type MediaType = 'image' | 'video' | 'voice';
interface MessageTemplate { text: string; file: File | null; mediaType: MediaType | null; previewUrl?: string; }

const DateTimeInput = ({ label, value, onChange }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }) => ( <div> <label className="text-xs text-gray-400">{label}</label> <input type="datetime-local" value={value} onChange={onChange} className="w-full bg-[#1E1E2F] p-2 mt-1 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px] text-white" /> </div> );
const NumberInput = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string; }) => ( <div> <label className="text-xs text-gray-400">{label}</label> <input type="number" value={value} onChange={onChange} placeholder={placeholder} min="1" className="w-full bg-[#1E1E2F] p-2 mt-1 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px]" /> </div> );
const SelectInput = ({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: string, label: string }[]; placeholder?: string }) => ( <div> <label className="text-xs text-gray-400">{label}</label> <div className="relative mt-1"> <select value={value} onChange={onChange} className="w-full bg-[#1E1E2F] p-2 rounded-md border border-gray-600 appearance-none focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px]"> {placeholder && <option value="" disabled>{placeholder}</option>} {options.map(opt => <option key={opt.value} value={opt.value} className="bg-[#2D2D42]">{opt.label}</option>)} </select> <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" /> </div> </div> );
const TextAreaInput = ({ label, value, onChange, placeholder, tags, onTagClick }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder: string; tags?: {name: string, value: string}[]; onTagClick?: (tagValue: string) => void; }) => ( <div> <label className="text-sm text-gray-400 mb-2 block">{label}</label> <textarea value={value} onChange={onChange} placeholder={placeholder} className="w-full h-24 bg-[#1E1E2F] p-3 rounded-md border border-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500" /> {tags && onTagClick && ( <div className="flex flex-wrap gap-2 mt-2"> {tags.map(tag => ( <button key={tag.name} type="button" onClick={() => onTagClick(tag.value)} className="bg-purple-500/20 text-purple-300 text-xs font-medium px-2.5 py-1 rounded-full hover:bg-purple-500/40 transition-colors"> {tag.name} </button> ))} </div> )} </div> );


export default function AddFictionPage() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [targetGender, setTargetGender] = useState('Tümü');
    const [targetCity, setTargetCity] = useState('Tümü');
    const [targetDateRange, setTargetDateRange] = useState('Tümü');
    const [scheduleDateTime, setScheduleDateTime] = useState('');
    const [messageInterval, setMessageInterval] = useState('3');
    const [currentMessageText, setCurrentMessageText] = useState('');
    const [currentFile, setCurrentFile] = useState<File | null>(null);
    const [currentMediaType, setCurrentMediaType] = useState<MediaType | null>(null);
    const [currentFilePreview, setCurrentFilePreview] = useState<string | null>(null);
    const [messageList, setMessageList] = useState<MessageTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const profilesSnapshot = await getDocs(collection(db, 'profiles'));
                const profilesList = profilesSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name, photoUrl: doc.data().photoUrl, age: doc.data().age } as Profile));
                setProfiles(profilesList);
            } catch (error) {
                console.error("Profiller çekilirken hata:", error);
                setStatusMessage({ type: 'error', text: 'Profiller yüklenemedi.' });
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
                setSelectedProfile(null);
            }
        };
        fetchProfileDetails();
    }, [selectedProfileId]);
   
    const handleTagClick = (tagValue: string) => { setCurrentMessageText(prev => prev + tagValue); };


    const handleReset = () => {
        setSelectedProfileId('');
        setTargetGender('Tümü');
        setTargetCity('Tümü');
        setTargetDateRange('Tümü');
        setScheduleDateTime('');
        setMessageInterval('3');
        setCurrentMessageText('');
        setCurrentFile(null);
        setCurrentMediaType(null);
        setCurrentFilePreview(null);
        setMessageList([]);
        setStatusMessage({ type: '', text: '' });
    };

    const onDrop = useCallback((acceptedFiles: File[]) => { 
        const file = acceptedFiles[0];
        if (file) {
            let mediaType: MediaType | null = null;
            if (file.type.startsWith('image/')) mediaType = 'image';
            else if (file.type.startsWith('video/')) mediaType = 'video';
            else if (file.type.startsWith('audio/')) mediaType = 'voice';
            
            if(mediaType) {
                setCurrentFile(file);
                setCurrentMediaType(mediaType);
                if (mediaType === 'image' || mediaType === 'video') {
                     setCurrentFilePreview(URL.createObjectURL(file));
                } else {
                    setCurrentFilePreview(null);
                }
            } else {
                alert("Desteklenmeyen dosya türü. Lütfen resim, video veya ses dosyası yükleyin.");
            }
        }
    }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: {'image/*': [], 'video/*': [], 'audio/*': []}, maxFiles: 1, multiple: false });

    const handleAddMessageToList = () => {
        if (!currentMessageText && !currentFile) {
            alert("Lütfen bir metin yazın veya bir medya dosyası ekleyin.");
            return;
        }
        const newMessage: MessageTemplate = { text: currentMessageText, file: currentFile, mediaType: currentMediaType, previewUrl: currentFilePreview };
        setMessageList(prev => [...prev, newMessage]);
        setCurrentMessageText('');
        setCurrentFile(null);
        setCurrentMediaType(null);
        setCurrentFilePreview(null);
    };
    
    const handleRemoveMessageFromList = (indexToRemove: number) => {
        setMessageList(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleSaveFiction = async () => {
        if (!selectedProfileId) { setStatusMessage({ type: 'error', text: 'Lütfen gönderici bir profil seçin.' }); return; }
        if (messageList.length === 0) { setStatusMessage({ type: 'error', text: 'Lütfen en az bir mesaj ekleyin.' }); return; }
        if (!scheduleDateTime) { setStatusMessage({ type: 'error', text: 'Lütfen kurgu başlangıç tarihini ve saatini seçin.'}); return; }
        if (new Date(scheduleDateTime) < new Date()) { setStatusMessage({type: 'error', text: 'Başlangıç zamanı geçmiş bir tarih olamaz.'}); return; }

        setIsLoading(true);
        setStatusMessage({ type: 'info', text: 'Kurgu kaydediliyor...' });

        try {
            const uploadPromises = messageList.map(msg => {
                if (msg.file) {
                    const storageRef = ref(storage, `fiction_attachments/${Date.now()}_${msg.file.name}`);
                    return uploadBytes(storageRef, msg.file).then(snapshot => getDownloadURL(snapshot.ref));
                }
                return Promise.resolve(null);
            });
            const uploadedUrls = await Promise.all(uploadPromises);

            const messagesForDb = messageList.map((msg, index) => ({
                textTemplate: msg.text,
                attachedMediaUrl: uploadedUrls[index],
                attachedMediaType: msg.mediaType
            }));

            // ##### DEĞİŞİKLİK BURADA: senderProfilePhotoUrl eklendi #####
            const fictionData = {
                senderProfileId: selectedProfileId,
                senderProfileName: selectedProfile?.name || 'Bilinmeyen',
                senderProfilePhotoUrl: selectedProfile?.photoUrl || "", // BU SATIR EKLENDİ
                targetFilters: { gender: targetGender, city: targetCity, dateRange: targetDateRange },
                messages: messagesForDb,
                schedule: {
                    startTime: Timestamp.fromDate(new Date(scheduleDateTime)),
                    intervalMinutes: Number(messageInterval)
                },
                createdAt: Timestamp.now(),
                status: 'depoda'
            };

            await addDoc(collection(db, 'fictions'), fictionData);
            setStatusMessage({ type: 'success', text: `Kurgu başarıyla depoya eklendi.` });
            handleReset();

        } catch (error) {
            console.error("Kurgu kaydedilirken HATA:", error);
            setStatusMessage({ type: 'error', text: 'Kurgu kaydedilemedi.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#1E1E2F] text-white">
            <div className="max-w-5xl mx-auto space-y-8">
                <div>
                    <h1 className="text-2xl font-bold mb-4">Yeni Kurgu Ekle</h1>
                    <div className="bg-[#2D2D42] p-4 rounded-lg flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-24 h-24 rounded-lg bg-purple-600 flex-shrink-0 flex items-center justify-center overflow-hidden">
                            {selectedProfile?.photoUrl ? ( <Image src={selectedProfile.photoUrl} alt={selectedProfile.name || 'Profil'} width={96} height={96} className="object-cover w-full h-full" /> ) : ( <User className="w-12 h-12 text-white" /> )}
                        </div>
                        <div className="flex-grow w-full">
                            <h2 className="font-bold text-lg text-white text-center sm:text-left">{selectedProfile ? `${selectedProfile.name}` : "Gönderen Seçilmedi"}</h2>
                            <p className="text-sm text-gray-400 text-center sm:text-left">{selectedProfile ? `ID: ${selectedProfile.id}` : "Lütfen bir gönderici profil seçin."}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-[#2D2D42] p-6 rounded-lg space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <SelectInput label="Gönderici Profil" value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)} options={profiles.map(p => ({ value: p.id, label: p.name }))} placeholder="Gönderici Seçin..." />
                        <DateTimeInput label="Başlangıç Zamanı" value={scheduleDateTime} onChange={e => setScheduleDateTime(e.target.value)} />
                        <NumberInput label="Mesaj Aralığı (Dakika)" value={messageInterval} onChange={e => setMessageInterval(e.target.value)} placeholder="Örn: 5" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <SelectInput label="Hedef Cinsiyet" value={targetGender} onChange={e => setTargetGender(e.target.value)} options={[{ value: 'Tümü', label: 'Tümü' }, { value: 'Erkek', label: 'Erkek' }, { value: 'Kadın', label: 'Kadın' }]} placeholder=''/>
                        <SelectInput label="Hedef Şehir" value={targetCity} onChange={e => setTargetCity(e.target.value)} options={[{ value: 'Tümü', label: 'Tüm İller' }, ...turkiyeIlleri.map(il => ({ value: il, label: il }))]} placeholder=''/>
                        <SelectInput label="Hedef Tarih Aralığı" value={targetDateRange} onChange={e => setTargetDateRange(e.target.value)} options={[{ value: 'Tümü', label: 'Tüm Zamanlar' }, { value: '24saat', label: 'Son 24 Saat' }, { value: '7gun', label: 'Son 7 Gün' }, { value: '1ay', label: 'Son 1 Ay' }, { value: '3ay', label: 'Son 3 Ay' }, { value: '6ay', label: 'Son 6 Ay' }]} placeholder=''/>
                    </div>
                    
                    <div className="p-4 border border-gray-700 rounded-lg space-y-4 bg-[#1E1E2F]">
                        <h3 className="font-semibold text-lg">Mesaj Oluşturucu</h3>
                        <TextAreaInput label="Mesaj Metni" value={currentMessageText} onChange={e => setCurrentMessageText(e.target.value)} placeholder="Mesajınızı buraya yazın..." tags={[ {name: 'isim', value: '{isim}'}, {name: 'şehir', value: '{sehir}'}, {name: 'şehirde', value: '{sehirde}'}, {name: 'şehrin', value: '{sehrin}'}, {name: 'resim', value: '{resim}'} ]} onTagClick={handleTagClick}/>
                        <div {...getRootProps()} className={`p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600 hover:border-gray-500'}`}>
                            <input {...getInputProps()} />
                            <div className="flex items-center justify-center gap-3"><UploadCloud className="w-6 h-6 text-gray-500" /><p className="text-sm text-gray-400">Medya Yükle (Resim, Video, Ses)</p></div>
                        </div>
                        {currentFile && (
                            <div className="flex items-center justify-between p-2 bg-gray-700 rounded-md">
                                <div className="flex items-center gap-2">
                                    {currentMediaType === 'image' && <Image src={currentFilePreview!} alt="Önizleme" width={40} height={40} className="rounded object-cover"/>}
                                    {currentMediaType === 'video' && <Video className="w-10 h-10 text-purple-400"/>}
                                    {currentMediaType === 'voice' && <Mic className="w-10 h-10 text-purple-400"/>}
                                    <span className="text-sm text-gray-300">{currentFile.name}</span>
                                </div>
                                <button onClick={() => { setCurrentFile(null); setCurrentMediaType(null); setCurrentFilePreview(null); }} className="p-1 rounded-full hover:bg-gray-600"><X className="w-4 h-4" /></button>
                            </div>
                        )}
                        <button onClick={handleAddMessageToList} className="w-full flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                            <Plus className="w-5 h-5" /> Mesajı Pakete Ekle
                        </button>
                    </div>

                    {messageList.length > 0 && (
                        <div className="p-4 border border-gray-700 rounded-lg space-y-3">
                             <h3 className="font-semibold text-lg">Kurgu Paketi ({messageList.length} Mesaj)</h3>
                             {messageList.map((msg, index) => (
                                <div key={index} className="bg-[#1E1E2F] p-3 rounded-md flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <span className="font-bold text-purple-400 mt-1">{index + 1}.</span>
                                        <div className="flex-1">
                                            {msg.text && <p className="text-gray-300 whitespace-pre-wrap">"{msg.text}"</p>}
                                            {msg.file && (
                                                <div className="mt-2 flex items-center gap-2 bg-gray-700/50 p-1 rounded w-fit">
                                                    {msg.mediaType === 'image' && <Image src={msg.previewUrl!} alt="Ek" width={32} height={32} className="rounded object-cover"/>}
                                                    {msg.mediaType === 'video' && <Video className="w-8 h-8 text-purple-400"/>}
                                                    {msg.mediaType === 'voice' && <Mic className="w-8 h-8 text-purple-400"/>}
                                                    <span className="text-xs text-gray-400">{msg.file.name}</span>
                                                </div>
                                            )}
                                            {!msg.text && msg.file && <p className="text-gray-500 italic">[Sadece Medya]</p>}
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveMessageFromList(index)} className="p-1 text-gray-500 hover:text-red-500 flex-shrink-0"><Trash2 className="w-4 h-4"/></button>
                                </div>
                             ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-4">
                    {statusMessage.text && ( <p className={`text-sm ${statusMessage.type === 'error' ? 'text-red-400' : statusMessage.type === 'success' ? 'text-green-400' : 'text-gray-400'}`}>{statusMessage.text}</p> )}
                    <button onClick={handleReset} disabled={isLoading} className="flex items-center gap-2 px-6 py-2 border border-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50"><RefreshCw className="w-4 h-4" /> Sıfırla</button>
                    <button onClick={handleSaveFiction} disabled={isLoading} className="flex items-center gap-2 px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait">
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-4 h-4" />} Kurguyu Depoya Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
}