# tools/unity/screencap.ps1 - a screenshot from the phone over USB (Phase 11). -Room <templateId> first (re)starts
# the installed app on that room (the launch extra gv=room:<id>), waits -Wait seconds, and also prints the overlay's
# last perf line. Writes unity/shots/phone-<name>.png. ASCII only (PowerShell 5.1).
param([string]$Room = '', [string]$Hero = '', [string]$Monster = '', [string]$Walk = '', [string]$Name = '', [int]$Wait = 6)
. (Join-Path $PSScriptRoot 'common.ps1')

$adb = Get-Adb
$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\tdevice$' }
if (-not $devices) { & $adb devices; throw 'No phone found (plugged in, USB debugging on, this computer allowed?).' }
$package = 'com.gloamvault.game'
$extra = ''
if ($Room) { $extra = "room:$Room" } elseif ($Hero) { $extra = "hero:$Hero" } elseif ($Monster) { $extra = "monster:$Monster" } elseif ($Walk) { $extra = "walk:$Walk" }
if ($extra) {
    $resolved = & $adb shell cmd package resolve-activity --brief $package | Select-Object -Last 1
    $activity = "$resolved".Trim()
    & $adb shell am force-stop $package | Out-Null
    & $adb logcat -c
    & $adb shell am start -n $activity --es gv $extra | Out-Null
    Write-Host "Opened $extra on the phone; waiting $Wait s ..."
    Start-Sleep -Seconds $Wait
}
if (-not $Name) { $Name = if ($extra) { ($extra -replace '[:,]', '-') } else { 'screen' } }
$out = Join-Path $ProjectPath 'shots'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$png = Join-Path $out "phone-$Name.png"
# Through cmd, so the PNG's bytes never pass through PowerShell's text pipeline.
& cmd.exe /c "`"$adb`" exec-out screencap -p > `"$png`""
Write-Host ("  {0}  {1:n0} KB" -f $png, ((Get-Item $png).Length / 1KB))
$perf = & $adb logcat -d -s Unity:V | Where-Object { $_ -match '\[gv\] \{"k":"perf"' } | Select-Object -Last 1
if ($perf) { Write-Host ('  ' + ($perf -replace '^.*?\[gv\]\s*', '')) }
