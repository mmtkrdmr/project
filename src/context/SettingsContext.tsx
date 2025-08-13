"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Ayarlarımızın yapısı
interface AppSettings {
    blurMedia: boolean;
    isReminderEnabled: boolean; // Hatırlatıcı açık mı?
}

// Context'in yapabildikleri
interface SettingsContextType {
    settings: AppSettings;
    setBlurMedia: (value: boolean) => void;
    toggleReminder: () => void; // Sadece aç/kapat fonksiyonu
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<AppSettings>({
        blurMedia: true,
        isReminderEnabled: true,
    });

    useEffect(() => {
        const storedBlur = localStorage.getItem('settings-blurMedia');
        if (storedBlur) setSettings(p => ({ ...p, blurMedia: JSON.parse(storedBlur) }));
        
        const storedReminder = localStorage.getItem('settings-reminderEnabled');
        if (storedReminder) setSettings(p => ({ ...p, isReminderEnabled: JSON.parse(storedReminder) }));
    }, []);

    const setBlurMedia = (value: boolean) => {
        localStorage.setItem('settings-blurMedia', String(value));
        setSettings(p => ({ ...p, blurMedia: value }));
    };

    const toggleReminder = () => {
        setSettings(p => {
            const newValue = !p.isReminderEnabled;
            localStorage.setItem('settings-reminderEnabled', JSON.stringify(newValue));
            return { ...p, isReminderEnabled: newValue };
        });
    };

    return (
        <SettingsContext.Provider value={{ settings, setBlurMedia, toggleReminder }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) throw new Error('useSettings must be used within a SettingsProvider');
    return context;
};