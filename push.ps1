$filePath = ".\services\api.ts"

if (-not (Test-Path $filePath)) {
    Write-Host "File $filePath tidak ditemukan! Pastikan Anda menjalankan script ini dari root folder proyek." -ForegroundColor Red
    exit 1
}

$lines = [System.IO.File]::ReadAllLines((Resolve-Path $filePath).Path)
$modified = $false

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    
    # Cek jika URL Production masih di-comment
    if ($line -match '^\s*//\s*(export\s+const\s+API_BASE_URL\s*=\s*"https://app\.plexseller\.com".*)') {
        $lines[$i] = $matches[1]
        $modified = $true
        Write-Host "[+] Uncommented URL Production (https://app.plexseller.com)" -ForegroundColor Green
    }
    # Cek jika ada URL lain (misal IP Local) yang masih aktif / tidak di-comment
    elseif ($line -match '^\s*export\s+const\s+API_BASE_URL\s*=' -and $line -notmatch 'https://app\.plexseller\.com') {
        $lines[$i] = "// " + $line
        $modified = $true
        Write-Host "[-] Commented URL Local/Dev ($($line.Trim()))" -ForegroundColor Yellow
    }
}

if ($modified) {
    # Simpan kembali menggunakan format UTF8 (tanpa BOM) agar tidak merusak file
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllLines((Resolve-Path $filePath).Path, $lines, $utf8NoBom)
    Write-Host "[SUCCESS] services/api.ts berhasil diupdate ke Production!" -ForegroundColor Green
} else {
    Write-Host "[OK] services/api.ts sudah menggunakan URL Production (https://app.plexseller.com)." -ForegroundColor Cyan
}

# (Opsional) Tambahkan perintah git di bawah ini jika ingin otomatis push ke GitHub
# git add .
# git commit -m "Auto-update API_BASE_URL ke Production"
# git push origin main
