# Gurudatta Kirana and General Stores - PowerShell Launcher
Set-Location -Path $PSScriptRoot

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "    GURUDATTA KIRANA AND GENERAL STORES - SHOP MANAGEMENT SYSTEM" -ForegroundColor Yellow
Write-Host "===================================================================" -ForegroundColor Cyan

# Find local IP address
try {
    $socket = New-Object System.Net.Sockets.Socket([System.Net.Sockets.AddressFamily]::InterNetwork, [System.Net.Sockets.SocketType]::Dgram, [System.Net.Sockets.ProtocolType]::Udp)
    $socket.Connect("8.8.8.8", 80)
    $localIP = $socket.LocalEndPoint.Address.ToString()
    $socket.Close()
} catch {
    $localIP = "127.0.0.1"
}

Write-Host ""
Write-Host "💻 Laptop / Desktop URL : http://127.0.0.1:5000" -ForegroundColor Green
Write-Host "📱 Mobile Phone URL     : http://$($localIP):5000" -ForegroundColor Magenta
Write-Host ""
Write-Host "Connect your mobile phone to the same Wi-Fi network and open the Mobile URL." -ForegroundColor White
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

# Open browser after 2 seconds
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://127.0.0.1:5000"
} | Out-Null

python app.py
