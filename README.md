# Dofus Cards

Fan-jeu de cartes à collectionner **gratuit** dans le navigateur (PWA), inspiré des mécaniques de WikiMasters, avec les données du jeu Dofus fournies par [DofusDB](https://dofusdb.fr).

> Fan-jeu non officiel et gratuit. Dofus et tous ses contenus sont la propriété d'Ankama. Données : DofusDB.

Aucune monnaie payante, aucun abonnement, aucun achat : les kamas se gagnent uniquement en jouant. Le nom du jeu se change dans `src/lib/config.ts` (constante `GAME_NAME`).

## Stack

- SvelteKit 3 (adapter-node) + Svelte 5, Tailwind 4
- SQLite (better-sqlite3), migrations dans `src/lib/server/db/schema.ts`
- Auth pseudo + mot de passe (Argon2), session en cookie httpOnly
- Toute la logique de jeu est côté serveur (`src/lib/server/game/`) : minuteries, tirages, enchères, échanges, duels
- Design tokens dans **un seul fichier** : `src/lib/styles/tokens.css` (à remplacer par les valeurs du Figma). Icônes au trait dérivées de Lucide (ISC).

## Démarrer en local

```bash
npm install
npm run import:dofusdb          # télécharge DofusDB, calcule les cartes, met les images en cache dans ./data
npm run user:create -- monpseudo 'motdepasse' admin
npm run dev
```

- `npm run import:dofusdb -- --refresh` : re-télécharge les données (sinon le cache `data/raw` est réutilisé). Relançable : les cartes sont mises à jour par clé (`monster:58`…), les collections des joueurs restent valides, les cartes disparues sont désactivées (jamais supprimées).
- `npm test` : tests unitaires (tirages, minuterie, enchères, échanges, duels, quiz, modération, succès…).
- `node tests/e2e/b3-social.mjs` : vitrine, souhaits, bataille de groupe à 3 joueurs, duel, contre-proposition.
- `node tests/e2e/sell.mjs` : parcours de vente rapide (paquet, fiche, album, double clic), 390 et 1440 px.
- `node tests/e2e/run.mjs` : parcours Playwright à deux joueurs, 390 px et 1440 px (voir l'en-tête du fichier pour les variables).

Variables d'environnement : `DATA_DIR` (base + images, défaut `./data`), `ORIGIN` (URL publique, requis en production), `ADDRESS_HEADER=cf-connecting-ip` derrière Cloudflare, `NOINDEX=0` pour autoriser l'indexation.

## Docker

`Dockerfile` multi-étapes. Au premier démarrage, si la base est vide, l'import DofusDB est lancé automatiquement dans le volume `/data`.

## Données importées (DofusDB)

| Catégorie | Contenu | Cartes |
|---|---|---|
| Monstres | monstres (hors quête), archimonstres, boss de donjon | 1 402 (918 monstres, 306 archimonstres, 178 boss) |
| Objets | équipements, armes, boucliers, familiers, Dofus, Prysmaradites | 3 175 |
| Montures | Dragodindes, Muldos, Volkornes, Montiliers | 333 |
| Classes | les 19 classes | 19 |
| **Total** | | **4 929** |

## Formules

Toutes dans `src/lib/server/cards/formulas.ts` (module pur, testé).

### Rareté (6 paliers, pyramide)

1. Chaque carte reçoit un **prestige** calculé sur les vraies données :
   - monstre : `niveau/200 + 0,7 si boss + 0,45 si archimonstre + 0,1 si monstre de donjon + 0,2 x percentile(PV)`
   - objet : `niveau/200 + 1,2 si Dofus + 0,9 si Prysmaradite + 0,5 si légendaire + 0,1 si objet de panoplie + 0,25 si panoplie niveau 180 et plus + 0,15 si familier + 0,15 x percentile(puissance)`
   - monture : `0,35 + 0,5 x niveau/200 + 0,1 si Muldo/Volkorne + 0,1 si bicolore + 0,25 si Montilier`
   - classe : 1,9 (bande Ultra rare)
2. On classe toutes les cartes par prestige (percentile global) et on coupe aux seuils **45 / 72 / 87 / 95 / 98,8 %** :

| Rareté | Part visée | Cartes |
|---|---|---|
| Commune (C) | 45 % | 2 218 |
| Peu commune (PC) | 27 % | 1 331 |
| Rare (R) | 15 % | 739 |
| Super rare (SR) | 8 % | 394 |
| Ultra rare (UR) | 3,8 % | 185 |
| Légendaire (L) | 1,2 % | 62 (Dofus, grands boss…) |

### Attaque / défense (sur 10 000)

Valeurs brutes :
- monstre (grade le plus haut) : `ATK = niveau x (1 + meilleure carac. élémentaire/100) x (PA/6) + 2 x dommages` ; `DEF = PV x (1 + résistance moyenne/100)`, résistance bornée entre -50 et 80 %
- objet et monture : somme pondérée des effets (`ATTACK_WEIGHTS` / `DEFENSE_WEIGHTS` : ex. 1 PA = 100, 1 PM = 70, 1 Dommage = 5, 1 % résistance = 6, 1 Vitalité = 0,25…), dégâts d'arme = moyenne du jet x 3, malus soustraits, + `niveau x 0,5` de base
- classe : valeurs des rôles DofusDB (dégâts / protection)

Normalisation : `stat = 1 000 + 6 000 x percentile(log(brut)) dans la catégorie + 3 000 x rareté/5`, arrondie à la dizaine. Les quatre catégories partagent donc la même échelle et les cartes rares sont plus fortes.

### Paquets

1 paquet de 5 cartes toutes les 10 min, réserve max 10 (minuterie serveur ; la recharge démarre quand la réserve n'est plus pleine). Probabilités par carte : C 50 %, PC 27 %, R 13 %, SR 6,5 %, UR 2,8 %, L 0,7 % ; la 5e carte est au moins Peu commune. Révélation de la moins rare à la plus rare.

### Économie

- **Vente au jeu** (vente rapide, équivalent des wikibidous) : 1 / 3 / 10 / 30 / 100 / 400 kamas par exemplaire selon la rareté (`SELL_VALUES`). Barème volontairement bas (environ 45 kamas par paquet en moyenne) pour que les enchères restent plus intéressantes pour les cartes recherchées. Disponible depuis la fiche (quantité au choix, dernier exemplaire compris, confirmation si dernier exemplaire, favori ou Légendaire), à l'ouverture d'un paquet (Vendre / Garder par carte, « Vendre les doublons de ce paquet ») et dans l'album (mode sélection par bouton ou appui long, « Vendre tous les doublons » avec rareté maximale). Les exemplaires en enchère ou proposés dans un échange en attente ne sont pas vendables. API `POST /api/sell`, transaction tout ou rien, idempotente par `nonce` (anti double clic). Historique des mouvements de kamas sur son profil.
- Départ : 100 kamas et 3 paquets. Récompense quotidienne : 50 kamas (+10 par jour de série, plafonné à 7 jours) + 1 paquet
- Enchères : 1 h / 6 h / 24 h / 72 h, surenchère minimale +5 %, kamas réservés à l'enchère et rendus automatiquement au battu, prolongation de 2 min si enchère dans les 2 dernières minutes, clôture par tâche planifiée (15 s)
- Échanges : jusqu'à 6 cartes de chaque côté + kamas, transfert atomique (transaction SQLite)

### Rétention (boucle 2)

Toutes les valeurs sont dans `src/lib/server/game/constants.ts` et `quests.ts`. Les jours changent à **minuit heure de Bruxelles** (`time.ts`), les semaines le lundi.

- **Série de connexion** (calendrier de 7 jours qui recommence, +1 paquet chaque jour) : J1 40 kamas, J2 50 + 20 fragments, J3 60 + Booster Bronze, J4 80 + 40 fragments, J5 100 + Booster Argent, J6 120 + 60 fragments, J7 150 + 100 fragments + Booster Or (600 kamas, 220 fragments et 3 boosters par semaine). Rattrapage doux : un jour manqué est couvert par le joker hebdomadaire, au-delà la série est divisée par deux (jamais remise à zéro).
- **Quêtes du jour** : 3 tirées (de façon stable par joueur et par jour) parmi 10 (ouvrir 3 ou 6 paquets, vendre 5 cartes, recycler 3 cartes, 5 nouvelles cartes, une Rare ou mieux, 6 monstres, terminer ou gagner un duel, placer une enchère), 20 à 80 kamas (+ fragments). **Quêtes de la semaine** : 3, dont toujours « terminer 10 quêtes du jour » (Booster Or), récompenses 100 à 200 kamas + boosters ou fragments. À récupérer à la main avant la fin de la période.
- **Coffre de la semaine** : selon les quêtes récupérées dans la semaine, à ouvrir à partir du lundi suivant. Bronze dès 4 (100 kamas, 40 fragments, Booster Bronze), Argent dès 10 (250, 120, Booster Argent), Or dès 16 (500, 300, Booster Or).
- **Boosters bonus** (jamais achetables) : Bronze = 5e carte Rare ou mieux ; Argent = Super rare ou mieux, chances Rare+ x1,6 ; Or = Ultra rare ou mieux, chances Rare+ x2,2 et une brillante garantie.
- **Cartes brillantes** : 1 carte sur 40 tirée en paquet (et la récompense de chaque collection). Reflet arc-en-ciel et liseré doré, comptées à part dans l'album (filtre « Brillantes »), valent x5 à la vente et au recyclage, et sont toujours vendues en dernier.
- **Fabrication** (fragments) : recycler 1 exemplaire rapporte 5 / 15 / 50 / 150 / 500 / 2 000 fragments selon la rareté ; fabriquer une carte précise coûte 30 / 80 / 250 / 800 / 2 400 / 8 000. En moyenne, un paquet entièrement recyclé donne environ 250 fragments (une Légendaire ciblée = environ 32 paquets recyclés), alors que vendu il rapporte environ 45 kamas : on choisit entre la monnaie d'échange (kamas, enchères) et la complétion (fragments).
- **Collections** : régions (monstres, 5 cartes ou plus), donjons (monstres et boss, 3 ou plus) et panoplies (3 objets ou plus), calculées depuis les données. Récompense à la complétion : `15 x taille + 2 x valeur de vente des cartes` kamas (max 2 000), `10 x taille` fragments, une brillante de la collection, et le titre « Explorateur de… » (région) ou « Vainqueur de… » (donjon) affiché sur le profil.
- **Notifications** : in-app (quête terminée, coffre, collection, duel, échange…) et **Web Push** si le joueur l'active (réserve de paquets pleine, défi, échange, ami, coffre). Clés VAPID créées au premier démarrage dans `DATA_DIR/vapid.json`. Sur iPhone, le push demande d'ajouter le jeu à l'écran d'accueil.

### Social (boucle 3)

- **Vitrines** : jusqu'à 5 vitrines nommées de 6 cartes, une principale (affichée en grand sur le profil, et en aperçu dans le classement, la liste d'amis, la guilde et les duels). Les brillantes y gardent leur effet.
- **Avatar** = une carte de sa collection recadrée en cercle (point focal horizontal / vertical). **Titre** (collections) et **badges** (succès et collections complétées) sur le profil.
- **Profil privé** (visible des amis et des modérateurs), **blocage** (plus de message, d'échange, de défi ni de demande d'ami, l'amitié est retirée) et **signalement** (motif + détails, visible dans `/admin`).
- **Liste de souhaits** (200 cartes) : alerte quand une carte souhaitée est mise aux enchères, affichage des amis qui l'ont en double. **Points de guilde d'entraide** : offrir ou échanger une carte souhaitée par un membre de sa guilde rapporte 100 / 150 / 250 / 400 / 700 / 1 200 points selon la rareté, ajoutés au classement des guildes.
- **Échanges** : contre-proposition (rôles inversés, l'original passe en « contre-proposé ») et cadeau (aucune carte demandée).
- **Enchères** : une mise dans les 10 dernières secondes prolonge la vente de 60 secondes.
- **Fiche carte** : exemplaires en circulation, nombre de souhaits, historique des prix des ventes (courbe, min, max, moyenne), amis qui la possèdent.
- **Duels** : 20 secondes par question (au-delà la réponse compte comme fausse, le chrono survit au rechargement), dégâts animés sur les cartes, revanche en un clic, historique sur le profil.
- **Bataille de groupe** : salon par code de 6 caractères, 3 à 50 joueurs, 3 cartes chacun, jusqu'à 12 questions de 15 s (+4 s de révélation), 10 points par bonne réponse, 20 si moins de la moitié des joueurs l'ont trouvée, 30 si moins de 10 %, pas de points sur sa propre carte. Podium 150 / 100 / 60 kamas, 20 pour les autres. Le déroulé est calculé à partir de l'heure du serveur (sondage toutes les 0,8 s), ce qui rend la reconnexion transparente ; un joueur qui quitte ne bloque pas la partie ; l'hôte qui quitte le salon passe la main.
- **Classement hebdomadaire** : bascule le lundi à minuit heure de Bruxelles, comme les quêtes.

### Duel quiz

Chaque joueur choisit 3 cartes ; PV = somme des DEF. Chacun répond (à son rythme) à 3 questions sur chaque carte adverse, générées automatiquement depuis les données (niveau, zone, famille, donjon gardé, archimonstre de, panoplie, type, monstre qui laisse tomber l'objet, famille de monture, rôle et sorts de classe, questions inversées « lequel de ces monstres vit à… »). Dégâts d'une carte = `ATK x mauvaises réponses / 3`. Vainqueur = meilleur ratio PV restants / PV max. Entraînement contre l'ordinateur (deck de même rareté, 55 % de bonnes réponses).

### Classement hebdomadaire

Points de la semaine (lundi 00:00 UTC) : nouvelle carte obtenue en paquet = 1 / 2 / 5 / 15 / 40 / 100 selon la rareté ; victoire en duel = 50 (10 contre l'ordinateur). Les cartes reçues par échange ou enchère ne rapportent pas de points (anti-collusion). Classement des guildes = somme des membres. Onglet « Collection » = score de collection total.

### Niveau joueur

`niveau = floor(sqrt(XP / 50)) + 1`. XP : paquet 5, nouvelle carte 2, duel gagné 30 / nul 15 / perdu 10, échange 10, vente 10, succès 25.

## Modération

Rôle admin (`/admin`) : bannir / débannir (sessions coupées), masquer un message privé. Filtre d'insultes sur pseudos, noms de guilde et messages (`src/lib/server/moderation.ts`), limite de débit sur les actions sensibles, messages privés réservés aux amis.

## Limites connues

- Limite de débit en mémoire (un seul processus).
- Les montures n'ont pas d'illustration dédiée dans DofusDB : on utilise l'icône de l'objet monture.
