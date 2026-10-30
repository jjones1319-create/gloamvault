# Makes the release signing key ONCE (D-138), in Documents\Gloamvault\keys\ - never in the repo.
# Android only updates an app in place when the new build is signed by the same key; a lost or replaced key
# means uninstalling, which erases the save. So this script refuses to overwrite an existing key.
. (Join-Path $PSScriptRoot 'common.ps1')

$dir = Get-KeysDir
$store = Join-Path $dir 'gloamvault-release.keystore'
$json = Join-Path $dir 'keystore.json'
if ((Test-Path $store) -or (Test-Path $json)) { Write-Host "A key already exists in $dir - keeping it."; exit 0 }
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$exe = Get-UnityExe
$keytool = Join-Path (Split-Path $exe) 'Data\PlaybackEngines\AndroidPlayer\OpenJDK\bin\keytool.exe'
if (-not (Test-Path $keytool)) { throw "keytool not found at $keytool (is Android Build Support installed?)" }

$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
$bytes = New-Object byte[] 24
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$pass = -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })

& $keytool -genkeypair -keystore $store -alias gloamvault -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $pass -keypass $pass -dname 'CN=Gloamvault, O=Gloamvault, C=US' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'keytool failed.' }
[ordered]@{ keystore = $store; storePass = $pass; alias = 'gloamvault'; keyPass = $pass } |
    ConvertTo-Json | Set-Content -Path $json -Encoding utf8
@"
Gloamvault's release signing key (made $(Get-Date -Format 'yyyy-MM-dd')).
Keep a copy of this whole folder somewhere safe (a USB stick or a cloud drive).
Without it, a new version of the game cannot be installed over the old one without erasing the save,
and the game could never be updated on the Play Store.
"@ | Set-Content -Path (Join-Path $dir 'README.txt') -Encoding utf8
Write-Host "Made the signing key in $dir"
