#Requires -Version 5.1
#Requires -PSEdition Desktop
<#
Runs build_report.ps1 with the mock JSON files and compares the result with the expected values in README.md.
Needs Excel only. Nothing is written inside the repository.

  powershell -NoProfile -ExecutionPolicy Bypass -File tools\check_report.ps1

Exit code 0 = all checks passed. Keep this file ASCII only (see build_report.ps1).
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$work = Join-Path $env:TEMP ('check_report_' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null

Add-Type -AssemblyName System.Web.Extensions
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$cfg = $serializer.DeserializeObject([IO.File]::ReadAllText((Join-Path $root 'config.example.json'), [Text.Encoding]::UTF8))
$cfg['TemplatePath'] = [IO.Path]::Combine($root, $cfg['TemplatePath'])   # Join-Path would hand the serializer a wrapped object
$cfg['OutputPath'] = [IO.Path]::Combine($work, 'result.xlsx')
[IO.File]::WriteAllText((Join-Path $work 'config.json'), $serializer.Serialize($cfg))

$topCategory = [string][char]0xC9C8 + [char]0xC758   # the category that the README expects as the most frequent one
$seed = Join-Path $root 'testdata\mock_calls_seed14_v1.json'
$edge = Join-Path $root 'testdata\mock_calls_edge_v1.json'
$cases = @(
    @{ Name = 'seed 14';        Mock = "$seed";       Kpi = '14 / 6 / 2 / 3 / 21%'; Rows = 14 },
    @{ Name = 'seed 14 + edge'; Mock = "$seed,$edge"; Kpi = '20 / 8 / 3 / 4 / 20%'; Rows = 20; LongestText = 32000; UtcCall = 'CALL-20261124-002'; UtcShown = '2026-11-24 00:30' }
)

$failed = 0
function Check([string]$what, $actual, $expected) {
    if ("$actual" -eq "$expected") { Write-Host "  PASS  $what = $actual" }
    else { Write-Host "  FAIL  $what = $actual (expected $expected)"; $script:failed++ }
}

$excel = New-Object -ComObject Excel.Application
try {
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    foreach ($case in $cases) {
        Write-Host "== $($case.Name)"
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'build_report.ps1') -ConfigPath (Join-Path $work 'config.json') -MockJson $case.Mock | ForEach-Object { Write-Host "  $_" }
        Check 'exit code' $LASTEXITCODE 0
        if ($LASTEXITCODE -ne 0) { continue }

        $book = $excel.Workbooks.Open($cfg['OutputPath'], 0, $true)
        $dash, $summary, $ledger = $book.Worksheets.Item(1), $book.Worksheets.Item(2), $book.Worksheets.Item(3)
        $n = $case.Rows
        $kpi = ('A5', 'C5', 'E5', 'G5' | ForEach-Object { $dash.Range($_).Value2 }) -join ' / '
        Check 'indicators' ("$kpi / {0}%" -f [Math]::Round($dash.Range('I5').Value2 * 100)) $case.Kpi
        Check 'most frequent category' $dash.Range('K5').Value2 $topCategory
        Check 'agents total' $excel.WorksheetFunction.Sum($summary.Range('B21:B30')) $n
        Check 'dates total' $excel.WorksheetFunction.Sum($summary.Range('G34:G47')) $n
        Check 'companies total' $excel.WorksheetFunction.Sum($summary.Range('B51:B60')) $n
        Check 'table range' $ledger.ListObjects.Item('tblCalls').Range.Address($false, $false) "A1:L$($n + 1)"
        Check 'ledger rows' $excel.WorksheetFunction.CountA($ledger.Range('A2:A1000')) $n
        Check 'charts' $dash.ChartObjects().Count 4
        Check 'slicers' $book.SlicerCaches.Count 2
        $errors = 0
        foreach ($s in $dash, $summary) { try { $errors += $s.UsedRange.SpecialCells(-4123, 16).Count } catch { } }   # formula cells showing an error
        Check 'error cells' $errors 0
        if ($case.LongestText) {
            $longest = 0
            foreach ($v in $ledger.Range("L2:L$($n + 1)").Value2) { if ("$v".Length -gt $longest) { $longest = "$v".Length } }
            Check 'longest transcript' $longest $case.LongestText
            $row = $excel.WorksheetFunction.Match($case.UtcCall, $ledger.Range('A1:A1000'), 0)
            Check 'UTC call shown in Korea time' $ledger.Range("B$row").Text $case.UtcShown
        }
        $book.Close($false)
    }
} finally {
    $excel.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
    Remove-Item -LiteralPath $work -Recurse -Force
}
if ($failed) { Write-Host "$failed check(s) failed"; exit 1 }
Write-Host 'all checks passed'
