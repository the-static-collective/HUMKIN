# Station One managed background HLS. Dot-sourced by station-one.ps1.
# No R2 credentials appear in arguments, local status files or logs.
$R2StationScript = Join-Path $PSScriptRoot 'station-one.ps1'
$R2LiveState = Join-Path $HomeDir 'live-run-state.json'
$R2LiveStop = Join-Path $HomeDir 'live-stop-request.txt'
$R2LiveOut = Join-Path $HomeDir 'live-output.log'
$R2LiveErr = Join-Path $HomeDir 'live-errors.log'

function Get-ActiveR2LiveRun {
    if (-not (Test-Path -LiteralPath $R2LiveState)) { return $null }
    try {
        $state = Get-Content -LiteralPath $R2LiveState -Raw | ConvertFrom-Json
        if ($state.RunId -notmatch '^[0-9a-f]{32}$' -or [int]$state.ProcessId -le 0 -or
            $state.StartTicks -notmatch '^\d{15,20}$') { return $null }
        $proc = Get-Process -Id ([int]$state.ProcessId) -ErrorAction Stop
        if ([string]$proc.StartTime.ToUniversalTime().Ticks -cne [string]$state.StartTicks) {
            return $null # A stale PID may belong to a different program.
        }
        return $state
    }
    catch { return $null }
}

function Show-R2LiveStatus {
    $state = Get-ActiveR2LiveRun
    if ($null -eq $state) {
        Write-Host 'Managed HUMKIN live transmitter: OFFLINE.' -ForegroundColor Yellow
    }
    else {
        Write-Host "Managed HUMKIN live transmitter: RUNNING (PID $($state.ProcessId))." -ForegroundColor Green
    }
    Write-Host 'This checks the local process, not whether the phone is receiving audio.'
    if (Test-Path -LiteralPath $R2LiveOut) {
        Write-Host 'Recent station output:' -ForegroundColor Cyan
        Get-Content -LiteralPath $R2LiveOut -Tail 10 | Out-Host
    }
    if ((Test-Path -LiteralPath $R2LiveErr) -and
        (Get-Item -LiteralPath $R2LiveErr).Length -gt 0) {
        Write-Host 'Recent warnings:' -ForegroundColor Yellow
        Get-Content -LiteralPath $R2LiveErr -Tail 6 | Out-Host
    }
}

function Run-R2LiveChild {
    if ($RunId -cnotmatch '^[0-9a-f]{32}$') { throw 'Missing valid managed live run ID.' }
    $python = Test-Dependencies
    if ($null -eq $python) { throw 'Python or FFmpeg unavailable.' }
    $data = Load-R2Credentials
    if ($null -eq $data) { throw 'No saved R2 keys. Use Station One menu option 8 first.' }
    $publisher = Join-Path $RepoRoot 'tools\radio-broadcast\hls_push.py'
    if (-not (Test-Path -LiteralPath $publisher)) { throw 'HLS uploader not found in HUMKIN ZIP.' }
    try {
        $env:CLOUDFLARE_ACCOUNT_ID = $data.AccountId
        $env:AWS_ACCESS_KEY_ID = $data.AccessKeyId
        $env:AWS_SECRET_ACCESS_KEY = $data.SecretAccessKey
        Write-Host 'HUMKIN LIVE: Continuous R2 transmission starting.' -ForegroundColor Green
        Invoke-Python -Python $python -PythonArgs @(
            $publisher, '--cache', $CacheDir, '--stop-file', $R2LiveStop, '--run-id', $RunId
        )
        Write-Host 'HUMKIN LIVE: Broadcast stopped.' -ForegroundColor Green
    }
    finally {
        Remove-Item Env:\AWS_SECRET_ACCESS_KEY,Env:\AWS_ACCESS_KEY_ID,Env:\CLOUDFLARE_ACCOUNT_ID -ErrorAction SilentlyContinue
        $data = $null
        # Do not erase a newer run's state if this run finishes late.
        if (Test-Path -LiteralPath $R2LiveState) {
            try {
                $saved = Get-Content -LiteralPath $R2LiveState -Raw | ConvertFrom-Json
                if ($saved.RunId -ceq $RunId) {
                    Remove-Item -LiteralPath $R2LiveState -Force
                }
            }
            catch { }
        }
    }
}

function Start-R2LiveManaged {
    Write-Host '=== HUMKIN RADIO : START CONTINUOUS R2 LIVE ===' -ForegroundColor Cyan
    $existing = Get-ActiveR2LiveRun
    if ($null -ne $existing) {
        Write-Host "HUMKIN is already broadcasting (PID $($existing.ProcessId))." -ForegroundColor Yellow
        return
    }
    $python = Test-Dependencies
    if ($null -eq $python) { throw 'Station One dependencies unavailable.' }
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'tools\radio-broadcast\hls_push.py'))) {
        throw 'HLS uploader missing. Download the complete HUMKIN branch ZIP.'
    }
    # The encrypted vault survives new ZIP downloads and extraction folders.
    if (-not (Test-Path -LiteralPath $R2VaultFile)) {
        $onboard = Setup-R2Credentials
        $onboard = $null
    }
    $checked = Load-R2Credentials
    if ($null -eq $checked) { throw 'R2 credentials not configured.' }
    $checked = $null
    Write-Host 'Continuous publishing incurs R2 usage. It does not change website/app defaults.'
    $confirm = Read-Host 'Type ON AIR to launch the continuous broadcast'
    if ($confirm -cne 'ON AIR') { Write-Host 'Launch cancelled.'; return }
    New-Item -ItemType Directory -Path $HomeDir -Force | Out-Null
    Remove-Item -LiteralPath $R2LiveStop,$R2LiveState -Force -ErrorAction SilentlyContinue
    $identity = [guid]::NewGuid().ToString('N')
    $arguments = @('-NoProfile','-ExecutionPolicy','Bypass',
                   '-File',('"' + $R2StationScript + '"'),'-Action','RunR2','-RunId',$identity)
    # The child decrypts the Windows user's vault. No secret is passed on CLI.
    $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput $R2LiveOut -RedirectStandardError $R2LiveErr -PassThru
    $state = [pscustomobject]@{
        RunId = $identity
        ProcessId = $proc.Id
        StartTicks = [string]$proc.StartTime.ToUniversalTime().Ticks
    }
    [IO.File]::WriteAllText($R2LiveState, ($state | ConvertTo-Json -Compress), [Text.Encoding]::UTF8)
    Start-Sleep -Seconds 2
    if ($null -eq (Get-ActiveR2LiveRun)) {
        Show-R2LiveStatus
        throw 'HUMKIN transmitter exited during startup. Inspect live-errors.log.'
    }
    Write-Host 'Station One live process launched; no keys need re-entry.' -ForegroundColor Green
    Write-Host 'Use STOP-HUMKIN-LIVE.cmd or menu option 9 to stop; menu option 0 shows logs.'
}

function Stop-R2LiveManaged {
    $state = Get-ActiveR2LiveRun
    if ($null -eq $state) {
        Write-Host 'No managed HUMKIN R2 broadcast is currently running.' -ForegroundColor Yellow
        return
    }
    # Cooperative, run-specific stop, not a forced process-tree kill.
    [IO.File]::WriteAllText($R2LiveStop, [string]$state.RunId, [Text.Encoding]::UTF8)
    Write-Host 'STOP requested. Station One will finish its current audio segment.' -ForegroundColor Green
    Write-Host 'Check option 0 for OFFLINE; Worker HLS status becomes stale after 90 seconds.'
}

function Test-R2LiveControl {
    # Offline CI test with a fake run owned by the current PowerShell process.
    New-Item -ItemType Directory -Path $HomeDir -Force | Out-Null
    if (Test-Path -LiteralPath $R2LiveState) { throw 'Refusing to overwrite existing run state.' }
    $proc = Get-Process -Id $PID
    $fake = [pscustomobject]@{
        RunId = [guid]::NewGuid().ToString('N')
        ProcessId = $PID
        StartTicks = [string]$proc.StartTime.ToUniversalTime().Ticks
    }
    try {
        [IO.File]::WriteAllText($R2LiveState, ($fake | ConvertTo-Json -Compress), [Text.Encoding]::UTF8)
        $found = Get-ActiveR2LiveRun
        if ($null -eq $found -or $found.RunId -cne $fake.RunId) {
            throw 'Managed station run lookup failed.'
        }
        Stop-R2LiveManaged
        if ([IO.File]::ReadAllText($R2LiveStop) -cne $fake.RunId) {
            throw 'Managed stop marker was not scoped to this run.'
        }
        Write-Host 'WINDOWS MANAGED LIVE START/STOP SELF-TEST PASSED.' -ForegroundColor Green
    }
    finally {
        Remove-Item -LiteralPath $R2LiveState,$R2LiveStop -Force -ErrorAction SilentlyContinue
    }
}
