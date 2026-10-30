# npm run unity:test - the EditMode tests, then the PlayMode tests (minus the Shots category), in batchmode.
# Results: unity/TestResults-EditMode.xml and unity/TestResults-PlayMode.xml (git-ignored).
param([switch]$EditOnly)
. (Join-Path $PSScriptRoot 'common.ps1')

$ok = $true
foreach ($platform in @('EditMode', 'PlayMode')) {
    if ($EditOnly -and $platform -eq 'PlayMode') { continue }
    $results = Join-Path $ProjectPath "TestResults-$platform.xml"
    if (Test-Path $results) { Remove-Item $results }
    $r = Invoke-Unity -Name "test-$platform" -NoQuit -Android -Arguments @(
        '-runTests', '-testPlatform', $platform, '-testResults', $results, '-testCategory', '!Shots')
    Write-Host "$platform tests:"
    $passed = Show-TestResults $results
    if (-not $passed) { $ok = $false; if ($r.ExitCode -eq 0) { Show-UnityErrors $r.Log } }
}
if (-not $ok) { exit 1 }
