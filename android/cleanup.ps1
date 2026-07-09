#!/usr/bin/env pwsh
# Android Play Store Fix - Cleanup Script
# Run this in PowerShell from project root
# Purpose: Delete old package directories causing ClassNotFoundException

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Par for the Course - Android Build Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Get-Location
$javaPath = Join-Path $projectRoot "android\app\src\main\java\com"

Write-Host "📁 Checking Java packages in: $javaPath" -ForegroundColor Yellow
Write-Host ""

# Check what packages exist
$packages = Get-ChildItem -Path $javaPath -Directory | Select-Object -ExpandProperty Name
Write-Host "Found packages:" -ForegroundColor White
foreach ($pkg in $packages) {
    Write-Host "  - $pkg" -ForegroundColor Gray
}
Write-Host ""

# Identify correct vs. old packages
$correctPackage = "parforthecourse"
$oldPackages = @("promethean_games", "prometheangames")

Write-Host "✅ Correct package: $correctPackage" -ForegroundColor Green
Write-Host "❌ Old packages to delete:" -ForegroundColor Red
foreach ($old in $oldPackages) {
    Write-Host "   - $old" -ForegroundColor Red
}
Write-Host ""

# Confirm before deletion
Write-Host "⚠️  WARNING: This will DELETE old package directories!" -ForegroundColor Yellow
$confirm = Read-Host "Do you want to continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Cancelled. No changes made." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "🗑️  Deleting old packages..." -ForegroundColor Cyan

try {
    foreach ($oldPkg in $oldPackages) {
        $pathToDelete = Join-Path $javaPath $oldPkg
        if (Test-Path $pathToDelete) {
            Remove-Item -Path $pathToDelete -Recurse -Force
            Write-Host "  ✓ Deleted: $oldPkg" -ForegroundColor Green
        } else {
            Write-Host "  - Not found: $oldPkg (skipped)" -ForegroundColor Gray
        }
    }

    Write-Host ""
    Write-Host "✅ Cleanup complete!" -ForegroundColor Green
    Write-Host ""

    # Verify only correct package remains
    $remaining = Get-ChildItem -Path $javaPath -Directory | Select-Object -ExpandProperty Name
    Write-Host "📁 Remaining packages:" -ForegroundColor White
    foreach ($pkg in $remaining) {
        Write-Host "  - $pkg" -ForegroundColor Green
    }
    Write-Host ""

    # Check for MainActivity files
    $mainActivityFiles = Get-ChildItem -Path $javaPath -Recurse -Name "MainActivity.kt"
    Write-Host "📋 MainActivity files found:" -ForegroundColor White
    Write-Host "  Count: $($mainActivityFiles.Count)" -ForegroundColor Green
    foreach ($file in $mainActivityFiles) {
        Write-Host "    - $file" -ForegroundColor Green
    }
    Write-Host ""

    if ($mainActivityFiles.Count -ne 1) {
        Write-Host "⚠️  WARNING: Expected 1 MainActivity, found $($mainActivityFiles.Count)" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Perfect! Single MainActivity found" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "1. Run: ./gradlew clean" -ForegroundColor White
    Write-Host "2. Run: ./gradlew build" -ForegroundColor White
    Write-Host "3. Run: ./gradlew assembleRelease" -ForegroundColor White
    Write-Host "4. Test APK on device" -ForegroundColor White
    Write-Host "5. Resubmit to Google Play" -ForegroundColor White
    Write-Host ""
    Write-Host "📖 See ANDROID_PLAYSTORE_FIX.md for full details" -ForegroundColor Cyan

} catch {
    Write-Host "❌ Error during cleanup: $_" -ForegroundColor Red
    exit 1
}

