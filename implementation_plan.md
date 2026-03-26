# Auto Clicker Android Project

Aplikasi auto-clicker di Android membutuhkan fitur bawaan yang disebut **Accessibility Service** (Layanan Aksesibilitas). Layanan ini memungkinkan aplikasi untuk membaca layar (untuk mencari tombol "Ikuti"), melakukan pergerakan klik/tap, dan melakukan *scroll* (geser layar) secara terprogram tanpa root.

## Konfirmasi Teknologi (Kotlin vs Flutter)
Di permintaan Anda, Anda menyebutkan *"menginisialisasi project kotlin android"* namun kemudian menyebut *"project Flutter ini"*. 

> [!IMPORTANT]
> Karena Auto-Clicker/Accessibility Service adalah fitur *Native Android*, mengimplementasikannya secara langsung menggunakan **Native Kotlin** jauh lebih bersih dan mudah dibandingkan melalui Flutter. Oleh karena itu, saya merencanakan inisialisasi ini murni menggunakan proyek **Kotlin Android** biasa tanpa Flutter. Mohon konfirmasinya.

## Rencana Implementasi

1. **Inisialisasi Proyek Kotlin di Folder Anda**
   - Membuat struktur Gradle (`build.gradle.kts`, `settings.gradle.kts`) di dalam folder `Auto clicker`.
   - Membuat struktur direktori `app/src/main/....` sehingga Anda cukup melakukan "Open" folder tersebut di Android Studio Anda dan langsung bisa dijalankan/build APK.

2. **Membuat AndroidManifest.xml & Konfigurasi**
   - Menambahkan _permission_ `BIND_ACCESSIBILITY_SERVICE`.
   - Membuat file konfigurasi XML untuk layanan aksesibilitas agar ia dapat mengetahui aplikasi apa saja atau *event* apa saja yang akan dipantau (dalam hal ini, memantau *window state* dan aktivitas di layar untuk Shopee).

3. **Membuat AutoClickerService.kt (Logika Utama)**
   - Algoritma pencarian: Mencari semua *node* di layar yang memiliki teks **"Ikuti"**.
   - Jika tombol "Ikuti" ditemukan, layanan akan mencoba untuk mensimulasikan aksi klik (`ACTION_CLICK`) secara otomatis, satu per satu dengan jeda aman.
   - Jika di layar sudah tidak ada lagi tombol "Ikuti", layanan akan mensimulasikan aksi scroll ke bawah (`ACTION_SCROLL_FORWARD`) untuk memuat orang-orang baru di daftar followers Shopee, lalu mencari lagi.
   - Siklus ini berlanjut sampai tidak ada tombol baru yang bisa di-click setelah dicoba scroll beberapa kali.

4. **Membuat UI Sederhana (MainActivity.kt)**
   - UI sederhana dengan satu tombol "Mulai Auto Clicker" yang akan mengarahkan Anda ke halaman Pengaturan Sistem (Settings) untuk mengizinkan aplikasi berjalan sebagai Layanan Aksesibilitas.

## Rencana Pengujian (Manual Verification)
1. Buka project menggunakan Android Studio.
2. Build dan install ke device/emulator.
3. Buka aplikasinya, izinkan Accessibility Service di Pengaturan Android Anda.
4. Buka aplikasi Shopee ke halaman followers, script auto clicker akan otomatis bereaksi mencari dan menekan semua tombol "Ikuti".
