'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { 
    doc, 
    onSnapshot, 
    collection, 
    query, 
    where, 
    getDocs, 
    Timestamp, 
    collectionGroup, 
    orderBy 
} from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { Award, MessageSquare, Gift, BarChart2, Loader2, Star, Ticket, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import clsx from 'clsx';
import Image from 'next/image'; 

interface AdminProfile {
    name: string;
    photoURL?: string;
}

const allAchievements = [
    { id: 'messages_1k', title: "Sohbet Virtüözü", description: "Son 30 günde 1,000 mesaj hedefini tamamladın.", icon: <MessageSquare />, target: 1000, type: 'messages', reward: 100 },
    { id: 'messages_10k', title: "İletişim Efsanesi", description: "Son 30 günde 10,000 mesaj hedefini tamamladın.", icon: <MessageSquare />, target: 10000, type: 'messages', reward: 1000 },
    { id: 'messages_100k', title: "Jado Tanrısı", description: "Son 30 günde 100,000 mesaj hedefini tamamladın. Saygılar.", icon: <MessageSquare />, target: 100000, type: 'messages', reward: 10000 },
    { id: 'first_gift', title: "Cömert Kalp", description: "Bir kullanıcının hediye göndermesini sağladın.", icon: <Gift />, target: 1, type: 'gifts', reward: 0 },
    { id: 'top_moderator_weekly', title: "Haftanın Yıldızı", description: "Haftanın en çok yanıt veren moderatörü oldun. Şşşş kimseye söyleme 😉", icon: <Star />, target: 1, type: 'special', reward: 500 },
];

const ProgressBar = ({ progress }: { progress: number }) => (
    <div className="w-full bg-gray-700/50 rounded-full h-2.5 mt-2">
        <motion.div
            className="bg-gradient-to-r from-purple-500 to-violet-500 h-2.5 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
        />
    </div>
);

export default function AchievementsPage() {
    const { user } = useAuth();
    const [myAchievements, setMyAchievements] = useState<string[]>([]);
    const [stats, setStats] = useState({ messageCount: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [chartData, setChartData] = useState<{ name: string, mesajlar: number }[]>([]);
    const [chartLoading, setChartLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
    const [isStarOfWeek, setIsStarOfWeek] = useState(false);
    const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);

    // ##### KULLANICI BİLGİLERİNİ VE BAŞARIMLARI ÇEKEN YENİLENMİŞ BÖLÜM #####
    useEffect(() => {
        // Gerekli kullanıcı bilgileri hazır olana kadar bekle
        if (!user || !user.firebaseUser?.uid) {
            setIsLoading(false);
            return;
        }

        const { uid, displayName, photoURL: authPhotoURL } = user.firebaseUser;

        const adminRef = doc(db, 'admins', uid);
        
        const unsubscribe = onSnapshot(adminRef, async (docSnap) => {
            // Varsayılan değerleri Auth kullanıcısından al
            let finalName = displayName || "İsimsiz Kullanıcı";
            let finalPhoto = authPhotoURL || null;

            if (docSnap.exists()) {
                const firestoreData = docSnap.data();
                
                // Firestore'da özel bir isim veya fotoğraf varsa, varsayılanın üzerine yaz
                if (firestoreData.name) finalName = firestoreData.name;
                if (firestoreData.photoURL) finalPhoto = firestoreData.photoURL;

                setMyAchievements(firestoreData.achievements || []);

                // Aylık mesaj sayısını hesapla
                const oneMonthAgo = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const chatsCol = collection(db, 'admins', uid, 'chats');
                const q = query(chatsCol, where('timestamp', '>=', oneMonthAgo));
                const monthlyChatsSnapshot = await getDocs(q);
                setStats({ messageCount: monthlyChatsSnapshot.size });
            }

            // En son, birleştirilmiş ve doğru olan profili state'e ata
            setAdminProfile({ name: finalName, photoURL: finalPhoto || undefined });
            setIsLoading(false);
        }, (error) => {
            console.error("Firestore dinlenirken hata oluştu:", error);
            setIsLoading(false);
        });

        // Haftanın yıldızı kontrolü (Bu fonksiyonun mantığı doğru çalışıyor)
        const checkStarOfWeek = async () => {
            try {
                const oneWeekAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const q = query(collectionGroup(db, 'chats'), where('timestamp', '>=', oneWeekAgo), orderBy('timestamp', 'desc'));
                const querySnapshot = await getDocs(q);
                const messageCounts: { [key: string]: number } = {};
                querySnapshot.forEach(doc => {
                    const parentPath = doc.ref.parent.parent;
                    if(parentPath){ 
                        const adminId = parentPath.id; 
                        messageCounts[adminId] = (messageCounts[adminId] || 0) + 1; 
                    }
                });
                const topModerator = Object.entries(messageCounts).sort((a, b) => b[1] - a[1])[0];
                setIsStarOfWeek(topModerator && topModerator[0] === uid);
            } catch (error) { 
                console.error("Haftanın Yıldızı kontrolü sırasında hata:", error); 
            }
        };

        checkStarOfWeek();
        return () => unsubscribe();
    }, [user]);

    // Grafik verisi çekme (Bu bölümde değişiklik yok)
    useEffect(() => {
        if (!user?.firebaseUser?.uid) return;
        const adminId = user.firebaseUser.uid;
        const fetchData = async () => {
            setChartLoading(true);
            const now = new Date();
            let startDate = new Date();
            const initialData: { [key: string]: { name: string, mesajlar: number } } = {};
            if (timeRange === 'day') {
                startDate.setHours(0, 0, 0, 0);
                for (let i = 0; i < 24; i++) {
                    initialData[i.toString().padStart(2, '0') + ':00'] = { name: i.toString().padStart(2, '0') + ':00', mesajlar: 0 };
                }
            } else {
                const dayCount = timeRange === 'week' ? 7 : 30;
                startDate.setDate(now.getDate() - (dayCount - 1));
                startDate.setHours(0, 0, 0, 0);
                for (let i = 0; i < dayCount; i++) {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);
                    initialData[date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })] = { name: date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }), mesajlar: 0 };
                }
            }
            const startTimestamp = Timestamp.fromDate(startDate);
            const adminChatsRef = collection(db, 'admins', adminId, 'chats');
            const q = query(adminChatsRef, where("timestamp", ">=", startTimestamp));
            try {
                const querySnapshot = await getDocs(q);
                querySnapshot.forEach(doc => {
                    const message = doc.data();
                    if (!message.timestamp?.toDate) return;
                    const date = message.timestamp.toDate();
                    const key = (timeRange === 'day') 
                        ? date.getHours().toString().padStart(2, '0') + ':00'
                        : date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
                    if (initialData[key]) initialData[key].mesajlar++;
                });
                setChartData(Object.values(initialData));
            } catch (error) {
                console.error("Grafik verisi çekilirken hata:", error);
            } finally {
                setChartLoading(false);
            }
        };
        fetchData();
    }, [user, timeRange]);

    const displayAchievements = useMemo(() => {
        return allAchievements.map((ach) => {
            const unlockedByMonthlyGoal = ach.type === 'messages' && stats.messageCount >= ach.target;
            const unlocked = myAchievements.includes(ach.id) || unlockedByMonthlyGoal || (ach.id === 'top_moderator_weekly' && isStarOfWeek);
            let progress = 0;
            if (!unlocked && ach.type === 'messages') {
                progress = Math.min((stats.messageCount / ach.target) * 100, 100);
            }
            return { ...ach, unlocked, progress };
        });
    }, [myAchievements, stats.messageCount, isStarOfWeek]);

    if (isLoading) { return <div className="flex h-full w-full items-center justify-center bg-[#1E1E2F]"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>; }
    if (!user) { return <div className="flex h-full w-full items-center justify-center bg-[#1E1E2F] text-white"><p>Bu sayfayı görüntülemek için giriş yapmalısınız.</p></div>; }

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#1E1E2F] text-white">
            <div className="max-w-5xl mx-auto">
                {adminProfile && (
                    <div className="mb-12">
                        <div className="flex items-center gap-3 mb-4">
                           <UserIcon className="w-8 h-8 text-purple-400" />
                           <h1 className="text-3xl font-bold">Profilim</h1>
                        </div>
                        <div className="bg-gradient-to-r from-[#2D2D42] to-[#252537] rounded-xl p-5 flex flex-col sm:flex-row items-center gap-6 shadow-lg border border-white/10">
                            <Image 
                                src={adminProfile.photoURL || '/default-avatar.png'}
                                alt={adminProfile.name || 'Admin'}
                                width={88}
                                height={88}
                                className="w-20 h-20 sm:w-22 sm:h-22 flex-shrink-0 rounded-full object-cover border-4 border-purple-600 ring-2 ring-purple-500/50"
                            />
                            <div className="flex-1 text-center sm:text-left">
                                <h2 className="text-2xl font-bold text-white">{adminProfile.name}</h2>
                                <p className="text-purple-300 font-medium">Başarı yolculuğuna devam et!</p>
                            </div>
                            <div className="w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 sm:pl-6 border-t sm:border-t-0 sm:border-l border-white/10 flex items-center justify-center gap-2">
                                <MessageSquare className="w-8 h-8 text-gray-400"/>
                                <div >
                                    <p className="text-sm text-gray-400">Son 30 Gün</p>
                                    <p className="text-2xl font-bold text-white">{stats.messageCount.toLocaleString('tr-TR')} Mesaj</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="mb-12">
                    <div className="flex items-center gap-3 mb-4"><BarChart2 className="w-8 h-8 text-purple-400" /><h1 className="text-3xl font-bold">Mesaj Aktivitem</h1></div>
                    <div className="bg-[#2D2D42] rounded-xl p-4 sm:p-6">
                        <div className="flex justify-end space-x-2 mb-4">
                            {['day', 'week', 'month'].map(range => ( <button key={range} onClick={() => setTimeRange(range as any)} className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${timeRange === range ? 'bg-purple-600 text-white' : 'bg-[#3B3B50] text-gray-300 hover:bg-[#4A4A65]'}`}>{range === 'day' ? '24 Saat' : range === 'week' ? '7 Gün' : '30 Gün'}</button>))}
                        </div>
                        <div className="w-full h-72">
                            {chartLoading ? ( <div className="flex items-center justify-center h-full w-full"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div> ) 
                            : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                        <defs><linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} />
                                        <YAxis stroke="#9CA3AF" fontSize={11} allowDecimals={false} />
                                        <Tooltip contentStyle={{ backgroundColor: '#2D2D42', borderColor: '#8b5cf6', borderRadius: '0.75rem' }} labelStyle={{ color: '#E5E7EB' }} formatter={(value: number) => [`${value} mesaj`, null]} />
                                        <Area type="monotone" dataKey="mesajlar" stroke="#a78bfa" fill="url(#gradient)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-3 mb-8"><Award className="w-8 h-8 text-purple-400" /><h1 className="text-3xl font-bold">Başarımlar ve Ödüller</h1></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayAchievements.map((ach, index) => (
                            <motion.div key={ach.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: index * 0.05 }}
                                className={clsx( 'rounded-xl p-6 flex flex-col text-center transition-all duration-300', { 'bg-[#2D2D42] border-2 border-purple-500 shadow-lg shadow-purple-900/50': ach.unlocked, 'bg-gray-800/50 border border-gray-700': !ach.unlocked })}>
                                <div className={clsx('w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors mx-auto', { 'bg-purple-600 text-white': ach.unlocked, 'bg-gray-700 text-gray-400': !ach.unlocked })}> <div className="transform scale-150">{ach.icon}</div> </div>
                                <h3 className={clsx('font-bold text-lg', { 'text-white': ach.unlocked, 'text-gray-300': !ach.unlocked })}>{ach.title}</h3>
                                <p className={clsx('text-sm mt-1 flex-grow min-h-[40px]', { 'text-gray-300': ach.unlocked, 'text-gray-400': !ach.unlocked })}>{ach.description}</p>
                                <div className="w-full mt-auto pt-4 space-y-3">
                                    {ach.reward > 0 && ( <div className={clsx( 'inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg transition-all', { 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg': ach.unlocked, 'bg-gray-700/60 text-gray-300': !ach.unlocked })}> <Ticket className="w-5 h-5" /> <span>{ach.reward.toLocaleString('tr-TR')} ₺ Ödül</span> </div> )}
                                    {!ach.unlocked && ach.type === 'messages' && ach.target > 0 && ( <div className='w-full'> <p className="text-xs text-purple-300 mb-1 text-left">{stats.messageCount.toLocaleString('tr-TR')} / {ach.target.toLocaleString('tr-TR')}</p> <ProgressBar progress={ach.progress} /> </div> )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}