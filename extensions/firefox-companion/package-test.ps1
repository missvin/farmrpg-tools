[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskOutput = Join-Path $taskRoot '../../local-data/firefox-companion'
New-Item -ItemType Directory -Force $taskOutput | Out-Null
$taskFiles = @('manifest.json','upstream-layout.js','shared.js','extractor.js','farm-content.js','tracker-content.js','background.js','popup.html','popup.css','popup.js','ATTRIBUTION.md','README.md') | ForEach-Object { Join-Path $taskRoot $_ }
$taskZip = Join-Path $taskOutput 'farmrpg-companion-test.zip'
Compress-Archive -LiteralPath $taskFiles -DestinationPath $taskZip -Force
Copy-Item -LiteralPath $taskZip -Destination (Join-Path $taskOutput 'farmrpg-companion-test.xpi') -Force
Get-FileHash (Join-Path $taskOutput 'farmrpg-companion-test.xpi') -Algorithm SHA256
Write-Output 'Unsigned test package only. Install temporarily through about:debugging; this is not a signed release.'
