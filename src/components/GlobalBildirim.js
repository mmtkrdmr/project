'use client';

import { useSettings } from "@/context/SettingsContext";
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';

export default function GlobalBildirim() {
    // Merkezi context'imizden bildirim durumunu ve gizleme fonksiyonunu alıyoruz
    const { settings, hideTimerNotification } = useSettings();

    return (
        <AnimatePresence>
            {/* Eğer bildirim görünürse (isTimerNotificationVisible true ise) bu kutuyu göster */}
            {settings.isTimerNotificationVisible && (
                 <motion.div
                    layout
                    initial={{ opacity: 0, y: 50, scale: 0.3 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.5 }}
                    className="fixed bottom-6 right-6 z-50 bg-purple-600 text-white rounded-lg shadow-2xl p-4 w-full max-w-sm border border-purple-400"
                >
                    <div className="flex items-start">
                        <div className="flex-shrink-0 pt-0.5"><ShieldAlert className="w-6 h-6 text-white"/></div>
                        <div className="ml-3 w-0 flex-1">
                            <p className="text-base font-bold">Hatırlatma!</p>
                            <p className="mt-1 text-sm text-purple-100">Tekli mesaj atma zamanı geldi.</p>
                        </div>
                        <div className="ml-4 flex-shrink-0 flex">
                            {/* Kapatma (X) butonuna basıldığında merkezi fonksiyondan bildirimi gizle */}
                            <button onClick={hideTimerNotification} className="inline-flex text-purple-100 hover:text-white"><X className="h-5 w-5" /></button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}