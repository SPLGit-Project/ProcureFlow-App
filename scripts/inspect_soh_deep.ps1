param([string]$ReportDir = ".\docs\Supplier Reports\extracted_28052026")

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$files = Get-ChildItem -Path $ReportDir -Filter "*.xlsx"

foreach ($file in $files) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "FILE: $($file.Name)" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan

    $wb = $excel.Workbooks.Open($file.FullName)
    $ws = $wb.Sheets.Item(1)
    $usedRange = $ws.UsedRange
    $rowCount = $usedRange.Rows.Count
    $colCount = $usedRange.Columns.Count

    Write-Host "  Total rows: $rowCount, Total cols: $colCount"
    
    # Print ALL rows up to 20 to find headers
    Write-Host "`n  --- First 20 rows ---"
    for ($r = 1; $r -le [Math]::Min(20, $rowCount); $r++) {
        $rowData = @()
        for ($c = 1; $c -le $colCount; $c++) {
            $val = $ws.Cells.Item($r, $c).Text
            $rowData += "[$c]='$val'"
        }
        Write-Host "  Row $r : $($rowData -join ' | ')"
    }

    # Print last 5 rows
    if ($rowCount -gt 20) {
        Write-Host "`n  --- Last 5 rows ---"
        for ($r = ($rowCount - 4); $r -le $rowCount; $r++) {
            if ($r -lt 1) { continue }
            $rowData = @()
            for ($c = 1; $c -le $colCount; $c++) {
                $val = $ws.Cells.Item($r, $c).Text
                $rowData += "[$c]='$val'"
            }
            Write-Host "  Row $r : $($rowData -join ' | ')"
        }
    }

    $wb.Close($false)
}

$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Host "`nDone." -ForegroundColor Green
