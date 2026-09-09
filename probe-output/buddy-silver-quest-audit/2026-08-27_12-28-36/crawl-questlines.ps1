param(
  [string]$RunRoot = 'probe-output\buddy-silver-quest-audit\2026-08-27_12-28-36',
  [string]$CatalogPath = 'data\quest_catalog.csv'
)

$ErrorActionPreference = 'Stop'
$rawRoot = Join-Path $RunRoot 'raw\questlines'
$resultsPath = Join-Path $RunRoot 'questline-results.csv'
$candidatesPath = Join-Path $RunRoot 'candidate-questlines.csv'
$logPath = Join-Path $RunRoot 'fetch-log.jsonl'
New-Item -ItemType Directory -Force -Path $rawRoot | Out-Null

function ConvertTo-BuddySlug([string]$Name) {
  $slug = $Name.ToLowerInvariant() -replace "['’]", '' -replace '&', ' and '
  $slug = $slug -replace '[^a-z0-9]+', '-'
  return $slug.Trim('-')
}

function Get-ResponseStatus([string]$HeaderPath) {
  if (!(Test-Path -LiteralPath $HeaderPath)) { return 0 }
  $matches = [regex]::Matches((Get-Content -LiteralPath $HeaderPath -Raw), 'HTTP/\S+\s+(\d{3})')
  if ($matches.Count -eq 0) { return 0 }
  return [int]$matches[$matches.Count - 1].Groups[1].Value
}

$questlines = Import-Csv -LiteralPath $CatalogPath |
  Where-Object { $_.questline_key -and $_.questline_name } |
  Group-Object questline_key |
  ForEach-Object {
    $row = $_.Group | Select-Object -First 1
    [pscustomobject]@{
      questline_key = $row.questline_key
      questline_name = $row.questline_name
      quest_count_from_item_cache = $_.Count
      slug = ConvertTo-BuddySlug $row.questline_name
      buddy_url = "https://buddy.farm/ql/$(ConvertTo-BuddySlug $row.questline_name)/"
    }
  } |
  Sort-Object questline_name

$fixturePath = Join-Path $RunRoot 'required-questline-fixtures.csv'
if (Test-Path -LiteralPath $fixturePath) {
  foreach ($fixture in (Import-Csv -LiteralPath $fixturePath)) {
    if (!($questlines | Where-Object { $_.questline_key -eq $fixture.questline_key })) {
      $questlines += [pscustomobject]@{
        questline_key = $fixture.questline_key
        questline_name = $fixture.questline_name
        quest_count_from_item_cache = 0
        slug = ($fixture.buddy_url.TrimEnd('/') -split '/')[-1]
        buddy_url = $fixture.buddy_url
      }
    }
  }
  $questlines = $questlines | Sort-Object questline_name
}

$questlines | Select-Object questline_key,questline_name,quest_count_from_item_cache,slug |
  Export-Csv -LiteralPath (Join-Path $RunRoot 'discovered-questlines-from-item-cache.csv') -NoTypeInformation

if (!(Test-Path -LiteralPath $resultsPath)) {
  'questline_key,questline_name,quest_count_from_item_cache,buddy_url,http_status,fetch_timestamp_utc,wait_seconds,total_request_silver,parse_status,raw_body,raw_headers,sha256' | Set-Content -LiteralPath $resultsPath
}
if (!(Test-Path -LiteralPath $candidatesPath)) {
  'questline_key,questline_name,buddy_url,total_request_silver,candidate_reason,parse_status' | Set-Content -LiteralPath $candidatesPath
}

$completed = @{}
Import-Csv -LiteralPath $resultsPath | ForEach-Object { $completed[$_.questline_key] = $true }
$consecutiveServiceFailures = 0

foreach ($line in $questlines) {
  if ($completed.ContainsKey($line.questline_key)) { continue }

  $bodyName = "$($line.slug).html"
  $headerName = "$($line.slug)-headers.txt"
  $bodyPath = Join-Path $rawRoot $bodyName
  $headerPath = Join-Path $rawRoot $headerName
  $url = $line.buddy_url
  $started = [DateTime]::UtcNow.ToString('o')
  $pilotBodyPath = Join-Path $RunRoot "raw\quests\questline-$($line.slug).html"
  $pilotHeaderPath = Join-Path $RunRoot "raw\quests\questline-$($line.slug)-headers.txt"
  if ((Test-Path -LiteralPath $bodyPath) -and (Test-Path -LiteralPath $headerPath)) {
    $delay = 0
    $curlOutput = ''
  } elseif ((Test-Path -LiteralPath $pilotBodyPath) -and (Test-Path -LiteralPath $pilotHeaderPath)) {
    $bodyPath = $pilotBodyPath
    $headerPath = $pilotHeaderPath
    $delay = 0
    $curlOutput = ''
  } else {
    $delay = Get-Random -Minimum 6 -Maximum 11
    Start-Sleep -Seconds $delay
    $curlOutput = & curl.exe --http1.1 -sS -D $headerPath -A 'FarmRPGToolsReviewAudit/1.0 (+local review-only)' -o $bodyPath -w '%{http_code}' $url 2>&1
  }
  $status = Get-ResponseStatus $headerPath
  if ($status -eq 0 -and $curlOutput -match '^\d{3}$') { $status = [int]$curlOutput }
  $hash = if (Test-Path -LiteralPath $bodyPath) { (Get-FileHash -Algorithm SHA256 -LiteralPath $bodyPath).Hash } else { '' }
  $silver = ''
  $parseStatus = 'not_parsed'

  if ($status -eq 200 -and (Test-Path -LiteralPath $bodyPath)) {
    $html = Get-Content -LiteralPath $bodyPath -Raw
    $request = [regex]::Match($html, 'Total Request</h3>(?<section>.*?)<h3[^>]*>Total Reward</h3>', [Text.RegularExpressions.RegexOptions]::Singleline)
    $match = if ($request.Success) { [regex]::Match($request.Groups['section'].Value, '>Silver</div>.*?<span[^>]*bf-list-value[^>]*>([0-9,]+)</span>', [Text.RegularExpressions.RegexOptions]::Singleline) } else { $null }
    if ($match -and $match.Success) {
      $silver = $match.Groups[1].Value.Replace(',', '')
      $parseStatus = 'parsed_silver_total'
    } elseif ($request.Success) {
      $parseStatus = 'parsed_no_silver_total'
    } else {
      $parseStatus = 'ambiguous_missing_total_request'
    }
  } elseif ($status -eq 404) {
    $parseStatus = 'not_found'
  } else {
    $parseStatus = 'fetch_failure'
  }

  $row = [pscustomobject]@{
    questline_key = $line.questline_key
    questline_name = $line.questline_name
    quest_count_from_item_cache = $line.quest_count_from_item_cache
    buddy_url = $url
    http_status = $status
    fetch_timestamp_utc = $started
    wait_seconds = $delay
    total_request_silver = $silver
    parse_status = $parseStatus
    raw_body = "raw/questlines/$bodyName"
    raw_headers = "raw/questlines/$headerName"
    sha256 = $hash
  }
  $row | ConvertTo-Csv -NoTypeInformation | Select-Object -Skip 1 | Add-Content -LiteralPath $resultsPath
  $row | ConvertTo-Json -Compress | Add-Content -LiteralPath $logPath

  $isCandidate = ($silver -and [decimal]$silver -ge 1000000000000) -or $parseStatus -like 'ambiguous*'
  if ($isCandidate) {
    $reason = if ($silver -and [decimal]$silver -ge 1000000000000) { 'total_request_silver_at_least_1_trillion' } else { 'ambiguous_total_request_parse' }
    [pscustomobject]@{ questline_key=$line.questline_key; questline_name=$line.questline_name; buddy_url=$url; total_request_silver=$silver; candidate_reason=$reason; parse_status=$parseStatus } |
      ConvertTo-Csv -NoTypeInformation | Select-Object -Skip 1 | Add-Content -LiteralPath $candidatesPath
  }

  if ($status -in 0,403,429,500,501,502,503,504) { $consecutiveServiceFailures++ } else { $consecutiveServiceFailures = 0 }
  if ($consecutiveServiceFailures -ge 3) {
    [pscustomobject]@{ event='stop'; reason='three_consecutive_service_or_rate_limit_failures'; timestamp_utc=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json -Compress | Add-Content -LiteralPath $logPath
    break
  }
}
