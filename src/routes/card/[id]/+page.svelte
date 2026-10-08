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

	let { data, form } = $props();
	const c = $derived(data.card);
	let qty = $state(1);
	$effect(() => {
		if (qty > data.sellable) qty = Math.max(1, data.sellable);
	});
	let confirmOpen = $state(false);
	let selling = $state(false);
	let sold = $state<{ gain: number; cards: number } | null>(null);
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
		const r = await sell({ items: [{ cardId: c.id, count: qty }] });
		selling = false;
		if (r.error) sellError = r.error;
		else sold = { gain: r.gain, cards: r.cards };
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

<a href="/album" class="back"><Icon name="chevron-left" size={20} />Album</a>

<div class="layout">
	<div class="card-col">
		<div class="big" use:tilt><Card card={c} size="lg" missing={!data.owned} favorite={data.fav} /></div>
	</div>

	<div class="flex flex-col gap-4 min-w-0">
		<div>
			<p class="footnote font-bold" style="color: {rarityColor(c.rarity)}">{RARITY[c.rarity].name}</p>
			<h1 class="large-title">{data.owned ? c.name : 'Carte manquante'}</h1>
			<p class="text-label-2">{c.subtype}{c.category !== 'class' ? `, niveau ${c.level}` : ''}</p>
		</div>

		{#if form?.error}<p class="alert alert-error">{form.error}</p>{/if}
		{#if sold}<p class="alert alert-ok" data-testid="sold">Vendu : +{fmt(sold.gain)} kamas.</p>{/if}
		{#if sellError}<p class="alert alert-error">{sellError}</p>{/if}
		{#if form?.auctionId}<p class="alert alert-ok">Carte mise en vente. <a class="underline" href="/market/{form.auctionId}">Voir l'enchère</a></p>{/if}

		<div class="group">
			<div class="cell"><span class="flex-1 text-label-2">Exemplaires</span><span class="font-semibold">{data.owned}{data.owned - data.free > 0 ? ` (dont ${data.owned - data.free} en vente)` : ''}</span></div>
			<div class="cell"><span class="flex-1 text-label-2">Attaque</span><span class="font-semibold tabular-nums">{data.owned ? fmt(c.attack) : '?'}</span></div>
			<div class="cell"><span class="flex-1 text-label-2">Défense</span><span class="font-semibold tabular-nums">{data.owned ? fmt(c.defense) : '?'}</span></div>
			<div class="cell"><span class="flex-1 text-label-2">Joueurs qui la possèdent</span><span class="font-semibold">{data.owners}</span></div>
			{#if data.lastSale}<div class="cell"><span class="flex-1 text-label-2">Dernière vente</span><Kamas value={data.lastSale} /></div>{/if}
		</div>

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
							<p class="headline">Vendre au jeu</p>
							<p class="footnote text-label-2">{data.sellValue} kamas par exemplaire, vente immédiate</p>
						</div>
						<div class="stepper" aria-label="Quantité">
							<button type="button" onclick={() => (qty = Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Moins">−</button>
							<span class="tabular-nums" data-testid="sell-qty">{qty}</span>
							<button type="button" onclick={() => (qty = Math.min(data.sellable, qty + 1))} disabled={qty >= data.sellable} aria-label="Plus">+</button>
						</div>
					</div>
					{#if data.sellable > 1}
						<div class="flex gap-2 flex-wrap">
							{#if data.owned > 1 && data.sellable >= data.owned - 1}<button type="button" class="chip" onclick={() => (qty = data.owned - 1)}>Doublons ({data.owned - 1})</button>{/if}
							<button type="button" class="chip" onclick={() => (qty = data.sellable)}>Tout ({data.sellable})</button>
						</div>
					{/if}
					<button class="btn btn-block" disabled={selling} data-testid="sell" onclick={() => (needsConfirm ? (confirmOpen = true) : doSell())}>
						<Icon name="coins" size={18} />Vendre {qty > 1 ? `${qty} exemplaires ` : ''}+{fmt(qty * data.sellValue)} kamas
					</button>
					{#if data.owned - data.sellable > 0}<p class="footnote text-label-3">{data.owned - data.sellable} exemplaire{data.owned - data.sellable > 1 ? 's' : ''} bloqué{data.owned - data.sellable > 1 ? 's' : ''} (en vente aux enchères ou proposé en échange).</p>{/if}
				</section>
			{:else}
				<p class="footnote text-label-2">Tous tes exemplaires sont engagés (enchère ou échange en cours) : la vente au jeu est indisponible.</p>
			{/if}
		{:else}
			<p class="alert" style="background: var(--surface-3)">Tu n'as pas encore cette carte. Ouvre des paquets, guette les enchères ou propose un échange.</p>
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
		title="Vendre {qty} x {c.name} pour {fmt(qty * data.sellValue)} kamas ?"
		message={confirmMsg}
		confirmLabel="Vendre"
		destructive
		onconfirm={doSell}
		oncancel={() => (confirmOpen = false)}
	/>
{/if}

<style>
	.stepper {
		display: inline-flex;
		align-items: center;
		background: var(--surface-3);
		border-radius: 10px;
		overflow: hidden;
	}
	.stepper button {
		width: 40px;
		height: 34px;
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
	.back {
		display: inline-flex;
		align-items: center;
		color: var(--accent);
		text-decoration: none;
		margin: 0 0 8px -6px;
		font-size: 17px;
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
