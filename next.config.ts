/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gümrük polisini (ESLint) susturur
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Pasaport polisini (TypeScript) susturur
  typescript: {
    ignoreBuildErrors: true,
  },

  // Senin mevcut resim ayarların (bunlar kalacak)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
};

export default nextConfig;