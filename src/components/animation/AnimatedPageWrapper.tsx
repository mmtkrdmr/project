'use client';

import { motion } from 'framer-motion';

const pageVariants = {
  // Animasyonun başlangıç durumu (görünmez ve biraz aşağıda)
  initial: {
    opacity: 0,
    y: 20,
  },
  // Animasyonun aktif durumu (tamamen görünür ve orijinal pozisyonunda)
  in: {
    opacity: 1,
    y: 0,
  },
  // Animasyonun çıkış durumu (görünmez ve biraz yukarıda)
  out: {
    opacity: 0,
    y: -20,
  },
};

const pageTransition = {
  type: 'tween', // Yumuşak bir geçiş türü
  ease: 'anticipate', // Biraz bekleyip hızlanan bir easing efekti
  duration: 0.7, // Animasyon süresi
};

export default function AnimatedPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
}