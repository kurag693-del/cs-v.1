param(
    [string]$RedisPath = "C:\redis\redis-server.exe",
    [string]$MailpitPath = "C:\tools\mailpit.exe",
    [string]$RedisPass = "redis_test_secret"
)

Write-Host "Starting local dev environment..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env not found in project root!" -ForegroundColor Red
    exit 1
}

function Test-PortOpen {
    param([int]$Port)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("localhost", $Port)
        $tcp.Close()
        return $true
    } catch { return $false }
}

# 1. PostgreSQL (port 5433)
if (Test-PortOpen 5433) { Write-Host "[OK] PostgreSQL is running" -ForegroundColor Green }
else { Write-Host "[WARN] PostgreSQL not responding. Start via services.msc" -ForegroundColor Yellow }

# 2. Redis
if (Test-PortOpen 6379) { Write-Host "[OK] Redis is already running" -ForegroundColor Green }
else {
    if (Test-Path $RedisPath) {
        Write-Host "[*] Starting Redis..." -ForegroundColor Yellow
        Start-Process -FilePath $RedisPath -ArgumentList "--requirepass $RedisPass" -WindowStyle Hidden
        Start-Sleep 2
        Write-Host "[OK] Redis started" -ForegroundColor Green
    } else { Write-Host "[ERROR] Redis not found at: $RedisPath" -ForegroundColor Red; exit 1 }
}

# 3. Mailpit
if (Test-PortOpen 1025) { Write-Host "[OK] Mailpit is already running" -ForegroundColor Green }
else {
    if (Test-Path $MailpitPath) {
        Write-Host "[*] Starting Mailpit..." -ForegroundColor Yellow
        Start-Process -FilePath $MailpitPath -WindowStyle Hidden
        Start-Sleep 2
        Write-Host "[OK] Mailpit started (UI: http://localhost:8025)" -ForegroundColor Green
    } else { Write-Host "[ERROR] Mailpit not found at: $MailpitPath" -ForegroundColor Red; exit 1 }
}

# 4. Next.js
Write-Host ""
Write-Host "Starting Next.js dev server..." -ForegroundColor Cyan
Write-Host "App:   http://localhost:3000" -ForegroundColor Cyan
Write-Host "Mail:  http://localhost:8025" -ForegroundColor Cyan
Write-Host "Stop:  Press Ctrl+C" -ForegroundColor Yellow
Write-Host ""

if (Test-PortOpen 3000) {
    Write-Host "[WARN] Port 3000 is already in use. Stop existing Next.js server first." -ForegroundColor Yellow
    exit 1
}

npm run next:dev