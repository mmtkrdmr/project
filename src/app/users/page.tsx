'use client';

import { useState, useEffect, useCallback } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useDropzone } from 'react-dropzone';
import { User, Pencil, Trash2, Save, X, UploadCloud, Loader2, Search, MapPin, Crown, Coins, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

// Sabit listeler
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

const cinsiyetSecenekleri = ['Erkek', 'Kadın'];

// Veri tipi
interface UserProfile {
    id: string; name: string; photoUrl?: string; otherPhotoUrls?: string[];
    city?: string; age?: number; description?: string; civil?: string;
    gender?: string; coins?: number; isPremium?: boolean;
}

// Bileşenler
const SelectInput = ({ label, name, value, onChange, options, placeholder }: { 
    label: string; name: string; value: string; 
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; 
    options: string[]; placeholder: string 
}) => (
    <div>
        <label className="text-xs text-gray-400">{label}</label>
        <div className="relative mt-1">
            <select name={name} value={value} onChange={onChange} className="w-full bg-[#1E1E2F] p-2 rounded-md border border-gray-600 appearance-none focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px]">
                <option value="" disabled>{placeholder}</option>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>
    </div>
);

const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void; }) => (
    <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${checked ? 'bg-purple-600' : 'bg-gray-600'}`}
    >
        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
);

function UserCard({ user, onEdit, onDelete, onSave, onCancel, isEditing, formData, setFormData, newFiles, setNewFiles, isSaving }: {
    user: UserProfile; onEdit: (user: UserProfile) => void; onDelete: (userId: string) => void;
    onSave: (userId: string) => void; onCancel: () => void; isEditing: boolean;
    formData: Partial<UserProfile>; setFormData: React.Dispatch<React.SetStateAction<Partial<UserProfile>>>;
    newFiles: File[]; setNewFiles: React.Dispatch<React.SetStateAction<File[]>>; isSaving: boolean;
}) {
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === "age") {
            const numericValue = value.replace(/[^0-9]/g, '').slice(0, 2);
            setFormData(prev => ({ ...prev, [name]: numericValue === '' ? undefined : Number(numericValue) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleRemoveExistingPhoto = (urlToRemove: string) => {
        setFormData(prev => {
            if (prev.photoUrl === urlToRemove) {
                const newOtherUrls = [...(prev.otherPhotoUrls || [])];
                const newMainUrl = newOtherUrls.shift();
                return { ...prev, photoUrl: newMainUrl, otherPhotoUrls: newOtherUrls };
            } else {
                return { ...prev, otherPhotoUrls: prev.otherPhotoUrls?.filter(url => url !== urlToRemove) };
            }
        });
    };
    
    const handleRemoveNewFile = (fileToRemove: File) => {
        setNewFiles(prev => prev.filter(file => file !== fileToRemove));
    };

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const currentPhotoCount = (formData.photoUrl ? 1 : 0) + (formData.otherPhotoUrls?.length || 0);
        const remainingSlots = 3 - currentPhotoCount - newFiles.length;
        if (remainingSlots <= 0) {
            alert("En fazla 3 fotoğraf yükleyebilirsiniz.");
            return;
        }
        const filesToUpload = acceptedFiles.slice(0, remainingSlots);
        setNewFiles(prev => [...prev, ...filesToUpload]);
    }, [formData, newFiles, setNewFiles]);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

    return (
        <div className="bg-[#2D2D42] rounded-lg p-4 transition-all duration-300">
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-purple-600 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {user.photoUrl ? <Image src={user.photoUrl} alt={user.name} width={80} height={80} className="object-cover w-full h-full" /> : <User className="w-10 h-10 text-white/50" />}
                </div>
                <div className="flex-grow w-full text-center sm:text-left">
                    <h2 className="font-bold text-lg text-white">{user.name}{user.age ? `, ${user.age}` : ''}</h2>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 mt-1 text-sm text-gray-400">
                        <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /><span>{user.city || 'Şehir Yok'}</span></div>
                        <div className="flex items-center gap-1.5"><Coins className="w-4 h-4 text-yellow-400"/><span>{user.coins || 0} Coin</span></div>
                        <div className="flex items-center gap-1.5"><Crown className={`w-4 h-4 ${user.isPremium ? 'text-yellow-400' : 'text-gray-500'}`}/><span>Premium: </span><span className={user.isPremium ? 'text-green-400 font-semibold' : 'text-red-400'}>{user.isPremium ? 'Var' : 'Yok'}</span></div>
                    </div>
                </div>
                <div className="flex-shrink-0 flex gap-2">
                    <button onClick={() => isEditing ? onCancel() : onEdit(user)} className="p-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">{isEditing ? <X className="w-5 h-5"/> : <Pencil className="w-5 h-5"/>}</button>
                    <button onClick={() => onDelete(user.id)} className="p-2 bg-red-800 rounded-lg hover:bg-red-900 transition-colors"><Trash2 className="w-5 h-5"/></button>
                </div>
            </div>

            <AnimatePresence>
                {isEditing && (
                    <motion.div initial={{ height: 0, opacity: 0, marginTop: 0 }} animate={{ height: 'auto', opacity: 1, marginTop: '1rem' }} exit={{ height: 0, opacity: 0, marginTop: 0 }} className="overflow-hidden border-t border-gray-700/50">
                        <div className="pt-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label className="text-xs text-gray-400">İsim</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full mt-1 bg-[#1E1E2F] p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px]" /></div>
                                <div><label className="text-xs text-gray-400">Yaş (18-99)</label><input type="text" name="age" value={formData.age || ''} onChange={handleInputChange} maxLength={2} className="w-full mt-1 bg-[#1E1E2F] p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px]" /></div>
                                <div><label className="text-xs text-gray-400">Coin</label><input type="number" name="coins" value={formData.coins || ''} onChange={handleInputChange} className="w-full mt-1 bg-[#1E1E2F] p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px]" /></div>
                                <SelectInput label="Şehir" name="city" value={formData.city || ""} onChange={handleInputChange} options={turkiyeIlleri} placeholder="Şehir Seçin..." />
                                <SelectInput label="Cinsiyet" name="gender" value={formData.gender || ""} onChange={handleInputChange} options={cinsiyetSecenekleri} placeholder="Cinsiyet Seçin..." />
                                <div>
                                    <label className="text-xs text-gray-400">Premium Üyelik</label>
                                    <div className="mt-1 h-[40px] flex items-center">
                                        <ToggleSwitch checked={!!formData.isPremium} onChange={(checked) => setFormData(p => ({...p, isPremium: checked}))} />
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs text-gray-400 mb-2 block">Fotoğraflar</label>
                                <div className="flex flex-wrap gap-2">
                                    {formData.photoUrl && (<div className="relative w-24 h-24 group"><Image src={formData.photoUrl} alt="Ana Fotoğraf" layout="fill" className="object-cover rounded-md" /><button onClick={() => handleRemoveExistingPhoto(formData.photoUrl!)} className="absolute top-0 right-0 p-1 bg-red-600/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4"/></button></div>)}
                                    {formData.otherPhotoUrls?.map(url => (<div key={url} className="relative w-24 h-24 group"><Image src={url} alt="Ek Fotoğraf" layout="fill" className="object-cover rounded-md" /><button onClick={() => handleRemoveExistingPhoto(url)} className="absolute top-0 right-0 p-1 bg-red-600/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4"/></button></div>))}
                                    {newFiles.map((file, index) => (<div key={index} className="relative w-24 h-24 group"><Image src={URL.createObjectURL(file)} alt="Yeni Fotoğraf" layout="fill" className="object-cover rounded-md" /><button onClick={() => handleRemoveNewFile(file)} className="absolute top-0 right-0 p-1 bg-red-600/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4"/></button></div>))}
                                </div>
                            </div>
                            <div {...getRootProps()} className={`mt-2 p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600 hover:border-gray-500'}`}>
                                <input {...getInputProps()} />
                                <div className="flex flex-col items-center"><UploadCloud className="w-8 h-8 text-gray-500 mb-2" /><p className="text-gray-400 text-sm">Yeni fotoğraf ekle</p><p className="text-xs text-gray-500 mt-1">En fazla 3 fotoğraf</p></div>
                            </div>
                            <div className="flex justify-end">
                                <button onClick={() => onSave(user.id)} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait">
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} Kaydet
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Ana Sayfa Bileşeni
export default function UsersPage() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<UserProfile>>({});
    const [newFiles, setNewFiles] = useState<File[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'users'), 
            (snapshot) => {
                const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
                setUsers(usersData);
                setIsLoading(false);
            }, 
            (error) => { console.error("Kullanıcı dinleme hatası:", error); setIsLoading(false); }
        );
        return () => unsubscribe();
    }, []);

    const handleSave = async (userId: string) => {
        if (!userId) return;
        if (formData.age && (formData.age < 18 || formData.age > 99)) {
            alert('Yaş 18 ile 99 arasında olmalıdır.');
            return;
        }
        setIsSaving(true);
        try {
            const dataToUpdate: { [key: string]: any } = {
                name: formData.name || "", age: Number(formData.age) || 0,
                city: formData.city || "", gender: formData.gender || "",
                coins: Number(formData.coins) || 0, isPremium: formData.isPremium || false,
                civil: formData.civil || "",
                description: formData.description || "",
            };

            const existingUrls = [formData.photoUrl, ...(formData.otherPhotoUrls || [])].filter(Boolean) as string[];
            const newUploadedUrls = await Promise.all(
                newFiles.map(async (file) => {
                    const storageRef = ref(storage, `users/${userId}/${Date.now()}_${file.name}`);
                    await uploadBytes(storageRef, file);
                    return await getDownloadURL(storageRef);
                })
            );

            const allUrls = [...existingUrls, ...newUploadedUrls];
            dataToUpdate.photoUrl = allUrls.length > 0 ? allUrls[0] : "";
            dataToUpdate.otherPhotoUrls = allUrls.length > 1 ? allUrls.slice(1, 3) : [];

            await updateDoc(doc(db, 'users', userId), dataToUpdate);
            setEditingUserId(null);
        } catch (error) {
            console.error("Kaydetme hatası:", error);
            alert("Kullanıcı güncellenemedi.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async (userId: string) => {
        if (!window.confirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?")) return;
        try {
            await deleteDoc(doc(db, 'users', userId));
        } catch (error) {
            console.error("Silme hatası:", error);
            alert("Kullanıcı silinemedi.");
        }
    };
    
    const filteredUsers = users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#1E1E2F] text-white">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                    <h1 className="text-3xl font-bold">Kullanıcıları Yönet</h1>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="text" placeholder="Kullanıcı ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#2D2D42] border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"/>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-16">Yükleniyor...</div>
                ) : filteredUsers.length > 0 ? (
                    <div className="space-y-4">
                        {filteredUsers.map(user => (
                            <UserCard
                                key={user.id} user={user}
                                onEdit={(u) => { setEditingUserId(u.id); setFormData(u); setNewFiles([]); }}
                                onDelete={handleDelete} onSave={handleSave} onCancel={() => setEditingUserId(null)}
                                isEditing={editingUserId === user.id}
                                formData={editingUserId === user.id ? formData : {}} setFormData={setFormData}
                                newFiles={editingUserId === user.id ? newFiles : []} setNewFiles={setNewFiles}
                                isSaving={isSaving}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-[#2D2D42] rounded-lg">
                        <p className="text-gray-400">{searchTerm ? "Arama sonucu bulunamadı." : "Gösterilecek kullanıcı bulunamadı."}</p>
                    </div>
                )}
            </div>
        </div>
    );
}