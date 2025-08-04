'use client';

import { useState, useEffect, useCallback } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useDropzone } from 'react-dropzone';
import { User, Pencil, Trash2, Save, X, UploadCloud, Loader2, Search, MapPin, ChevronDown, AlertTriangle } from 'lucide-react';
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

const medeniHalSecenekleri = ['Bekar', 'Evli'];

// Veri tipi
interface Profile {
    id: string;
    name: string;
    photoUrl?: string;
    otherPhotoUrls?: string[];
    city?: string;
    age?: number;
    description?: string;
    civil?: string;
}

// Bileşenler
const SelectInput = ({ label, name, value, onChange, options, placeholder }: { 
    label: string; 
    name: string;
    value: string; 
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; 
    options: string[];
    placeholder: string;
}) => (
    <div>
        <label className="text-xs text-gray-400">{label}*</label>
        <div className="relative mt-1">
            <select 
                name={name}
                value={value} 
                onChange={onChange}
                className="w-full bg-[#1E1E2F] p-2 rounded-md border border-gray-600 appearance-none focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px]"
            >
                <option value="" disabled>{placeholder}</option>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>
    </div>
);

function ProfileCard({ profile, onEdit, onDelete, onSave, onCancel, isEditing, formData, setFormData, newFiles, setNewFiles, isSaving }: {
    profile: Profile;
    onEdit: (profile: Profile) => void;
    onDelete: (profile: Profile) => void; // Değişiklik: Artık tüm profili alıyor
    onSave: (profileId: string) => void;
    onCancel: () => void;
    isEditing: boolean;
    formData: Partial<Profile>;
    setFormData: React.Dispatch<React.SetStateAction<Partial<Profile>>>;
    newFiles: File[];
    setNewFiles: React.Dispatch<React.SetStateAction<File[]>>;
    isSaving: boolean;
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
                    {profile.photoUrl ? <Image src={profile.photoUrl} alt={profile.name} width={80} height={80} className="object-cover w-full h-full" /> : <User className="w-10 h-10 text-white/50" />}
                </div>
                <div className="flex-grow w-full text-center sm:text-left">
                    <h2 className="font-bold text-lg text-white">{profile.name}{profile.age ? `, ${profile.age}` : ''}</h2>
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1 text-sm text-gray-400">
                        <MapPin className="w-4 h-4" /><span>{profile.city || 'Şehir Belirtilmemiş'}</span>
                    </div>
                </div>
                <div className="flex-shrink-0 flex gap-2">
                    <button onClick={() => isEditing ? onCancel() : onEdit(profile)} className="p-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">
                        {isEditing ? <X className="w-5 h-5"/> : <Pencil className="w-5 h-5"/>}
                    </button>
                    <button onClick={() => onDelete(profile)} className="p-2 bg-red-800 rounded-lg hover:bg-red-900 transition-colors"><Trash2 className="w-5 h-5"/></button>
                </div>
            </div>

            <AnimatePresence>
                {isEditing && (
                    <motion.div initial={{ height: 0, opacity: 0, marginTop: 0 }} animate={{ height: 'auto', opacity: 1, marginTop: '1rem' }} exit={{ height: 0, opacity: 0, marginTop: 0 }} className="overflow-hidden border-t border-gray-700/50">
                        <div className="pt-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="text-xs text-gray-400">İsim*</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full mt-1 bg-[#1E1E2F] p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500" /></div>
                                <div><label className="text-xs text-gray-400">Yaş (18-99)*</label><input type="text" name="age" value={formData.age || ''} onChange={handleInputChange} maxLength={2} className="w-full mt-1 bg-[#1E1E2F] p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500" /></div>
                                <SelectInput label="Şehir" name="city" value={formData.city || ""} onChange={handleInputChange} options={turkiyeIlleri} placeholder="Şehir Seçin..." />
                                <SelectInput label="Medeni Hal" name="civil" value={formData.civil || ""} onChange={handleInputChange} options={medeniHalSecenekleri} placeholder="Medeni Hal Seçin..." />
                            </div>
                            <div><label className="text-xs text-gray-400">Açıklama*</label><textarea name="description" value={formData.description || ''} onChange={handleInputChange} className="w-full mt-1 h-24 bg-[#1E1E2F] p-2 rounded-md border border-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500" /></div>
                            <div>
                                <label className="text-xs text-gray-400 mb-2 block">Fotoğraflar* (En az 1)</label>
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
                                <button onClick={() => onSave(profile.id)} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait">
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
export default function ProfilesPage() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Profile>>({});
    const [newFiles, setNewFiles] = useState<File[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'profiles'), 
            (snapshot) => {
                const profilesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile));
                setProfiles(profilesData);
                setIsLoading(false);
            }, 
            (error) => { console.error("Profil dinleme hatası:", error); setIsLoading(false); }
        );
        return () => unsubscribe();
    }, []);

    const handleSave = async (profileId: string) => {
        if (!formData.name || !formData.age || !formData.city || !formData.civil || !formData.description) {
            alert('Lütfen tüm yıldızlı (*) alanları doldurun.');
            return;
        }
        if (formData.age < 18 || formData.age > 99) {
            alert('Yaş 18 ile 99 arasında olmalıdır.');
            return;
        }
        const currentPhotoCount = (formData.photoUrl ? 1 : 0) + (formData.otherPhotoUrls?.length || 0) + newFiles.length;
        if (currentPhotoCount === 0) {
            alert('Lütfen en az bir fotoğraf ekleyin.');
            return;
        }
        setIsSaving(true);
        try {
            const dataToUpdate: { [key: string]: any } = {
                name: formData.name, age: Number(formData.age),
                city: formData.city, civil: formData.civil,
                description: formData.description,
            };

            const existingUrls = [formData.photoUrl, ...(formData.otherPhotoUrls || [])].filter(Boolean) as string[];
            const newUploadedUrls = await Promise.all(
                newFiles.map(async (file) => {
                    const storageRef = ref(storage, `profiles/${profileId}/${Date.now()}_${file.name}`);
                    await uploadBytes(storageRef, file);
                    return await getDownloadURL(storageRef);
                })
            );

            const allUrls = [...existingUrls, ...newUploadedUrls];
            dataToUpdate.photoUrl = allUrls.length > 0 ? allUrls[0] : "";
            dataToUpdate.otherPhotoUrls = allUrls.length > 1 ? allUrls.slice(1, 3) : [];

            await updateDoc(doc(db, 'profiles', profileId), dataToUpdate);
            setEditingProfileId(null);
        } catch (error) {
            console.error("Kaydetme hatası:", error);
            alert("Profil güncellenemedi.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const openDeleteModal = (profile: Profile) => {
        setProfileToDelete(profile);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!profileToDelete) return;
        try {
            await deleteDoc(doc(db, 'profiles', profileToDelete.id));
            setIsDeleteModalOpen(false);
            setProfileToDelete(null);
        } catch (error) {
            console.error("Silme hatası:", error);
            alert("Profil silinemedi.");
            setIsDeleteModalOpen(false);
            setProfileToDelete(null);
        }
    };
    
    const filteredProfiles = profiles.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#1E1E2F] text-white">
                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                        <h1 className="text-3xl font-bold">Profilleri Yönet</h1>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input type="text" placeholder="Profil ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#2D2D42] border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"/>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-16">Yükleniyor...</div>
                    ) : filteredProfiles.length > 0 ? (
                        <div className="space-y-4">
                            {filteredProfiles.map(profile => (
                                <ProfileCard
                                    key={profile.id}
                                    profile={profile}
                                    onEdit={(p) => { setEditingProfileId(p.id); setFormData(p); setNewFiles([]); }}
                                    onDelete={openDeleteModal}
                                    onSave={handleSave}
                                    onCancel={() => setEditingProfileId(null)}
                                    isEditing={editingProfileId === profile.id}
                                    formData={editingProfileId === profile.id ? formData : {}}
                                    setFormData={setFormData}
                                    newFiles={editingProfileId === profile.id ? newFiles : []}
                                    setNewFiles={setNewFiles}
                                    isSaving={isSaving}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-[#2D2D42] rounded-lg">
                            <p className="text-gray-400">{searchTerm ? "Arama sonucu bulunamadı." : "Gösterilecek profil bulunamadı."}</p>
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {isDeleteModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
                        onClick={() => setIsDeleteModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-[#2D2D42] rounded-lg p-6 w-full max-w-sm text-white shadow-xl border border-gray-700"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                                    <AlertTriangle className="w-8 h-8 text-red-500" />
                                </div>
                                <h2 className="text-xl font-bold mb-2">Profili Sil</h2>
                                <p className="text-gray-400 mb-6">
                                    <span className="font-semibold text-white">{profileToDelete?.name}</span> adlı profili kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                                </p>
                                <div className="flex justify-center gap-4 w-full">
                                    <button
                                        onClick={() => setIsDeleteModalOpen(false)}
                                        className="w-full rounded-md border border-gray-600 px-4 py-2 hover:bg-gray-700 transition-colors"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="w-full rounded-md bg-red-600 px-4 py-2 hover:bg-red-700 text-white transition-colors"
                                    >
                                        Evet, Sil
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}