param([string]$RunRoot = 'probe-output\buddy-silver-quest-audit\2026-08-27_12-28-36')
$resultsPath = Join-Path $RunRoot 'questline-results.csv'
$rows = Import-Csv -LiteralPath $resultsPath
foreach ($row in $rows) {
  if ($row.http_status -ne '200') { continue }
  $bodyPath = Join-Path $RunRoot $row.raw_body
  if (!(Test-Path -LiteralPath $bodyPath) -and $row.questline_key -eq 'flexible spending') {
    $bodyPath = Join-Path $RunRoot 'raw\quests\questline-flexible-spending.html'
    $row.raw_body = 'raw/quests/questline-flexible-spending.html'
    $row.raw_headers = 'raw/quests/questline-flexible-spending-headers.txt'
  }
  if (!(Test-Path -LiteralPath $bodyPath)) { $row.parse_status = 'ambiguous_missing_raw_body'; continue }
  $html = Get-Content -LiteralPath $bodyPath -Raw
  $request = [regex]::Match($html, 'Total Request</h3>(?<section>.*?)<h3[^>]*>Total Reward</h3>', [Text.RegularExpressions.RegexOptions]::Singleline)
  $silver = if ($request.Success) { [regex]::Match($request.Groups['section'].Value, '>Silver</div>.*?<span[^>]*bf-list-value[^>]*>([0-9,]+)</span>', [Text.RegularExpressions.RegexOptions]::Singleline) } else { $null }
  if ($silver -and $silver.Success) {
    $row.total_request_silver = $silver.Groups[1].Value.Replace(',', '')
    $row.parse_status = 'parsed_silver_total'
  } elseif ($request.Success) {
    $row.total_request_silver = ''
    $row.parse_status = 'parsed_no_silver_total'
  } else {
    $row.total_request_silver = ''
    $row.parse_status = 'ambiguous_missing_total_request'
  }
}
$tempPath = Join-Path $RunRoot 'questline-results.reparsed.csv'
$rows | Export-Csv -LiteralPath $tempPath -NoTypeInformation
Move-Item -LiteralPath $tempPath -Destination $resultsPath -Force
$rows | Where-Object { ($_.total_request_silver -and [decimal]$_.total_request_silver -ge 1000000000000) -or $_.parse_status -like 'ambiguous*' } |
  Select-Object questline_key,questline_name,buddy_url,total_request_silver,@{n='candidate_reason';e={if($_.total_request_silver){'total_request_silver_at_least_1_trillion'}else{'ambiguous_total_request_parse'}}},parse_status |
  Export-Csv -LiteralPath (Join-Path $RunRoot 'candidate-questlines.csv') -NoTypeInformation
