<#
.SYNOPSIS
Prévient l'opérateur, au démarrage d'une session Claude Code, qu'un dossier attend.

.DESCRIPTION
Le Complaint Bureau ne publie rien tout seul et la page publique promet un délai de
réponse court : un dépôt qui dort une semaine casse la promesse qui sert justement à
recruter les plaignants. Ce garde-fou lit les compteurs agrégés de la production et
n'écrit quelque chose QUE s'il y a du travail en attente.

Silencieux par construction. Aucun secret, aucune connexion base, une requête HTTP de
trois secondes maximum, et un échec ne bloque jamais le démarrage de la session.

Branché sur l'événement SessionStart de Claude Code.
#>
[CmdletBinding()]
param(
    [string]$Endpoint = 'https://agentreputation.dev/api/complaints/pulse',
    [int]$TimeoutSeconds = 3
)

$ErrorActionPreference = 'Stop'

try {
    $pulse = Invoke-RestMethod -Uri $Endpoint -TimeoutSec $TimeoutSeconds -Method Get
} catch {
    # Le silence est la bonne réponse : un réseau absent n'est pas une information utile
    # au démarrage, et surtout ce n'est pas une preuve qu'aucun dossier n'attend.
    exit 0
}

if (-not $pulse.available) { exit 0 }

$waiting = @()
if ($pulse.awaiting_verification -gt 0) {
    $waiting += "$($pulse.awaiting_verification) dépôt(s) à vérifier"
}
if ($pulse.replies_awaiting_review -gt 0) {
    $waiting += "$($pulse.replies_awaiting_review) réponse(s) de contrepartie à relire"
}
if ($pulse.publishable_now -gt 0) {
    $waiting += "$($pulse.publishable_now) dossier(s) dont le délai de réponse est écoulé"
}

if ($waiting.Count -eq 0) { exit 0 }

# Un seul bloc, court, et il dit quoi faire — pas juste qu'il se passe quelque chose.
Write-Output '[Complaint Bureau] Du travail attend, et rien ne se publie tout seul.'
foreach ($item in $waiting) { Write-Output "  - $item" }
if ($pulse.reply_window_open -gt 0) {
    Write-Output "  ($($pulse.reply_window_open) dossier(s) encore dans leur délai de réponse : ne rien publier avant la fin.)"
}
Write-Output '  Voir : pwsh -File scripts/with-agenthub-db.ps1 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/complaint-desk.mts list'
