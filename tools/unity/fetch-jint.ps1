# tools/unity/fetch-jint.ps1 - fetches the JavaScript engine the Unity app runs the rules with (D-139, Phase 10):
# Jint (BSD-2-Clause), its parser Acornima (BSD-3-Clause) and System.Runtime.CompilerServices.Unsafe 6.0 (MIT; Jint
# needs it and Unity 6 does not ship that version) from nuget.org at pinned versions, and puts their .NET Standard
# DLLs and licences under unity/Assets/Gloamvault/Plugins/Jint/. Run once (or to change a version);
# the DLLs are committed. Prints each DLL's SHA-256 for CREDITS.md. ASCII only (PowerShell 5.1).
param([string]$JintVersion = '4.17.0', [string]$AcornimaVersion = '1.9.1', [string]$UnsafeVersion = '6.0.0')
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$dest = Join-Path $root 'unity\Assets\Gloamvault\Plugins\Jint'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$tmp = Join-Path $env:TEMP ('gv-jint-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Fetch-Package([string]$Id, [string]$Version, [string]$Tfm) {
    $url = "https://api.nuget.org/v3-flatcontainer/$($Id.ToLower())/$Version/$($Id.ToLower()).$Version.nupkg"
    $pkg = Join-Path $tmp "$Id.$Version.nupkg"
    Write-Host "Fetching $Id $Version ..."
    Invoke-WebRequest -Uri $url -OutFile $pkg -UseBasicParsing
    $dir = Join-Path $tmp "$Id.$Version"
    [IO.Compression.ZipFile]::ExtractToDirectory($pkg, $dir)
    $dll = Join-Path $dir "lib\$Tfm\$Id.dll"
    if (-not (Test-Path $dll)) { throw "$Id $Version has no lib\$Tfm\$Id.dll" }
    Copy-Item $dll (Join-Path $dest "$Id.dll") -Force
    $licence = Get-ChildItem $dir -Filter 'LICENSE*' -Recurse | Select-Object -First 1
    if ($licence) { Copy-Item $licence.FullName (Join-Path $dest "$Id.LICENSE.txt") -Force }
    $hash = (Get-FileHash (Join-Path $dest "$Id.dll") -Algorithm SHA256).Hash.ToLower()
    $size = (Get-Item (Join-Path $dest "$Id.dll")).Length
    Write-Host ("  {0}.dll ({1} netstandard2.1, {2:n0} bytes) sha256 {3}" -f $Id, $Version, $size, $hash)
}

Fetch-Package -Id 'Jint' -Version $JintVersion -Tfm 'netstandard2.1'
Fetch-Package -Id 'Acornima' -Version $AcornimaVersion -Tfm 'netstandard2.1'
Fetch-Package -Id 'System.Runtime.CompilerServices.Unsafe' -Version $UnsafeVersion -Tfm 'netstandard2.0'
Remove-Item $tmp -Recurse -Force
Write-Host "Done: $dest"
