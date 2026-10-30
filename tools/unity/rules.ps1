# npm run unity:rules - runs the Rules check on the phone over USB (Phase 10, D-139) and prints its results.
# Starts the installed app with the launch extra gv=rules (the title opens the check and runs it), follows the
# phone log until the rules-done line, then prints a table of the cases, the start-up, and the phone's temperature.
# ASCII only (PowerShell 5.1).
param([int]$TimeoutSeconds = 600)
. (Join-Path $PSScriptRoot 'common.ps1')

$adb = Get-Adb
$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\tdevice$' }
if (-not $devices) { & $adb devices; throw 'No phone found (plugged in, USB debugging on, this computer allowed?).' }

$package = 'com.gloamvault.game'
$resolved = & $adb shell cmd package resolve-activity --brief $package | Select-Object -Last 1
$activity = "$resolved".Trim()
if ($activity -notmatch '^[\w.]+/[\w.]+$') { throw "Could not find the app's activity (is it installed? got: $activity)" }

& $adb shell am force-stop $package | Out-Null
& $adb logcat -c
& $adb shell am start -n $activity --es gv rules | Out-Null
Write-Host "Rules check started on the phone ($activity) ..."

$started = Get-Date
$lines = @()
$done = $null
while (-not $done) {
    Start-Sleep -Seconds 3
    $all = & $adb logcat -d -s Unity:V
    $lines = $all | Where-Object { $_ -match '\[gv\] \{"k":"rules' } | ForEach-Object { ($_ -replace '^.*?\[gv\]\s*', '') }
    $done = $lines | Where-Object { $_ -match '"k":"rules-done"' } | Select-Object -Last 1
    $failed = $all | Where-Object { $_ -match 'SimException|the rules engine failed|Exception' } | Select-Object -First 1
    if (-not $done -and $failed) { Write-Host "  phone: $($failed.Trim())" }
    if (((Get-Date) - $started).TotalSeconds -gt $TimeoutSeconds) { Write-Host "Timed out after $TimeoutSeconds s."; break }
}

$cases = $lines | Where-Object { $_ -match '"k":"rules"' } | ForEach-Object { $_ | ConvertFrom-Json }
if ($cases) {
    Write-Host ''
    Write-Host ('  {0,-5} {1,-6} {2,6} {3,10} {4,10} {5,10} {6,10} {7,8}' -f 'case', 'same', 'steps', 'step p50', 'step p95', 'step max', 'legal p95', 'total')
    foreach ($c in $cases) {
        $same = if ($c.same -eq 1) { 'yes' } elseif ($c.error) { 'ERROR' } else { "no@$($c.differsAt)" }
        Write-Host ('  {0,-5} {1,-6} {2,6} {3,7:n2} ms {4,7:n2} ms {5,7:n1} ms {6,7:n2} ms {7,6:n1} s' -f $c.case, $same, $c.steps, $c.stepP50, $c.stepP95, $c.stepMax, $c.legalP95, ($c.ms / 1000))
        if ($c.error) { Write-Host "        $($c.error)" }
    }
}
if ($done) {
    $d = $done | ConvertFrom-Json
    # The speed bar is about a hero's turn (hand mode); an auto-mode case plays whole fights in one step by design.
    # golden.json (npm run unity:bundle) says which cases are auto mode.
    $golden = Join-Path $ProjectPath 'Assets\Gloamvault\Resources\Sim\golden.json'
    $autoIds = @()
    if (Test-Path $golden) { $autoIds = @((Get-Content $golden -Raw | ConvertFrom-Json).cases | Where-Object { $_.requestJson -match '"auto":true' } | ForEach-Object { $_.id }) }
    $hand = @($cases | Where-Object { $autoIds -notcontains $_.case })
    $auto = @($cases | Where-Object { $autoIds -contains $_.case })
    $handP95 = if ($hand.Count -gt 0) { ($hand | Measure-Object -Property stepP95 -Maximum).Maximum } else { $d.stepP95 }
    $autoP95 = if ($auto.Count -gt 0) { ($auto | Measure-Object -Property stepP95 -Maximum).Maximum } else { 0 }
    $startMs = $d.loadMs + $d.runMs + $d.initMs
    Write-Host ''
    Write-Host ('  {0}: {1} of {2} cases the same as Node; start-up read {3:n0} + run {4:n0} + content {5:n0} = {6:n1} s; a turn''s worst p95 {7:n1} ms (whole fights a step: {8:n1} ms)' -f $d.engine, $d.same, $d.cases, $d.loadMs, $d.runMs, $d.initMs, ($startMs / 1000), $handP95, $autoP95)
    $verdict = if ($d.same -eq $d.cases -and $startMs -lt 3000 -and $handP95 -lt 30) { 'PASS: the same hashes, a turn under 30 ms at p95, under 3 s to start' } else { 'the bar is not met (12 s.3: the same hashes, a turn p95 < 30 ms, start-up < 3 s)' }
    Write-Host "  $verdict"
}
$battery = & $adb shell dumpsys battery
$temp = ($battery | Where-Object { $_ -match 'temperature:\s*(\d+)' } | Select-Object -First 1)
if ($temp -match 'temperature:\s*(\d+)') { Write-Host ("  Battery temperature: {0:n1} C" -f ([int]$Matches[1] / 10)) }
$thermal = & $adb shell dumpsys thermalservice | Where-Object { $_ -match 'Thermal Status:' } | Select-Object -First 1
if ($thermal) { Write-Host ("  Phone " + $thermal.Trim()) }
if (-not $done) { exit 1 }
