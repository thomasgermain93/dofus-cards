<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Kamas from '#lib/components/Kamas.svelte';
	import { RARITY, rarityColor } from '#lib/rarity';
	import { duration, fmt } from '#lib/format';
	import ConfirmSheet from '#lib/components/ConfirmSheet.svelte';
	import { sell } from '#lib/sell';
	import { tilt } from '#lib/holo';
	import { invalidateAll } from '$app/navigation';
	let newTag = $state('');
	let tagError = $state<string | null>(null);
	async function tagAction(action: 'tag' | 'untag', tag: string) {
		tagError = null;
		const res = await fetch('/api/cards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, cardIds: [c.id], tag }) });
		if (!res.ok) tagError = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Erreur.';
		else {
			newTag = '';
			await invalidateAll();
		}
	}

	let { data, form } = $props();
	const c = $derived(data.card);
	let qty = $state(1);
	$effect(() => {
		if (qty > data.sellable) qty = Math.max(1, data.sellable);
	});
	let confirmOpen = $state(false);
	let selling = $state(false);
	let sold = $state<{ gain: number; cards: number; unit: string } | null>(null);
	let mode = $state<'sell' | 'recycle'>('sell');
	const unitValue = $derived(mode === 'sell' ? data.sellValue : data.recycleValue);
	const unitName = $derived(mode === 'sell' ? 'kamas' : 'fragments');
	let sellError = $state<string | null>(null);
	const isLast = $derived(qty >= data.owned);
	const needsConfirm = $derived(isLast || data.fav || c.rarity === 5);
	const confirmMsg = $derived(
		[isLast ? 'C’est ton dernier exemplaire : la carte quittera ton album.' : '', data.fav ? 'Cette carte est dans tes favoris.' : '', c.rarity === 5 ? 'C’est une carte Légendaire.' : '']
			.filter(Boolean)
			.join(' ')
	);
	async function doSell() {
		confirmOpen = false;
		if (selling) return;
		selling = true;
		sellError = null;
		const r = await sell({ items: [{ cardId: c.id, count: qty }], mode });
		selling = false;
		if (r.error) sellError = r.error;
		else sold = { gain: r.gain, cards: r.cards, unit: unitName };
	}
	let showSell = $state(false);

	const FACT_LABELS: Record<string, string> = {
		level: 'Niveau', zone: 'Zone', area: 'Région', race: 'Famille', dungeon: 'Donjon', bossOf: 'Boss du donjon',
		archiOf: 'Archimonstre de', type: 'Type', set: 'Panoplie', dropMonster: 'Butin de', family: 'Famille', role: 'Rôle', hp: 'Points de vie'
	};
	const facts = $derived(
		Object.entries(data.facts).filter(([k, v]) => FACT_LABELS[k] && v != null && v !== '' && !(k === 'area' && v === data.facts.zone))
	);
	const spells = $derived((data.facts.spells as string[] | undefined) ?? []);
</script>

<svelte:head><title>{data.owned ? c.name : 'Carte manquante'}</title></svelte:head>

<a href="/album" class="back-link"><Icon name="chevron-left" size={20} />Album</a>

<div class="layout">
	<div class="card-col">
		<div class="big" use:tilt><Card card={c} size="lg" missing={!data.owned} favorite={data.fav} foil={data.shinyCount > 0} /></div>
	</div>

	<div class="flex flex-col gap-4 min-w-0">
		<div>
			<p class="footnote font-bold" style="color: color-mix(in srgb, {rarityColor(c.rarity)} 40%, var(--label))">{RARITY[c.rarity].name}</p>
			<h1 class="large-title">{data.owned ? c.name : 'Carte manquante'}</h1>
			<p class="text-label-2">{c.subtype}{c.category !== 'class' ? `, niveau ${c.level}` : ''}</p>
		</div>

		{#if form?.error}<p class="alert alert-error">{form.error}</p>{/if}
		{#if sold}<p class="alert alert-ok" data-testid="sold">{sold.unit === 'kamas' ? 'Vendu' : 'Recyclé'} : +{fmt(sold.gain)} {sold.unit}.</p>{/if}
		{#if form?.crafted}<p class="alert alert-ok" data-testid="crafted">Carte fabriquée pour {fmt(form.crafted.cost)} fragments !</p>{/if}
		{#if sellError}<p class="alert alert-error">{sellError}</p>{/if}
		{#if form?.auctionId}<p class="alert alert-ok">Carte mise en vente. <a class="underline" href="/market/{form.auctionId}">Voir l'enchère</a></p>{/if}

		<div class="group">
			<div class="cell"><span class="flex-1 text-label-2">Exemplaires</span><span class="font-semibold">{data.owned}{data.owned - data.free > 0 ? ` (dont ${data.owned - data.free} en vente)` : ''}</span></div>
			<div class="cell"><span class="flex-1 text-label-2">Attaque</span><span class="font-semibold tabular-nums">{data.owned ? fmt(c.attack) : '?'}</span></div>
			<div class="cell"><span class="flex-1 text-label-2">Défense</span><span class="font-semibold tabular-nums">{data.owned ? fmt(c.defense) : '?'}</span></div>
			<div class="cell"><span class="flex-1 text-label-2">Joueurs qui la possèdent</span><span class="font-semibold">{data.owners}</span></div>
			<div class="cell"><span class="flex-1 text-label-2">Exemplaires en circulation</span><span class="font-semibold" data-testid="circulation">{fmt(data.circulation)}</span></div>
			<div class="cell"><span class="flex-1 text-label-2">Dans les listes de souhaits</span><span class="font-semibold">{data.wishers}</span></div>
			{#if data.lastSale}<div class="cell"><span class="flex-1 text-label-2">Dernière vente</span><Kamas value={data.lastSale} /></div>{/if}
		</div>

		<form method="POST" action="?/wish" use:enhance>
			<button class="btn btn-sm {data.wished ? 'btn-secondary' : 'btn-plain'} px-2" data-testid="wish-toggle"><Icon name="star" size={16} fill={data.wished} />{data.wished ? 'Dans ta liste de souhaits' : 'Souhaiter cette carte'}</button>
		</form>
		{#if data.owned}
			<div class="flex flex-wrap gap-2">
				<form method="POST" action="?/fav" use:enhance>
					<button class="btn btn-secondary btn-sm"><Icon name="star" size={16} fill={data.fav} />{data.fav ? 'Retirer des favoris' : 'Favori'}</button>
				</form>
				{#if data.free > 0}
					<button class="btn btn-secondary btn-sm" onclick={() => (showSell = !showSell)}><Icon name="gavel" size={16} />Vendre aux enchères</button>
				{/if}
				<a class="btn btn-secondary btn-sm" href="/trades/new?give={c.id}"><Icon name="repeat" size={16} />Proposer en échange</a>
			</div>

			{#if showSell}
				<form method="POST" action="?/sell" use:enhance class="group p-4 flex flex-col gap-3">
					<p class="headline">Mettre en vente</p>
					<label class="flex flex-col gap-1"><span class="footnote text-label-2">Prix de départ (kamas)</span>
						<input class="field" type="number" name="price" min="1" value={Math.max(1, data.lastSale ?? data.sellValue * 3)} required />
					</label>
					<label class="flex flex-col gap-1"><span class="footnote text-label-2">Durée</span>
						<select class="field" name="duration">
							{#each data.durations as h}<option value={h} selected={h === 24}>{h < 24 ? `${h} h` : `${h / 24} jour${h > 24 ? 's' : ''}`}</option>{/each}
						</select>
					</label>
					<button class="btn">Mettre en vente</button>
				</form>
			{/if}

			{#if data.sellable > 0}
				<section class="group p-4 flex flex-col gap-3" data-testid="sell-box">
					<div class="flex items-center gap-3">
						<div class="flex-1 min-w-0">
							<p class="headline">{mode === 'sell' ? 'Vendre au jeu' : 'Recycler en fragments'}</p>
							<p class="footnote text-label-2">{unitValue} {unitName} par exemplaire{data.shinyCount ? ', x5 pour une brillante (vendue en dernier)' : ''}</p>
						</div>
						<div class="stepper" aria-label="Quantité">
							<button type="button" onclick={() => (qty = Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Moins">−</button>
							<span class="tabular-nums" data-testid="sell-qty">{qty}</span>
							<button type="button" onclick={() => (qty = Math.min(data.sellable, qty + 1))} disabled={qty >= data.sellable} aria-label="Plus">+</button>
						</div>
					</div>
					<div class="segmented" role="group" aria-label="Vendre ou recycler">
						<button type="button" aria-pressed={mode === 'sell'} onclick={() => (mode = 'sell')}>Vendre (kamas)</button>
						<button type="button" aria-pressed={mode === 'recycle'} onclick={() => (mode = 'recycle')} data-testid="card-recycle">Recycler ({fmt(data.fragments)} fragments)</button>
					</div>
					{#if data.sellable > 1}
						<div class="flex gap-2 flex-wrap">
							{#if data.owned > 1 && data.sellable >= data.owned - 1}<button type="button" class="chip" onclick={() => (qty = data.owned - 1)}>Doublons ({data.owned - 1})</button>{/if}
							<button type="button" class="chip" onclick={() => (qty = data.sellable)}>Tout ({data.sellable})</button>
						</div>
					{/if}
					<button class="btn btn-block" disabled={selling} data-testid="sell" onclick={() => (needsConfirm ? (confirmOpen = true) : doSell())}>
						<Icon name="coins" size={18} />{mode === 'sell' ? 'Vendre' : 'Recycler'} {qty > 1 ? `${qty} exemplaires ` : ''}+{fmt(qty * unitValue)} {unitName}
					</button>
					{#if data.owned - data.sellable > 0}<p class="footnote text-label-3">{data.owned - data.sellable} exemplaire{data.owned - data.sellable > 1 ? 's' : ''} bloqué{data.owned - data.sellable > 1 ? 's' : ''} (en vente aux enchères ou proposé en échange).</p>{/if}
				</section>
			{:else}
				<p class="footnote text-label-2">Tous tes exemplaires sont engagés (enchère ou échange en cours) : la vente au jeu est indisponible.</p>
			{/if}
		{:else}
			<p class="alert" style="background: var(--surface-3)">Tu n'as pas encore cette carte. Ouvre des paquets, guette les enchères, propose un échange ou fabrique-la.</p>
			<form method="POST" action="?/craft" use:enhance class="group p-4 flex flex-col gap-3" data-testid="craft-box">
				<div>
					<p class="headline">Fabriquer cette carte</p>
					<p class="footnote text-label-2">Coût : {fmt(data.craftCost)} fragments, tu en as {fmt(data.fragments)}. Les fragments s'obtiennent en recyclant tes cartes, avec les quêtes et la série du jour.</p>
				</div>
				<div class="bar"><span style="width: {Math.min(100, (data.fragments / data.craftCost) * 100)}%"></span></div>
				<button class="btn btn-block" disabled={data.fragments < data.craftCost} data-testid="craft"><Icon name="sparkles" size={18} />Fabriquer ({fmt(data.craftCost)} fragments)</button>
			</form>
		{/if}

		{#if data.owned}
			<div>
				<h2 class="section-label">Étiquettes</h2>
				<div class="group p-4 flex flex-col gap-3" data-testid="tags">
					{#if data.tags.length}
						<div class="flex flex-wrap gap-2">
							{#each data.tags as t (t)}
								<span class="chip">{t}<button class="tag-x" aria-label="Retirer {t}" onclick={() => tagAction('untag', t)}><Icon name="x" size={14} /></button></span>
							{/each}
						</div>
					{/if}
					<form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); if (newTag.trim().length >= 2) tagAction('tag', newTag.trim()); }}>
						<input class="field flex-1" bind:value={newTag} maxlength="24" placeholder="Ajouter une étiquette" list="my-tags" aria-label="Nouvelle étiquette" />
						<datalist id="my-tags">{#each data.myTags as t (t)}<option value={t}></option>{/each}</datalist>
						<button class="btn btn-secondary" disabled={newTag.trim().length < 2} data-testid="add-tag">Ajouter</button>
					</form>
					{#if tagError}<p class="footnote text-danger">{tagError}</p>{/if}
				</div>
			</div>
		{/if}

		{#if data.owned && (facts.length || spells.length)}
			<div>
				<h2 class="section-label">Fiche</h2>
				<div class="group">
					{#each facts as [k, v]}
						<div class="cell"><span class="text-label-2 w-36 flex-none">{FACT_LABELS[k]}</span><span class="flex-1 text-right">{typeof v === 'number' ? fmt(v) : v}</span></div>
					{/each}
					{#if spells.length}<div class="cell"><span class="text-label-2 w-36 flex-none">Sorts</span><span class="flex-1 text-right">{spells.join(', ')}</span></div>{/if}
				</div>
			</div>
		{/if}

		{#if data.sales.length}
			{@const max = Math.max(...data.sales.map((x) => x.price))}
			{@const min = Math.min(...data.sales.map((x) => x.price))}
			<div>
				<h2 class="section-label">Historique des prix ({data.sales.length} vente{data.sales.length > 1 ? 's' : ''})</h2>
				<div class="group p-4">
					<svg viewBox="0 0 300 80" class="spark" preserveAspectRatio="none" aria-label="Évolution des prix">
						<polyline
							fill="none"
							stroke="var(--accent)"
							stroke-width="2.5"
							stroke-linejoin="round"
							points={data.sales.map((x, i) => `${data.sales.length === 1 ? 150 : (i / (data.sales.length - 1)) * 300},${max === min ? 40 : 72 - ((x.price - min) / (max - min)) * 64}`).join(' ')}
						/>
						{#each data.sales as x, i}<circle cx={data.sales.length === 1 ? 150 : (i / (data.sales.length - 1)) * 300} cy={max === min ? 40 : 72 - ((x.price - min) / (max - min)) * 64} r="3.5" fill="var(--accent)" />{/each}
					</svg>
					<p class="footnote text-label-2 mt-2">Min {fmt(min)}, max {fmt(max)}, moyenne {fmt(Math.round(data.sales.reduce((a, b) => a + b.price, 0) / data.sales.length))} kamas</p>
				</div>
			</div>
		{/if}

		{#if data.friendsOwning.length}
			<div>
				<h2 class="section-label">Tes amis qui l'ont</h2>
				<div class="group">
					{#each data.friendsOwning as f (f.username)}
						<a class="cell text-inherit no-underline" href="/u/{f.username}">
							<span class="flex-1">{f.username}</span><span class="footnote text-label-2">{f.n} exemplaire{f.n > 1 ? 's' : ''}</span>
							{#if !data.owned || f.n > 1}<span class="btn btn-plain btn-sm">Échanger</span>{/if}
						</a>
					{/each}
				</div>
			</div>
		{/if}

		{#if data.auctions.length}
			<div>
				<h2 class="section-label">En vente</h2>
				<div class="group">
					{#each data.auctions as a (a.id)}
						<a class="cell text-inherit no-underline" href="/market/{a.id}">
							<span class="flex-1">{a.seller}<span class="block footnote text-label-2">Fin dans {duration(a.ends_at - Date.now())}</span></span>
							<Kamas value={a.current_bid ?? a.start_price} />
							<Icon name="chevron-right" size={16} class="text-label-3" />
						</a>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

{#if confirmOpen}
	<ConfirmSheet
		title="{mode === 'sell' ? 'Vendre' : 'Recycler'} {qty} x {c.name} pour {fmt(qty * unitValue)} {unitName} ?"
		message={confirmMsg}
		confirmLabel={mode === 'sell' ? 'Vendre' : 'Recycler'}
		destructive
		onconfirm={doSell}
		oncancel={() => (confirmOpen = false)}
	/>
{/if}

<style>
	.tag-x {
		display: inline-grid;
		place-items: center;
		width: 28px;
		height: 28px;
		margin-right: -8px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	.spark {
		width: 100%;
		height: 80px;
		overflow: visible;
	}
	.bar {
		height: 6px;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, var(--indigo), var(--purple));
	}
	.segmented button {
		border: 0;
		background: transparent;
		cursor: pointer;
	}
	.stepper {
		display: inline-flex;
		align-items: center;
		background: var(--surface-3);
		border-radius: 10px;
		overflow: hidden;
	}
	.stepper button {
		width: var(--tap);
		height: var(--tap);
		border: 0;
		background: transparent;
		font-size: 20px;
		color: var(--accent);
		cursor: pointer;
	}
	.stepper button:disabled {
		color: var(--label-3);
	}
	.stepper span {
		min-width: 28px;
		text-align: center;
		font-weight: 700;
	}
	.layout {
		display: grid;
		gap: 24px;
	}
	.card-col {
		display: flex;
		justify-content: center;
	}
	.big {
		width: min(300px, 78vw);
	}
	@media (min-width: 900px) {
		.layout {
			grid-template-columns: 340px 1fr;
			align-items: start;
		}
		.card-col {
			position: sticky;
			top: 80px;
		}
	}
	.no-underline {
		text-decoration: none;
	}
	.text-inherit {
		color: inherit;
	}
</style>
