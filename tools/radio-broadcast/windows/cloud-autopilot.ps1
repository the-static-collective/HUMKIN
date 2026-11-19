# HUMKIN CLOUD AUTOPILOT — prepare on the Acer, let R2 keep playing.
# Windows PowerShell 5.1 supported. Uses the SAME DPAPI vault as Station One.
# No credentials are printed, logged to disk or embedded in the published program.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Plan,
    [switch]$Publish,
    [ValidateRange(30, 86400)]
    [int]$LeadSeconds = 120
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$RepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$PythonScript = Join-Path $RepoRoot 'tools\radio-broadcast\autopilot_publisher.py'
$VaultFile = Join-Path $env:LOCALAPPDATA 'HUMKIN\StationOne\r2-live-credentials.dpapi'
if (-not (Test-Path -LiteralPath $PythonScript)) { throw 'Use a complete updated HUMKIN repository checkout.' }
if (-not (Test-Path -LiteralPath $Plan)) { throw 'The approved track plan file does not exist.' }
if (Get-Command py -ErrorAction SilentlyContinue) {
    $Exe = 'py'
    $Prefix = @('-3')
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $Exe = 'python'
    $Prefix = @()
} else {
    throw 'Python 3 is required.'
}
$arguments = @($Prefix) + @($PythonScript, '--input', [IO.Path]::GetFullPath($Plan),
    '--lead-seconds', [string]$LeadSeconds)
if ($Publish) {
    if (-not (Test-Path -LiteralPath $VaultFile)) {
        throw 'Station One R2 encrypted vault not found. Set up the existing Tower R2 publisher first.'
    }
    Write-Host 'Cloud Autopilot will upload approved AAC segments and revise the scheduled cloud frequency.' -ForegroundColor Yellow
    Write-Host 'This does NOT change the public listener player or the ordinary live transmitter.'
    $answer = (Read-Host 'Type PUBLISH AUTOPILOT to commit the schedule').Trim()
    if ($answer -cne 'PUBLISH AUTOPILOT') {
        Write-Host 'No cloud publication made.'
        return
    }
    $pointer = [IntPtr]::Zero
    try {
        $cipher = ([IO.File]::ReadAllText($VaultFile)).Trim()
        $secure = ConvertTo-SecureString -String $cipher
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $json = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        $data = ConvertFrom-Json -InputObject $json
        if ($data.AccountId -notmatch '^[0-9a-fA-F]{32}$' -or
            [string]::IsNullOrWhiteSpace($data.AccessKeyId) -or
            [string]::IsNullOrWhiteSpace($data.SecretAccessKey)) {
            throw 'Saved R2 vault invalid.'
        }
        $env:CLOUDFLARE_ACCOUNT_ID = $data.AccountId
        $env:AWS_ACCESS_KEY_ID = $data.AccessKeyId
        $env:AWS_SECRET_ACCESS_KEY = $data.SecretAccessKey
        $arguments += '--publish'
        & $Exe @arguments
        if ($LASTEXITCODE -ne 0) { throw 'Cloud publisher failed; the existing station remains unchanged.' }
    } finally {
        if ($pointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        }
        Remove-Item Env:\CLOUDFLARE_ACCOUNT_ID,Env:\AWS_ACCESS_KEY_ID,Env:\AWS_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue
        $json = $null; $data = $null
    }
} else {
    Write-Host 'PREVIEW MODE: local media preparation only. No cloud credentials required.'
    & $Exe @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Preview/packaging failed.' }
}
