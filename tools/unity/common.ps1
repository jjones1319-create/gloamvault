# Shared helpers for the Unity wrappers (Phase 9; docs/10-TECH-PLAN.md s.7). Dot-source this file.
# Unity runs in batchmode only: James never opens the editor. Each run writes its own log under unity/Logs/
# and, on failure, prints the error lines from it so a failure is readable in the terminal.

$ErrorActionPreference = 'Stop'

$Script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Script:ProjectPath = Join-Path $RepoRoot 'unity'
$Script:UnityVersion = '6000.3.27f1'
$Script:EditorRoot = Join-Path $env:USERPROFILE 'Unity\Hub\Editor'

function Get-UnityExe {
    $versionFile = Join-Path $ProjectPath 'ProjectSettings\ProjectVersion.txt'
    $version = $UnityVersion
    if (Test-Path $versionFile) {
        $line = Get-Content $versionFile | Where-Object { $_ -match '^m_EditorVersion:\s*(\S+)' } | Select-Object -First 1
        if ($line -match '^m_EditorVersion:\s*(\S+)') { $version = $Matches[1] }
    }
    $exe = Join-Path $EditorRoot "$version\Editor\Unity.exe"
    if (-not (Test-Path $exe)) { throw "Unity $version is not installed at $exe (see CLAUDE.md -> Tools)." }
    return $exe
}

function Get-Adb {
    $adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
    if (-not (Test-Path $adb)) { throw "adb not found at $adb" }
    return $adb
}

function Get-KeysDir {
    return Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Gloamvault\keys'
}

# Prints the lines of a Unity log that explain a failure: compiler errors, exceptions, build and licence errors.
function Show-UnityErrors([string]$LogPath) {
    if (-not (Test-Path $LogPath)) { Write-Host "  (no log at $LogPath)"; return }
    $patterns = 'error CS\d+', 'Exception', '^\s*Error', 'BuildFailedException', 'Build Finished, Result: Failure',
        'No valid Unity Editor license', 'licens', 'Aborting batchmode', 'Scripts have compiler errors', '\[gv-setup\] FAILED'
    $hits = Select-String -Path $LogPath -Pattern $patterns | Select-Object -First 40
    if ($hits) { $hits | ForEach-Object { Write-Host ('  ' + $_.Line.Trim()) } }
    else { Get-Content $LogPath -Tail 30 | ForEach-Object { Write-Host "  $_" } }
}

# Runs the editor in batchmode on unity/. -NoQuit for -runTests (the test runner quits by itself).
function Invoke-Unity {
    param(
        [Parameter(Mandatory)][string]$Name,
        [string[]]$Arguments = @(),
        [switch]$NoQuit,
        [switch]$Android
    )
    $exe = Get-UnityExe
    $logDir = Join-Path $ProjectPath 'Logs'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $log = Join-Path $logDir "batch-$Name.log"
    $all = @('-batchmode', '-projectPath', $ProjectPath, '-logFile', $log)
    if ($Android) { $all += @('-buildTarget', 'Android') }
    if (-not $NoQuit) { $all += '-quit' }
    $all += $Arguments
    Write-Host "unity $Name ..."
    $sw = [Diagnostics.Stopwatch]::StartNew()
    # Start-Process joins arguments with spaces and does not quote them; the repo path has a space in it.
    $line = ($all | ForEach-Object { if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ } }) -join ' '
    $p = Start-Process -FilePath $exe -ArgumentList $line -NoNewWindow -PassThru -Wait
    $code = $p.ExitCode
    Write-Host ("unity $Name finished in {0:n0} s (exit {1})" -f $sw.Elapsed.TotalSeconds, $code)
    if ($code -ne 0) { Show-UnityErrors $log }
    return [pscustomobject]@{ ExitCode = $code; Log = $log }
}

# Reads a Unity test-results XML (NUnit 3) and prints the totals and every failure.
function Show-TestResults([string]$Path) {
    if (-not (Test-Path $Path)) { Write-Host "  no test results at $Path"; return $false }
    [xml]$x = Get-Content $Path
    $run = $x.'test-run'
    Write-Host ("  {0} tests: {1} passed, {2} failed, {3} skipped" -f $run.total, $run.passed, $run.failed, $run.skipped)
    $failed = $x.SelectNodes("//test-case[@result='Failed']")
    foreach ($t in $failed) {
        Write-Host ("  FAILED {0}" -f $t.fullname)
        $msg = $t.failure.message.'#cdata-section'
        if ($msg) { Write-Host ("    " + ($msg -split "`n" | Select-Object -First 4) -join "`n    ") }
    }
    return ([int]$run.failed -eq 0 -and [int]$run.total -gt 0)
}
