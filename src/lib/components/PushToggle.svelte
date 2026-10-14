<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';

	/** Abonnement aux notifications push (réserve pleine, défis, échanges, coffre). */
	let status = $state<'loading' | 'unsupported' | 'off' | 'on' | 'denied'>('loading');
	let busy = $state(false);

	const b64 = (s: string) => {
		const pad = '='.repeat((4 - (s.length % 4)) % 4);
		const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
		return Uint8Array.from(raw, (c) => c.charCodeAt(0));
	};

	onMount(async () => {
		if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return (status = 'unsupported');
		if (Notification.permission === 'denied') return (status = 'denied');
		const reg = await navigator.serviceWorker.ready.catch(() => null);
		const sub = await reg?.pushManager.getSubscription();
		status = sub ? 'on' : 'off';
	});

	async function enable() {
		busy = true;
		try {
			const perm = await Notification.requestPermission();
			if (perm !== 'granted') return (status = perm === 'denied' ? 'denied' : 'off');
			const { key } = await (await fetch('/api/push')).json();
			if (!key) return (status = 'unsupported');
			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
			await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) });
			status = 'on';
		} catch {
			status = 'off';
		} finally {
			busy = false;
		}
	}
	async function disable() {
		busy = true;
		const reg = await navigator.serviceWorker.ready;
		const sub = await reg.pushManager.getSubscription();
		if (sub) {
			await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
			await sub.unsubscribe();
		}
		status = 'off';
		busy = false;
	}
</script>

{#if status === 'off'}
	<button class="btn btn-plain btn-sm" onclick={enable} disabled={busy} data-testid="push-on"><Icon name="bell" size={16} />Activer les notifications</button>
{:else if status === 'on'}
	<button class="btn btn-plain btn-sm" onclick={disable} disabled={busy}><Icon name="bell" size={16} />Notifications activées (désactiver)</button>
{:else if status === 'denied'}
	<p class="footnote text-label-3">Notifications bloquées dans les réglages du navigateur.</p>
{:else if status === 'unsupported'}
	<p class="footnote text-label-3">Sur iPhone, ajoute le jeu à l'écran d'accueil pour recevoir les notifications.</p>
{/if}
