[CmdletBinding()]
param(
    # Provision : crée/retrouve les deux comptes CDP dédiés (aucun mouvement de fonds).
    # Inspect   : lit adresses et soldes USDC réels (aucun mouvement de fonds).
    # Accept    : PAIE 0,50 USDC RÉEL contre la route de production, puis rejoue.
    [Parameter(Mandatory)]
    [ValidateSet('Provision', 'Inspect', 'Accept', 'ResumeAccept')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SecretLoader = 'C:\Dev\scripts\GET-SECRET.ps1'
$NodeExe = (Get-Command node -ErrorAction Stop).Source

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

function Get-MainnetWalletState {
    $statePath = Join-Path $RepoRoot '.exchange\codex\prepurchase-mainnet-wallets.json'
    if (-not (Test-Path -LiteralPath $statePath)) {
        throw 'Mainnet wallet state is missing; run Provision first.'
    }
    $state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
    if ($state.network -ne 'eip155:8453') {
        throw 'Wallet state is not for Base mainnet.'
    }
    return $state
}

try {
    # Le projet CDP est partagé avec le banc testnet : la clé API n'est pas
    # bornée à un réseau. Ce qui borne la dépense, c'est le montant, le réseau,
    # l'actif et le destinataire épinglés côté script, plus les spend controls.
    $env:CDP_API_KEY_ID = Get-PrivateValue 'CDP_AGENTHUB_API_KEY_ID'
    $env:CDP_API_KEY_SECRET = Get-PrivateValue 'CDP_AGENTHUB_API_KEY_SECRET'
    $env:CDP_WALLET_SECRET = Get-PrivateValue 'CDP_AGENTHUB_WALLET_SECRET'

    Push-Location $RepoRoot
    try {
        switch ($Action) {
            'Provision' {
                $env:PREPURCHASE_MAINNET_WALLET_PREPARE = 'I-AUTHORIZE-CDP-MAINNET-WALLET-PROVISIONING'
                Invoke-TypeScript @('scripts/prepurchase-mainnet-wallets.mts', '--provision')
            }
            'Inspect' {
                Invoke-TypeScript @('scripts/prepurchase-mainnet-wallets.mts', '--inspect')
            }
            'Accept' {
                $state = Get-MainnetWalletState
                Write-Host ''
                Write-Host 'Ceci va dépenser 0,50 USDC RÉEL sur Base mainnet.' -ForegroundColor Yellow
                Write-Host ("Destinataire : {0} ({1})" -f $state.receiver.address, $state.receiver.name)
                Write-Host ''
                $env:PREPURCHASE_MAINNET_PAY_TO = $state.receiver.address
                $env:PREPURCHASE_MAINNET_EXECUTE = 'I-AUTHORIZE-EXACTLY-0.50-REAL-USDC-ON-BASE-MAINNET'
                Invoke-TypeScript @('scripts/prepurchase-mainnet-e2e.mts', '--execute')
            }
            'ResumeAccept' {
                # Reprend UNE autorisation déjà signée après une réponse HTTP
                # perdue. Ne signe jamais une seconde autorisation.
                $state = Get-MainnetWalletState
                $env:PREPURCHASE_MAINNET_PAY_TO = $state.receiver.address
                $env:PREPURCHASE_MAINNET_EXECUTE = 'I-AUTHORIZE-EXACTLY-0.50-REAL-USDC-ON-BASE-MAINNET'
                Invoke-TypeScript @('scripts/prepurchase-mainnet-e2e.mts', '--execute', '--resume-pending')
            }
        }
    } finally {
        Pop-Location
    }
} finally {
    Remove-Item Env:CDP_API_KEY_ID -ErrorAction SilentlyContinue
    Remove-Item Env:CDP_API_KEY_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:CDP_WALLET_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:PREPURCHASE_MAINNET_PAY_TO -ErrorAction SilentlyContinue
    Remove-Item Env:PREPURCHASE_MAINNET_EXECUTE -ErrorAction SilentlyContinue
    Remove-Item Env:PREPURCHASE_MAINNET_WALLET_PREPARE -ErrorAction SilentlyContinue
}
