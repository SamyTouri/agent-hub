<#
.SYNOPSIS
  Create one already-reserved GitHub issue without shell interpolation.
.DESCRIPTION
  This helper is intentionally narrow. The caller must use the exact repo, title and
  wire body returned by reserve_representative_outbound_send, and must reconcile the
  attempt after every failure or timeout. It prints only the canonical issue URL.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')]
    [string]$Repo,

    [Parameter(Mandatory)]
    [ValidateLength(1, 256)]
    [string]$Title,

    [Parameter(Mandatory)]
    [ValidateNotNullOrEmpty()]
    [string]$Body,

    [ValidateRange(5, 60)]
    [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = 'Stop'
$gh = Get-Command 'gh.exe' -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1
if (-not $gh) {
    $gh = Get-Command 'gh' -CommandType Application -ErrorAction Stop |
        Select-Object -First 1
}

$bodyPath = Join-Path ([IO.Path]::GetTempPath()) (
    'aghub-outbound-{0}.md' -f [guid]::NewGuid().ToString('N')
)
$process = $null
try {
    [IO.File]::WriteAllText(
        $bodyPath,
        $Body,
        [Text.UTF8Encoding]::new($false)
    )

    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $gh.Source
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    foreach ($argument in @(
        'issue',
        'create',
        '--repo', $Repo,
        '--title', $Title,
        '--body-file', $bodyPath
    )) {
        [void]$startInfo.ArgumentList.Add($argument)
    }

    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw 'GitHub CLI did not start; reconcile the reserved send before any retry.'
    }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
        try { $process.Kill($true) } catch {}
        try { [void]$process.WaitForExit(5000) } catch {}
        throw 'GitHub CLI timed out; the outcome is ambiguous. Reconcile this send attempt and never repost it directly.'
    }
    $stdout = $stdoutTask.GetAwaiter().GetResult().Trim()
    $stderr = $stderrTask.GetAwaiter().GetResult().Trim()
    if ($process.ExitCode -ne 0) {
        $detail = if ($stderr.Length -gt 500) { $stderr.Substring(0, 500) } else { $stderr }
        throw "GitHub CLI failed (exit $($process.ExitCode)): $detail. Reconcile the reserved send before any retry."
    }
    if ($stdout -notmatch '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/issues/[1-9][0-9]*$') {
        throw 'GitHub CLI returned no canonical issue URL; reconcile the reserved send before any retry.'
    }
    $stdout
} finally {
    if ($process) { $process.Dispose() }
    if (Test-Path -LiteralPath $bodyPath) {
        try {
            Remove-Item -LiteralPath $bodyPath -Force -ErrorAction SilentlyContinue
        } catch {}
    }
}
