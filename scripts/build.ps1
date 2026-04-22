<#
.SYNOPSIS
    Build the Strengthify debug APK inside Docker.

.DESCRIPTION
    Runs ./gradlew assembleDebug inside the build container.
    Output APK: app/build/outputs/apk/debug/app-debug.apk

.EXAMPLE
    .\scripts\build.ps1
    .\scripts\build.ps1 -Clean    # runs clean first
#>
param(
    [switch]$Clean
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot

try {
    # Ensure the image is built
    Write-Host "`n[Strengthify] Building Docker image..." -ForegroundColor Cyan
    docker compose build

    if ($Clean) {
        Write-Host "`n[Strengthify] Running clean..." -ForegroundColor Yellow
        docker compose run --rm build gradle clean
    }

    Write-Host "`n[Strengthify] Assembling debug APK..." -ForegroundColor Cyan
    docker compose run --rm build

    $apk = Join-Path $projectRoot "app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apk) {
        Write-Host "`n[Strengthify] Build successful!" -ForegroundColor Green
        Write-Host "APK: $apk" -ForegroundColor Green
    }
} finally {
    Pop-Location
}
