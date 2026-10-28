# Rebuilds the whole hero chain in order (tools/blender/README.md): body -> species -> clips -> gear -> weapons -> exports.
# Usage:  powershell -File tools/blender/hero/run.ps1 [-Quick] [-From species]
# The body build is not bit-for-bit deterministic, so everything after it is rebuilt whenever it is.
param(
  [switch]$Quick,
  [string]$From = 'body'
)
$ErrorActionPreference = 'Stop'
$B = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
Set-Location $Root
$q = @()
if ($Quick) { $q = @('--', '--quick') }

$steps = @(
  @{ name = 'body';     blend = $null;                          script = 'tools/blender/hero/build_body.py' },
  @{ name = 'species';  blend = 'art/build/hero_body.blend';    script = 'tools/blender/hero/build_species.py' },
  @{ name = 'clips';    blend = 'art/build/hero_body.blend';    script = 'tools/blender/hero/build_clips.py' },
  @{ name = 'warden';   blend = $null;                          script = 'tools/blender/hero/build_gear_warden.py' },
  @{ name = 'blade';    blend = $null;                          script = 'tools/blender/hero/build_gear_blade.py' },
  @{ name = 'ranger';   blend = $null;                          script = 'tools/blender/hero/build_gear_ranger.py' },
  @{ name = 'shade';    blend = $null;                          script = 'tools/blender/hero/build_gear_shade.py' },
  @{ name = 'arcanist'; blend = $null;                          script = 'tools/blender/hero/build_gear_arcanist.py' },
  @{ name = 'mender';   blend = $null;                          script = 'tools/blender/hero/build_gear_mender.py' },
  @{ name = 'weapons';  blend = 'art/build/hero_body.blend';    script = 'tools/blender/hero/build_weapons.py' },
  @{ name = 'export';   blend = 'art/build/hero_body.blend';    script = 'tools/blender/hero/export_hero.py' }
)

$started = $false
foreach ($s in $steps) {
  if ($s.name -eq $From) { $started = $true }
  if (-not $started) { continue }
  if (-not (Test-Path $s.script)) { Write-Host "skip $($s.name): $($s.script) not written yet"; continue }
  Write-Host "== $($s.name)"
  $argv = @('-b')
  if ($s.blend) { $argv += $s.blend }
  $argv += @('-P', $s.script) + $q
  & $B @argv
  if ($LASTEXITCODE -ne 0) { throw "$($s.name) failed ($LASTEXITCODE)" }
}
Write-Host 'hero chain done; check: node tools/blender/inspect-glb.ts client/public/models/hero/*.glb'
