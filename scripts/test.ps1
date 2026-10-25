<#
.SYNOPSIS
    Run the web app tests with Node.js 18 or later.

.DESCRIPTION
    Uses Node's built-in test runner. No dependencies are required.

.EXAMPLE
    .\scripts\test.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot

try {
    Write-Host "`n[Strengthify] Running web tests..." -ForegroundColor Cyan
    node --test web\tests
    if ($LASTEXITCODE -ne 0) { throw "Web tests failed (exit $LASTEXITCODE)." }
} finally {
    Pop-Location
}
