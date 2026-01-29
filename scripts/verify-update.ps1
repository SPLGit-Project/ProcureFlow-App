
# ProcureFlow Update Verification Script
# This script sets up a local production simulation to test the update flow

Write-Host "🚀 Setting up ProcureFlow Verification Environment..." -ForegroundColor Cyan

# 1. Check if dist exists, if not build
if (-not (Test-Path "dist")) {
    Write-Host "📦 Building application for production simulation..." -ForegroundColor Yellow
    npm run build
}
else {
    Write-Host "✅ Existing build found. Skipping rebuild (run 'npm run build' manually if needed)." -ForegroundColor Green
}

# 2. Start Preview Server in Background
Write-Host "🌐 Starting Preview Server (Mock Production)..." -ForegroundColor Cyan
$previewJob = Start-Job -ScriptBlock { cmd /c "npm run preview" }

Write-Host "⏳ Waiting for server to start..." -ForegroundColor Gray
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "✅ DEV ENVIRONMENT READY" -ForegroundColor Green
Write-Host "   App is running at: http://localhost:4173"
Write-Host ""
Write-Host "📋 INSTRUCTIONS/TEST PLAIN:" -ForegroundColor White
Write-Host "   1. Open http://localhost:4173 in your browser"
Write-Host "   2. You should see the Version Badge at the bottom of the sidebar"
Write-Host "   3. It should say 'Up to date'"
Write-Host ""
Write-Host "   Now, keep the browser open. We will simulate a new deployment."
Write-Host ""

while ($true) {
    $input = Read-Host "👉 Press ENTER to simulate a new version deployment (or 'q' to quit)"
    if ($input -eq 'q') { break }

    $timestamp = (Get-Date).ToFileTime()
    $json = @"
{
  "version": "$timestamp",
  "buildTime": "$(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")",
  "gitHash": "test-$(Get-Random -Minimum 1000 -Maximum 9999)",
  "environment": "simulation"
}
"@
    
    $json | Out-File "dist/version.json" -Encoding ascii
    
    Write-Host "🚀 DEPLOYED! New version ($timestamp) pushed to dist/version.json" -ForegroundColor Magenta
    Write-Host "👀 Check your browser - Update Toast should appear within 60 seconds (or click the badge/focus tab to force check)" -ForegroundColor Yellow
    Write-Host ""
}

Stop-Job $previewJob
Remove-Job $previewJob
Write-Host "👋 Verification environment closed." -ForegroundColor Cyan
