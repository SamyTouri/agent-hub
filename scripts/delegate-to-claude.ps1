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
    [string]$ClaudePath,
    [ValidateSet('acceptEdits', 'bypassPermissions', 'default')]
    [string]$PermissionMode = 'acceptEdits'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$threadFile = Join-Path $repo '.context\claude-thread.json'
$delegationLog = Join-Path $repo '.context\memory\delegation-log.md'

if (-not $Brief -and $BriefFile) { $Brief = Get-Content $BriefFile -Raw }
if ([string]::IsNullOrWhiteSpace($Brief)) { throw 'Provide -Brief or -BriefFile.' }

# Resolve the public Claude Code CLI. Claude Desktop's private versioned binary is
# intentionally not used: packaged-app paths are not stable or visible to every
# orchestrator sandbox.
$command = Get-Command 'claude.exe' -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1
$candidates = @(
    $ClaudePath
    $env:CLAUDE_CODE_CLI
    $command.Source
    (Join-Path $env:USERPROFILE '.local\bin\claude.exe')
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

$claude = $null
foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        $claude = (Resolve-Path -LiteralPath $candidate).Path
        break
    }
}
if (-not $claude) {
    throw 'Claude Code CLI not found. Install it from https://code.claude.com/docs/en/installation, then reopen the terminal.'
}

function Invoke-ClaudeCli {
    param([string[]]$Arguments)

    $stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) (
        "aghub-claude-{0}-{1}.stderr" -f $PID, [guid]::NewGuid().ToString('N')
    )
    try {
        $stdout = & $claude @Arguments 2> $stderrPath
        $exitCode = $LASTEXITCODE
        $stderr = if (Test-Path -LiteralPath $stderrPath) {
            Get-Content -LiteralPath $stderrPath -Raw
        } else {
            ''
        }
        return [pscustomobject]@{
            ExitCode = $exitCode
            Stdout   = ($stdout -join [Environment]::NewLine)
            Stderr   = $stderr
        }
    } finally {
        if (Test-Path -LiteralPath $stderrPath) {
            Remove-Item -LiteralPath $stderrPath -Force
        }
    }
}

# Thread continuity: resume the canonical thread for this workstream if it exists.
$threads = @{}
if (Test-Path $threadFile) {
    $json = Get-Content $threadFile -Raw | ConvertFrom-Json
    foreach ($p in $json.threads.PSObject.Properties) { $threads[$p.Name] = $p.Value }
}
$resumeId = $threads[$Thread].session_id

$baseCliArgs = @('-p', $Brief, '--permission-mode', $PermissionMode, '--model', $Model,
                 '--max-turns', $MaxTurns, '--output-format', 'json')
$cliArgs = if ($resumeId) { @('--resume', $resumeId) + $baseCliArgs } else { $baseCliArgs }

Push-Location $repo
try {
    $run = Invoke-ClaudeCli -Arguments $cliArgs
    $resumeFallback = $false
    # Retry only when Claude proves the saved session no longer exists. Never
    # retry an ambiguous failure: the first run may already have had side effects.
    if (
        $resumeId -and
        $run.ExitCode -ne 0 -and
        $run.Stderr -match '(?i)(no conversation found with session id|session id.+(not found|does not exist|invalid))'
    ) {
        $run = Invoke-ClaudeCli -Arguments $baseCliArgs
        $resumeFallback = $true
    }
} finally {
    Pop-Location
}

$raw = $run.Stdout
$result = $null
try { $result = "$raw" | ConvertFrom-Json } catch {}
if (-not $result) {
    $diagnostic = @($run.Stderr, $raw) |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        ForEach-Object { $_.Trim() } |
        Select-Object -First 2
    $detail = ($diagnostic -join "`n")
    if ($detail.Length -gt 4000) { $detail = $detail.Substring(0, 4000) + '...[truncated]' }
    Write-Error "Claude Code returned no parseable JSON (exit $($run.ExitCode)).`n$detail"
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

## $(Get-Date -Format 'yyyy-MM-dd HH:mm') — thread $Thread
- brief: $briefLine
- session_id: $($result.session_id) · turns: $($result.num_turns) · error: $($result.is_error)
- resume_fallback: $resumeFallback
"@
Add-Content -Path $delegationLog -Value $entry -Encoding UTF8

# Full JSON for the orchestrator (result text includes the mandatory report sections).
$raw
