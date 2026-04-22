<#
.SYNOPSIS
    One-time setup: generates Gradle wrapper files via Docker so Android Studio can open the project.

.DESCRIPTION
    Android Studio needs:
      - gradle/wrapper/gradle-wrapper.jar  (binary bootstrap)
      - gradlew                            (Unix shell script)
      - gradlew.bat                        (Windows batch script)

    These can't be committed as plain text; this script generates them by running
    'gradle wrapper' inside the Docker build container, which writes them into the
    bind-mounted project directory so they appear on the host too.

    Run this ONCE before opening the project in Android Studio.

.EXAMPLE
    .\scripts\setup.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot

try {
    # ── 1. Check Docker is running ─────────────────────────────────────────
    Write-Host "`n[Strengthify] Checking Docker..." -ForegroundColor Cyan
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker Desktop is not running. Please start it and re-run this script." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Docker OK" -ForegroundColor Green

    # ── 2. Build the Docker image ─────────────────────────────────────────
    Write-Host "`n[Strengthify] Building Docker image (this takes ~5 min on first run)..." -ForegroundColor Cyan
    docker compose build
    if ($LASTEXITCODE -ne 0) { throw "docker compose build failed" }
    Write-Host "  Image built" -ForegroundColor Green

    # ── 3. Generate Gradle wrapper files ─────────────────────────────────
    Write-Host "`n[Strengthify] Generating Gradle wrapper files..." -ForegroundColor Cyan
    docker compose run --rm shell -c "gradle wrapper --gradle-version 8.7 --distribution-type bin"
    if ($LASTEXITCODE -ne 0) { throw "gradle wrapper generation failed" }

    # Verify the key files were created
    $jar = Join-Path $projectRoot "gradle\wrapper\gradle-wrapper.jar"
    $gw  = Join-Path $projectRoot "gradlew"
    if (-not (Test-Path $jar)) { throw "gradle-wrapper.jar was not generated" }
    if (-not (Test-Path $gw))  { throw "gradlew was not generated" }
    Write-Host "  Wrapper files generated" -ForegroundColor Green

    # ── 4. Ensure local.properties template ──────────────────────────────
    $localProps = Join-Path $projectRoot "local.properties"
    if (-not (Test-Path $localProps)) {
        # Try to auto-detect Android SDK from common Windows locations
        $candidates = @(
            "$env:LOCALAPPDATA\Android\Sdk",
            "$env:USERPROFILE\AppData\Local\Android\Sdk",
            "C:\Android\Sdk"
        )
        $sdkPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

        if ($sdkPath) {
            # Escape backslashes for properties format
            $escaped = $sdkPath.Replace("\", "\\")
            "sdk.dir=$escaped" | Out-File -FilePath $localProps -Encoding ascii
            Write-Host "  Created local.properties → sdk.dir=$sdkPath" -ForegroundColor Green
        } else {
            Write-Host "  Android SDK not found in common locations." -ForegroundColor Yellow
            Write-Host "  After installing Android Studio, it will create local.properties automatically." -ForegroundColor Yellow
        }
    } else {
        Write-Host "  local.properties already exists" -ForegroundColor Cyan
    }

    # ── 5. Summary ────────────────────────────────────────────────────────
    Write-Host ""
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host "  Setup complete! Next steps:" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "  Open in Android Studio:" -ForegroundColor White
    Write-Host "    File → Open → select this folder: $projectRoot" -ForegroundColor Gray
    Write-Host "    Android Studio will sync Gradle automatically." -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Build & install APK (no Android Studio needed):" -ForegroundColor White
    Write-Host "    .\scripts\apk.ps1" -ForegroundColor Gray
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Magenta

} finally {
    Pop-Location
}
