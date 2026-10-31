# npm run unity:soak - the phone soak (Phase 14, D-156, D-163): starts the installed app on the test level with the
# pilot walking for -Minutes at -Fps, follows the phone log (polled, appended to unity/soak/<date>-<fps>fps.log so
# logcat's ring buffer loses nothing), reads the battery once a minute, and prints the soak-done numbers at the end.
# -Rooms and -Seed shape the level (defaults 60 rooms, seed 1). ASCII only (PowerShell 5.1).
param([int]$Minutes = 10, [int]$Fps = 60, [int]$Rooms = 60, [int]$Seed = 1, [int]$TimeoutSeconds = 0)
. (Join-Path $PSScriptRoot 'common.ps1')

$adb = Get-Adb
$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\tdevice$' }
if (-not $devices) { & $adb devices; throw 'No phone found (plugged in, USB debugging on, this computer allowed?).' }
if ($TimeoutSeconds -le 0) { $TimeoutSeconds = $Minutes * 60 + 120 }

$package = 'com.gloamvault.game'
$resolved = & $adb shell cmd package resolve-activity --brief $package | Select-Object -Last 1
$activity = "$resolved".Trim()
if ($activity -notmatch '^[\w.]+/[\w.]+$') { throw "Could not find the app's activity (is it installed? got: $activity)" }

$outDir = Join-Path $ProjectPath 'soak'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$logPath = Join-Path $outDir "$stamp-${Fps}fps.log"

function Read-Battery {
    $battery = & $adb shell dumpsys battery
    $temp = $null; $level = $null
    $t = ($battery | Where-Object { $_ -match 'temperature:\s*(\d+)' } | Select-Object -First 1)
    if ($t -match 'temperature:\s*(\d+)') { $temp = [int]$Matches[1] / 10 }
    $l = ($battery | Where-Object { $_ -match 'level:\s*(\d+)' } | Select-Object -First 1)
    if ($l -match 'level:\s*(\d+)') { $level = [int]$Matches[1] }
    return [pscustomobject]@{ Temp = $temp; Level = $level }
}

& $adb shell am force-stop $package | Out-Null
& $adb logcat -G 16M | Out-Null
& $adb logcat -c
$startBattery = Read-Battery
& $adb shell am start -n $activity --es gv soak --ei minutes $Minutes --ei rooms $Rooms --ei seed $Seed --ei fps $Fps | Out-Null
Write-Host ("Soak started on the phone: {0} min at {1} fps, {2} rooms, seed {3} (battery {4}% at {5:n1} C)" -f $Minutes, $Fps, $Rooms, $Seed, $startBattery.Level, $startBattery.Temp)
Write-Host "  log: $logPath"

$started = Get-Date
$seen = @{}
$done = $null
$lastBattery = Get-Date
$battery = @()
"# soak $stamp: $Minutes min at $Fps fps, $Rooms rooms, seed $Seed" | Out-File -FilePath $logPath -Encoding ascii
while (-not $done) {
    Start-Sleep -Seconds 15
    $all = & $adb logcat -d -s Unity:V
    $lines = $all | Where-Object { $_ -match '\[gv\] \{' } | ForEach-Object { ($_ -replace '^.*?\[gv\]\s*', '') }
    $new = @()
    foreach ($line in $lines) { if (-not $seen.ContainsKey($line)) { $seen[$line] = $true; $new += $line } }
    if ($new.Count -gt 0) { $new | Out-File -FilePath $logPath -Append -Encoding ascii }
    $perf = $new | Where-Object { $_ -match '"k":"perf"' } | Select-Object -Last 1
    if ($perf) {
        try { $p = $perf | ConvertFrom-Json; Write-Host ("  t={0,4}s  {1,3} fps  ms {2,5}  gpu {3,5}  draws {4,5}  tris {5,7}  mem {6,4} MB  thermal {7}" -f $p.t, [int]$p.fps, $p.ms, $p.gpu, $p.draws, $p.tris, $p.memMb, $p.thermal) } catch { }
    }
    $done = $lines | Where-Object { $_ -match '"k":"soak-done"' } | Select-Object -Last 1
    $failed = $all | Where-Object { $_ -match 'Exception|NullReference|error CS' } | Select-Object -First 1
    if ($failed -and -not $done) { Write-Host "  phone: $($failed.Trim())" }
    if (((Get-Date) - $lastBattery).TotalSeconds -ge 60) {
        $lastBattery = Get-Date
        $b = Read-Battery
        $battery += $b
        ('{"k":"battery","t":' + [int]((Get-Date) - $started).TotalSeconds + ',"temp":' + $b.Temp + ',"level":' + $b.Level + '}') | Out-File -FilePath $logPath -Append -Encoding ascii
        Write-Host ("  battery {0}% at {1:n1} C" -f $b.Level, $b.Temp)
    }
    if (((Get-Date) - $started).TotalSeconds -gt $TimeoutSeconds) { Write-Host "Timed out after $TimeoutSeconds s."; break }
}

$endBattery = Read-Battery
if ($done) {
    $d = $done | ConvertFrom-Json
    Write-Host ''
    Write-Host ("  {0} min at a target of {1} fps (display {2} Hz): fps p50 {3}, low 5% {4}; frame ms p50 {5}, p95 {6}; CPU p95 {7} ms; GPU p50 {8}, p95 {9} ms" -f $d.minutes, $d.targetFps, $d.hz, $d.fpsP50, $d.fpsLow5, $d.msP50, $d.msP95, $d.cpuP95, $d.gpuP50, $d.gpuP95)
    Write-Host ("  draws p95 {0}, tris p95 {1}, memory peak {2} MB, worst thermal status {3}, headroom up to {4}" -f $d.drawsP95, $d.trisP95, $d.memPeakMb, $d.worstThermal, $d.highestHeadroom)
    Write-Host ("  walked {0} m, {1} of {2} rooms visited, {3} replans, {4} rooms built at the peak, {5} releases" -f $d.walked, $d.visited, $d.rooms, $d.replans, $d.peakBuilt, $d.releases)
    $drop = $startBattery.Level - $endBattery.Level
    Write-Host ("  battery {0}% -> {1}% ({2} points), {3:n1} C -> {4:n1} C" -f $startBattery.Level, $endBattery.Level, $drop, $startBattery.Temp, $endBattery.Temp)
    $verdict = if ($d.fpsLow5 -ge ($d.targetFps * 0.9) -and $d.worstThermal -le 1) { "HOLDS: the low 5% of frames stay within 10% of $($d.targetFps) fps and the phone stayed cool" } else { "does not hold at $($d.targetFps): low 5% $($d.fpsLow5) fps, thermal status $($d.worstThermal)" }
    Write-Host "  $verdict"
}
else { Write-Host '  no soak-done line (the app stopped early? read the log).' }
$thermal = & $adb shell dumpsys thermalservice | Where-Object { $_ -match 'Thermal Status:' } | Select-Object -First 1
if ($thermal) { Write-Host ("  Phone " + $thermal.Trim()) }
if (-not $done) { exit 1 }
