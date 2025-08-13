'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider'; // Sizin AuthProvider'ınızı kullanıyoruz
import { ShieldCheck, Trash2, Zap } from 'lucide-react';
import { getFunctions, httpsCallable } from "firebase/functions";

// Buton ve Kart bileşenleri aynı kalıyor
const ActionButton = ({ onClick, children, loading, variant = 'danger' }: any) => (
    <button 
        onClick={onClick}
        disabled={loading}
        className={`px-4 py-2 font-semibold text-white rounded-lg transition-colors flex items-center justify-center gap-2
            ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'}
            disabled:bg-gray-500 disabled:cursor-wait`}
    >
        {loading ? <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"></div> : children}
    </button>
);

const ToolCard = ({ icon, title, description, children }: any) => (
    <div className="bg-[#2D2D42] rounded-lg p-6 flex items-start gap-4">
        <div className="text-red-400 mt-1">{icon}</div>
        <div className="flex-1">
            <h3 className="font-bold text-white text-lg">{title}</h3>
            <p className="text-sm text-gray-400 mt-1 mb-4">{description}</p>
            {children}
        </div>
    </div>
);


export default function SuperAdminPage() {
    // --- DEĞİŞİKLİK BURADA: Artık sadece 'user' objesini alıyoruz ---
    const { user } = useAuth(); 
    const [loadingTask, setLoadingTask] = useState<string | null>(null);
    const [taskResult, setTaskResult] = useState<{message: string; type: 'success' | 'error'} | null>(null);

    // Fonksiyonu çağıran ana fonksiyon (aynı kaldı)
    const handleRunTask = async (taskName: string) => {
        const confirmationMessage = "Bu işlem geri alınamaz ve veritabanını kalıcı olarak etkiler. Devam etmek istediğinize emin misiniz?";
        if (!window.confirm(confirmationMessage)) return;

        setLoadingTask(taskName);
        setTaskResult(null);
        try {
            const functions = getFunctions();
            const performAdminCleanup = httpsCallable(functions, 'performAdminCleanup');
            const result: any = await performAdminCleanup({ task: taskName });
            setTaskResult({ message: result.data.message, type: 'success' });
        } catch (error: any) {
            console.error("Cloud function çağrılırken hata:", error);
            setTaskResult({ message: `Hata: ${error.message}`, type: 'error' });
        } finally {
            setLoadingTask(null);
        }
    };

    // --- DEĞİŞİKLİK BURADA: Yetki kontrolünü 'user.role' üzerinden yapıyoruz ---
    // Eğer kullanıcı bilgisi henüz yüklenmediyse bekle
    if (!user) {
        return <div className="p-8 text-center">Yetki kontrol ediliyor...</div>;
    }
    // Eğer kullanıcının rolü 'superadmin' değilse, sayfayı gösterme
    if (user.role !== 'superadmin') {
        return (
            <div className="p-8 text-center text-red-500">
                <h1 className="text-2xl font-bold">Erişim Engellendi</h1>
                <p>Bu sayfayı görüntüleme yetkiniz yok.</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 h-full bg-[#1E1E2F] text-white">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <ShieldCheck className="w-8 h-8 text-red-400" />
                    <h1 className="text-3xl font-bold">Super Admin Bakım Paneli</h1>
                </div>

                {taskResult && (
                    <div className={`${taskResult.type === 'success' ? 'bg-green-800/50 border-green-600 text-green-200' : 'bg-red-800/50 border-red-600 text-red-200'} p-4 rounded-lg mb-6 text-center`}>
                        {taskResult.message}
                    </div>
                )}
                
                <div className="space-y-6">
                    <ToolCard
                        icon={<Trash2 />}
                        title="Eski Mesajları Temizle"
                        description="Veritabanı performansını artırmak için 30 günden eski tüm mesajları kalıcı olarak siler. Bu işlem, hem genel 'messages' hem de admin 'chats' koleksiyonlarını etkiler."
                    >
                        <ActionButton onClick={() => handleRunTask('deleteOldMessages')} loading={loadingTask === 'deleteOldMessages'}>
                            <Trash2 className="w-4 h-4" />
                            <span>Eski Mesajları Sil</span>
                        </ActionButton>
                    </ToolCard>

                    <ToolCard
                        icon={<Zap />}
                        title="Sıkışmış Bekleyen Sohbetleri Temizle"
                        description="Sistemde 24 saatten daha uzun süre 'bekleyen' olarak kalmış ve kilitlenmiş sohbetleri temizler. Bu, moderatörlerin yeni mesajlara erişemediği durumlar için bir acil durum aracıdır."
                    >
                        <ActionButton onClick={() => handleRunTask('clearStuckPendingChats')} loading={loadingTask === 'clearStuckPendingChats'} variant="warning">
                            <Zap className="w-4 h-4" />
                            <span>Sıkışmış Sohbetleri Temizle</span>
                        </ActionButton>
                    </ToolCard>
                </div>
            </div>
        </div>
    );
}