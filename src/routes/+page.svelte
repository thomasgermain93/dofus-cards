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
	import StreakCalendar from '#lib/components/StreakCalendar.svelte';
	import QuestList from '#lib/components/QuestList.svelte';
	import ChestCard from '#lib/components/ChestCard.svelte';
	import PushToggle from '#lib/components/PushToggle.svelte';
	import { duration } from '#lib/format';
	import type { CardView } from '#lib/types';
	import type { retentionSummary } from '#lib/server/queries';
	type RetentionSummary = ReturnType<typeof retentionSummary>;

	let { data, form } = $props();
	const me = $derived(data.me);

	let opened = $state<{ card: CardView; isNew: boolean; shiny?: boolean }[] | null>(null);
	let openedSource = $state<string>('free');
	let opening = $state(false);
	let error = $state<string | null>(null);
	let notifPermission = $state<string>('default');

	onMount(() => {
		if ('Notification' in window) notifPermission = Notification.permission;
	});

	type Todo = { key: string; icon: string; text: string; action?: string; href?: string };
	const R = $derived((data as { retention?: RetentionSummary }).retention ?? null);
	const BOOSTER_KINDS = ['welcome', 'bronze', 'silver', 'gold'] as const;
	const boosterTotal = $derived(R ? R.boosters.bronze + R.boosters.silver + R.boosters.gold + R.boosters.welcome : 0);
	const starter = $derived(R ? R.quests.filter((q) => q.period === 'starter' && !q.claimed_at) : []);
	const ev = $derived(page.data.event as { name: string; description: string; end: number } | null);
	const dailyQuests = $derived(R ? R.quests.filter((q) => q.period === 'day') : []);
	const todo: Todo[] = $derived(
		R
			? ([
					R.boosters.welcome ? { key: 'welcome', icon: 'gift', text: 'Ouvre ton booster de bienvenue', action: 'welcome' } : null,
					me && me.packs > 0 ? { key: 'packs', icon: 'package', text: `${me.packs} paquet${me.packs > 1 ? 's' : ''} prêt${me.packs > 1 ? 's' : ''}`, action: 'open' } : null,
					boosterTotal ? { key: 'boosters', icon: 'sparkles', text: `${boosterTotal} booster${boosterTotal > 1 ? 's' : ''} bonus à ouvrir`, href: '#boosters' } : null,
					R.daily.available ? { key: 'daily', icon: 'gift', text: `Récompense du jour ${R.daily.todayIndex} / 7`, href: '#streak' } : null,
					R.questsToClaim ? { key: 'quests', icon: 'check', text: `${R.questsToClaim} quête${R.questsToClaim > 1 ? 's' : ''} à récupérer`, href: '/quests' } : null,
					R.chest.previous.tier && !R.chest.previous.claimed ? { key: 'chest', icon: 'gift', text: `${R.chest.previous.tier.name} à ouvrir`, href: '#chest' } : null,
					R.collectionsToClaim ? { key: 'collections', icon: 'album', text: `${R.collectionsToClaim} collection${R.collectionsToClaim > 1 ? 's' : ''} complète${R.collectionsToClaim > 1 ? 's' : ''} à récupérer`, href: '/collections' } : null,
					me?.duelsToPlay ? { key: 'duels', icon: 'swords', text: `${me.duelsToPlay} duel${me.duelsToPlay > 1 ? 's' : ''} t'attend${me.duelsToPlay > 1 ? 'ent' : ''}`, href: '/duels' } : null
				] as (Todo | null)[]).filter((x): x is Todo => !!x)
			: []
	);

	async function openPack(source: string = 'free') {
		if (opening) return;
		opening = true;
		error = null;
		openedSource = source;
		const body = new FormData();
		body.set('source', source);
		const res = await fetch('/?/open', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
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

	{#if R}
	<!-- Ce que tu peux faire maintenant -->
	<section class="now group mb-4" data-testid="now">
		<h2 class="headline px-4 pt-4 pb-1">Maintenant</h2>
		{#each todo as t (t.key)}
			{#if t.action === 'welcome'}
				<button class="cell w-full text-left bg-transparent border-0 cursor-pointer" onclick={() => openPack('welcome')} disabled={opening} data-testid="open-welcome-now">
					<span class="dot-ic"><Icon name={t.icon} size={18} /></span><span class="flex-1 font-semibold">{t.text}</span><span class="btn btn-sm">Ouvrir</span>
				</button>
			{:else if t.action === 'open'}
				<button class="cell w-full text-left bg-transparent border-0 cursor-pointer" onclick={() => openPack()} disabled={opening}>
					<span class="dot-ic"><Icon name={t.icon} size={18} /></span><span class="flex-1 font-semibold">{t.text}</span><span class="btn btn-sm">Ouvrir</span>
				</button>
			{:else}
				<a class="cell text-inherit no-underline" href={t.href}>
					<span class="dot-ic"><Icon name={t.icon} size={18} /></span><span class="flex-1 font-semibold">{t.text}</span><Icon name="chevron-right" size={16} class="text-label-3" />
				</a>
			{/if}
		{:else}
			<p class="cell text-label-2">Tout est fait pour l'instant, bravo !</p>
		{/each}
		<p class="footnote text-label-3 px-4 pb-3 pt-1">
			{#if me.nextPackAt}Prochain paquet dans <Countdown target={me.nextPackAt} serverNow={me.serverNow} ondone={packReady} />.{/if}
			Nouvelles quêtes dans {duration(R.nextMidnight - R.now)}.
		</p>
	</section>

	{#if ev}
		<a class="event frame mb-4" href="#paquets" data-testid="event">
			<span class="ribbon ev-title">{ev.name}</span>
			<span class="ev-body">
				<span class="ev-ic"><Icon name="sparkles" size={22} fill /></span>
				<span class="flex-1 min-w-0">
					<span class="block">{ev.description}</span>
					<span class="block footnote ev-left">Encore {duration(ev.end - R.now)}</span>
				</span>
			</span>
		</a>
	{/if}

	{#if starter.length}
		<section class="mb-4" data-testid="starter">
			<h2 class="section-label">Objectifs de bienvenue (3 premiers jours)</h2>
			<QuestList quests={starter} />
		</section>
	{/if}

	<div class="dash">
		<!-- Paquets -->
		<section class="pack-card frame" id="paquets">
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
							<Icon name="clock" size={14} /> Prochain dans <Countdown target={me.nextPackAt} serverNow={me.serverNow} />
						</p>
					{:else}
						<p class="footnote text-warning">Réserve pleine : ouvre un paquet pour relancer la minuterie.</p>
					{/if}
					<p class="footnote text-label-3 mt-1">Un paquet gratuit toutes les 10 minutes.</p>
				</div>
			</div>
			<button class="btn btn-block" onclick={() => openPack()} disabled={me.packs === 0 || opening} data-testid="open-pack">
				<Icon name="package" size={18} />{opening ? 'Ouverture…' : me.packs === 0 ? 'Aucun paquet pour le moment' : 'Ouvrir un paquet'}
			</button>
			{#if boosterTotal}
				<div id="boosters" class="boosters">
					{#each BOOSTER_KINDS as k (k)}
						{#if R.boosters[k]}
							<button class="booster b-{k}" onclick={() => openPack(k)} disabled={opening} data-testid="open-{k}">
								<span class="bname">{R.boosterNames[k]}</span><span class="bqty">x{R.boosters[k]}</span>
							</button>
						{/if}
					{/each}
				</div>
				<p class="footnote text-label-3">Bronze : dernière carte Rare ou mieux. Argent : Super rare ou mieux. Or : Ultra rare ou mieux et une brillante garantie.</p>
			{/if}
			{#if error}<p class="alert alert-error">{error}</p>{/if}
			<div class="self-center"><PushToggle /></div>
		</section>

		<div id="streak"><StreakCalendar daily={R.daily} /></div>

		<section>
			<div class="flex items-center justify-between">
				<h2 class="section-label">Quêtes du jour</h2>
				<a class="btn btn-plain btn-sm" href="/quests">Toutes les quêtes</a>
			</div>
			<QuestList quests={dailyQuests} />
		</section>

		<div id="chest"><ChestCard chest={R.chest} nextMonday={R.nextMonday} now={R.now} /></div>

		<!-- Collection -->
		<a href="/album" class="group p-4 block no-underline text-inherit">
			<div class="flex items-center justify-between mb-2">
				<h2 class="headline">Collection</h2>
				<Icon name="chevron-right" size={18} class="text-label-3" />
			</div>
			<p class="text-label-2 footnote mb-2">{fmt(data.owned ?? 0)} / {fmt(data.total ?? 0)} cartes différentes, {data.shinies ?? 0} brillante{(data.shinies ?? 0) > 1 ? 's' : ''}, {fmt(R.fragments)} fragments</p>
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
			<a class="cell no-underline text-inherit" href="/collections"><Icon name="album" class="text-accent" /><span class="flex-1">Collections par région, donjon et panoplie</span><Icon name="chevron-right" size={16} class="text-label-3" /></a>
			<a class="cell no-underline text-inherit" href="/leaderboard"><Icon name="trophy" class="text-accent" /><span class="flex-1">Classement de la semaine</span><Icon name="chevron-right" size={16} class="text-label-3" /></a>
			<a class="cell no-underline text-inherit" href="/achievements"><Icon name="award" class="text-accent" /><span class="flex-1">Succès</span><Icon name="chevron-right" size={16} class="text-label-3" /></a>
			<a class="cell no-underline text-inherit" href="/duels/new?vs=bot"><Icon name="bot" class="text-accent" /><span class="flex-1">Entraînement contre l'ordinateur</span><Icon name="chevron-right" size={16} class="text-label-3" /></a>
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
			source={openedSource}
		/>
	{/if}
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
		background: linear-gradient(180deg, #e8565f, #b52a33);
		border: 2px solid var(--gold-deep);
		color: #fff;
		font-weight: 800;
		display: grid;
		place-items: center;
		box-shadow: 0 0 0 1px var(--panel-edge), 0 2px 0 rgba(0, 0, 0, 0.35);
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
		border-radius: var(--radius-md);
		display: grid;
		place-items: center;
		background: var(--emblem-red);
		border: 1.5px solid var(--emblem-edge);
		box-shadow: var(--emblem-shadow);
		color: var(--emblem-ink);
		flex: none;
	}
	.progress {
		height: 8px;
		border-radius: 999px;
		background: var(--slot);
		box-shadow: var(--slot-inset);
		overflow: hidden;
	}
	.progress span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--gauge-fill);
	}
	.mini-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	/* Événement : cadre orné coiffé d'un ruban doré */
	.event {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-4) var(--space-4);
		margin-top: 14px;
		color: var(--label);
		text-decoration: none;
	}
	.ev-title {
		margin-top: -14px;
	}
	.ev-body {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
	}
	.ev-left {
		color: var(--accent);
		font-weight: 700;
		margin-top: 2px;
	}
	.ev-ic {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-md);
		display: grid;
		place-items: center;
		background: var(--emblem-gold);
		border: 1.5px solid var(--emblem-edge);
		box-shadow: var(--emblem-shadow);
		color: var(--on-gold);
		flex: none;
	}
	.dot-ic {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-md);
		display: grid;
		place-items: center;
		background: var(--slot);
		border: 1px solid var(--slot-edge);
		box-shadow: var(--slot-inset);
		color: var(--accent);
		flex: none;
	}
	.boosters {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	/* Boosters : plaques de métal frappé (bronze, argent, or) */
	.booster {
		flex: 1;
		min-width: 96px;
		min-height: var(--tap);
		border: 1px solid var(--panel-edge);
		border-radius: var(--radius-md);
		padding: 8px 10px 8px 14px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		font-weight: 800;
		color: #24180a;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
		cursor: pointer;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.5),
			0 3px 0 var(--panel-edge);
		margin-bottom: 3px;
		transition: transform 90ms ease-out, box-shadow 90ms ease-out;
	}
	.booster:active {
		transform: translateY(2px);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 0 var(--panel-edge);
	}
	.b-bronze {
		background: var(--pack-bronze);
		color: #fff3e2;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
	}
	.b-silver {
		background: var(--pack-silver);
	}
	.b-welcome {
		background: var(--pack-welcome);
		color: #fffbea;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
	}
	.b-gold {
		background: var(--pack-gold);
	}
	.bqty {
		background: rgba(20, 12, 4, 0.55);
		color: #fbefcf;
		text-shadow: none;
		border-radius: var(--radius-sm);
		padding: 1px 7px;
		font-size: 14px;
	}
	.unread {
		width: 9px;
		height: 9px;
		transform: rotate(45deg);
		border-radius: 2px;
		background: var(--gold);
		box-shadow: 0 0 0 1px var(--panel-edge);
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
