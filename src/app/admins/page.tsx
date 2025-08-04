'use client';

import { useState, useEffect } from 'react';
import { db, functions } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/components/AuthProvider';
import { AnimatePresence, motion } from 'framer-motion';
import { UserPlus, ShieldCheck, Trash2, Pencil, X, Loader2, Key, Mail, User, Info, CheckSquare, Square } from 'lucide-react';

// İzinlerin listesi (Sidebar'daki menülere göre)
// Bu listeyi, sidebar'daki menülerinle eşleşecek şekilde düzenlemelisin.
// `id` kısmı, custom claims'de kullanacağın anahtar olacak.
const ALL_PERMISSIONS = [
    { id: 'viewTekliMesaj', name: 'Tekli Mesaj Paneli' },
    { id: 'viewOnayPaneli', name: 'Onay Paneli' },
    { id: 'viewKurgu', name: 'Kurgu Sistemi' },
    { id: 'viewMesajlar', name: 'Mesajlar' },
    { id: 'viewProfiller', name: 'Profilleri Yönet' },
    { id: 'viewKullanicilar', name: 'Kullanıcıları Görüntüle' },
    { id: 'viewAdminYonetimi', name: 'Admin Yönetimi' }, // Bir adminin başka adminleri yönetebilmesi için
];

interface Moderator {
    id: string; // Firestore doküman ID'si (aynı zamanda Auth UID'si)
    uid: string;
    name: string;
    email: string;
    permissions: { [key: string]: boolean };
}

// YENİ/DÜZENLEME MODAL'I
const ModeratorModal = ({ 
    isOpen, 
    onClose, 
    onSave, 
    initialData, 
    isLoading 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: (data: any) => void; 
    initialData?: Moderator | null; 
    isLoading: boolean;
}) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [permissions, setPermissions] = useState<{ [key: string]: boolean }>({});
    const isEditMode = !!initialData;

    useEffect(() => {
        if (isOpen) {
            setName(initialData?.name || '');
            setEmail(initialData?.email || '');
            setPassword('');
            const initialPerms = ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.id]: false }), {});
            setPermissions(initialData?.permissions || initialPerms);
        }
    }, [isOpen, initialData]);

    const handlePermissionChange = (permId: string) => {
        setPermissions(prev => ({ ...prev, [permId]: !prev[permId] }));
    };

    const handleSave = () => {
        const dataToSave = {
            uid: initialData?.id,
            name,
            email,
            password,
            permissions
        };
        onSave(dataToSave);
    };

    if (!isOpen) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[#2D2D42] w-full max-w-lg rounded-lg shadow-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 flex items-center justify-between border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white">{isEditMode ? 'Moderatör Düzenle' : 'Yeni Moderatör Ekle'}</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white"><X className="w-5 h-5"/></button>
                </header>
                <div className="p-6 space-y-4 overflow-y-auto">
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
                    <div>
                        <h3 className="text-sm font-semibold text-gray-300 mb-2">İzinler</h3>
                        <div className="grid grid-cols-2 gap-2 p-3 bg-[#1E1E2F] rounded-md">
                            {ALL_PERMISSIONS.map(perm => (
                                <label key={perm.id} className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-purple-900/50">
                                    <input type="checkbox" checked={!!permissions[perm.id]} onChange={() => handlePermissionChange(perm.id)} className="hidden"/>
                                    {permissions[perm.id] ? <CheckSquare className="w-5 h-5 text-purple-400"/> : <Square className="w-5 h-5 text-gray-600"/>}
                                    <span className="text-sm">{perm.name}</span>
                                </label>
                            ))}
                        </div>
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
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingModerator, setEditingModerator] = useState<Moderator | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Yetki kontrolü
    if (user && user.role !== 'superadmin') {
        return (
            <div className="p-4 md:p-8 h-full flex items-center justify-center text-center">
                <div>
                    <Info className="w-12 h-12 mx-auto text-red-500 mb-4"/>
                    <h1 className="text-2xl font-bold">Yetkisiz Erişim</h1>
                    <p className="text-gray-400 mt-2">Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
                </div>
            </div>
        );
    }
    
    useEffect(() => {
        // ##### DÜZELTME: `users` yerine `admins` koleksiyonunu dinliyoruz. #####
        const unsubscribe = onSnapshot(collection(db, "admins"), (snapshot) => {
            const mods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Moderator));
            setModerators(mods);
            setLoading(false);
        }, (err) => {
            setError("Moderatörler yüklenemedi.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSaveModerator = async (data: any) => {
        setIsSaving(true);
        try {
            if (data.uid) { // Düzenleme modu
                const updatePermissions = httpsCallable(functions, 'updateModeratorPermissions');
                await updatePermissions({ uid: data.uid, permissions: data.permissions });
                // Şifre güncelleme daha karmaşık, ayrı bir fonksiyon gerektirir.
                // Şimdilik sadece izin güncelleme aktif.
            } else { // Ekleme modu
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

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#1E1E2F] text-white">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Admin Yönetim Paneli</h1>
                    <button onClick={() => { setEditingModerator(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold">
                        <UserPlus className="w-5 h-5"/> Yeni Moderatör Ekle
                    </button>
                </div>
                
                {loading && <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin"/></div>}
                {!loading && (
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
                                    <tr key={mod.id} className="border-t border-gray-700">
                                        <td className="p-4">{mod.name}</td>
                                        <td className="p-4 text-gray-400">{mod.email}</td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {/* ##### HATA DÜZELTMESİ BURADA ##### */}
                                                {/* mod.permissions objesinin var olup olmadığını kontrol ediyoruz */}
                                                {mod.permissions && ALL_PERMISSIONS.filter(p => mod.permissions[p.id]).map(p => (
                                                    <span key={p.id} className="px-2 py-0.5 text-xs bg-purple-900/50 text-purple-300 rounded-full">{p.name}</span>
                                                ))}
                                                {/* Hiç izni yoksa veya permissions alanı hiç yoksa gösterilecek mesaj */}
                                                {(!mod.permissions || Object.values(mod.permissions).every(v => v === false)) && (
                                                     <span className="text-xs text-gray-500">Hiçbir yetkisi yok</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => { setEditingModerator(mod); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-white"><Pencil className="w-4 h-4"/></button>
                                                <button onClick={() => handleDeleteModerator(mod)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
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
                        onSave={handleSaveModerator}
                        initialData={editingModerator}
                        isLoading={isSaving}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}