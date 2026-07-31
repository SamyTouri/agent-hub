[CmdletBinding()]
param(
    # Preflight : revalidation en LECTURE SEULE (aucune signature, aucune dépense).
    # Pay      : DÉPENSE 0,50 USDC RÉEL sur Base mainnet, de notre acheteur vers notre encaissement.
    # Resume   : rejoue LA MÊME autorisation déjà signée après une réponse perdue.
    # Verify   : contrôle d'après-coup en LECTURE SEULE (transaction confirmée, puis catalogue).
    [Parameter(Mandatory)]
    [ValidateSet('Preflight', 'Pay', 'Resume', 'Verify')]
    [string]$Action,

    # Chemin optionnel où déposer le rapport JSON (Preflight et Verify uniquement).
    [string]$Save
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SecretLoader = 'C:\Dev\scripts\GET-SECRET.ps1'
$NodeExe = (Get-Command node -ErrorAction Stop).Source

# Secret-blind : la valeur va du coffre à l'environnement du process enfant sans
# jamais transiter par une sortie, un log ou le modèle. Aucune branche de ce
# script n'imprime, ne compare ni ne persiste une valeur de secret.
function Get-PrivateValue {
    param([Parameter(Mandatory)][string]$Name)
    $value = & $SecretLoader $Name
    if ($LASTEXITCODE -ne 0 -or -not $value) {
        throw "Private runtime value unavailable: $Name"
    }
    return ($value -join "`n").Trim()
}

function Import-CdpCredentials {
    $env:CDP_API_KEY_ID = Get-PrivateValue 'CDP_AGENTHUB_API_KEY_ID'
    $env:CDP_API_KEY_SECRET = Get-PrivateValue 'CDP_AGENTHUB_API_KEY_SECRET'
    $env:CDP_WALLET_SECRET = Get-PrivateValue 'CDP_AGENTHUB_WALLET_SECRET'
}

function Invoke-TypeScript {
    param(
        [Parameter(Mandatory)][string[]]$Arguments,
        # Codes de sortie qui expriment un VERDICT et non une panne. Les traiter
        # comme des erreurs masquerait le rapport JSON déjà écrit sur stdout.
        [int[]]$VerdictExitCodes = @()
    )
    & $NodeExe '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON' `
        '--experimental-strip-types' @Arguments
    # Le code de sortie passe par une variable de script, JAMAIS par le pipeline :
    # `$x = Invoke-TypeScript ...` capturerait aussi le rapport JSON de l'enfant et
    # le ferait disparaître de l'écran.
    $script:LastNodeExit = $LASTEXITCODE
    if ($LASTEXITCODE -ne 0 -and $VerdictExitCodes -notcontains $LASTEXITCODE) {
        throw "Node command failed with exit code $LASTEXITCODE"
    }
}

function Get-SaveArgs {
    if ($Save) { return @('--save', $Save) }
    return @()
}

try {
    Push-Location $RepoRoot
    try {
        switch ($Action) {
            'Preflight' {
                # Les clés CDP sont chargées pour deux LECTURES seulement : le solde
                # du portefeuille acheteur et le catalogue de découverte. Le script
                # de préflight ne contient aucun code de signature.
                Import-CdpCredentials
                # 1 = NO-GO : un verdict lisible dans le rapport, pas une panne.
                Invoke-TypeScript (@('scripts/discovery-listing-preflight.mts') + (Get-SaveArgs)) -VerdictExitCodes @(1)
                if ($script:LastNodeExit -eq 1) {
                    Write-Host ''
                    Write-Host 'NO-GO : ne rien dépenser. Le rapport ci-dessus dit quel contrôle a échoué.' -ForegroundColor Red
                }
            }
            'Verify' {
                Import-CdpCredentials
                # 1 = pas (encore) listé, ou parcours non concluant. C'est une réponse.
                Invoke-TypeScript (@('scripts/discovery-listing-verify.mts') + (Get-SaveArgs)) -VerdictExitCodes @(1)
                if ($script:LastNodeExit -eq 1) {
                    Write-Host ''
                    Write-Host 'Pas encore listé. Lire indexing_verdict ci-dessus avant d''en conclure quoi que ce soit.' -ForegroundColor Yellow
                }
            }
            'Pay' {
                Import-CdpCredentials
                $env:DISCOVERY_LISTING_EXECUTE = 'I-AUTHORIZE-EXACTLY-0.50-REAL-USDC-TO-LIST-AGENT-REPUTATION-IN-THE-X402-CATALOG'
                Write-Host ''
                Write-Host 'Ceci va dépenser 0,50 USDC RÉEL sur Base mainnet.' -ForegroundColor Yellow
                Write-Host 'Payeur       : 0x5F3C44C54585fC96aA8E636BA4cF2bc438934c63 (notre acheteur)'
                Write-Host 'Destinataire : 0x76e8a4Ac5B46c179aCCDfcd38281C4944749E3E4 (notre encaissement)'
                Write-Host 'Ressource    : https://agentreputation.dev/api/prepurchase/order'
                Write-Host ''
                Write-Host 'Réserve : le classement du catalogue se joue sur le nombre d''acheteurs' -ForegroundColor DarkYellow
                Write-Host 'DISTINCTS, le nombre de paiements et la fraîcheur sur trente jours. Cet achat' -ForegroundColor DarkYellow
                Write-Host 'nous fait entrer avec UN seul acheteur, qui est nous. Nécessaire pour exister,' -ForegroundColor DarkYellow
                Write-Host 'sans visibilité tant qu''un tiers réel n''a pas acheté.' -ForegroundColor DarkYellow
                Write-Host ''
                Invoke-TypeScript @(
                    'scripts/discovery-listing-pay.mts',
                    '--execute',
                    '--i-authorize-discovery-listing-payment'
                )
                Write-Host ''
                Write-Host 'Prochaine étape : .\scripts\Invoke-DiscoveryListing.ps1 -Action Verify' -ForegroundColor Cyan
                Write-Host "L'indexation prend jusqu'à 6 heures ; un défaut de métadonnées ne produit aucune erreur." -ForegroundColor Cyan
            }
            'Resume' {
                # Rejoue UNE autorisation déjà signée. Ne signe jamais la seconde.
                # Le vendeur indexe les commandes sur le nonce EIP-3009 : le rejeu
                # retrouve la commande réglée sans régler deux fois.
                Import-CdpCredentials
                $env:DISCOVERY_LISTING_EXECUTE = 'I-AUTHORIZE-EXACTLY-0.50-REAL-USDC-TO-LIST-AGENT-REPUTATION-IN-THE-X402-CATALOG'
                Invoke-TypeScript @(
                    'scripts/discovery-listing-pay.mts',
                    '--execute',
                    '--i-authorize-discovery-listing-payment',
                    '--resume-pending'
                )
            }
        }
    } finally {
        Pop-Location
    }
} finally {
    Remove-Item Env:CDP_API_KEY_ID -ErrorAction SilentlyContinue
    Remove-Item Env:CDP_API_KEY_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:CDP_WALLET_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:DISCOVERY_LISTING_EXECUTE -ErrorAction SilentlyContinue
}
