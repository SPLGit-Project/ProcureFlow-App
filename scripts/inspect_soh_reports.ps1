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
    
    Write-Host "  Sheets ($($wb.Sheets.Count)):"
    foreach ($sheet in $wb.Sheets) {
        Write-Host "    - '$($sheet.Name)'"
    }

    # Use first sheet
    $ws = $wb.Sheets.Item(1)
    $usedRange = $ws.UsedRange
    $rowCount = $usedRange.Rows.Count
    $colCount = $usedRange.Columns.Count

    Write-Host "  Active Sheet: '$($ws.Name)'"
    Write-Host "  Used Range: $rowCount rows x $colCount cols"

    # Print header rows (first 5 rows)
    Write-Host "`n  --- First 5 rows (raw) ---"
    for ($r = 1; $r -le [Math]::Min(5, $rowCount); $r++) {
        $rowData = @()
        for ($c = 1; $c -le $colCount; $c++) {
            $val = $ws.Cells.Item($r, $c).Text
            if ($val -ne "") { $rowData += "[$c]=$val" }
        }
        Write-Host "  Row $r : $($rowData -join ' | ')"
    }

    # Print a sample data row (row 10 if exists)
    if ($rowCount -ge 10) {
        Write-Host "`n  --- Sample Data Row (row 10) ---"
        $rowData = @()
        for ($c = 1; $c -le $colCount; $c++) {
            $val = $ws.Cells.Item(10, $c).Text
            if ($val -ne "") { $rowData += "[$c]=$val" }
        }
        Write-Host "  Row 10: $($rowData -join ' | ')"
    }

    $wb.Close($false)
}

$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Host "`nDone." -ForegroundColor Green
