<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Kamas from '#lib/components/Kamas.svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>Liste de souhaits</title></svelte:head>

<h1 class="large-title mb-1">Liste de souhaits</h1>
<p class="text-label-2 mb-4">Ajoute des cartes depuis leur fiche. Tu es prévenu dès qu'une carte souhaitée est mise aux enchères, et tu vois quels amis l'ont en double. Si un membre de ta guilde te l'offre, sa guilde gagne des points.</p>
{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}

<div class="list">
	{#each data.cards as c (c.id)}
		<div class="item" data-testid="wish">
			<a href="/card/{c.id}" class="w-24 flex-none"><Card card={c} size="sm" missing={!c.owned} /></a>
			<div class="flex-1 min-w-0 flex flex-col gap-1">
				<p class="headline truncate">{c.name}</p>
				<p class="footnote text-label-2">{c.owned ? `Tu en as ${c.owned}` : 'Pas encore dans ton album'}</p>
				{#if c.auction_id}
					<a class="tag ok" href="/market/{c.auction_id}"><Icon name="gavel" size={13} />En vente : <Kamas value={c.auction_price ?? 0} size="sm" /></a>
				{/if}
				{#if c.friends.length}
					<a class="tag" href="/trades/new?to={encodeURIComponent(c.friends[0])}"><Icon name="repeat" size={13} />En double chez {c.friends.join(', ')}</a>
				{/if}
				<form method="POST" action="?/toggle" use:enhance class="mt-auto">
					<input type="hidden" name="card" value={c.id} />
					<button class="btn btn-plain btn-sm px-0">Retirer</button>
				</form>
			</div>
		</div>
	{:else}
		<p class="text-label-2 text-center py-10 col-span-full">Ta liste est vide. Sur la fiche d'une carte, touche « Souhaiter ».</p>
	{/each}
</div>

<style>
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
		background: var(--surface);
		border-radius: var(--radius-lg);
		padding: 12px;
	}
	.tag {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12.5px;
		font-weight: 600;
		padding: 2px 10px;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent);
		text-decoration: none;
	}
	.tag.ok {
		background: var(--success-soft);
		color: var(--success);
	}
</style>
