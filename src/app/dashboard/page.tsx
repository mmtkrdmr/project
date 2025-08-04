export default function DashboardPage() {
  return (
    // ÖNEMLİ: Dashboard sayfasının kendi açık renkli arka planı var.
    // Bu sınıf, AuthProvider'ın içindeki <main> alanını doldurur.
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-100 min-h-full text-black">
      <h1 className="text-2xl font-bold">Ana Panel</h1>
      <p className="mt-2">Panelinize hoş geldiniz!</p>
      {/* Diğer tüm dashboard bileşenleriniz buraya gelecek */}
    </div>
  );
}