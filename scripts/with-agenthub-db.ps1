<#
.SYNOPSIS
Exécute une commande Node avec DATABASE_URL injecté, sans jamais afficher le secret.

.DESCRIPTION
Le dépôt est en architecture zero-secret-local : le mot de passe de la base AgentHub vit
dans Bitwarden et n'est jamais écrit sur disque. Ce lanceur le récupère par le chargeur
approuvé, construit l'URL de connexion en mémoire, l'injecte dans l'environnement du
processus enfant, puis l'efface. Rien n'est écrit, journalisé ni renvoyé sur la sortie.

Deux ports, et le choix compte :
  6543 (transaction pooling) est celui du site en production, et il ne supporte PAS le DDL.
  5432 (session pooling) est celui à utiliser pour créer des tables ou des index.

.EXAMPLE
pwsh -File scripts/with-agenthub-db.ps1 -Port 5432 -- node scripts/run-sql-file.mjs db/migration-complaint-bureau.sql

.EXAMPLE
pwsh -File scripts/with-agenthub-db.ps1 -- node scripts/complaint-desk.mjs list
#>
[CmdletBinding()]
param(
    [ValidateSet(5432, 6543)]
    [int]$Port = 6543,

    # Empêche l'ouverture d'une fenêtre de mot de passe maître : utile en exécution
    # planifiée ou déléguée, où un blocage silencieux vaut mieux qu'une attente.
    [switch]$CacheOnly,

    # Position 0 explicite : sans elle, PowerShell attribue le premier argument nu à -Port
    # et « node » devient un numéro de port invalide.
    [Parameter(Mandatory = $true, Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$Command
)

$ErrorActionPreference = 'Stop'

# Le projet Supabase est fixe et public ; seul le mot de passe est secret.
$ProjectRef = 'rprhlzipryatzaefrzhd'
$PoolerHost = 'aws-0-eu-west-1.pooler.supabase.com'
$GetSecret = 'C:\Dev\scripts\GET-SECRET.ps1'

if (-not (Test-Path $GetSecret)) {
    throw "Chargeur de secrets introuvable : $GetSecret"
}

# `--` en tête est avalé par l'appelant PowerShell dans certains cas, pas dans d'autres.
$argv = @($Command | Where-Object { $_ -ne '--' })
if ($argv.Count -eq 0) { throw 'Aucune commande à exécuter après --' }

$password = $null
try {
    $password = if ($CacheOnly) {
        & $GetSecret 'SUPABASE_AGENTHUB_DATABASE_PASSWORD' -CacheOnly
    } else {
        & $GetSecret 'SUPABASE_AGENTHUB_DATABASE_PASSWORD'
    }

    # On ne teste QUE la présence : ni la valeur, ni sa forme, ni sa longueur ne sortent d'ici.
    if ([string]::IsNullOrWhiteSpace($password)) {
        throw 'Mot de passe base indisponible (cache expiré ou coffre verrouillé). Relancer sans -CacheOnly pour saisir le mot de passe maître.'
    }

    $encoded = [System.Uri]::EscapeDataString($password.Trim())
    $env:DATABASE_URL = "postgresql://postgres.$ProjectRef`:$encoded@$PoolerHost`:$Port/postgres"

    & $argv[0] @($argv[1..($argv.Count - 1)])
    $code = $LASTEXITCODE
    if ($null -ne $code -and $code -ne 0) {
        throw "La commande a échoué (code $code)"
    }
} finally {
    # L'URL contient le secret : elle ne survit ni à la session, ni à un plantage.
    $env:DATABASE_URL = $null
    if ($password) { $password = $null }
    [System.GC]::Collect()
}
