---
title: AgentPulse — le site annonce « en ligne, dernier scan il y a 2 minutes », le service ne répond plus depuis avril
type: mesure
statut: MESURÉ (première main, tout est rejouable)
date: 2026-08-03
updated: 2026-08-03
---

# Le dossier complet d'AgentPulse

**Pourquoi cette fiche est la plus importante de la base.** C'est le premier cas où nous tenons,
sur un même sujet, les trois choses que le projet dit vouloir tenir ensemble : une **promesse
commerciale publique**, une **observation qui la contredit**, et une **date** — le tout vérifiable
par n'importe qui.

Contexte de l'acteur : [[agentpulse]].

## Ce que le vendeur affiche publiquement, aujourd'hui

Site `https://www.agentpulse.health/`, lu et figé le **2026-08-03 à 09:05 UTC**.

Titre : *« AgentPulse — The Healthcare System for AI Agents »*, sous-titre *« Guardian of the ACP
Marketplace »*. Le contrat de jeton affiché sur la page est
`0x0f2Aec16C34D741f1fCac5479F7ef518431100dB` — **exactement celui de l'agent 3212 du registre**,
ce qui établit sans ambiguïté qu'il s'agit du même projet.

Ce que la page annonce, au présent :

| Affiché | |
|---|---|
| Badge d'état | **LIVE** · **SYS_ONLINE** |
| Santé système | **99,9 %** |
| Disponibilité | **99,8 %** |
| Surveillance | **24/7 Monitoring** |
| Dernier scan | **« Last scan: 2 min ago »** |
| Agents analysés | 47 |

## Ce que l'observation dit

**Le service ne répond pas.** Le point d'accès que l'agent déclare dans le registre,
`http://212.34.138.17:3001/results`, est en échec de connexion pur. Sondé le 2026-08-01, re-sondé
le 2026-08-03 à 09:05 — pas une erreur applicative, pas un refus : aucune connexion possible.

**Et le CDN du vendeur contredit son propre site.** L'en-tête servi avec la page :

```
Age: 2288832
```

Vingt-deux millions de secondes, soit **26,5 jours**. C'est la durée pendant laquelle cette copie
est restée en cache sans être régénérée par l'origine. **L'infrastructure du vendeur atteste
elle-même que la page n'a pas bougé depuis environ le 7 juillet**, pendant que la page affirme que
sa dernière mesure date de deux minutes.

Ce n'est pas notre interprétation contre la sienne : c'est **son propre serveur qui date sa page**,
et la date contredit le texte.

## Le troisième écart, chiffré

Le site annonce **47 agents analysés**. Le registre de la plateforme déclare pour le même agent
**703 missions et 71 acheteurs distincts**. Les deux ne peuvent pas être vrais en même temps. Le
plus probable est que le site a été figé dans ses premières semaines et jamais rouvert.

## La chronologie, telle qu'elle se lit

| Date | Fait | Source |
|---|---|---|
| 2026-02-17 | Agent créé | registre |
| 2026-02-19 | Jeton PULSE lancé | Virtuals |
| 2026-04-08 | Dernière trace d'activité | registre |
| ~2026-07-07 | Dernière régénération de la page | en-tête `Age`, MESURÉ |
| 2026-07-23 | Déblocage de l'allocation équipe, vente du jeton, produits transférés | RAPPORTÉ |
| 2026-08-01 / 08-03 | Endpoint en échec de connexion, site toujours « LIVE » | MESURÉ |

Le service meurt en avril. Le site continue d'annoncer 99,8 % de disponibilité. L'opérateur
revient en juillet — non pour réparer, mais pour encaisser sa part.

## Pourquoi c'est exactement notre produit

Un acheteur qui découvre ce vendeur aujourd'hui lit « LIVE », « 99,8 % uptime », « dernier scan il
y a 2 minutes ». Rien dans ce qu'il peut consulter — ni le site, ni le registre, ni aucun annuaire
— ne lui dit que le service est éteint depuis quatre mois.

**L'information qui manque n'est pas difficile à produire.** Une requête en lecture sur l'adresse
que le vendeur publie lui-même suffit, et coûte deux secondes. Personne ne la fait.

Et l'ironie, qui est le meilleur argument que nous aurons : **un agent qui vendait la surveillance
de santé des autres agents est mort en affichant 99,8 % de disponibilité.**

## Ce qui est figé pour pouvoir être opposé plus tard

- Empreinte des octets exacts de la page : `sha256 =
  12bab86900b79a99efc1421d4db6545f5f7115eaffb2a0165b03a263f4f6abbd`, 56 797 octets
- Validateurs d'origine : `Etag: "13844bc5f1bf9a7b1cd4487a4bcc57be"`, `Date: Mon, 03 Aug 2026
  09:05:23 GMT`, `Age: 2288832`, `Server: Vercel`
- Indépendance temporelle : **UNKNOWN** — ces en-têtes viennent de l'origine, pas d'un tiers.
  Conformément à [[date-de-plateforme-est-une-declaration]], ils sont conservés comme
  déclarations, pas comme preuve de date.

## Réserves, tenues comme les autres

- **Un serveur muet n'est pas une preuve d'abandon définitif.** C'est deux observations datées à
  deux jours d'intervalle. Un troisième relevé, plus tard, ferait la différence entre panne et
  arrêt.
- **Rien ici n'établit une intention de tromper.** Une page marketing figée est le défaut le plus
  banal du web. Ce qui est mesuré, c'est l'écart entre ce qui est annoncé et ce qui répond — pas
  un état d'esprit.
- L'histoire de l'encaissement de juillet est **rapportée par une lecture de chaîne que je n'ai
  pas refaite moi-même**. Elle n'est pas nécessaire au constat principal.

Voisin : [[2026-08-03-sonde-endpoints-segment-confiance]] · [[agentpulse]] ·
[[date-de-plateforme-est-une-declaration]]
