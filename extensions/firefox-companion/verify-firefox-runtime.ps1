[CmdletBinding()]
param([string]$Firefox = 'C:\Program Files\Mozilla Firefox\firefox.exe')
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $Firefox)) { throw 'Firefox executable was not found.' }
& (Join-Path $PSScriptRoot package-test.ps1)
$taskProfile = Join-Path $PSScriptRoot ('../../local-data/firefox-check-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $taskProfile | Out-Null
$taskProfile = [System.IO.Path]::GetFullPath($taskProfile)
$taskPortProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$taskPortProbe.Start()
$taskPort = $taskPortProbe.LocalEndpoint.Port
$taskPortProbe.Stop()
@"
user_pref("marionette.port", $taskPort);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.enabled", false);
user_pref("app.update.auto", false);
user_pref("browser.newtabpage.enabled", false);
"@ | Set-Content (Join-Path $taskProfile user.js)
$taskBrowser = Start-Process -FilePath $Firefox -ArgumentList @('-headless','-no-remote','-profile',('"'+$taskProfile+'"'),'--marionette','--remote-allow-system-access','about:blank') -WindowStyle Hidden -PassThru
try {
  $taskReady = $false
  for ($taskAttempt = 0; $taskAttempt -lt 100; $taskAttempt++) {
    $taskClient = [System.Net.Sockets.TcpClient]::new()
    try { $taskClient.Connect('127.0.0.1', $taskPort); $taskReady = $true } catch { Start-Sleep -Milliseconds 100 } finally { $taskClient.Dispose() }
    if ($taskReady) { break }
  }
  if (!$taskReady) { throw 'Isolated Firefox did not start its test listener.' }
  & node (Join-Path $PSScriptRoot verify-firefox-runtime.mjs) $taskPort
  if ($LASTEXITCODE -ne 0) { throw 'Firefox runtime check failed. See the diagnostic output above.' }
} finally {
  # Only this command's new headless browser process; never enumerate/kill normal Firefox.
  if (!$taskBrowser.HasExited) { Stop-Process -Id $taskBrowser.Id -ErrorAction SilentlyContinue }
}
