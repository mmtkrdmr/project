'use client';

import { useState, useCallback } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, setDoc, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useDropzone } from 'react-dropzone';
import { Save, X, UploadCloud, Loader2, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

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
// YENİ: Cinsiyet için seçenekler
const cinsiyetSecenekleri = ['Erkek', 'Kadın'];

// YENİ: Profile arayüzüne 'gender' eklendi
interface Profile {
    name: string;
    photoUrl: string;
    otherPhotoUrls: string[];
    city: string;
    age: number;
    description: string;
    civil: string;
    gender: string; // YENİ ALAN
}

const SelectInput = ({ label, name, value, onChange, options, placeholder }: { 
    label: string, 
    name: string,
    value: string, 
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, 
    options: string[],
    placeholder: string
}) => (
    <div>
        <label className="text-sm text-gray-400">{label}*</label>
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

export default function AddProfilePage() {
    const router = useRouter();
    // YENİ: Başlangıç state'ine 'gender' eklendi
    const [formData, setFormData] = useState<Partial<Profile>>({
        name: '', age: undefined, city: '', civil: '', description: '', gender: ''
    });
    const [files, setFiles] = useState<File[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === "age") {
            const numericValue = value.replace(/[^0-9]/g, '').slice(0, 2);
            setFormData(prev => ({ ...prev, [name]: numericValue === '' ? undefined : Number(numericValue) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleReset = () => {
        setFormData({ name: '', age: undefined, city: '', civil: '', description: '', gender: '' });
        setFiles([]);
        setStatusMessage({ type: 'success', text: 'Profil başarıyla oluşturuldu! Yeni bir profil ekleyebilirsiniz.' });
    };

    const handleRemoveFile = (fileToRemove: File) => {
        setFiles(prev => prev.filter(file => file !== fileToRemove));
    };

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const remainingSlots = 3 - files.length;
        if (remainingSlots <= 0) {
            alert("En fazla 3 fotoğraf yükleyebilirsiniz.");
            return;
        }
        const filesToUpload = acceptedFiles.slice(0, remainingSlots);
        setFiles(prev => [...prev, ...filesToUpload]);
    }, [files]);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

    const handleSave = async () => {
        // YENİ: 'gender' zorunlu alan kontrolüne eklendi
        if (!formData.name || !formData.age || !formData.city || !formData.civil || !formData.description || !formData.gender) {
            setStatusMessage({ type: 'error', text: 'Lütfen yıldızlı (*) tüm alanları doldurun.' });
            return;
        }
        if (formData.age < 18 || formData.age > 99) {
            setStatusMessage({ type: 'error', text: 'Yaş 18 ile 99 arasında olmalıdır.' });
            return;
        }
        if (files.length === 0) {
            setStatusMessage({ type: 'error', text: 'Lütfen en az bir fotoğraf ekleyin.' });
            return;
        }

        setIsSaving(true);
        setStatusMessage({ type: 'info', text: 'Profil oluşturuluyor...' });

        try {
            const tempDocRef = doc(collection(db, 'profiles'));
            const profileId = `profil_${tempDocRef.id}`;
            const newProfileRef = doc(db, 'profiles', profileId);
            
            // YENİ: 'gender' veritabanına kaydedilecek verilere eklendi
            const profileData = {
                name: formData.name,
                age: formData.age,
                city: formData.city,
                civil: formData.civil,
                description: formData.description,
                gender: formData.gender, // YENİ ALAN
            };
            
            await setDoc(newProfileRef, profileData);

            const uploadedUrls = await Promise.all(
                files.map(async (file) => {
                    const storageRef = ref(storage, `profiles/${profileId}/${Date.now()}_${file.name}`);
                    await uploadBytes(storageRef, file);
                    return await getDownloadURL(storageRef);
                })
            );

            await updateDoc(newProfileRef, {
                photoUrl: uploadedUrls[0] || "",
                otherPhotoUrls: uploadedUrls.slice(1, 3),
            });
            
            handleReset();

        } catch (error) {
            console.error("Profil oluşturulurken hata:", error);
            setStatusMessage({ type: 'error', text: 'Profil oluşturulurken bir hata oluştu.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#1E1E2F] text-white">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Yeni Profil Ekle</h1>
                
                <div className="bg-[#2D2D42] rounded-lg p-6 space-y-6">
                    {/* YENİ: Grid yapısı 3 sütunlu olacak şekilde düzenlendi */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="text-sm text-gray-400">İsim*</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full mt-1 bg-[#1E1E2F] p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px]" /></div>
                        <div><label className="text-sm text-gray-400">Yaş (18-99)*</label><input type="text" name="age" value={formData.age || ''} onChange={handleInputChange} maxLength={2} className="w-full mt-1 bg-[#1E1E2F] p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 h-[40px]" /></div>
                        
                        {/* YENİ: Cinsiyet seçimi eklendi */}
                        <SelectInput label="Cinsiyet" name="gender" value={formData.gender || ""} onChange={handleInputChange} options={cinsiyetSecenekleri} placeholder="Cinsiyet Seçin..." />
                        
                        {/* Bu iki alan grid'in tam genişliğini kaplasın diye md:col-span-1.5 gibi bir yapı kullanılabilir veya alt alta durabilirler. Şimdilik bu daha temiz. */}
                        <div className="md:col-span-1"><SelectInput label="Şehir" name="city" value={formData.city || ""} onChange={handleInputChange} options={turkiyeIlleri} placeholder="Şehir Seçin..." /></div>
                        <div className="md:col-span-2"><SelectInput label="Medeni Hal" name="civil" value={formData.civil || ""} onChange={handleInputChange} options={medeniHalSecenekleri} placeholder="Medeni Hal Seçin..." /></div>
                    </div>
                    <div><label className="text-sm text-gray-400">Hakkında*</label><textarea name="description" value={formData.description || ''} onChange={handleInputChange} className="w-full mt-1 h-24 bg-[#1E1E2F] p-2 rounded-md border border-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500" /></div>
                    
                    <div>
                        <label className="text-sm text-gray-400 mb-2 block">Fotoğraflar* (En az 1, en fazla 3)</label>
                        <div className="flex flex-wrap gap-2 min-h-[6rem] p-2 border border-dashed border-gray-600 rounded-md">
                            {files.map((file, index) => (
                                <div key={index} className="relative w-24 h-24 group">
                                    <Image src={URL.createObjectURL(file)} alt="Yeni Fotoğraf" layout="fill" className="object-cover rounded-md" />
                                    <button onClick={() => handleRemoveFile(file)} className="absolute top-0 right-0 p-1 bg-red-600/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X className="w-4 h-4"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div {...getRootProps()} className={`mt-2 p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600 hover:border-gray-500'}`}>
                        <input {...getInputProps()} />
                        <div className="flex flex-col items-center"><UploadCloud className="w-10 h-10 text-gray-500 mb-2" /><p className="text-gray-400">Fotoğraf eklemek için buraya tıklayın veya sürükleyin</p></div>
                    </div>
                    
                    <div className="flex items-center justify-end gap-4 pt-4">
                        {statusMessage.text && (
                            <p className={`text-sm ${statusMessage.type === 'error' ? 'text-red-400' : statusMessage.type === 'success' ? 'text-green-400' : 'text-gray-400'}`}>
                                {statusMessage.text}
                            </p>
                        )}
                        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait">
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} Profili Oluştur
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}