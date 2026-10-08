<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { GAME_NAME } from '#lib/config';
	import Icon from '#lib/components/Icon.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import KamasCounter from '#lib/components/KamasCounter.svelte';
	import Disclaimer from '#lib/components/Disclaimer.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
	const me = $derived(data.me);

	const tabs = $derived([
		{ href: '/', label: 'Accueil', icon: 'home', badge: 0 },
		{ href: '/album', label: 'Album', icon: 'album', badge: 0 },
		{ href: '/market', label: 'Marché', icon: 'gavel', badge: me?.tradesPending ?? 0 },
		{ href: '/duels', label: 'Duels', icon: 'swords', badge: me?.duelsToPlay ?? 0 },
		{ href: '/social', label: 'Social', icon: 'users', badge: (me?.unreadMessages ?? 0) + (me?.friendRequests ?? 0) }
	]);
	const extra = $derived([
		{ href: '/leaderboard', label: 'Classement', icon: 'trophy' },
		{ href: '/achievements', label: 'Succès', icon: 'award' },
		...(me?.role === 'admin' ? [{ href: '/admin', label: 'Modération', icon: 'shield' }] : [])
	]);

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
	<meta name="theme-color" content="#f2f2f7" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
</svelte:head>

{#if bare}
	<main class="bare">
		{@render children()}
		<Disclaimer />
	</main>
{:else if me}
	<div class="shell">
		<aside class="sidebar">
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
				<span class="avatar">{me.username.slice(0, 1).toUpperCase()}</span>
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
					<a href="/" class="pill" title="Paquets disponibles"><Icon name="package" size={16} />{me.packs}</a>
					<span class="pill"><KamasCounter value={me.kamas} /></span>
					<a href="/notifications" class="icon-btn" aria-label="Notifications">
						<Icon name="bell" size={21} />
						{#if me.unreadNotifs}<span class="badge dot">{me.unreadNotifs}</span>{/if}
					</a>
					<a href="/u/{me.username}" class="icon-btn mobile-only" aria-label="Mon profil">
						<span class="avatar sm">{me.username.slice(0, 1).toUpperCase()}</span>
					</a>
				</div>
			</header>

			<main class="page">
				{@render children()}
				<Disclaimer />
			</main>
		</div>

		{#if !hideTabs}
			<nav class="tabbar material" aria-label="Navigation principale">
				{#each tabs as t (t.href)}
					<a href={t.href} aria-current={active(t.href) ? 'page' : undefined}>
						<span class="tab-icon">
							<Icon name={t.icon} size={24} stroke={active(t.href) ? 2.3 : 1.8} />
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
	.topbar {
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: calc(env(safe-area-inset-top) + 8px) 16px 8px;
		border-bottom: 0.5px solid var(--separator);
	}
	.topbar-brand {
		color: inherit;
		text-decoration: none;
	}
	.topbar-right {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 30px;
		padding: 0 10px;
		border-radius: 999px;
		background: var(--surface);
		font-size: 13px;
		font-weight: 700;
		color: var(--label);
		text-decoration: none;
		font-variant-numeric: tabular-nums;
	}
	.icon-btn {
		position: relative;
		width: 36px;
		height: 36px;
		display: grid;
		place-items: center;
		color: var(--accent);
		border-radius: 999px;
	}
	.badge.dot {
		position: absolute;
		top: -2px;
		right: -4px;
		box-shadow: 0 0 0 2px var(--bg);
	}
	.avatar {
		width: 36px;
		height: 36px;
		flex: none;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-weight: 700;
		color: white;
		background: linear-gradient(135deg, #5ac8fa, #007aff);
	}
	.avatar.sm {
		width: 30px;
		height: 30px;
		font-size: 14px;
	}
	.page {
		max-width: 1080px;
		margin: 0 auto;
		padding: 8px 16px calc(96px + env(safe-area-inset-bottom));
	}
	.tabbar {
		position: fixed;
		z-index: 40;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		border-top: 0.5px solid var(--separator);
		padding-bottom: env(safe-area-inset-bottom);
	}
	.tabbar a {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 7px 0 6px;
		color: var(--label-3);
		text-decoration: none;
		transition: color var(--dur-fast);
	}
	.tabbar a[aria-current='page'] {
		color: var(--accent);
	}
	.tab-icon {
		position: relative;
		display: grid;
	}
	.tab-label {
		font-size: 10.5px;
		font-weight: 600;
	}

	@media (min-width: 1024px) {
		.shell {
			display: grid;
			grid-template-columns: 248px 1fr;
		}
		.sidebar {
			display: flex;
			flex-direction: column;
			position: sticky;
			top: 0;
			height: 100dvh;
			padding: 20px 12px;
			border-right: 0.5px solid var(--separator);
			background: var(--surface-2);
		}
		.brand {
			padding: 4px 12px 20px;
			color: inherit;
			text-decoration: none;
		}
		nav {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}
		.side-link {
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 9px 12px;
			border-radius: 10px;
			color: var(--label);
			font-weight: 500;
			text-decoration: none;
		}
		.side-link:hover {
			background: var(--surface-3);
		}
		.side-link[aria-current='page'] {
			background: var(--accent);
			color: white;
		}
		.side-sep {
			height: 0.5px;
			background: var(--separator);
			margin: 10px 12px;
		}
		.side-me {
			margin-top: auto;
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 10px 12px;
			border-radius: 12px;
			color: inherit;
			text-decoration: none;
		}
		.side-me:hover {
			background: var(--surface-3);
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
			padding: 16px 32px 32px;
		}
	}
</style>
