# LiveFleet Startup Script
# Run this script to start all services

Write-Host "`n🚀 Starting LiveFleet System...`n" -ForegroundColor Cyan

# Kill any existing Node processes
Write-Host "Cleaning up old processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
# LiveFleet startup script
# Starts backend and frontend in separate PowerShell windows.

$ErrorActionPreference = "Stop"

$projectRoot  = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath  = Join-Path $projectRoot "backend"
$frontendPath = Join-Path $projectRoot "frontend"

Write-Host "`nStarting LiveFleet...`n" -ForegroundColor Cyan

if (-not (Test-Path $backendPath)) {
    throw "Backend folder not found: $backendPath"
}

if (-not (Test-Path $frontendPath)) {
    throw "Frontend folder not found: $frontendPath"
}

Write-Host "Installing dependencies if needed..." -ForegroundColor Yellow
Push-Location $backendPath
npm install | Out-Null
Pop-Location

Push-Location $frontendPath
npm install | Out-Null
Pop-Location

Write-Host "Starting backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$backendPath'; npm start"
) -WindowStyle Minimized | Out-Null

Start-Sleep -Seconds 4

Write-Host "Starting frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$frontendPath'; npm run dev"
) -WindowStyle Minimized | Out-Null

Start-Sleep -Seconds 4

Write-Host "Checking services..." -ForegroundColor Yellow

$backendOk = $false
$frontendOk = $false

try {
    $null = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:3000/health" -TimeoutSec 10
    $backendOk = $true
} catch {}

try {
    $null = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:5173" -TimeoutSec 10
    $frontendOk = $true
} catch {}

if ($backendOk) {
    Write-Host "  OK  Backend:  http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "  FAIL Backend did not respond yet." -ForegroundColor Red
}

if ($frontendOk) {
    Write-Host "  OK  Frontend: http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "  FAIL Frontend did not respond yet." -ForegroundColor Red
}

Write-Host "`nLiveFleet startup command finished." -ForegroundColor Cyan
Write-Host "If a service failed above, check the minimized backend/frontend PowerShell windows for detailed error logs." -ForegroundColor DarkGray
