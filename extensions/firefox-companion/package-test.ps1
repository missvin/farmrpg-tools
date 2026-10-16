[CmdletBinding()]
param([switch]$ForSigning)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskOutput = Join-Path $taskRoot '../../local-data/firefox-companion'
New-Item -ItemType Directory -Force $taskOutput | Out-Null
$taskFiles = @('manifest.json','upstream-layout.js','shared.js','extractor.js','farm-content.js','tracker-content.js','background.js','popup.html','popup.css','popup.js','ATTRIBUTION.md','README.md','PRIVACY.md') | ForEach-Object { Join-Path $taskRoot $_ }
$taskManifest = Get-Content -LiteralPath (Join-Path $taskRoot manifest.json) -Raw | ConvertFrom-Json
if ($taskManifest.browser_specific_settings.gecko.id -ne 'farmrpg-planning-companion@missvin') {
  throw 'Preserve the existing add-on ID so signed updates retain extension storage.'
}
$taskName = if ($ForSigning) { 'farmrpg-companion-' + $taskManifest.version + '-unsigned' } else { 'farmrpg-companion-test' }
$taskZip = Join-Path $taskOutput ($taskName + '.zip')
Compress-Archive -LiteralPath $taskFiles -DestinationPath $taskZip -Force
if ($ForSigning) {
  Get-FileHash -LiteralPath $taskZip -Algorithm SHA256
  Write-Output 'Unsigned Mozilla submission ZIP only. Upload as On your own; install only the signed XPI returned by Mozilla.'
  return
}
Copy-Item -LiteralPath $taskZip -Destination (Join-Path $taskOutput 'farmrpg-companion-test.xpi') -Force
Get-FileHash (Join-Path $taskOutput 'farmrpg-companion-test.xpi') -Algorithm SHA256
Write-Output 'Unsigned test package only. Install temporarily through about:debugging; this is not a signed release.'
