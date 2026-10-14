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
	--health-cmd "test ! -f /tmp/draining && node -e \"fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"" \
	--health-interval 5s --health-timeout 4s --health-retries 2 --health-start-period 300s \
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
for c in $OLD; do
	# Vidange : l'ancien conteneur se déclare malade, Traefik ne lui envoie plus rien, puis arrêt propre (SIGTERM)
	if docker inspect -f '{{json .Config.Healthcheck}}' "$c" | grep -q draining; then
		docker exec "$c" touch /tmp/draining
		for i in $(seq 1 20); do [ "$(docker inspect -f '{{.State.Health.Status}}' "$c")" = unhealthy ] && break; sleep 1; done
		sleep 3
	fi
	docker stop -t 15 "$c" >/dev/null
	docker rm "$c" >/dev/null && echo "Ancien conteneur $c retiré"
done
echo "Déployé : $TAG ($NEW)"
