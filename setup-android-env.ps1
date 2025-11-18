# Setup Android Development Environment Variables
# Run this script as Administrator

Write-Host "Setting up Android development environment..." -ForegroundColor Green

# Set JAVA_HOME
$javaHome = 'C:\Program Files\Android\Android Studio\jbr'
Write-Host "Setting JAVA_HOME to: $javaHome" -ForegroundColor Yellow
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', $javaHome, 'User')

# Set ANDROID_HOME
$androidHome = 'C:\Users\guest-user\AppData\Local\Android\Sdk'
Write-Host "Setting ANDROID_HOME to: $androidHome" -ForegroundColor Yellow
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', $androidHome, 'User')

# Update PATH
Write-Host "Updating PATH..." -ForegroundColor Yellow
$currentPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')

# Remove any existing Android/Java paths to avoid duplicates
$pathsToRemove = @(
    "$javaHome\bin",
    "$androidHome\platform-tools",
    "$androidHome\cmdline-tools\latest\bin",
    "$androidHome\emulator",
    "$androidHome\tools",
    "$androidHome\tools\bin"
)

$cleanPath = $currentPath
foreach ($pathToRemove in $pathsToRemove) {
    $cleanPath = $cleanPath -replace [regex]::Escape(";$pathToRemove"), ""
    $cleanPath = $cleanPath -replace [regex]::Escape("$pathToRemove;"), ""
    $cleanPath = $cleanPath -replace [regex]::Escape($pathToRemove), ""
}

# Add new paths
$newPaths = @(
    "$javaHome\bin",
    "$androidHome\platform-tools",
    "$androidHome\cmdline-tools\latest\bin",
    "$androidHome\emulator"
)

$newPath = $cleanPath
foreach ($path in $newPaths) {
    if ($newPath -notlike "*$path*") {
        $newPath = "$newPath;$path"
    }
}

[System.Environment]::SetEnvironmentVariable('Path', $newPath, 'User')

Write-Host "`nEnvironment variables set successfully!" -ForegroundColor Green
Write-Host "`nIMPORTANT: You must restart your terminal/VS Code for changes to take effect!" -ForegroundColor Red
Write-Host "`nAfter restarting, verify with these commands:" -ForegroundColor Cyan
Write-Host "  java -version" -ForegroundColor White
Write-Host "  adb --version" -ForegroundColor White
Write-Host "  echo `$env:JAVA_HOME" -ForegroundColor White
Write-Host "  echo `$env:ANDROID_HOME" -ForegroundColor White

