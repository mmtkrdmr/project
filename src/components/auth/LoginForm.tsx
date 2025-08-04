'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError('E-posta veya şifre hatalı. Lütfen tekrar deneyin.');
      setLoading(false);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.div variants={itemVariants} className="flex flex-col items-center">
        <div className="mb-4 rounded-full bg-purple-400/20 p-3">
          <Image
            src="/logo.png"
            alt="Logo"
            width={80}
            height={80}
            className="object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold text-white">Jado'ya Hoşgeldin 💕</h1>
        <p className="mt-2 text-gray-400">Lütfen bilgilerini girerek devam et.</p>
      </motion.div>

      <form onSubmit={handleLogin} className="mt-8 w-full space-y-6">
        <motion.div variants={itemVariants}>
          <label className="text-sm font-medium text-gray-300" htmlFor="email">Mail</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border-2 border-gray-600 bg-transparent p-3 pl-10 text-white placeholder-gray-500 transition-colors focus:border-purple-400 focus:outline-none"
              placeholder="ornek@jadopanel.com"
            />
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <label className="text-sm font-medium text-gray-300" htmlFor="password">Şifre</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border-2 border-gray-600 bg-transparent p-3 pl-10 text-white placeholder-gray-500 transition-colors focus:border-purple-400 focus:outline-none"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>
        </motion.div>

        {error && (
          <motion.p variants={itemVariants} className="text-sm text-center text-red-400">{error}</motion.p>
        )}

        <motion.div variants={itemVariants}>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#5B2E91] px-4 py-3 font-semibold text-white transition-all hover:bg-[#4b2579] disabled:cursor-not-allowed disabled:bg-gray-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Giriş Yapılıyor...
              </>
            ) : (
              'Giriş'
            )}
          </button>
        </motion.div>
      </form>
    </motion.div>
  );
}
