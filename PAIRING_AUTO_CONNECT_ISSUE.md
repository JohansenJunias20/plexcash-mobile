# 🔍 Analisis Masalah: Aplikasi Otomatis Terpair Setelah Instalasi

## ❌ **MASALAH**

Setelah instalasi di komputer baru, aplikasi PlexSellerWinForm **secara otomatis sudah terhubung (paired)** dengan email `coronamakmurteknik@gmail.com`, padahal seharusnya aplikasi dimulai dalam kondisi **fresh/belum terpair**.

---

## 🔎 **ROOT CAUSE ANALYSIS**

### 1. **File Konfigurasi Pairing Persisten**

**Lokasi File:**
```
C:\Users\{Username}\AppData\Roaming\PlexSellerWinForm\pairing.json
```

**Isi File:**
```json
{
  "client_id": "winforms_1764913680225_ayl6l",
  "database_name": "coronamakmurteknik@gmail.com",
  "api_endpoint": "http://localhost:80",
  "email": "coronamakmurteknik@gmail.com",
  "desktop_name": "JOHANSEN",
  "paired_at": "2025-12-05T05:48:00.0000000Z"
}
```

**Kode yang Menyimpan:**
- File: `Services\PairingService.cs`
- Method: `SavePairingInfo()` (line 814-852)
- Method: `LoadPairingInfo()` (line 857-944)

**Kode yang Memuat:**
- File: `Form1.cs`
- Line 149: `_pairingService.LoadPairingInfo();`

### 2. **Mengapa File Tidak Terhapus Saat Uninstall?**

**Folder `AppData\Roaming` TIDAK DIHAPUS oleh installer Windows secara default!**

Ini adalah **behavior standar Windows** untuk melindungi data user:
- ✅ Installer hanya menghapus file di `C:\Program Files\` atau `C:\Users\{User}\AppData\Local\{AppName}\`
- ❌ Installer **TIDAK** menghapus `C:\Users\{User}\AppData\Roaming\{AppName}\`

**Alasan:**
- Data di `Roaming` dianggap sebagai **user data/preferences** yang harus dipertahankan
- Jika user uninstall lalu reinstall, settings mereka tetap ada

### 3. **Tidak Ada Hardcoded Email**

✅ **GOOD NEWS:** Tidak ada hardcoded email `coronamakmurteknik@gmail.com` di source code!

Email yang muncul di file `Server\debug\*.ps1` dan `Server\debug\*.sh` hanya untuk **testing/debugging**, bukan production code.

---

## 🛠️ **SOLUSI**

### **Opsi 1: Hapus File Pairing Saat Uninstall (RECOMMENDED)**

Modifikasi installer untuk menghapus folder `AppData\Roaming\PlexSellerWinForm\` saat uninstall.

**File yang Perlu Dimodifikasi:**
- `build-final.ps1` (build script)
- Tambahkan custom uninstall hook

**Implementasi:**

1. **Buat Uninstall Hook Script**

Buat file baru: `uninstall-hook.ps1`

```powershell
# PlexSeller Uninstall Hook
# This script runs during uninstall to clean up user data

$AppDataPath = Join-Path $env:APPDATA "PlexSellerWinForm"

if (Test-Path $AppDataPath) {
    Write-Host "Removing user data: $AppDataPath"
    Remove-Item -Path $AppDataPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "User data removed successfully"
}
```

2. **Update build-final.ps1**

Tambahkan parameter untuk Squirrel:

```powershell
$squirrelArgs = @(
    "releasify",
    "--package", $TempNupkg,
    "--releaseDir", $ReleasesDir,
    "--mainExe", "PlexSellerWinForm.exe",
    "--noDelta",
    "--allowUnaware",
    "--noRunAfterInstall",
    "--setupHook", "uninstall-hook.ps1"  # ← TAMBAHKAN INI
)
```

---

### **Opsi 2: Deteksi First Run & Konfirmasi Pairing**

Tambahkan logic untuk mendeteksi apakah ini first run di komputer baru.

**Implementasi:**

1. **Tambahkan First Run Check**

File: `Services\PairingService.cs`

```csharp
public bool LoadPairingInfo()
{
    try
    {
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "PlexSellerWinForm"
        );

        var filePath = Path.Combine(appDataPath, "pairing.json");

        Console.WriteLine($"🔍 Loading pairing info from: {filePath}");

        if (!File.Exists(filePath))
        {
            Console.WriteLine("❌ Pairing file not found");
            return false;
        }

        var json = File.ReadAllText(filePath);
        var settings = JsonSerializer.Deserialize<PairingInfo>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (settings != null && !string.IsNullOrEmpty(settings.ClientId))
        {
            // ✅ TAMBAHKAN: Validasi apakah desktop name sama
            if (settings.DesktopName != Environment.MachineName)
            {
                Console.WriteLine($"⚠️ Desktop name mismatch!");
                Console.WriteLine($"   Saved: {settings.DesktopName}");
                Console.WriteLine($"   Current: {Environment.MachineName}");
                Console.WriteLine($"   This appears to be a different computer - clearing pairing");
                
                // Hapus file pairing lama
                File.Delete(filePath);
                return false;
            }

            // Load pairing info...
            _clientId = settings.ClientId;
            _databaseName = settings.DatabaseName;
            // ... rest of code
        }
    }
    catch (Exception ex)
    {
        // ... error handling
    }
}
```

---

### **Opsi 3: Manual Cleanup Instructions**

Tambahkan instruksi di dokumentasi untuk user menghapus file pairing secara manual.

**File: INSTALLATION_GUIDE.md**

```markdown
## Fresh Installation

Jika Anda ingin melakukan instalasi fresh (tanpa pairing sebelumnya):

1. Uninstall aplikasi lama
2. Hapus folder konfigurasi:
   ```
   C:\Users\{YourUsername}\AppData\Roaming\PlexSellerWinForm\
   ```
3. Install aplikasi baru
```

---

## 📋 **REKOMENDASI**

**Gunakan kombinasi Opsi 1 + Opsi 2:**

1. ✅ **Opsi 1:** Hapus file saat uninstall (untuk instalasi bersih)
2. ✅ **Opsi 2:** Deteksi desktop name mismatch (untuk keamanan tambahan)

**Benefit:**
- Instalasi di komputer baru akan selalu fresh
- Jika user copy file pairing dari komputer lain, akan terdeteksi dan ditolak
- User experience lebih baik (tidak perlu manual cleanup)

---

## 🎯 **NEXT STEPS**

1. Pilih solusi yang akan diimplementasikan
2. Test di environment development
3. Build installer baru
4. Test instalasi di komputer baru
5. Verify pairing dimulai dari fresh state

---

## 📝 **CATATAN PENTING**

- File `developer.json` juga disimpan di lokasi yang sama, pertimbangkan untuk menghapus atau tidak
- Registry entries untuk Chrome Extension Force Install **TIDAK** perlu dihapus (sudah per-machine, bukan per-user)
- USB Protection settings di registry **TIDAK** perlu dihapus (sudah system-wide)

