#Requires -Version 5.1
<#
Builds the v5 draft template from the v4 template by driving Excel itself (charts and slicers survive).
Keep this file ASCII only (Windows PowerShell 5.1 misreads Korean in a UTF-8 script without BOM);
Korean captions come from build_template_v5_labels.json.

  powershell -NoProfile -ExecutionPolicy Bypass -File build_template_v5.ps1 -Source v4.xlsx -Dest v5.xlsx

What it changes:
  ledger    : hidden helper column N (1 = row is visible), view scrolled back to the top
  summary   : every formula that reads the ledger also requires "row is visible";
              tables 4 and 5 moved beside tables 1-3, criteria tables 6 and 7 moved below; thresholds
  dashboard : slicer panel on the left (5 slicers), "filtered" indicator line, hint line
build_report.ps1 is not touched: it still writes A2:L1000 of table tblCalls only.
#>
param(
    [Parameter(Mandatory)][string]$Source,
    [Parameter(Mandatory)][string]$Dest,
    [string]$Labels
)
$ErrorActionPreference = 'Stop'
if (-not $Labels) { $Labels = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'build_template_v5_labels.json' }
$txt = [IO.File]::ReadAllText($Labels, [Text.Encoding]::UTF8) | ConvertFrom-Json
$missing = [Type]::Missing
Copy-Item -LiteralPath $Source -Destination $Dest -Force

$xl = New-Object -ComObject Excel.Application
try {
    $xl.Visible = $false; $xl.DisplayAlerts = $false; $xl.ScreenUpdating = $false
    $wb = $xl.Workbooks.Open($Dest)
    $xl.Calculation = -4135   # manual while patching
    $dash = $wb.Worksheets.Item(1); $sum = $wb.Worksheets.Item(2); $led = $wb.Worksheets.Item(3)
    $table = $led.ListObjects.Item('tblCalls')
    $L = "'" + $led.Name + "'!"                    # quoted ledger sheet prefix
    $V = $L + '$N$2:$N$1000'                       # 1 = row visible and not empty
    $Lre = [regex]::Escape($L)

    # ---- 1. ledger: visibility flag outside the table (column M stays empty so the table does not grow)
    $led.Range('N1').Value2 = $txt.flagHeader
    $led.Range('N2:N1000').Formula = '=SUBTOTAL(103,$A2)'
    $led.Range('N:N').EntireColumn.Hidden = $true

    # ---- 2. formulas: count visible rows only
    $patched = 0
    function Convert-Formula([string]$f) {
        $n = $f
        # T2: latest visible day
        if ($n -match '^=IF\(COUNT\(') {
            return '=IF(SUM(' + $V + ')=0,"",INT(AGGREGATE(14,6,' + $L + '$B$2:$B$1000/((' + $V + '=1)*(' + $L + '$B$2:$B$1000>0)),1)))'
        }
        $n = [regex]::Replace($n, 'COUNTIFS\(([^()]*)\)', { param($m) if ($m.Groups[1].Value.Contains($L)) { 'COUNTIFS(' + $m.Groups[1].Value + ',' + $V + ',1)' } else { $m.Value } })
        $n = [regex]::Replace($n, 'COUNTIF\((' + $Lre + '[^,()]+),([^()]*)\)', { param($m) 'COUNTIFS(' + $m.Groups[1].Value + ',' + $m.Groups[2].Value + ',' + $V + ',1)' })
        $n = [regex]::Replace($n, '\((' + $Lre + '\$[A-Z]\$2:\$[A-Z]\$1000)=""\)', { param($m) '(' + $m.Groups[1].Value + '="")+(' + $V + '=0)' })
        $n = $n.Replace('ISNUMBER(' + $L + '$B$2:$B$1000)', 'ISNUMBER(' + $L + '$B$2:$B$1000)*(' + $V + '=1)')
        $n = $n.Replace('COUNTA(' + $L + '$A$2:$A$1000)', 'SUM(' + $V + ')')
        $agg = $L + '$B$2:$B$1000/((' + $V + '=1)*(' + $L + '$B$2:$B$1000>0)),1)'
        $n = $n.Replace('MIN(' + $L + '$B$2:$B$1000)', 'AGGREGATE(15,6,' + $agg)
        $n = $n.Replace('MAX(' + $L + '$B$2:$B$1000)', 'AGGREGATE(14,6,' + $agg)
        return $n
    }
    foreach ($ws in @($sum, $dash)) {
        foreach ($c in $ws.UsedRange.SpecialCells(-4123).Cells) {
            $f = [string]$c.Formula
            if (-not $f.Contains($L)) { continue }
            $new = Convert-Formula $f
            if (-not $new.Contains('$N$2:$N$1000')) { throw "unhandled formula shape at $($ws.Name)!$($c.Address($false,$false)): $f" }
            if ($c.HasArray) {
                if ($new.Length -gt 255) { throw "array formula too long at $($c.Address($false,$false))" }
                $c.FormulaArray = $new
            } else { $c.Formula = $new }
            $patched++
        }
    }
    Write-Host "patched formulas: $patched"

    # ---- 3. summary layout: tables 1-3 stay in A:D, 4 and 5 go to F.., criteria 6 and 7 go below
    $heights = @{}; foreach ($r in 63..76) { $heights[$r] = $sum.Rows.Item($r).RowHeight }
    $std = $sum.Rows.Item(3).RowHeight
    [void]$sum.Range('J1:T101').Cut($sum.Range('AA1'))          # hidden calc block out of the way
    $sum.Range('J:T').EntireColumn.Hidden = $false
    $sum.Range('AA:AK').EntireColumn.Hidden = $true
    [void]$sum.Range('A32:G47').Cut($sum.Range('F1'))           # table 4 (by day)
    [void]$sum.Range('A49:D60').Cut($sum.Range('F19'))          # table 5 (by company)
    [void]$sum.Range('A63:I71').Cut($sum.Range('A33'))          # table 6 (criteria)
    [void]$sum.Range('A73:I76').Cut($sum.Range('A43'))          # table 7 (thresholds)
    foreach ($r in 32..101) { $sum.Rows.Item($r).RowHeight = $std }
    foreach ($r in 63..76) { $sum.Rows.Item($r - 30).RowHeight = [double][Math]::Min(409.0, [Math]::Round([double]$heights[$r] * 1.15, 1)) }
    $sum.Range('E:E').ColumnWidth = 24      # room for the captions of tables 1-3, which spill to the right
    $sum.Range('F:F').ColumnWidth = 14
    $sum.Range('G:L').ColumnWidth = 12
    $sum.Range('M:Z').ColumnWidth = 9
    # table 7: thresholds and why
    $sum.Range('B46').Value2 = 0.4
    $sum.Range('H45:I46').UnMerge()            # the move leaves the two note cells merged into one
    $sum.Range('H45:I45').Merge()
    [void]$sum.Range('H45:I45').Copy()
    [void]$sum.Range('H46:I46').PasteSpecial(-4122)
    $sum.Range('H45').Value2 = $txt.noteComplaint
    $sum.Range('H46').Value2 = $txt.noteFollowUp
    $sum.PageSetup.PrintArea = '$A$1:$L$46'
    $sum.PageSetup.Orientation = 2
    $sum.PageSetup.Zoom = $false; $sum.PageSetup.FitToPagesWide = 1; $sum.PageSetup.FitToPagesTall = 1

    # ---- 4. dashboard: slicer panel on the left
    foreach ($cache in @($wb.SlicerCaches)) { $cache.Delete() }
    [void]$dash.Range('A:C').EntireColumn.Insert()
    $dash.Range('A:B').ColumnWidth = 13
    $dash.Range('C:C').ColumnWidth = 1.5
    $dash.Range('A1').Value2 = $txt.panelTitle
    $dash.Range('A1').Font.Bold = $true; $dash.Range('A1').Font.Size = 11; $dash.Range('A1').VerticalAlignment = -4108
    # indicator: empty when nothing is filtered
    $dash.Range('D3:O3').Merge()
    $dash.Range('D3').Formula = '=IF(SUM(' + $V + ')=COUNTA(' + $L + '$A$2:$A$1000),"","' + $txt.indicatorAll + '"&COUNTA(' + $L + '$A$2:$A$1000)&"' + $txt.indicatorOf + '"&SUM(' + $V + ')&"' + $txt.indicatorTail + '")'
    $dash.Range('D3').Font.Bold = $true; $dash.Range('D3').Font.Color = 0x2B39C0; $dash.Range('D3').Font.Size = 10
    $dash.Range('D3').HorizontalAlignment = -4131
    $dash.Rows.Item(3).RowHeight = 18
    $dash.Range('D43').Copy($dash.Range('D44')) | Out-Null
    $dash.Range('D44').Value2 = $txt.hint
    $dash.PageSetup.PrintArea = '$D$1:$O$44'

    $left = $dash.Range('A1').Left + 3
    $width = $dash.Range('A1:B1').Width - 6
    $top = $dash.Range('A2').Top + 2
    # column index in tblCalls, slicer name, height in points, button columns
    $specs = @(@(3, 'slcAgent', 150, 1), @(6, 'slcCategory', 138, 1), @(4, 'slcCompany', 196, 1), @(9, 'slcFollowUp', 58, 2), @(10, 'slcReview', 58, 2))
    foreach ($s in $specs) {
        $field = $table.ListColumns.Item($s[0]).Name
        $cache = $wb.SlicerCaches.Add2($table, $field)
        $sl = $cache.Slicers.Add($dash, $missing, $s[1], $field, $top, $left, $width, $s[2])
        $sl.NumberOfColumns = $s[3]
        $sl.Style = 'SlicerStyleLight1'
        $sl.Shape.Placement = 3
        $top += $s[2] + 5
    }

    # ---- 5. views: ledger opens at the top, workbook opens on the dashboard
    $xl.ScreenUpdating = $true
    $led.Activate(); $xl.ActiveWindow.ScrollRow = 2; $xl.ActiveWindow.ScrollColumn = 2; [void]$led.Range('A2').Select()
    $sum.Activate(); $xl.ActiveWindow.ScrollRow = 1; $xl.ActiveWindow.ScrollColumn = 1; [void]$sum.Range('A1').Select()
    $dash.Activate(); $xl.ActiveWindow.ScrollRow = 1; $xl.ActiveWindow.ScrollColumn = 1; [void]$dash.Range('D1').Select()

    $xl.Calculation = -4105
    $xl.CalculateFull()
    $wb.Save()
    $wb.Close($false)
    Write-Host "saved $Dest"
} finally {
    $xl.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
}
