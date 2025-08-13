'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Volume2, Eye, Settings, ShieldX, Video, Music, Play, Pause, Volume1, VolumeX } from 'lucide-react';
import { useMusic } from '@/components/MusicProvider';
import { useSettings } from '@/context/SettingsContext';

// ToggleSwitch bileşeninin tanımını değiştiriyoruz
const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void; }) => (
    <button
        type="button"
        onClick={onChange} // Doğrudan onChange'i çağıracak
        className={`relative inline-flex items-center h-7 w-12 rounded-full transition-colors duration-300 ease-in-out ${checked ? 'bg-purple-600' : 'bg-gray-600'}`}
    >
        <motion.span 
            layout 
            transition={{ type: "spring", stiffness: 700, damping: 30 }}
            className={`inline-block w-5 h-5 bg-white rounded-full transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} 
        />
    </button>
);

const ToolCard = ({ icon, title, description, children }: { icon: React.ReactNode, title: string, description: string, children: React.ReactNode }) => (
    <div className="bg-[#2D2D42] rounded-lg p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <div className="text-purple-400">{icon}</div>
            <div>
                <h3 className="font-bold text-white">{title}</h3>
                <p className="text-sm text-gray-400 mt-1">{description}</p>
            </div>
        </div>
        <div className="w-full sm:w-auto flex justify-end">{children}</div>
    </div>
);

export default function ToolsPage() {
    const { settings, setBlurMedia, toggleReminder } = useSettings();
    const { isPlaying, togglePlayPause, isMuted, toggleMute, increaseVolume, decreaseVolume } = useMusic();    
    
    const [soundNotifications, setSoundNotifications] = useState(true);
    const [compactMode, setCompactMode] = useState(false);
    const [autoplayVideos, setAutoplayVideos] = useState(false);
    const [autoplayAudio, setAutoplayAudio] = useState(false);

    useEffect(() => {
        setSoundNotifications(localStorage.getItem('tool_soundNotifications') !== 'false');
        setCompactMode(localStorage.getItem('tool_compactMode') === 'true');
        setAutoplayVideos(localStorage.getItem('tool_autoplayVideos') === 'true');
        setAutoplayAudio(localStorage.getItem('tool_autoplayAudio') === 'true');
    }, []);

    useEffect(() => { localStorage.setItem('tool_soundNotifications', String(soundNotifications)); }, [soundNotifications]);
    useEffect(() => { localStorage.setItem('tool_compactMode', String(compactMode)); }, [compactMode]);
    useEffect(() => { localStorage.setItem('tool_autoplayVideos', String(autoplayVideos)); }, [autoplayVideos]);
    useEffect(() => { localStorage.setItem('tool_autoplayAudio', String(autoplayAudio)); }, [autoplayAudio]);
    
    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#1E1E2F] text-white">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <Settings className="w-8 h-8 text-purple-400" />
                    <h1 className="text-3xl font-bold">Araçlar ve Ayarlar</h1>
                </div>
                <div className="space-y-4">
                    <ToolCard icon={<Video className="w-6 h-6" />} title="Videoları Otomatik Oynat" description="Mesajlaşma ekranında gelen videolar otomatik olarak başlasın.">
                        <ToggleSwitch checked={autoplayVideos} onChange={() => setAutoplayVideos(!autoplayVideos)} />
                    </ToolCard>
                    <ToolCard icon={<Volume2 className="w-6 h-6" />} title="Ses Kayıtlarını Otomatik Oynat" description="Mesajlaşma ekranında gelen ses kayıtları otomatik olarak başlasın.">
                        <ToggleSwitch checked={autoplayAudio} onChange={() => setAutoplayAudio(!autoplayAudio)} />
                    </ToolCard>
                    <ToolCard icon={<ShieldX className="w-6 h-6" />} title="Medyaları Bulanık Göster" description="Sohbetteki resim ve videoları varsayılan olarak bulanık gösterir. Tıklayınca netleşir.">
                        <ToggleSwitch checked={settings.blurMedia} onChange={() => setBlurMedia(!settings.blurMedia)} />
                    </ToolCard>
                    <ToolCard icon={<Volume2 className="w-6 h-6" />} title="Yeni Mesaj Sesli Uyarısı" description="Bekleyen mesajlar listesine yeni bir sohbet düştüğünde sesli bildirim al.">
                        <ToggleSwitch checked={soundNotifications} onChange={() => setSoundNotifications(!soundNotifications)} />
                    </ToolCard>
                    <ToolCard icon={<Eye className="w-6 h-6" />} title="Kompakt Mesaj Görünümü" description="Mesajlar panelindeki sohbet listesini daha sıkışık ve küçük gösterir.">
                        <ToggleSwitch checked={compactMode} onChange={() => setCompactMode(!compactMode)} />
                    </ToolCard>

                    {/* --- HATIRLATICI KARTI --- */}
                    <ToolCard 
                        icon={<Clock className="w-6 h-6" />} 
                        title="Tekli Atma Hatırlatıcısı" 
                        description="Belirlenen aralıklarla otomatik olarak bildirim gönderir."
                    >
                        <ToggleSwitch checked={settings.isReminderEnabled} onChange={toggleReminder} />
                    </ToolCard>

                    {/* --- MÜZİK KARTI --- */}
                    <div className="bg-[#2D2D42] rounded-lg p-6 space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="text-purple-400"><Music className="w-6 h-6" /></div>
                            <div>
                                <h3 className="font-bold text-white">Arka Plan Müziği</h3>
                                <p className="text-sm text-gray-400">Panelde arka planda çalan müziği kontrol et.</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded-md">
                            <button onClick={togglePlayPause} className="p-3 bg-purple-600 rounded-md hover:bg-purple-700 transition-colors">
                                {isPlaying ? <Pause className="w-6 h-6"/> : <Play className="w-6 h-6"/>}
                            </button>
                            <div className="flex items-center gap-2">
                                <button onClick={decreaseVolume} className="p-2 rounded-full hover:bg-gray-600 transition-colors" title="Sesi Kıs">
                                    <Volume1 className="w-6 h-6 text-gray-300" />
                                </button>
                                <button onClick={toggleMute} className="p-2 rounded-full hover:bg-gray-600 transition-colors" title={isMuted ? "Sesi Aç" : "Sesi Kapat"}>
                                    {isMuted ? <VolumeX className="w-6 h-6 text-red-500"/> : <Volume2 className="w-6 h-6 text-gray-300"/>}
                                </button>
                                <button onClick={increaseVolume} className="p-2 rounded-full hover:bg-gray-600 transition-colors" title="Sesi Yükselt">
                                    <Volume2 className="w-6 h-6 text-gray-300" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}