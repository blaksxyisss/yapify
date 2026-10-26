<#
.SYNOPSIS
  YapinMod 1-Click Windows PowerShell Installer
#>

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "   YapinMod Windows PowerShell Installer            " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

# Check Node.js
try {
  $nodeVer = & node -v
  Write-Host "[+] Found Node.js: $nodeVer" -ForegroundColor Green
} catch {
  Write-Host "[!] Error: Node.js is required to install YapinMod. Please install Node.js." -ForegroundColor Red
  Exit 1
}

# Run install.js
& node "$ScriptDir\install.js" @args

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "[OK] Installation completed successfully!" -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "[!] Installation encountered an error (code $LASTEXITCODE)." -ForegroundColor Red
}
