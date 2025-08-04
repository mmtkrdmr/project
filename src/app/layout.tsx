'use client'; // AnimatePresence client-side olduğu için bu direktif gerekebilir.

import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";
import { AnimatePresence } from "framer-motion"; // Framer Motion'dan import ediyoruz

/* Metadata sunucu tarafında kaldığı için bu şekilde bırakılabilir.
export const metadata: Metadata = {
  title: "Jado Panel",
};
*/

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">
        <AuthProvider>
          {/* 
            mode="wait" prop'u, bir sayfanın çıkış animasyonu bitmeden
            yeni sayfanın giriş animasyonunu başlatmamasını sağlar.
            Bu, animasyonların üst üste binmesini engeller.
          */}
          <AnimatePresence mode="wait">
            {children}
          </AnimatePresence>
        </AuthProvider>
      </body>
    </html>
  );
}