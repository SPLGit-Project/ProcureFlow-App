Add-Type -AssemblyName System.IO.Compression.FileSystem

$docPath = "docs\Logo Branding\mercerflow_brand_architecture_blueprint.docx"
$zip = [System.IO.Compression.ZipFile]::OpenRead($docPath)
$entry = $zip.Entries | Where-Object { $_.Name -eq 'document.xml' }
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$content = $reader.ReadToEnd()
$zip.Dispose()

# Strip XML tags
$text = $content -replace '<[^>]+>', ' '
# Clean up whitespace
$text = $text -replace '\s+', ' '
$text = $text.Trim()
Write-Output $text
