<#
.SYNOPSIS
    Builds a debug APK via Docker and opens its folder so you can copy it to your phone.

.DESCRIPTION
    1. Builds the project inside the Docker container.
    2. Locates the generated APK at app/build/outputs/apk/debug/app-debug.apk.
    3. Opens that folder in Windows Explorer so you can copy the APK to your phone.

    PHONE SIDELOAD INSTRUCTIONS (no extra software needed):
      a) Connect phone via USB.
      b) On the phone, pull down the notification tray → "File Transfer" mode (MTP).
      c) In Explorer, copy the APK to your phone's Downloads folder.
      d) On the phone: Settings → "Install unknown apps" → Files → Allow.
      e) Open the Files app on your phone, navigate to Downloads, tap the APK.

    OPTIONAL – install directly over USB with ADB (Docker does the work):
      .\scripts\install-adb.ps1     (run after this script)

.EXAMPLE
    .\scripts\apk.ps1
    .\scripts\apk.ps1 -Release      # build a release APK instead (unsigned)
#>
param([switch]$Release)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot

try {
    # ── 1. Check Docker is running ─────────────────────────────────────────
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker Desktop is not running. Please start it and try again." -ForegroundColor Red
        exit 1
    }

    # ── 2. Build ──────────────────────────────────────────────────────────
    $service = if ($Release) { "release" } else { "build" }
    $task    = if ($Release) { "assembleRelease" } else { "assembleDebug" }
    Write-Host "`n[Strengthify] Building APK ($task)..." -ForegroundColor Cyan
    docker compose run --rm $service
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed" }

    # ── 3. Locate APK ─────────────────────────────────────────────────────
    $variant = if ($Release) { "release" } else { "debug" }
    $apkName = if ($Release) { "app-release-unsigned.apk" } else { "app-debug.apk" }
    $apkRel  = "app\build\outputs\apk\$variant\$apkName"
    $apkAbs  = Join-Path $projectRoot $apkRel

    if (-not (Test-Path $apkAbs)) {
        throw "APK not found at expected path: $apkAbs"
    }

    $size = (Get-Item $apkAbs).Length / 1MB
    Write-Host ""
    Write-Host "  APK built successfully!" -ForegroundColor Green
    Write-Host "  Path : $apkAbs" -ForegroundColor White
    Write-Host ("  Size : {0:N1} MB" -f $size) -ForegroundColor White

    # ── 4. Open folder in Explorer ────────────────────────────────────────
    Write-Host ""
    Write-Host "  Opening folder in Explorer..." -ForegroundColor Cyan
    Start-Process explorer.exe "/select,`"$apkAbs`""

    # ── 5. Instructions ───────────────────────────────────────────────────
    Write-Host ""
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host "  To install on your Android phone:" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "  Option A – USB file transfer (easiest):" -ForegroundColor White
    Write-Host "    1. Connect phone via USB, choose 'File Transfer' mode" -ForegroundColor Gray
    Write-Host "    2. Copy $apkName to your phone's Downloads folder" -ForegroundColor Gray
    Write-Host "    3. On phone: Settings → Apps → Special → Install unknown apps" -ForegroundColor Gray
    Write-Host "       Allow your Files app, then tap the APK to install" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Option B – direct ADB install (needs USB debugging ON):" -ForegroundColor White
    Write-Host "    .\scripts\install-adb.ps1" -ForegroundColor Gray
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Magenta

} finally {
    Pop-Location
}
