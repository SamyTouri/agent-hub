---
title: ERC-8183 — comment l'argent est bloqué puis libéré
type: regle
statut: MESURÉ (lecture du texte normatif)
updated: 2026-08-01
---

# La mécanique du séquestre et le rôle de l'arbitre

**Statut : MESURÉ** — lu ligne à ligne dans le texte brut de la norme le 2026-08-01, pas dans un
résumé. Références de lignes et citations dans `docs/erc-8183-evaluator-role-2026-08-01.md`.

## L'idée en une image

Un séquestre, c'est le notaire qui garde l'argent d'une vente immobilière et ne le verse au
vendeur que lorsque tout est en ordre. ERC-8183 fait la même chose entre logiciels : l'argent du
client est bloqué dans un contrat automatique, et n'est versé au prestataire que quand un tiers
désigné — **l'évaluateur** — dit « c'est bon ».

## Les quatre états d'une mission

`Ouverte` → `Financée` → `Livrée` → état terminal (`Complétée`, `Rejetée` ou `Expirée`).

## Ce que l'évaluateur peut faire, et ce qu'il n'a pas à faire

- Il est **le seul** à pouvoir marquer une mission complétée, ce qui libère l'argent.
- Il peut aussi rejeter, ce qui rembourse le client.
- **Il n'a aucune obligation.** Toutes les clauses le concernant sont facultatives. Aucun délai de
  réponse, aucune obligation de motiver.
- **Personne ne peut contester sa décision** : la norme écrit qu'il n'y a ni arbitrage ni recours,
  et qu'un rejet ou une expiration est définitif.
- Son motif est un champ **facultatif** : il peut valider ou rejeter sans laisser la moindre trace
  de raisonnement.

## Les trois asymétries qui expliquent tout

**1. Il n'est payé que s'il approuve.** Compléter lui verse sa commission ; rejeter rembourse le
client et ne lui verse rien ; l'expiration ne lui verse rien. **Le seul geste rémunéré est le
« oui ».**

**2. Il ne fixe pas son prix.** Le taux est une variable globale du contrat, réglée par un rôle
d'administration de la plateforme. On prend le tarif proposé ou on ne joue pas. Sur
[[virtuals-acp]], c'est 5 % de la mission.

**3. Sa commission sort du net du prestataire**, pas de la poche du client. Le client débourse son
budget quoi qu'il arrive ; c'est le prestataire qui reçoit moins. **On est payé par celui qu'on
juge.**

## Le trou du silence

Il n'existe **aucun délai propre à l'évaluateur**. La seule horloge est l'expiration de la
mission : passé ce terme, l'argent retourne au client et le prestataire qui a livré n'est pas payé.

Conséquence, soulevée sur le terrain par [[markus-dropspace]] et confirmée par cette lecture :
quand une livraison se perd **sans que personne ne réclame ni ne conteste**, l'escrow n'a rien à
enregistrer. Il court jusqu'à l'expiration, et un remboursement par expiration **confond deux
histoires différentes** — « jamais livré » et « livré mais jamais accusé réception ». C'est
précisément la distinction qui a de la valeur.

## Ce que la norme ne prévoit pas du tout

- **Aucune accréditation, aucune liste blanche, aucun dépôt de garantie, aucune sanction**
  d'évaluateur. Vérifié par recherche exhaustive des termes dans le texte.
- **Aucun moyen de trouver un évaluateur** : ni registre, ni annuaire, ni appariement. Le client
  doit déjà connaître l'adresse qu'il inscrit.
- L'évaluateur est désigné **par le client seul**, à la création, et **ne peut plus jamais être
  changé** — aucune fonction ne le permet.

## Statut de la norme

**Brouillon** (`Draft`), inchangé depuis le 13 mars 2026. On peut opérer sous cette norme ; on ne
revendique aucun statut officiel qu'elle ne confère pas.

Voir aussi : [[2026-08-01-siege-evaluateur-vide]] · [[virtuals-acp]]
