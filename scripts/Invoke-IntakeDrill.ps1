[CmdletBinding()]
param(
    # DryRun   : temps 1 seul — aucune signature, aucun stockage, rejouable.
    # WriteForReal : temps 1 puis 2 — écrit une ligne DÉFINITIVE dans un registre sans DELETE.
    [Parameter(Mandatory)]
    [ValidateSet('DryRun', 'WriteForReal', 'ReplyAsCounterparty')]
    [string]$Action,

    # Référence du dossier auquel répondre, pour ReplyAsCounterparty uniquement.
    [string]$FilingId
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SecretLoader = 'C:\Dev\scripts\GET-SECRET.ps1'
$NodeExe = (Get-Command node -ErrorAction Stop).Source

# Secret-blind : la valeur va du coffre à l'environnement du process enfant sans
# jamais passer par une sortie, un log ou le modèle.
function Get-PrivateValue {
    param([Parameter(Mandatory)][string]$Name)
    $value = & $SecretLoader $Name
    if ($LASTEXITCODE -ne 0 -or -not $value) {
        throw "Private runtime value unavailable: $Name"
    }
    return ($value -join "`n").Trim()
}

$Script = Join-Path $RepoRoot 'scripts\complaint-intake-drill.mts'
$Flag = switch ($Action) {
    'DryRun' { '--dry-run' }
    'WriteForReal' { '--write-for-real' }
    'ReplyAsCounterparty' {
        if (-not $FilingId) { throw '-FilingId <cb-...> is required for ReplyAsCounterparty' }
        "--reply-to=$FilingId"
    }
}

try {
    if ($Action -ne 'DryRun') {
        # La signature exige le portefeuille ; le temps 1 n'en a aucun besoin.
        $env:CDP_API_KEY_ID = Get-PrivateValue 'CDP_AGENTHUB_API_KEY_ID'
        $env:CDP_API_KEY_SECRET = Get-PrivateValue 'CDP_AGENTHUB_API_KEY_SECRET'
        $env:CDP_WALLET_SECRET = Get-PrivateValue 'CDP_AGENTHUB_WALLET_SECRET'
    }

    Push-Location $RepoRoot
    try {
        & $NodeExe '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON' '--experimental-strip-types' $Script $Flag
        $exit = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
}
finally {
    Remove-Item Env:CDP_API_KEY_ID -ErrorAction SilentlyContinue
    Remove-Item Env:CDP_API_KEY_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:CDP_WALLET_SECRET -ErrorAction SilentlyContinue
}

exit $exit
