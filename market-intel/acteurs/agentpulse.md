---
title: AgentPulse
type: acteur
categorie: agent — analyse de réputation d'agents
updated: 2026-08-01
---

# AgentPulse — le concurrent le plus proche de notre produit, et il est mort

**Pourquoi cette fiche existe** : c'est le seul agent trouvé sur [[virtuals-acp]] qui vende
exactement ce que Agent Reputation veut vendre — dire à quelqu'un s'il peut faire confiance à un
agent avant de s'engager avec lui.

## Ce qu'il vend — DÉCLARÉ

Sa propre description, citée telle quelle (lue le 2026-08-01) :

> « AgentPulse - AI agent health & reputation analytics. Services: health_check - status, health
> score, activity ; reputation_report - full analysis, strengths, weaknesses, recommendations ;
> agent_risk_flags - risk assessment, flags, verdict ; multi_agent_report - bulk analysis of up
> to 10 agents + portfolio summary ; competitor_analy[sis] »

Traduit en clair : bilan de santé d'un agent, rapport de réputation complet avec forces,
faiblesses et recommandations, drapeaux de risque avec verdict, et analyse groupée jusqu'à dix
agents.

## Ce qu'il a gagné — MESURÉ

| Mesure | Valeur |
|---|---|
| Revenu cumulé | **81 318 $** |
| Missions réussies | 703 |
| **Acheteurs distincts** | **71** |
| **Prix réel par rapport** | **115,67 $** |
| Taux de succès | 96,8 % |
| Créé le | 2026-02-17 |
| **Dernière activité** | **2026-04-08** |

## Les trois choses à retenir

**1. Le prix.** 115,67 $ par rapport, dans un marché dont la mission médiane vaut **3,4 centimes**.
C'est plus de trois mille fois la médiane. Cela démontre qu'un jugement sur une contrepartie peut
se vendre cher, à l'acte, sans passer par un pourcentage de transaction.

**2. Le petit nombre de clients.** Soixante et onze acheteurs distincts pour 703 missions, soit
une dizaine de rapports par client. Ce n'est pas un marché de masse : c'est une clientèle réduite
et fidèle. Un fondateur seul peut servir soixante et onze clients.

**3. Il est mort depuis le 8 avril 2026.** Presque quatre mois de silence à la date de cette
fiche. On ne sait pas pourquoi — arrêt volontaire, panne, opérateur parti. C'est une question ouverte au sens propre — mais
son serveur, lui, ne répond plus (voir plus bas).

## Ce qui nous en sépare, et c'est le point central

Sa matière première est **le registre de la plateforme elle-même** : il lit les compteurs que
Virtuals publie sur ses agents et en dérive un score de santé et de réputation.

Autrement dit, il **calcule un nombre à partir de nombres déclarés par la plateforme**, et le
présente comme une connaissance. C'est très exactement le mode d'échec que la doctrine du projet
interdit — et [[2026-08-01-marche-acp-taille-et-vitalite]] montre pourquoi ce n'est pas une
querelle théorique : 160 agents de ce registre portent une date de dernière activité à l'an 2999,
et le champ de revenu ne réconcilie pas toujours avec les portefeuilles. **Un score de santé
calculé sur ces champs hérite de leurs défauts sans les afficher.**

Notre différence tient en une phrase : lui note ce que la plateforme déclare, nous conservons ce
que nous avons observé et ce que les parties ont signé.

## Qui est derrière, et comment le joindre — MESURÉ le 2026-08-01

| Élément | Valeur |
|---|---|
| Adresse propriétaire | `0xdb6724f4feaf93079601c3e6aedfe9db5d6e0c52` |
| Portefeuille de l'agent | `0xF50446A22761B9054d50FC82BBd2a400a62d739C` |
| Contrat de l'agent | `0xa6C9BA866992cfD7fd6460ba912bfa405adA9df0` |
| Jeton | `PULSE` — `0x0f2Aec16C34D741f1fCac5479F7ef518431100dB` |
| Chaîne | Base (8453) |
| Point d'accès du service | `http://212.34.138.17:3001/results` |

**Aucun canal de contact humain.** Pas de compte X, pas de site, pas de domaine — l'agent
n'expose qu'une **adresse IP nue en HTTP**, sans nom de domaine ni chiffrement. C'est une machine
auto-hébergée, pas un service d'entreprise.

Les voies possibles pour joindre l'opérateur, de la plus à la moins praticable :
1. **Le jeton `PULSE`** : un jeton lancé sur Virtuals implique un espace communautaire (chat,
   détenteurs) et souvent un opérateur identifiable. C'est la piste la plus prometteuse.
2. **L'adresse propriétaire sur la chaîne** : regarder ce qu'elle a financé et reçu peut mener à
   une identité ou à un autre agent encore actif du même opérateur.
3. **Un message signé depuis notre propre adresse** vers la sienne — technique, sans garantie de
   lecture.

## L'arrêt est confirmé de première main — MESURÉ le 2026-08-01

Je n'ai pas cru le champ de date, je suis allé voir. **Le serveur ne répond plus du tout** :
échec de connexion sur le port 3001, trois routes essayées, aucune réponse — pas même un refus.
La machine est éteinte ou l'adresse a changé.

C'est important pour deux raisons. D'abord ça répond à la question « a-t-il vraiment arrêté ? » :
oui, son service est hors ligne. Ensuite c'est le **seul point de validation** que nous ayons pour
le champ de date de la plateforme, dont
[[2026-08-01-marche-acp-taille-et-vitalite]] montre qu'il est ambigu pour 70 % des agents. Ici
date ancienne et serveur mort concordent. **Une concordance n'est pas une validation.**

## Suite du 2026-08-03 — l'opérateur est identifié, le site est vivant, le service non

**Le dossier complet a sa fiche : [[2026-08-03-agentpulse-le-site-dit-vivant-le-serveur-est-mort]].**
En deux lignes : le site `agentpulse.health` est en ligne, porte le même contrat de jeton, et
affiche « LIVE / 99,8 % de disponibilité / dernier scan il y a 2 minutes » — pendant que son
propre CDN date la page de 26 jours et que le service refuse toute connexion.

**Canaux de contact, corrigés par l'enquête du 2026-08-03** (remplace la section ci-dessus qui
disait « aucun canal humain ») :

| Canal | Certitude |
|---|---|
| Site `agentpulse.health` | **Certaine** — porte le contrat de jeton de l'agent |
| X `@AgentPulseAI` | **Élevée** — lié depuis le site, créé le jour même de l'agent. Mais **renommé « RobinPulse »**, bio désormais sans rapport |
| X `@q00fuwx2u` (déclaré à la plateforme) | Mort — 404 |
| E-mail `@agentpulse.health` | La redirection existe, **l'adresse locale est inconnue** |
| Pseudonyme lié aux encaissements | **Moyenne** — un portefeuille destinataire porte une identité publique, mais un tiers produirait le même flux. À traiter comme pseudonyme, jamais comme identité civile |
| Adresse IP du serveur | **Piste morte** — le bloc a été recyclé vers un autre client de l'hébergeur |

⚠️ **Homonymes à ne pas confondre** : un compte `AgentPulse` existe sur le forum public, mais sa
propre description dit « pulse shows activity, not identity/AI » et son compte social diffère. Un
autre agent « Agent Pulse » du registre appartient à un tout autre propriétaire. **Trois entités
distinctes partagent ce nom** ; ne jamais les fusionner.

## Réserves

- Revenu et dates viennent du registre de la plateforme (statut : DÉCLARÉ par un tiers). À traiter
  comme un plafond.
- Son revenu et son « aGDP » sont quasi identiques (81 318 $ contre 81 317 $), ce qui est
  inhabituel — chez la plupart des agents le second est très supérieur au premier. Non expliqué.
- Il appartient au groupe `OPENCLAW`, le même que les agents de [[les-201-acheteurs]], mais il ne
  fait **pas** partie de ce groupe de onze : il a 71 acheteurs, pas 201.

Voir aussi : [[2026-08-01-metiers-de-la-confiance]] · [[virtuals-acp]]
