# npm run unity:models - the heroes' and monsters' models for Unity (Phase 12, D-160): every shipped GLB under
# client/public/models/hero/ and client/public/models/monsters/ converted to an FBX under
# unity/Assets/Gloamvault/Resources/Hero/ and Resources/Monsters/ (generated, git-ignored) by Blender, headless
# (tools/blender/unity/glb_to_fbx.py). Only files newer than their FBX are converted; -All redoes every one.
# ASCII only (PowerShell 5.1).
param([switch]$All)
. (Join-Path $PSScriptRoot 'common.ps1')

$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
if (-not (Test-Path $blender)) { throw "Blender not found at $blender" }
$script = Join-Path $RepoRoot 'tools\blender\unity\glb_to_fbx.py'
$sets = @(
    @{ From = 'client\public\models\hero'; To = 'unity\Assets\Gloamvault\Resources\Hero' },
    @{ From = 'client\public\models\monsters'; To = 'unity\Assets\Gloamvault\Resources\Monsters' }
)
$done = 0
$skipped = 0
$failed = 0
foreach ($set in $sets) {
    $outDir = Join-Path $RepoRoot $set.To
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    foreach ($glb in Get-ChildItem (Join-Path $RepoRoot $set.From) -Filter *.glb | Sort-Object Name) {
        $fbx = Join-Path $outDir ($glb.BaseName + '.fbx')
        if (-not $All -and (Test-Path $fbx) -and (Get-Item $fbx).LastWriteTime -gt $glb.LastWriteTime) { $skipped++; continue }
        $in = (Join-Path $set.From $glb.Name) -replace '\\', '/'
        $out = (Join-Path $set.To ($glb.BaseName + '.fbx')) -replace '\\', '/'
        $lines = & $blender -b -P $script -- --in $in --out $out 2>&1
        $check = $lines | Where-Object { $_ -match '\[gv\] check' } | Select-Object -Last 1
        if ($check) { Write-Host ('  ' + ($check -replace '^\[gv\] ', '')); $done++ }
        else {
            $failed++
            Write-Host ("  FAILED {0}" -f $glb.Name)
            $lines | Where-Object { $_ -match 'Error|Traceback|rror:' } | Select-Object -First 6 | ForEach-Object { Write-Host "    $_" }
        }
    }
}
Write-Host ("unity:models - {0} converted, {1} up to date, {2} failed" -f $done, $skipped, $failed)
if ($failed -gt 0) { exit 1 }
