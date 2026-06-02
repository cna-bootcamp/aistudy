param([string]$JsxFile)

Set-Location $PSScriptRoot

if (-not $JsxFile) {
    Write-Host "Usage: .\run.ps1 <path-to-jsx-file>" -ForegroundColor Yellow
    Write-Host "Example: .\run.ps1 .\jsx\rag-architecture.jsx"
    exit 1
}

$JsxPath = (Resolve-Path $JsxFile -ErrorAction SilentlyContinue).Path
if (-not $JsxPath) {
    Write-Host "Error: File not found: $JsxFile" -ForegroundColor Red
    exit 1
}

Write-Host "📄 File: $JsxPath" -ForegroundColor Cyan
$env:JSX_FILE = $JsxPath

docker compose up --build -d
Start-Sleep -Seconds 2

$containerId = docker compose ps -q jsx-viewer
$port = (docker port $containerId 5173) -replace '.*:', ''
Write-Host ""
Write-Host "🚀 JSX Viewer: http://localhost:$port" -ForegroundColor Green
Write-Host ""

docker logs -f $containerId 2>&1 | Select-String -NotMatch "Local:|Network:"
