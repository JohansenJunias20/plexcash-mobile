# PlexSeller Uninstall Hook
# This script runs during uninstall to clean up user data
# Ensures fresh installation on new computers

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PlexSeller Uninstall Cleanup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Path to user data folder
$AppDataPath = Join-Path $env:APPDATA "PlexSellerWinForm"

if (Test-Path $AppDataPath) {
    Write-Host "📂 Found user data folder: $AppDataPath" -ForegroundColor Yellow
    
    # List files that will be deleted
    $files = Get-ChildItem -Path $AppDataPath -Recurse -File
    if ($files.Count -gt 0) {
        Write-Host "   Files to be removed:" -ForegroundColor Gray
        foreach ($file in $files) {
            Write-Host "   - $($file.Name)" -ForegroundColor Gray
        }
    }
    
    # Remove the folder
    try {
        Remove-Item -Path $AppDataPath -Recurse -Force -ErrorAction Stop
        Write-Host "✅ User data removed successfully" -ForegroundColor Green
        Write-Host "   This ensures fresh pairing on next installation" -ForegroundColor Gray
    }
    catch {
        Write-Host "⚠️  Warning: Could not remove user data" -ForegroundColor Yellow
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
        Write-Host "   You may need to manually delete: $AppDataPath" -ForegroundColor Gray
    }
}
else {
    Write-Host "ℹ️  No user data found (already clean)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Uninstall cleanup completed" -ForegroundColor Green

