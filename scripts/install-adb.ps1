<#
.SYNOPSIS
    Installs the built debug APK directly to a connected Android device via ADB (USB or Wi-Fi).

.DESCRIPTION
    Runs ADB inside the Docker container so nothing extra needs to be installed on Windows.

    Prerequisites:
      1. USB debugging enabled on your phone:
           Settings → About Phone → tap "Build Number" 7 times
           Settings → Developer Options → USB Debugging ON
      2. Phone connected via USB (accept the "Allow USB Debugging" dialog on the phone).
      3. APK already built: run .\scripts\apk.ps1 first.

    Wi-Fi alternative:
      After first USB connection, run:
        docker compose run --rm shell adb tcpip 5555
      Unplug USB, then run this script with -WiFi <phone-ip>

.PARAMETER WiFi
    Phone IP address for wireless ADB (e.g. 192.168.1.42).
    Omit for USB connection.

.EXAMPLE
    .\scripts\install-adb.ps1
    .\scripts\install-adb.ps1 -WiFi 192.168.1.42
#>
param([string]$WiFi = "")

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot

$apkRel = "app/build/outputs/apk/debug/app-debug.apk"
$apkAbs = Join-Path $projectRoot ($apkRel -replace "/", "\")

if (-not (Test-Path $apkAbs)) {
    Write-Host "APK not found. Run .\scripts\apk.ps1 first." -ForegroundColor Red
    exit 1
}

try {
    Write-Host "`n[Strengthify] Installing via ADB..." -ForegroundColor Cyan

    if ($WiFi) {
        # Connect to wireless device first
        docker compose run --rm shell bash -c "adb connect ${WiFi}:5555 && adb -s ${WiFi}:5555 install -r /workspace/$apkRel"
    } else {
        # USB — expose the host USB device into the container via host network / privileged
        # Note: this runs with --privileged to allow ADB to access USB devices
        docker compose run --rm --privileged shell bash -c "adb wait-for-device && adb install -r /workspace/$apkRel"
    }

    if ($LASTEXITCODE -ne 0) { throw "ADB install failed" }

    Write-Host ""
    Write-Host "  Strengthify installed successfully on your device!" -ForegroundColor Green
    Write-Host "  Find it in your app drawer and tap to open." -ForegroundColor White

} finally {
    Pop-Location
}
