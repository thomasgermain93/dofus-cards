<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Kamas from '#lib/components/Kamas.svelte';
	import { RARITY, rarityColor } from '#lib/rarity';
	import { duration, fmt } from '#lib/format';

	let { data, form } = $props();
	const c = $derived(data.card);
	const dupes = $derived(Math.max(0, Math.min(data.free, data.owned - 1)));
	let discardCount = $state(1);
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
		<div class="big"><Card card={c} size="lg" missing={!data.owned} favorite={data.fav} /></div>
	</div>

	<div class="flex flex-col gap-4 min-w-0">
		<div>
			<p class="footnote font-bold" style="color: {rarityColor(c.rarity)}">{RARITY[c.rarity].name}</p>
			<h1 class="large-title">{data.owned ? c.name : 'Carte manquante'}</h1>
			<p class="text-label-2">{c.subtype}{c.category !== 'class' ? `, niveau ${c.level}` : ''}</p>
		</div>

		{#if form?.error}<p class="alert alert-error">{form.error}</p>{/if}
		{#if form?.discarded}<p class="alert alert-ok">Défaussé : +{fmt(form.discarded.gain)} kamas.</p>{/if}
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
						<input class="field" type="number" name="price" min="1" value={Math.max(1, data.lastSale ?? data.discardValue * 3)} required />
					</label>
					<label class="flex flex-col gap-1"><span class="footnote text-label-2">Durée</span>
						<select class="field" name="duration">
							{#each data.durations as h}<option value={h} selected={h === 24}>{h < 24 ? `${h} h` : `${h / 24} jour${h > 24 ? 's' : ''}`}</option>{/each}
						</select>
					</label>
					<button class="btn">Mettre en vente</button>
				</form>
			{/if}

			{#if dupes > 0}
				<form method="POST" action="?/discard" use:enhance class="group p-4 flex items-center gap-3 flex-wrap">
					<div class="flex-1 min-w-[180px]">
						<p class="headline">Défausser des doublons</p>
						<p class="footnote text-label-2">{data.discardValue} kamas par exemplaire, {dupes} doublon{dupes > 1 ? 's' : ''} disponible{dupes > 1 ? 's' : ''}</p>
					</div>
					<input class="field w-20" type="number" name="count" min="1" max={dupes} bind:value={discardCount} aria-label="Nombre" />
					<button class="btn btn-danger btn-sm">+{fmt(discardCount * data.discardValue)} kamas</button>
				</form>
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

<style>
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
