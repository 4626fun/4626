# Run in elevated PowerShell on Windows (right-click -> Run as administrator):
#   powershell -ExecutionPolicy Bypass -File "\\wsl.localhost\Ubuntu-24.04\home\akitav2\projects\4626\frontend\scripts\windows-localhost-portproxy.ps1"
#
# Forwards Windows http://localhost:5174 -> WSL Vite (when classic WSL forwarding is broken).
# Browser origin stays localhost so Privy embedded wallets work.

$ErrorActionPreference = 'Stop'
$port = 5174
$wslIp = (wsl -e bash -lc "hostname -I | awk '{print `$1}'").Trim()
if (-not $wslIp) { throw 'Could not resolve WSL IP from hostname -I' }
Write-Host "WSL IP: $wslIp"
netsh interface portproxy delete v4tov4 listenaddress=127.0.0.1 listenport=$port | Out-Null
netsh interface portproxy add v4tov4 listenaddress=127.0.0.1 listenport=$port connectaddress=$wslIp connectport=$port
netsh interface portproxy show v4tov4
Write-Host ""
Write-Host "Done. Open http://localhost:$port/waitlist in your browser."
