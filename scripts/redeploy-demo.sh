#!/usr/bin/env bash
# Redéploiement sans coupure de la démo sur coolify-vps (conteneur autonome + labels Traefik).
# 1) construit la nouvelle image AVANT de toucher au conteneur en place,
# 2) démarre le nouveau conteneur à côté (même routeur Traefik => les deux servent),
# 3) attend qu'il soit sain, puis retire l'ancien. La base (/opt/hn-staging/data/dofus-cards) n'est jamais touchée.
set -euo pipefail
cd "$(dirname "$0")/.."
TAG="dofus-cards:$(git rev-parse --short HEAD)"
DATA=/opt/hn-staging/data/dofus-cards
DOMAIN=dofus-cards.hungrynuggets.be

docker build -q -t "$TAG" -t dofus-cards:latest .
OLD=$(docker ps --format '{{.Names}}' | grep -E '^dofus-cards(-[0-9]+)?$' || true)
NEW="dofus-cards-$(date +%s)"
docker run -d --name "$NEW" --restart unless-stopped --network coolify \
	-v "$DATA:/data" \
	-e ORIGIN="https://$DOMAIN" -e DATA_DIR=/data -e ADDRESS_HEADER=cf-connecting-ip -e TZ=Europe/Brussels \
	-l traefik.enable=true \
	-l "traefik.http.routers.dofus-cards.rule=Host(\`$DOMAIN\`)" \
	-l traefik.http.routers.dofus-cards.entrypoints=http \
	-l traefik.http.services.dofus-cards.loadbalancer.server.port=3000 \
	"$TAG" >/dev/null
echo "Attente du nouveau conteneur $NEW…"
for i in $(seq 1 60); do
	[ "$(docker inspect -f '{{.State.Health.Status}}' "$NEW")" = healthy ] && break
	sleep 5
done
[ "$(docker inspect -f '{{.State.Health.Status}}' "$NEW")" = healthy ] || { echo "Nouveau conteneur pas sain, l'ancien reste en place"; docker rm -f "$NEW"; exit 1; }
sleep 10 # laisse Traefik enregistrer le nouveau serveur
# SIGTERM d'abord : les requêtes en cours se terminent avant le retrait
for c in $OLD; do docker stop -t 15 "$c" >/dev/null; docker rm "$c" >/dev/null && echo "Ancien conteneur $c retiré"; done
echo "Déployé : $TAG ($NEW)"
