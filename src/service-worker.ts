/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { self as sw } from '$app/service-worker';
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

const APP = `app-${version}`;
const IMG = 'card-images-v1';
const ASSETS = [...immutable, ...assets].map((f) => '/' + f.path.replace(/^\//, '')).filter((f) => !f.endsWith('.webmanifest'));

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(APP).then((c) => c.addAll(ASSETS)).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== APP && k !== IMG).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== location.origin) return;

	// Fichiers de l'application : cache d'abord
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((r) => r ?? fetch(req)));
		return;
	}
	// Images des cartes : cache d'abord, puis réseau (et mise en cache)
	if (url.pathname.startsWith('/img/')) {
		event.respondWith(
			caches.open(IMG).then(async (cache) => {
				const hit = await cache.match(req);
				if (hit) return hit;
				const res = await fetch(req);
				if (res.ok) cache.put(req, res.clone());
				return res;
			})
		);
	}
	// Pages et données : toujours le réseau (contenu propre à chaque joueur)
});

// Clic sur une notification : ouvrir le jeu
sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(
		sw.clients.matchAll({ type: 'window' }).then((list) => {
			const url = (event.notification.data as { url?: string } | null)?.url ?? '/';
			const open = list.find((c) => 'focus' in c) as WindowClient | undefined;
			if (open) return open.navigate(url).then((c) => c?.focus());
			return sw.clients.openWindow(url);
		})
	);
});

// Notifications push envoyées par le serveur
sw.addEventListener('push', (event) => {
	let data: { title?: string; body?: string; url?: string } = {};
	try {
		data = event.data?.json() ?? {};
	} catch {
		data = { body: event.data?.text() };
	}
	event.waitUntil(
		sw.registration.showNotification(data.title ?? 'Dofus Cards', {
			body: data.body ?? '',
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-192.png',
			data: { url: data.url ?? '/' }
		})
	);
});
