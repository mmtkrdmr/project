'use client';

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // YENİ EKLEDİĞİMİZ STATE: Bileşenin tarayıcıda yüklendiğini anlamak için.
  const [isMounted, setIsMounted] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  // Bu useEffect SADECE bileşen tarayıcıya ilk kez yüklendiğinde çalışır.
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Firebase dinleyicisi
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Yönlendirme mantığı
  useEffect(() => {
    // Bileşen henüz tarayıcıda hazır değilse veya Firebase yükleniyorsa,
    // HİÇBİR YÖNLENDİRME YAPMA.
    if (!isMounted || loading) return;

    const isUserLoggedIn = !!user;
    const publicPages = ['/', '/login'];
    const isCurrentPagePublic = publicPages.includes(pathname);

    if (!isUserLoggedIn && !isCurrentPagePublic) {
      router.push('/login');
    }

    if (isUserLoggedIn && pathname === '/login') {
      router.push('/dashboard');
    }
  }, [user, loading, isMounted, pathname, router]);

  // EĞER BİLEŞEN HENÜZ TARAYICIDA MOUNT EDİLMEDİYSE VEYA YÜKLENİYORSA,
  // HER ZAMAN YÜKLEME EKRANINI GÖSTER. Bu, sunucu ile tarayıcının
  // aynı şeyi görmesini GARANTİLER.
  if (!isMounted || loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-indigo-900">
        <p className="text-white text-xl">Yükleniyor...</p>
      </div>
    );
  }

  // Yükleme bittiğinde ve bileşen mount edildiğinde çocukları göster.
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);