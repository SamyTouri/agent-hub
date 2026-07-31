[CmdletBinding()]
param(
    # Nombre d'adresses d'encaissement distinctes à échantillonner dans le catalogue.
    [int]$Resources = 40,
    # Profondeur de la fenêtre de blocs Base à balayer pour trouver les payeurs.
    [int]$Blocks = 200000,
    # Chemin où déposer le rapport JSON.
    [string]$Save
)

# Mesure EN LECTURE SEULE : aucune signature, aucune dépense, aucune écriture distante.
# Les clés CDP ne servent qu'à lire le catalogue de découverte.

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SecretLoader = 'C:\Dev\scripts\GET-SECRET.ps1'
$NodeExe = (Get-Command node -ErrorAction Stop).Source

function Get-PrivateValue {
    param([Parameter(Mandatory)][string]$Name)
    $value = & $SecretLoader $Name
    if ($LASTEXITCODE -ne 0 -or -not $value) { throw "Private runtime value unavailable: $Name" }
    return ($value -join "`n").Trim()
}

try {
    $env:CDP_API_KEY_ID = Get-PrivateValue 'CDP_AGENTHUB_API_KEY_ID'
    $env:CDP_API_KEY_SECRET = Get-PrivateValue 'CDP_AGENTHUB_API_KEY_SECRET'

    $argv = @(
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'
        '--experimental-strip-types'
        (Join-Path $RepoRoot 'scripts\payer-identifiability.mts')
        '--resources'; "$Resources"
        '--blocks'; "$Blocks"
    )
    if ($Save) { $argv += @('--save', $Save) }

    Push-Location $RepoRoot
    try {
        & $NodeExe @argv
        $exit = $LASTEXITCODE
    }
    finally { Pop-Location }
}
finally {
    Remove-Item Env:CDP_API_KEY_ID -ErrorAction SilentlyContinue
    Remove-Item Env:CDP_API_KEY_SECRET -ErrorAction SilentlyContinue
}

exit $exit
