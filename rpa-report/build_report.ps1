#Requires -Version 5.1
#Requires -PSEdition Desktop
<#
Rebuilds the Excel dashboard file from the server call list (design doc 4: chapters 3, 4.2, 6, 8).
Only the ledger sheet (table tblCalls, A2:L1000) is rewritten; the template formulas do the rest.

  powershell -NoProfile -ExecutionPolicy Bypass -File build_report.ps1 -BaseUrl http://host:8000 -ApiKey x
  powershell -NoProfile -ExecutionPolicy Bypass -File build_report.ps1 -MockJson testdata\a.json,testdata\b.json

Exit code 0 = saved. 1 = failed, and the existing output file is left as it was.
Keep this file ASCII only: Windows PowerShell 5.1 misreads Korean in a UTF-8 script without BOM.
Logs carry counts and call ids only, never transcripts or phone numbers.
#>
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'config.json'),
    [string]$BaseUrl,
    [string]$ApiKey,
    [string[]]$MockJson
)
$ErrorActionPreference = 'Stop'
$utf8 = [Text.Encoding]::UTF8
$KST = [TimeSpan]::FromHours(9)

function Log([string]$level, [string]$msg) { Write-Host ("{0} [{1}] {2}" -f (Get-Date -Format 'HH:mm:ss'), $level, $msg) }

# ConvertFrom-Json stops at 2 MB in 5.1; one page of 200 calls with transcripts can be larger.
Add-Type -AssemblyName System.Web.Extensions
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$serializer.MaxJsonLength = [int]::MaxValue
function Read-Json([string]$text) { return $serializer.DeserializeObject($text) }

function Get-Page([int]$page) {
    $url = '{0}/api/calls?status=DONE&include_transcript=true&size={1}&page={2}' -f $BaseUrl.TrimEnd('/'), $cfg['PageSize'], $page
    for ($try = 0; ; $try++) {
        try {
            $req = [Net.HttpWebRequest]::Create($url)
            $req.Timeout = 30000
            if ($ApiKey) { $req.Headers['X-API-Key'] = $ApiKey }
            $res = $req.GetResponse()
            try { return Read-Json (New-Object IO.StreamReader($res.GetResponseStream(), $utf8)).ReadToEnd() } finally { $res.Close() }
        } catch {
            $web = $_.Exception
            while ($web -and $web -isnot [Net.WebException]) { $web = $web.InnerException }
            if (-not $web) { throw }
            $code = if ($web.Response) { [int]$web.Response.StatusCode } else { 0 }   # 0 = no connection or timeout
            # 4xx means the request itself is wrong, so retrying cannot help
            if (($code -ge 400 -and $code -lt 500) -or $try -ge $cfg['RetryCount']) { throw "server: page $page failed (HTTP $code)" }
            Log WARN "server: page $page HTTP $code, retry $($try + 1)/$($cfg['RetryCount']) in $($cfg['RetryIntervalSec'])s"
            Start-Sleep -Seconds $cfg['RetryIntervalSec']
        }
    }
}

# A leading apostrophe keeps Excel from turning text into a formula, number or date.
function Text($value, [int]$max = 0) {
    if ($null -eq $value -or "$value" -eq '') { return $null }
    $s = [string]$value
    if ($max -gt 0 -and $s.Length -gt $max) { $s = $s.Substring(0, $max) }
    return "'" + $s
}
function YN($value) { if ($value) { 'Y' } else { 'N' } }

$tmp = $null
try {
    # ---- settings
    $cfg = Read-Json ([IO.File]::ReadAllText((Resolve-Path -LiteralPath $ConfigPath), $utf8))
    foreach ($key in 'TemplatePath', 'OutputPath', 'PageSize', 'MaxRows', 'RetryCount', 'RetryIntervalSec') {
        if ($null -eq $cfg[$key]) { throw "config: $key is missing" }
    }
    $cfgDir = Split-Path -Parent (Resolve-Path -LiteralPath $ConfigPath)
    $tplPath, $outPath = 'TemplatePath', 'OutputPath' | ForEach-Object {
        if ([IO.Path]::IsPathRooted($cfg[$_])) { $cfg[$_] } else { [IO.Path]::GetFullPath((Join-Path $cfgDir $cfg[$_])) }
    }
    if (-not (Test-Path -LiteralPath $tplPath)) { throw "config: template not found" }

    # ---- call list
    $items = New-Object System.Collections.Generic.List[object]
    if ($MockJson) {
        foreach ($file in ($MockJson | ForEach-Object { $_ -split ',' })) {
            $items.AddRange([object[]](Read-Json ([IO.File]::ReadAllText((Resolve-Path -LiteralPath $file), $utf8)))['items'])
        }
        Log INFO "source: mock files, $($items.Count) calls"
    } elseif ($BaseUrl) {
        $page = 1
        do {
            $data = Get-Page $page
            $got = @($data['items'])
            $items.AddRange([object[]]$got)
            $page++
        } while ($got.Count -gt 0 -and $items.Count -lt $data['total'])
        Log INFO "source: $BaseUrl, $($items.Count) of $($data['total']) calls"
    } else { throw 'need -BaseUrl or -MockJson' }

    # ---- oldest first; over the limit keep the latest
    $rows = foreach ($item in $items) {
        if ($item['status'] -ne 'DONE') { continue }
        $time = $null
        try { $time = [DateTimeOffset]::Parse($item['called_at'], [Globalization.CultureInfo]::InvariantCulture) }
        catch { Log WARN "called_at is not a date, cell left empty: $($item['call_id'])" }
        [pscustomobject]@{ Item = $item; Time = $time; Key = if ($time) { $time.UtcTicks } else { 0 } }
    }
    $rows = @($rows | Sort-Object Key, { $_.Item['call_id'] })
    if ($rows.Count -gt $cfg['MaxRows']) {
        Log WARN "$($rows.Count) calls exceed MaxRows, writing the latest $($cfg['MaxRows'])"
        $rows = @($rows | Select-Object -Last $cfg['MaxRows'])
    }
    $n = $rows.Count

    # ---- 12 columns (design doc chapter 6)
    $cells = New-Object 'object[,]' ([Math]::Max($n, 1)), 12
    for ($r = 0; $r -lt $n; $r++) {
        $i = $rows[$r].Item
        $cells[$r, 0] = Text $i['call_id']
        if ($rows[$r].Time) { $cells[$r, 1] = $rows[$r].Time.ToOffset($KST).DateTime.ToOADate() }   # a date value, not text
        $cells[$r, 2] = Text $i['agent_name']
        $cells[$r, 3] = Text $i['customer_company']
        $cells[$r, 4] = Text $i['customer_phone']
        $cells[$r, 5] = Text $i['category']
        $cells[$r, 6] = Text $i['customer_question']
        $cells[$r, 7] = Text $i['action_taken']
        $cells[$r, 8] = YN $i['follow_up_needed']
        $cells[$r, 9] = YN $i['needs_review']
        $cells[$r, 10] = Text $i['source_filename']
        $cells[$r, 11] = Text $i['transcript'] 32000
    }

    # ---- write into a copy of the template with Excel itself (keeps charts and slicers)
    $outDir = Split-Path -Parent $outPath
    if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
    $tmp = Join-Path $outDir ('~build_{0}.xlsx' -f [Guid]::NewGuid().ToString('N'))
    Copy-Item -LiteralPath $tplPath -Destination $tmp
    $excel = New-Object -ComObject Excel.Application
    try {
        $excel.Visible = $false
        $excel.DisplayAlerts = $false
        $book = $excel.Workbooks.Open($tmp)
        $sheet = $null; $table = $null
        foreach ($s in $book.Worksheets) { foreach ($t in $s.ListObjects) { if ($t.Name -eq 'tblCalls') { $sheet = $s; $table = $t } } }
        if (-not $table) { throw 'template: table tblCalls not found' }
        [void]$sheet.Range('A2:L1000').ClearContents()   # values only; deleting rows would break the summary formulas
        if ($n -gt 0) {
            $sheet.Range("A2:L$($n + 1)").Value2 = $cells
            $sheet.Range("B2:B$($n + 1)").NumberFormat = 'yyyy-mm-dd hh:mm'
        }
        $table.Resize($sheet.Range("A1:L$([Math]::Max($n, 1) + 1)"))   # a table needs at least one data row
        $excel.CalculateFull()
        $book.Save()
        $book.Close($false)
    } finally {
        $excel.Quit()
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
    }

    # ---- replace the output; if someone has it open, save beside it
    try { [IO.File]::Copy($tmp, $outPath, $true) }
    catch {
        $outPath = Join-Path $outDir ('{0}_{1}.xlsx' -f [IO.Path]::GetFileNameWithoutExtension($outPath), (Get-Date -Format 'yyyyMMdd_HHmmss'))
        [IO.File]::Copy($tmp, $outPath, $true)
        Log WARN 'output file is in use, saved under another name'
    }
    Log INFO "saved rows=$n output=$outPath"
    $code = 0
} catch {
    Log ERROR "$($_.Exception.Message)"
    $code = 1
} finally {
    if ($tmp -and (Test-Path -LiteralPath $tmp)) { Remove-Item -LiteralPath $tmp -Force }
}
exit $code
