'use client';


import { useState, useEffect } from 'react';
import { db, functions, storage } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, collectionGroup, query, where, Timestamp, orderBy, getDocs } from 'firebase/firestore'; // Gerekli importlar eklendi
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/components/AuthProvider';
import { AnimatePresence, motion } from 'framer-motion';
import { UserPlus, ShieldCheck, Trash2, Pencil, X, Loader2, Key, Mail, User, Info, CheckSquare, Square, BarChart2 } from 'lucide-react'; // BarChart2 ikonu eklendi
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'; // Grafik için gerekli 

// İzinlerin listesi
const ALL_PERMISSIONS = [
    { id: 'viewTekliMesaj', name: 'Tekli Mesaj Paneli' },
    { id: 'viewOnayPaneli', name: 'Onay Paneli' },
    { id: 'viewKurgu', name: 'Kurgu Sistemi' },
    { id: 'viewMesajlar', name: 'Mesajlar' },
    { id: 'viewProfiller', name: 'Profilleri Yönet' },
    { id: 'viewKullanicilar', name: 'Kullanıcıları Görüntüle' },
    { id: 'viewAdminYonetimi', name: 'Admin Yönetimi' },
];

interface Moderator {
    id: string;
    uid: string;
    name: string;
    email: string;
    permissions: { [key: string]: boolean };
    photoUrl?: string; // photoUrl opsiyonel olabilir
}

// YENİ/DÜZENLEME MODAL'I (Yeniden Yazıldı)
const ModeratorModal = ({ 
    isOpen, 
    onClose, 
    onSave, 
    initialData, 
    isLoading 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: (data: any, file?: File | null) => void; // onSave artık dosyayı da alıyor
    initialData?: Moderator | null; 
    isLoading: boolean;
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [permissions, setPermissions] = useState<{ [key: string]: boolean }>({});
    const [previewUrl, setPreviewUrl] = useState<string | null>(null); // Sadece önizleme için
    const isEditMode = !!initialData;

    useEffect(() => {
        if (isOpen) {
            setName(initialData?.name || '');
            setEmail(initialData?.email || '');
            setPassword('');
            setPermissions(initialData?.permissions || {});
            setPreviewUrl(initialData?.photoUrl || null); // Mevcut fotoğrafı önizle
            setFile(null); // Modalı her açtığında dosyayı sıfırla
        }
    }, [isOpen, initialData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    const handleSave = () => {
        const dataToSave = {
            uid: initialData?.id,
            name,
            email,
            password,
            permissions,
        };
        // Kaydetme fonksiyonuna hem veriyi hem de dosyayı gönderiyoruz
        onSave(dataToSave, file); 
    };

    if (!isOpen) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[#2D2D42] w-full max-w-lg rounded-lg shadow-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 flex items-center justify-between border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white">{isEditMode ? 'Moderatör Düzenle' : 'Yeni Moderatör Ekle'}</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white"><X className="w-5 h-5"/></button>
                </header>
                <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                    <div className="relative">
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="İsim Soyisim" className="w-full bg-[#1E1E2F] p-2 pl-10 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500"/>
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><User className="w-5 h-5"/></span>
                    </div>
                     <div className="relative">
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-posta Adresi" disabled={isEditMode} className="w-full bg-[#1E1E2F] p-2 pl-10 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"/>
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail className="w-5 h-5"/></span>
                    </div>
                     <div className="relative">
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isEditMode ? 'Şifreyi değiştirmek için doldurun' : 'Şifre'} className="w-full bg-[#1E1E2F] p-2 pl-10 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500"/>
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Key className="w-5 h-5"/></span>
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-300">Profil Fotoğrafı</h3>
                        <div className="mt-2 flex items-center gap-x-3">
                            {previewUrl ? (
                                <img src={previewUrl} alt="Profil" className="h-16 w-16 rounded-full object-cover" />
                            ) : (
                                <User className="h-16 w-16 text-gray-500 bg-gray-700 p-3 rounded-full" />
                            )}
                            <button type="button" onClick={() => document.getElementById('file-upload')?.click()} className="rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-white/20">
                                Değiştir
                            </button>
                            <input id="file-upload" name="file-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                        </div>
                    </div>

                    <h3 className="text-sm font-semibold text-gray-300 mb-2">İzinler</h3>
                    <div className="grid grid-cols-2 gap-2 p-3 bg-[#1E1E2F] rounded-md">
                        {ALL_PERMISSIONS.map(perm => (
                            <label key={perm.id} className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-purple-900/50">
                                <input type="checkbox" checked={!!permissions[perm.id]} onChange={() => setPermissions(p => ({ ...p, [perm.id]: !p[perm.id] }))} className="hidden"/>
                                {permissions[perm.id] ? <CheckSquare className="w-5 h-5 text-purple-400"/> : <Square className="w-5 h-5 text-gray-600"/>}
                                <span className="text-sm">{perm.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
                
                <footer className="p-4 flex items-center justify-end border-t border-gray-700 bg-[#23243D]">
                    <button onClick={handleSave} disabled={isLoading} className="flex items-center gap-2 px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait">
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isEditMode ? <ShieldCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />)}
                        {isEditMode ? 'Güncelle' : 'Oluştur'}
                    </button>
                </footer>
            </motion.div>
        </motion.div>
    );
};

export default function AdminsPage() {
    const { user } = useAuth();
    const [moderators, setModerators] = useState<Moderator[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingModerator, setEditingModerator] = useState<Moderator | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // --- YENİ: Grafik verilerini ve yüklenme durumunu tutmak için state'ler ---
    const [statsData, setStatsData] = useState<{ name: string, mesajlar: number }[]>([]);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        // Moderatör listesini dinle (Bu kısım aynı kaldı)
        const unsubscribe = onSnapshot(collection(db, "admins"), (snapshot) => {
            const mods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Moderator));
            setModerators(mods);
            setLoading(false);
        });

        // --- YENİ: Haftalık istatistikleri çek ---
        const fetchWeeklyStats = async () => {
            setStatsLoading(true);
            const oneWeekAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const q = query(
                collectionGroup(db, 'chats'),
                where('timestamp', '>=', oneWeekAgo)
            );

            try {
                const querySnapshot = await getDocs(q);
                const messageCounts: { [key: string]: number } = {};

                querySnapshot.forEach(doc => {
                    const parentPath = doc.ref.parent.parent;
                    if (parentPath) {
                        const adminId = parentPath.id;
                        messageCounts[adminId] = (messageCounts[adminId] || 0) + 1;
                    }
                });

                // Moderatör isimlerini alıp grafik verisini formatla
                const adminDocs = await getDocs(collection(db, 'admins'));
                const adminIdToNameMap = new Map(adminDocs.docs.map(doc => [doc.id, doc.data().name]));

                const formattedData = Object.entries(messageCounts)
                    .map(([adminId, count]) => ({
                        name: adminIdToNameMap.get(adminId)?.split(' ')[0] || 'Bilinmeyen', // Sadece ilk ismi al
                        mesajlar: count,
                    }))
                    .sort((a, b) => b.mesajlar - a.mesajlar); // En çoktan en aza sırala
                
                setStatsData(formattedData);
            } catch (error) {
                console.error("Haftalık istatistikler çekilirken hata:", error);
            } finally {
                setStatsLoading(false);
            }
        };

        fetchWeeklyStats();
        return () => unsubscribe();
    }, []);


    // --- KAYDETME FONKSİYONU YENİDEN YAZILDI ---
    const handleSaveModerator = async (data: any, file: File | null) => {
        setIsSaving(true);
        try {
            if (data.uid) { // Düzenleme modu
                // 1. Fotoğraf yüklenmişse, önce onu yükle ve URL'sini al
                let photoUrl = editingModerator?.photoUrl; // Mevcut URL'yi koru
                if (file) {
                    const fileRef = ref(storage, `moderator_photos/${data.uid}.jpg`);
                    await uploadBytes(fileRef, file);
                    photoUrl = await getDownloadURL(fileRef);
                }

                // 2. İzinleri Cloud Function ile güncelle
                const updatePermissions = httpsCallable(functions, 'updateModeratorPermissions');
                await updatePermissions({ uid: data.uid, permissions: data.permissions });

                // 3. Firestore'daki admin belgesini doğrudan güncelle (isim ve fotoğraf için)
                const adminRef = doc(db, 'admins', data.uid);
                await updateDoc(adminRef, {
                    name: data.name,
                    photoUrl: photoUrl || '' // Eğer fotoğraf yoksa boş string ata
                });

            } else { // Ekleme modu (Fotoğraf yükleme burada desteklenmiyor, önce admin oluşmalı)
                if (file) {
                    alert("Yeni moderatör oluştururken fotoğraf yükleyemezsiniz. Lütfen önce moderatörü oluşturun, sonra düzenleyerek fotoğraf ekleyin.");
                    setIsSaving(false);
                    return;
                }
                const createMod = httpsCallable(functions, 'createModerator');
                await createMod({ name: data.name, email: data.email, password: data.password, permissions: data.permissions });
            }
            setIsModalOpen(false);
            setEditingModerator(null);
        } catch (err: any) {
            alert(`Hata: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteModerator = async (mod: Moderator) => {
        if (confirm(`${mod.name} adlı moderatörü silmek istediğinizden emin misiniz?`)) {
            try {
                const deleteMod = httpsCallable(functions, 'deleteModerator');
                await deleteMod({ uid: mod.id });
                alert("Moderatör başarıyla silindi.");
            } catch (err: any) {
                 alert(`Hata: ${err.message}`);
            }
        }
    };

    if (user && user.role !== 'superadmin') {
        // ... Yetkisiz erişim JSX'i ...
    }

        return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#1E1E2F] text-white">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold">Admin Yönetim Paneli</h1>
                    <button onClick={() => { setEditingModerator(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold">
                        <UserPlus className="w-5 h-5"/> Yeni Moderatör Ekle
                    </button>
                </div>
                
                {/* --- HAFTALIK PERFORMANS GRAFİĞİ BÖLÜMÜ --- */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <BarChart2 className="w-6 h-6 text-purple-400" />
                        <h2 className="text-xl font-bold">Haftalık Performans (Son 7 Gün)</h2>
                    </div>
                    <div className="bg-[#2D2D42] rounded-lg shadow-lg p-6 h-80">
                        {statsLoading ? (
                            <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-purple-400"/></div>
                        ) : statsData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={statsData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                                    <XAxis type="number" stroke="#9CA3AF" fontSize={12} allowDecimals={false} />
                                    <YAxis type="category" dataKey="name" stroke="#9CA3AF" fontSize={12} width={80} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
                                        contentStyle={{ backgroundColor: '#1E1E2F', border: '1px solid #4c1d95', borderRadius: '0.5rem' }}
                                        labelStyle={{ color: '#E5E7EB' }}
                                        formatter={(value: number, name: string, props: any) => [`${value} mesaj`, props.payload.name]}
                                    />
                                    <Bar dataKey="mesajlar" fill="#8b5cf6" barSize={20} radius={[0, 10, 10, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex justify-center items-center h-full text-gray-500">Son 7 günde hiç mesaj gönderilmemiş.</div>
                        )}
                    </div>
                </div>

                {/* --- MODERATÖR TABLOSU BÖLÜMÜ --- */}
                {loading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin"/></div> : (
                    <div className="bg-[#2D2D42] rounded-lg shadow-lg overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-[#1E1E2F]">
                                <tr>
                                    <th className="p-4 font-semibold">İsim</th>
                                    <th className="p-4 font-semibold">E-posta</th>
                                    <th className="p-4 font-semibold">İzinler</th>
                                    <th className="p-4 font-semibold text-right">Eylemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {moderators.map(mod => (
                                    <tr key={mod.id} className="border-t border-gray-700 hover:bg-gray-800/20">
                                        <td className="p-4 flex items-center gap-3">
                                            <img src={mod.photoUrl || '/default-avatar.png'} alt={mod.name} className="w-10 h-10 rounded-full object-cover" />
                                            <span>{mod.name}</span>
                                        </td>
                                        <td className="p-4 text-gray-400">{mod.email}</td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {mod.permissions && Object.keys(mod.permissions).filter(p => mod.permissions[p]).map(pId => {
                                                    const perm = ALL_PERMISSIONS.find(ap => ap.id === pId);
                                                    return perm ? <span key={pId} className="px-2 py-0.5 text-xs bg-purple-900/50 text-purple-300 rounded-full">{perm.name}</span> : null;
                                                })}
                                                {(!mod.permissions || Object.values(mod.permissions).every(v => !v)) && (
                                                     <span className="text-xs text-gray-500">Hiçbir yetkisi yok</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => { setEditingModerator(mod); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-white transition-colors"><Pencil className="w-4 h-4"/></button>
                                                <button onClick={() => handleDeleteModerator(mod)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <ModeratorModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onSave={(data: any, file: File | null) => handleSaveModerator(data, file)}
                        initialData={editingModerator}
                        isLoading={isSaving}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}