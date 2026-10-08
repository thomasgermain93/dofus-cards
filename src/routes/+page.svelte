<script lang="ts">
	import { enhance, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { GAME_NAME, GAME_TAGLINE } from '#lib/config';
	import { ago, fmt } from '#lib/format';
	import Card from '#lib/components/Card.svelte';
	import PackArt from '#lib/components/PackArt.svelte';
	import PackOpening from '#lib/components/PackOpening.svelte';
	import Countdown from '#lib/components/Countdown.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import type { CardView } from '#lib/types';

	let { data, form } = $props();
	const me = $derived(data.me);

	let opened = $state<{ card: CardView; isNew: boolean }[] | null>(null);
	let opening = $state(false);
	let error = $state<string | null>(null);
	let notifPermission = $state<string>('default');

	onMount(() => {
		if ('Notification' in window) notifPermission = Notification.permission;
	});

	async function openPack() {
		if (opening) return;
		opening = true;
		error = null;
		const res = await fetch('?/open', { method: 'POST', body: new FormData(), headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await res.text());
		opening = false;
		if (result.type === 'success' && result.data?.opened) {
			opened = result.data.opened as typeof opened;
			invalidateAll();
		} else if (result.type === 'failure') {
			error = (result.data?.error as string) ?? 'Erreur inattendue.';
		}
	}

	async function enableNotifications() {
		if (!('Notification' in window)) return;
		notifPermission = await Notification.requestPermission();
	}

	async function packReady() {
		await invalidateAll();
		if (notifPermission === 'granted' && document.visibilityState !== 'visible') {
			const reg = await navigator.serviceWorker?.getRegistration();
			const opts = { body: 'Un nouveau paquet t’attend !', icon: '/icons/icon-192.png', tag: 'pack' };
			if (reg) reg.showNotification(GAME_NAME, opts);
			else new Notification(GAME_NAME, opts);
		}
	}
</script>

<svelte:head><title>{GAME_NAME}</title></svelte:head>

{#if !me}
	<!-- Accueil public -->
	<section class="landing">
		<Logo size={64} text={false} />
		<h1 class="large-title">{GAME_NAME}</h1>
		<p class="text-label-2 text-lg max-w-md">{GAME_TAGLINE}</p>
		<div class="showcase">
			{#each data.showcase ?? [] as c, i (c.id)}
				<div class="sc" style="--i:{i}"><Card card={c} size="md" /></div>
			{/each}
		</div>
		<div class="flex flex-col gap-3 w-full max-w-xs">
			<a class="btn btn-block" href="/register">Commencer à jouer</a>
			<a class="btn btn-secondary btn-block" href="/login">J'ai déjà un compte</a>
		</div>
		<ul class="features">
			<li><Icon name="package" /> Un paquet gratuit toutes les 10 minutes</li>
			<li><Icon name="album" /> {fmt(data.total ?? 0)} cartes : monstres, objets, montures, classes</li>
			<li><Icon name="swords" /> Duels quiz contre tes amis</li>
			<li><Icon name="gavel" /> Enchères et échanges en kamas, jamais en euros</li>
		</ul>
	</section>
{:else}
	{#if page.url.searchParams.get('welcome')}
		<p class="alert alert-ok mb-4">Bienvenue {me.username} ! Tes 3 premiers paquets t'attendent.</p>
	{/if}
	<h1 class="large-title mb-4">Bonjour, {me.username}</h1>

	<div class="dash">
		<!-- Paquets -->
		<section class="pack-card group">
			<div class="pack-row">
				<div class="pack-visual">
					<PackArt width={104} />
					{#if me.packs > 0}<span class="stock">{me.packs}</span>{/if}
				</div>
				<div class="pack-info">
					<h2 class="title-2">Paquets</h2>
					<p class="text-label-2">{me.packs} / 10 en réserve</p>
					{#if me.nextPackAt}
						<p class="footnote text-label-2 flex items-center gap-1 flex-wrap">
							<Icon name="clock" size={14} /> Prochain dans <Countdown target={me.nextPackAt} serverNow={me.serverNow} ondone={packReady} />
						</p>
					{:else}
						<p class="footnote text-warning">Réserve pleine : ouvre un paquet pour relancer la minuterie.</p>
					{/if}
					<p class="footnote text-label-3 mt-1">Un paquet gratuit toutes les 10 minutes.</p>
				</div>
			</div>
			<button class="btn btn-block" onclick={openPack} disabled={me.packs === 0 || opening} data-testid="open-pack">
				<Icon name="package" size={18} />{opening ? 'Ouverture…' : me.packs === 0 ? 'Aucun paquet pour le moment' : 'Ouvrir un paquet'}
			</button>
			{#if error}<p class="alert alert-error">{error}</p>{/if}
			{#if notifPermission === 'default'}
				<button class="btn btn-plain btn-sm self-center" onclick={enableNotifications}><Icon name="bell" size={16} />Me prévenir quand un paquet est prêt</button>
			{/if}
		</section>

		<!-- Récompense quotidienne -->
		<section class="group p-4 flex items-center gap-4">
			<div class="daily-icon"><Icon name="gift" size={26} /></div>
			<div class="flex-1 min-w-0">
				<h2 class="headline">Récompense du jour</h2>
				<p class="footnote text-label-2">
					{data.dailyAvailable ? `${data.dailyBase} kamas et 1 paquet` : 'Déjà récupérée, reviens demain'}{data.dailyStreak ? `, série de ${data.dailyStreak} jour${data.dailyStreak > 1 ? 's' : ''}` : ''}
				</p>
				{#if form?.daily}<p class="footnote text-success">+{form.daily.kamas} kamas et +1 paquet !</p>{/if}
			</div>
			{#if data.dailyAvailable}
				<form method="POST" action="?/daily" use:enhance>
					<button class="btn btn-sm">Récupérer</button>
				</form>
			{/if}
		</section>

		<!-- Collection -->
		<a href="/album" class="group p-4 block no-underline text-inherit">
			<div class="flex items-center justify-between mb-2">
				<h2 class="headline">Collection</h2>
				<Icon name="chevron-right" size={18} class="text-label-3" />
			</div>
			<p class="text-label-2 footnote mb-2">{fmt(data.owned ?? 0)} / {fmt(data.total ?? 0)} cartes différentes</p>
			<div class="progress"><span style="width: {Math.max(1, ((data.owned ?? 0) / (data.total || 1)) * 100)}%"></span></div>
			{#if data.lastCards?.length}
				<div class="mini-grid mt-3">
					{#each data.lastCards as c (c.id)}<Card card={c} size="sm" />{/each}
				</div>
			{/if}
		</a>

		<!-- Notifications -->
		<section>
			<div class="flex items-center justify-between">
				<h2 class="section-label">Activité</h2>
				{#if me.unreadNotifs}
					<form method="POST" action="?/readNotifs" use:enhance><button class="btn btn-plain btn-sm">Tout marquer comme lu</button></form>
				{/if}
			</div>
			<div class="group">
				{#each data.notifications ?? [] as n (n.id)}
					<a class="cell no-underline text-inherit" href={n.link ?? '/notifications'}>
						{#if !n.read_at}<span class="unread"></span>{/if}
						<span class="flex-1 min-w-0">
							<span class="block">{n.body}</span>
							<span class="footnote text-label-2">{ago(n.created_at)}</span>
						</span>
						<Icon name="chevron-right" size={16} class="text-label-3" />
					</a>
				{:else}
					<p class="cell text-label-2">Rien de neuf pour l'instant. Ouvre un paquet !</p>
				{/each}
			</div>
		</section>

		<!-- Raccourcis -->
		<section class="group">
			<a class="cell no-underline text-inherit" href="/leaderboard"><Icon name="trophy" class="text-warning" /><span class="flex-1">Classement de la semaine</span><Icon name="chevron-right" size={16} class="text-label-3" /></a>
			<a class="cell no-underline text-inherit" href="/achievements"><Icon name="award" class="text-accent" /><span class="flex-1">Succès</span><Icon name="chevron-right" size={16} class="text-label-3" /></a>
			<a class="cell no-underline text-inherit" href="/duels/new?vs=bot"><Icon name="bot" class="text-success" /><span class="flex-1">Entraînement contre l'ordinateur</span><Icon name="chevron-right" size={16} class="text-label-3" /></a>
		</section>
	</div>

	{#if opened}
		<PackOpening
			cards={opened}
			packsLeft={me.packs}
			onclose={() => (opened = null)}
			onagain={() => {
				opened = null;
				openPack();
			}}
		/>
	{/if}
{/if}

<style>
	.landing {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 16px;
		padding: 40px 0 0;
	}
	.showcase {
		display: flex;
		justify-content: center;
		margin: 16px 0 8px;
		height: 230px;
	}
	.sc {
		width: 150px;
		margin: 0 -18px;
		transform: rotate(calc((var(--i) - 1) * 9deg)) translateY(calc(abs(var(--i) - 1) * 14px));
		transition: transform var(--dur) var(--ease-ios);
	}
	.sc:nth-child(2) {
		z-index: 1;
	}
	.features {
		list-style: none;
		padding: 0;
		margin: 16px 0 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		text-align: left;
		color: var(--label-2);
	}
	.features li {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.dash {
		display: grid;
		gap: 16px;
	}
	@media (min-width: 900px) {
		.dash {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
		.pack-card {
			grid-row: span 2;
		}
	}
	.pack-card {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 20px;
	}
	.pack-row {
		display: flex;
		gap: 20px;
		align-items: center;
	}
	.pack-visual {
		position: relative;
		flex: none;
		animation: bob 3s ease-in-out infinite;
	}
	.stock {
		position: absolute;
		top: -8px;
		right: -8px;
		min-width: 30px;
		height: 30px;
		border-radius: 999px;
		background: var(--danger);
		color: white;
		font-weight: 800;
		display: grid;
		place-items: center;
		box-shadow: 0 0 0 3px var(--surface);
	}
	.pack-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 2px;
	}
	.daily-icon {
		width: 48px;
		height: 48px;
		border-radius: 14px;
		display: grid;
		place-items: center;
		color: white;
		background: linear-gradient(135deg, #ff9f0a, #ff375f);
		flex: none;
	}
	.progress {
		height: 8px;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}
	.progress span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, var(--accent), #5e5ce6);
	}
	.mini-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.unread {
		width: 9px;
		height: 9px;
		border-radius: 999px;
		background: var(--accent);
		flex: none;
	}
	.no-underline {
		text-decoration: none;
	}
	.text-inherit {
		color: inherit;
	}
	@keyframes bob {
		50% {
			transform: translateY(-5px) rotate(-1.5deg);
		}
	}
</style>
