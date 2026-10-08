<script lang="ts">
	import ConfirmSheet from '#lib/components/ConfirmSheet.svelte';
	import { sell } from '#lib/sell';
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
	// ---- Vente de tous les doublons ----
	let maxRarity = $state(2);
	const dupPreview = $derived(
		data.dupByRarity.filter((d) => d.rarity <= maxRarity).reduce((acc, d) => ({ n: acc.n + d.n, kamas: acc.kamas + d.n * data.sellValues[d.rarity] }), { n: 0, kamas: 0 })
	);
	let toast = $state<string | null>(null);
	let sellError = $state<string | null>(null);
	let busy = $state(false);
	function flash(msg: string) {
		toast = msg;
		setTimeout(() => (toast = null), 2600);
	}
	async function sellDupes() {
		if (busy) return;
		busy = true;
		sellError = null;
		const r = await sell({ duplicates: true, maxRarity });
		busy = false;
		if (r.error) sellError = r.error;
		else flash(r.cards ? `${r.cards} doublon${r.cards > 1 ? 's' : ''} vendu${r.cards > 1 ? 's' : ''} : +${fmt(r.gain)} kamas` : 'Aucun doublon à vendre.');
	}

	// ---- Mode sélection ----
	let selecting = $state(false);
	let picked = $state<Record<number, number>>({});
	let confirmOpen = $state(false);
	const pickedList = $derived(
		Object.entries(picked)
			.map(([id, n]) => ({ card: data.cards.find((c) => c.id === Number(id))!, n }))
			.filter((p) => p.card && p.n > 0)
	);
	const pickedCount = $derived(pickedList.reduce((s, p) => s + p.n, 0));
	const pickedKamas = $derived(pickedList.reduce((s, p) => s + p.n * data.sellValues[p.card.rarity], 0));
	const warnings = $derived(
		[
			pickedList.some((p) => p.n >= p.card.cnt) ? 'Certaines cartes quitteront ton album (dernier exemplaire).' : '',
			pickedList.some((p) => p.card.fav) ? 'La sélection contient des favoris.' : '',
			pickedList.some((p) => p.card.rarity === 5) ? 'La sélection contient des Légendaires.' : ''
		]
			.filter(Boolean)
			.join(' ')
	);
	function toggle(c: (typeof data.cards)[number]) {
		if (!c.cnt || !c.sellable) return;
		const n = picked[c.id] ?? 0;
		// Chaque appui ajoute un exemplaire (doublons d'abord), puis revient à zéro
		picked = { ...picked, [c.id]: n >= c.sellable ? 0 : n + 1 };
	}
	function stopSelecting() {
		selecting = false;
		picked = {};
	}
	async function sellPicked() {
		confirmOpen = false;
		if (busy || !pickedList.length) return;
		busy = true;
		sellError = null;
		const r = await sell({ items: pickedList.map((p) => ({ cardId: p.card.id, count: p.n })) });
		busy = false;
		if (r.error) sellError = r.error;
		else {
			flash(`${r.cards} carte${r.cards > 1 ? 's' : ''} vendue${r.cards > 1 ? 's' : ''} : +${fmt(r.gain)} kamas`);
			stopSelecting();
		}
	}
	// Appui long sur une carte : passe en mode sélection
	let pressTimer: ReturnType<typeof setTimeout> | undefined;
	let longPressed = false;
	function pressStart(c: (typeof data.cards)[number]) {
		longPressed = false;
		if (selecting || !c.cnt) return;
		pressTimer = setTimeout(() => {
			longPressed = true;
			selecting = true;
			toggle(c);
			navigator.vibrate?.(10);
		}, 480);
	}
	const pressEnd = () => clearTimeout(pressTimer);
</script>

<svelte:head><title>Album</title></svelte:head>

<div class="flex items-end justify-between gap-3 mb-1">
	<h1 class="large-title">Album</h1>
	{#if selecting}
		<button class="btn btn-secondary btn-sm mb-1" onclick={stopSelecting}>Terminé</button>
	{:else}
		<button class="btn btn-secondary btn-sm mb-1" onclick={() => (selecting = true)} data-testid="select-mode"><Icon name="check" size={16} />Sélectionner</button>
	{/if}
</div>
<p class="text-label-2 mb-3">
	{fmt(comp.owned)} / {fmt(comp.total)} cartes, {comp.total ? ((comp.owned / comp.total) * 100).toFixed(1).replace('.', ',') : 0} % complété
</p>
<div class="progress mb-4"><span style="width:{comp.total ? Math.max(0.5, (comp.owned / comp.total) * 100) : 0}%"></span></div>

{#if sellError}<p class="alert alert-error mb-3">{sellError}</p>{/if}

{#if data.dupes > 0 && !selecting}
	<section class="sell-dupes group p-4 mb-4" data-testid="sell-dupes-box">
		<div class="flex items-center gap-3">
			<span class="coin"><Icon name="coins" size={22} /></span>
			<div class="flex-1 min-w-0">
				<p class="headline">Vendre tous les doublons</p>
				<p class="footnote text-label-2">Garde 1 exemplaire de chaque carte, vend le reste au jeu.</p>
			</div>
		</div>
		<label class="flex items-center gap-2 mt-3">
			<span class="footnote text-label-2 flex-none">Jusqu'à</span>
			<select class="field search flex-1" bind:value={maxRarity} aria-label="Rareté maximale">
				{#each RARITY as r, i}<option value={i}>{r.name}</option>{/each}
			</select>
		</label>
		<button class="btn btn-block mt-3" disabled={busy || !dupPreview.n} onclick={sellDupes} data-testid="sell-dupes">
			{dupPreview.n ? `Vendre ${dupPreview.n} doublon${dupPreview.n > 1 ? 's' : ''} +${fmt(dupPreview.kamas)} kamas` : 'Aucun doublon jusqu’à cette rareté'}
		</button>
		<p class="bareme footnote text-label-3 mt-2">
			Barème par exemplaire :
			{#each RARITY as r, i}<span><span class="dot" style="background: var({r.var})"></span>{r.code} {data.sellValues[i]}</span>{/each}
		</p>
	</section>
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
		{#if selecting}
			<button type="button" class="card-link pick" class:on={(picked[c.id] ?? 0) > 0} class:off={!c.cnt || !c.sellable} onclick={() => toggle(c)} aria-label={c.cnt ? c.name : 'Carte manquante'} data-testid="album-pick">
				<Card card={c} size="sm" missing={!c.cnt} count={c.cnt} favorite={!!c.fav} />
				{#if picked[c.id]}<span class="pickbadge">{picked[c.id]}</span>{/if}
			</button>
		{:else}
			<a
				href="/card/{c.id}"
				class="card-link"
				aria-label={c.cnt ? c.name : 'Carte manquante'}
				onpointerdown={() => pressStart(c)}
				onpointerup={pressEnd}
				onpointerleave={pressEnd}
				oncontextmenu={(e) => c.cnt && e.preventDefault()}
				onclick={(e) => longPressed && e.preventDefault()}
			>
				<Card card={c} size="sm" missing={!c.cnt} count={c.cnt} favorite={!!c.fav} />
			</a>
		{/if}
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

{#if selecting}
	<div class="selbar material" data-testid="selection-bar">
		<div class="flex-1 min-w-0">
			<p class="font-semibold">{pickedCount ? `${pickedCount} exemplaire${pickedCount > 1 ? 's' : ''}` : 'Touche les cartes à vendre'}</p>
			<p class="footnote text-label-2">{pickedCount ? `Total : +${fmt(pickedKamas)} kamas` : 'Un appui ajoute un exemplaire'}</p>
		</div>
		<button class="btn" disabled={!pickedCount || busy} onclick={() => (confirmOpen = true)} data-testid="sell-selection">Vendre +{fmt(pickedKamas)}</button>
	</div>
{/if}

{#if confirmOpen}
	<ConfirmSheet
		title="Vendre {pickedCount} exemplaire{pickedCount > 1 ? 's' : ''} pour {fmt(pickedKamas)} kamas ?"
		message={warnings}
		confirmLabel="Vendre"
		destructive
		onconfirm={sellPicked}
		oncancel={() => (confirmOpen = false)}
	/>
{/if}

{#if toast}<div class="toast" role="status" data-testid="toast">{toast}</div>{/if}

<style>
	.sell-dupes .coin {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		color: white;
		background: linear-gradient(135deg, #ffd60a, #ff9f0a);
		flex: none;
	}
	.bareme {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		align-items: center;
	}
	.bareme > span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.pick {
		position: relative;
		border: 0;
		background: none;
		padding: 0;
		cursor: pointer;
		border-radius: 14px;
	}
	.pick.on {
		outline: 3px solid var(--accent);
		outline-offset: 1px;
		transform: scale(0.95);
	}
	.pick.off {
		opacity: 0.35;
		cursor: default;
	}
	.pickbadge {
		position: absolute;
		top: -6px;
		right: -6px;
		min-width: 24px;
		height: 24px;
		border-radius: 999px;
		background: var(--accent);
		color: white;
		font-weight: 800;
		font-size: 13px;
		display: grid;
		place-items: center;
		box-shadow: 0 0 0 2px var(--bg);
	}
	.selbar {
		position: fixed;
		z-index: 45;
		left: 0;
		right: 0;
		bottom: calc(57px + env(safe-area-inset-bottom));
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
		border-top: 0.5px solid var(--separator);
		animation: slide var(--dur) var(--ease-ios);
	}
	@media (min-width: 1024px) {
		.selbar {
			left: 248px;
			bottom: 0;
			padding: 12px 32px;
		}
	}
	.toast {
		position: fixed;
		z-index: 150;
		left: 50%;
		top: calc(env(safe-area-inset-top) + 64px);
		transform: translateX(-50%);
		background: var(--label);
		color: var(--bg);
		padding: 10px 18px;
		border-radius: 999px;
		font-weight: 600;
		font-size: 15px;
		box-shadow: var(--shadow-float);
		animation: drop 0.35s var(--ease-ios);
		white-space: nowrap;
	}
	@keyframes slide {
		from {
			transform: translateY(100%);
		}
	}
	@keyframes drop {
		from {
			transform: translate(-50%, -16px);
			opacity: 0;
		}
	}
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
