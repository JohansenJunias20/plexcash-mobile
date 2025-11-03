Write-Host "Copying project to C:\plexcash-mobile..." -ForegroundColor Cyan

$source = "C:\Users\johan\OneDrive\Documents\GitHub\plexcash-mobile"
$dest = "C:\plexcash-mobile"

# Create destination directory
Write-Host "Creating destination directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $dest | Out-Null

# Copy files excluding node_modules and build folders
Write-Host "Copying files (this may take a few minutes)..." -ForegroundColor Yellow

$excludeDirs = @('node_modules', '.expo', 'android\.gradle', 'android\.cxx', 'android\app\build', 'android\build')

Get-ChildItem -Path $source -Recurse -Force | ForEach-Object {
    $relativePath = $_.FullName.Substring($source.Length)
    $destPath = Join-Path $dest $relativePath
    
    # Check if path contains excluded directories
    $shouldExclude = $false
    foreach ($excludeDir in $excludeDirs) {
        if ($relativePath -like "*\$excludeDir\*" -or $relativePath -like "*\$excludeDir") {
            $shouldExclude = $true
            break
        }
    }
    
    if (-not $shouldExclude) {
        if ($_.PSIsContainer) {
            # Create directory
            New-Item -ItemType Directory -Force -Path $destPath -ErrorAction SilentlyContinue | Out-Null
        } else {
            # Copy file
            $destDir = Split-Path $destPath -Parent
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Force -Path $destDir | Out-Null
            }
            Copy-Item -Path $_.FullName -Destination $destPath -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host ""
Write-Host "Verifying copy..." -ForegroundColor Yellow

if (Test-Path "$dest\package.json") {
    Write-Host "SUCCESS! Project copied to C:\plexcash-mobile" -ForegroundColor Green
    Write-Host ""
    Write-Host "Files copied:" -ForegroundColor Cyan
    Write-Host "  - package.json: $(Test-Path $dest\package.json)" -ForegroundColor White
    Write-Host "  - app.json: $(Test-Path $dest\app.json)" -ForegroundColor White
    Write-Host "  - android folder: $(Test-Path $dest\android)" -ForegroundColor White
    Write-Host "  - android/app/release.keystore: $(Test-Path $dest\android\app\release.keystore)" -ForegroundColor White
} else {
    Write-Host "ERROR: Copy failed!" -ForegroundColor Red
}

