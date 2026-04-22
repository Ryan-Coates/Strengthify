# =============================================================================
# Strengthify Web — Build Script
# Bundles src/style.css + src/data.js + src/chart.js + src/app.js
# into a single self-contained dist/strengthify.html
# =============================================================================
#Requires -Version 5.1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SrcDir    = Join-Path $ScriptDir 'src'
$DistDir   = Join-Path $ScriptDir 'dist'
$OutFile   = Join-Path $DistDir   'strengthify.html'

# ── Ensure dist directory exists ─────────────────────────────────────────────
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir | Out-Null
}

Write-Host "Building Strengthify web app..." -ForegroundColor Cyan

# ── Read source files ─────────────────────────────────────────────────────────
$files = @{
    template = Join-Path $SrcDir 'index.html'
    style    = Join-Path $SrcDir 'style.css'
    dataJs   = Join-Path $SrcDir 'data.js'
    chartJs  = Join-Path $SrcDir 'chart.js'
    appJs    = Join-Path $SrcDir 'app.js'
}

foreach ($key in $files.Keys) {
    if (-not (Test-Path $files[$key])) {
        Write-Error "Missing source file: $($files[$key])"
        exit 1
    }
}

$template = Get-Content $files.template -Raw -Encoding UTF8
$style    = Get-Content $files.style    -Raw -Encoding UTF8
$dataJs   = Get-Content $files.dataJs   -Raw -Encoding UTF8
$chartJs  = Get-Content $files.chartJs  -Raw -Encoding UTF8
$appJs    = Get-Content $files.appJs    -Raw -Encoding UTF8

# ── Inject CSS ────────────────────────────────────────────────────────────────
# Replaces the /* __STYLE__ */ placeholder inside the <style> tag
$template = $template -replace '/\* __STYLE__ \*/', $style

# ── Inject JS ─────────────────────────────────────────────────────────────────
$template = $template -replace '/\* __DATA_JS__ \*/',  $dataJs
$template = $template -replace '/\* __CHART_JS__ \*/', $chartJs
$template = $template -replace '/\* __APP_JS__ \*/',   $appJs

# ── Stamp build metadata ──────────────────────────────────────────────────────
$stamp = "<!-- Built: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') -->"
$template = $template -replace '<!DOCTYPE html>', "<!DOCTYPE html>`n$stamp"

# ── Write output ──────────────────────────────────────────────────────────────
[System.IO.File]::WriteAllText($OutFile, $template, [System.Text.Encoding]::UTF8)

$sizeKB = [Math]::Round((Get-Item $OutFile).Length / 1KB, 1)
Write-Host ""
Write-Host "  Output : $OutFile" -ForegroundColor Green
Write-Host "  Size   : ${sizeKB} KB" -ForegroundColor Green
Write-Host ""
Write-Host "Done. Open dist/strengthify.html in any browser." -ForegroundColor Cyan
