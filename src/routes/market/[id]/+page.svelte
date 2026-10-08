<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Kamas from '#lib/components/Kamas.svelte';
	import Countdown from '#lib/components/Countdown.svelte';
	import { ago, fmt } from '#lib/format';

	let { data, form } = $props();
	const a = $derived(data.auction);
	const me = $derived(page.data.me);
	const mine = $derived(a.seller_id === me?.id);
	const leading = $derived(a.bidder_id === me?.id);
	let amount = $state(0);
	$effect(() => {
		amount = data.minBid;
	});
	const STATUS: Record<string, string> = { sold: 'Vendue', unsold: 'Terminée sans enchère', cancelled: 'Annulée' };
</script>

<svelte:head><title>Enchère : {data.card.name}</title></svelte:head>

<a href="/market" class="back-link"><Icon name="chevron-left" size={20} />Marché</a>

<div class="layout">
	<div class="flex justify-center"><div class="w-[min(280px,72vw)]"><Card card={data.card} size="lg" /></div></div>

	<div class="flex flex-col gap-4">
		<div>
			<h1 class="large-title">{data.card.name}</h1>
			<p class="text-label-2">Vendu par <a class="text-accent" href="/u/{a.seller}">{a.seller}</a>{data.owned ? `, tu en as ${data.owned}` : ', carte manquante dans ton album'}</p>
		</div>

		{#if form?.error}<p class="alert alert-error">{form.error}</p>{/if}
		{#if form?.bid}<p class="alert alert-ok">Enchère placée ! Tes kamas sont réservés jusqu'à la fin de la vente.</p>{/if}

		<div class="group">
			<div class="cell"><span class="flex-1 text-label-2">{a.current_bid ? 'Enchère actuelle' : 'Prix de départ'}</span><Kamas value={a.current_bid ?? a.start_price} /></div>
			<div class="cell"><span class="flex-1 text-label-2">Enchères</span><span class="font-semibold">{a.bid_count}</span></div>
			<div class="cell">
				<span class="flex-1 text-label-2">{a.status === 'open' ? 'Fin dans' : 'Statut'}</span>
				<span class="font-semibold">{#if a.status === 'open'}<Countdown target={a.ends_at} serverNow={data.now} ondone={() => setTimeout(invalidateAll, 1500)} />{:else}{STATUS[a.status]}{/if}</span>
			</div>
		</div>

		{#if a.status === 'open'}
			{#if mine}
				{#if a.bid_count === 0}
					<form method="POST" action="?/cancel" use:enhance><button class="btn btn-danger btn-block">Annuler la vente</button></form>
				{:else}
					<p class="footnote text-label-2">Ta carte est en vente. Tu recevras les kamas à la clôture.</p>
				{/if}
			{:else if leading}
				<p class="alert alert-ok">Tu es le meilleur enchérisseur.</p>
			{:else}
				<form method="POST" action="?/bid" use:enhance class="group p-4 flex flex-col gap-3">
					<label class="flex flex-col gap-1">
						<span class="footnote text-label-2">Ton enchère (minimum {fmt(data.minBid)} kamas, tu as {fmt(me?.kamas)} kamas)</span>
						<input class="field" type="number" name="amount" min={data.minBid} bind:value={amount} required />
					</label>
					<button class="btn" data-testid="bid"><Icon name="gavel" size={18} />Enchérir {fmt(amount)} kamas</button>
					<p class="footnote text-label-3">Si quelqu'un enchérit plus haut, tes kamas te sont rendus automatiquement. Une enchère dans les 10 dernières secondes prolonge la vente de 60 secondes.</p>
				</form>
			{/if}
		{/if}

		{#if data.bids.length}
			<div>
				<h2 class="section-label">Historique</h2>
				<div class="group">
					{#each data.bids as b, i (i)}
						<div class="cell"><span class="flex-1">{b.username}<span class="block footnote text-label-2">{ago(b.created_at)}</span></span><Kamas value={b.amount} /></div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.layout {
		display: grid;
		gap: 24px;
	}
	@media (min-width: 900px) {
		.layout {
			grid-template-columns: 320px 1fr;
			align-items: start;
		}
	}
</style>
