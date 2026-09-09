param([string]$RunRoot = 'probe-output\buddy-silver-quest-audit\2026-08-27_12-28-36')
$ErrorActionPreference = 'Stop'
$fixtures = Import-Csv -LiteralPath (Join-Path $RunRoot 'required-questline-fixtures.csv')
$questRows = @()
$testRows = @()
foreach ($fixture in $fixtures) {
  $slug = ($fixture.buddy_url.TrimEnd('/') -split '/')[-1]
  $bodyPath = Join-Path $RunRoot "raw\questlines\$slug.html"
  if (!(Test-Path -LiteralPath $bodyPath)) { throw "Missing cached fixture page: $($fixture.buddy_url)" }
  $html = Get-Content -LiteralPath $bodyPath -Raw
  $title = ([regex]::Match($html, '<title[^>]*>(.*?)</title>').Groups[1].Value -replace '&#x27;', "'")
  $links = [regex]::Matches($html, 'href="(/q/[^"]+/)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
  $request = [regex]::Match($html, 'Total Request</h3>(?<section>.*?)<h3[^>]*>Total Reward</h3>', [Text.RegularExpressions.RegexOptions]::Singleline)
  $silver = if ($request.Success) { [regex]::Match($request.Groups['section'].Value, '>Silver</div>.*?<span[^>]*bf-list-value[^>]*>([0-9,]+)</span>', [Text.RegularExpressions.RegexOptions]::Singleline) }
  $silverValue = if ($silver -and $silver.Success) { $silver.Groups[1].Value.Replace(',', '') } else { '0' }
  if ($title -ne $fixture.questline_name) { throw "Title mismatch for $($fixture.buddy_url): $title" }
  if ($links.Count -ne [int]$fixture.expected_quest_count) { throw "Quest count mismatch for $($fixture.buddy_url): $($links.Count)" }
  if ([decimal]$silverValue -ne [decimal]$fixture.expected_total_request_silver) { throw "Silver total mismatch for $($fixture.buddy_url): $silverValue" }
  foreach ($link in $links) {
    $questRows += [pscustomobject]@{ questline_key=$fixture.questline_key; questline_name=$fixture.questline_name; quest_name_slug=($link.TrimEnd('/') -split '/')[-1]; buddy_url="https://buddy.farm$link" }
  }
  $testRows += [pscustomobject]@{ questline_name=$fixture.questline_name; buddy_url=$fixture.buddy_url; title_ok=$true; request_section_ok=$request.Success; quest_count=$links.Count; expected_quest_count=[int]$fixture.expected_quest_count; total_request_silver=$silverValue; expected_total_request_silver=$fixture.expected_total_request_silver; status='passed' }
}
$questRows | Export-Csv -LiteralPath (Join-Path $RunRoot 'required-questline-discovered-quests.csv') -NoTypeInformation
$testRows | Export-Csv -LiteralPath (Join-Path $RunRoot 'required-questline-test-results.csv') -NoTypeInformation
$testRows | Format-Table -AutoSize
