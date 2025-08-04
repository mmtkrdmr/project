// src/components/Header.tsx
'use client';
import { useAuth } from './AuthProvider';

export default function Header() {
  const { toggleSidebar } = useAuth();

  return (
    <header className="bg-gray-800 p-4 flex items-center">
      <button onClick={toggleSidebar} className="text-white hover:bg-gray-700 p-2 rounded-md">
        {/* Basit bir menü ikonu */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {/* Buraya başka başlık elemanları da gelebilir (örn: profil menüsü) */}
    </header>
  );
}