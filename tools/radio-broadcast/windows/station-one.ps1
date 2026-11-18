# HUMKIN STATION ONE - local Windows launch desk.
# No credentials are written to disk or submitted to GitHub.
[CmdletBinding()]
param(
    [ValidateSet('Menu', 'Check', 'Preview', 'Test', 'Broadcast', 'R2Hls', 'Preflight')]
    [string]$Action = 'Menu'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$RepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$Engine = Join-Path $RepoRoot 'tools\radio-broadcast\engine.py'
$TestScript = Join-Path $RepoRoot 'tests\radio-broadcast.test.py'
$HomeDir = Join-Path $env:LOCALAPPDATA 'HUMKIN\StationOne'
$CacheDir = Join-Path $HomeDir 'cache'
$PreviewFile = Join-Path $HomeDir 'station-one-preview.mp3'

function Get-PythonCommand {
    $candidate = @(
        @{ Exe = 'py'; Prefix = @('-3') },
        @{ Exe = 'python'; Prefix = @() }
    )
    foreach ($entry in $candidate) {
        if (-not (Get-Command $entry.Exe -ErrorAction SilentlyContinue)) { continue }
        $probe = @($entry.Prefix) + @('-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 2)')
        # Do not permit a child process to contribute output to the return value.
        & $entry.Exe @probe 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return $entry }
    }
    return $null
}

function Invoke-Python {
    param($Python, [string[]]$PythonArgs)
    if ($Python -isnot [hashtable] -or -not $Python.ContainsKey('Exe') -or -not $Python.ContainsKey('Prefix')) {
        throw 'Invalid Python launcher configuration (expected one launcher hashtable).'
    }
    $commandArgs = @($Python.Prefix) + $PythonArgs
    & $Python.Exe @commandArgs
    if ($LASTEXITCODE -ne 0) { throw "Python exited with code $LASTEXITCODE." }
}

function Test-Dependencies {
    if (-not (Test-Path -LiteralPath $Engine)) {
        Write-Host 'Missing engine.py. Download and extract the COMPLETE HUMKIN repository ZIP (not just this launcher).' -ForegroundColor Red
        return $null
    }
    $python = Get-PythonCommand
    if ($null -eq $python) {
        Write-Host 'Python 3.9+ not found. Install Python, reopen this window, and try again.' -ForegroundColor Red
        Write-Host 'On Windows with winget: winget install --id Python.Python.3.14 -e'
        return $null
    }
    Write-Host "Python: $($python.Exe) $($python.Prefix -join ' ')"
    # Windows PowerShell 5.1 strips nested quotes from Python -c arguments.
    # Invoke a real Python file rather than a string passed through cmd.exe.
    $zoneCheck = Join-Path $PSScriptRoot 'check_timezone.py'
    if (-not (Test-Path -LiteralPath $zoneCheck)) {
        throw 'Missing check_timezone.py. Extract the COMPLETE current HUMKIN ZIP into a new folder.'
    }
    $zoneProbe = @($python.Prefix) + @($zoneCheck)
    # This Python helper prints a success line. PowerShell functions return
    # every item written to the success stream; without Out-Host that string
    # gets captured together with the launcher hashtable and breaks .Prefix.
    # Show the status to the operator without returning it as function data.
    & $python.Exe @zoneProbe | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Central timezone check failed. If Python reported missing timezone data, install:' -ForegroundColor Yellow
        Write-Host "  $($python.Exe) $($python.Prefix -join ' ') -m pip install --user tzdata"
        return $null
    }
    if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue) -or
        -not (Get-Command ffprobe -ErrorAction SilentlyContinue)) {
        Write-Host 'FFmpeg and ffprobe must be installed and available on PATH.' -ForegroundColor Yellow
        Write-Host 'On Windows with winget: winget install --id Gyan.FFmpeg -e'
        Write-Host 'After installing, close and reopen this launcher.'
        return $null
    }
    Write-Host 'FFmpeg and ffprobe: found.' -ForegroundColor Green
    New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
    return $python
}

function Invoke-PreflightSmoke {
    Write-Host "`n=== HUMKIN STATION ONE : OFFLINE PREFLIGHT SMOKE TEST ===" -ForegroundColor Cyan
    $python = Test-Dependencies
    if ($null -eq $python) { throw 'Preflight dependencies unavailable.' }
    if ($python -isnot [hashtable]) { throw 'Preflight returned more than the Python configuration object.' }
    # This exercises the same Invoke-Python path as 'Check', without contacting
    # the catalog or loading/playing any recordings.
    Invoke-Python -Python $python -PythonArgs @($Engine, '--help')
    Write-Host 'PREFLIGHT SMOKE TEST PASSED.' -ForegroundColor Green
}

function Check-Station {
    Write-Host "`n=== HUMKIN STATION ONE : READ-ONLY CHECK ===" -ForegroundColor Cyan
    $python = Test-Dependencies
    if ($null -eq $python) { return }
    Write-Host 'Checking the actual public catalog and Supabase schedule; no audio downloads or transmission.'
    Invoke-Python -Python $python -PythonArgs @($Engine, '--dry-run', '--cache', $CacheDir)
    Write-Host 'READ-ONLY CHECK PASSED.' -ForegroundColor Green
}

function Make-Preview {
    Write-Host "`n=== HUMKIN STATION ONE : 45-SECOND LOCAL AUDIO ===" -ForegroundColor Cyan
    $python = Test-Dependencies
    if ($null -eq $python) { return }
    Write-Host 'This downloads approved public listening copies into your private local cache.'
    Write-Host 'This does NOT broadcast to anyone, update the website, or publish any song.'
    Invoke-Python -Python $python -PythonArgs @($Engine, '--cache', $CacheDir, '--file-output', $PreviewFile, '--seconds', '45', '--crossfade', '1.5')
    if (-not (Test-Path -LiteralPath $PreviewFile)) { throw 'Preview did not produce an MP3.' }
    Write-Host "LOCAL PREVIEW READY: $PreviewFile" -ForegroundColor Green
    Start-Process -FilePath $PreviewFile
}

function Run-Tests {
    Write-Host "`n=== HUMKIN STATION ONE : OFFLINE TESTS ===" -ForegroundColor Cyan
    $python = Test-Dependencies
    if ($null -eq $python) { return }
    Push-Location $RepoRoot
    try {
        Invoke-Python -Python $python -PythonArgs @($TestScript)
        $V2Tests = Join-Path $RepoRoot 'tests\station-one-v2.test.py'
        Invoke-Python -Python $python -PythonArgs @($V2Tests)
    }
    finally { Pop-Location }
}

function Test-SourceTls {
    param([string]$Hostname, [int]$Port)
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $async = $client.BeginConnect($Hostname, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(8000)) {
            throw 'Connection timed out.'
        }
        $client.EndConnect($async)
        $client.ReceiveTimeout = 8000
        $client.SendTimeout = 8000
        $network = $client.GetStream()
        $network.ReadTimeout = 8000
        $network.WriteTimeout = 8000
        $tls = [System.Net.Security.SslStream]::new($network, $false)
        try {
            # AuthenticateAsClient validates the provider certificate and
            # hostname before any source password is requested or transmitted.
            $tls.AuthenticateAsClient($Hostname)
            if (-not $tls.IsAuthenticated -or -not $tls.IsEncrypted) {
                throw 'TLS was not authenticated or encrypted.'
            }
            Write-Host 'Encrypted source ingest and hostname certificate: verified.' -ForegroundColor Green
        }
        finally { $tls.Dispose() }
    }
    catch {
        throw ('Source ingest TLS check failed on ' + $Hostname + ':' + $Port +
            '. Request an encrypted Icecast SOURCE port from the radio host. ' +
            'An HTTPS listener URL alone is not sufficient. Details: ' + $_.Exception.Message)
    }
    finally { $client.Dispose() }
}

function Check-PublicListener {
    Write-Host "`n=== HUMKIN STATION ONE : PUBLIC HTTPS LISTENER CHECK ===" -ForegroundColor Cyan
    $python = Test-Dependencies
    if ($null -eq $python) { return }
    $preflight = Join-Path $RepoRoot 'tools\radio-broadcast\host_preflight.py'
    if (-not (Test-Path -LiteralPath $preflight)) { throw 'Missing host_preflight.py. Update your HUMKIN ZIP.' }
    $stream = (Read-Host 'Public HTTPS listener MP3 URL (no passwords)').Trim()
    if (-not $stream.StartsWith('https://')) { throw 'Use the public HTTPS listener URL, not the private source address.' }
    $nowPlaying = (Read-Host 'Optional AzuraCast HTTPS now-playing API URL [Enter to skip]').Trim()
    $arguments = @($preflight,'--stream-url',$stream)
    if ($nowPlaying) { $arguments += @('--nowplaying-url',$nowPlaying) }
    Invoke-Python -Python $python -PythonArgs $arguments
    Write-Host 'Public stream check complete. This does NOT automatically publish a website change.' -ForegroundColor Green
}

function Start-Broadcast {
    Write-Host "`n=== HUMKIN STATION ONE : EXTERNAL ICECAST SOURCE ===" -ForegroundColor Yellow
    $python = Test-Dependencies
    if ($null -eq $python) { return }
    Write-Host 'Requires YOUR existing Icecast-compatible source account and radio-use permission.'
    Write-Host 'No public stream host is automatically created or paid for.'
    Write-Host 'Python v2 includes release/seasonal weights, phi breaks and optional Top 42.'
    Write-Host 'Blue Lemon priority queue and exact browser clock matching are NOT connected.'
    Write-Host 'An Icecast SOURCE host supporting TLS ingest is required; default port 8000 may not support it.'
    Write-Host 'Warning: FFmpeg exposes the source URL to other local administrators in its process arguments.'
    $answer = Read-Host 'Do you have an authorized live source endpoint and want to transmit now? Type ON AIR'
    if ($answer -cne 'ON AIR') { Write-Host 'Broadcast cancelled.'; return }
    $hostname = (Read-Host 'Icecast source hostname only (e.g. example.org)').Trim()
    if ($hostname -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]*$') {
        throw 'Enter a hostname only, without scheme, credentials, path or spaces.'
    }
    $portText = (Read-Host 'Source port [8000]').Trim()
    if (-not $portText) { $portText = '8000' }
    $port = 0
    if (-not [int]::TryParse($portText, [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
        throw 'Port must be a number from 1 to 65535.'
    }
    $username = (Read-Host 'Source username [source]').Trim()
    if (-not $username) { $username = 'source' }
    if ($username -notmatch '^[a-zA-Z0-9._-]{1,64}$') {
        throw 'Use the source username shown by your radio host (letters, numbers, dots, underscores or hyphens).'
    }
    $mount = (Read-Host 'Mount path [/humkin.mp3]').Trim()
    if (-not $mount) { $mount = '/humkin.mp3' }
    if ($mount -notmatch '^/[a-zA-Z0-9._/-]+$' -or $mount -match '//') {
        throw 'Enter a simple mount path beginning with /, such as /humkin.mp3.'
    }
    $bitrateText = (Read-Host 'MP3 bitrate kbps: 96 / 128 / 160 / 192 [96 for free hosts]').Trim()
    if (-not $bitrateText) { $bitrateText = '96' }
    if (@('96','128','160','192') -cnotcontains $bitrateText) {
        throw 'Choose 96, 128, 160 or 192 kbps to match your provider plan.'
    }
    Write-Host 'Checking source-side TLS without sending credentials...' -ForegroundColor Cyan
    Test-SourceTls -Hostname $hostname -Port $port
    $password = Read-Host 'Private Icecast SOURCE password (not shown, not saved)' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        if ([string]::IsNullOrWhiteSpace($plain)) { throw 'Source password cannot be empty.' }
        $escaped = [Uri]::EscapeDataString($plain)
        $env:HUMKIN_ICECAST_URL = ('icecast://{0}:{1}@{2}:{3}{4}' -f [Uri]::EscapeDataString($username), $escaped, $hostname, $port, $mount)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $plain = $null
    }
    try {
        Write-Host 'Connecting over TLS only. Press Ctrl+C to stop. Do not share machine process listings.' -ForegroundColor Yellow
        Invoke-Python -Python $python -PythonArgs @($Engine, '--cache', $CacheDir, '--bitrate', $bitrateText)
    }
    finally { Remove-Item Env:\HUMKIN_ICECAST_URL -ErrorAction SilentlyContinue }
}

function Start-R2Hls {
    Write-Host ''
    Write-Host '=== HUMKIN STATION ONE : R2 LIVE HLS TEST ===' -ForegroundColor Cyan
    $python = Test-Dependencies
    if ($null -eq $python) { return }
    $publisher = Join-Path $RepoRoot 'tools\radio-broadcast\hls_push.py'
    if (-not (Test-Path -LiteralPath $publisher)) {
        throw 'Missing hls_push.py. Update the complete HUMKIN repository before continuing.'
    }
    Write-Host 'Requires R2 S3 API credentials for your dedicated humkin-radio-live bucket.'
    Write-Host 'Use a bucket-scoped R2 token that cannot modify the permanent music archive.'
    Write-Host 'This test publishes a short rolling HLS stream to R2. Upload operations may be billable.'
    Write-Host 'It will NOT redirect the existing website or Android station.'
    $choice = Read-Host 'Type R2 TEST to publish a supervised 70-second experiment'
    if ($choice -cne 'R2 TEST') { Write-Host 'No R2 upload started.'; return }
    $env:CLOUDFLARE_ACCOUNT_ID = (Read-Host 'Cloudflare Account ID').Trim()
    $env:AWS_ACCESS_KEY_ID = (Read-Host 'R2 S3 Access Key ID').Trim()
    $secret = Read-Host 'R2 S3 Secret Access Key (hidden, not saved)' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try {
        $env:AWS_SECRET_ACCESS_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    try {
        Write-Host 'Sending only complete station segments to R2 over HTTPS. Ctrl+C cancels.' -ForegroundColor Yellow
        Invoke-Python -Python $python -PythonArgs @($publisher, '--cache', $CacheDir, '--seconds', '70')
        Write-Host 'Test finished. The Worker must be independently deployed and verified.' -ForegroundColor Green
    }
    finally {
        Remove-Item Env:\AWS_SECRET_ACCESS_KEY,Env:\AWS_ACCESS_KEY_ID,Env:\CLOUDFLARE_ACCOUNT_ID -ErrorAction SilentlyContinue
    }
}

function Start-Menu {
    Write-Host ''
    Write-Host '  H U M K I N   /   S T A T I O N   O N E' -ForegroundColor Cyan
    Write-Host '  Acer Windows 10 - existing Python + FFmpeg radio engine'
    Write-Host ''
    Write-Host '  1  Check dependencies + live catalog (no transmission)'
    Write-Host '  2  Make and play a 45-second local radio preview'
    Write-Host '  3  Run offline broadcaster tests'
    Write-Host '  4  Broadcast to an ALREADY-SET-UP encrypted Icecast source'
    Write-Host '  5  Verify a PUBLIC HTTPS listener URL (read-only)'
    Write-Host '  6  Test a shared live station through our existing Cloudflare R2 bucket'
    Write-Host '  Q  Quit'
    $choice = (Read-Host 'Select 1-6 or Q').Trim().ToUpperInvariant()
    switch ($choice) {
        '1' { Check-Station }
        '2' { Make-Preview }
        '3' { Run-Tests }
        '4' { Start-Broadcast }
        '5' { Check-PublicListener }
        '6' { Start-R2Hls }
        'Q' { return }
        default { Write-Host 'No change; choose 1-6 or Q.' }
    }
}

try {
    switch ($Action) {
        'Menu' { Start-Menu }
        'Check' { Check-Station }
        'Preview' { Make-Preview }
        'Test' { Run-Tests }
        'Broadcast' { Start-Broadcast }
        'R2Hls' { Start-R2Hls }
        'Preflight' { Invoke-PreflightSmoke }
    }
}
catch {
    Write-Host "Station One stopped: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
