'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

const StatCard = ({ title, value, change }: any) => (
  <motion.div
    whileHover={{ scale: 1.05 }}
    className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-xl shadow-xl transition-all duration-300 hover:shadow-2xl"
  >
    <p className="text-xs text-gray-400">{title}</p>
    <div className="mt-2 flex items-baseline gap-4">
      <h3 className="text-4xl font-bold text-white">{value}</h3>
      <span className="text-sm font-semibold text-green-400">{change}</span>
    </div>
  </motion.div>
);

export default function VisualSection() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="relative h-full w-full overflow-hidden"
    >
      {/* Arka plan ışık efekti */}
      <motion.div
        className="absolute z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-purple-700/30 blur-3xl animate-pulse"
      />

      {/* Karakter görseli */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
        className="absolute inset-0 flex items-center justify-center z-10"
      >
        <Image
          src="/character.png"
          alt="Panel Karakteri"
          width={320}
          height={300}
          className="object-contain drop-shadow-[0_0_40px_rgba(147,51,234,0.4)]"
          priority
        />
      </motion.div>

      {/* KAZANÇ KARTI - SOL ALT */}
      <motion.div
        initial={{ opacity: 0, x: -60, y: 60, rotate: -10 }}
        animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
        transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
        className="absolute bottom-16 left-10 z-20"
      >
        <StatCard title="Kazanç (Geçen Hafta)" value="624k" change="+8.24%" />
      </motion.div>

      {/* HESAP KARTI - SAĞ ÜST */}
      <motion.div
        initial={{ opacity: 0, x: 60, y: -60, rotate: 10 }}
        animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
        transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
        className="absolute top-16 right-10 z-20"
      >
        <StatCard title="Hesap (Bugün)" value="124k" change="+12.6%" />
      </motion.div>
    </motion.div>
  );
}
