<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { CATEGORIES, RARITY } from '#lib/rarity';
	import { fmt } from '#lib/format';

	let { data, form } = $props();
	const f = $derived(data.filters);

	/** Lien vers l'album avec un filtre modifié (et retour page 1). */
	function link(changes: Record<string, string | number | null>) {
		const p = new URLSearchParams(page.url.search);
		for (const [k, v] of Object.entries(changes)) {
			if (v === null || v === '' || v === 'all' || v === -1) p.delete(k);
			else p.set(k, String(v));
		}
		if (!('page' in changes)) p.delete('page');
		const s = p.toString();
		return s ? `?${s}` : '?';
	}

	const totalAll = $derived(data.completion.reduce((s, c) => s + c.total, 0));
	const ownedAll = $derived(data.completion.reduce((s, c) => s + c.owned, 0));
	const comp = $derived(f.cat === 'all' ? { owned: ownedAll, total: totalAll } : (data.completion.find((c) => c.category === f.cat) ?? { owned: 0, total: 0 }));

	let q = $state(page.url.searchParams.get('q') ?? '');
	let timer: ReturnType<typeof setTimeout>;
	function onSearch() {
		clearTimeout(timer);
		timer = setTimeout(() => goto(link({ q }), { reset: false, replace: true }), 300);
	}
	let showDiscard = $state(false);
</script>

<svelte:head><title>Album</title></svelte:head>

<div class="flex items-end justify-between gap-3 mb-1">
	<h1 class="large-title">Album</h1>
	{#if data.dupes > 0}
		<button class="btn btn-secondary btn-sm mb-1" onclick={() => (showDiscard = !showDiscard)}><Icon name="trash" size={16} />Doublons ({data.dupes})</button>
	{/if}
</div>
<p class="text-label-2 mb-3">
	{fmt(comp.owned)} / {fmt(comp.total)} cartes, {comp.total ? ((comp.owned / comp.total) * 100).toFixed(1).replace('.', ',') : 0} % complété
</p>
<div class="progress mb-4"><span style="width:{comp.total ? Math.max(0.5, (comp.owned / comp.total) * 100) : 0}%"></span></div>

{#if form?.discarded}
	<p class="alert alert-ok mb-3">{form.discarded.cards} doublon{form.discarded.cards > 1 ? 's' : ''} défaussé{form.discarded.cards > 1 ? 's' : ''} : +{fmt(form.discarded.gain)} kamas.</p>
{/if}
{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}

{#if showDiscard}
	<form method="POST" action="?/discardAll" use:enhance={() => async ({ update }) => { showDiscard = false; await update(); }} class="group p-4 mb-4 flex flex-col gap-3">
		<p class="headline">Défausser les doublons</p>
		<p class="footnote text-label-2">Garde un exemplaire de chaque carte et transforme les autres en kamas (1 pour une Commune, jusqu'à 400 pour une Légendaire). Les cartes en vente ne sont pas touchées.</p>
		<label class="flex items-center gap-3">
			<span class="footnote">Jusqu'à la rareté</span>
			<select name="max" class="field flex-1">
				{#each RARITY as r, i}<option value={i} selected={i === 2}>{r.name}</option>{/each}
			</select>
		</label>
		<button class="btn">Défausser</button>
	</form>
{/if}

<nav class="segmented mb-3" aria-label="Type de carte">
	<a href={link({ cat: null })} aria-current={f.cat === 'all' ? 'page' : undefined}>Tout</a>
	{#each CATEGORIES as c}
		<a href={link({ cat: c.key })} aria-current={f.cat === c.key ? 'page' : undefined}>{c.name}</a>
	{/each}
</nav>

<div class="toolbar mb-3">
	<label class="search-wrap">
		<Icon name="search" size={16} class="text-label-3" />
		<input class="field search" type="search" placeholder="Rechercher une carte" bind:value={q} oninput={onSearch} aria-label="Rechercher" />
	</label>
	<select class="field search sort" aria-label="Trier" onchange={(e) => goto(link({ sort: e.currentTarget.value }), { reset: false })}>
		<option value="rarity" selected={f.sort === 'rarity'}>Rareté</option>
		<option value="level" selected={f.sort === 'level'}>Niveau</option>
		<option value="name" selected={f.sort === 'name'}>Nom</option>
		<option value="attack" selected={f.sort === 'attack'}>Attaque</option>
		<option value="defense" selected={f.sort === 'defense'}>Défense</option>
		<option value="recent" selected={f.sort === 'recent'}>Récentes</option>
	</select>
</div>

<div class="chips mb-2">
	{#each [['all', 'Toutes'], ['owned', 'Possédées'], ['missing', 'Manquantes'], ['dupes', 'Doublons'], ['fav', 'Favoris']] as [k, label]}
		<a class="chip" href={link({ own: k })} aria-current={f.own === k ? 'page' : undefined} data-sveltekit-noscroll>{label}</a>
	{/each}
</div>
<div class="chips mb-4">
	<a class="chip" href={link({ r: null })} aria-current={f.rarity < 0 ? 'page' : undefined} data-sveltekit-noscroll>Toutes raretés</a>
	{#each RARITY as r, i}
		<a class="chip" href={link({ r: i })} aria-current={f.rarity === i ? 'page' : undefined} data-sveltekit-noscroll>
			<span class="dot" style="background: var({r.var})"></span>{r.name}
		</a>
	{/each}
</div>

<p class="footnote text-label-2 mb-2">{fmt(data.total)} carte{data.total > 1 ? 's' : ''}</p>
<div class="grid-cards">
	{#each data.cards as c (c.id)}
		<a href="/card/{c.id}" class="card-link" aria-label={c.cnt ? c.name : 'Carte manquante'}>
			<Card card={c} size="sm" missing={!c.cnt} count={c.cnt} favorite={!!c.fav} />
		</a>
	{:else}
		<p class="text-label-2 col-span-full py-10 text-center">Aucune carte ne correspond à ces filtres.</p>
	{/each}
</div>

{#if data.pages > 1}
	<nav class="pager">
		{#if data.pageNo > 1}<a class="btn btn-secondary btn-sm" href={link({ page: data.pageNo - 1 })}><Icon name="chevron-left" size={16} />Précédent</a>{:else}<span></span>{/if}
		<span class="footnote text-label-2">Page {data.pageNo} / {data.pages}</span>
		{#if data.pageNo < data.pages}<a class="btn btn-secondary btn-sm" href={link({ page: data.pageNo + 1 })}>Suivant<Icon name="chevron-right" size={16} /></a>{:else}<span></span>{/if}
	</nav>
{/if}

<style>
	.progress {
		height: 6px;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}
	.progress span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, var(--accent), #5e5ce6);
		border-radius: inherit;
	}
	.segmented {
		overflow-x: auto;
		scrollbar-width: none;
	}
	.toolbar {
		display: flex;
		gap: 8px;
	}
	.search-wrap {
		flex: 1;
		position: relative;
		display: flex;
		align-items: center;
	}
	.search-wrap :global(svg) {
		position: absolute;
		left: 10px;
		pointer-events: none;
	}
	.search-wrap input {
		padding-left: 32px;
	}
	.sort {
		width: auto;
		flex: none;
	}
	.chips {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		scrollbar-width: none;
		margin-left: -16px;
		margin-right: -16px;
		padding: 0 16px;
	}
	.chips::-webkit-scrollbar,
	.segmented::-webkit-scrollbar {
		display: none;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
	}
	.grid-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 10px;
	}
	@media (min-width: 768px) {
		.grid-cards {
			grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
			gap: 14px;
		}
	}
	.card-link {
		display: block;
		transition: transform var(--dur-fast) var(--ease-ios);
		color: inherit;
		text-decoration: none;
	}
	.card-link:active {
		transform: scale(0.96);
	}
	@media (hover: hover) {
		.card-link:hover {
			transform: translateY(-3px);
		}
	}
	.pager {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 20px;
	}
</style>
