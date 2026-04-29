param(
    [string]$RedisPath = "C:\redis\redis-server.exe",
    [string]$MailpitPath = "C:\tools\mailpit.exe",
    [string]$MinioPath = "C:\tools\minio.exe",
    [string]$MinioDataPath = "C:\minio-data",
    [string]$PostgresServiceName = "postgresql-x64-16",
    [string]$PostgresCtlPath = "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe",
    [string]$PostgresDataPath = "C:\Program Files\PostgreSQL\16\data",
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
if (Test-PortOpen 5433) {
    Write-Host "[OK] PostgreSQL is running" -ForegroundColor Green
} else {
    Write-Host "[WARN] PostgreSQL is not responding on 5433. Trying auto-start..." -ForegroundColor Yellow
    $postgresStarted = $false
    $svc = Get-Service -Name $PostgresServiceName -ErrorAction SilentlyContinue
    if ($svc) {
        if ($svc.Status -ne 'Running') {
            Start-Service -Name $PostgresServiceName -ErrorAction SilentlyContinue
            Start-Sleep 3
        }
        if (Test-PortOpen 5433) {
            Write-Host "[OK] PostgreSQL started via service $PostgresServiceName" -ForegroundColor Green
            $postgresStarted = $true
        }
    }

    if (-not $postgresStarted -and (Test-Path $PostgresCtlPath) -and (Test-Path $PostgresDataPath)) {
        Start-Process -FilePath $PostgresCtlPath -ArgumentList "start -D `"$PostgresDataPath`" -l `"$PostgresDataPath\server.log`"" -WindowStyle Hidden
        Start-Sleep 3
        if (Test-PortOpen 5433) {
            Write-Host "[OK] PostgreSQL started via pg_ctl" -ForegroundColor Green
            $postgresStarted = $true
        }
    }

    if (-not $postgresStarted -and -not (Test-PortOpen 5433)) {
        Write-Host "[ERROR] PostgreSQL failed to start. Set -PostgresServiceName or -PostgresCtlPath/-PostgresDataPath." -ForegroundColor Red
        exit 1
    }
}

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

# 4. MinIO (S3 local)
if (Test-PortOpen 9000) { Write-Host "[OK] MinIO is already running" -ForegroundColor Green }
else {
    if (Test-Path $MinioPath) {
        if (-not (Test-Path $MinioDataPath)) {
            New-Item -ItemType Directory -Path $MinioDataPath | Out-Null
        }
        Write-Host "[*] Starting MinIO..." -ForegroundColor Yellow
        Start-Process -FilePath $MinioPath -ArgumentList "server `"$MinioDataPath`" --address :9000 --console-address :9001" -WindowStyle Hidden
        Start-Sleep 2
        if (Test-PortOpen 9000) {
            Write-Host "[OK] MinIO started (API: http://localhost:9000, Console: http://localhost:9001)" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] MinIO failed to start. Check binary and permissions." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "[ERROR] MinIO not found at: $MinioPath" -ForegroundColor Red
        Write-Host "Install MinIO and place minio.exe there, or pass -MinioPath <path>" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "[*] Initializing S3 bucket/policy..." -ForegroundColor Yellow
node scripts/init-local-storage.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] S3 initialization failed. Fix errors above and retry." -ForegroundColor Red
    exit 1
}

# 5. Prisma bootstrap (generate + db push)
Write-Host "[*] Prisma generate..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Prisma generate failed." -ForegroundColor Red
    exit 1
}

Write-Host "[*] Prisma db push..." -ForegroundColor Yellow
npx prisma db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Prisma db push failed." -ForegroundColor Red
    exit 1
}

# 6. Next.js
Write-Host ""
Write-Host "Starting Next.js dev server..." -ForegroundColor Cyan
Write-Host "App:   http://localhost:3000" -ForegroundColor Cyan
Write-Host "Mail:  http://localhost:8025" -ForegroundColor Cyan
Write-Host "S3:    http://localhost:9000" -ForegroundColor Cyan
Write-Host "S3 UI: http://localhost:9001" -ForegroundColor Cyan
Write-Host "Stop:  Press Ctrl+C" -ForegroundColor Yellow
Write-Host ""

if (Test-PortOpen 3000) {
    Write-Host "[WARN] Port 3000 is already in use. Stop existing Next.js server first." -ForegroundColor Yellow
    exit 1
}

npm run next:dev