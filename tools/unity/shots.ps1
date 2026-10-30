# npm run unity:shots - renders the screen set (the PlayMode tests in the Shots category) to unity/shots/
# at the phone's 2,340 x 1,080 (D-052). Read the PNGs before calling a visual change done (CLAUDE.md rule 7).
param([string]$Only = '')
. (Join-Path $PSScriptRoot 'common.ps1')

$out = Join-Path $ProjectPath 'shots'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$results = Join-Path $ProjectPath 'TestResults-Shots.xml'
if (Test-Path $results) { Remove-Item $results }
$testArgs = @('-runTests', '-testPlatform', 'PlayMode', '-testResults', $results, '-testCategory', 'Shots')
if ($Only) { $testArgs += @('-testFilter', $Only) }
$r = Invoke-Unity -Name 'shots' -NoQuit -Android -Arguments $testArgs
Write-Host 'Shots:'
$passed = Show-TestResults $results
Get-ChildItem $out -Filter *.png | Sort-Object LastWriteTime -Descending | ForEach-Object {
    Write-Host ("  {0}  {1:n0} KB" -f $_.FullName, ($_.Length / 1KB))
}
if (-not $passed) { exit 1 }
