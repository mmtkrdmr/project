import VisualSection from '@/components/auth/VisualSection';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    // Ana arka plan rengimiz: indigo-900
    <div className="flex min-h-screen w-full items-center justify-center bg-indigo-900 p-4">
      {/* Kartların içindeki ana konteyner */}
      {/* Önceki kodda bu katman indigo-950 idi, şimdi saydam yapıyoruz */}
      <div className="relative flex h-full w-full max-w-screen-xl overflow-hidden rounded-2xl bg-black/10 shadow-2xl backdrop-blur-sm">
        
        {/* Sol Sütun: Görsel Alan */}
        <div className="hidden w-3/5 flex-col items-center justify-center p-12 lg:flex">
          <VisualSection />
        </div>

        {/* Sağ Sütun: Giriş Formu */}
        {/* DEĞİŞİKLİK BURADA: Formun arka planını tamamen kaldırıp, ana konteynerin rengini almasını sağlıyoruz. */}
        {/* Hafif bir ayrım için sadece ince bir sol border ekleyebiliriz. */}
        <div className="flex w-full flex-col justify-center border-l border-white/5 p-8 lg:w-2/5 lg:p-12">
          <LoginForm />
        </div>

      </div>
    </div>
  );
}