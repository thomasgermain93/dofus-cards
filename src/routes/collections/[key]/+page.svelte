<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { fmt } from '#lib/format';
	let { data } = $props();
	const c = $derived(data.collection);
</script>

<svelte:head><title>{c.name}</title></svelte:head>

<a href="/collections?kind={c.kind}" class="back"><Icon name="chevron-left" size={20} />Collections</a>
<p class="footnote font-bold text-accent">{c.kindLabel}</p>
<h1 class="large-title">{c.name}</h1>
<p class="text-label-2 mb-2">{c.have} / {c.total} cartes. Récompense : {fmt(c.reward.kamas)} kamas, {c.reward.fragments} fragments, une carte brillante{c.reward.title ? ` et le titre « ${c.reward.title} »` : ''}.</p>
<div class="bar mb-4"><span style="width: {(c.have / c.total) * 100}%"></span></div>
{#if c.complete && !c.claimed}
	<form method="POST" action="/collections?/claim" use:enhance class="mb-4">
		<input type="hidden" name="key" value={c.key} />
		<button class="btn btn-block">Récupérer la récompense</button>
	</form>
{:else if c.claimed}
	<p class="alert alert-ok mb-4">Collection complétée et récompense récupérée.</p>
{/if}

<div class="grid-cards">
	{#each data.cards as x (x.card.id)}
		<a href="/card/{x.card.id}" class="block"><Card card={x.card} size="sm" missing={!x.count} count={x.count} foil={x.shiny} /></a>
	{/each}
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
	.bar {
		height: 6px;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--accent);
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
</style>
