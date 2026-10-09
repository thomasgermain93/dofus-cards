# Direction artistique : « l'établi de l'aventurier »

L'interface doit donner l'impression d'ouvrir un sac d'aventurier sur une table de taverne d'Astrub, pas une app de réglages iOS. Références regardées : l'interface de combat de Dofus 3 (Unity), la carte « Le Monde des Douze » (parchemin déchiré, ruban doré), les cartes du jeu de cartes Dofus de 2005 (`docs/references/tcg-dofus-2005.jpg`) et une capture de gameplay de Capitemflam.

Aucun asset Ankama n'est réutilisé : pas de logo, pas de capture découpée, pas d'élément d'interface extrait. Cadres, boutons, textures et emblèmes sont dessinés en CSS et en SVG. Les illustrations des cartes (DofusDB) restent les seules images du jeu.

## Ce qu'on retient du jeu

| Observé dans Dofus 3 | Valeur mesurée | Traduction ici |
|---|---|---|
| Panneaux de la barre de sorts et du chat | `#242422`, `#2a2a27` (anthracite chaud, translucide) | Fond « bois sombre » `#1c1712`, panneaux `#28211a` |
| Cases vides de la barre de sorts | `#34322a`, coins arrondis 4 px, ombre interne | Cases de la barre d'onglets, emplacements de vitrine |
| Bouton « Fin de tour » | haut `#8fb637`, bas `#8cb437`, contour `#597721`, texte sombre en capitales | Bouton principal vert Dofus en relief, état pressé qui s'enfonce |
| Chrono et jauge de tour | `#f0d255`, `#f5d355` | Or des titres, des kamas et de l'onglet actif |
| Cœur des points de vie | `#ed5e66` | Rouge de danger et cœur de la carte |
| Carte du Monde des Douze | parchemin `#e6c166` / `#e0ab4d`, cadre `#4a4130`, ruban `#e5bd41` | Mode clair « parchemin », ruban doré des grands moments |

## Palette

Mode sombre par défaut (ambiance bois sombre, comme le jeu) :

| Rôle | Valeur |
|---|---|
| Fond | `#1c1712` + grain de bois en SVG à 5 % |
| Panneau | `#28211a`, bord `#0e0b08`, liseré haut `rgba(240, 210, 85, .14)` |
| Case | `#352c22`, ombre interne |
| Texte | `#f1e6cc` (parchemin), secondaire `#c8b48e`, tertiaire `#a8956f` |
| Or | `#f0d255` (titres, kamas, onglet actif) |
| Vert Dofus | `#8fb637` (bouton principal), contour `#4f6a1c`, texte `#1b2606` |
| Rouge cœur | `#ed5e66` |

Mode clair « parchemin » (pas le crème générique) : fond `#e6d3a3` grainé, panneaux `#f4e7c5`, bords `#7a5c34`, encre `#2b1e10`, or assombri `#7d5300` pour rester lisible, même vert Dofus pour les boutons.

Contrastes AA vérifiés par l'audit axe (`tests/e2e/ui-audit.mjs`) dans les deux modes.

## Typographies

- **Grenze** (SIL OFL), 600 et 700 : titres de page, noms de sections, ruban. Un serif trapu à l'esprit médiéval, proche des titres et des étiquettes de carte du jeu. Jamais en texte courant.
- **Alegreya Sans** (SIL OFL), 400 à 800 : tout le texte, les boutons et les chiffres (`tabular-nums` pour les compteurs). Humaniste, chaleureuse, très lisible petite.
- Les deux sont auto-hébergées (`static/fonts/`), préchargées, `font-display: swap`.

## Cadres et matières

- **Panneau** (`.panel`, `.group`) : bois sombre, bordure sombre de 2 px, liseré doré interne en haut, ombre portée teintée brun. Rayon 6 px (les fenêtres du jeu sont peu arrondies).
- **Cadre orné** (`.ornate`) : panneau + quatre coins en laiton dessinés en SVG. Réservé aux blocs qui comptent (paquets, vitrine, événement).
- **Ruban** (`.ribbon`) : bandeau doré aux extrémités fendues, pour l'événement, la montée de niveau et le tutoriel.
- **Séparateurs gravés** : un trait sombre et un trait clair superposés, comme une rainure dans le bois.
- **Case** (`.slot`) : emplacement creusé, utilisé par la barre d'onglets et les icônes de liste.

## Boutons

- Principal : vert Dofus, relief (ombre basse pleine de 3 px), texte sombre gras ; pressé, il descend de 2 px et l'ombre disparaît.
- Secondaire : bois clair sur bois sombre, texte parchemin, même relief.
- Discret : texte or, souligné au survol.
- Danger : rouge cœur assombri, même relief.

## Icônes

Une seule famille : traits Lucide (ISC), trait de 2 px, extrémités rondes, déjà utilisée partout. Dans la barre d'onglets et les listes, l'icône est posée dans une case creusée, comme les sorts du jeu.

## Mouvements

Courts (150 à 300 ms), avec un léger rebond sur ce qui répond à un geste (bouton qui s'enfonce, onglet qui s'allume). Un seul grand moment par écran : l'ouverture de paquet. `prefers-reduced-motion` coupe tout.

## Signes « IA » supprimés

- Dégradés indigo / violet / rose (paquet gratuit, dos de carte, titres, scène d'ouverture).
- Bleu système iOS comme accent, boutons en pilule partout.
- Verre dépoli (`backdrop-filter`) sur les barres.
- Cartes blanches arrondies identiques avec la même ombre grise floue.
- Grands titres noirs « Apple » en SF Pro.
- Pastilles colorées décoratives sur chaque ligne de filtre.
- Avatars en dégradé turquoise.
- Libellés en capitales espacées au-dessus de chaque section (remplacés par des titres Grenze en casse normale).
