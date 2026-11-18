# HUMKIN STATION ONE - local Windows launch desk.
# No credentials are written to disk or submitted to GitHub.
[CmdletBinding()]
param(
    [ValidateSet('Menu', 'Check', 'Preview', 'Test', 'Broadcast')]
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
        & $entry.Exe @probe 2>$null
        if ($LASTEXITCODE -eq 0) { return $entry }
    }
    return $null
}

function Invoke-Python {
    param($Python, [string[]]$PythonArgs)
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
    & $python.Exe @zoneProbe
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
    $mount = (Read-Host 'Mount path [/humkin.mp3]').Trim()
    if (-not $mount) { $mount = '/humkin.mp3' }
    if ($mount -notmatch '^/[a-zA-Z0-9._/-]+$' -or $mount -match '//') {
        throw 'Enter a simple mount path beginning with /, such as /humkin.mp3.'
    }
    $password = Read-Host 'Private Icecast SOURCE password (not shown, not saved)' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        if ([string]::IsNullOrWhiteSpace($plain)) { throw 'Source password cannot be empty.' }
        $escaped = [Uri]::EscapeDataString($plain)
        $env:HUMKIN_ICECAST_URL = ('icecast://source:{0}@{1}:{2}{3}' -f $escaped, $hostname, $port, $mount)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $plain = $null
    }
    try {
        Write-Host 'Connecting over TLS only. Press Ctrl+C to stop. Do not share machine process listings.' -ForegroundColor Yellow
        Invoke-Python -Python $python -PythonArgs @($Engine, '--cache', $CacheDir)
    }
    finally { Remove-Item Env:\HUMKIN_ICECAST_URL -ErrorAction SilentlyContinue }
}

function Start-Menu {
    Write-Host ''
    Write-Host '  H U M K I N   /   S T A T I O N   O N E' -ForegroundColor Cyan
    Write-Host '  Acer Windows 10 - existing Python + FFmpeg radio engine'
    Write-Host ''
    Write-Host '  1  Check dependencies + live catalog (no transmission)'
    Write-Host '  2  Make and play a 45-second local radio preview'
    Write-Host '  3  Run offline broadcaster tests'
    Write-Host '  4  Broadcast to an ALREADY-SET-UP Icecast source'
    Write-Host '  Q  Quit'
    $choice = (Read-Host 'Select 1-4 or Q').Trim().ToUpperInvariant()
    switch ($choice) {
        '1' { Check-Station }
        '2' { Make-Preview }
        '3' { Run-Tests }
        '4' { Start-Broadcast }
        'Q' { return }
        default { Write-Host 'No change; choose 1-4 or Q.' }
    }
}

try {
    switch ($Action) {
        'Menu' { Start-Menu }
        'Check' { Check-Station }
        'Preview' { Make-Preview }
        'Test' { Run-Tests }
        'Broadcast' { Start-Broadcast }
    }
}
catch {
    Write-Host "Station One stopped: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
