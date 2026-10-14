<script lang="ts">
	import { page } from '$app/state';
	import CardThumb from '#lib/components/CardThumb.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Kamas from '#lib/components/Kamas.svelte';
	import { ago } from '#lib/format';

	let { data } = $props();
	const me = $derived(page.data.me);
	const STATUS: Record<string, string> = { pending: 'En attente', accepted: 'Accepté', declined: 'Refusé', cancelled: 'Annulé', failed: 'Échoué', countered: 'Contre-proposé' };
</script>

<svelte:head><title>Échanges</title></svelte:head>

<h1 class="large-title mb-3">Marché</h1>
<nav class="segmented mb-4" aria-label="Marché">
	<a href="/market">Enchères</a>
	<a href="/trades" aria-current="page">Échanges</a>
</nav>

<a class="btn btn-block mb-4" href="/trades/new"><Icon name="plus" size={18} />Proposer un échange</a>

<div class="flex flex-col gap-3">
	{#each data.trades as t (t.id)}
		{@const incoming = t.to_id === me?.id}
		<a href="/trades/{t.id}" class="trade">
			<div class="flex items-center justify-between mb-2">
				<span class="headline">{incoming ? `De ${t.from_name}` : `À ${t.to_name}`}</span>
				<span class="status s-{t.status}">{STATUS[t.status]}</span>
			</div>
			<div class="sides">
				<div class="side">
					<span class="footnote text-label-2">{incoming ? 'Tu reçois' : 'Tu donnes'}</span>
					<div class="thumbs">
						{#each t.offer as c (c.id)}<CardThumb card={c} size={52} />{/each}
						{#if t.offer_kamas}<Kamas value={t.offer_kamas} />{/if}
					</div>
				</div>
				<Icon name="repeat" size={18} class="text-label-3 flex-none" />
				<div class="side">
					<span class="footnote text-label-2">{incoming ? 'Tu donnes' : 'Tu reçois'}</span>
					<div class="thumbs">{#each t.request as c (c.id)}<CardThumb card={c} size={52} />{/each}</div>
				</div>
			</div>
			<p class="footnote text-label-3 mt-2">{ago(t.created_at)}</p>
		</a>
	{:else}
		<p class="text-label-2 text-center py-10">Aucun échange. Propose une carte à un ami !</p>
	{/each}
</div>

<style>
	.trade {
		background: var(--surface);
		border-radius: var(--radius-lg);
		padding: 14px;
		color: inherit;
		text-decoration: none;
	}
	.sides {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.side {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.thumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.t {
		width: 52px;
	}
	.status {
		font-size: 12px;
		font-weight: 700;
		padding: 2px 10px;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--label-2);
	}
	.s-pending {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.s-accepted {
		background: var(--success-soft);
		color: var(--success);
	}
</style>
