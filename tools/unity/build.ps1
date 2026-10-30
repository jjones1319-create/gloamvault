# npm run unity:build - the release-signed APK -> unity/Build/gloamvault.apk (Gloamvault.EditorTools.BuildAndroid).
# The key is read from Documents\Gloamvault\keys\keystore.json (tools/unity/make-key.ps1); it never enters the repo.
. (Join-Path $PSScriptRoot 'common.ps1')

$keys = Join-Path (Get-KeysDir) 'keystore.json'
if (-not (Test-Path $keys)) { throw "No signing key at $keys - run tools/unity/make-key.ps1 once (and back the folder up)." }
$r = Invoke-Unity -Name 'build' -Android -Arguments @('-executeMethod', 'Gloamvault.EditorTools.BuildAndroid.Run', '-gvKeys', $keys)
Select-String -Path $r.Log -Pattern '\[gv-build\]' | ForEach-Object { Write-Host ('  ' + $_.Line.Trim()) }
if ($r.ExitCode -ne 0) { exit $r.ExitCode }
$apk = Join-Path $ProjectPath 'Build\gloamvault.apk'
if (-not (Test-Path $apk)) { throw "The build reported success but $apk is missing." }
Write-Host ("APK: {0} ({1:n1} MB)" -f $apk, ((Get-Item $apk).Length / 1MB))
