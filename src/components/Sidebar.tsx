'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import {
    HiOutlineChatBubbleOvalLeftEllipsis,
    HiOutlineCog6Tooth,
    HiOutlineArrowLeftOnRectangle,
    HiBars3,
    HiArrowLeft,
    HiOutlineChatBubbleLeft,
    HiOutlineCheckBadge,
    HiChevronDown,
    HiOutlinePhoto,
    HiOutlinePencil,
    HiOutlineShieldCheck,
    HiOutlineUserGroup, 
    HiOutlineUserPlus,
    HiOutlineUsers,
    HiOutlineClock, // Yeni ikon
    HiOutlinePlusCircle, // Yeni ikon
    HiOutlineArchiveBox, // Yeni ikon
    HiOutlineEye // Yeni ikon
} from "react-icons/hi2";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import Image from "next/image";
import { useState, useEffect } from "react";

// ##### DEĞİŞİKLİK BURADA: Yeni Kurgu menüsü eklendi #####
const menuItems = [
  { name: 'Admin Yönetimi', path: '/admins', icon: HiOutlineShieldCheck, permissionId: 'viewAdminYonetimi' },

  { name: 'Tekli Mesaj', path: '/tekli-mesaj', icon: HiOutlineChatBubbleLeft, permissionId: 'viewTekliMesaj' },
  { 
    name: 'Onay Paneli', 
    icon: HiOutlineCheckBadge, 
    permissionId: 'viewOnayPaneli',
    subItems: [
        { name: 'Resim Onay', path: '/approval/images', icon: HiOutlinePhoto },
        { name: 'Hakkında Onay', path: '/approval/about', icon: HiOutlinePencil }
    ]
  },
  // YENİ EKLENEN BÖLÜM BAŞLANGICI
  {
    name: 'Kurgu',
    icon: HiOutlineClock,
    permissionId: 'viewKurgu',
    subItems: [
        { name: 'Kurgu Ekle', path: '/fiction/add-fiction', icon: HiOutlinePlusCircle },
        { name: 'Kurgu Depo', path: '/fiction/fiction-warehouse', icon: HiOutlineArchiveBox },
        { name: 'Kurgu Takip', path: '/fiction/follow-fiction', icon: HiOutlineEye }
    ]
  },
  // YENİ EKLENEN BÖLÜM SONU
  
  {
    name: 'Profiller',
    icon: HiOutlineUserGroup,
    permissionId: 'viewProfiller',
    subItems: [
        { name: 'Profilleri Yönet', path: '/profiles', icon: HiOutlinePencil },
        { name: 'Yeni Profil Ekle', path: '/profiles/add', icon: HiOutlineUserPlus }
    ]
  },
  { name: 'Kullanıcılar', path: '/users', icon: HiOutlineUsers, permissionId: 'viewKullanicilar' },

  { name: 'Mesajlar', path: '/messages', icon: HiOutlineChatBubbleOvalLeftEllipsis, permissionId: 'viewMesajlar' },
];

const bottomMenuItems = [
  { name: 'Ayarlar', path: '/settings', icon: HiOutlineCog6Tooth, permissionId: 'viewAyarlar' },
];

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar, user } = useAuth(); // AuthProvider'dan user'ı al
  const pathname = usePathname();
  const router = useRouter();
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);

  useEffect(() => {
    const activeParent = menuItems.find(item => item.subItems?.some(sub => pathname.startsWith(sub.path)));
    if (activeParent) {
      setOpenSubMenu(activeParent.name);
    }
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Çıkış yaparken hata oluştu:", error);
      alert("Çıkış yapılırken bir hata oluştu.");
    }
  };

  const renderItem = (item: any, index: number) => {
    const isParentActive = item.subItems?.some((sub: any) => pathname === sub.path) || false;
    const isDirectActive = item.path ? pathname === item.path : false;
    const isActive = isDirectActive || isParentActive;

    if (item.subItems) {
      const isOpen = openSubMenu === item.name;
      return (
        <div key={item.name}>
          <button
            onClick={() => setOpenSubMenu(isOpen ? null : item.name)}
            className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-all duration-300 ease-in-out ${
              isActive ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-lg' : 'hover:bg-white/10'
            } ${!isSidebarOpen && 'justify-center'}`}
          >
            <div className="flex items-center">
              <item.icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-400'} transition-colors`} />
              {isSidebarOpen && <span className="ml-3 whitespace-nowrap text-sm">{item.name}</span>}
            </div>
            {isSidebarOpen && (
              <HiChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            )}
          </button>
          <AnimatePresence>
            {isSidebarOpen && isOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-6 mt-2">
                <div className="flex flex-col gap-2 border-l-2 border-white/10 pl-4">
                    {item.subItems.map((subItem: any) => {
                        const isSubItemActive = pathname === subItem.path;
                        return (
                            <Link href={subItem.path} key={subItem.name} className={`px-3 py-2 rounded-md text-sm flex items-center gap-3 transition-colors ${isSubItemActive ? 'text-white font-semibold' : 'text-gray-400 hover:text-white'}`}>
                                <subItem.icon className="w-5 h-5"/>
                                {subItem.name}
                            </Link>
                        );
                    })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }
    
    const content = (
      <motion.div whileHover={{ scale: 1.05 }} className={`px-3 py-2.5 rounded-xl text-sm font-medium flex items-center transition-all duration-300 ease-in-out ${ isActive ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-lg' : 'hover:bg-white/10'} ${!isSidebarOpen && 'justify-center'}`}>
        <item.icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-400'} transition-colors`} />
        <span className={`ml-3 whitespace-nowrap text-sm ${!isSidebarOpen ? 'hidden' : ''}`}>{item.name}</span>
      </motion.div>
    );

    return (
      <Tooltip.Root key={item.name} delayDuration={200}>
        <Tooltip.Trigger asChild><Link href={item.path} title={item.name}>{content}</Link></Tooltip.Trigger>
        {!isSidebarOpen && ( <Tooltip.Portal><Tooltip.Content className="bg-black text-white px-2 py-1 rounded shadow-lg text-xs z-50">{item.name}<Tooltip.Arrow className="fill-black" /></Tooltip.Content></Tooltip.Portal>)}
      </Tooltip.Root>
    );
  };

   return (
    <>
      <Tooltip.Provider delayDuration={200}>
        <motion.aside initial={{ width: 80 }} animate={{ width: isSidebarOpen ? 260 : 80 }} transition={{ type: "spring", stiffness: 200, damping: 24 }} className="bg-[#1E1E2F] backdrop-blur-lg bg-opacity-80 text-gray-300 h-screen flex flex-col justify-between shadow-2xl px-4 py-6">
          <div>
            <div className={`flex items-center mb-10 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
              {isSidebarOpen && (<Link href="/" className="flex items-center gap-3"><Image src="/logo.png" alt="Logo" width={50} height={50} className="rounded-full" /><span className="text-2xl font-bold text-white">Jado</span></Link>)}
              <button onClick={toggleSidebar} className="p-2 rounded-md hover:bg-white/10 transition-all">{isSidebarOpen ? <HiArrowLeft className="w-6 h-6 text-white" /> : <HiBars3 className="w-6 h-6 text-white" />}</button>
            </div>
            
            {/* ##### DEĞİŞİKLİK BURADA BAŞLIYOR ##### */}
            <nav className="flex flex-col gap-3">
              {menuItems
                .filter(item => {
                    // Kural 1: Eğer kullanıcı süper admin ise, her şeyi göster.
                    if (user?.role === 'superadmin') {
                        return true;
                    }
                    // Kural 2: Eğer menü elemanının bir izne ihtiyacı yoksa (herkes görebilir), onu da göster.
                    if (!item.permissionId) {
                        return true;
                    }
                    // Kural 3: Eğer kullanıcının izinleri varsa VE bu menünün izni true ise göster.
                    return user?.permissions?.[item.permissionId] === true;
                })
                .map((item, index) => renderItem(item, index))
              }
            </nav>
            {/* ##### DEĞİŞİKLİK BURADA BİTİYOR ##### */}
          </div>
          <div className="border-t border-white/10 pt-4">
            <nav className="flex flex-col gap-3">
              {/* ##### AYNI FİLTRELEME AŞAĞIDAKİ MENÜ İÇİN DE YAPILIYOR ##### */}
              {bottomMenuItems
                .filter(item => {
                    if (user?.role === 'superadmin') return true;
                    if (!item.permissionId) return true;
                    return user?.permissions?.[item.permissionId] === true;
                })
                .map(item => renderItem(item, 0))
              }
              <button onClick={() => setIsSignOutModalOpen(true)} className={`px-3 py-2.5 rounded-xl text-sm font-medium flex items-center w-full hover:bg-white/10 transition-all ${!isSidebarOpen && 'justify-center'}`}>
                <HiOutlineArrowLeftOnRectangle className="w-6 h-6 text-gray-400" />
                {isSidebarOpen && <span className="ml-3 whitespace-nowrap">Çıkış Yap</span>}
              </button>
            </nav>
          </div>
        </motion.aside>
      </Tooltip.Provider>
      
      {/* Çıkış yapma modal'ında değişiklik yok */}
      {isSignOutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={() => setIsSignOutModalOpen(false)}>
          <div className="bg-[#1E1E2F] rounded-lg p-6 w-80 text-white shadow-lg" onClick={e => e.stopPropagation()}>
            <h2 className="mb-4 text-xl font-semibold">Çıkış yapmak istediğinizden emin misiniz?</h2>
            <div className="flex justify-end gap-4">
              <button onClick={() => setIsSignOutModalOpen(false)} className="rounded-md border border-gray-500 px-4 py-2 hover:bg-gray-700">Hayır</button>
              <button onClick={() => { handleSignOut(); setIsSignOutModalOpen(false); }} className="rounded-md bg-purple-700 px-4 py-2 hover:bg-purple-800 text-white">Evet</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}