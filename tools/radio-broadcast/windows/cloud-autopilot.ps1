# HUMKIN CLOUD AUTOPILOT — prepare on the Acer, let R2 keep playing.
# Windows PowerShell 5.1 supported. Uses the SAME DPAPI vault as Station One.
# No credentials are printed, logged to disk or embedded in the published program.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, ParameterSetName = "FromPlan")]
    [string]$Plan,
    [Parameter(Mandatory = $true, ParameterSetName = "FromTower")]
    [string]$TowerProgram,
    [Parameter(Mandatory = $true, ParameterSetName = "FromHouse")]
    [string]$HouseSelection,
    [switch]$Publish,
    [string]$ApprovedPacket = '',
    [ValidateRange(30, 86400)]
    [int]$LeadSeconds = 120
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$RepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$PythonScript = Join-Path $RepoRoot 'tools\radio-broadcast\autopilot_publisher.py'
$VaultFile = Join-Path $env:LOCALAPPDATA 'HUMKIN\StationOne\r2-live-credentials.dpapi'
if (-not (Test-Path -LiteralPath $PythonScript)) { throw 'Use a complete updated HUMKIN repository checkout.' }
if ($PSCmdlet.ParameterSetName -eq 'FromTower') {
    if (-not (Test-Path -LiteralPath $TowerProgram)) { throw 'Tower program handoff not found.' }
    if ($ApprovedPacket) { throw 'A Tower exact-order program cannot be combined with a Gambit packet.' }
} elseif ($PSCmdlet.ParameterSetName -eq 'FromHouse') {
    if (-not (Test-Path -LiteralPath $HouseSelection)) { throw 'Reviewed HOUSE selection file not found.' }
    if ($ApprovedPacket) { throw 'HOUSE rotation and Gambit guest proposal are separate actions.' }
} elseif (-not (Test-Path -LiteralPath $Plan)) {
    throw 'The approved track plan file does not exist.'
}
if (Get-Command py -ErrorAction SilentlyContinue) {
    $Exe = 'py'
    $Prefix = @('-3')
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $Exe = 'python'
    $Prefix = @()
} else {
    throw 'Python 3 is required.'
}
$arguments = @($Prefix) + @($PythonScript, '--lead-seconds', [string]$LeadSeconds)
if ($PSCmdlet.ParameterSetName -eq 'FromTower') {
    $arguments += @('--tower-program', [IO.Path]::GetFullPath($TowerProgram))
} elseif ($PSCmdlet.ParameterSetName -eq 'FromHouse') {
    $arguments += @('--house-selection', [IO.Path]::GetFullPath($HouseSelection))
} else {
    $arguments += @('--input', [IO.Path]::GetFullPath($Plan))
}
if ($ApprovedPacket) {
    if (-not (Test-Path -LiteralPath $ApprovedPacket)) { throw 'Reviewed Gambit packet not found.' }
    $arguments += @('--approved-packet', [IO.Path]::GetFullPath($ApprovedPacket))
}
if ($Publish) {
    if (-not (Test-Path -LiteralPath $VaultFile)) {
        throw 'Station One R2 encrypted vault not found. Set up the existing Tower R2 publisher first.'
    }
    Write-Host 'Cloud Autopilot will upload approved AAC segments and revise the scheduled cloud frequency.' -ForegroundColor Yellow
    Write-Host 'This does NOT change the public listener player or the ordinary live transmitter.'
    if ($ApprovedPacket) { Write-Host 'A guest Gambit window and an automatic house return will be published, after owner review.' }
    if ($PSCmdlet.ParameterSetName -eq 'FromHouse') {
        Write-Host 'Approved public R2 HOUSE entries will be rechecked, encoded, and scheduled at the next song boundary.'
        Write-Host 'This replaces the current short HOUSE cycle; no permanent source MP3s are downloaded.'
    }
    if ($PSCmdlet.ParameterSetName -eq 'FromTower') {
        Write-Host 'A saved Tower show will play in exact order, then return to the existing house program.'
        Write-Host 'Review the selected show, requested Central date/time and imported audio before approving.'
    }
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
    if ($PSCmdlet.ParameterSetName -eq 'FromTower') { Write-Host 'This is an UNAPPROVED Tower handoff, not a scheduled broadcast.' }
    & $Exe @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Preview/packaging failed.' }
}
