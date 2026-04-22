<#
.SYNOPSIS
    Connect an Android device to the Docker build container via ADB over TCP.

.DESCRIPTION
    Enables wireless ADB debugging so that 'gradlew installDebug' can
    deploy directly to a physical phone from inside the container —
    no Android Studio or host ADB installation needed.

    Steps performed:
      1. Starts or connects to adb server inside the container.
      2. Connects to the device at the specified IP:port.
      3. Lists connected devices so you can confirm it worked.

.PARAMETER Ip
    IP address of the Android device (find in Settings → Developer Options → Wireless debugging).

.PARAMETER Port
    Port shown under Wireless debugging (default 5555).

.EXAMPLE
    .\scripts\connect-device.ps1 -Ip 192.168.1.50
    .\scripts\connect-device.ps1 -Ip 192.168.1.50 -Port 37321
#>
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^\d{1,3}(\.\d{1,3}){3}$')]
    [string]$Ip,

    [ValidateRange(1024, 65535)]
    [int]$Port = 5555
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot

try {
    Write-Host "`n[Strengthify] Connecting to device $Ip`:$Port inside container..." -ForegroundColor Cyan

    # Run adb connect inside the shell service so it shares the same network
    # namespace as the build service.
    docker compose run --rm shell bash -c "\
        adb connect ${Ip}:${Port} && \
        echo '' && \
        echo 'Connected devices:' && \
        adb devices -l\
    "

    Write-Host "`n[Strengthify] Done. Run '.\scripts\build.ps1' then deploy with:" -ForegroundColor Green
    Write-Host "  docker compose run --rm build ./gradlew installDebug" -ForegroundColor White
} finally {
    Pop-Location
}
