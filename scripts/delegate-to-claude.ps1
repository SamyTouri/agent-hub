<#
.SYNOPSIS
  Canonical delegation entry point: Codex (or any orchestrator) -> Claude Code headless.
.DESCRIPTION
  Implements the Delegation protocol of AGENTS.md:
  - resumes the canonical Claude conversation thread (.context/claude-thread.json)
    so every delegated task continues an existing line of reasoning instead of
    starting cold ("one thread per workstream");
  - runs Claude Code headless with the project hook active (permission asks become
    clean refusals that MUST be reported back, never worked around);
  - updates the thread file with the new session_id returned by the run;
  - appends an entry to the shared delegation log (.context/memory/delegation-log.md);
  - prints the full result JSON on stdout for the orchestrator to parse.
.EXAMPLE
  pwsh -File scripts/delegate-to-claude.ps1 -Thread conversion -BriefFile .exchange\codex\brief.md
  pwsh -File scripts/delegate-to-claude.ps1 -Brief "Review lib/agenthub.ts for N+1 queries; report, do not fix."
#>
[CmdletBinding()]
param(
    [string]$Brief,
    [string]$BriefFile,
    [string]$Thread = 'main',
    [int]$MaxTurns = 40,
    [string]$Model = 'claude-fable-5',
    [ValidateSet('acceptEdits', 'bypassPermissions', 'default')]
    [string]$PermissionMode = 'acceptEdits'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$threadFile = Join-Path $repo '.context\claude-thread.json'
$delegationLog = Join-Path $repo '.context\memory\delegation-log.md'

if (-not $Brief -and $BriefFile) { $Brief = Get-Content $BriefFile -Raw }
if ([string]::IsNullOrWhiteSpace($Brief)) { throw 'Provide -Brief or -BriefFile.' }

# Resolve the Claude Code CLI shipped with the desktop app (versioned folder).
$cliRoot = Join-Path $env:APPDATA 'Claude\claude-code'
$claude = Get-ChildItem $cliRoot -Directory | Sort-Object Name -Descending |
    Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName 'claude.exe' }
if (-not (Test-Path $claude)) { throw "Claude Code CLI not found under $cliRoot" }

# Thread continuity: resume the canonical thread for this workstream if it exists.
$threads = @{}
if (Test-Path $threadFile) {
    $json = Get-Content $threadFile -Raw | ConvertFrom-Json
    foreach ($p in $json.threads.PSObject.Properties) { $threads[$p.Name] = $p.Value }
}
$resumeId = $threads[$Thread].session_id

$cliArgs = @('-p', $Brief, '--permission-mode', $PermissionMode, '--model', $Model,
             '--max-turns', $MaxTurns, '--output-format', 'json')
if ($resumeId) { $cliArgs = @('--resume', $resumeId) + $cliArgs }

Push-Location $repo
try {
    $raw = & $claude @cliArgs 2>$null
} finally {
    Pop-Location
}

$result = $null
try { $result = "$raw" | ConvertFrom-Json } catch {}
if (-not $result) {
    Write-Error "Claude Code returned no parseable JSON. Raw output:`n$raw"
    exit 1
}

# Persist the NEW session id (a resumed run returns a fresh id carrying the history).
$threads[$Thread] = @{
    session_id = $result.session_id
    updated    = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK')
}
$dir = Split-Path $threadFile -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
@{ threads = $threads } | ConvertTo-Json -Depth 4 | Set-Content $threadFile -Encoding UTF8

# Shared delegation log (read by Codex, Claude Code and Samy via .context/memory).
$briefLine = ($Brief -replace '\s+', ' ')
if ($briefLine.Length -gt 220) { $briefLine = $briefLine.Substring(0, 220) + '...' }
$entry = @"

## $(Get-Date -Format 'yyyy-MM-dd HH:mm') — thread `$Thread`
- brief: $briefLine
- session_id: $($result.session_id) · turns: $($result.num_turns) · error: $($result.is_error)
"@
Add-Content -Path $delegationLog -Value $entry -Encoding UTF8

# Full JSON for the orchestrator (result text includes the mandatory report sections).
$raw
