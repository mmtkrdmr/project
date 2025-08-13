'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

// BURAYA ARKAPLANDA SÜREKLİ ÇALMASINI İSTEDİĞİN MÜZİĞİN LİNKİNİ YAPIŞTIR
const MUSIC_URL = 'https://firebasestorage.googleapis.com/v0/b/jado-7e0e7.firebasestorage.app/o/raw_assets%2Faudio.mp3?alt=media&token=ca96401a-f9a1-40a9-984b-a69bcb2b8ab2'; // Örnek link, bunu değiştir.

interface MusicContextType {
    isPlaying: boolean;
    isMuted: boolean;
    volume: number;
    togglePlayPause: () => void;
    toggleMute: () => void;
    increaseVolume: () => void;
    decreaseVolume: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider = ({ children }: { children: ReactNode }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1); // 0 (sessiz) ile 1 (en yüksek) arası

    useEffect(() => {
        // Sadece bir kere ses nesnesi oluşturuyoruz
        const audio = new Audio(MUSIC_URL);
        audio.loop = true; // Müziğin sürekli dönmesini sağlar
        audioRef.current = audio;

        // Ses durumu değiştiğinde kendi state'lerimizi güncelliyoruz
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleVolumeChange = () => {
            if (audioRef.current) {
                setVolume(audioRef.current.volume);
                setIsMuted(audioRef.current.muted);
            }
        };

        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('volumechange', handleVolumeChange);

        // Bileşen kaldırıldığında müziği durdur ve temizle
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.removeEventListener('play', handlePlay);
                audioRef.current.removeEventListener('pause', handlePause);
                audioRef.current.removeEventListener('volumechange', handleVolumeChange);
            }
        };
    }, []); // Boş dizi sayesinde bu effect sadece bir kere çalışır

    const togglePlayPause = () => {
        if (isPlaying) {
            audioRef.current?.pause();
        } else {
            audioRef.current?.play().catch(error => console.error("Müzik oynatma hatası:", error));
        }
    };

    const toggleMute = () => {
        if (audioRef.current) {
            audioRef.current.muted = !audioRef.current.muted;
        }
    };
    
    const increaseVolume = () => {
        if (audioRef.current) {
            audioRef.current.volume = Math.min(1, audioRef.current.volume + 0.1);
        }
    };

    const decreaseVolume = () => {
        if (audioRef.current) {
            audioRef.current.volume = Math.max(0, audioRef.current.volume - 0.1);
        }
    };

    const value = { isPlaying, isMuted, volume, togglePlayPause, toggleMute, increaseVolume, decreaseVolume };

    return (
        <MusicContext.Provider value={value}>
            {children}
        </MusicContext.Provider>
    );
};

export const useMusic = () => {
    const context = useContext(MusicContext);
    if (context === undefined) {
        throw new Error('useMusic must be used within a MusicProvider');
    }
    return context;
};