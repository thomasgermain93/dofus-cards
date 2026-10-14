<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Kamas from '#lib/components/Kamas.svelte';
	import { RARITY } from '#lib/rarity';
	import { duration } from '#lib/format';

	let { data } = $props();
	const me = $derived(page.data.me);

	function link(changes: Record<string, string | number | null>) {
		const p = new URLSearchParams(page.url.search);
		for (const [k, v] of Object.entries(changes)) {
			if (v === null || v === '' || v === -1 || v === 'all') p.delete(k);
			else p.set(k, String(v));
		}
		const s = p.toString();
		return s ? `?${s}` : '?';
	}
	let q = $state(page.url.searchParams.get('q') ?? '');
	let timer: ReturnType<typeof setTimeout>;
	const onSearch = () => {
		clearTimeout(timer);
		timer = setTimeout(() => goto(link({ q }), { reset: false, replace: true }), 300);
	};
	const STATUS: Record<string, string> = { open: 'En cours', sold: 'Vendue', unsold: 'Invendue', cancelled: 'Annulée' };
</script>

<svelte:head><title>Marché</title></svelte:head>

<h1 class="large-title mb-3">Marché</h1>

<nav class="segmented mb-4" aria-label="Marché">
	<a href="/market" aria-current="page">Enchères</a>
	<a href="/trades">Échanges{#if me?.tradesPending}&nbsp;<span class="badge">{me.tradesPending}</span>{/if}</a>
</nav>

<div class="chips mb-3">
	{#each [['all', 'En vente'], ['mine', 'Mes ventes'], ['bids', 'Mes enchères'], ['history', 'Dernières ventes']] as [k, label]}
		<a class="chip" href={link({ tab: k })} aria-current={data.tab === k ? 'page' : undefined} data-sveltekit-noscroll>{label}</a>
	{/each}
</div>

<div class="flex gap-2 mb-3">
	<input class="field search flex-1" type="search" placeholder="Rechercher une carte" bind:value={q} oninput={onSearch} aria-label="Rechercher" />
	<select class="field search w-auto" aria-label="Rareté" onchange={(e) => goto(link({ r: e.currentTarget.value }), { reset: false })}>
		<option value="-1">Toutes raretés</option>
		{#each RARITY as r, i}<option value={i} selected={data.rarity === i}>{r.name}</option>{/each}
	</select>
</div>

{#if data.tab === 'mine'}
	<p class="footnote text-label-2 mb-3">Pour vendre une carte, ouvre-la dans ton <a class="text-accent" href="/album?own=dupes">album</a> puis « Vendre aux enchères ».</p>
{/if}

<div class="list">
	{#each data.auctions as a (a.auction_id)}
		<a href="/market/{a.auction_id}" class="item">
			<div class="thumb"><Card card={a} size="sm" /></div>
			<div class="flex-1 min-w-0 flex flex-col gap-1">
				<p class="headline truncate">{a.name}</p>
				<p class="footnote text-label-2 truncate">{RARITY[a.rarity].name}, par {a.seller}</p>
				{#if !a.owned_by_me}<span class="tag-new">Manquante</span>{/if}
				<div class="flex items-center gap-2 mt-auto">
					<Kamas value={a.current_bid ?? a.start_price} />
					<span class="footnote text-label-2">{a.bid_count} enchère{a.bid_count > 1 ? 's' : ''}</span>
				</div>
				<p class="footnote flex items-center gap-1 {a.status === 'open' ? 'text-label-2' : 'text-label-3'}">
					{#if a.status === 'open'}<Icon name="clock" size={13} />{duration(a.ends_at - data.now)}{:else}{STATUS[a.status]}{/if}
					{#if a.bidder_id === me?.id && a.status === 'open'}<span class="text-success font-semibold">, tu mènes</span>{/if}
				</p>
			</div>
		</a>
	{:else}
		<div class="empty col-span-full">
			<Icon name="gavel" size={36} />
			<p class="headline">{data.tab === 'all' ? 'Aucune enchère en cours' : 'Rien ici pour le moment'}</p>
			<p class="footnote">Mets une carte en vente depuis sa fiche, ou ajoute des cartes à ta liste de souhaits pour être prévenu.</p>
			<a class="btn btn-secondary btn-sm" href="/album?own=dupes">Mes doublons</a>
		</div>
	{/each}
</div>

<style>
	.chips {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.list {
		display: grid;
		gap: 10px;
	}
	@media (min-width: 768px) {
		.list {
			grid-template-columns: 1fr 1fr;
		}
	}
	.item {
		display: flex;
		gap: 14px;
		padding: 12px;
		background: var(--surface);
		border-radius: var(--radius-lg);
		color: inherit;
		text-decoration: none;
		transition: transform var(--dur-fast) var(--ease-ios);
	}
	.item:active {
		transform: scale(0.98);
	}
	.thumb {
		width: 86px;
		flex: none;
	}
	.tag-new {
		align-self: flex-start;
		font-size: 11px;
		font-weight: 700;
		color: var(--accent);
		background: var(--accent-soft);
		padding: 1px 8px;
		border-radius: 999px;
	}
</style>
