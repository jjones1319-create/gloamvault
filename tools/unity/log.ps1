# npm run unity:log - the game's own lines from the phone log ([gv] boot / perf lines), plus the battery
# temperature and the phone's thermal state. -Seconds N waits N seconds first (to sample a run); -Raw shows
# every Unity line (errors and exceptions too).
param([int]$Seconds = 0, [switch]$Raw)
. (Join-Path $PSScriptRoot 'common.ps1')

$adb = Get-Adb
if ($Seconds -gt 0) { Write-Host "Sampling for $Seconds s ..."; Start-Sleep -Seconds $Seconds }
$lines = & $adb logcat -d -s Unity:V
if ($Raw) { $lines | ForEach-Object { Write-Host $_ } }
else { $lines | Where-Object { $_ -match '\[gv' -or $_ -match 'Exception|Error' } | ForEach-Object { Write-Host ($_ -replace '^.*?Unity\s*:\s*', '') } }
$battery = & $adb shell dumpsys battery
$temp = ($battery | Where-Object { $_ -match 'temperature:\s*(\d+)' } | Select-Object -First 1)
if ($temp -match 'temperature:\s*(\d+)') { Write-Host ("Battery temperature: {0:n1} C" -f ([int]$Matches[1] / 10)) }
$thermal = & $adb shell dumpsys thermalservice | Where-Object { $_ -match 'Thermal Status:' } | Select-Object -First 1
if ($thermal) { Write-Host ("Phone " + $thermal.Trim()) }
