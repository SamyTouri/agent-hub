[CmdletBinding()]
param(
    # Preflight : revalidation en LECTURE SEULE (aucune dépense, aucune signature).
    # Pay      : DÉPENSE 0,05 USDC RÉEL pour le produit GET page-signals du vendeur.
    # Resume   : rejoue LA MÊME autorisation déjà signée après une réponse perdue.
    [Parameter(Mandatory)]
    [ValidateSet('Preflight', 'Pay', 'Resume')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SecretLoader = 'C:\Dev\scripts\GET-SECRET.ps1'
$NodeExe = (Get-Command node -ErrorAction Stop).Source

# Secret-blind : la valeur va du coffre à l'environnement du process enfant sans
# jamais transiter par une sortie, un log ou le modèle.
function Get-PrivateValue {
    param([Parameter(Mandatory)][string]$Name)
    $value = & $SecretLoader $Name
    if ($LASTEXITCODE -ne 0 -or -not $value) {
        throw "Private runtime value unavailable: $Name"
    }
    return ($value -join "`n").Trim()
}

function Invoke-TypeScript {
    param([Parameter(Mandatory)][string[]]$Arguments)
    & $NodeExe '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON' `
        '--experimental-strip-types' @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Node command failed with exit code $LASTEXITCODE"
    }
}

try {
    Push-Location $RepoRoot
    try {
        if ($Action -eq 'Preflight') {
            # Aucun secret n'est chargé : la revalidation lecture seule n'en a pas besoin.
            Invoke-TypeScript @('scripts/case-002-preflight.mts')
            return
        }

        $env:CDP_API_KEY_ID = Get-PrivateValue 'CDP_AGENTHUB_API_KEY_ID'
        $env:CDP_API_KEY_SECRET = Get-PrivateValue 'CDP_AGENTHUB_API_KEY_SECRET'
        $env:CDP_WALLET_SECRET = Get-PrivateValue 'CDP_AGENTHUB_WALLET_SECRET'
        $env:CASE002_EXECUTE = 'I-AUTHORIZE-EXACTLY-0.05-REAL-USDC-FOR-AGENT-REPUTATION-CASE-002'

        switch ($Action) {
            'Pay' {
                Write-Host ''
                Write-Host 'Ceci va dépenser 0,05 USDC RÉEL sur Base mainnet, chez un vendeur tiers.' -ForegroundColor Yellow
                Write-Host 'Produit : GET /v1/page-signals?url=https://agentreputation.dev/'
                Write-Host 'Destinataire : 0x2906E0CDDB5FF4754D639AbfBE65c6cA708aC27E'
                Write-Host ''
                Invoke-TypeScript @('scripts/case-002-pay.mts', '--execute', '--i-authorize-case-002-payment')
            }
            'Resume' {
                # Rejoue UNE autorisation déjà signée. Ne signe jamais la seconde :
                # sur un GET payé, l'artefact peut ne pas être relivré (nonce consommé).
                Invoke-TypeScript @('scripts/case-002-pay.mts', '--execute', '--i-authorize-case-002-payment', '--resume-pending')
            }
        }
    } finally {
        Pop-Location
    }
} finally {
    Remove-Item Env:CDP_API_KEY_ID -ErrorAction SilentlyContinue
    Remove-Item Env:CDP_API_KEY_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:CDP_WALLET_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:CASE002_EXECUTE -ErrorAction SilentlyContinue
}
