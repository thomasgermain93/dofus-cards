#!/bin/sh
set -e
# Premier démarrage : import du dataset DofusDB (cartes + images) dans le volume.
if [ ! -f "$DATA_DIR/game.db" ] || [ "$(node -e "const D=require('better-sqlite3');try{const d=new D(process.env.DATA_DIR+'/game.db');console.log(d.prepare('select count(*) n from cards').get().n)}catch{console.log(0)}")" = "0" ]; then
	echo "Base vide : import DofusDB..."
	node scripts/import-dofusdb.ts
fi
# Images WebP (ne convertit que les manquantes)
node scripts/images-webp.ts || true
exec "$@"
