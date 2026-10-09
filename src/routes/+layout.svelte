<script lang="ts">
	import './layout.css';
	import { page, navigating } from '$app/state';
	import { onMount } from 'svelte';
	import { initHolo } from '#lib/holo';
	import { GAME_NAME } from '#lib/config';
	import Icon from '#lib/components/Icon.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import Toaster from '#lib/components/Toaster.svelte';
	import LevelUp from '#lib/components/LevelUp.svelte';
	import Coach from '#lib/components/Coach.svelte';
	import HuntSpark from '#lib/components/HuntSpark.svelte';
	import { toast } from '#lib/toast.svelte';
	import { onNavigate } from '$app/navigation';
	import KamasCounter from '#lib/components/KamasCounter.svelte';
	import Disclaimer from '#lib/components/Disclaimer.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
	onMount(initHolo);
	let offline = $state(false);
	onMount(() => {
		offline = !navigator.onLine;
		const on = () => (offline = false);
		const off = () => (offline = true);
		addEventListener('online', on);
		addEventListener('offline', off);
		if (!data.me) navigator.serviceWorker?.controller?.postMessage('clear-pages');
		return () => {
			removeEventListener('online', on);
			removeEventListener('offline', off);
		};
	});

	// Transitions de page façon iOS (View Transitions API si disponible)
	onNavigate((nav) => {
		if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		if (nav.from?.url.pathname === nav.to?.url.pathname) return;
		// Uniquement pour les liens et le bouton retour (pas après un formulaire : on veut le résultat tout de suite)
		if (nav.type !== 'link' && nav.type !== 'popstate') return;
		const back = nav.type === 'popstate' && ((nav as { delta?: number }).delta ?? -1) < 0;
		document.documentElement.dataset.nav = back ? 'back' : 'forward';
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await nav.complete;
			});
		});
	});

	// Toasts pour les nouveautés (succès, quêtes, collections...) et célébration des niveaux
	let levelUp = $state<number | null>(null);
	const read = (k: string) => {
		try {
			return Number(localStorage.getItem(k) ?? 0);
		} catch {
			return 0;
		}
	};
	const write = (k: string, v: number) => {
		try {
			localStorage.setItem(k, String(v));
		} catch {
			/* ignore */
		}
	};
	const ICONS: Record<string, string> = { achievement: 'award', quest: 'check', collection: 'album', chest: 'gift', wish: 'star', battle: 'users', trade: 'repeat', duel: 'swords' };
	$effect(() => {
		if (!me) return;
		const seenKey = `dc-seen-${me.id}`;
		const seen = read(seenKey);
		if (seen) for (const n of [...(data.recent ?? [])].reverse()) if (n.id > seen) toast(n.body, n.kind === 'achievement' || n.kind === 'chest' ? 'reward' : 'info', ICONS[n.kind]);
		write(seenKey, Math.max(seen, me.lastNotifId));
		const lvlKey = `dc-level-${me.id}`;
		const prev = read(lvlKey);
		if (prev && me.level > prev) levelUp = me.level;
		write(lvlKey, me.level);
	});
	// Tutoriel : l'étape « album » est validée en visitant l'album
	$effect(() => {
		if (data.onboarding?.steps.some((s) => s.key === 'album' && !s.done) && page.url.pathname === '/album')
			fetch('/api/onboarding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'album' }) });
	});
	const me = $derived(data.me);

	const tabs = $derived([
		{ href: '/', label: 'Accueil', icon: 'home', badge: me?.homeTodo ?? 0 },
		{ href: '/album', label: 'Album', icon: 'album', badge: 0 },
		{ href: '/market', label: 'Marché', icon: 'gavel', badge: me?.tradesPending ?? 0 },
		{ href: '/duels', label: 'Jouer', icon: 'swords', badge: me?.duelsToPlay ?? 0 },
		{ href: '/social', label: 'Social', icon: 'users', badge: (me?.unreadMessages ?? 0) + (me?.friendRequests ?? 0) }
	]);
	const extra = $derived([
		{ href: '/quests', label: 'Quêtes', icon: 'check' },
		{ href: '/battle', label: 'Bataille de groupe', icon: 'users' },
		{ href: '/wishlist', label: 'Souhaits', icon: 'star' },
		{ href: '/collections', label: 'Collections', icon: 'album' },
		{ href: '/leaderboard', label: 'Classement', icon: 'trophy' },
		{ href: '/achievements', label: 'Succès', icon: 'award' },
		...(me?.role === 'admin' ? [{ href: '/admin', label: 'Modération', icon: 'shield' }] : [])
	]);

	// Squelette pendant les navigations lentes (> 300 ms) : pas de spinner
	let slow = $state(false);
	let slowTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const to = navigating.to;
		clearTimeout(slowTimer);
		if (to && to.url.pathname !== page.url.pathname) slowTimer = setTimeout(() => (slow = true), 300);
		else slow = false;
	});
	const active = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
	const bare = $derived(!me || ['/login', '/register'].includes(page.url.pathname));
	// Pas de barre d'onglets pendant un duel ou une ouverture de paquet en plein écran
	const hideTabs = $derived(/^\/duels\/\d+/.test(page.url.pathname));
</script>

<svelte:head>
	<title>{GAME_NAME}</title>
	<meta name="description" content="Jeu de cartes à collectionner gratuit, fan-jeu Dofus non officiel." />
	<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/icons/icon-180.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#f1e2bb" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#241e17" media="(prefers-color-scheme: dark)" />
	<link rel="preload" href="/fonts/grenze-700.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

{#if bare}
	<main class="bare">
		{@render children()}
		<Disclaimer />
	</main>
{:else if me}
	<div class="shell">
		<aside class="sidebar material">
			<a href="/" class="brand"><Logo /></a>
			<nav>
				{#each tabs as t (t.href)}
					<a href={t.href} class="side-link" aria-current={active(t.href) ? 'page' : undefined}>
						<Icon name={t.icon} size={20} />
						<span>{t.label}</span>
						{#if t.badge}<span class="badge ml-auto">{t.badge}</span>{/if}
					</a>
				{/each}
				<div class="side-sep"></div>
				{#each extra as t (t.href)}
					<a href={t.href} class="side-link" aria-current={active(t.href) ? 'page' : undefined}>
						<Icon name={t.icon} size={20} />
						<span>{t.label}</span>
					</a>
				{/each}
			</nav>
			<a href="/u/{me.username}" class="side-me">
				<Avatar name={me.username} image={me.avatar} x={me.avatarX} y={me.avatarY} size={36} />
				<span class="min-w-0">
					<span class="block truncate font-semibold">{me.username}</span>
					<span class="block footnote text-label-2">Niveau {me.level}</span>
				</span>
			</a>
		</aside>

		<div class="content">
			<header class="topbar material">
				<a href="/" class="topbar-brand" aria-label="Accueil"><Logo size={26} compact /></a>
				<div class="topbar-right">
					<a href="/#paquets" class="pill-hit" title="Paquets disponibles" aria-label="{me.packs} paquets disponibles"><span class="pill"><Icon name="package" size={16} />{me.packs}</span></a>
					<span class="pill" title="Kamas"><KamasCounter value={me.kamas} /></span>
					<a href="/notifications" class="icon-btn" aria-label="Notifications">
						<Icon name="bell" size={21} />
						{#if me.unreadNotifs}<span class="badge dot">{me.unreadNotifs}</span>{/if}
					</a>
					<a href="/u/{me.username}" class="icon-btn mobile-only" aria-label="Mon profil">
						<Avatar name={me.username} image={me.avatar} x={me.avatarX} y={me.avatarY} size={30} />
					</a>
				</div>
			</header>

			{#if offline}<p class="offline" role="status">Hors ligne : ton album reste consultable, les actions reviendront avec la connexion.</p>{/if}
			<main class="page" class:with-coach={!!data.onboarding} aria-busy={slow}>
				{#if slow}
					<div class="sk" aria-label="Chargement">
						<div class="skeleton" style="height: 40px; width: 60%"></div>
						<div class="skeleton" style="height: 18px; width: 40%"></div>
						<div class="sk-grid">{#each Array(6) as _, i (i)}<div class="skeleton" style="aspect-ratio: 5 / 7"></div>{/each}</div>
					</div>
				{:else}
					{@render children()}
				{/if}
				<Disclaimer />
			</main>
		</div>

		{#if data.onboarding && !hideTabs}<Coach info={data.onboarding} />{/if}
		{#if data.hunt}<HuntSpark path={data.hunt} />{/if}
		{#if levelUp}<LevelUp level={levelUp} ondone={() => (levelUp = null)} />{/if}
		<Toaster />

		{#if !hideTabs}
			<nav class="tabbar material" aria-label="Navigation principale">
				{#each tabs as t (t.href)}
					<a href={t.href} aria-current={active(t.href) ? 'page' : undefined}>
						<span class="tab-icon slot">
							<Icon name={t.icon} size={22} stroke={active(t.href) ? 2.3 : 1.9} />
							{#if t.badge}<span class="badge dot">{t.badge}</span>{/if}
						</span>
						<span class="tab-label">{t.label}</span>
					</a>
				{/each}
			</nav>
		{/if}
	</div>
{/if}

<style>
	.bare {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	.shell {
		min-height: 100dvh;
	}
	.sidebar {
		display: none;
	}
	.content {
		min-width: 0;
	}
	/* Barre du haut : planche de bois, rainure dorée en bas */
	.topbar {
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: calc(env(safe-area-inset-top) + 6px) 12px 6px 16px;
		border-bottom: 1px solid var(--bar-edge);
		box-shadow:
			inset 0 -1px 0 color-mix(in srgb, var(--gold) 22%, transparent),
			0 4px 10px -6px rgba(0, 0, 0, 0.5);
	}
	.topbar-brand {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		min-width: var(--tap);
		color: inherit;
		text-decoration: none;
	}
	.topbar-right {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.page.with-coach {
		padding-bottom: calc(var(--tabbar-h) + 220px + env(safe-area-inset-bottom));
	}
	.offline {
		margin: 0;
		padding: var(--space-2) var(--gutter);
		text-align: center;
		font-size: var(--text-sm);
		background: var(--surface-3);
		color: var(--label);
	}
	.pill-hit {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		text-decoration: none;
	}
	.sk {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-2);
	}
	.sk-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 10px;
		margin-top: var(--space-2);
	}
	/* Compteurs : plaques creusées, chiffres dorés */
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 32px;
		padding: 0 10px;
		border-radius: var(--radius-md);
		background: var(--slot);
		border: 1px solid var(--slot-edge);
		box-shadow: var(--slot-inset);
		font-size: 15px;
		font-weight: 800;
		color: var(--label);
		text-decoration: none;
		font-variant-numeric: tabular-nums;
	}
	.icon-btn {
		position: relative;
		width: var(--tap);
		height: var(--tap);
		display: grid;
		place-items: center;
		color: var(--label-2);
		border-radius: var(--radius-md);
	}
	.badge.dot {
		position: absolute;
		top: -3px;
		right: -5px;
	}
	.page {
		max-width: var(--content-max);
		margin: 0 auto;
		/* la barre d'onglets ne masque jamais la fin de page (safe-area iOS comprise) */
		padding: var(--space-3) var(--gutter) calc(var(--tabbar-h) + var(--space-8) + env(safe-area-inset-bottom));
	}
	/* Barre d'onglets : la barre de sorts du jeu, une case creusée par onglet */
	.tabbar {
		position: fixed;
		z-index: 40;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		gap: 4px;
		padding: 6px 6px calc(4px + env(safe-area-inset-bottom));
		border-top: 1px solid var(--bar-edge);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, var(--gold) 22%, transparent),
			0 -4px 12px -6px rgba(0, 0, 0, 0.5);
	}
	.tabbar a {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		color: var(--label-3);
		text-decoration: none;
		transition: color var(--dur-fast);
	}
	.tabbar a .tab-icon {
		position: relative;
		width: 100%;
		max-width: 60px;
		height: 36px;
		transition:
			border-color var(--dur-fast),
			box-shadow var(--dur-fast),
			transform 120ms var(--ease-bounce);
	}
	.tabbar a:active .tab-icon {
		transform: scale(0.94);
	}
	.tabbar a[aria-current='page'] {
		color: var(--title);
	}
	.tabbar a[aria-current='page'] .tab-icon {
		border-color: var(--gold-deep);
		background: color-mix(in srgb, var(--slot) 80%, var(--gold));
		box-shadow:
			var(--slot-inset),
			0 0 0 1px color-mix(in srgb, var(--gold) 45%, transparent),
			0 0 12px -2px color-mix(in srgb, var(--gold) 55%, transparent);
	}
	.tab-label {
		font-size: var(--text-xs);
		font-weight: 700;
		line-height: 1;
	}

	@media (min-width: 1024px) {
		.shell {
			display: grid;
			grid-template-columns: 248px 1fr;
		}
		/* Barre latérale : panneau de bois sur toute la hauteur */
		.sidebar {
			display: flex;
			flex-direction: column;
			position: sticky;
			top: 0;
			height: 100dvh;
			padding: 20px 12px;
			border-right: 1px solid var(--bar-edge);
			box-shadow: inset -1px 0 0 color-mix(in srgb, var(--gold) 18%, transparent);
		}
		.brand {
			padding: 4px 12px 20px;
			color: inherit;
			text-decoration: none;
		}
		nav {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.side-link {
			display: flex;
			align-items: center;
			gap: 12px;
			min-height: var(--tap);
			padding: 8px 12px;
			border-radius: var(--radius-md);
			border: 1px solid transparent;
			color: var(--label);
			font-weight: 600;
			text-decoration: none;
		}
		.side-link:hover {
			background: color-mix(in srgb, var(--material) 80%, var(--gold));
		}
		.side-link[aria-current='page'] {
			background: var(--slot);
			border-color: var(--gold-deep);
			box-shadow: var(--slot-inset);
			color: var(--title);
		}
		.side-sep {
			height: 2px;
			border-top: 1px solid var(--groove-dark);
			border-bottom: 1px solid var(--groove-light);
			margin: 10px 12px;
		}
		.side-me {
			margin-top: auto;
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 10px 12px;
			border-radius: var(--radius-md);
			color: inherit;
			text-decoration: none;
		}
		.side-me:hover {
			background: color-mix(in srgb, var(--material) 80%, var(--gold));
		}
		.topbar-brand,
		.mobile-only,
		.tabbar {
			display: none;
		}
		.topbar {
			justify-content: flex-end;
			padding: 10px 32px;
		}
		.page {
			padding: 20px 32px 32px;
		}
	}
</style>
