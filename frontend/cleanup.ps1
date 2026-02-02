$files = Get-ChildItem -Path d:\Src\misignage\frontend\src -Recurse -File
foreach ($file in $files) {
    if (Test-Path $file.FullName) {
        $content = Get-Content $file.FullName
        if ($content -match "Pacific TimeZone") {
            $newContent = $content | Where-Object { $_ -notmatch "Pacific TimeZone" }
            $newContent | Set-Content $file.FullName -Encoding UTF8
            Write-Host "Cleaned: $($file.FullName)"
        }
    }
}
