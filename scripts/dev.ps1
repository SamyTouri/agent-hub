# Lance Agent Hub en local en chargeant les secrets depuis Bitwarden (aucun .env en clair).
# Usage : pwsh -File scripts\dev.ps1
$ErrorActionPreference = 'Stop'

$dbPwd  = & C:\Dev\scripts\GET-SECRET.ps1 SUPABASE_AGENTHUB_DATABASE_PASSWORD
$openai = & C:\Dev\scripts\GET-SECRET.ps1 OPENAI_API_KEY_SAMYPRIVE
if (-not $dbPwd -or -not $openai) { Write-Error 'Secrets indisponibles (Bitwarden verrouillé ?)'; exit 1 }

$ref = 'rprhlzipryatzaefrzhd'
$enc = [uri]::EscapeDataString($dbPwd)
# Pooler transaction (port 6543) : compatible serverless / connexions courtes.
$env:DATABASE_URL   = "postgresql://postgres.${ref}:${enc}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
$env:OPENAI_API_KEY = $openai

npm run dev
