'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";
import { MusicProvider } from "@/components/MusicProvider";
import { SettingsProvider, useSettings } from "@/context/SettingsContext";

// --- SÜREYİ BURADAN DEĞİŞTİREBİLİRSİNİZ (DAKİKA CİNSİNDEN) ---
const REMINDER_INTERVAL_MINUTES = 1; // Test için 1 dakikaya ayarlı

// Bu bileşen, hatırlatıcının tüm beyin fonksiyonlarını yönetecek
function ReminderSystem() {
    const { settings } = useSettings();
    const [isVisible, setIsVisible] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Bu useEffect, ana zamanlayıcıyı kurar
    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (!settings.isReminderEnabled) return;
        
        const milliseconds = REMINDER_INTERVAL_MINUTES * 60 * 1000;
        intervalRef.current = setInterval(() => {
            setIsVisible(true);
        }, milliseconds);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [settings.isReminderEnabled]);

    // --- YENİ EKLENEN BÖLÜM: Bildirimi 3 saniye sonra otomatik gizle ---
    useEffect(() => {
        // Eğer bildirim görünür değilse, hiçbir şey yapma
        if (!isVisible) return;

        // Bildirimi 3 saniye sonra gizleyecek bir zamanlayıcı ayarla
        const autoHideTimer = setTimeout(() => {
            setIsVisible(false);
        }, 5000); // 3000 milisaniye = 3 saniye

        // Temizlik fonksiyonu: Eğer kullanıcı 'X'e basarsa veya
        // bileşen ekrandan kaldırılırsa, bu zamanlayıcıyı iptal et.
        return () => clearTimeout(autoHideTimer);
        
    }, [isVisible]); // Bu kod sadece, bildirim görünür hale geldiğinde çalışır.


    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                layout initial={{ opacity: 0, y: 50, scale: 0.3 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.5 }}
                className="fixed bottom-6 right-6 z-50 bg-purple-600 text-white rounded-lg shadow-2xl p-4 w-full max-w-sm border border-purple-400"
            >
                <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5"><ShieldAlert className="w-6 h-6 text-white"/></div>
                    <div className="ml-3 w-0 flex-1">
                        <p className="text-base font-bold">Hatırlatma!</p>
                        <p className="mt-1 text-sm text-purple-100">Tekli mesaj atma zamanı geldi.</p>
                    </div>
                    <div className="ml-4 flex-shrink-0 flex">
                        <button onClick={() => setIsVisible(false)} className="inline-flex text-purple-100 hover:text-white"><X className="h-5 w-5" /></button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

function LayoutManager({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname.includes('/login');

  return (
    <>
      <AnimatePresence mode="wait">{children}</AnimatePresence>
      {!isLoginPage && <ReminderSystem />}
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode; }) {
  return (
    <html lang="tr">
      <body className="antialiased">
        <AuthProvider>
          <MusicProvider>
            <SettingsProvider>
              <LayoutManager>{children}</LayoutManager>
            </SettingsProvider>
          </MusicProvider>
        </AuthProvider>
      </body>
    </html>
  );
}