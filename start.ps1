$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root
$port = 8000
$url = "http://localhost:$port/?v=6"
Write-Host "成长日历正在启动：$url"
Start-Process $url
python -m http.server $port


