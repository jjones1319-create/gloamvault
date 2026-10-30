# npm run unity:setup - (re)applies the project's settings, render pipeline, UI panel and scenes
# (Gloamvault.EditorTools.ProjectSetup). Safe to re-run: every step checks before it creates.
. (Join-Path $PSScriptRoot 'common.ps1')

# The app icon comes from the web version's icon (client/public/pwa-512.png, made by npm run icons).
$iconDir = Join-Path $ProjectPath 'Assets\Gloamvault\Art\Icon'
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null
Copy-Item (Join-Path $RepoRoot 'client\public\pwa-512.png') (Join-Path $iconDir 'icon-512.png') -Force

$r = Invoke-Unity -Name 'setup' -Android -Arguments @('-executeMethod', 'Gloamvault.EditorTools.ProjectSetup.Run')
if ($r.ExitCode -ne 0) { exit $r.ExitCode }
Select-String -Path $r.Log -Pattern '\[gv-setup\]' | ForEach-Object { Write-Host ('  ' + $_.Line.Trim()) }
