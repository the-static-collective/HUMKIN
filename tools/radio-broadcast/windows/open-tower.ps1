[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$registrations = Join-Path $env:LOCALAPPDATA 'HUMKIN\Tower\active'
$running = @(Get-ChildItem -LiteralPath $registrations -Filter '*.json' -ErrorAction SilentlyContinue |
    Sort-Object @{Expression = { if ($_.BaseName -ceq 'station-one') { 0 } else { 1 } } }, Name)
foreach ($entry in $running) {
    try {
        $station = Get-Content -LiteralPath $entry.FullName -Raw | ConvertFrom-Json
        $port = [int]$station.port
        if ($port -lt 1 -or $port -gt 65535) { continue }
        $url = "http://127.0.0.1:$port/"
        $headers = @{'X-Station-Control' = [string]$station.token}
        Invoke-RestMethod -Uri ($url + 'state?summary=1') -Headers $headers -TimeoutSec 2 | Out-Null
        Start-Process $url
        exit 0
    }
    catch { continue }
}
Write-Host 'No Tower-enabled frequency is running. Open START-HUMKIN-LIVE.cmd first.'
exit 1

