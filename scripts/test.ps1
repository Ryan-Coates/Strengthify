<#
.SYNOPSIS
    Run JVM unit tests inside Docker.

.DESCRIPTION
    Runs ./gradlew test inside the build container.
    HTML report: app/build/reports/tests/testDebugUnitTest/index.html

.EXAMPLE
    .\scripts\test.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot

try {
    Write-Host "`n[Strengthify] Running unit tests..." -ForegroundColor Cyan
    docker compose run --rm test

    $report = Join-Path $projectRoot "app\build\reports\tests\testDebugUnitTest\index.html"
    if (Test-Path $report) {
        Write-Host "`n[Strengthify] Test report: $report" -ForegroundColor Green
        # Open the report in the default browser
        Start-Process $report
    }
} finally {
    Pop-Location
}
