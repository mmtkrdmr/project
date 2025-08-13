'use client';

import { onIdTokenChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import { Loader2 } from 'lucide-react';

// ##### YENİ VE DAHA DETAYLI KULLANICI TİPİ #####
// Artık sadece Firebase kullanıcısını değil, rollerini ve izinlerini de tutuyoruz.
interface AppUser {
  firebaseUser: FirebaseUser;
  customClaims?: { [key: string]: any };
  role: 'moderator' | 'superadmin' | null;
  permissions: { [key: string]: boolean };
}

interface AuthContextType {
  user: AppUser | null; // Tip AppUser olarak güncellendi
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarOpen');
    if (savedState !== null) {
      setIsSidebarOpen(JSON.parse(savedState));
    }
    setIsMounted(true);
  }, []);

  // ##### OTURUM KONTROL MANTIĞI TAMAMEN YENİLENDİ #####
  useEffect(() => {
    // onAuthStateChanged yerine onIdTokenChanged kullanıyoruz.
    // Çünkü custom claims (roller, izinler) sadece ID token'ı içinde gelir.
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // 1. Kullanıcının ID Token'ını al ve içindeki özel yetkileri (claims) çöz.
          const idTokenResult = await firebaseUser.getIdTokenResult(true); // 'true' force refresh yapar
          const claims = idTokenResult.claims;

          // 2. Eğer kullanıcı bir role sahipse (moderator veya superadmin), devam et.
          if (claims.role) {
            setUser({
              firebaseUser: firebaseUser,
              role: claims.role as 'moderator' | 'superadmin',
              // İzinleri de claims'den alıyoruz.
              permissions: {
                  viewTekliMesaj: !!claims.viewTekliMesaj,
                  viewOnayPaneli: !!claims.viewOnayPaneli,
                  viewKurgu: !!claims.viewKurgu,
                  viewMesajlar: !!claims.viewMesajlar,
                  viewProfiller: !!claims.viewProfiller,
                  viewKullanicilar: !!claims.viewKullanicilar,
                  viewAdminYonetimi: !!claims.viewAdminYonetimi,
              }
            });
          } else {
            // 3. Eğer hiçbir rolü yoksa, bu bir admin değildir. Oturumu kapat.
            await signOut(auth);
            setUser(null);
          }
        } catch (error) {
           console.error("Token alınırken veya rol kontrolü yapılırken hata:", error);
           await signOut(auth);
           setUser(null);
        }
      } else {
        // Oturum kapatılmış veya hiç açılmamış.
        setUser(null);
      }
      setAuthChecked(true); // Oturum kontrolü bitti.
    });

    return () => unsubscribe();
  }, []);

  // Yönlendirme mantığı aynı kalır.
  useEffect(() => {
    if (!authChecked) return;
    const isLoginPage = pathname === '/';
    if (!user && !isLoginPage) router.push('/');
    if (user && isLoginPage) router.push('/messages'); // Veya ana sayfa neyse orası
  }, [user, authChecked, pathname, router]);

  const toggleSidebar = () => {
    setIsSidebarOpen(prevState => {
      const newState = !prevState;
      localStorage.setItem('sidebarOpen', JSON.stringify(newState));
      return newState;
    });
  };
  
  if (!isMounted) {
    return null;
  }
  
  const isLoginPage = pathname === '/';

  if (isLoginPage) {
    if(!authChecked) return <div className="flex h-screen w-full items-center justify-center bg-[#1E1E2F]"><Loader2 className="w-8 h-8 animate-spin text-white"/></div>;
    return <>{children}</>;
  }

  // Auth kontrolü bitmediyse tüm panelde yükleme ekranı göster.
  if (!authChecked) {
    return <div className="flex h-screen w-full items-center justify-center bg-[#1E1E2F]"><Loader2 className="w-8 h-8 animate-spin text-white"/></div>;
  }
  
  return (
    <AuthContext.Provider value={{ user, isSidebarOpen, toggleSidebar }}>
      <div className="flex h-screen w-full overflow-hidden bg-[#1E202A]">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </div>
    </AuthContext.Provider>
  );
}