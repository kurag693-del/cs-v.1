# stop-dev.ps1
Write-Host "🛑 Остановка фоновых сервисов..." -ForegroundColor Yellow
Stop-Process -Name "redis-server" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "mailpit" -Force -ErrorAction SilentlyContinue
Write-Host "✅ Сервисы остановлены. Next.js остановится через Ctrl+C." -ForegroundColor Green