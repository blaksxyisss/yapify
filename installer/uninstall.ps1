<#
.SYNOPSIS
  YapinMod 1-Click Windows PowerShell Uninstaller
#>

Write-Host "====================================================" -ForegroundColor Yellow
Write-Host "   YapinMod Windows PowerShell Uninstaller          " -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Yellow
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

try {
  & node "$ScriptDir\uninstall.js" @args
} catch {
  Write-Host "[!] Error running uninstall script: $_" -ForegroundColor Red
  Exit 1
}

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "[OK] Uninstallation completed successfully!" -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "[!] Uninstallation encountered an error." -ForegroundColor Red
}
