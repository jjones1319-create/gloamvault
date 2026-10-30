# npm run unity:install - installs unity/Build/gloamvault.apk on the phone over USB and starts it (D-138).
# `adb install -r` keeps the app's data (the save) as long as the signing key is the same - never use -d or uninstall.
. (Join-Path $PSScriptRoot 'common.ps1')

$adb = Get-Adb
$apk = Join-Path $ProjectPath 'Build\gloamvault.apk'
if (-not (Test-Path $apk)) { throw "No APK at $apk - run npm run unity:build first." }
$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\tdevice$' }
if (-not $devices) {
    & $adb devices
    throw 'No phone found. Is it plugged in, with USB debugging on and this computer allowed? (see STATUS.md)'
}
Write-Host "Installing on $(($devices | Select-Object -First 1) -replace '\s+device$','') ..."
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'adb install failed (see above).' }
& $adb logcat -c
& $adb shell monkey -p com.gloamvault.game -c android.intent.category.LAUNCHER 1 | Out-Null
Write-Host 'Started Gloamvault on the phone. npm run unity:log reads its lines.'
