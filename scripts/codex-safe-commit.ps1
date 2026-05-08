[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "codex-safe-commit.mjs"
& node $scriptPath
exit $LASTEXITCODE
